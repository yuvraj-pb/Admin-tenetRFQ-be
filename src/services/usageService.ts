import Company from "../database/models/company";
import User from "../database/models/user";
import Branch from "../database/models/branch";
import Plan from "../database/models/plan";
import { PlatformUsage } from "../utils/serializers";
import { httpError } from "../utils/httpError";

/**
 * Usage counts for a company. Never touches procurement data:
 *   branchesUsed  = COUNT(branches WHERE companyId)
 *   usersUsed     = COUNT(users WHERE companyId)
 *   storageUsedBytes = companyDetails.storage_used_bytes
 */
export const getCompanyUsage = async (
  companyId: number,
): Promise<PlatformUsage> => {
  const [branchesUsed, usersUsed, company] = await Promise.all([
    Branch.count({ where: { companyId } }),
    User.count({ where: { companyId } }),
    Company.findByPk(companyId, { attributes: ["storage_used_bytes"] }),
  ]);
  return {
    branchesUsed,
    usersUsed,
    storageUsedBytes: Number(company?.storage_used_bytes ?? 0),
  };
};

/**
 * Guards a plan downgrade: the target plan must still fit current usage.
 */
export const assertDowngradeAllowed = async (companyId: number, plan: Plan) => {
  const usage = await getCompanyUsage(companyId);
  if (plan.max_users != null && usage.usersUsed > plan.max_users) {
    throw httpError(
      `Cannot downgrade: company has ${usage.usersUsed} users but plan allows ${plan.max_users}`,
      422,
    );
  }
  if (plan.max_branches != null && usage.branchesUsed > plan.max_branches) {
    throw httpError(
      `Cannot downgrade: company has ${usage.branchesUsed} branches but plan allows ${plan.max_branches}`,
      422,
    );
  }
  if (
    plan.max_storage_bytes != null &&
    usage.storageUsedBytes > Number(plan.max_storage_bytes)
  ) {
    throw httpError(
      "Cannot downgrade: storage usage exceeds the target plan limit",
      422,
    );
  }
};
