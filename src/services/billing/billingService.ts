import Company from "../../database/models/company";
import Plan from "../../database/models/plan";
import Subscription from "../../database/models/subscription";
import PlatformPayment from "../../database/models/platformPayment";
import { writeAudit } from "../auditService";
import {
  amountForPlan,
  latestSubscription,
  normalizeInterval,
  normalizeProvider,
  periodEndFromNow,
} from "../subscriptionHelpers";
import { httpError } from "../../utils/httpError";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
} from "./razorpay";
import { createStripeCheckout } from "./stripe";

export interface CheckoutSessionResponse {
  provider: "razorpay" | "stripe";
  checkoutUrl?: string | null;
  sessionId: string;
  /**
   * True when provider keys are missing — FE should call verifyPayment
   * instead of opening Checkout.js / redirecting to a live gateway.
   */
  stub?: boolean;
  razorpay?: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    prefill?: { name?: string; email?: string; contact?: string };
  };
}

/**
 * Creates a payment record + provider checkout session for a subscription.
 * Returns the FE `CheckoutSessionResponse`.
 */
export const buildCheckoutSession = async (opts: {
  company: Company;
  plan: Plan;
  subscription: Subscription;
  billingInterval: "monthly" | "yearly";
  paymentProvider: "razorpay" | "stripe";
  purpose: string;
}): Promise<CheckoutSessionResponse> => {
  const { company, plan, subscription, billingInterval, paymentProvider, purpose } =
    opts;
  const amount = amountForPlan(plan, billingInterval);
  const amountPaise = Math.round(amount * 100);
  const currency = plan.currency || process.env.DEFAULT_CURRENCY || "INR";
  const description = `${plan.name} (${billingInterval})`;
  const name = "Advance RFQ Platform";

  const payment = await PlatformPayment.create({
    company_id: company.id,
    subscription_id: subscription.id,
    provider: paymentProvider,
    amount,
    currency,
    status: "pending",
    purpose,
    raw_payload: { billingInterval, planId: plan.id },
  });

  if (paymentProvider === "stripe") {
    const checkout = await createStripeCheckout({
      amount,
      currency,
      name,
      description,
      metadata: {
        companyId: String(company.id),
        subscriptionId: String(subscription.id),
        paymentId: String(payment.id),
      },
      customerEmail: company.email || company.primaryContact?.email,
    });
    await payment.update({ provider_order_id: checkout.id });
    return {
      provider: "stripe",
      sessionId: checkout.id,
      checkoutUrl: checkout.url,
    };
  }

  const order = await createRazorpayOrder({
    amountPaise,
    currency,
    receipt: `sub_${subscription.id}_${payment.id}`,
    notes: { companyId: company.id, subscriptionId: subscription.id },
  });
  await payment.update({ provider_order_id: order.id });

  // No real keys → never hand Checkout.js a fake keyId (rzp_test_placeholder → 401).
  if (!isRazorpayConfigured()) {
    return {
      provider: "razorpay",
      sessionId: order.id,
      checkoutUrl: null,
      stub: true,
    };
  }

  return {
    provider: "razorpay",
    sessionId: order.id,
    checkoutUrl: null,
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID as string,
      orderId: order.id,
      amount: order.amount,
      currency,
      name,
      description,
      prefill: {
        name: company.primaryContact?.name || company.companyName,
        email: company.email || company.primaryContact?.email,
        contact: company.phone || company.primaryContact?.phone,
      },
    },
  };
};

/** Resolves or creates a subscription, then returns a checkout session. */
export const createBillingCheckout = async (body: any, actor?: number) => {
  const company = await Company.findByPk(Number(body.companyId));
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const plan = await Plan.findByPk(Number(body.planId));
  if (!plan) throw httpError("Plan not found", 404);

  const billingInterval = normalizeInterval(body.billingInterval);
  const paymentProvider = normalizeProvider(body.paymentProvider);

  let sub = await latestSubscription(company.id);
  if (!sub) {
    sub = await Subscription.create({
      company_id: company.id,
      plan_id: plan.id,
      status: "incomplete",
      billing_interval: billingInterval,
      current_period_start: new Date(),
      current_period_end: periodEndFromNow(billingInterval),
      amount: amountForPlan(plan, billingInterval),
      currency: plan.currency || "INR",
      payment_provider: paymentProvider,
    });
  }

  await writeAudit(actor, "billing.checkout", company.id, {
    purpose: body.purpose,
    planId: plan.id,
  });

  return buildCheckoutSession({
    company,
    plan,
    subscription: sub,
    billingInterval,
    paymentProvider,
    purpose: body.purpose || "new",
  });
};

