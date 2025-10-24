# Email Configuration Guide - Custom API

This guide explains how to configure email for user verification and password reset functionality in Erudate using your custom email API.

## Overview

Erudate sends verification emails when users sign up by making HTTP POST requests to your custom email API endpoint. You have full control over how emails are sent.

## Configuration

Email is configured via environment variables in your `.env` file:

- `EMAIL_API_URL` - Your custom email API endpoint URL (required)
- `EMAIL_API_KEY` - Optional API key for authentication (sent as Bearer token)
- `EMAIL_FROM` - The "from" address for outgoing emails (required)

## Development Mode

In development, if email is not configured:
- The app will log verification URLs to the console instead of sending emails
- You can copy the verification URL from the console and use it to verify test accounts
- The signup API response includes the verification URL when `NODE_ENV=development`

## Custom Email API Specification

Your email API must accept POST requests with the following format:

### Request Format

**Endpoint:** Your `EMAIL_API_URL`

**Method:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_KEY" // Optional, if EMAIL_API_KEY is set
}
```

**Body:**
```json
{
  "from": "noreply@yourdomain.com",
  "to": "user@example.com",
  "subject": "Verify your email - Erudate",
  "text": "Plain text version of the email...",
  "html": "<!DOCTYPE html><html>...</html>"
}
```

### Response Format

**Success:** HTTP 200-299 status code

**Error:** Any other status code will be treated as a failure

### Example Implementation

Here's a simple example of a custom email API using Node.js/Express:

```javascript
// email-api.js
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Configure your SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Email sending endpoint
app.post('/api/send', async (req, res) => {
  // Optional: Verify API key
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== process.env.EMAIL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { from, to, subject, text, html } = req.body;

  // Validate required fields
  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.listen(3001, () => {
  console.log('Email API listening on port 3001');
});
```

## Production Setup

### Option 1: Deploy Your Own Email API

1. **Create your email service:**
   - Use the example above as a starting point
   - Add error handling, logging, rate limiting
   - Deploy to a server (same server as Erudate or separate)

2. **Configure Erudate:**
   ```bash
   EMAIL_API_URL=https://your-server.com/api/send
   EMAIL_API_KEY=your-secret-api-key
   EMAIL_FROM=noreply@yourdomain.com
   ```

### Option 2: Use a Serverless Function

Deploy your email API as a serverless function:

#### Vercel Serverless Function Example:

```javascript
// api/send-email.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== process.env.EMAIL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { from, to, subject, text, html } = req.body;

  const transporter = nodemailer.createTransport(process.env.SMTP_URL);

  try {
    await transporter.sendMail({ from, to, subject, text, html });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email' });
  }
}
```

Deploy with:
```bash
vercel --prod
```

Then configure:
```bash
EMAIL_API_URL=https://your-project.vercel.app/api/send-email
EMAIL_API_KEY=your-secret-key
EMAIL_FROM=noreply@yourdomain.com
```

### Option 3: Use an Email Service API Directly

Implement your email API to call services like:

- **Resend** - Modern email API, 3,000 free emails/month
- **SendGrid** - 100 free emails/day
- **Postmark** - Excellent deliverability, 100 free emails/month
- **Mailgun** - 100 free emails/day

Example with Resend:

```javascript
// Using Resend API
app.post('/api/send', async (req, res) => {
  const { to, subject, text, html } = req.body;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html: html || text,
    }),
  });

  if (response.ok) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to send' });
  }
});
```

## Deployment Server Setup

### Quick Start

1. **Deploy your custom email API** (if not already deployed)

2. **SSH into your Oracle Cloud server:**
   ```bash
   ssh user@your-server
   cd /path/to/erudate
   ```

3. **Edit the `.env` file:**
   ```bash
   nano .env
   ```

4. **Add email configuration:**
   ```bash
   # Required
   NEXTAUTH_URL=http://your-server-ip:8933
   NEXTAUTH_SECRET=your-generated-secret

   # Custom Email API
   EMAIL_API_URL=https://your-email-api.com/api/send
   EMAIL_API_KEY=your-secret-api-key
   EMAIL_FROM=noreply@yourdomain.com
   ```

5. **Save and restart the app:**
   ```bash
   pm2 restart erudate
   ```

6. **Verify email is working:**
   - Sign up with a test account
   - Check your email for the verification link
   - Check PM2 logs if you don't receive an email:
     ```bash
     pm2 logs erudate
     ```

## Email Templates

The app sends these emails to your API:

### Verification Email
- **Subject:** "Verify your email - Erudate"
- **Content:** Welcome message with verification button/link (HTML + text)
- **Expiration:** 24 hours

### Password Reset Email (Future)
- **Subject:** "Reset your password - Erudate"
- **Content:** Password reset button/link (HTML + text)
- **Expiration:** 1 hour

Email templates can be customized in `src/lib/email.ts`.

## Security Best Practices

1. **Protect your API key** - Never commit it to git, use environment variables
2. **Validate requests** - Verify API key in your email service
3. **Rate limiting** - Implement rate limits to prevent abuse
4. **HTTPS only** - Always use HTTPS for your email API
5. **Input validation** - Validate email addresses and content
6. **Logging** - Log all email attempts for debugging
7. **Error handling** - Handle failures gracefully

## Testing

### Local Testing (Development)

Without configuring email:
```bash
# Start the dev server
npm run dev

