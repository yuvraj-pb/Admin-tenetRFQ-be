import { Op } from "sequelize";
import Company from "../database/models/company";
import User from "../database/models/user";
import Subscription from "../database/models/subscription";
import { latestSubscriptionsByCompanyIds } from "./subscriptionHelpers";
import { isAtRiskTenant } from "../utils/tenantHealth";

/**
 * Platform dashboard stats. Aggregates only company / user / subscription
 * counts — never procurement data.
 */
export const getPlatformDashboard = async () => {
  const expiringWithinDays = Number(process.env.EXPIRING_WITHIN_DAYS) || 30;
  const soon = new Date();
  soon.setDate(soon.getDate() + expiringWithinDays);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const liveCompanies = await Company.findAll({
    where: { status: { [Op.ne]: "deleted" } },
    attributes: ["id", "status", "createdAt"],
  });
  const liveIds = liveCompanies.map((c) => c.id);

  const [
    totalCompanies,
    activeCompanies,
    suspendedCompanies,
    archivedCompanies,
    totalUsers,
    subscriptionsExpiringSoon,
    activeSubscriptions,
    subMap,
  ] = await Promise.all([
    Company.count({ where: { status: { [Op.ne]: "deleted" } } }),
    Company.count({ where: { status: "active" } }),
    Company.count({ where: { status: "suspended" } }),
    Company.count({ where: { status: "archived" } }),
    liveIds.length
      ? User.count({ where: { companyId: { [Op.in]: liveIds } } })
      : Promise.resolve(0),
    Subscription.count({
      where: {
        status: "active",
        current_period_end: { [Op.between]: [new Date(), soon] },
      },
      include: [
        {
          model: Company,
          as: "company",
          attributes: [],
          required: true,
          where: { status: { [Op.ne]: "deleted" } },
        },
      ],
    }),
    Subscription.findAll({
      where: { status: "active" },
      attributes: ["amount", "billing_interval"],
      include: [
        {
          model: Company,
          as: "company",
          attributes: [],
          required: true,
          where: { status: { [Op.ne]: "deleted" } },
        },
      ],
    }),
    latestSubscriptionsByCompanyIds(liveIds),
  ]);

  let pastDueCompanies = 0;
  let incompleteCompanies = 0;
  let trialingCompanies = 0;
  let atRiskCompanies = 0;
  let newCompaniesThisMonth = 0;

  for (const company of liveCompanies) {
    if (company.createdAt && new Date(company.createdAt) >= monthStart) {
      newCompaniesThisMonth += 1;
    }
    const sub = subMap.get(company.id);
    const input = {
      status: company.status,
      subscriptionStatus: sub?.status,
      subscriptionExpiresAt: sub?.current_period_end,
    };
    if (isAtRiskTenant(input)) atRiskCompanies += 1;
    if (sub?.status === "past_due") pastDueCompanies += 1;
    if (sub?.status === "incomplete") incompleteCompanies += 1;
    if (sub?.status === "trialing") trialingCompanies += 1;
  }

  const monthlyRevenue =
    Math.round(
      activeSubscriptions.reduce((sum, s) => {
        const amount = Number(s.amount) || 0;
        return sum + (s.billing_interval === "yearly" ? amount / 12 : amount);
      }, 0) * 100,
    ) / 100;

  return {
    totalCompanies,
    activeCompanies,
    suspendedCompanies,
    archivedCompanies,
    totalUsers,
    monthlyRevenue,
    currency: process.env.DEFAULT_CURRENCY || "INR",
    subscriptionsExpiringSoon,
    expiringWithinDays,
    pastDueCompanies,
    incompleteCompanies,
    trialingCompanies,
    atRiskCompanies,
    newCompaniesThisMonth,
  };
};
