import Joi from "joi";
import { createValidator } from "express-joi-validation";

export const validator = createValidator({ passError: false });

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().min(1).required(),
});

export const cancelSubscriptionSchema = Joi.object({
  atPeriodEnd: Joi.boolean().required(),
});

const billingInterval = Joi.string().valid("monthly", "yearly");
const paymentProvider = Joi.string().valid("razorpay", "stripe");

export const createCompanySchema = Joi.object({
  companyName: Joi.string().trim().min(1).required(),
  legalName: Joi.string().trim().allow("", null),
  email: Joi.string().email().required(),
  phone: Joi.string().trim().allow("", null),
  gstNumber: Joi.string().trim().allow("", null),
  addressLine: Joi.string().trim().allow("", null),
  city: Joi.string().trim().allow("", null),
  state: Joi.string().trim().allow("", null),
  country: Joi.string().trim().allow("", null),
  planId: Joi.number().integer().required(),
  billingInterval: billingInterval.required(),
  companyAdmin: Joi.object({
    name: Joi.string().trim().min(1).required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().trim().allow("", null),
    password: Joi.string().min(6).allow("", null),
  }).required(),
  collectPayment: Joi.boolean(),
  paymentProvider: paymentProvider,
  slug: Joi.string().trim().allow("", null),
  region: Joi.string().trim().allow("", null),
  timezone: Joi.string().trim().allow("", null),
  tags: Joi.array().items(Joi.string().trim().max(64)).max(50),
}).unknown(true);

export const updateCompanySchema = Joi.object({
  companyName: Joi.string().trim().min(1),
  legalName: Joi.string().trim().allow("", null),
  email: Joi.string().email(),
  phone: Joi.string().trim().allow("", null),
  gstNumber: Joi.string().trim().allow("", null),
  addressLine: Joi.string().trim().allow("", null),
  city: Joi.string().trim().allow("", null),
  state: Joi.string().trim().allow("", null),
  country: Joi.string().trim().allow("", null),
  slug: Joi.string().trim().allow("", null),
  region: Joi.string().trim().allow("", null),
  timezone: Joi.string().trim().allow("", null),
}).unknown(true);

export const notesSchema = Joi.object({
  internalNotes: Joi.string().allow("", null),
  tags: Joi.array().items(Joi.string().trim().max(64)).max(50),
}).or("internalNotes", "tags");

export const changePlanSchema = Joi.object({
  planId: Joi.number().integer().required(),
  billingInterval: billingInterval.required(),
  paymentProvider: paymentProvider.required(),
}).unknown(true);

export const grantSchema = Joi.object({
  planId: Joi.number().integer(),
  billingInterval: billingInterval.required(),
  reason: Joi.string().allow("", null),
  restoreAccess: Joi.boolean(),
}).unknown(true);

export const renewSchema = Joi.object({
  billingInterval: billingInterval.required(),
  paymentProvider: paymentProvider.required(),
}).unknown(true);

export const checkoutSchema = Joi.object({
  companyId: Joi.number().integer().required(),
  planId: Joi.number().integer().required(),
  billingInterval: billingInterval.required(),
  paymentProvider: paymentProvider.required(),
  purpose: Joi.string().valid("new", "renew", "upgrade", "downgrade"),
}).unknown(true);

export const verifySchema = Joi.object({
  provider: paymentProvider.required(),
  sessionId: Joi.string(),
  razorpayOrderId: Joi.string(),
  razorpayPaymentId: Joi.string(),
  razorpaySignature: Joi.string(),
}).unknown(true);

export const updateFeaturesSchema = Joi.object({
  features: Joi.object().unknown(true),
  flags: Joi.object().unknown(true),
  quotas: Joi.object({
    maxUsers: Joi.number().integer().min(0).allow(null),
    maxBranches: Joi.number().integer().min(0).allow(null),
    maxStorageBytes: Joi.number().integer().min(0).allow(null),
    maxRfqsPerMonth: Joi.number().integer().min(0).allow(null),
    maxSuppliers: Joi.number().integer().min(0).allow(null),
    maxCustomRoles: Joi.number().integer().min(0).allow(null),
  }),
  resetToPlan: Joi.boolean(),
  reason: Joi.string().allow("", null),
  expiresAt: Joi.string().allow("", null),
  targetKey: Joi.string().allow("", null),
}).or("features", "flags", "quotas", "resetToPlan");

const featureFlags = Joi.object().unknown(true);
const quotaNull = Joi.number().integer().min(0).allow(null);

export const createLeadSchema = Joi.object({
  companyName: Joi.string().trim().min(1).required(),
  contactName: Joi.string().trim().min(1).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().trim().allow("", null),
  city: Joi.string().trim().allow("", null),
  state: Joi.string().trim().allow("", null),
  notes: Joi.string().allow("", null),
  requestedFeatures: Joi.array().items(Joi.string()),
  requestedUsers: Joi.number().integer().min(0).allow(null),
  requestedBranches: Joi.number().integer().min(0).allow(null),
  source: Joi.string().valid(
    "landing",
    "manual",
    "referral",
    "inbound_call",
    "other",
  ),
}).unknown(true);

export const updateLeadSchema = Joi.object({
  status: Joi.string().valid(
    "new",
    "assigned",
    "contacted",
    "trial",
    "negotiating",
    "won",
    "lost",
  ),
  assignedToId: Joi.number().integer().allow(null),
  assignedToName: Joi.string().trim().allow("", null),
  notes: Joi.string().allow("", null),
  requestedFeatures: Joi.array().items(Joi.string()),
  requestedUsers: Joi.number().integer().min(0).allow(null),
  requestedBranches: Joi.number().integer().min(0).allow(null),
  nextFollowUpAt: Joi.string().allow("", null),
}).unknown(true);

