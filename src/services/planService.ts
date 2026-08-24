import Plan, { PlanFeatures } from "../database/models/plan";
import { serializePlan } from "../utils/serializers";
import { httpError } from "../utils/httpError";
import { DEFAULT_FEATURES, ModuleFlags, normalizeFeatures } from "../utils/entitlements";
import { slugify } from "../utils/slug";
import { Op } from "sequelize";

const GB = 1024 * 1024 * 1024;

const allFeatures = (overrides: Partial<ModuleFlags>): ModuleFlags => ({
  ...DEFAULT_FEATURES,
  ...overrides,
});

const CORE_BASIC: Partial<ModuleFlags> = {
  rfqCore: true,
  quotes: true,
  users: true,
  notifications: true,
  analytics: true,
};

const CORE_PRO: Partial<ModuleFlags> = {
  ...CORE_BASIC,
  approvalWorkflow: true,
  negotiations: true,
  rfqDeletionApprovals: true,
  supplierNetwork: true,
  supplierPortal: true,
  orders: true,
  dispatch: true,
  deliveries: true,
  quality: true,
  slaDisputes: true,
  approvalsHub: true,
  roles: true,
  branches: true,
  advancedAnalytics: true,
  analyticsExport: true,
  qualityAnalytics: true,
  prioritySupport: true,
};

const CORE_ENT: Partial<ModuleFlags> = {
  ...CORE_PRO,
  customIntegrations: true,
  dedicatedSupport: true,
};

