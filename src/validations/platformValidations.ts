import Joi from "joi";
import { createValidator } from "express-joi-validation";

export const validator = createValidator({ passError: false });

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
}).unknown(true);

export const changePlanSchema = Joi.object({
  planId: Joi.number().integer().required(),
  billingInterval: billingInterval.required(),
  paymentProvider: paymentProvider.required(),
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
