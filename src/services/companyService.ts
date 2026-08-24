import { Op, UniqueConstraintError } from "sequelize";
import sequelize from "../database/models";
import Company from "../database/models/company";
import Plan from "../database/models/plan";
import Subscription from "../database/models/subscription";
import User from "../database/models/user";
import Role, { USER_ROLES } from "../database/models/role";
import {
  getCompaniesLastActive,
  getCompaniesUsage,
  getCompanyUsage,
} from "./usageService";
import {
  amountForPlan,
  latestSubscription,
  latestSubscriptionsByCompanyIds,
  normalizeInterval,
  normalizeProvider,
  periodEndFromNow,
} from "./subscriptionHelpers";
import { buildCheckoutSession } from "./billing/billingService";
import PlatformPayment from "../database/models/platformPayment";
import { writeAudit } from "./auditService";
import {
  createUserForCompany,
  findUserByEmailOrMobile,
} from "./userRepository";
import { generateSecurePassword } from "../utils/commonFunctions";
import {
  credentialsEmailHtml,
  resetPasswordEmailHtml,
  sendEmail,
} from "./emailService";
import {
  CompanyAdminShape,
  serializeCompany,
} from "../utils/serializers";
import { httpError } from "../utils/httpError";
import { allocateUniqueSlug, isValidSlug, slugify } from "../utils/slug";
import { AUDIT_ACTIONS, lifecycleAuditAction } from "../utils/auditActions";
import { computeTenantHealth } from "../utils/tenantHealth";

export interface MutationContext {
  actorUserId?: number;
  ip?: string;
  reason?: string;
}

const getCompanyAdmin = async (
  companyId: number,
): Promise<CompanyAdminShape | null> => {
  const role = await Role.findOne({ where: { name: USER_ROLES.COMPANY_ADMIN } });
  if (!role) return null;
  const admin = await User.findOne({
    where: { companyId, roleId: role.id },
    attributes: ["id", "name", "email", "mobile"],
    order: [["id", "ASC"]],
  });
  if (!admin) return null;
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    mobile: admin.mobile ?? undefined,
  };
};

const getCompanyAdmins = async (companyIds: number[]) => {
  const map = new Map<number, CompanyAdminShape | null>();
  for (const id of companyIds) map.set(id, null);
  if (!companyIds.length) return map;
  const role = await Role.findOne({ where: { name: USER_ROLES.COMPANY_ADMIN } });
  if (!role) return map;
  const admins = await User.findAll({
    where: { companyId: { [Op.in]: companyIds }, roleId: role.id },
    attributes: ["id", "name", "email", "mobile", "companyId"],
    order: [["id", "ASC"]],
  });
  for (const admin of admins) {
    if (admin.companyId == null || map.get(admin.companyId)) continue;
    map.set(admin.companyId, {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      mobile: admin.mobile ?? undefined,
    });
  }
  return map;
};

const laterDate = (
  a?: Date | string | null,
  b?: Date | string | null,
): Date | string | null => {
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  if (Number.isNaN(ta) && Number.isNaN(tb)) return null;
  if (Number.isNaN(ta)) return b ?? null;
  if (Number.isNaN(tb)) return a ?? null;
  return ta >= tb ? a! : b!;
};

const serialize = async (
  company: Company,
  opts?: { includePrivate?: boolean },
) => {
  const [usage, companyAdmin, subscription, lastActiveMap] = await Promise.all([
    getCompanyUsage(company.id),
    getCompanyAdmin(company.id),
    latestSubscription(company.id),
    getCompaniesLastActive([company.id]),
  ]);
  return serializeCompany({
    company,
    usage,
    companyAdmin,
    subscription,
    lastActiveAt: laterDate(company.last_active_at, lastActiveMap.get(company.id)),
    includePrivate: opts?.includePrivate,
  });
};

const parseTenantSearchId = (raw: string): number | null => {
  const ten = raw.match(/^TEN-0*(\d+)$/i);
  if (ten) return Number(ten[1]);
  if (/^\d+$/.test(raw)) return Number(raw);
  return null;
};

