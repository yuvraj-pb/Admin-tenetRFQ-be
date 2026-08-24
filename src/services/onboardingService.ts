import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op, UniqueConstraintError } from "sequelize";
import sequelize from "../database/models";
import OnboardingRequest, {
  OnboardingAllocation,
} from "../database/models/onboardingRequest";
import OnboardingNote from "../database/models/onboardingNote";
import SetupToken from "../database/models/setupToken";
import SolutionTemplate from "../database/models/solutionTemplate";
import Company from "../database/models/company";
import Plan from "../database/models/plan";
import Subscription from "../database/models/subscription";
import User from "../database/models/user";
import Role, { USER_ROLES, roleToSlug } from "../database/models/role";
import PlatformAuditLog from "../database/models/platformAuditLog";
import { httpError } from "../utils/httpError";
import { writeAudit } from "./auditService";
import { AUDIT_ACTIONS } from "../utils/auditActions";
import {
  consumeMobileOtpVerified,
  isMobileOtpVerified,
} from "./otpService";
import {
  notifyOnboardingReceived,
  notifyOnboardingRejected,
  notifySetupReady,
} from "./notificationService";
import { getTemplateById } from "./templateService";
import { createUserForCompany, findUserByEmailOrMobile } from "./userRepository";
import { allocateUniqueSlug } from "../utils/slug";
import { generateSecurePassword } from "../utils/commonFunctions";
import {
  amountForPlan,
  normalizeInterval,
  periodEndFromNow,
} from "./subscriptionHelpers";
import {
  GSTIN,
  MARKETING_PLANS,
  MarketingPlan,
  PINCODE,
  flagsFromModules,
  marketingToCatalog,
  normalizeIndianMobile,
  panFromGstin,
  setupUrlForToken,
  TEMPLATE_IDS,
  whatsappSetupMessage,
} from "../utils/onboardingMaps";
import { MODULE_FLAG_KEYS } from "../utils/entitlements";