/** Seed plans per the handoff spec — expanded module matrix. */
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
    features: allFeatures(CORE_BASIC) as PlanFeatures,
    is_active: true,
    sort_order: 1,
    kind: "catalog",
    negotiable: true,
    trial_days: null,
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
    features: allFeatures(CORE_PRO) as PlanFeatures,
    is_active: true,
    sort_order: 2,
    kind: "catalog",
    negotiable: true,
    trial_days: null,
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
    features: allFeatures(CORE_ENT) as PlanFeatures,
    is_active: true,
    sort_order: 3,
    kind: "catalog",
    negotiable: true,
    trial_days: null,
  },
  {
    code: "trial",
    name: "30-day trial",
    description: "Training trial — modules unlocked for 30 days, then a custom quote",
    price_monthly: 0,
    price_yearly: 0,
    currency: "INR",
    max_branches: 1,
    max_users: 5,
    max_storage_bytes: 5 * GB,
    features: allFeatures(CORE_BASIC) as PlanFeatures,
    is_active: true,
    sort_order: 0,
    kind: "trial",
    negotiable: true,
    trial_days: 30,
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

export const listPlans = async (query: Record<string, any> = {}) => {
  const where: any = {};
  if (query.kind) where.kind = String(query.kind);
  if (query.includeArchived !== "true" && query.includeArchived !== true) {
    where.is_active = true;
  }
  const plans = await Plan.findAll({
    where,
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
  });
  return plans.map(serializePlan);
};

export const getPlanById = async (id: number) => {
  const plan = await Plan.findByPk(id);
  if (!plan) throw httpError("Plan not found", 404);
  return serializePlan(plan);
};

const allocatePlanCode = async (name: string, preferred?: string) => {
  const base = slugify(preferred || name).slice(0, 48) || "plan";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await Plan.findOne({ where: { code: candidate } });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};

const planFieldsFromBody = (body: any) => {
  const kind = ["catalog", "custom", "trial"].includes(String(body.kind))
    ? String(body.kind)
    : "catalog";
  return {
    name: String(body.name).trim(),
    description: body.description ?? null,
    price_monthly: Number(body.priceMonthly ?? 0),
    price_yearly: Number(body.priceYearly ?? 0),
    currency: body.currency || "INR",
    max_users: body.maxUsers === undefined ? undefined : body.maxUsers,
    max_branches: body.maxBranches === undefined ? undefined : body.maxBranches,
    max_storage_bytes:
      body.maxStorageBytes === undefined ? undefined : body.maxStorageBytes,
    features: body.features
      ? (normalizeFeatures(body.features) as PlanFeatures)
      : undefined,
    is_active: body.isActive === undefined ? undefined : !!body.isActive,
    sort_order: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
    kind,
    negotiable: body.negotiable === undefined ? kind !== "catalog" : !!body.negotiable,
    trial_days:
      body.trialDays === undefined
        ? kind === "trial"
          ? 30
          : null
        : body.trialDays,
    company_id: body.companyId ?? null,
  };
};

export const createPlan = async (body: any) => {
  if (!body?.name) throw httpError("name is required", 400);
  const fields = planFieldsFromBody(body);
  const code = await allocatePlanCode(fields.name, body.code);
  const plan = await Plan.create({
    ...fields,
    features: (fields.features || { ...DEFAULT_FEATURES }) as PlanFeatures,
    is_active: fields.is_active !== false,
    sort_order: fields.sort_order ?? 10,
    code,
  } as any);
  return serializePlan(plan);
};

export const updatePlan = async (id: number, body: any) => {
  const plan = await Plan.findByPk(id);
  if (!plan) throw httpError("Plan not found", 404);
  const fields = planFieldsFromBody({ ...serializePlan(plan), ...body });
  const updates: Record<string, unknown> = {
    name: fields.name,
    description: fields.description,
    price_monthly: fields.price_monthly,
    price_yearly: fields.price_yearly,
    currency: fields.currency,
    kind: fields.kind,
    negotiable: fields.negotiable,
    trial_days: fields.trial_days,
  };
  if (fields.max_users !== undefined) updates.max_users = fields.max_users;
  if (fields.max_branches !== undefined) updates.max_branches = fields.max_branches;
  if (fields.max_storage_bytes !== undefined) {
    updates.max_storage_bytes = fields.max_storage_bytes;
  }
  if (fields.features) updates.features = fields.features;
  if (fields.is_active !== undefined) updates.is_active = fields.is_active;
  if (fields.sort_order !== undefined) updates.sort_order = fields.sort_order;
  if (body.code && String(body.code) !== plan.code) {
    const taken = await Plan.findOne({
      where: { code: String(body.code), id: { [Op.ne]: id } },
    });
    if (taken) throw httpError("Plan code already in use", 409);
    updates.code = String(body.code);
  }
  await plan.update(updates);
  return serializePlan(plan);
};

export const archivePlan = async (id: number) => {
  const plan = await Plan.findByPk(id);
  if (!plan) throw httpError("Plan not found", 404);
  await plan.update({ is_active: false });
  return serializePlan(plan);
};

export const getOrCreateTrialPlan = async () => {
  let plan = await Plan.findOne({
    where: { kind: "trial", is_active: true },
    order: [["id", "ASC"]],
  });
  if (!plan) {
    await seedPlans();
    plan = await Plan.findOne({
      where: { kind: "trial", is_active: true },
      order: [["id", "ASC"]],
    });
  }
  if (!plan) throw httpError("Trial plan is not configured", 500);
  return plan;
};

export const upsertCustomPlan = async (opts: {
  companyId: number;
  name: string;
  amount: number;
  billingInterval: string;
  currency?: string;
  features?: PlanFeatures;
  maxUsers?: number | null;
  maxBranches?: number | null;
  maxStorageBytes?: number | null;
}) => {
  const yearly =
    opts.billingInterval === "yearly" ? opts.amount : Number(opts.amount) * 10;
  const monthly =
    opts.billingInterval === "yearly"
      ? Math.round(Number(opts.amount) / 10)
      : opts.amount;
  const existing = await Plan.findOne({
    where: { company_id: opts.companyId, kind: "custom", is_active: true },
    order: [["id", "DESC"]],
  });
  const payload = {
    name: opts.name,
    description: `Negotiated package for tenant ${opts.companyId}`,
    price_monthly: monthly,
    price_yearly: yearly,
    currency: opts.currency || "INR",
    max_users: opts.maxUsers ?? null,
    max_branches: opts.maxBranches ?? null,
    max_storage_bytes: opts.maxStorageBytes ?? null,
    features: normalizeFeatures(opts.features) as PlanFeatures,
    is_active: true,
    kind: "custom",
    negotiable: true,
    company_id: opts.companyId,
  };
  if (existing) {
    await existing.update(payload);
    return existing;
  }
  return Plan.create({
    ...payload,
    code: await allocatePlanCode(opts.name, `custom-${opts.companyId}`),
    sort_order: 50,
  } as any);
};
