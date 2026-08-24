import { Op, QueryTypes } from "sequelize";
import sequelize from "../database/models";
import Company from "../database/models/company";
import User from "../database/models/user";
import Branch from "../database/models/branch";
import Plan from "../database/models/plan";
import CompanyFile from "../database/models/companyFile";
import { PlatformUsage } from "../utils/serializers";
import { httpError } from "../utils/httpError";

const asInt = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const sumCompanyFileBytes = async (companyId: number): Promise<number> => {
  try {
    const total = await CompanyFile.sum("byte_size", {
      where: { company_id: companyId },
    });
    return asInt(total);
  } catch {
    return 0;
  }
};

/**
 * Usage counts for a company. Never touches procurement data:
 *   usersUsed     = COUNT(users WHERE companyId) — not deactivated-by-suspend
 *   branchesUsed  = COUNT(branches WHERE companyId)
 *   storageUsedBytes = max(SUM(company_files.byte_size), company.storage_used_bytes)
 */
export const getCompanyUsage = async (
  companyId: number,
): Promise<PlatformUsage> => {
  const [branchesUsed, usersUsed, company, filesBytes] = await Promise.all([
    Branch.count({ where: { companyId } }),
    User.count({ where: { companyId } }),
    Company.findByPk(companyId, { attributes: ["storage_used_bytes"] }),
    sumCompanyFileBytes(companyId),
  ]);
  return {
    branchesUsed,
    usersUsed,
    storageUsedBytes: Math.max(filesBytes, asInt(company?.storage_used_bytes)),
  };
};

type CountRow = { company_id: number; count: number | string };
type LastActiveRow = { company_id: number; last_login: Date | string | null };

export const getCompaniesUsage = async (
  companyIds: number[],
): Promise<Map<number, PlatformUsage>> => {
  const map = new Map<number, PlatformUsage>();
  if (!companyIds.length) return map;
  for (const id of companyIds) {
    map.set(id, { usersUsed: 0, branchesUsed: 0, storageUsedBytes: 0 });
  }

  const [userRows, branchRows, companies, fileRows] = await Promise.all([
    sequelize.query<CountRow>(
      `SELECT "companyId" AS company_id, COUNT(*)::int AS count
       FROM users WHERE "companyId" IN (:ids) GROUP BY "companyId"`,
      { replacements: { ids: companyIds }, type: QueryTypes.SELECT },
    ),
    sequelize.query<CountRow>(
      `SELECT "companyId" AS company_id, COUNT(*)::int AS count
       FROM branches WHERE "companyId" IN (:ids) GROUP BY "companyId"`,
      { replacements: { ids: companyIds }, type: QueryTypes.SELECT },
    ),
    Company.findAll({
      where: { id: { [Op.in]: companyIds } },
      attributes: ["id", "storage_used_bytes"],
    }),
    sequelize
      .query<CountRow>(
        `SELECT company_id, COALESCE(SUM(byte_size), 0)::bigint AS count
         FROM company_files WHERE company_id IN (:ids) GROUP BY company_id`,
        { replacements: { ids: companyIds }, type: QueryTypes.SELECT },
      )
      .catch(() => [] as CountRow[]),
  ]);

  for (const row of userRows) {
    const entry = map.get(Number(row.company_id));
    if (entry) entry.usersUsed = asInt(row.count);
  }
  for (const row of branchRows) {
    const entry = map.get(Number(row.company_id));
    if (entry) entry.branchesUsed = asInt(row.count);
  }
  const stored = new Map(
    companies.map((c) => [c.id, asInt(c.storage_used_bytes)]),
  );
  const files = new Map<number, number>();
  for (const row of fileRows) {
    files.set(Number(row.company_id), asInt(row.count));
  }
  for (const id of companyIds) {
    const entry = map.get(id);
    if (!entry) continue;
    entry.storageUsedBytes = Math.max(files.get(id) || 0, stored.get(id) || 0);
  }
  return map;
};

export const getCompaniesLastActive = async (
  companyIds: number[],
): Promise<Map<number, Date | null>> => {
  const map = new Map<number, Date | null>();
  if (!companyIds.length) return map;
  for (const id of companyIds) map.set(id, null);

  const rows = await sequelize.query<LastActiveRow>(
    `SELECT "companyId" AS company_id, MAX("lastLogin") AS last_login
     FROM users
     WHERE "companyId" IN (:ids) AND "lastLogin" IS NOT NULL
     GROUP BY "companyId"`,
    { replacements: { ids: companyIds }, type: QueryTypes.SELECT },
  );
  for (const row of rows) {
    map.set(
      Number(row.company_id),
      row.last_login ? new Date(row.last_login) : null,
    );
  }
  return map;
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
