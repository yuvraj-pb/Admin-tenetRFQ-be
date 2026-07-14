import Plan, { PlanFeatures } from "../database/models/plan";
import { serializePlan } from "../utils/serializers";
import { httpError } from "../utils/httpError";

const GB = 1024 * 1024 * 1024;

const allFeatures = (overrides: Partial<PlanFeatures>): PlanFeatures => ({
  analytics: false,
  advancedAnalytics: false,
  supplierPortal: false,
  approvalWorkflow: false,
  prioritySupport: false,
  dedicatedSupport: false,
  customIntegrations: false,
  ...overrides,
});

/** Seed plans per the handoff spec §13. */
export const SEED_PLANS = [
  {
    code: "basic",
    name: "Basic",
    description: "For small teams getting started with RFQ procurement",
    price_monthly: 4999,
    price_yearly: 49990,
    currency: "INR",
    max_branches: 3,
    max_users: 10,
    max_storage_bytes: 5 * GB,
    features: allFeatures({ analytics: true }),
    is_active: true,
    sort_order: 1,
  },
  {
    code: "professional",
    name: "Professional",
    description:
      "For growing organizations with analytics, supplier portal and approvals",
    price_monthly: 14999,
    price_yearly: 149990,
    currency: "INR",
    max_branches: 15,
    max_users: 50,
    max_storage_bytes: 50 * GB,
    features: allFeatures({
      analytics: true,
      advancedAnalytics: true,
      supplierPortal: true,
      approvalWorkflow: true,
      prioritySupport: true,
    }),
    is_active: true,
    sort_order: 2,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description: "Unlimited scale with dedicated support and custom integrations",
    price_monthly: 49999,
    price_yearly: 499990,
    currency: "INR",
    max_branches: null,
    max_users: null,
    max_storage_bytes: null,
    features: allFeatures({
      analytics: true,
      advancedAnalytics: true,
      supplierPortal: true,
      approvalWorkflow: true,
      prioritySupport: true,
      dedicatedSupport: true,
      customIntegrations: true,
    }),
    is_active: true,
    sort_order: 3,
  },
];

/** Upsert seed plans by code (idempotent). */
export const seedPlans = async () => {
  for (const plan of SEED_PLANS) {
    const existing = await Plan.findOne({ where: { code: plan.code } });
    if (existing) await existing.update(plan as any);
    else await Plan.create(plan as any);
  }
};

export const listPlans = async () => {
  const plans = await Plan.findAll({
    where: { is_active: true },
    order: [["sort_order", "ASC"]],
  });
  return plans.map(serializePlan);
};

export const getPlanById = async (id: number) => {
  const plan = await Plan.findByPk(id);
  if (!plan) throw httpError("Plan not found", 404);
  return serializePlan(plan);
};
