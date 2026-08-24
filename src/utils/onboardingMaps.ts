import { MODULE_FLAG_KEYS, ModuleFlagKey } from "./entitlements";

export const TEMPLATE_IDS = [
  "procurement",
  "suppliers",
  "operations",
  "control",
  "full-rfq",
] as const;

export const MARKETING_PLANS = ["starter", "growth", "enterprise"] as const;
export type MarketingPlan = (typeof MARKETING_PLANS)[number];

export const INDIAN_MOBILE = /^[6-9]\d{9}$/;
export const PINCODE = /^\d{6}$/;
export const GSTIN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

export const marketingToCatalog: Record<MarketingPlan, string> = {
  starter: "basic",
  growth: "professional",
  enterprise: "enterprise",
};

export const catalogToMarketing = (code?: string | null): MarketingPlan => {
  if (code === "professional") return "growth";
  if (code === "enterprise") return "enterprise";
  return "starter";
};

export const normalizeIndianMobile = (raw: unknown): string | null => {
  const digits = String(raw || "").replace(/\D/g, "");
  const ten =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  return INDIAN_MOBILE.test(ten) ? ten : null;
};

export const panFromGstin = (gstin?: string | null): string => {
  if (!gstin || gstin.length < 12) return "";
  return gstin.slice(2, 12);
};

export const flagsFromModules = (modules: string[]) => {
  const set = new Set(modules);
  const flags = {} as Record<ModuleFlagKey, boolean>;
  for (const key of MODULE_FLAG_KEYS) {
    flags[key] = set.has(key);
  }
  return flags;
};

export const tenantAppOrigin = () =>
  (process.env.TENANT_APP_ORIGIN || "http://localhost:3000").replace(/\/$/, "");

export const setupUrlForToken = (rawToken: string) =>
  `${tenantAppOrigin()}/setup?token=${rawToken}`;

export const whatsappSetupMessage = (name: string, url: string) =>
  `Namaste ${name}, aapka RFQ Cloud workspace ready hai. Setup link (48h): ${url}`;
