import Stripe from "stripe";

let client: Stripe | null = null;

export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

const getClient = (): Stripe | null => {
  if (!isStripeConfigured()) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  return client;
};

export interface StripeCheckout {
  id: string;
  url: string | null;
}

/**
 * Creates a Stripe Checkout Session. Falls back to a dev session id + URL when
 * keys are not configured so local checkout still returns a valid session.
 */
export const createStripeCheckout = async (opts: {
  amount: number;
  currency: string;
  name: string;
  description: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
}): Promise<StripeCheckout> => {
  const successUrl =
    process.env.STRIPE_SUCCESS_URL ||
    "http://localhost:3000/super-admin/subscriptions?status=success";
  const cancelUrl =
    process.env.STRIPE_CANCEL_URL ||
    "http://localhost:3000/super-admin/subscriptions?status=cancelled";

  const stripe = getClient();
  if (!stripe) {
    const id = `cs_dev_${Date.now()}`;
    return { id, url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id=${id}` };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: opts.currency.toLowerCase(),
          unit_amount: Math.round(opts.amount * 100),
          product_data: { name: opts.name, description: opts.description },
        },
      },
    ],
    success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: opts.metadata,
    customer_email: opts.customerEmail,
  });

  return { id: session.id, url: session.url };
};

/**
 * Verifies + parses a Stripe webhook. When no secret is configured (dev), the
 * raw body is parsed without signature verification.
 */
export const constructStripeEvent = (
  rawBody: Buffer,
  signature?: string,
): Stripe.Event => {
  const stripe = getClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret || !signature) {
    return JSON.parse(rawBody.toString()) as Stripe.Event;
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
};
