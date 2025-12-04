import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { sanitizeSurveyHtml } from "@/lib/sanitizeHtml";

let cachedConfig: any = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // Cache for 1 minute

export async function getEmailConfig() {
  // Use cache to avoid database queries on every email
  if (cachedConfig && Date.now() - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  const config = await prisma.systemConfig.findUnique({
    where: { id: "system" },
  });

  if (config && config.smtpHost) {
    cachedConfig = config;
    cacheTime = Date.now();
    return config;
  }

  // Fallback to environment variables if no database config
  return {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM,
    hoaName: process.env.HOA_NAME || "HOA",
  };
}

// Return the configured application URL used in generated email links.
export async function getAppUrl(): Promise<string | null> {
  const cfg = await getEmailConfig();
  // Prefer explicit appUrl, otherwise null
  return cfg?.appUrl || null;
}

export async function createTransporter() {
  const config = await getEmailConfig();

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(
  options: EmailOptions,
  transporter?: nodemailer.Transporter
): Promise<void> {
  const config = await getEmailConfig();
  const t = transporter ?? (await createTransporter());
  const fromName = config.hoaName || "HOA";
  const fromEmail = config.smtpFrom || "noreply@hoa.local";

  await t.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    ...options,
  });
}

export interface BulkEmailOptions {
  batchSize?: number; // number of emails per batch (concurrency per batch)
  delayMsBetweenBatches?: number; // ms to wait between batches
  retryCount?: number; // how many times to retry a failed email
  retryDelayMs?: number; // delay between retries
  transporter?: any; // optional transporter override for tests or pooling
}

export interface BulkEmailResult {
  to: string;
  ok: boolean;
  error?: any;
  meta?: any;
}

export async function sendBulkEmails(
  items: Array<{ options: EmailOptions; meta?: any }>,
  opts?: BulkEmailOptions
): Promise<BulkEmailResult[]> {
  const batchSize = opts?.batchSize ?? 25;
  const delayMsBetweenBatches = opts?.delayMsBetweenBatches ?? 1000;
  const retryCount = opts?.retryCount ?? 1;
  const retryDelayMs = opts?.retryDelayMs ?? 500;

  const transporter = opts?.transporter ?? (await createTransporter());
  const results: BulkEmailResult[] = [];

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    // send the whole batch in parallel (concurrency batchSize)
    const sendPromises = batch.map(async (it) => {
      let attempts = 0;
      while (attempts <= retryCount) {
        try {
          await sendEmail(it.options, transporter);
          return { to: it.options.to, ok: true, meta: it.meta } as BulkEmailResult;
        } catch (e) {
          attempts += 1;
          if (attempts > retryCount) {
            return { to: it.options.to, ok: false, error: String(e), meta: it.meta } as BulkEmailResult;
          }
          // wait a bit before retry
          await sleep(retryDelayMs);
        }
      }
      // fallback
      return { to: it.options.to, ok: false, error: "Unknown error", meta: it.meta } as BulkEmailResult;
    });

    const settled = await Promise.all(sendPromises);
    results.push(...settled);

    // delay between batches when there are more
    if (i + batchSize < items.length && delayMsBetweenBatches > 0) {
      await sleep(delayMsBetweenBatches);
    }
  }

  // try to close transporter connection pool if available
  try {
    (transporter as any).close?.();
  } catch (e) {
    // ignore
  }

  return results;
}

export interface PrimaryButton {
  text: string;
  url: string;
  bgColor?: string;
}

/**
 * Generate a consistent HTML email layout used across the app.
 * - title: heading shown at top
 * - greetingHtml: personalized greeting (e.g. `Hello ${name},`)
 * - bodyHtml: main body HTML (already escaped/validated by caller)
 * - primary: optional primary CTA button
 * - footerNote: small footer text
 */
export function generateBaseEmail(
  title: string,
  greetingHtml: string,
  bodyHtml: string,
  primary?: PrimaryButton,
  footerNote?: string
): string {
  const primaryHtml = primary
    ? `<div style="text-align: center; margin: 30px 0;">
        <a href="${primary.url}" style="background-color: ${primary.bgColor || "#2563eb"}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">${primary.text}</a>
      </div>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 8px;">
      <h2 style="color: #2563eb; margin-bottom: 6px;">${title}</h2>
      ${greetingHtml}
      <div style="margin-top: 12px;">${bodyHtml}</div>
      ${primaryHtml}
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 12px;">${footerNote || "This is an automated email. Please do not reply directly to this message."}</p>
    </div>
  `;
}

export function generateSurveyEmail(
  surveyTitle: string,
  surveyDescription: string,
  surveyLink: string,
  lot: string,
  name: string
): string {
  const title = `Survey for Lot ${lot} – ${name}`;
  const displayName = name || "Resident";
  const greeting = `<p style="margin-bottom:8px;">Hello ${displayName},</p>`;

  const bodyParts: string[] = [];
  const sanitized = surveyDescription
    ? sanitizeSurveyHtml(String(surveyDescription))
    : "";
  if (sanitized) bodyParts.push(`<p>${sanitized}</p>`);
  bodyParts.push(
    `<p>Our records show that the resident of <strong>Lot ${lot}</strong> has not yet completed the survey "${surveyTitle}". Please take a few minutes to complete it by clicking the button below.</p>`
  );
  bodyParts.push(
    `<p style="margin-top:8px;">If you have already completed the survey, please disregard this reminder. This message is not monitored. If you need assistance, please contact your HOA administrator.</p>`
  );

  const body = bodyParts.join("\n");

  return generateBaseEmail(
    title,
    greeting,
    body,
    { text: "Take Survey", url: surveyLink, bgColor: undefined },
    "This survey is sent to you as a resident of your HOA community. Please do not share this link."
  );
}
