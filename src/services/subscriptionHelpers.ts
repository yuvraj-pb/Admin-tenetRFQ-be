import { Op } from "sequelize";
import Plan from "../database/models/plan";
import Subscription from "../database/models/subscription";

/** The company's most recent subscription (with plan eager-loaded). */
export const latestSubscription = async (companyId: number) => {
  const sub = await Subscription.findOne({
    where: { company_id: companyId },
    include: [{ model: Plan, as: "plan" }],
    order: [["id", "DESC"]],
  });
  if (
    sub &&
    sub.status === "trialing" &&
    sub.trial_ends_at &&
    new Date(sub.trial_ends_at).getTime() <= Date.now()
  ) {
    await sub.update({ status: "expired" });
  }
  return sub;
};

export const latestSubscriptionsByCompanyIds = async (companyIds: number[]) => {
  const map = new Map<number, Subscription>();
  if (!companyIds.length) return map;
  const rows = await Subscription.findAll({
    where: { company_id: { [Op.in]: companyIds } },
    include: [{ model: Plan, as: "plan" }],
    order: [["id", "DESC"]],
  });
  const now = Date.now();
  for (const row of rows) {
    if (map.has(row.company_id)) continue;
    if (
      row.status === "trialing" &&
      row.trial_ends_at &&
      new Date(row.trial_ends_at).getTime() <= now
    ) {
      await row.update({ status: "expired" });
    }
    map.set(row.company_id, row);
  }
  return map;
};

export const periodEndFromNow = (interval: string, from = new Date()): Date => {
  const end = new Date(from);
  if (interval === "yearly") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
};

export const amountForPlan = (plan: Plan, interval: string): number =>
  Number(interval === "yearly" ? plan.price_yearly : plan.price_monthly);

export const normalizeInterval = (value: unknown): "monthly" | "yearly" =>
  value === "yearly" ? "yearly" : "monthly";

export const normalizeProvider = (value: unknown): "razorpay" | "stripe" =>
  value === "stripe" ? "stripe" : "razorpay";
