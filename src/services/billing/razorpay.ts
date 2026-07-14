import crypto from "crypto";
import Razorpay from "razorpay";

let client: Razorpay | null = null;

export const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const getClient = (): Razorpay | null => {
  if (!isRazorpayConfigured()) return null;
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });
  }
  return client;
};

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/**
 * Creates a Razorpay order. Falls back to a deterministic dev order id when
 * keys are not configured so local checkout still returns a valid session.
 */
export const createRazorpayOrder = async (opts: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string | number>;
}): Promise<RazorpayOrder> => {
  const rzp = getClient();
  if (!rzp) {
    return {
      id: `order_dev_${Date.now()}`,
      amount: opts.amountPaise,
      currency: opts.currency,
    };
  }
  const order = await rzp.orders.create({
    amount: opts.amountPaise,
    currency: opts.currency,
    receipt: opts.receipt,
    notes: opts.notes,
  });
  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
};

/** Verifies the checkout signature returned by Razorpay Checkout. */
export const verifyRazorpayPaymentSignature = (opts: {
  orderId: string;
  paymentId: string;
  signature?: string;
}): boolean => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  // Dev mode (no secret): accept so local flows can complete.
  if (!secret) return true;
  if (!opts.signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(opts.signature),
  );
};

/** Verifies the X-Razorpay-Signature header on a webhook payload. */
export const verifyRazorpayWebhook = (rawBody: Buffer, signature?: string) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
};
