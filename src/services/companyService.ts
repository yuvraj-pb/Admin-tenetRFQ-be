import { Op } from "sequelize";
import sequelize from "../database/models";
import Company from "../database/models/company";
import Plan from "../database/models/plan";
import Subscription from "../database/models/subscription";
import User from "../database/models/user";
import Role, { USER_ROLES } from "../database/models/role";
import { getCompanyUsage } from "./usageService";
import {
  amountForPlan,
  latestSubscription,
  normalizeInterval,
  normalizeProvider,
  periodEndFromNow,
} from "./subscriptionHelpers";
import { buildCheckoutSession } from "./billing/billingService";
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

const serialize = async (company: Company) => {
  const [usage, companyAdmin, subscription] = await Promise.all([
    getCompanyUsage(company.id),
    getCompanyAdmin(company.id),
    latestSubscription(company.id),
  ]);
  return serializeCompany({ company, usage, companyAdmin, subscription });
};

export const listPlatformCompanies = async (query: Record<string, any>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const where: any = {};

  if (query.status && query.status !== "all") {
    where.status = String(query.status);
  } else if (query.status !== "all") {
    where.status = { [Op.ne]: "deleted" };
  }

  if (query.search?.trim()) {
    const term = `%${String(query.search).trim()}%`;
    where[Op.or] = [
      { companyName: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
      { legal_name: { [Op.iLike]: term } },
      { gstNumber: { [Op.iLike]: term } },
    ];
  }

  if (query.planId || query.subscriptionStatus || query.expiringWithinDays) {
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
    const ids = [...new Set(subs.map((s) => s.company_id))];
    where.id = { [Op.in]: ids.length ? ids : [-1] };
  }

  const sortByMap: Record<string, string> = {
    companyName: "companyName",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  };
  const sortBy = sortByMap[String(query.sortBy || "")] || "createdAt";
  const sortOrder =
    String(query.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const { rows, count } = await Company.findAndCountAll({
    where,
    order: [[sortBy, sortOrder]],
    limit,
    offset,
  });

  const data = await Promise.all(rows.map(serialize));
  return { data, page, limit, total: count };
};

export const getPlatformCompany = async (id: number) => {
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  return serialize(company);
};

export const createPlatformCompany = async (body: any, actorUserId?: number) => {
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

  const existingUser = await findUserByEmailOrMobile(admin.email, mobile);
  if (existingUser) {
    throw httpError("Admin email or mobile already exists", 409, "DUPLICATE_USER");
  }

  const result = await sequelize.transaction(async (transaction) => {
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
    const subscription = await Subscription.create(
      {
        company_id: company.id,
        plan_id: plan.id,
        status: body.collectPayment ? "incomplete" : "active",
        billing_interval: billingInterval,
        current_period_start: now,
        current_period_end: periodEndFromNow(billingInterval, now),
        amount: amountForPlan(plan, billingInterval),
        currency: plan.currency || "INR",
        payment_provider: body.paymentProvider || null,
      },
      { transaction },
    );

    return { company, subscription };
  });

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

  await writeAudit(actorUserId, "company.create", result.company.id, {
    planId: plan.id,
    collectPayment: !!body.collectPayment,
  });

  const companyPayload = await serialize(result.company);

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
  actorUserId?: number,
) => {
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
  await company.update(updates);
  await writeAudit(actorUserId, "company.update", id, updates);
  return serialize(company);
};

const setCompanyStatus = async (
  id: number,
  status: string,
  actorUserId?: number,
  reason?: string,
) => {
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  const updates: any = { status };
  if (status === "suspended") updates.suspend_reason = reason || null;
  if (status === "active") updates.suspend_reason = null;
  if (status === "deleted") updates.deleted_at = new Date();
  await company.update(updates);

  // Mirror lifecycle onto tenant users so blocked companies cannot log in.
  if (["suspended", "archived", "deleted"].includes(status)) {
    await User.update({ isActive: false }, { where: { companyId: id } });
  } else if (status === "active") {
    await User.update({ isActive: true }, { where: { companyId: id } });
  }

  await writeAudit(actorUserId, `company.${status}`, id, { reason });
  return serialize(company);
};

export const suspendCompany = (
  id: number,
  reason: string | undefined,
  actor?: number,
) => setCompanyStatus(id, "suspended", actor, reason);

export const activateCompany = async (id: number, actor?: number) => {
  const company = await Company.findByPk(id);
  if (!company || company.status === "deleted") {
    throw httpError("Company not found", 404);
  }
  if (company.status !== "suspended") {
    throw httpError("Only suspended companies can be activated", 422);
  }
  return setCompanyStatus(id, "active", actor);
};

export const archiveCompany = (id: number, actor?: number) =>
  setCompanyStatus(id, "archived", actor);

export const softDeleteCompany = async (id: number, actor?: number) => {
  await setCompanyStatus(id, "deleted", actor);
};

export const resetCompanyAdminPassword = async (id: number, actor?: number) => {
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

  await writeAudit(actor, "company.reset_admin_password", id, { emailed });
  return {
    temporaryPassword: emailed ? undefined : tempPassword,
    emailed,
  };
};
