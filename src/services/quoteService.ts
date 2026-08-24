import PlatformQuote from "../database/models/platformQuote";
import Lead from "../database/models/lead";
import Company from "../database/models/company";
import Plan from "../database/models/plan";
import Subscription from "../database/models/subscription";
import { serializeQuote } from "../utils/serializers";
import { httpError } from "../utils/httpError";
import { writeAudit } from "./auditService";
import { AUDIT_ACTIONS } from "../utils/auditActions";
import { normalizeFeatures } from "../utils/entitlements";
import { upsertCustomPlan, getOrCreateTrialPlan } from "./planService";
import { createPlatformCompany } from "./companyService";
import { grantCompanySubscription } from "./subscriptionService";
import { serializeSub } from "./trialService";
import {
  amountForPlan,
  latestSubscription,
  normalizeInterval,
  normalizeProvider,
  periodEndFromNow,
} from "./subscriptionHelpers";
import { buildCheckoutSession } from "./billing/billingService";

const QUOTE_STATUSES = new Set(["draft", "sent", "accepted", "rejected"]);
const EDITABLE = new Set(["draft", "sent"]);

const quoteCompanyName = async (quote: PlatformQuote): Promise<string> => {
  if (quote.company_id) {
    const company = await Company.findByPk(quote.company_id, {
      attributes: ["id", "companyName"],
    });
    if (company?.companyName) return company.companyName;
  }
  if (quote.lead_id) {
    const lead = await Lead.findByPk(quote.lead_id, {
      attributes: ["id", "company_name"],
    });
    if (lead?.company_name) return lead.company_name;
  }
  return "";
};

const hydrate = async (quote: PlatformQuote) =>
  serializeQuote(quote, await quoteCompanyName(quote));

const fieldsFromBody = (body: any, existing?: PlatformQuote) => {
  const billingInterval = normalizeInterval(
    body.billingInterval ?? existing?.billing_interval ?? "monthly",
  );
  return {
    lead_id:
      body.leadId !== undefined
        ? body.leadId
          ? Number(body.leadId)
          : null
        : existing?.lead_id ?? null,
    company_id:
      body.companyId !== undefined
        ? body.companyId
          ? Number(body.companyId)
          : null
        : existing?.company_id ?? null,
    name: String(body.name ?? existing?.name ?? "").trim(),
    billing_interval: billingInterval,
    amount: Number(body.amount ?? existing?.amount ?? 0),
    currency: body.currency || existing?.currency || "INR",
    features: normalizeFeatures(body.features ?? existing?.features),
    max_users:
      body.maxUsers !== undefined ? body.maxUsers : existing?.max_users ?? null,
    max_branches:
      body.maxBranches !== undefined
        ? body.maxBranches
        : existing?.max_branches ?? null,
    max_storage_bytes:
      body.maxStorageBytes !== undefined
        ? body.maxStorageBytes
        : existing?.max_storage_bytes ?? null,
    notes: body.notes !== undefined ? body.notes : existing?.notes ?? null,
    valid_until:
      body.validUntil !== undefined
        ? body.validUntil
          ? new Date(body.validUntil)
          : null
        : existing?.valid_until ?? null,
  };
};

const markLeadNegotiating = async (leadId?: number | null) => {
  if (!leadId) return;
  const lead = await Lead.findByPk(leadId);
  if (!lead) return;
  if (["won", "lost"].includes(lead.status)) return;
  await lead.update({
    status: "negotiating",
    company_id: lead.company_id,
  });
};

export const listQuotes = async (query: Record<string, any>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const where: any = {};
  if (query.status && query.status !== "all") {
    if (!QUOTE_STATUSES.has(String(query.status))) {
      throw httpError("Invalid quote status", 400);
    }
    where.status = String(query.status);
  }
  if (query.leadId) where.lead_id = Number(query.leadId);
  if (query.companyId) where.company_id = Number(query.companyId);

  const { rows, count } = await PlatformQuote.findAndCountAll({
    where,
    order: [["id", "DESC"]],
    limit,
    offset,
  });
  const data = await Promise.all(rows.map(hydrate));
  return { data, page, limit, total: count };
};

