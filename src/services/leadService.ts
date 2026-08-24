import { Op } from "sequelize";
import Lead from "../database/models/lead";
import LeadCall from "../database/models/leadCall";
import User from "../database/models/user";
import { serializeLead, serializeLeadCall } from "../utils/serializers";
import { httpError } from "../utils/httpError";
import { writeAudit } from "./auditService";
import { AUDIT_ACTIONS } from "../utils/auditActions";
import { createPlatformCompany, getPlatformCompany } from "./companyService";
import { startCompanyTrial } from "./trialService";
import { getOrCreateTrialPlan } from "./planService";

const LEAD_STATUSES = new Set([
  "new",
  "assigned",
  "contacted",
  "trial",
  "negotiating",
  "won",
  "lost",
]);
const LEAD_SOURCES = new Set([
  "landing",
  "manual",
  "referral",
  "inbound_call",
  "other",
]);
const CALL_OUTCOMES = new Set([
  "connected",
  "no_answer",
  "callback",
  "wrong_number",
  "voicemail",
]);

const asFeatureList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
};

const leadPayload = (body: any, defaults: { source?: string; status?: string }) => {
  if (!body?.companyName || !body?.contactName || !body?.email) {
    throw httpError("companyName, contactName and email are required", 400);
  }
  const source = String(body.source || defaults.source || "manual");
  if (!LEAD_SOURCES.has(source)) throw httpError("Invalid source", 400);
  return {
    company_name: String(body.companyName).trim(),
    contact_name: String(body.contactName).trim(),
    email: String(body.email).trim().toLowerCase(),
    phone: body.phone || null,
    city: body.city || null,
    state: body.state || null,
    notes: body.notes || null,
    requested_features: asFeatureList(body.requestedFeatures),
    requested_users:
      body.requestedUsers != null ? Number(body.requestedUsers) : null,
    requested_branches:
      body.requestedBranches != null ? Number(body.requestedBranches) : null,
    source,
    status: defaults.status || "new",
  };
};

export const listLeads = async (query: Record<string, any>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const where: any = {};
  if (query.status && query.status !== "all") where.status = String(query.status);
  if (query.assignedToId) where.assigned_to_id = Number(query.assignedToId);
  if (query.search?.trim()) {
    const term = `%${String(query.search).trim()}%`;
    where[Op.or] = [
      { company_name: { [Op.iLike]: term } },
      { contact_name: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
    ];
  }
  const { rows, count } = await Lead.findAndCountAll({
    where,
    order: [["id", "DESC"]],
    limit,
    offset,
  });
  return { data: rows.map(serializeLead), page, limit, total: count };
};

export const getLeadById = async (id: number) => {
  const lead = await Lead.findByPk(id);
  if (!lead) throw httpError("Lead not found", 404);
  return serializeLead(lead);
};

export const createLead = async (
  body: any,
  ctx?: { actorUserId?: number; ip?: string; source?: string },
) => {
  const lead = await Lead.create(
    leadPayload(body, { source: ctx?.source || body.source || "manual" }) as any,
  );
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.LEAD_CREATED,
    companyId: null,
    ip: ctx?.ip,
    meta: { leadId: lead.id, source: lead.source },
  });
  return serializeLead(lead);
};

export const updateLead = async (
  id: number,
  body: any,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const lead = await Lead.findByPk(id);
  if (!lead) throw httpError("Lead not found", 404);
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!LEAD_STATUSES.has(String(body.status))) {
      throw httpError("Invalid status", 400);
    }
    updates.status = String(body.status);
  }
  if (body.assignedToId !== undefined) updates.assigned_to_id = body.assignedToId;
  if (body.assignedToName !== undefined) {
    updates.assigned_to_name = body.assignedToName || null;
  }
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.requestedFeatures !== undefined) {
    updates.requested_features = asFeatureList(body.requestedFeatures);
  }
  if (body.requestedUsers !== undefined) updates.requested_users = body.requestedUsers;
  if (body.requestedBranches !== undefined) {
    updates.requested_branches = body.requestedBranches;
  }
  if (body.nextFollowUpAt !== undefined) {
    updates.next_follow_up_at = body.nextFollowUpAt
      ? new Date(body.nextFollowUpAt)
      : null;
  }
  await lead.update(updates);
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.LEAD_UPDATED,
    companyId: lead.company_id,
    ip: ctx?.ip,
    meta: updates,
  });
  return serializeLead(lead);
};

export const assignLead = async (
  id: number,
  body: { assignedToId?: number | null; assignedToName?: string | null },
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const lead = await Lead.findByPk(id);
  if (!lead) throw httpError("Lead not found", 404);
  let name = body.assignedToName || null;
  let assignedToId = body.assignedToId ?? ctx?.actorUserId ?? null;
  if (assignedToId && !name) {
    const user = await User.findByPk(assignedToId, { attributes: ["id", "name"] });
    name = user?.name || null;
  }
  const nextStatus = ["won", "lost", "trial", "negotiating"].includes(
    lead.status,
  )
    ? lead.status
    : "assigned";
  await lead.update({
    assigned_to_id: assignedToId,
    assigned_to_name: name,
    status: nextStatus,
  });
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.LEAD_ASSIGNED,
    companyId: lead.company_id,
    ip: ctx?.ip,
    meta: { assignedToId, assignedToName: name },
  });
  return serializeLead(lead);
};