export const assignLeadSchema = Joi.object({
  assignedToId: Joi.number().integer().allow(null),
  assignedToName: Joi.string().trim().allow("", null),
}).unknown(true);

export const leadCallSchema = Joi.object({
  outcome: Joi.string()
    .valid("connected", "no_answer", "callback", "wrong_number", "voicemail")
    .required(),
  notes: Joi.string().allow("", null),
  nextFollowUpAt: Joi.string().allow("", null),
}).unknown(true);

export const startTrialSchema = Joi.object({
  trialDays: Joi.number().integer().min(1).max(365),
  trainingIncluded: Joi.boolean(),
  notes: Joi.string().allow("", null),
  features: featureFlags,
  requestedFeatures: Joi.array().items(Joi.string()),
  maxUsers: quotaNull,
  maxBranches: quotaNull,
  maxStorageBytes: quotaNull,
}).unknown(true);

export const convertLeadSchema = Joi.object({
  quoteId: Joi.number().integer(),
  planId: Joi.number().integer(),
  billingInterval: billingInterval,
  collectPayment: Joi.boolean(),
  paymentProvider: Joi.string().valid("razorpay", "stripe", "owner"),
  grantWithoutPayment: Joi.boolean(),
  reason: Joi.string().allow("", null),
}).unknown(true);

export const upsertPlanSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  description: Joi.string().allow("", null),
  priceMonthly: Joi.number().min(0),
  priceYearly: Joi.number().min(0),
  currency: Joi.string().trim(),
  maxUsers: quotaNull,
  maxBranches: quotaNull,
  maxStorageBytes: quotaNull,
  features: featureFlags,
  kind: Joi.string().valid("catalog", "custom", "trial"),
  negotiable: Joi.boolean(),
  trialDays: Joi.number().integer().min(1).max(365).allow(null),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer(),
  code: Joi.string().trim().allow("", null),
  companyId: Joi.number().integer().allow(null),
}).unknown(true);

export const updatePlanSchema = upsertPlanSchema.fork("name", (s) =>
  s.optional(),
);

export const createQuoteSchema = Joi.object({
  leadId: Joi.number().integer().allow(null),
  companyId: Joi.number().integer().allow(null),
  name: Joi.string().trim().min(1),
  billingInterval: billingInterval,
  amount: Joi.number().min(0),
  currency: Joi.string().trim(),
  features: featureFlags,
  maxUsers: quotaNull,
  maxBranches: quotaNull,
  maxStorageBytes: quotaNull,
  notes: Joi.string().allow("", null),
  validUntil: Joi.string().allow("", null),
})
  .or("leadId", "companyId")
  .unknown(true);

export const updateQuoteSchema = Joi.object({
  leadId: Joi.number().integer().allow(null),
  companyId: Joi.number().integer().allow(null),
  name: Joi.string().trim().min(1),
  billingInterval: billingInterval,
  amount: Joi.number().min(0),
  currency: Joi.string().trim(),
  features: featureFlags,
  maxUsers: quotaNull,
  maxBranches: quotaNull,
  maxStorageBytes: quotaNull,
  notes: Joi.string().allow("", null),
  validUntil: Joi.string().allow("", null),
}).unknown(true);

export const acceptQuoteSchema = Joi.object({
  collectPayment: Joi.boolean(),
  paymentProvider: Joi.string().valid("razorpay", "stripe", "owner"),
  grantWithoutPayment: Joi.boolean(),
  billingInterval: billingInterval,
  reason: Joi.string().allow("", null),
}).unknown(true);

export const rejectQuoteSchema = Joi.object({
  reason: Joi.string().allow("", null),
}).unknown(true);

export const otpSendSchema = Joi.object({
  mobile: Joi.string().required(),
}).unknown(true);

export const otpVerifySchema = Joi.object({
  mobile: Joi.string().required(),
  code: Joi.string().pattern(/^\d{6}$/).required(),
}).unknown(true);

export const publicOnboardingSchema = Joi.object({
  website: Joi.string().allow("", null),
  templateId: Joi.string(),
  businessName: Joi.string(),
  businessType: Joi.string(),
  yearEstablished: Joi.number().integer().allow(null),
  gstin: Joi.string().allow("", null),
  address: Joi.string().allow("", null),
  state: Joi.string(),
  district: Joi.string(),
  pincode: Joi.string(),
  contactName: Joi.string(),
  mobile: Joi.string(),
  email: Joi.string(),
  whatsapp: Joi.string().allow("", null),
  language: Joi.string().valid("en", "hi", "gu"),
  scaleData: Joi.object().unknown(true),
  requestedPlan: Joi.string(),
  billingCycle: Joi.string(),
  acceptedTerms: Joi.boolean(),
  otpVerified: Joi.boolean(),
}).unknown(true);

export const setupCompleteSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
}).unknown(true);

export const onboardingNoteSchema = Joi.object({
  body: Joi.string().trim().min(1).required(),
}).unknown(true);

export const onboardingRejectSchema = Joi.object({
  reason: Joi.string().trim().min(1).required(),
}).unknown(true);

export const onboardingApproveSchema = Joi.object({
  planCode: Joi.string().valid("starter", "growth", "enterprise"),
  billingCycle: Joi.string().valid("monthly", "yearly"),
  priceOverride: Joi.number().min(0).allow(null),
  trialDays: Joi.number().integer().min(0).max(30),
  modules: Joi.array().items(Joi.string()),
  maxUsers: Joi.number().integer().min(0).allow(null),
  maxBranches: Joi.number().integer().min(0).allow(null),
  maxStorageBytes: Joi.number().integer().min(0).allow(null),
  startDate: Joi.string().allow("", null),
  allocation: Joi.object().unknown(true),
}).unknown(true);
