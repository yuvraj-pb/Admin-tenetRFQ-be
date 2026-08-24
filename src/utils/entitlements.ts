import { PlanFeatures } from "../database/models/plan";

export const MODULE_FLAG_KEYS = [
  "rfqCore",
  "approvalWorkflow",
  "quotes",
  "negotiations",
  "rfqDeletionApprovals",
  "supplierPortal",
  "supplierNetwork",
  "orders",
  "dispatch",
  "deliveries",
  "quality",
  "slaDisputes",
  "approvalsHub",
  "users",
  "roles",
  "branches",
  "analytics",
  "advancedAnalytics",
  "analyticsExport",
  "qualityAnalytics",
  "notifications",
  "customIntegrations",
  "prioritySupport",
  "dedicatedSupport",
] as const;

export type ModuleFlagKey = (typeof MODULE_FLAG_KEYS)[number];
export type FeatureKey = ModuleFlagKey;

export const QUOTA_KEYS = [
  "maxUsers",
  "maxBranches",
  "maxStorageBytes",
  "maxRfqsPerMonth",
  "maxSuppliers",
  "maxCustomRoles",
] as const;

export type QuotaKey = (typeof QUOTA_KEYS)[number];

export type ModuleFlags = Record<ModuleFlagKey, boolean>;

export type QuotaLimits = Record<QuotaKey, number | null>;

export type EntitlementMeta = {
  reason?: string;
  expiresAt?: string | null;
  updatedAt?: string;
};

export type OverrideBag = {
  flags: Partial<ModuleFlags>;
  quotas: Partial<QuotaLimits>;
  meta: Record<string, EntitlementMeta>;
};