const activateSubscriptionForPayment = async (payment: PlatformPayment) => {
  const sub = payment.subscription_id
    ? await Subscription.findByPk(payment.subscription_id)
    : await latestSubscription(payment.company_id);
  if (!sub) return null;
  const start = new Date();
  await sub.update({
    status: "active",
    current_period_start: start,
    current_period_end: periodEndFromNow(sub.billing_interval, start),
    cancel_at_period_end: false,
    auto_renew: true,
  });
  return sub;
};

/** In-app payment verification (Razorpay handshake / Stripe session id). */
export const verifyBillingPayment = async (body: any, actor?: number) => {
  const provider = normalizeProvider(body.provider);
  const orderId = body.sessionId || body.razorpayOrderId;
  if (!orderId) throw httpError("Missing payment session/order id", 400);

  const payment = await PlatformPayment.findOne({
    where: { provider_order_id: String(orderId), provider },
    order: [["id", "DESC"]],
  });
  if (!payment) throw httpError("Payment session not found", 404);

  if (provider === "razorpay" && body.razorpayPaymentId) {
    const ok = verifyRazorpayPaymentSignature({
      orderId: String(orderId),
      paymentId: String(body.razorpayPaymentId),
      signature: body.razorpaySignature,
    });
    if (!ok) {
      await payment.update({ status: "failed" });
      throw httpError("Payment signature verification failed", 400);
    }
  }

  await payment.update({
    status: "paid",
    provider_payment_id:
      body.razorpayPaymentId || body.sessionId || payment.provider_payment_id,
    raw_payload: { ...(payment.raw_payload || {}), verify: body },
  });

  const sub = await activateSubscriptionForPayment(payment);

  await writeAudit(actor, "billing.verify", payment.company_id, {
    orderId,
    provider,
  });

  return { subscriptionStatus: sub?.status || "active" };
};

/** Marks a payment paid + activates its subscription from a webhook. */
const settlePaymentByOrderId = async (
  provider: "razorpay" | "stripe",
  orderId: string,
  rawEvent: unknown,
  paymentId?: string,
) => {
  const payment = await PlatformPayment.findOne({
    where: { provider_order_id: String(orderId), provider },
    order: [["id", "DESC"]],
  });
  if (!payment) return;
  await payment.update({
    status: "paid",
    provider_payment_id: paymentId || payment.provider_payment_id,
    raw_payload: { ...(payment.raw_payload || {}), webhook: rawEvent },
  });
  await activateSubscriptionForPayment(payment);
  await writeAudit(null, `billing.webhook.${provider}`, payment.company_id, {
    orderId,
  });
};

export const handleRazorpayWebhook = async (event: any) => {
  const type = event?.event as string | undefined;
  const paymentEntity = event?.payload?.payment?.entity;
  const orderEntity = event?.payload?.order?.entity;
  const orderId = paymentEntity?.order_id || orderEntity?.id;
  if (!orderId) return;

  if (type === "payment.captured" || type === "order.paid") {
    await settlePaymentByOrderId(
      "razorpay",
      orderId,
      event,
      paymentEntity?.id,
    );
  } else if (type === "payment.failed") {
    const payment = await PlatformPayment.findOne({
      where: { provider_order_id: String(orderId), provider: "razorpay" },
      order: [["id", "DESC"]],
    });
    if (payment) await payment.update({ status: "failed", raw_payload: { webhook: event } });
  }
};

export const handleStripeWebhook = async (event: any) => {
  const type = event?.type as string | undefined;
  const obj = event?.data?.object;
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const sessionId = obj?.id;
    if (sessionId) {
      await settlePaymentByOrderId(
        "stripe",
        sessionId,
        event,
        obj?.payment_intent,
      );
    }
  } else if (type === "checkout.session.async_payment_failed") {
    const sessionId = obj?.id;
    if (sessionId) {
      const payment = await PlatformPayment.findOne({
        where: { provider_order_id: String(sessionId), provider: "stripe" },
        order: [["id", "DESC"]],
      });
      if (payment) await payment.update({ status: "failed", raw_payload: { webhook: event } });
    }
  }
};
