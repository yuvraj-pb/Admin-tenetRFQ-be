import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

let sesClient: SESClient | null = null;

const getSesClient = () => {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.SES_REGION || process.env.AWS_REGION,
      credentials: {
        accessKeyId:
          process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey:
          process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return sesClient;
};

/**
 * Best-effort transactional email. Returns true only when the message was
 * actually dispatched. With MAIL_PROVIDER=none (default) it is a no-op so
 * temp passwords fall back to the API response.
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  const provider = (process.env.MAIL_PROVIDER || "none").toLowerCase();

  if (provider === "none") return false;

  if (provider === "ses") {
    if (!process.env.S3_ACCESS_KEY && !process.env.AWS_ACCESS_KEY_ID) {
      console.warn("[email] SES selected but no credentials — skipped send");
      return false;
    }
    try {
      await getSesClient().send(
        new SendEmailCommand({
          Destination: { ToAddresses: [options.to] },
          Message: {
            Body: { Html: { Charset: "UTF-8", Data: options.html } },
            Subject: { Charset: "UTF-8", Data: options.subject },
          },
          Source:
            options.from ||
            process.env.SES_FROM_EMAIL ||
            process.env.SENDER_EMAIL ||
            "no-reply@potatobazaar.com",
        }),
      );
      return true;
    } catch (err) {
      console.error("[email] SES send failed:", (err as Error).message);
      return false;
    }
  }

  // sendgrid or any other provider not wired in v1
  console.warn(`[email] provider "${provider}" not implemented — skipped send`);
  return false;
};

export const credentialsEmailHtml = (opts: {
  name: string;
  email: string;
  password: string;
  companyName: string;
  loginUrl: string;
}) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
    <h2>Welcome to Advance RFQ</h2>
    <p>Hello ${opts.name},</p>
    <p>A company admin account has been created for <strong>${opts.companyName}</strong>.</p>
    <p>
      <strong>Email:</strong> ${opts.email}<br/>
      <strong>Temporary password:</strong> ${opts.password}
    </p>
    <p>Please sign in and change your password: <a href="${opts.loginUrl}">${opts.loginUrl}</a></p>
  </div>
`;

export const resetPasswordEmailHtml = (opts: {
  name: string;
  password: string;
}) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
    <p>Hello ${opts.name},</p>
    <p>Your temporary password is: <strong>${opts.password}</strong></p>
    <p>Please change it immediately after signing in.</p>
  </div>
`;
