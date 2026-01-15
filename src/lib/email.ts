import nodemailer from 'nodemailer'
import { serverLogger } from '@/lib/server-logger'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@balancebeacon.com'

// APP_URL validation: require HTTPS in production
const _rawAppUrl = process.env.APP_URL || 'http://localhost:3000'
if (process.env.NODE_ENV === 'production' && _rawAppUrl.startsWith('http://')) {
  throw new Error('APP_URL must use HTTPS in production')
}
const APP_URL = _rawAppUrl

/**
 * Escape HTML special characters for safe insertion into HTML attributes and content
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Check if email is configured
const isEmailConfigured = SMTP_HOST && SMTP_USER && SMTP_PASS

// Create transporter only if configured
const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null

export interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
  // Development mode: output to stderr if SMTP not configured
  if (!transporter) {
    const output = [
      '\n========== EMAIL (dev mode - SMTP not configured) ==========',
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      `Text: ${options.text}`,
      '=============================================================\n',
    ].join('\n')
    process.stderr.write(output)
    return { success: true, messageId: 'dev-mode-no-send' }
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    serverLogger.error(
      'Failed to send email',
      { action: 'sendEmail', input: { to: options.to, subject: options.subject } },
      error,
    )
    return { success: false }
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<{ success: boolean; messageId?: string }> {
  const verificationUrl = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`
  const safeUrl = escapeHtml(verificationUrl)

  return sendEmail({
    to,
    subject: 'Verify your email address - Balance Beacon',
    text: `Welcome to Balance Beacon!\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to Balance Beacon!</h1>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="margin: 24px 0;">
          <a href="${safeUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email Address
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${safeUrl}" style="color: #0070f3;">${safeUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