const subscriptionCompanyIds = async (query: Record<string, any>) => {
  if (
    !query.planId &&
    !query.subscriptionStatus &&
    !query.expiringWithinDays
  ) {
    return null;
  }
  const subWhere: any = {};
  if (query.planId) subWhere.plan_id = Number(query.planId);
  if (query.subscriptionStatus && query.subscriptionStatus !== "all") {
    subWhere.status = String(query.subscriptionStatus);
  }
  if (query.expiringWithinDays) {
    const soon = new Date();
    soon.setDate(soon.getDate() + Number(query.expiringWithinDays));
    subWhere.current_period_end = { [Op.between]: [new Date(), soon] };
  }
  const subs = await Subscription.findAll({
    where: subWhere,
    attributes: ["company_id"],
  });
  return [...new Set(subs.map((s) => s.company_id))];
};

export const listPlatformCompanies = async (query: Record<string, any>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const where: any = {};

  if (query.status && query.status !== "all") {
    where.status = String(query.status);
  } else if (query.status !== "all") {
    where.status = { [Op.ne]: "deleted" };
  }

  if (query.search?.trim()) {
    const raw = String(query.search).trim();
    const term = `%${raw}%`;
    const or: any[] = [
      { companyName: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { legal_name: { [Op.iLike]: term } },
      { gstNumber: { [Op.iLike]: term } },
      { slug: { [Op.iLike]: term } },
    ];
    const searchId = parseTenantSearchId(raw);
    if (searchId != null) or.push({ id: searchId });
    where[Op.or] = or;
  }

  const subIds = await subscriptionCompanyIds(query);
  if (subIds) {
    where.id = { [Op.in]: subIds.length ? subIds : [-1] };
  }

  const matches = await Company.findAll({
    where,
    attributes: [
      "id",
      "companyName",
      "status",
      "createdAt",
      "storage_used_bytes",
      "last_active_at",
    ],
  });
  const ids = matches.map((c) => c.id);
  const [usageMap, lastActiveMap, subMap] = await Promise.all([
    getCompaniesUsage(ids),
    getCompaniesLastActive(ids),
    latestSubscriptionsByCompanyIds(ids),
  ]);

  const healthFilter = String(query.health || "").toLowerCase();
  const scored = matches.map((company) => {
    const sub = subMap.get(company.id) ?? null;
    const usage = usageMap.get(company.id) || {
      usersUsed: 0,
      branchesUsed: 0,
      storageUsedBytes: 0,
    };
    const plan = sub?.plan ?? null;
    const health = computeTenantHealth({
      status: company.status,
      subscriptionStatus: sub?.status,
      subscriptionExpiresAt: sub?.current_period_end,
      usage,
      limits: {
        maxUsers: plan?.max_users ?? null,
        maxBranches: plan?.max_branches ?? null,
        maxStorageBytes:
          plan?.max_storage_bytes != null
            ? Number(plan.max_storage_bytes)
            : null,
      },
    });
    return { company, sub, usage, health: health.health };
  });

  const filtered =
    healthFilter === "healthy" ||
    healthFilter === "watch" ||
    healthFilter === "critical"
      ? scored.filter((row) => row.health === healthFilter)
      : scored;

  const sortBy = String(query.sortBy || "createdAt");
  const sortOrder =
    String(query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    let av: any;
    let bv: any;
    if (sortBy === "companyName") {
      av = a.company.companyName || "";
      bv = b.company.companyName || "";
    } else if (sortBy === "status") {
      av = a.company.status || "";
      bv = b.company.status || "";
    } else if (sortBy === "usersUsed") {
      av = a.usage.usersUsed;
      bv = b.usage.usersUsed;
    } else if (sortBy === "subscriptionExpiresAt") {
      av = a.sub?.current_period_end
        ? new Date(a.sub.current_period_end).getTime()
        : 0;
      bv = b.sub?.current_period_end
        ? new Date(b.sub.current_period_end).getTime()
        : 0;
    } else {
      av = a.company.createdAt ? new Date(a.company.createdAt).getTime() : 0;
      bv = b.company.createdAt ? new Date(b.company.createdAt).getTime() : 0;
    }
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * sortOrder;
    }
    return (av - bv) * sortOrder;
  });

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * limit, page * limit);
  const pageIds = pageRows.map((r) => r.company.id);
  if (!pageIds.length) {
    return { data: [], page, limit, total };
  }

  const companies = await Company.findAll({ where: { id: { [Op.in]: pageIds } } });
  const byId = new Map(companies.map((c) => [c.id, c]));
  const adminMap = await getCompanyAdmins(pageIds);

  const data = pageRows.map((row) => {
    const company = byId.get(row.company.id) || row.company;
    return serializeCompany({
      company,
      usage: row.usage,
      companyAdmin: adminMap.get(row.company.id) ?? null,
      subscription: row.sub,
      lastActiveAt: laterDate(
        company.last_active_at,
        lastActiveMap.get(company.id),
      ),
    });
  });

  return { data, page, limit, total };
};

