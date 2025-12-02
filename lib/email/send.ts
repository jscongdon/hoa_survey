import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import DOMPurify from "isomorphic-dompurify";

let cachedConfig: any = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // Cache for 1 minute

async function getEmailConfig() {
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

async function createTransporter() {
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

export async function sendEmail(options: EmailOptions): Promise<void> {
  const config = await getEmailConfig();
  const transporter = await createTransporter();
  const fromName = config.hoaName || "HOA";
  const fromEmail = config.smtpFrom || "noreply@hoa.local";

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    ...options,
  });
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
    ? DOMPurify.sanitize(String(surveyDescription), {
        ALLOWED_TAGS: [
          "p",
          "br",
          "b",
          "i",
          "em",
          "strong",
          "u",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "blockquote",
          "a",
        ],
        ALLOWED_ATTR: ["href", "target", "rel"],
      })
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
