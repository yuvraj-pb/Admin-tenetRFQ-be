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

  await writeAudit(actor, "subscription.change_plan", companyId, {
    planId: plan.id,
    billingInterval,
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

  await writeAudit(actor, "subscription.renew", companyId, { billingInterval });

  return buildCheckoutSession({
    company,
    plan,
    subscription: sub,
    billingInterval,
    paymentProvider,
    purpose: "renew",
  });
};

export const cancelCompanySubscription = async (
  companyId: number,
  atPeriodEnd = true,
  actor?: number,
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
  await writeAudit(actor, "subscription.cancel", companyId, { atPeriodEnd });
  return serialize(sub);
};
