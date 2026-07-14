import Company from "../database/models/company";
import Plan, { PlanFeatures } from "../database/models/plan";
import Subscription from "../database/models/subscription";

export interface PlatformUsage {
  branchesUsed: number;
  usersUsed: number;
  storageUsedBytes: number;
}

export interface CompanyAdminShape {
  id: number;
  name: string;
  email: string;
  mobile?: string;
}

/** Default feature flags — merged under any plan-specific overrides. */
export const DEFAULT_FEATURES: PlanFeatures = {
  analytics: false,
  advancedAnalytics: false,
  supplierPortal: false,
  approvalWorkflow: false,
  prioritySupport: false,
  dedicatedSupport: false,
  customIntegrations: false,
};

const toIso = (value?: Date | string | null): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const normalizeFeatures = (features?: Partial<PlanFeatures> | null): PlanFeatures => ({
  ...DEFAULT_FEATURES,
  ...(features || {}),
});

export const serializePlan = (plan: Plan) => ({
  id: plan.id,
  code: plan.code,
  name: plan.name,
  description: plan.description ?? undefined,
  priceMonthly: Number(plan.price_monthly),
  priceYearly: Number(plan.price_yearly),
  currency: plan.currency,
  maxBranches: plan.max_branches,
  maxUsers: plan.max_users,
  maxStorageBytes:
    plan.max_storage_bytes != null ? Number(plan.max_storage_bytes) : null,
  features: normalizeFeatures(plan.features),
  isActive: plan.is_active,
  sortOrder: plan.sort_order,
});

export const serializeCompany = (args: {
  company: Company;
  usage: PlatformUsage;
  companyAdmin: CompanyAdminShape | null;
  subscription: (Subscription & { plan?: Plan }) | null;
}) => {
  const { company, usage, companyAdmin, subscription } = args;
  const plan = subscription?.plan ?? null;
  return {
    id: company.id,
    companyName: company.companyName,
    legalName: company.legal_name ?? undefined,
    email: company.email ?? company.primaryContact?.email ?? undefined,
    phone: company.phone ?? company.primaryContact?.phone ?? undefined,
    gstNumber: company.gstNumber ?? undefined,
    addressLine: company.addressLine ?? undefined,
    city: company.city ?? undefined,
    state: company.state ?? undefined,
    country: company.country ?? "IN",
    status: (company.status || "active") as
      | "active"
      | "suspended"
      | "archived"
      | "deleted",
    plan: plan ? { id: plan.id, code: plan.code, name: plan.name } : null,
    subscriptionStatus: subscription?.status ?? null,
    subscriptionExpiresAt: toIso(subscription?.current_period_end),
    usage,
    companyAdmin,
    createdAt: toIso(company.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(company.updatedAt) ?? undefined,
  };
};

export const serializeSubscription = (args: {
  subscription: Subscription;
  plan: Plan | null;
  companyName: string;
  usage: PlatformUsage;
}) => {
  const { subscription: sub, plan, companyName, usage } = args;
  return {
    id: sub.id,
    companyId: sub.company_id,
    companyName,
    planId: sub.plan_id,
    planName: plan?.name ?? "",
    planCode: plan?.code ?? "",
    status: sub.status,
    billingInterval: sub.billing_interval,
    currentPeriodStart: toIso(sub.current_period_start),
    currentPeriodEnd: toIso(sub.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    autoRenew: sub.auto_renew,
    amount: Number(sub.amount),
    currency: sub.currency,
    paymentProvider: sub.payment_provider ?? null,
    usage,
    limits: {
      maxBranches: plan?.max_branches ?? null,
      maxUsers: plan?.max_users ?? null,
      maxStorageBytes:
        plan?.max_storage_bytes != null ? Number(plan.max_storage_bytes) : null,
    },
    features: normalizeFeatures(plan?.features),
  };
};
