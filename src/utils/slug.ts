import { Op } from "sequelize";
import Company from "../database/models/company";

/** URL-safe handle from a company name. */
export const slugify = (value: string): string => {
  const slug = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "tenant";
};

export const isValidSlug = (value: string): boolean =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;

/**
 * Returns a unique slug. If `preferred` is taken by another company, the
 * caller should 409 — this helper is for auto-generation only.
 */
export const allocateUniqueSlug = async (
  companyName: string,
  excludeCompanyId?: number,
  transaction?: import("sequelize").Transaction,
): Promise<string> => {
  const base = slugify(companyName);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await Company.findOne({
      where: {
        slug: candidate,
        ...(excludeCompanyId
          ? { id: { [Op.ne]: excludeCompanyId } }
          : {}),
      },
      attributes: ["id"],
      transaction,
    });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};
