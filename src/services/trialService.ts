import Plan from "../database/models/plan";
import Company from "../database/models/company";
import Subscription from "../database/models/subscription";
import { getOrCreateTrialPlan } from "./planService";
import { latestSubscription } from "./subscriptionHelpers";
import { getCompanyUsage } from "./usageService";
import { serializeSubscription } from "../utils/serializers";
import { httpError } from "../utils/httpError";
import { writeAudit } from "./auditService";
import { AUDIT_ACTIONS } from "../utils/auditActions";
import {
  ModuleFlags,
  parseOverrideBag,
} from "../utils/entitlements";

export const expireTrialIfNeeded = async (sub: Subscription | null) => {
  if (!sub) return sub;
  if (
    sub.status === "trialing" &&
    sub.trial_ends_at &&
    new Date(sub.trial_ends_at).getTime() <= Date.now()
  ) {
    await sub.update({ status: "expired" });
  }
  return sub;
};

export const applyPackageOverrides = async (
  sub: Subscription,
  body: {
    features?: Partial<ModuleFlags>;
    maxUsers?: number | null;
    maxBranches?: number | null;
    maxStorageBytes?: number | null;
  },
) => {
  const bag = parseOverrideBag(sub.feature_overrides);
  if (body.features) {
    bag.flags = { ...bag.flags, ...body.features };
  }
  if (
    body.maxUsers !== undefined ||
    body.maxBranches !== undefined ||
    body.maxStorageBytes !== undefined
  ) {
    bag.quotas = {
      ...bag.quotas,
      ...(body.maxUsers !== undefined ? { maxUsers: body.maxUsers } : {}),
      ...(body.maxBranches !== undefined ? { maxBranches: body.maxBranches } : {}),
      ...(body.maxStorageBytes !== undefined
        ? { maxStorageBytes: body.maxStorageBytes }
        : {}),
    };
  }
  await sub.update({ feature_overrides: bag as Record<string, unknown> });
  return sub;
};

export const serializeSub = async (sub: Subscription) => {
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

export const startCompanyTrial = async (
  companyId: number,
  body: any,
  actor?: number,
  ip?: string,
) => {
  const company = await Company.findByPk(companyId);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }

  const trialDays =
    Number(body?.trialDays) > 0 ? Math.round(Number(body.trialDays)) : 30;
  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  const plan = await getOrCreateTrialPlan();
  let sub = await latestSubscription(companyId);
  if (!sub) {
    sub = await Subscription.create({
      company_id: companyId,
      plan_id: plan.id,
      status: "trialing",
      billing_interval: "monthly",
      current_period_start: now,
      current_period_end: trialEndsAt,
      amount: 0,
      currency: plan.currency || "INR",
      payment_provider: "owner",
      trial_ends_at: trialEndsAt,
      trial_days: trialDays,
      auto_renew: false,
    });
  } else {
    await sub.update({
      plan_id: plan.id,
      status: "trialing",
      current_period_start: now,
      current_period_end: trialEndsAt,
      amount: 0,
      trial_ends_at: trialEndsAt,
      trial_days: trialDays,
      auto_renew: false,
      cancel_at_period_end: false,
    });
  }

  const features =
    body?.features ||
    (Array.isArray(body?.requestedFeatures)
      ? Object.fromEntries(body.requestedFeatures.map((k: string) => [k, true]))
      : undefined);

  await applyPackageOverrides(sub, {
    features,
    maxUsers: body?.maxUsers,
    maxBranches: body?.maxBranches,
    maxStorageBytes: body?.maxStorageBytes,
  });
  await sub.reload({ include: [{ model: Plan, as: "plan" }] });

  await writeAudit({
    actorUserId: actor,
    action: AUDIT_ACTIONS.SUBSCRIPTION_TRIAL_STARTED,
    companyId,
    ip,
    reason: body?.notes,
    meta: { trialDays, trainingIncluded: !!body?.trainingIncluded },
  });

  return serializeSub(sub);
};
