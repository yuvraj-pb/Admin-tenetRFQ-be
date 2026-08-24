import { Request, Response } from "express";
import { successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { clientIp } from "../utils/clientIp";
import {
  createBillingCheckout,
  handleRazorpayWebhook,
  handleStripeWebhook,
  verifyBillingPayment,
} from "../services/billing/billingService";
import { verifyRazorpayWebhook } from "../services/billing/razorpay";
import { constructStripeEvent } from "../services/billing/stripe";

export const postCheckout = async (req: AuthRequest, res: Response) => {
  const data = await createBillingCheckout(req.body ?? {}, req.user?.id, clientIp(req));
  return successResponse(res, "Checkout created", data);
};

export const postVerify = async (req: AuthRequest, res: Response) => {
  const data = await verifyBillingPayment(req.body ?? {}, req.user?.id, clientIp(req));
  return successResponse(res, "Payment verified", data);
};

/**
 * Razorpay webhook. Secured by X-Razorpay-Signature (not Super Admin auth).
 * Expects the raw request body (registered before express.json).
 */
export const razorpayWebhook = async (req: Request, res: Response) => {
  const raw = req.body as Buffer;
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  if (!verifyRazorpayWebhook(raw, signature)) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }
  let event: any;
  try {
    event = JSON.parse(raw.toString());
  } catch {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }
  await handleRazorpayWebhook(event);
  return res.status(200).json({ received: true });
};

/**
 * Stripe webhook. Secured by Stripe-Signature (not Super Admin auth).
 * Expects the raw request body (registered before express.json).
 */
export const stripeWebhook = async (req: Request, res: Response) => {
  const raw = req.body as Buffer;
  const signature = req.headers["stripe-signature"] as string | undefined;
  let event: any;
  try {
    event = constructStripeEvent(raw, signature);
  } catch (err) {
    return res
      .status(400)
      .json({ success: false, message: `Webhook error: ${(err as Error).message}` });
  }
  await handleStripeWebhook(event);
  return res.status(200).json({ received: true });
};
