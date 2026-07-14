import { roleToSlug, USER_ROLES } from "../database/models/role";

const SUPER_ADMIN_SLUGS = new Set([
  "super-admin",
  "system-admin",
  "super_admin",
  "system_admin",
]);

export const normalizeRoleSlug = (roleName?: string | null): string =>
  roleName ? roleToSlug(roleName) : "";

/** True when the role represents a platform Super Admin / System Admin. */
export const isSuperAdminRole = (roleName?: string | null): boolean => {
  if (!roleName) return false;
  if (roleName === USER_ROLES.SYSTEM_ADMIN) return true;
  const slug = normalizeRoleSlug(roleName);
  return (
    SUPER_ADMIN_SLUGS.has(slug) || SUPER_ADMIN_SLUGS.has(slug.replace(/_/g, "-"))
  );
};