export const getPlatformCompany = async (id: number) => {
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  return serialize(company, { includePrivate: true });
};

const resolveCreateSlug = async (body: any): Promise<string> => {
  if (body.slug != null && String(body.slug).trim()) {
    const slug = slugify(String(body.slug));
    if (!isValidSlug(slug)) throw httpError("Invalid slug", 400);
    const taken = await Company.findOne({ where: { slug } });
    if (taken) throw httpError("Slug already in use", 409, "DUPLICATE_SLUG");
    return slug;
  }
  return allocateUniqueSlug(String(body.companyName || "tenant"));
};

export const createPlatformCompany = async (
  body: any,
  ctx?: MutationContext | number,
) => {
  const actorUserId = typeof ctx === "number" ? ctx : ctx?.actorUserId;
  const ip = typeof ctx === "number" ? undefined : ctx?.ip;
  const plan = await Plan.findByPk(Number(body.planId));
  if (!plan || !plan.is_active) throw httpError("Invalid plan", 400);

  const admin = body.companyAdmin || {};
  if (!body.companyName || !admin.name || !admin.email) {
    throw httpError(
      "companyName and companyAdmin name/email are required",
      400,
    );
  }

  const billingInterval = normalizeInterval(body.billingInterval);
  const tempPassword = admin.password || generateSecurePassword(12);
  const mobile = admin.mobile || null;
  const slug = await resolveCreateSlug(body);

  const existingUser = await findUserByEmailOrMobile(admin.email, mobile);
  if (existingUser) {
    throw httpError("Admin email or mobile already exists", 409, "DUPLICATE_USER");
  }

  let result: { company: Company; subscription: Subscription };
  try {
    result = await sequelize.transaction(async (transaction) => {
      const company = await Company.create(
        {
          companyName: body.companyName,
          legal_name: body.legalName || body.companyName,
          email: body.email || admin.email,
          phone: body.phone || mobile,
          country: body.country || "IN",
          gstNumber: body.gstNumber || `TEMP${Date.now()}`,
          addressLine: body.addressLine || "",
          city: body.city || "N/A",
          state: body.state || "N/A",
          pinCode: body.pinCode || "000000",
          companyPANNumber: body.companyPANNumber || "",
          yearOfEstablishment:
            body.yearOfEstablishment || new Date().getFullYear(),
          primaryIndustrySegment: body.primaryIndustrySegment || "General",
          businessType: body.businessType || "Private Limited",
          status: "active",
          storage_used_bytes: 0,
          slug,
          region: body.region || "ap-south-1",
          timezone: body.timezone || "Asia/Kolkata",
          tags: Array.isArray(body.tags) ? body.tags : [],
          primaryContact: {
            name: admin.name,
            role: "Company Admin",
            phone: mobile || "",
            email: admin.email,
          },
        } as any,
        { transaction },
      );

      const role = await Role.findOne({
        where: { name: USER_ROLES.COMPANY_ADMIN },
        transaction,
      });
      if (!role) throw httpError("Company Admin role not found", 500);

      await createUserForCompany(
        {
          name: admin.name,
          email: admin.email,
          password: tempPassword,
          mobile,
          companyId: company.id,
          roleId: role.id,
          otpVerified: true,
          isActive: true,
        },
        transaction,
      );

      const now = new Date();
      const coverNow = !body.collectPayment;
      const amount = amountForPlan(plan, billingInterval);
      const currency = plan.currency || "INR";
      const subscription = await Subscription.create(
        {
          company_id: company.id,
          plan_id: plan.id,
          status: coverNow ? "active" : "incomplete",
          billing_interval: billingInterval,
          current_period_start: now,
          current_period_end: periodEndFromNow(billingInterval, now),
          amount,
          currency,
          payment_provider: coverNow
            ? "owner"
            : normalizeProvider(body.paymentProvider),
          cancel_at_period_end: false,
          auto_renew: true,
        },
        { transaction },
      );

      if (coverNow) {
        await PlatformPayment.create(
          {
            company_id: company.id,
            subscription_id: subscription.id,
            provider: "owner",
            amount,
            currency,
            status: "paid",
            purpose: "grant",
            raw_payload: {
              coveredBy: "platform_owner",
              reason: "Covered on company create — tenant not charged",
            },
          },
          { transaction },
        );
      }

      return { company, subscription };
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw httpError("Slug already in use", 409, "DUPLICATE_SLUG");
    }
    throw err;
  }

  let emailed = false;
  if (!admin.password) {
    emailed = await sendEmail({
      to: admin.email,
      subject: "Your Advance RFQ company admin credentials",
      html: credentialsEmailHtml({
        name: admin.name,
        email: admin.email,
        password: tempPassword,
        companyName: body.companyName,
        loginUrl: process.env.FRONTEND_URL || "http://localhost:3000/login",
      }),
    });
  }

  await writeAudit({
    actorUserId,
    action: AUDIT_ACTIONS.COMPANY_CREATED,
    companyId: result.company.id,
    ip,
    meta: { planId: plan.id, collectPayment: !!body.collectPayment, slug },
  });

  const companyPayload = await serialize(result.company, { includePrivate: true });

  let checkout;
  if (body.collectPayment) {
    checkout = await buildCheckoutSession({
      company: result.company,
      plan,
      subscription: result.subscription,
      billingInterval,
      paymentProvider: normalizeProvider(body.paymentProvider),
      purpose: "new",
    });
  }

  return {
    ...companyPayload,
    checkout,
    temporaryPassword: admin.password || emailed ? undefined : tempPassword,
    emailed,
  };
};

export const updatePlatformCompany = async (
  id: number,
  body: any,
  ctx?: MutationContext | number,
) => {
  const actorUserId = typeof ctx === "number" ? ctx : ctx?.actorUserId;
  const ip = typeof ctx === "number" ? undefined : ctx?.ip;
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const updates: Record<string, unknown> = {};
  if (body.companyName !== undefined) updates.companyName = body.companyName;
  if (body.legalName !== undefined) updates.legal_name = body.legalName;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.gstNumber !== undefined) updates.gstNumber = body.gstNumber;
  if (body.addressLine !== undefined) updates.addressLine = body.addressLine;
  if (body.city !== undefined) updates.city = body.city;
  if (body.state !== undefined) updates.state = body.state;
  if (body.country !== undefined) updates.country = body.country;
  if (body.region !== undefined) updates.region = body.region;
  if (body.timezone !== undefined) updates.timezone = body.timezone;

  if (body.slug !== undefined && String(body.slug).trim()) {
    const slug = slugify(String(body.slug));
    if (!isValidSlug(slug)) throw httpError("Invalid slug", 400);
    if (slug !== company.slug) {
      const taken = await Company.findOne({
        where: { slug, id: { [Op.ne]: id } },
      });
      if (taken) throw httpError("Slug already in use", 409, "DUPLICATE_SLUG");
      updates.slug = slug;
    }
  } else if (!company.slug && body.companyName) {
    updates.slug = await allocateUniqueSlug(String(body.companyName), id);
  }

  try {
    await company.update(updates);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw httpError("Slug already in use", 409, "DUPLICATE_SLUG");
    }
    throw err;
  }
  await writeAudit({
    actorUserId,
    action: AUDIT_ACTIONS.COMPANY_UPDATED,
    companyId: id,
    ip,
    meta: updates,
  });
  return serialize(company, { includePrivate: true });
};

