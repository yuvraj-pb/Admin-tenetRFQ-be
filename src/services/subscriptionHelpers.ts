import Plan from "../database/models/plan";
import Subscription from "../database/models/subscription";

/** The company's most recent subscription (with plan eager-loaded). */
export const latestSubscription = (companyId: number) =>
  Subscription.findOne({
    where: { company_id: companyId },
    include: [{ model: Plan, as: "plan" }],
    order: [["id", "DESC"]],
  });

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
