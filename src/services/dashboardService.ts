import { Op } from "sequelize";
import Company from "../database/models/company";
import User from "../database/models/user";
import Subscription from "../database/models/subscription";

/**
 * Platform dashboard stats. Aggregates only company / user / subscription
 * counts — never procurement data.
 */
export const getPlatformDashboard = async () => {
  const expiringWithinDays = Number(process.env.EXPIRING_WITHIN_DAYS) || 30;
  const soon = new Date();
  soon.setDate(soon.getDate() + expiringWithinDays);

  const [
    totalCompanies,
    activeCompanies,
    suspendedCompanies,
    archivedCompanies,
    totalUsers,
    subscriptionsExpiringSoon,
    activeSubscriptions,
  ] = await Promise.all([
    Company.count({ where: { status: { [Op.ne]: "deleted" } } }),
    Company.count({ where: { status: "active" } }),
    Company.count({ where: { status: "suspended" } }),
    Company.count({ where: { status: "archived" } }),
    // Super Admins have companyId = null, so this naturally excludes them.
    User.count({ where: { companyId: { [Op.ne]: null } } }),
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
  ]);

  // monthlyRevenue = sum of active subscriptions normalized to monthly.
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
  };
};
