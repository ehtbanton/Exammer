interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email using Resend API
 * Set EMAIL_API_KEY (Resend API key) and EMAIL_FROM in .env
 * Or use EMAIL_API_URL for custom email service
 */
export async function sendEmail({ to, subject, text, html }: EmailOptions): Promise<void> {
  const emailApiKey = process.env.EMAIL_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const customApiUrl = process.env.EMAIL_API_URL;

  // Development mode: log to console if no email config
  if (!emailApiKey && !customApiUrl) {
    console.warn('⚠️  Email API not configured. Skipping email send.');
    console.log(`📧 Would have sent email to ${to}:`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Text: ${text}`);
    return;
  }

  if (!emailFrom) {
    console.error('❌ EMAIL_FROM not set in environment variables');
    throw new Error('Email sender address not configured');
  }

  try {
    // Use Resend API (default)
    if (emailApiKey && !customApiUrl) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          subject,
          text,
          html: html || text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Resend API error ${response.status}: ${JSON.stringify(errorData)}`);
      }

      console.log(`✅ Email sent successfully to ${to} via Resend`);
      return;
    }

    // Use custom email API
    if (customApiUrl) {
      const response = await fetch(customApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(emailApiKey && { 'Authorization': `Bearer ${emailApiKey}` }),
        },
        body: JSON.stringify({
          from: emailFrom,
          to,
          subject,
          text,
          html: html || text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email API returned ${response.status}: ${errorText}`);
      }

      console.log(`✅ Email sent successfully to ${to} via custom API`);
      return;
    }

  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw new Error('Failed to send email');
  }
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(email: string, verificationUrl: string): Promise<void> {
  const subject = 'Verify your email - Exammer';
  const text = `
Welcome to Exammer!

Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #0070f3;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to Exammer!</h1>
    <p>Please verify your email address by clicking the button below:</p>
    <a href="${verificationUrl}" class="button">Verify Email</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #0070f3;">${verificationUrl}</p>
    <p class="footer">
      This link will expire in 24 hours.<br>
      If you didn't create an account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({ to: email, subject, text, html });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const subject = 'Reset your password - Exammer';
  const text = `
You requested to reset your password for your Exammer account.

Click the link below to reset your password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #0070f3;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reset Your Password</h1>
    <p>You requested to reset your password for your Exammer account.</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #0070f3;">${resetUrl}</p>
    <p class="footer">
      This link will expire in 1 hour.<br>
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({ to: email, subject, text, html });
}