const toIso = (value?: Date | string | null) => {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const hashToken = (raw: string) =>
  crypto.createHash("sha256").update(raw).digest("hex");

const nextRefNo = async (transaction?: any) => {
  const [rows] = await sequelize.query(
    `SELECT nextval('onboarding_ref_seq') AS next`,
    { transaction },
  );
  const next = Number((rows as any[])[0]?.next || 1);
  return `RFQ-ONB-${String(next).padStart(5, "0")}`;
};

const issueSetupToken = async (opts: {
  userId: number;
  requestId: number;
  transaction?: any;
}) => {
  const raw = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await SetupToken.create(
    {
      user_id: opts.userId,
      token_hash: hashToken(raw),
      expires_at: expires,
      request_id: opts.requestId,
    },
    { transaction: opts.transaction },
  );
  return raw;
};

const listItem = (row: OnboardingRequest, templateName?: string | null) => ({
  id: row.id,
  refNo: row.ref_no,
  businessName: row.business_name,
  businessType: row.business_type,
  templateId: row.template_id,
  templateName: templateName || row.template_id,
  requestedPlan: row.requested_plan,
  billingCycle: row.billing_cycle,
  state: row.state,
  district: row.district,
  contactName: row.contact_name,
  mobile: row.mobile,
  email: row.email,
  status: row.status,
  createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  companyId: row.company_id ?? null,
});

const requireRequest = async (id: number) => {
  const row = await OnboardingRequest.findByPk(id);
  if (!row) throw httpError("Onboarding request not found", 404);
  return row;
};

const parseAllocation = (body: any): OnboardingAllocation => {
  const src = body?.allocation && typeof body.allocation === "object"
    ? body.allocation
    : body;
  const planCode = String(src.planCode || "") as MarketingPlan;
  if (!MARKETING_PLANS.includes(planCode)) {
    throw httpError("planCode must be starter, growth or enterprise", 400);
  }
  const billingCycle = normalizeInterval(src.billingCycle);
  const trialDays = Math.max(0, Math.min(30, Number(src.trialDays || 0)));
  const modules = Array.isArray(src.modules)
    ? src.modules.map((m: unknown) => String(m)).filter((m: string) =>
        (MODULE_FLAG_KEYS as readonly string[]).includes(m),
      )
    : [];
  if (!modules.length) throw httpError("modules are required", 400);
  const startDate = src.startDate ? new Date(src.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw httpError("Invalid startDate", 400);
  const numOrNull = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return {
    planCode,
    billingCycle,
    priceOverride:
      src.priceOverride === null || src.priceOverride === undefined
        ? null
        : Number(src.priceOverride),
    trialDays,
    modules,
    maxUsers: numOrNull(src.maxUsers),
    maxBranches: numOrNull(src.maxBranches),
    maxStorageBytes: numOrNull(src.maxStorageBytes),
    startDate: startDate.toISOString(),
  };
};

export const submitPublicOnboarding = async (body: any) => {
  if (String(body?.website || "").trim()) {
    return { honeypot: true as const, id: 0, refNo: "RFQ-ONB-00000" };
  }

  const mobile = normalizeIndianMobile(body.mobile);
  if (!mobile) throw httpError("Enter a valid 10-digit Indian mobile number", 400);
  if (!isMobileOtpVerified(mobile)) {
    throw httpError("Verify the mobile OTP before submitting", 400);
  }

  const templateId = String(body.templateId || "");
  if (!(TEMPLATE_IDS as readonly string[]).includes(templateId)) {
    throw httpError("Invalid templateId", 400);
  }
  const template = await getTemplateById(templateId);
  if (!template || !template.active) throw httpError("Invalid templateId", 400);

  const businessName = String(body.businessName || "").trim();
  const contactName = String(body.contactName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const state = String(body.state || "").trim();
  const district = String(body.district || "").trim();
  const pincode = String(body.pincode || body.pinCode || "").trim();
  const businessType = String(body.businessType || "").trim();
  const requestedPlan = String(body.requestedPlan || "") as MarketingPlan;
  const billingCycle = String(body.billingCycle || "");
  const language = ["en", "hi", "gu"].includes(String(body.language))
    ? String(body.language)
    : "en";

  if (!businessName) throw httpError("businessName is required", 400);
  if (!contactName) throw httpError("contactName is required", 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError("Valid email is required", 400);
  }
  if (!state) throw httpError("state is required", 400);
  if (!district) throw httpError("district is required", 400);
  if (!PINCODE.test(pincode)) throw httpError("pincode must be 6 digits", 400);
  if (
    !["buyer", "supplier", "manufacturer", "trading", "other"].includes(
      businessType,
    )
  ) {
    throw httpError("Invalid businessType", 400);
  }
  if (!MARKETING_PLANS.includes(requestedPlan)) {
    throw httpError("requestedPlan must be starter, growth or enterprise", 400);
  }
  if (billingCycle !== "monthly" && billingCycle !== "yearly") {
    throw httpError("billingCycle must be monthly or yearly", 400);
  }
  if (body.acceptedTerms !== true) {
    throw httpError("acceptedTerms must be true", 400);
  }

  const gstin = body.gstin ? String(body.gstin).trim().toUpperCase() : null;
  if (gstin && !GSTIN.test(gstin)) throw httpError("Invalid GSTIN", 400);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await OnboardingRequest.count({
    where: { mobile, createdAt: { [Op.gte]: since } },
  });
  if (recent >= 3) {
    throw httpError(
      "Too many applications from this mobile in the last 24 hours",
      429,
    );
  }

  consumeMobileOtpVerified(mobile);

  const scale = body.scaleData || body.scale_data || {
    monthlyVolume: body.monthlyVolume,
    staffCount: body.staffCount,
    locationCount: body.locationCount,
    currentSoftware: body.currentSoftware,
  };
  const row = await sequelize.transaction(async (transaction) => {
    const refNo = await nextRefNo(transaction);
    return OnboardingRequest.create(
      {
        ref_no: refNo,
        template_id: templateId,
        business_name: businessName,
        business_type: businessType,
        year_established:
          body.yearEstablished != null && body.yearEstablished !== ""
            ? Number(body.yearEstablished)
            : null,
        gstin,
        address: body.address ? String(body.address).trim() : null,
        state,
        district,
        pincode,
        contact_name: contactName,
        mobile,
        email,
        whatsapp: body.whatsapp
          ? normalizeIndianMobile(body.whatsapp) || String(body.whatsapp)
          : null,
        language,
        scale_data: {
          monthlyVolume: scale.monthlyVolume ?? null,
          staffCount: scale.staffCount ?? null,
          locationCount: scale.locationCount ?? null,
          currentSoftware: scale.currentSoftware ?? null,
        },
        requested_plan: requestedPlan,
        billing_cycle: billingCycle,
        status: "pending",
      },
      { transaction },
    );
  });

  await writeAudit({
    action: AUDIT_ACTIONS.ONBOARDING_SUBMIT,
    meta: { requestId: row.id, refNo: row.ref_no },
  });
  notifyOnboardingReceived({
    email,
    name: contactName,
    refNo: row.ref_no,
    businessName,
  }).catch((err) => console.error("[notify] ack failed:", (err as Error).message));

  return { honeypot: false as const, id: row.id, refNo: row.ref_no };
};

export const listOnboarding = async (query: Record<string, any>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const where: any = {};
  if (query.status && query.status !== "all") where.status = String(query.status);
  if (query.templateId) where.template_id = String(query.templateId);
  if (query.state) where.state = String(query.state);
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt[Op.gte] = new Date(String(query.from));
    if (query.to) where.createdAt[Op.lte] = new Date(String(query.to));
  }
  if (query.q?.trim()) {
    const term = `%${String(query.q).trim()}%`;
    where[Op.or] = [
      { business_name: { [Op.iLike]: term } },
      { mobile: { [Op.iLike]: term } },
      { ref_no: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { contact_name: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await OnboardingRequest.findAndCountAll({
    where,
    include: [
      { model: SolutionTemplate, as: "template", attributes: ["id", "name"] },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return {
    data: rows.map((row) =>
      listItem(row, (row as any).template?.name),
    ),
    page,
    limit,
    total: count,
  };
};

export const getOnboardingById = async (id: number) => {
  const row = await OnboardingRequest.findByPk(id, {
    include: [
      { model: SolutionTemplate, as: "template", attributes: ["id", "name"] },
    ],
  });
  if (!row) throw httpError("Onboarding request not found", 404);

  const notes = await OnboardingNote.findAll({
    where: { request_id: id },
    include: [
      { model: User, as: "actor", attributes: ["id", "name"], required: false },
    ],
    order: [["id", "ASC"]],
  });

  const auditRows = await PlatformAuditLog.findAll({
    where: sequelize.where(
      sequelize.literal(`meta->>'requestId'`),
      String(id),
    ),
    include: [
      { model: User, as: "actor", attributes: ["id", "name"], required: false },
    ],
    order: [["createdAt", "ASC"]],
  });

  return {
    id: row.id,
    refNo: row.ref_no,
    templateId: row.template_id,
    templateName: (row as any).template?.name || row.template_id,
    businessName: row.business_name,
    businessType: row.business_type,
    yearEstablished: row.year_established ?? null,
    gstin: row.gstin ?? null,
    address: row.address ?? null,
    state: row.state,
    district: row.district,
    pincode: row.pincode,
    contactName: row.contact_name,
    mobile: row.mobile,
    email: row.email,
    whatsapp: row.whatsapp ?? null,
    language: row.language,
    scaleData: row.scale_data,
    requestedPlan: row.requested_plan,
    billingCycle: row.billing_cycle,
    status: row.status,
    rejectReason: row.reject_reason ?? null,
    companyId: row.company_id ?? null,
    allocation: row.allocation ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      actorUserId: n.actor_user_id ?? null,
      actorName: (n as any).actor?.name || "System",
      createdAt: toIso(n.createdAt),
    })),
    audit: auditRows.map((a) => ({
      actorName: a.actor?.name || "System",
      action: a.action,
      reason: a.reason || null,
      createdAt: toIso(a.createdAt),
      meta: a.meta || null,
    })),
  };
};

export const addOnboardingNote = async (
  id: number,
  body: string,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const row = await requireRequest(id);
  const text = String(body || "").trim();
  if (!text) throw httpError("body is required", 400);
  const note = await OnboardingNote.create({
    request_id: id,
    actor_user_id: ctx?.actorUserId ?? null,
    body: text,
  });
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.ONBOARDING_NOTE,
    companyId: row.company_id,
    ip: ctx?.ip,
    meta: { requestId: row.id, refNo: row.ref_no },
  });
  return {
    id: note.id,
    body: note.body,
    actorUserId: note.actor_user_id ?? null,
    createdAt: toIso(note.createdAt),
  };
};

export const markInReview = async (
  id: number,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const row = await requireRequest(id);
  if (row.status === "in_review") return listItem(row);
  if (row.status !== "pending") {
    throw httpError("Only pending applications can move to in_review", 422);
  }
  await row.update({ status: "in_review" });
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.ONBOARDING_IN_REVIEW,
    ip: ctx?.ip,
    meta: { requestId: row.id, refNo: row.ref_no, diff: { status: "in_review" } },
  });
  return listItem(row);
};

export const rejectOnboarding = async (
  id: number,
  reason: string,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const row = await requireRequest(id);
  const text = String(reason || "").trim();
  if (!text) throw httpError("reason is required", 400);
  if (row.status === "provisioned") {
    throw httpError("Provisioned applications cannot be rejected", 422);
  }
  await row.update({ status: "rejected", reject_reason: text });
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.ONBOARDING_REJECT,
    companyId: row.company_id,
    ip: ctx?.ip,
    reason: text,
    meta: { requestId: row.id, refNo: row.ref_no, diff: { status: "rejected" } },
  });
  notifyOnboardingRejected({
    email: row.email,
    name: row.contact_name,
    refNo: row.ref_no,
    reason: text,
  }).catch((err) =>
    console.error("[notify] reject failed:", (err as Error).message),
  );
  return listItem(row);
};

