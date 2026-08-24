import { sendEmail } from "./emailService";

const emailProvider = () =>
  String(process.env.EMAIL_PROVIDER || "mock").toLowerCase();

const canSendRealEmail = () => {
  const p = emailProvider();
  return p !== "mock" && p !== "none" && p !== "";
};

const log = (channel: string, payload: Record<string, unknown>) => {
  console.log(`[notify:${channel}]`, payload);
};

const superAdminInbox = () =>
  process.env.SUPER_ADMIN_NOTIFY_EMAIL ||
  process.env.SUPER_ADMIN_EMAIL ||
  "superadmin@localhost";

const dispatchEmail = async (to: string, subject: string, html: string) => {
  if (!canSendRealEmail()) {
    log("email:mock", { to, subject });
    return;
  }
  await sendEmail({ to, subject, html });
};

export const notifyOnboardingReceived = async (opts: {
  email: string;
  name: string;
  refNo: string;
  businessName: string;
}) => {
  await dispatchEmail(
    opts.email,
    `RFQ Cloud application received (${opts.refNo})`,
    `<p>Namaste ${opts.name},</p>
     <p>We received your RFQ Cloud application for <strong>${opts.businessName}</strong>.</p>
     <p>Reference: <strong>${opts.refNo}</strong></p>
     <p>Our team will review it shortly.</p>`,
  );
  await dispatchEmail(
    superAdminInbox(),
    `New RFQ Cloud application ${opts.refNo}`,
    `<p>${opts.businessName} (${opts.email}) submitted ${opts.refNo}.</p>`,
  );
};

export const notifyOnboardingRejected = async (opts: {
  email: string;
  name: string;
  refNo: string;
  reason: string;
}) => {
  await dispatchEmail(
    opts.email,
    `RFQ Cloud application ${opts.refNo}`,
    `<p>Namaste ${opts.name},</p>
     <p>We could not approve application <strong>${opts.refNo}</strong>.</p>
     <p>${opts.reason}</p>`,
  );
};

export const notifySetupReady = async (opts: {
  email: string;
  name: string;
  whatsapp?: string | null;
  setupUrl: string;
  refNo: string;
}) => {
  await dispatchEmail(
    opts.email,
    "Your RFQ Cloud workspace is ready",
    `<p>Namaste ${opts.name},</p>
     <p>Your RFQ Cloud workspace is ready. Complete setup within 48 hours:</p>
     <p><a href="${opts.setupUrl}">${opts.setupUrl}</a></p>
     <p>Ref: ${opts.refNo}</p>`,
  );
  log("whatsapp:mock", {
    to: opts.whatsapp || null,
    text: `Namaste ${opts.name}, aapka RFQ Cloud workspace ready hai. Setup link (48h): ${opts.setupUrl}`,
  });
};
