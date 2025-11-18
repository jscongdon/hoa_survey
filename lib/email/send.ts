import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'

let cachedConfig: any = null
let cacheTime = 0
const CACHE_TTL = 60000 // Cache for 1 minute

async function getEmailConfig() {
  // Use cache to avoid database queries on every email
  if (cachedConfig && Date.now() - cacheTime < CACHE_TTL) {
    return cachedConfig
  }

  const config = await prisma.systemConfig.findUnique({
    where: { id: 'system' }
  })

  if (config && config.smtpHost) {
    cachedConfig = config
    cacheTime = Date.now()
    return config
  }

  // Fallback to environment variables if no database config
  return {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM,
    hoaName: process.env.HOA_NAME || 'HOA'
  }
}

async function createTransporter() {
  const config = await getEmailConfig()
  
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  })
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const config = await getEmailConfig()
  const transporter = await createTransporter()
  const fromName = config.hoaName || 'HOA'
  const fromEmail = config.smtpFrom || 'noreply@hoa.local'
  
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    ...options,
  })
}

export function generateSurveyEmail(
  surveyTitle: string,
  surveyDescription: string,
  surveyLink: string,
  lot: string,
  name: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Survey for Lot ${lot} – ${name}</h2>
      <p>${surveyDescription || ''}</p>
      <p>
        <a href="${surveyLink}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Take Survey
        </a>
      </p>
      <hr />
      <p style="font-size: 12px; color: #666;">
        This survey is sent to you as a resident of your HOA community. Please do not share this link.
      </p>
    </div>
  `
}
