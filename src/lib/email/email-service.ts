/**
 * Email sending service using Resend API
 */

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send an email via Resend API
 */
export async function sendEmail(
  apiKey: string,
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'VFA.gallery <noreply@vfa.gallery>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('[Email] Send failed:', response.status, errorData)
      return { success: false, error: `Email send failed: ${response.status}` }
    }

    const data = (await response.json()) as { id: string }
    return { success: true, messageId: data.id }
  } catch (error) {
    console.error('[Email] Send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    }
  }
}

/**
 * Generate HTML email template for email verification
 */
export function getVerificationEmailTemplate(
  _userEmail: string,
  verificationUrl: string,
  userName?: string
): string {
  const displayName = userName || 'Artist'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { border-bottom: 1px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 24px; }
    .header h2 { color: #111827; margin: 0; }
    .content { padding: 0 0 24px; }
    .button { display: inline-block; padding: 12px 32px; background-color: #374151; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 24px; font-size: 13px; color: #9ca3af; }
    .code { background-color: #f3f4f6; padding: 8px 12px; font-family: monospace; border-radius: 4px; font-size: 13px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Welcome to VFA.gallery, ${displayName}!</h2>
    </div>
    <div class="content">
      <p>Thank you for signing up. Please verify your email address by clicking the button below:</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Or copy and paste this link in your browser:<br>
        <span class="code">${verificationUrl}</span>
      </p>
      <p style="color: #9ca3af; font-size: 14px;">
        This verification link expires in 24 hours.
      </p>
    </div>
    <div class="footer">
      <p>&copy; 2026 VFA.gallery. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Generate plain text version of verification email
 */
export function getVerificationEmailText(verificationUrl: string): string {
  return `Verify your VFA.gallery email address

Please click the link below to verify your email address and activate your account:

${verificationUrl}

This link expires in 24 hours.

- VFA.gallery`
}
