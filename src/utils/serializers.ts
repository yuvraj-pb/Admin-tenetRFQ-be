import Company from "../database/models/company";
import Plan, { PlanFeatures } from "../database/models/plan";
import Subscription from "../database/models/subscription";
import PlatformPayment from "../database/models/platformPayment";
import {
  DEFAULT_FEATURES,
  FEATURE_CATALOG,
  ENTITLEMENT_GROUPS,
  QUOTA_CATALOG,
  isPaidSubscriptionStatus,
  normalizeFeatures,
  parseOverrideBag,
  planQuotaLimits,
  resolveEffectiveFeatures,
  resolveEffectiveQuotas,
} from "./entitlements";
import { computeTenantHealth } from "./tenantHealth";

export { DEFAULT_FEATURES, FEATURE_CATALOG, ENTITLEMENT_GROUPS, QUOTA_CATALOG };
export type { PlanFeatures };

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

const toIso = (value?: Date | string | null): string | null => {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

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
  kind: (plan.kind || "catalog") as "catalog" | "custom" | "trial",
  negotiable: plan.negotiable !== false,
  trialDays: plan.trial_days ?? null,
  companyId: plan.company_id ?? null,
});

export const serializeCompany = (args: {
  company: Company;
  usage: PlatformUsage;
  companyAdmin: CompanyAdminShape | null;
  subscription: (Subscription & { plan?: Plan }) | null;
  lastActiveAt?: Date | string | null;
  includePrivate?: boolean;
}) => {
  const { company, usage, companyAdmin, subscription, includePrivate } = args;
  const plan = subscription?.plan ?? null;
  const lastActive =
    args.lastActiveAt || company.last_active_at || null;
  const health = computeTenantHealth({
    status: company.status,
    subscriptionStatus: subscription?.status,
    subscriptionExpiresAt: subscription?.current_period_end,
    usage,
    limits: {
      maxUsers: plan?.max_users ?? null,
      maxBranches: plan?.max_branches ?? null,
      maxStorageBytes:
        plan?.max_storage_bytes != null ? Number(plan.max_storage_bytes) : null,
    },
  });
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
    pinCode: company.pinCode ?? undefined,
    country: company.country ?? "IN",
    slug: company.slug ?? undefined,
    region: company.region || "ap-south-1",
    timezone: company.timezone || "Asia/Kolkata",
    status: (company.status || "active") as
      | "active"
      | "suspended"
      | "archived"
      | "deleted",
    tags: Array.isArray(company.tags) ? company.tags : [],
    plan: plan ? { id: plan.id, code: plan.code, name: plan.name } : null,
    subscriptionStatus: subscription?.status ?? null,
    subscriptionExpiresAt: toIso(subscription?.current_period_end),
    usage,
    lastActiveAt: toIso(lastActive),
    health: health.health,
    healthReasons: health.healthReasons,
    companyAdmin,
    createdAt: toIso(company.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(company.updatedAt) ?? undefined,
    ...(includePrivate
      ? { internalNotes: company.internal_notes ?? "" }
      : {}),
  };
};

export const serializeSubscription = (args: {
  subscription: Subscription;
  plan: Plan | null;
  companyName: string;
  usage: PlatformUsage;
}) => {
  const { subscription: sub, plan, companyName, usage } = args;
  const planFeatures = normalizeFeatures(plan?.features);
  const bag = parseOverrideBag(sub.feature_overrides);
  const features = resolveEffectiveFeatures(
    planFeatures,
    sub.feature_overrides,
    sub.status,
  );
  const planQuotas = planQuotaLimits({
    code: plan?.code,
    max_users: plan?.max_users,
    max_branches: plan?.max_branches,
    max_storage_bytes: plan?.max_storage_bytes,
  });
  const quotas = resolveEffectiveQuotas(planQuotas, sub.feature_overrides);
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
      maxBranches: quotas.maxBranches,
      maxUsers: quotas.maxUsers,
      maxStorageBytes: quotas.maxStorageBytes,
    },
    trialEndsAt: toIso(sub.trial_ends_at),
    trialDays: sub.trial_days ?? null,
    isCustom: (plan?.kind || "") === "custom",
    quoteId: sub.quote_id ?? null,
    planFeatures,
    featureOverrides: bag.flags,
    features,
    featuresFromPlan: isPaidSubscriptionStatus(sub.status),
    entitlements: {
      flags: features,
      planFlags: planFeatures,
      flagOverrides: bag.flags,
      quotas,
      planQuotas,
      quotaOverrides: bag.quotas,
      meta: bag.meta,
    },
  };
};

