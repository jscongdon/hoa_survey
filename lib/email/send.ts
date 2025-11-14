import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const fromName = process.env.HOA_NAME || 'HOA';
  const fromEmail = process.env.SMTP_FROM || 'noreply@hoa.local';
  
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
