import PlatformAuditLog from "../database/models/platformAuditLog";

/** Writes a platform audit log row for a mutating Super Admin action. */
export const writeAudit = async (
  actorUserId: number | null | undefined,
  action: string,
  companyId?: number | null,
  meta?: Record<string, unknown>,
) => {
  try {
    await PlatformAuditLog.create({
      actor_user_id: actorUserId ?? null,
      action,
      company_id: companyId ?? null,
      meta: meta ?? null,
    });
  } catch (err) {
    // Audit logging must never break the primary operation.
    console.error("[audit] failed to write log:", (err as Error).message);
  }
};