export const approveOnboarding = async (
  id: number,
  body: any,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const row = await requireRequest(id);
  if (!["pending", "in_review"].includes(row.status)) {
    throw httpError("Only pending or in-review applications can be approved", 422);
  }
  const allocation = parseAllocation(body);
  await row.update({ status: "approved", allocation, reject_reason: null });
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.ONBOARDING_APPROVE,
    ip: ctx?.ip,
    meta: {
      requestId: row.id,
      refNo: row.ref_no,
      diff: { status: "approved", allocation },
    },
  });
  return { ...listItem(row), allocation };
};

const companyAdminFor = async (companyId: number, transaction?: any) => {
  const role = await Role.findOne({
    where: { name: USER_ROLES.COMPANY_ADMIN },
    transaction,
  });
  if (!role) return null;
  return User.findOne({
    where: { companyId, roleId: role.id },
    order: [["id", "ASC"]],
    transaction,
  });
};

export const provisionOnboarding = async (
  id: number,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const existing = await requireRequest(id);
  if (existing.company_id) {
    return {
      companyId: existing.company_id,
      refNo: existing.ref_no,
      setupUrl: null as string | null,
      whatsappMessage:
        "Workspace already provisioned. Use resend-setup for a new 48h link.",
      alreadyProvisioned: true,
    };
  }
  if (existing.status !== "approved" || !existing.allocation) {
    throw httpError("Application must be approved with an allocation first", 400);
  }

  const allocation = existing.allocation;
  const catalogCode = marketingToCatalog[allocation.planCode];
  const plan = await Plan.findOne({
    where: { code: catalogCode, is_active: true },
  });
  if (!plan) throw httpError(`Plan ${catalogCode} is not configured`, 500);

  const role = await Role.findOne({ where: { name: USER_ROLES.COMPANY_ADMIN } });
  if (!role) throw httpError("Company Admin role not found", 500);

  const duplicate = await findUserByEmailOrMobile(
    existing.email,
    existing.mobile,
  );
  if (duplicate) {
    throw httpError("Admin email or mobile already exists", 409, "DUPLICATE_USER");
  }

  let rawToken = "";
  let companyId = 0;

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const locked = await OnboardingRequest.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!locked) throw httpError("Onboarding request not found", 404);
      if (locked.company_id) {
        return { companyId: locked.company_id, rawToken: "", skipped: true };
      }
      if (locked.status !== "approved" || !locked.allocation) {
        throw httpError(
          "Application must be approved with an allocation first",
          400,
        );
      }

      const slug = await allocateUniqueSlug(locked.business_name, undefined, transaction);
      const start = new Date(locked.allocation.startDate || Date.now());
      const trialDays = Number(locked.allocation.trialDays || 0);
      const trialEndsAt =
        trialDays > 0
          ? new Date(start.getTime() + trialDays * 24 * 60 * 60 * 1000)
          : null;
      const interval = normalizeInterval(locked.allocation.billingCycle);
      const amount =
        locked.allocation.priceOverride != null
          ? Number(locked.allocation.priceOverride)
          : amountForPlan(plan, interval);

      const gstin = locked.gstin || `UNREG${Date.now()}`;
      const company = await Company.create(
        {
          companyName: locked.business_name,
          legal_name: locked.business_name,
          businessType: locked.business_type,
          yearOfEstablishment:
            locked.year_established || new Date().getFullYear(),
          gstNumber: gstin,
          companyPANNumber: panFromGstin(locked.gstin),
          addressLine: locked.address || "",
          city: locked.district,
          state: locked.state,
          pinCode: locked.pincode,
          email: locked.email,
          phone: locked.mobile,
          country: "IN",
          primaryIndustrySegment: "General",
          status: "active",
          storage_used_bytes: 0,
          slug,
          region: "ap-south-1",
          timezone: "Asia/Kolkata",
          tags: ["onboarding"],
          primaryContact: {
            name: locked.contact_name,
            role: "Company Admin",
            phone: locked.mobile,
            email: locked.email,
          },
        } as any,
        { transaction },
      );

      const placeholderPassword = generateSecurePassword(24);
      const admin = await createUserForCompany(
        {
          name: locked.contact_name,
          email: locked.email,
          password: placeholderPassword,
          mobile: locked.mobile,
          companyId: company.id,
          roleId: role.id,
          otpVerified: true,
          isActive: false,
        },
        transaction,
      );

      await Subscription.create(
        {
          company_id: company.id,
          plan_id: plan.id,
          status: trialDays > 0 ? "trialing" : "active",
          billing_interval: interval,
          current_period_start: start,
          current_period_end: periodEndFromNow(interval, start),
          amount,
          currency: plan.currency || "INR",
          payment_provider: "owner",
          auto_renew: true,
          trial_ends_at: trialEndsAt,
          trial_days: trialDays > 0 ? trialDays : null,
          feature_overrides: {
            flags: flagsFromModules(locked.allocation.modules),
            quotas: {
              maxUsers: locked.allocation.maxUsers ?? null,
              maxBranches: locked.allocation.maxBranches ?? null,
              maxStorageBytes: locked.allocation.maxStorageBytes ?? null,
            },
          },
        },
        { transaction },
      );

      const token = await issueSetupToken({
        userId: admin.id,
        requestId: locked.id,
        transaction,
      });

      await locked.update(
        { status: "provisioned", company_id: company.id },
        { transaction },
      );

      return { companyId: company.id, rawToken: token, skipped: false };
    });

    companyId = result.companyId;
    rawToken = result.rawToken;

    if (result.skipped) {
      return {
        companyId,
        refNo: existing.ref_no,
        setupUrl: null as string | null,
        whatsappMessage:
          "Workspace already provisioned. Use resend-setup for a new 48h link.",
        alreadyProvisioned: true,
      };
    }
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw httpError("Company or user already exists", 409);
    }
    throw err;
  }

  await existing.reload();
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.ONBOARDING_PROVISION,
    companyId,
    ip: ctx?.ip,
    meta: { requestId: existing.id, refNo: existing.ref_no, companyId },
  });

  const setupUrl = setupUrlForToken(rawToken);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[setup] ${existing.ref_no} ${setupUrl}`);
  }

  notifySetupReady({
    email: existing.email,
    name: existing.contact_name,
    whatsapp: existing.whatsapp,
    setupUrl,
    refNo: existing.ref_no,
  }).catch((err) =>
    console.error("[notify] setup failed:", (err as Error).message),
  );

  return {
    companyId,
    refNo: existing.ref_no,
    setupUrl,
    whatsappMessage: whatsappSetupMessage(existing.contact_name, setupUrl),
    alreadyProvisioned: false,
  };
};

export const resendSetup = async (
  id: number,
  ctx?: { actorUserId?: number; ip?: string },
) => {
  const row = await requireRequest(id);
  if (row.status !== "provisioned" || !row.company_id) {
    throw httpError("Setup can only be resent after provision", 422);
  }
  const admin = await companyAdminFor(row.company_id);
  if (!admin) throw httpError("Company admin not found", 404);

  const now = new Date();
  await SetupToken.update(
    { used_at: now },
    { where: { user_id: admin.id, used_at: null } },
  );
  const raw = await issueSetupToken({
    userId: admin.id,
    requestId: row.id,
  });
  const setupUrl = setupUrlForToken(raw);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[setup] resend ${row.ref_no} ${setupUrl}`);
  }

  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.ONBOARDING_RESEND_SETUP,
    companyId: row.company_id,
    ip: ctx?.ip,
    meta: { requestId: row.id, refNo: row.ref_no },
  });

  notifySetupReady({
    email: row.email,
    name: row.contact_name,
    whatsapp: row.whatsapp,
    setupUrl,
    refNo: row.ref_no,
  }).catch((err) =>
    console.error("[notify] resend failed:", (err as Error).message),
  );

  return {
    companyId: row.company_id,
    refNo: row.ref_no,
    setupUrl,
    whatsappMessage: whatsappSetupMessage(row.contact_name, setupUrl),
  };
};

