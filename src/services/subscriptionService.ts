import { Op } from "sequelize";
import Company from "../database/models/company";
import Plan from "../database/models/plan";
import Subscription from "../database/models/subscription";
import { getCompanyUsage, assertDowngradeAllowed } from "./usageService";
import {
  amountForPlan,
  latestSubscription,
  normalizeInterval,
  normalizeProvider,
  periodEndFromNow,
} from "./subscriptionHelpers";
import { buildCheckoutSession } from "./billing/billingService";
import { writeAudit } from "./auditService";
import { serializeSubscription } from "../utils/serializers";
import { httpError } from "../utils/httpError";
import { AUDIT_ACTIONS } from "../utils/auditActions";
import PlatformPayment from "../database/models/platformPayment";

const serialize = async (sub: Subscription) => {
  const plan = sub.plan ?? (await Plan.findByPk(sub.plan_id));
  const company =
    sub.company ??
    (await Company.findByPk(sub.company_id, {
      attributes: ["id", "companyName"],
    }));
  const usage = await getCompanyUsage(sub.company_id);
  return serializeSubscription({
    subscription: sub,
    plan: plan ?? null,
    companyName: company?.companyName ?? "",
    usage,
  });
};

export const listSubscriptions = async (query: Record<string, any>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const where: any = {};
  if (query.status && query.status !== "all") where.status = String(query.status);
  if (query.expiringWithinDays) {
    const soon = new Date();
    soon.setDate(soon.getDate() + Number(query.expiringWithinDays));
    where.current_period_end = { [Op.between]: [new Date(), soon] };
  }

  const { rows, count } = await Subscription.findAndCountAll({
    where,
    include: [
      { model: Plan, as: "plan" },
      { model: Company, as: "company", attributes: ["id", "companyName"] },
    ],
    order: [["id", "DESC"]],
    limit,
    offset,
  });

  const data = await Promise.all(rows.map(serialize));
  return { data, page, limit, total: count };
};

/** Returns null when the company has no subscription yet (not an error). */
export const getCompanySubscription = async (companyId: number) => {
  const sub = await latestSubscription(companyId);
  if (!sub) return null;
  return serialize(sub);
};

export const changeCompanyPlan = async (
  companyId: number,
  body: any,
  actor?: number,
  ip?: string,
) => {
  const company = await Company.findByPk(companyId);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const plan = await Plan.findByPk(Number(body.planId));
  if (!plan || !plan.is_active) throw httpError("Invalid plan", 400);

  await assertDowngradeAllowed(companyId, plan);

  const billingInterval = normalizeInterval(body.billingInterval);
  const paymentProvider = normalizeProvider(body.paymentProvider);

  let sub = await latestSubscription(companyId);
  if (!sub) {
    sub = await Subscription.create({
      company_id: companyId,
      plan_id: plan.id,
      status: "incomplete",
      billing_interval: billingInterval,
      current_period_start: new Date(),
      current_period_end: periodEndFromNow(billingInterval),
      amount: amountForPlan(plan, billingInterval),
      currency: plan.currency || "INR",
      payment_provider: paymentProvider,
    });
  } else {
    await sub.update({
      plan_id: plan.id,
      billing_interval: billingInterval,
      amount: amountForPlan(plan, billingInterval),
      payment_provider: paymentProvider,
      status: "incomplete",
    });
  }

  await writeAudit({
    actorUserId: actor,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CHANGED,
    companyId,
    ip,
    meta: { planId: plan.id, billingInterval },
  });

  return buildCheckoutSession({
    company,
    plan,
    subscription: sub,
    billingInterval,
    paymentProvider,
    purpose: "upgrade",
  });
};

export const renewCompanySubscription = async (
  companyId: number,
  body: any,
  actor?: number,
  ip?: string,
) => {
  const company = await Company.findByPk(companyId);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const sub = await latestSubscription(companyId);
  if (!sub) throw httpError("Subscription not found", 404);
  const plan = sub.plan ?? (await Plan.findByPk(sub.plan_id));
  if (!plan) throw httpError("Plan not found", 404);

  const billingInterval = body.billingInterval
    ? normalizeInterval(body.billingInterval)
    : (sub.billing_interval as "monthly" | "yearly");
  const paymentProvider = normalizeProvider(body.paymentProvider);

  await sub.update({
    billing_interval: billingInterval,
    amount: amountForPlan(plan, billingInterval),
    payment_provider: paymentProvider,
    status: "incomplete",
  });

  await writeAudit({
    actorUserId: actor,
    action: AUDIT_ACTIONS.SUBSCRIPTION_RENEWED,
    companyId,
    ip,
    meta: { billingInterval },
  });

  return buildCheckoutSession({
    company,
    plan,
    subscription: sub,
    billingInterval,
    paymentProvider,
    purpose: "renew",
  });
};