# Sign up with a test account
# Check the console output for the verification URL
# Copy and paste the URL in your browser to verify
```

With email configured:
```bash
# Add EMAIL_API_URL and EMAIL_FROM to .env.local
npm run dev

# Sign up with your real email address
# Check your inbox for the verification email
```

### Production Testing

```bash
# SSH to server
ssh user@your-server
cd /path/to/erudate

# Check logs
pm2 logs erudate --lines 100

# Test signup
# Monitor logs for email sending confirmation
```

## Troubleshooting

**No email received:**
1. Check PM2 logs: `pm2 logs erudate`
2. Verify `EMAIL_API_URL`, `EMAIL_API_KEY`, and `EMAIL_FROM` are set correctly
3. Test your email API directly with curl:
   ```bash
   curl -X POST https://your-email-api.com/api/send \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-api-key" \
     -d '{"from":"noreply@yourdomain.com","to":"test@example.com","subject":"Test","text":"Test email"}'
   ```
4. Check your email service logs for errors
5. Verify your API key is correct

**API errors:**
1. Check if your email API is running and accessible
2. Verify the endpoint URL is correct
3. Ensure HTTPS is properly configured
4. Check API authentication

**Emails go to spam:**
1. Use a verified domain in `EMAIL_FROM`
2. Set up SPF, DKIM, and DMARC DNS records
3. Use a reputable email service (SendGrid, Postmark, etc.)

## FAQ

**Q: Can I use Erudate without configuring email?**
A: Yes, but only in development mode. The verification URLs will be logged to the console. In production, you must configure email or users won't be able to verify their accounts.

**Q: Do I need to implement my own email API?**
A: Yes. You have full control over how emails are sent. You can use SMTP, email service APIs, or any other method you prefer.

**Q: Can I host the email API on the same server?**
A: Yes! You can run your email API on the same Oracle Cloud server. Just use a different port (e.g., 3001) and point EMAIL_API_URL to http://localhost:3001/api/send.

**Q: What if my email API is down?**
A: The signup will still succeed, but users won't receive verification emails. The app logs errors but continues processing. Make sure your email API is reliable!

**Q: Can I use environment variables in my email API?**
A: Yes, your email API is separate from Erudate and can have its own `.env` file with SMTP credentials, API keys, etc.

**Q: How do I secure my email API?**
A: Use the `EMAIL_API_KEY` to authenticate requests. Your email API should verify this key before sending emails. Also use HTTPS and implement rate limiting.
