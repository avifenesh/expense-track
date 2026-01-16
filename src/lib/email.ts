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

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<{ success: boolean; messageId?: string }> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`
  const safeUrl = escapeHtml(resetUrl)

  return sendEmail({
    to,
    subject: 'Reset your password - Balance Beacon',
    text: `You requested a password reset for your Balance Beacon account.\n\nClick the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email. Your password will not be changed.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Reset your password</h1>
        <p>You requested a password reset for your Balance Beacon account.</p>
        <p style="margin: 24px 0;">
          <a href="${safeUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${safeUrl}" style="color: #0070f3;">${safeUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          If you didn't request this, you can safely ignore this email. Your password will not be changed.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordChangedEmail(to: string): Promise<{ success: boolean; messageId?: string }> {
  return sendEmail({
    to,
    subject: 'Your password was changed - Balance Beacon',
    text: `Your Balance Beacon password was successfully changed.\n\nIf you did not make this change, please contact support immediately.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password changed</h1>
        <p>Your Balance Beacon password was successfully changed.</p>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          If you did not make this change, please contact support immediately.
        </p>
      </div>
    `,
  })
}

export interface ExpenseSharedEmailOptions {
  to: string
  participantName: string
  ownerName: string
  amount: number
  totalAmount: number
  currency: string
  description: string
}

export async function sendExpenseSharedEmail(
  options: ExpenseSharedEmailOptions,
): Promise<{ success: boolean; messageId?: string }> {
  const safeOwnerName = escapeHtml(options.ownerName)
  const safeDescription = escapeHtml(options.description)
  const formattedAmount = formatEmailCurrency(options.amount, options.currency)
  const formattedTotal = formatEmailCurrency(options.totalAmount, options.currency)
  const dashboardUrl = `${APP_URL}/`
  const safeDashboardUrl = escapeHtml(dashboardUrl)

  return sendEmail({
    to: options.to,
    subject: `${options.ownerName} shared an expense with you - Balance Beacon`,
    text: `Hi ${options.participantName},\n\n${options.ownerName} has shared an expense with you.\n\nExpense: ${options.description}\nTotal amount: ${formattedTotal}\nYour share: ${formattedAmount}\n\nLog in to Balance Beacon to view the details and mark it as paid when you settle up.\n\n${dashboardUrl}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Shared Expense</h1>
        <p>Hi ${escapeHtml(options.participantName)},</p>
        <p><strong>${safeOwnerName}</strong> has shared an expense with you.</p>
        <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Expense:</strong> ${safeDescription}</p>
          <p style="margin: 0 0 8px 0;"><strong>Total amount:</strong> ${formattedTotal}</p>
          <p style="margin: 0; font-size: 18px; color: #0070f3;"><strong>Your share:</strong> ${formattedAmount}</p>
        </div>
        <p style="margin: 24px 0;">
          <a href="${safeDashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View in Balance Beacon
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Log in to view the details and mark it as paid when you settle up with ${safeOwnerName}.
        </p>
      </div>
    `,
  })
}

export interface PaymentReminderEmailOptions {
  to: string
  participantName: string
  ownerName: string
  amount: number
  currency: string
  description: string
}

export async function sendPaymentReminderEmail(
  options: PaymentReminderEmailOptions,
): Promise<{ success: boolean; messageId?: string }> {
  const safeOwnerName = escapeHtml(options.ownerName)
  const safeDescription = escapeHtml(options.description)
  const formattedAmount = formatEmailCurrency(options.amount, options.currency)
  const dashboardUrl = `${APP_URL}/`
  const safeDashboardUrl = escapeHtml(dashboardUrl)

  return sendEmail({
    to: options.to,
    subject: `Reminder: You owe ${formattedAmount} - Balance Beacon`,
    text: `Hi ${options.participantName},\n\nThis is a friendly reminder from ${options.ownerName} about a shared expense.\n\nExpense: ${options.description}\nAmount owed: ${formattedAmount}\n\nLog in to Balance Beacon to view the details.\n\n${dashboardUrl}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Payment Reminder</h1>
        <p>Hi ${escapeHtml(options.participantName)},</p>
        <p>This is a friendly reminder from <strong>${safeOwnerName}</strong> about a shared expense.</p>
        <div style="background-color: #fff3cd; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0 0 8px 0;"><strong>Expense:</strong> ${safeDescription}</p>
          <p style="margin: 0; font-size: 18px; color: #856404;"><strong>Amount owed:</strong> ${formattedAmount}</p>
        </div>
        <p style="margin: 24px 0;">
          <a href="${safeDashboardUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View in Balance Beacon
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Log in to view the details and settle up with ${safeOwnerName}.
        </p>
      </div>
    `,
  })
}

/**
 * Format currency for email display
 */
function formatEmailCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '\u20AC',
    ILS: '\u20AA',
  }
  const symbol = symbols[currency] || currency
  return `${symbol}${amount.toFixed(2)}`
}
