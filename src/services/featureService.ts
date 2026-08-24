import Plan from "../database/models/plan";
import { latestSubscription } from "./subscriptionHelpers";
import { writeAudit } from "./auditService";
import { serializeSubscription } from "../utils/serializers";
import { httpError } from "../utils/httpError";
import { AUDIT_ACTIONS } from "../utils/auditActions";
import {
  DEFAULT_FEATURES,
  ModuleFlags,
  QuotaLimits,
  applyDependencies,
  diffFeatureOverrides,
  diffQuotaOverrides,
  isPaidSubscriptionStatus,
  normalizeFeatures,
  parseOverrideBag,
  planQuotaLimits,
} from "../utils/entitlements";
import Company from "../database/models/company";
import { getCompanyUsage } from "./usageService";

const serialize = async (sub: NonNullable<Awaited<ReturnType<typeof latestSubscription>>>) => {
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

export const updateCompanyFeatures = async (
  companyId: number,
  body: {
    features?: Partial<ModuleFlags>;
    flags?: Partial<ModuleFlags>;
    quotas?: Partial<QuotaLimits>;
    resetToPlan?: boolean;
    reason?: string;
    expiresAt?: string | null;
    targetKey?: string;
  },
  actor?: number,
  ip?: string,
) => {
  const sub = await latestSubscription(companyId);
  if (!sub) {
    throw httpError("Assign a plan before toggling features", 400);
  }
  const plan = sub.plan ?? (await Plan.findByPk(sub.plan_id));
  const planFeatures = normalizeFeatures(plan?.features);
  const planQuotas = planQuotaLimits({
    code: plan?.code,
    max_users: plan?.max_users,
    max_branches: plan?.max_branches,
    max_storage_bytes: plan?.max_storage_bytes,
  });
  const baseFlags = isPaidSubscriptionStatus(sub.status)
    ? planFeatures
    : { ...DEFAULT_FEATURES };
  const bag = parseOverrideBag(sub.feature_overrides);

  if (body.resetToPlan) {
    await sub.update({
      feature_overrides: { flags: {}, quotas: {}, meta: {} } as Record<string, unknown>,
    });
    await sub.reload({ include: [{ model: Plan, as: "plan" }] });
    await writeAudit({
      actorUserId: actor,
      action: AUDIT_ACTIONS.ENTITLEMENTS_UPDATED,
      companyId,
      ip,
      reason: body.reason,
      meta: { planId: sub.plan_id, resetToPlan: true },
    });
    return serialize(sub);
  }

  const incomingFlags = body.flags || body.features;
  if (incomingFlags) {
    const merged = normalizeFeatures({
      ...baseFlags,
      ...(bag.flags || {}),
      ...(incomingFlags || {}),
    });
    const disabledKey =
      body.targetKey && incomingFlags[body.targetKey as keyof ModuleFlags] === false
        ? (body.targetKey as import("../utils/entitlements").ModuleFlagKey)
        : undefined;
    const desired = applyDependencies(merged, disabledKey);
    bag.flags = diffFeatureOverrides(desired, baseFlags);
  }

  if (body.quotas) {
    const desiredQuotas: QuotaLimits = { ...planQuotas, ...bag.quotas, ...body.quotas };
    bag.quotas = diffQuotaOverrides(desiredQuotas, planQuotas);
  }

  if (body.targetKey) {
    const meta = { ...(bag.meta[body.targetKey] || {}) };
    if (body.reason != null) meta.reason = String(body.reason).trim() || undefined;
    meta.expiresAt = body.expiresAt || null;
    meta.updatedAt = new Date().toISOString();
    if (!meta.reason && !meta.expiresAt) delete bag.meta[body.targetKey];
    else bag.meta[body.targetKey] = meta;
  }

  await sub.update({ feature_overrides: bag as Record<string, unknown> });
  await sub.reload({ include: [{ model: Plan, as: "plan" }] });
  await writeAudit({
    actorUserId: actor,
    action: AUDIT_ACTIONS.ENTITLEMENTS_UPDATED,
    companyId,
    ip,
    reason: body.reason,
    meta: {
      flags: bag.flags,
      quotas: bag.quotas,
      targetKey: body.targetKey,
      reason: body.reason,
    },
  });
  return serialize(sub);
};