export const serializePayment = (payment: PlatformPayment) => ({
  id: payment.id,
  companyId: payment.company_id,
  subscriptionId: payment.subscription_id ?? null,
  provider: payment.provider,
  providerOrderId: payment.provider_order_id ?? null,
  providerPaymentId: payment.provider_payment_id ?? null,
  amount: Number(payment.amount),
  currency: payment.currency,
  status: payment.status,
  purpose: payment.purpose ?? null,
  createdAt: toIso(payment.createdAt) ?? new Date().toISOString(),
});

export const serializeLead = (lead: {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  requested_features?: string[] | null;
  requested_users?: number | null;
  requested_branches?: number | null;
  source: string;
  status: string;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  company_id?: number | null;
  trial_ends_at?: Date | string | null;
  last_contacted_at?: Date | string | null;
  next_follow_up_at?: Date | string | null;
  createdAt: Date;
  updatedAt?: Date;
}) => ({
  id: lead.id,
  companyName: lead.company_name,
  contactName: lead.contact_name,
  email: lead.email,
  phone: lead.phone ?? null,
  city: lead.city ?? null,
  state: lead.state ?? null,
  notes: lead.notes ?? null,
  requestedFeatures: Array.isArray(lead.requested_features)
    ? lead.requested_features
    : [],
  requestedUsers: lead.requested_users ?? null,
  requestedBranches: lead.requested_branches ?? null,
  source: lead.source,
  status: lead.status,
  assignedToId: lead.assigned_to_id ?? null,
  assignedToName: lead.assigned_to_name ?? null,
  companyId: lead.company_id ?? null,
  trialEndsAt: toIso(lead.trial_ends_at),
  lastContactedAt: toIso(lead.last_contacted_at),
  nextFollowUpAt: toIso(lead.next_follow_up_at),
  createdAt: toIso(lead.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(lead.updatedAt),
});

export const serializeLeadCall = (row: {
  id: number;
  lead_id: number;
  company_id?: number | null;
  outcome: string;
  notes?: string | null;
  next_follow_up_at?: Date | string | null;
  created_by_name?: string | null;
  createdAt: Date;
}) => ({
  id: row.id,
  leadId: row.lead_id,
  companyId: row.company_id ?? null,
  outcome: row.outcome,
  notes: row.notes ?? null,
  nextFollowUpAt: toIso(row.next_follow_up_at),
  createdByName: row.created_by_name ?? null,
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
});

export const serializeQuote = (
  quote: {
    id: number;
    lead_id?: number | null;
    company_id?: number | null;
    name: string;
    status: string;
    billing_interval: string;
    amount: number;
    currency: string;
    features?: PlanFeatures | null;
    max_users?: number | null;
    max_branches?: number | null;
    max_storage_bytes?: number | null;
    notes?: string | null;
    valid_until?: Date | string | null;
    createdAt: Date;
    updatedAt?: Date;
  },
  companyName?: string | null,
) => ({
  id: quote.id,
  leadId: quote.lead_id ?? null,
  companyId: quote.company_id ?? null,
  companyName: companyName || "",
  name: quote.name,
  status: quote.status,
  billingInterval: quote.billing_interval,
  amount: Number(quote.amount),
  currency: quote.currency,
  features: normalizeFeatures(quote.features),
  maxUsers: quote.max_users ?? null,
  maxBranches: quote.max_branches ?? null,
  maxStorageBytes:
    quote.max_storage_bytes != null ? Number(quote.max_storage_bytes) : null,
  notes: quote.notes ?? null,
  validUntil: toIso(quote.valid_until),
  createdAt: toIso(quote.createdAt) ?? new Date().toISOString(),
  updatedAt: toIso(quote.updatedAt),
});