export const getQuoteById = async (id: number) => {
  const quote = await PlatformQuote.findByPk(id);
  if (!quote) throw httpError("Quote not found", 404);
  return hydrate(quote);
};

export const createQuote = async (
  body: any,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const fields = fieldsFromBody(body);
  if (!fields.lead_id && !fields.company_id) {
    throw httpError("leadId or companyId is required", 400);
  }

  if (fields.lead_id) {
    const lead = await Lead.findByPk(fields.lead_id);
    if (!lead) throw httpError("Lead not found", 404);
    if (!fields.company_id && lead.company_id) {
      fields.company_id = lead.company_id;
    }
    if (!fields.name) fields.name = `Custom — ${lead.company_name}`;
  }
  if (fields.company_id) {
    const company = await Company.findByPk(fields.company_id);
    if (!company || company.status === "deleted") {
      throw httpError("Company not found", 404);
    }
    if (!fields.name) fields.name = `Custom — ${company.companyName}`;
  }
  if (!fields.name) throw httpError("name is required", 400);

  const quote = await PlatformQuote.create({
    ...fields,
    status: "draft",
  } as any);

  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.QUOTE_CREATED,
    companyId: quote.company_id,
    ip: ctx?.ip,
    meta: { quoteId: quote.id, leadId: quote.lead_id },
  });

  return hydrate(quote);
};

export const updateQuote = async (
  id: number,
  body: any,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const quote = await PlatformQuote.findByPk(id);
  if (!quote) throw httpError("Quote not found", 404);
  if (!EDITABLE.has(quote.status)) {
    throw httpError("Only draft or sent quotes can be edited", 422);
  }
  const fields = fieldsFromBody(body, quote);
  if (!fields.name) throw httpError("name is required", 400);
  await quote.update(fields);
  void ctx;
  return hydrate(quote);
};

export const sendQuote = async (
  id: number,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const quote = await PlatformQuote.findByPk(id);
  if (!quote) throw httpError("Quote not found", 404);
  if (quote.status !== "draft") {
    throw httpError("Only draft quotes can be sent", 422);
  }
  await quote.update({ status: "sent" });
  await markLeadNegotiating(quote.lead_id);
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.QUOTE_SENT,
    companyId: quote.company_id,
    ip: ctx?.ip,
    meta: { quoteId: quote.id },
  });
  return hydrate(quote);
};

export const rejectQuote = async (
  id: number,
  body?: { reason?: string },
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const quote = await PlatformQuote.findByPk(id);
  if (!quote) throw httpError("Quote not found", 404);
  if (!EDITABLE.has(quote.status)) {
    throw httpError("This quote can no longer be rejected", 422);
  }
  await quote.update({ status: "rejected" });
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.QUOTE_REJECTED,
    companyId: quote.company_id,
    ip: ctx?.ip,
    reason: body?.reason,
    meta: { quoteId: quote.id },
  });
  return hydrate(quote);
};

const shouldGrantWithoutCheckout = (body: any) => {
  if (body?.grantWithoutPayment === true) return true;
  if (String(body?.paymentProvider || "") === "owner") return true;
  if (body?.collectPayment === true) return false;
  return true;
};

const ensureQuoteCompany = async (
  quote: PlatformQuote,
  ctx?: { actorUserId?: number; ip?: string },
): Promise<number> => {
  if (quote.company_id) return quote.company_id;
  if (!quote.lead_id) {
    throw httpError("Quote has no company or lead to convert", 422);
  }
  const lead = await Lead.findByPk(quote.lead_id);
  if (!lead) throw httpError("Lead not found", 404);
  if (lead.company_id) {
    await quote.update({ company_id: lead.company_id });
    return lead.company_id;
  }

  const trialPlan = await getOrCreateTrialPlan();
  const created = await createPlatformCompany(
    {
      companyName: lead.company_name,
      legalName: lead.company_name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      state: lead.state,
      planId: trialPlan.id,
      billingInterval: quote.billing_interval || "monthly",
      collectPayment: false,
      companyAdmin: {
        name: lead.contact_name,
        email: lead.email,
        mobile: lead.phone,
      },
    },
    { actorUserId: ctx?.actorUserId, ip: ctx?.ip },
  );
  await lead.update({ company_id: created.id });
  await quote.update({ company_id: created.id });
  return created.id;
};

