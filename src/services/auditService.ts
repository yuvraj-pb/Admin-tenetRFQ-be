import PlatformAuditLog from "../database/models/platformAuditLog";
import User from "../database/models/user";

export interface WriteAuditInput {
  actorUserId?: number | null;
  action: string;
  companyId?: number | null;
  reason?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown> | null;
}

/** Writes a platform audit log row for a mutating Super Admin action. */
export const writeAudit = async (
  actorUserIdOrInput: number | null | undefined | WriteAuditInput,
  action?: string,
  companyId?: number | null,
  meta?: Record<string, unknown>,
) => {
  const input: WriteAuditInput =
    actorUserIdOrInput && typeof actorUserIdOrInput === "object"
      ? actorUserIdOrInput
      : {
          actorUserId: actorUserIdOrInput as number | null | undefined,
          action: action || "unknown",
          companyId,
          meta: meta ?? null,
          reason:
            meta && typeof meta.reason === "string" ? meta.reason : undefined,
        };

  try {
    await PlatformAuditLog.create({
      actor_user_id: input.actorUserId ?? null,
      action: input.action,
      company_id: input.companyId ?? null,
      reason: input.reason ?? null,
      ip_address: input.ip ?? null,
      meta: input.meta ?? null,
    });
  } catch (err) {
    // Audit logging must never break the primary operation.
    console.error("[audit] failed to write log:", (err as Error).message);
  }
};

export const listCompanyAudit = async (
  companyId: number,
  query: Record<string, any>,
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const { rows, count } = await PlatformAuditLog.findAndCountAll({
    where: { company_id: companyId },
    include: [
      {
        model: User,
        as: "actor",
        attributes: ["id", "name"],
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  const data = rows.map((row) => ({
    actorName: row.actor?.name || "System",
    action: row.action,
    reason: row.reason || (row.meta as any)?.reason || null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt,
  }));

  return { data, page, limit, total: count };
};
