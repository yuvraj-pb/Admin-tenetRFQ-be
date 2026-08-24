import crypto from "crypto";
import { httpError } from "../utils/httpError";
import { INDIAN_MOBILE, normalizeIndianMobile } from "../utils/onboardingMaps";

type Challenge = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

type Verified = { expiresAt: number };

const OTP_TTL_MS = 10 * 60 * 1000;
const VERIFIED_TTL_MS = 30 * 60 * 1000;
const RESEND_GAP_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

const challenges = new Map<string, Challenge>();
const verified = new Map<string, Verified>();
const lastSent = new Map<string, number>();

const hashCode = (mobile: string, code: string) =>
  crypto.createHash("sha256").update(`${mobile}:${code}`).digest("hex");

const sixDigit = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

const otpProvider = () =>
  String(process.env.OTP_PROVIDER || "mock").toLowerCase();

const sendViaMsg91 = async (mobile: string, code: string) => {
  const key = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!key || !templateId) {
    throw httpError("OTP provider is not configured", 503);
  }
  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      authkey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile: `91${mobile}`,
      otp: code,
    }),
  });
  if (!res.ok) {
    throw httpError("Failed to send OTP", 502);
  }
};

export const sendOtp = async (rawMobile: unknown) => {
  const mobile = normalizeIndianMobile(rawMobile);
  if (!mobile || !INDIAN_MOBILE.test(mobile)) {
    throw httpError("Enter a valid 10-digit Indian mobile number", 400);
  }

  const now = Date.now();
  const previous = lastSent.get(mobile) || 0;
  if (now - previous < RESEND_GAP_MS) {
    throw httpError("Please wait before requesting another OTP", 429);
  }

  const code = sixDigit();
  challenges.set(mobile, {
    codeHash: hashCode(mobile, code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
  });
  lastSent.set(mobile, now);

  const provider = otpProvider();
  if (provider === "msg91") {
    await sendViaMsg91(mobile, code);
  } else {
    console.log(`[otp:mock] ${mobile} code=${code} (10 min)`);
  }

  return {
    mobile,
    expiresInSec: OTP_TTL_MS / 1000,
    ...(provider === "mock" ? { devCode: code } : {}),
  };
};

export const verifyOtp = (rawMobile: unknown, rawCode: unknown) => {
  const mobile = normalizeIndianMobile(rawMobile);
  const code = String(rawCode || "").trim();
  if (!mobile) throw httpError("Enter a valid 10-digit Indian mobile number", 400);
  if (!/^\d{6}$/.test(code)) throw httpError("Invalid or expired OTP", 400);

  const row = challenges.get(mobile);
  if (!row || row.expiresAt < Date.now()) {
    challenges.delete(mobile);
    throw httpError("Invalid or expired OTP", 400);
  }
  row.attempts += 1;
  if (row.attempts > MAX_ATTEMPTS) {
    challenges.delete(mobile);
    throw httpError("Invalid or expired OTP", 400);
  }
  if (row.codeHash !== hashCode(mobile, code)) {
    throw httpError("Invalid or expired OTP", 400);
  }

  challenges.delete(mobile);
  verified.set(mobile, { expiresAt: Date.now() + VERIFIED_TTL_MS });
  return { mobile, verified: true };
};

export const isMobileOtpVerified = (rawMobile: unknown): boolean => {
  const mobile = normalizeIndianMobile(rawMobile);
  if (!mobile) return false;
  const row = verified.get(mobile);
  if (!row || row.expiresAt < Date.now()) {
    if (row) verified.delete(mobile);
    return false;
  }
  return true;
};

export const consumeMobileOtpVerified = (rawMobile: unknown): boolean => {
  const mobile = normalizeIndianMobile(rawMobile);
  if (!mobile) return false;
  const ok = isMobileOtpVerified(mobile);
  if (ok) verified.delete(mobile);
  return ok;
};