export const listLeadCalls = async (leadId: number) => {
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw httpError("Lead not found", 404);
  const rows = await LeadCall.findAll({
    where: { lead_id: leadId },
    order: [["id", "DESC"]],
  });
  return rows.map(serializeLeadCall);
};

export const logLeadCall = async (
  leadId: number,
  body: { outcome: string; notes?: string; nextFollowUpAt?: string | null },
  ctx?: { actorUserId?: number; ip?: string; actorName?: string },
) => {
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw httpError("Lead not found", 404);
  if (!CALL_OUTCOMES.has(String(body.outcome))) {
    throw httpError("Invalid call outcome", 400);
  }
  const nextFollowUp = body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null;
  const call = await LeadCall.create({
    lead_id: leadId,
    company_id: lead.company_id ?? null,
    outcome: String(body.outcome),
    notes: body.notes || null,
    next_follow_up_at: nextFollowUp,
    created_by_id: ctx?.actorUserId ?? null,
    created_by_name: ctx?.actorName || null,
  });
  const nextStatus =
    lead.status === "new" || lead.status === "assigned" ? "contacted" : lead.status;
  await lead.update({
    last_contacted_at: new Date(),
    next_follow_up_at: nextFollowUp,
    status: nextStatus,
  });
  return serializeLeadCall(call);
};

export const startLeadTrial = async (
  id: number,
  body: any,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const lead = await Lead.findByPk(id);
  if (!lead) throw httpError("Lead not found", 404);
  if (lead.status === "lost") throw httpError("Cannot start a trial on a lost lead", 422);

  let companyId = lead.company_id || null;
  if (!companyId) {
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
        billingInterval: "monthly",
        collectPayment: false,
        companyAdmin: {
          name: lead.contact_name,
          email: lead.email,
          mobile: lead.phone,
        },
      },
      { actorUserId: ctx?.actorUserId, ip: ctx?.ip },
    );
    companyId = created.id;
  }

  const features =
    body?.features ||
    (lead.requested_features?.length
      ? Object.fromEntries(lead.requested_features.map((k) => [k, true]))
      : undefined);

  const subscription = await startCompanyTrial(
    companyId,
    {
      trialDays: body?.trialDays,
      trainingIncluded: body?.trainingIncluded,
      notes: body?.notes,
      features,
      maxUsers: body?.maxUsers ?? lead.requested_users ?? 5,
      maxBranches: body?.maxBranches ?? lead.requested_branches ?? 1,
      maxStorageBytes: body?.maxStorageBytes,
    },
    ctx?.actorUserId,
    ctx?.ip,
  );

  const trialEndsAt = subscription.trialEndsAt
    ? new Date(subscription.trialEndsAt)
    : null;
  await lead.update({
    status: "trial",
    company_id: companyId,
    trial_ends_at: trialEndsAt,
  });

  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.LEAD_TRIAL_STARTED,
    companyId,
    ip: ctx?.ip,
    meta: { leadId: lead.id, trialDays: subscription.trialDays },
  });

  const company = await getPlatformCompany(companyId);
  return { ...serializeLead(lead), company, subscription };
};

export const convertLead = async (
  id: number,
  body: any,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const lead = await Lead.findByPk(id);
  if (!lead) throw httpError("Lead not found", 404);

  if (body?.quoteId) {
    const { acceptQuoteById } = await import("./quoteService");
    await acceptQuoteById(
      Number(body.quoteId),
      {
        collectPayment: body.collectPayment,
        paymentProvider: body.paymentProvider,
        grantWithoutPayment: body.grantWithoutPayment,
      },
      ctx,
    );
  } else if (lead.company_id && body?.planId && body?.grantWithoutPayment) {
    const { grantCompanySubscription } = await import("./subscriptionService");
    await grantCompanySubscription(
      lead.company_id,
      {
        planId: body.planId,
        billingInterval: body.billingInterval || "monthly",
        reason: body.reason,
      },
      ctx?.actorUserId,
      ctx?.ip,
    );
  } else if (!lead.company_id && body?.planId) {
    const created = await createPlatformCompany(
      {
        companyName: lead.company_name,
        email: lead.email,
        phone: lead.phone,
        city: lead.city,
        state: lead.state,
        planId: body.planId,
        billingInterval: body.billingInterval || "monthly",
        collectPayment: !!body.collectPayment,
        paymentProvider: body.paymentProvider,
        grantWithoutPayment: body.grantWithoutPayment,
        companyAdmin: {
          name: lead.contact_name,
          email: lead.email,
          mobile: lead.phone,
        },
      },
      { actorUserId: ctx?.actorUserId, ip: ctx?.ip },
    );
    await lead.update({ company_id: created.id });
  }

  await lead.reload();
  await lead.update({ status: "won" });
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.LEAD_CONVERTED,
    companyId: lead.company_id,
    ip: ctx?.ip,
    reason: body?.reason,
    meta: { leadId: lead.id, quoteId: body?.quoteId, planId: body?.planId },
  });

  const company = lead.company_id
    ? await getPlatformCompany(lead.company_id)
    : null;
  return { ...serializeLead(lead), company };
};