export const ENTITLEMENT_GROUPS: {
  id: string;
  label: string;
  description: string;
  flags: ModuleFlagKey[];
}[] = [
  {
    id: "procurement",
    label: "Procurement",
    description: "RFQ lifecycle, approvals, quotes and negotiations",
    flags: [
      "rfqCore",
      "approvalWorkflow",
      "quotes",
      "negotiations",
      "rfqDeletionApprovals",
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    description: "Supplier portal and buyer-side supplier network",
    flags: ["supplierNetwork", "supplierPortal"],
  },
  {
    id: "operations",
    label: "Operations",
    description: "Awards, logistics, quality and SLA",
    flags: [
      "orders",
      "dispatch",
      "deliveries",
      "quality",
      "slaDisputes",
      "approvalsHub",
    ],
  },
  {
    id: "people",
    label: "People & org",
    description: "Users, roles and branches",
    flags: ["users", "roles", "branches"],
  },
  {
    id: "insights",
    label: "Analytics",
    description: "Dashboards and exports",
    flags: ["analytics", "advancedAnalytics", "analyticsExport", "qualityAnalytics"],
  },
  {
    id: "platform",
    label: "Platform",
    description: "Notifications and integrations",
    flags: ["notifications", "customIntegrations"],
  },
  {
    id: "commercial",
    label: "Commercial",
    description: "Support SLAs — not product gates",
    flags: ["prioritySupport", "dedicatedSupport"],
  },
];

export const FEATURE_CATALOG: {
  key: ModuleFlagKey;
  label: string;
  description: string;
  requires: ModuleFlagKey[];
  tenantPermissions: string[];
}[] = [
  {
    key: "rfqCore",
    label: "RFQ management",
    description: "Create, edit, publish and close RFQs",
    requires: [],
    tenantPermissions: ["rfq.create", "rfq.view.company", "rfq.publish", "rfq.close"],
  },
  {
    key: "approvalWorkflow",
    label: "Approval workflow",
    description: "Maker–checker–approver RFQ stages",
    requires: ["rfqCore"],
    tenantPermissions: ["rfq.submit.approval", "rfq.approve", "rfq.reject"],
  },
  {
    key: "quotes",
    label: "Quotes",
    description: "View, compare, accept and reject quotes",
    requires: ["rfqCore"],
    tenantPermissions: ["quote.view.rfq", "quote.compare", "quote.accept", "quote.reject"],
  },
  {
    key: "negotiations",
    label: "Negotiations",
    description: "Start and close price negotiations",
    requires: ["quotes"],
    tenantPermissions: ["negotiation.start", "negotiation.participate", "negotiation.close"],
  },
  {
    key: "rfqDeletionApprovals",
    label: "RFQ deletion approvals",
    description: "Queue for approving RFQ deletions",
    requires: ["approvalWorkflow"],
    tenantPermissions: ["rfq.delete.own"],
  },
  {
    key: "supplierNetwork",
    label: "Supplier network",
    description: "Invite and manage suppliers from the buyer side",
    requires: [],
    tenantPermissions: ["supplier.invite", "supplier.management"],
  },
  {
    key: "supplierPortal",
    label: "Supplier portal",
    description: "Suppliers log in, quote and manage dispatches",
    requires: [],
    tenantPermissions: ["quote.submit", "quote.view.own"],
  },
  {
    key: "orders",
    label: "Orders & awards",
    description: "Award RFQs and manage purchase orders",
    requires: ["quotes"],
    tenantPermissions: ["quote.accept"],
  },
  {
    key: "dispatch",
    label: "Dispatch & logistics",
    description: "Truck dispatch flow and tracking",
    requires: ["orders"],
    tenantPermissions: ["delivery.dispatch.flow", "delivery.track.all"],
  },
  {
    key: "deliveries",
    label: "Deliveries & POD",
    description: "Delivery status, documents and receipt",
    requires: ["orders"],
    tenantPermissions: ["delivery.view.own", "delivery.update.status", "delivery.verify.documents"],
  },
  {
    key: "quality",
    label: "Quality / QC",
    description: "Quality templates and reports",
    requires: ["deliveries"],
    tenantPermissions: ["quality.analytics.view"],
  },
  {
    key: "slaDisputes",
    label: "SLA disputes",
    description: "SLA breach tracking and dispute desk",
    requires: ["deliveries"],
    tenantPermissions: [],
  },
  {
    key: "approvalsHub",
    label: "Approvals hub",
    description: "Central inbox for quality and dispatch approvals",
    requires: ["approvalWorkflow"],
    tenantPermissions: ["rfq.approve"],
  },
  {
    key: "users",
    label: "User management",
    description: "Invite, edit and deactivate company users",
    requires: [],
    tenantPermissions: ["user.create", "user.view.company", "user.edit.company", "user.deactivate"],
  },
  {
    key: "roles",
    label: "Roles & permissions",
    description: "Custom roles beyond the seeded templates",
    requires: ["users"],
    tenantPermissions: ["system.manage.roles", "user.assign.roles"],
  },
  {
    key: "branches",
    label: "Multi-branch",
    description: "Create and manage branches",
    requires: [],
    tenantPermissions: ["branch.create", "branch.edit"],
  },
  {
    key: "analytics",
    label: "Basic analytics",
    description: "Core dashboards",
    requires: [],
    tenantPermissions: ["analytics.view.basic"],
  },
  {
    key: "advancedAnalytics",
    label: "Advanced analytics",
    description: "Company-wide and comparison dashboards",
    requires: ["analytics"],
    tenantPermissions: ["analytics.view.advanced", "analytics.company"],
  },
  {
    key: "analyticsExport",
    label: "Analytics export",
    description: "Export reports",
    requires: ["analytics"],
    tenantPermissions: ["analytics.export"],
  },
  {
    key: "qualityAnalytics",
    label: "Quality analytics",
    description: "QC performance dashboards",
    requires: ["analytics", "quality"],
    tenantPermissions: ["quality.analytics.view"],
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "In-app and email notifications",
    requires: [],
    tenantPermissions: ["notification.view.own", "notification.manage.settings"],
  },
  {
    key: "customIntegrations",
    label: "Custom integrations",
    description: "API / ERP connectors",
    requires: [],
    tenantPermissions: ["system.manage.settings"],
  },
  {
    key: "prioritySupport",
    label: "Priority support",
    description: "Faster support SLAs (commercial)",
    requires: [],
    tenantPermissions: [],
  },
  {
    key: "dedicatedSupport",
    label: "Dedicated support",
    description: "Named account manager (commercial)",
    requires: ["prioritySupport"],
    tenantPermissions: [],
  },
];

export const QUOTA_CATALOG: {
  key: QuotaKey;
  label: string;
  description: string;
  step: number;
  unit: "count" | "bytes" | "per_month";
}[] = [
  {
    key: "maxUsers",
    label: "Users",
    description: "Seats that can log in for this company",
    step: 1,
    unit: "count",
  },
  {
    key: "maxBranches",
    label: "Branches",
    description: "Active branch locations",
    step: 1,
    unit: "count",
  },
  {
    key: "maxStorageBytes",
    label: "Storage",
    description: "Upload storage for company files",
    step: 1024 * 1024 * 1024,
    unit: "bytes",
  },
  {
    key: "maxRfqsPerMonth",
    label: "RFQs / month",
    description: "New RFQs that can be created each billing month",
    step: 10,
    unit: "per_month",
  },
  {
    key: "maxSuppliers",
    label: "Suppliers",
    description: "Suppliers in the company network",
    step: 5,
    unit: "count",
  },
  {
    key: "maxCustomRoles",
    label: "Custom roles",
    description: "Roles beyond the seeded templates",
    step: 1,
    unit: "count",
  },
];

export const DEFAULT_FEATURES: ModuleFlags = {
  rfqCore: false,
  approvalWorkflow: false,
  quotes: false,
  negotiations: false,
  rfqDeletionApprovals: false,
  supplierPortal: false,
  supplierNetwork: false,
  orders: false,
  dispatch: false,
  deliveries: false,
  quality: false,
  slaDisputes: false,
  approvalsHub: false,
  users: false,
  roles: false,
  branches: false,
  analytics: false,
  advancedAnalytics: false,
  analyticsExport: false,
  qualityAnalytics: false,
  notifications: false,
  customIntegrations: false,
  prioritySupport: false,
  dedicatedSupport: false,
};

export const EMPTY_QUOTAS: QuotaLimits = {
  maxUsers: null,
  maxBranches: null,
  maxStorageBytes: null,
  maxRfqsPerMonth: null,
  maxSuppliers: null,
  maxCustomRoles: null,
};

/**
 * Statuses that unlock plan modules for the tenant.
 * incomplete / past_due / cancelled / expired stay locked (featuresFromPlan: false).
 * Owner grant sets status=active, so it unlocks here too.
 */
export const FEATURES_FROM_PLAN_STATUSES = new Set(["active", "trialing"]);

/** @deprecated Prefer FEATURES_FROM_PLAN_STATUSES — name kept for call sites. */
export const PAID_SUBSCRIPTION_STATUSES = FEATURES_FROM_PLAN_STATUSES;

export const isPaidSubscriptionStatus = (status?: string | null): boolean =>
  FEATURES_FROM_PLAN_STATUSES.has(status || "");

export const extraQuotasForPlanCode = (code?: string | null): Pick<
  QuotaLimits,
  "maxRfqsPerMonth" | "maxSuppliers" | "maxCustomRoles"
> => {
  if (code === "enterprise") {
    return { maxRfqsPerMonth: null, maxSuppliers: null, maxCustomRoles: null };
  }
  if (code === "professional") {
    return { maxRfqsPerMonth: 100, maxSuppliers: 200, maxCustomRoles: 10 };
  }
  return { maxRfqsPerMonth: 20, maxSuppliers: 25, maxCustomRoles: 3 };
};

export const planQuotaLimits = (plan: {
  code?: string | null;
  max_users?: number | null;
  max_branches?: number | null;
  max_storage_bytes?: number | null | string;
}): QuotaLimits => ({
  maxUsers: plan.max_users ?? null,
  maxBranches: plan.max_branches ?? null,
  maxStorageBytes:
    plan.max_storage_bytes != null ? Number(plan.max_storage_bytes) : null,
  ...extraQuotasForPlanCode(plan.code),
});

export const normalizeFeatures = (
  features?: Partial<PlanFeatures> | Partial<ModuleFlags> | null,
): ModuleFlags => ({
  ...DEFAULT_FEATURES,
  ...(features || {}),
});

const emptyBag = (): OverrideBag => ({ flags: {}, quotas: {}, meta: {} });

export const parseOverrideBag = (raw: unknown): OverrideBag => {
  if (!raw || typeof raw !== "object") return emptyBag();
  const o = raw as Record<string, unknown>;
  if ("flags" in o || "quotas" in o || "meta" in o) {
    return {
      flags: { ...((o.flags as Partial<ModuleFlags>) || {}) },
      quotas: { ...((o.quotas as Partial<QuotaLimits>) || {}) },
      meta: { ...((o.meta as Record<string, EntitlementMeta>) || {}) },
    };
  }
  const flags: Partial<ModuleFlags> = {};
  for (const key of MODULE_FLAG_KEYS) {
    if (typeof o[key] === "boolean") flags[key] = o[key] as boolean;
  }
  return { flags, quotas: {}, meta: {} };
};

const isExpired = (expiresAt?: string | null): boolean => {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= Date.now();
};

export const resolveEffectiveFeatures = (
  planFeatures: Partial<ModuleFlags> | null | undefined,
  rawOverrides: unknown,
  subscriptionStatus: string | null | undefined,
): ModuleFlags => {
  const plan = normalizeFeatures(planFeatures);
  const bag = parseOverrideBag(rawOverrides);
  const base = isPaidSubscriptionStatus(subscriptionStatus)
    ? plan
    : { ...DEFAULT_FEATURES };
  const result = { ...base };
  for (const key of MODULE_FLAG_KEYS) {
    if (typeof bag.flags[key] !== "boolean") continue;
    if (isExpired(bag.meta[key]?.expiresAt)) continue;
    result[key] = bag.flags[key] as boolean;
  }
  return result;
};

export const resolveEffectiveQuotas = (
  planQuotas: QuotaLimits,
  rawOverrides: unknown,
): QuotaLimits => {
  const bag = parseOverrideBag(rawOverrides);
  const result = { ...planQuotas };
  for (const key of QUOTA_KEYS) {
    if (key in bag.quotas) {
      const value = bag.quotas[key];
      if (value === null || typeof value === "number") result[key] = value as number | null;
    }
  }
  return result;
};

export const diffFeatureOverrides = (
  desired: ModuleFlags,
  base: ModuleFlags,
): Partial<ModuleFlags> => {
  const overrides: Partial<ModuleFlags> = {};
  for (const key of MODULE_FLAG_KEYS) {
    if (desired[key] !== base[key]) overrides[key] = desired[key];
  }
  return overrides;
};

export const diffQuotaOverrides = (
  desired: QuotaLimits,
  planQuotas: QuotaLimits,
): Partial<QuotaLimits> => {
  const overrides: Partial<QuotaLimits> = {};
  for (const key of QUOTA_KEYS) {
    const a = desired[key];
    const b = planQuotas[key];
    if (a !== b) overrides[key] = a;
  }
  return overrides;
};

export const applyDependencies = (
  flags: ModuleFlags,
  disabledKey?: ModuleFlagKey,
): ModuleFlags => {
  const next = { ...flags };
  if (disabledKey) {
    const toOff = new Set<ModuleFlagKey>([disabledKey]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const item of FEATURE_CATALOG) {
        if (item.requires.some((r) => toOff.has(r)) && !toOff.has(item.key)) {
          toOff.add(item.key);
          grew = true;
        }
      }
    }
    for (const key of toOff) next[key] = false;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of FEATURE_CATALOG) {
      if (!next[item.key]) continue;
      for (const req of item.requires) {
        if (!next[req]) {
          next[req] = true;
          changed = true;
        }
      }
    }
  }
  return next;
};

/** Keep legacy FEATURE_KEYS alias used by older code. */
export const FEATURE_KEYS = MODULE_FLAG_KEYS;