export const updateCompanyNotes = async (
  id: number,
  body: { internalNotes?: string; tags?: string[] },
  ctx?: MutationContext,
) => {
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const updates: Record<string, unknown> = {};
  if (body.internalNotes !== undefined) {
    updates.internal_notes = body.internalNotes ?? "";
  }
  if (body.tags !== undefined) {
    updates.tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean)
      : [];
  }
  await company.update(updates);
  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: AUDIT_ACTIONS.COMPANY_UPDATED,
    companyId: id,
    ip: ctx?.ip,
    reason: "notes",
    meta: updates,
  });
  return serialize(company, { includePrivate: true });
};

const setCompanyStatus = async (
  id: number,
  status: string,
  ctx?: MutationContext,
) => {
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const updates: any = { status };
  if (status === "suspended") updates.suspend_reason = ctx?.reason || null;
  if (status === "active") updates.suspend_reason = null;
  if (status === "deleted") updates.deleted_at = new Date();
  await company.update(updates);

  // Block tenant JWTs / login immediately: company.status is checked on every
  // tenant request, and isActive=false rejects any login path that consults it.
  if (["suspended", "archived", "deleted"].includes(status)) {
    await User.update({ isActive: false }, { where: { companyId: id } });
  } else if (status === "active") {
    await User.update({ isActive: true }, { where: { companyId: id } });
  }

  await writeAudit({
    actorUserId: ctx?.actorUserId,
    action: lifecycleAuditAction(status),
    companyId: id,
    ip: ctx?.ip,
    reason: ctx?.reason,
    meta: { reason: ctx?.reason, status },
  });
  return serialize(company, { includePrivate: true });
};