export const acceptQuoteById = async (
  id: number,
  body: any = {},
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const quote = await PlatformQuote.findByPk(id);
  if (!quote) throw httpError("Quote not found", 404);
  if (quote.status === "rejected") {
    throw httpError("Rejected quotes cannot be accepted", 422);
  }
  if (quote.status === "accepted" && quote.company_id) {
    const sub = await latestSubscription(quote.company_id);
    return {
      ...(await hydrate(quote)),
      subscription: sub ? await serializeSub(sub) : null,
    };
  }

  const companyId = await ensureQuoteCompany(quote, ctx);
  const company = await Company.findByPk(companyId);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }

  const billingInterval = normalizeInterval(
    body.billingInterval || quote.billing_interval,
  );
  const plan = await upsertCustomPlan({
    companyId,
    name: quote.name,
    amount: Number(quote.amount),
    billingInterval,
    currency: quote.currency,
    features: quote.features,
    maxUsers: quote.max_users ?? null,
    maxBranches: quote.max_branches ?? null,
    maxStorageBytes:
      quote.max_storage_bytes != null ? Number(quote.max_storage_bytes) : null,
  });

  let subscriptionPayload: unknown;
  let checkout: unknown;

  if (shouldGrantWithoutCheckout(body)) {
    const granted = await grantCompanySubscription(
      companyId,
      {
        planId: plan.id,
        billingInterval,
        reason: body.reason || `Accepted quote #${quote.id}`,
      },
      ctx?.actorUserId,
      ctx?.ip,
    );
    const sub = await latestSubscription(companyId);
    if (sub) {
      await sub.update({
        quote_id: quote.id,
        feature_overrides: {},
        trial_ends_at: null,
        trial_days: null,
      });
      await sub.reload({ include: [{ model: Plan, as: "plan" }] });
      subscriptionPayload = await serializeSub(sub);
    } else {
      subscriptionPayload = granted;
    }
  } else {
    let sub = await latestSubscription(companyId);
    const now = new Date();
    if (!sub) {
      sub = await Subscription.create({
        company_id: companyId,
        plan_id: plan.id,
        status: "incomplete",
        billing_interval: billingInterval,
        current_period_start: now,
        current_period_end: periodEndFromNow(billingInterval, now),
        amount: amountForPlan(plan, billingInterval),
        currency: plan.currency || quote.currency || "INR",
        payment_provider: normalizeProvider(body.paymentProvider),
        quote_id: quote.id,
        feature_overrides: {},
        auto_renew: true,
      });
    } else {
      await sub.update({
        plan_id: plan.id,
        status: "incomplete",
        billing_interval: billingInterval,
        amount: amountForPlan(plan, billingInterval),
        currency: plan.currency || quote.currency || "INR",
        payment_provider: normalizeProvider(body.paymentProvider),
        quote_id: quote.id,
        feature_overrides: {},
        cancel_at_period_end: false,
      });
    }
    checkout = await buildCheckoutSession({
      company,
      plan,
      subscription: sub,
      billingInterval,
      paymentProvider: normalizeProvider(body.paymentProvider),
      purpose: "new",
    });
    subscriptionPayload = await serializeSub(sub);
  }

  if (quote.status !== "accepted") {
    await quote.update({ status: "accepted", company_id: companyId });
  }

  if (quote.lead_id) {
    const lead = await Lead.findByPk(quote.lead_id);
    if (lead) {
      await lead.update({ status: "won", company_id: companyId });
    }
  }

  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.QUOTE_ACCEPTED,
    companyId,
    ip: ctx?.ip,
    reason: body.reason,
    meta: {
      quoteId: quote.id,
      planId: plan.id,
      granted: shouldGrantWithoutCheckout(body),
    },
  });

  return {
    ...(await hydrate(quote)),
    subscription: subscriptionPayload,
    ...(checkout ? { checkout } : {}),
  };
};
