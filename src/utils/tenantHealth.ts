export type TenantHealth = "healthy" | "watch" | "critical";

export interface TenantHealthResult {
  health: TenantHealth;
  healthReasons: string[];
}

export interface HealthInput {
  status?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiresAt?: Date | string | null;
  usage?: {
    usersUsed?: number;
    storageUsedBytes?: number;
  } | null;
  limits?: {
    maxUsers?: number | null;
    maxBranches?: number | null;
    maxStorageBytes?: number | null;
  } | null;
}

const daysUntil = (value?: Date | string | null): number | null => {
  if (value == null) return null;
  const end = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
};

const usagePct = (used?: number | null, max?: number | null): number | null => {
  if (used == null || max == null || max <= 0) return null;
  return Math.min(100, Math.round((used / max) * 100));
};

/**
 * Server-side tenant health. Mirrors the frontend derivation so `?health=`
 * filters match the badges operators see.
 */
export const computeTenantHealth = (input: HealthInput): TenantHealthResult => {
  const reasons: string[] = [];
  const days = daysUntil(input.subscriptionExpiresAt);
  const usersPct = usagePct(input.usage?.usersUsed, input.limits?.maxUsers ?? null);
  const storagePct = usagePct(
    input.usage?.storageUsedBytes,
    input.limits?.maxStorageBytes ?? null,
  );

  if (input.status === "deleted") {
    return { health: "critical", healthReasons: ["Tenant is soft-deleted"] };
  }
  if (input.status === "suspended") reasons.push("Access is suspended");
  if (input.subscriptionStatus === "past_due") reasons.push("Payment past due");
  if (input.subscriptionStatus === "expired") reasons.push("Subscription expired");
  if (input.subscriptionStatus === "incomplete") reasons.push("Onboarding unpaid");
  if (days != null && days < 0) reasons.push("Renewal date has passed");
  else if (days != null && days <= 7) {
    reasons.push(`Renews in ${days} day${days === 1 ? "" : "s"}`);
  }
  if (usersPct != null && usersPct >= 95) reasons.push("Seat quota nearly full");
  if (storagePct != null && storagePct >= 95) reasons.push("Storage quota nearly full");
  if (input.status === "archived") reasons.push("Archived workspace");

  const isCritical =
    input.status === "suspended" ||
    input.subscriptionStatus === "past_due" ||
    input.subscriptionStatus === "expired" ||
    (days != null && days < 0);

  if (isCritical) {
    return {
      health: "critical",
      healthReasons: reasons.length ? reasons : ["Needs immediate action"],
    };
  }

  const isWatch =
    reasons.length > 0 ||
    input.subscriptionStatus === "incomplete" ||
    input.subscriptionStatus === "trialing" ||
    (days != null && days <= 14) ||
    (usersPct != null && usersPct >= 80) ||
    (storagePct != null && storagePct >= 80);

  if (isWatch) {
    return {
      health: "watch",
      healthReasons: reasons.length ? reasons : ["Needs review"],
    };
  }

  return { health: "healthy", healthReasons: ["Operating normally"] };
};

/** Dashboard "at risk": past_due OR incomplete OR expired OR renews within 14d OR suspended. */
export const isAtRiskTenant = (input: HealthInput): boolean => {
  if (input.status === "deleted") return false;
  if (input.status === "suspended") return true;
  const status = input.subscriptionStatus;
  if (status === "past_due" || status === "incomplete" || status === "expired") {
    return true;
  }
  const days = daysUntil(input.subscriptionExpiresAt);
  return days != null && days <= 14;
};