export const suspendCompany = (
  id: number,
  reason: string | undefined,
  ctx?: MutationContext | number,
) =>
  setCompanyStatus(id, "suspended", {
    actorUserId: typeof ctx === "number" ? ctx : ctx?.actorUserId,
    ip: typeof ctx === "number" ? undefined : ctx?.ip,
    reason,
  });

export const activateCompany = async (
  id: number,
  ctx?: MutationContext | number,
) => {
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  if (company.status !== "suspended") {
    throw httpError("Only suspended companies can be activated", 422);
  }
  return setCompanyStatus(id, "active", {
    actorUserId: typeof ctx === "number" ? ctx : ctx?.actorUserId,
    ip: typeof ctx === "number" ? undefined : ctx?.ip,
  });
};

export const archiveCompany = (id: number, ctx?: MutationContext | number) =>
  setCompanyStatus(id, "archived", {
    actorUserId: typeof ctx === "number" ? ctx : ctx?.actorUserId,
    ip: typeof ctx === "number" ? undefined : ctx?.ip,
  });

export const softDeleteCompany = async (
  id: number,
  ctx?: MutationContext | number,
) => {
  await setCompanyStatus(id, "deleted", {
    actorUserId: typeof ctx === "number" ? ctx : ctx?.actorUserId,
    ip: typeof ctx === "number" ? undefined : ctx?.ip,
  });
};

export const resetCompanyAdminPassword = async (
  id: number,
  ctx?: MutationContext | number,
) => {
  const actorUserId = typeof ctx === "number" ? ctx : ctx?.actorUserId;
  const ip = typeof ctx === "number" ? undefined : ctx?.ip;
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const admin = await getCompanyAdmin(id);
  if (!admin) throw httpError("Company admin not found", 404);

  const tempPassword = generateSecurePassword(12);
  const user = await User.findByPk(admin.id);
  if (!user) throw httpError("Company admin not found", 404);
  user.password = tempPassword;
  await user.save();

  const emailed = await sendEmail({
    to: admin.email,
    subject: "Your temporary Advance RFQ password",
    html: resetPasswordEmailHtml({ name: admin.name, password: tempPassword }),
  });

  await writeAudit({
    actorUserId,
    action: AUDIT_ACTIONS.PASSWORD_RESET,
    companyId: id,
    ip,
    meta: { emailed },
  });
  return {
    temporaryPassword: emailed ? undefined : tempPassword,
    emailed,
  };
};