/**
 * Super Admin covers this tenant from the platform account.
 * No Razorpay/Stripe charge — the operator is not the customer.
 */
export const grantCompanySubscription = async (
  companyId: number,
  body: any,
  actor?: number,
  ip?: string,
) => {
  const company = await Company.findByPk(companyId);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }

  let sub = await latestSubscription(companyId);
  const planId = Number(body.planId || sub?.plan_id);
  const plan = await Plan.findByPk(planId);
  if (!plan || !plan.is_active) throw httpError("Invalid plan", 400);

  if (sub) {
    await assertDowngradeAllowed(companyId, plan);
  }

  const billingInterval = normalizeInterval(body.billingInterval);
  const now = new Date();
  const amount = amountForPlan(plan, billingInterval);
  const currency = plan.currency || "INR";

  if (!sub) {
    sub = await Subscription.create({
      company_id: companyId,
      plan_id: plan.id,
      status: "active",
      billing_interval: billingInterval,
      current_period_start: now,
      current_period_end: periodEndFromNow(billingInterval, now),
      amount,
      currency,
      payment_provider: "owner",
      cancel_at_period_end: false,
      auto_renew: true,
    });
  } else {
    await sub.update({
      plan_id: plan.id,
      status: "active",
      billing_interval: billingInterval,
      current_period_start: now,
      current_period_end: periodEndFromNow(billingInterval, now),
      amount,
      currency,
      payment_provider: "owner",
      cancel_at_period_end: false,
      auto_renew: true,
    });
  }

  await PlatformPayment.create({
    company_id: companyId,
    subscription_id: sub.id,
    provider: "owner",
    amount,
    currency,
    status: "paid",
    purpose: "grant",
    raw_payload: {
      coveredBy: "platform_owner",
      reason: body.reason || "Covered by platform operator — tenant not charged",
    },
  });

  const previousStatus = company.status;
  const restoreAccess = body.restoreAccess !== false;
  if (restoreAccess && (previousStatus === "archived" || previousStatus === "suspended")) {
    await company.update({ status: "active" });
    await writeAudit({
      actorUserId: actor,
      action: AUDIT_ACTIONS.COMPANY_ACTIVATED,
      companyId,
      ip,
      meta: { restoredOnGrant: true, previousStatus },
    });
  }

  await writeAudit({
    actorUserId: actor,
    action: AUDIT_ACTIONS.SUBSCRIPTION_GRANTED,
    companyId,
    ip,
    meta: { planId: plan.id, billingInterval, amount },
  });

  return serialize(sub);
};

export const cancelCompanySubscription = async (
  companyId: number,
  atPeriodEnd = true,
  actor?: number,
  ip?: string,
) => {
  const sub = await latestSubscription(companyId);
  if (!sub) throw httpError("Subscription not found", 404);
  if (atPeriodEnd) {
    await sub.update({ cancel_at_period_end: true, auto_renew: false });
  } else {
    await sub.update({
      status: "cancelled",
      cancel_at_period_end: false,
      auto_renew: false,
    });
  }
  await writeAudit({
    actorUserId: actor,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
    companyId,
    ip,
    meta: { atPeriodEnd },
  });
  return serialize(sub);
};

export const resumeCompanySubscription = async (
  companyId: number,
  actor?: number,
  ip?: string,
) => {
  const sub = await latestSubscription(companyId);
  if (!sub) throw httpError("Subscription not found", 404);
  if (sub.status === "cancelled" || sub.status === "expired") {
    throw httpError("Renew the subscription to restore access", 400);
  }
  await sub.update({ cancel_at_period_end: false, auto_renew: true });
  await writeAudit({
    actorUserId: actor,
    action: AUDIT_ACTIONS.SUBSCRIPTION_RESUMED,
    companyId,
    ip,
    meta: {},
  });
  return serialize(sub);
};