export const completeSetup = async (rawToken: string, password: string) => {
  const token = String(rawToken || "").trim();
  const pass = String(password || "");
  if (!token) throw httpError("token is required", 400);
  if (pass.length < 8) throw httpError("Password must be at least 8 characters", 400);

  const row = await SetupToken.findOne({ where: { token_hash: hashToken(token) } });
  if (!row || row.used_at || row.expires_at.getTime() <= Date.now()) {
    throw httpError("Invalid or expired setup token", 400);
  }

  const user = await User.findByPk(row.user_id, {
    include: [{ model: Role, as: "userRole" }],
  });
  if (!user) throw httpError("Invalid or expired setup token", 400);

  user.password = pass;
  user.isActive = true;
  await user.save();
  await row.update({ used_at: new Date() });

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError("JWT_SECRET is not set", 500);
  const jwtToken = jwt.sign({ id: user.id }, secret, {
    expiresIn: "12h",
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(
    { id: user.id, type: "refresh" },
    secret,
    { expiresIn: "7d" } as jwt.SignOptions,
  );
  const slug = roleToSlug(user.userRole?.name || USER_ROLES.COMPANY_ADMIN);

  return {
    token: jwtToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: slug,
      roleSlug: slug,
      permissions: [],
      mobile: user.mobile,
    },
  };
};

