# Resend Email Setup Guide for Exammer.co.uk

This guide will walk you through setting up Resend email service for the Exammer application using your existing **exammer.co.uk** domain.

## Quick Overview

- **Time Required:** 1-2 hours active work + 1-24 hours DNS propagation
- **Cost:** FREE (3,000 emails/month on free tier)
- **Difficulty:** Beginner-friendly
- **Your Code Status:** ✅ Already fully implemented - just needs configuration

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create Resend Account](#step-1-create-resend-account)
3. [Step 2: Get API Key](#step-2-get-api-key)
4. [Step 3: Add Domain to Resend](#step-3-add-domain-to-resend)
5. [Step 4: Configure DNS Records](#step-4-configure-dns-records)
6. [Step 5: Verify Domain](#step-5-verify-domain)
7. [Step 6: Configure Application](#step-6-configure-application)
8. [Step 7: Test Email Sending](#step-7-test-email-sending)
9. [Troubleshooting](#troubleshooting)
10. [Optional: Secure exammer.com](#optional-secure-exammercom)

---

## Prerequisites

- [ ] You own the domain **exammer.co.uk**
- [ ] You have access to your domain registrar's DNS settings
- [ ] You have the Exammer application running locally
- [ ] You're on the `vanjasignup` branch with email verification code

---

## Step 1: Create Resend Account

1. Go to https://resend.com
2. Click **"Sign Up"** (top right)
3. Choose sign-up method:
   - GitHub (recommended - quick OAuth)
   - Email + password
4. Verify your email if using email sign-up
5. Complete onboarding questions (can skip)

**Free Tier Includes:**
- 3,000 emails per month
- 100 emails per day
- 1 verified domain
- No credit card required

---

## Step 2: Get API Key

1. In Resend dashboard, navigate to **"API Keys"** (left sidebar)
   - Direct link: https://resend.com/api-keys
2. Click **"Create API Key"**
3. Configure the key:
   - **Name:** `exammer-production` (or any descriptive name)
   - **Permission:** Select **"Sending access"** (recommended for security)
   - **Domain Restriction:** Leave as "All domains" for now (can restrict later)
4. Click **"Add"**
5. **CRITICAL:** Copy the API key immediately
   - It starts with `re_`
   - Example: `re_123abc456def789ghi`
   - ⚠️ **You'll only see this once!**
6. Save it securely (password manager, secure note, etc.)

---

## Step 3: Add Domain to Resend

### Choose Your Subdomain

**Recommended:** `mail.exammer.co.uk`

**Why use a subdomain?**
- Protects main domain reputation
- Isolates email sending from website
- Industry best practice
- If emails get flagged, your main site isn't affected

### Add Domain to Resend

1. In Resend dashboard, go to **"Domains"** (left sidebar)
   - Direct link: https://resend.com/domains
2. Click **"Add Domain"**
3. Enter: `mail.exammer.co.uk`
4. Click **"Add"**
5. You'll see a verification screen with DNS records

**Keep this page open** - you'll need these DNS records in the next step.

---

## Step 4: Configure DNS Records

### Find Your DNS Settings

**Where is exammer.co.uk registered?** Common registrars:

#### If using **Namecheap:**
1. Log in to Namecheap
2. Dashboard → Domain List
3. Click **"Manage"** next to exammer.co.uk
4. Go to **"Advanced DNS"** tab

#### If using **GoDaddy:**
1. Log in to GoDaddy
2. My Products → Domains
3. Click DNS next to exammer.co.uk
4. Scroll to DNS records section

#### If using **Cloudflare:**
1. Log in to Cloudflare
2. Select exammer.co.uk
3. Click **"DNS"** tab
4. **Note:** Cloudflare supports automatic Resend setup via "Domain Connect"

#### If using **123-reg:**
1. Log in to 123-reg Control Panel
2. Domain Names → Manage
3. Select exammer.co.uk
4. Advanced Domain Settings → Manage DNS

### Add the DNS Records

Resend will provide **3-4 DNS records** to add. Here's what to expect:

#### 1. **MX Record** (Mail Exchange)

**Purpose:** Routes bounce messages back to Resend

```
Type: MX
Name: mail (or @ if your registrar auto-appends domain)
Value: feedback-smtp.us-east-1.amazonses.com
Priority: 10
TTL: 3600 (or Auto)
```

**⚠️ Important Notes:**
- Some registrars auto-append `.exammer.co.uk` to the name
- If in doubt, use just `mail` or `@` as the name
- The value is provided by Resend - copy exactly as shown

#### 2. **TXT Record for SPF** (Sender Policy Framework)

**Purpose:** Authorizes Resend to send emails on your behalf

```
Type: TXT
Name: mail (or @ depending on registrar)
Value: v=spf1 include:amazonses.com ~all
```

**Example Value from Resend:**
```
v=spf1 include:amazonses.com ~all
```

**⚠️ Copy the EXACT value** shown in your Resend dashboard - it may differ slightly.

#### 3. **TXT Record for DKIM** (DomainKeys Identified Mail)

**Purpose:** Adds cryptographic signature to verify email authenticity

```
Type: TXT
Name: resend._domainkey.mail (check Resend dashboard for exact name)
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA... (very long string)
```

**⚠️ Important:**
- The value is a VERY LONG string (200+ characters)
- Copy the entire value carefully
- Don't add quotes unless your registrar requires them
- The name might be different - check Resend dashboard

#### 4. **Optional: TXT Record for DMARC** (Recommended)

**Purpose:** Tells email receivers what to do with failed authentication

```
Type: TXT
Name: _dmarc.mail
Value: v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk
```

**DMARC Policy Options:**
- `p=none` - Monitor only (recommended for first 48 hours)
- `p=quarantine` - Send suspicious emails to spam
- `p=reject` - Block suspicious emails entirely

**Recommendation:** Start with `p=none` for testing, upgrade to `p=quarantine` after confirming everything works.

### Save Your DNS Changes

1. Double-check all records for typos
2. Click **"Save"** or **"Add Record"** for each
3. Note the time - DNS propagation begins now

---

## Step 5: Verify Domain

### Wait for DNS Propagation

**How long?**
- Minimum: 5-10 minutes
- Typical: 1-4 hours
- Maximum: 24-48 hours (rare)

**Recommendation:** Wait 30 minutes, then check.

### Check DNS Records (Optional)

Before verifying in Resend, you can manually check if records propagated:

**Using Command Line:**
```bash
# Check MX record
nslookup -type=MX mail.exammer.co.uk

# Check SPF (TXT) record
nslookup -type=TXT mail.exammer.co.uk

# Check DKIM record (replace with actual subdomain from Resend)
nslookup -type=TXT resend._domainkey.mail.exammer.co.uk

# Check DMARC record
nslookup -type=TXT _dmarc.mail.exammer.co.uk
```

**Using Online Tools:**
- https://dnschecker.org/ (check global propagation)
- https://mxtoolbox.com/SuperTool.aspx (comprehensive DNS lookup)
- https://dmarcdkim.com/ (validate email authentication setup)

### Verify in Resend Dashboard

1. Go to https://resend.com/domains
2. Find `mail.exammer.co.uk` in your domain list
3. Click **"Verify DNS Records"** button
4. Wait for verification to complete

**Success Indicators:**
- ✅ Green checkmarks next to all records
- Status changes to **"Verified"**
- You can now send emails from this domain

**If Verification Fails:**
- Red ❌ or yellow ⚠️ icons
- Click on the failed record to see details
- Common issues:
  - DNS not propagated yet (wait longer)
  - Typo in DNS record value
  - Wrong record type
  - Name field incorrect (some registrars auto-append domain)

**Retry:** Resend allows verification attempts for 72 hours. If still failing after 48 hours, check troubleshooting section.

---

## Step 6: Configure Application

### Update Your `.env` File

1. Navigate to your Exammer project: `D:\Exammer`
2. Open (or create) `.env` file in the root directory
3. Add these two lines:

```bash
EMAIL_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=Exammer <notifications@mail.exammer.co.uk>
```

**Replace:**
- `re_your_actual_api_key_here` → Your actual Resend API key from Step 2
- Keep the format: `Exammer <notifications@mail.exammer.co.uk>`

**Example:**
```bash
EMAIL_API_KEY=re_abc123def456ghi789jkl012mno
EMAIL_FROM=Exammer <notifications@mail.exammer.co.uk>
```

### Why `notifications@` instead of `noreply@`?

✅ **Better deliverability** - ISPs prefer addresses that can receive replies
✅ **Improved sender reputation** - Shows you're open to communication
✅ **Better user experience** - More welcoming tone
✅ **Engagement signals** - Email replies improve deliverability metrics

You can still ignore replies if needed, but having a reply-capable address is best practice.

### Restart Your Development Server

**If using npm:**
```bash
# Stop current server (Ctrl+C)
npm run dev
```

**If using other command:**
```bash
# Stop current server (Ctrl+C)
# Restart with your usual command
```

The application will now load the new environment variables.

---

## Step 7: Test Email Sending

### Test the Full Flow

1. **Start your dev server** (if not already running)
   ```bash
   npm run dev
   ```

2. **Open application** in browser:
   ```
   http://localhost:8933
   ```

3. **Sign up with a test email:**
   - Use a real email you can access (your personal email)
   - Complete the signup form
   - Click "Sign Up"

4. **Check application logs:**
   - Look for: `✅ Email sent successfully to your@email.com via Resend`
   - If you see: `⚠️ Email API not configured` → Check .env file

5. **Check Resend dashboard:**
   - Go to https://resend.com/emails
   - You should see the sent email in the list
   - Click it to view details (status, content, timestamps)

6. **Check your email inbox:**
   - Look in primary inbox
   - **Check spam folder** (first emails often go here)
   - Email subject: "Verify your email for Exammer"
   - Sender: "Exammer <notifications@mail.exammer.co.uk>"

7. **Click verification link:**
   - Should redirect to: `http://localhost:8933/auth/verify-email?token=...`
   - Success message: "Email verified successfully!"
   - Auto-redirect to sign-in page after 3 seconds

8. **Sign in:**
   - Use the email and password you just created
   - Should successfully log in
   - Should NOT see "Let Anton know" page
   - Should access the application dashboard

### Test Resend Verification Flow

1. Try the **"Resend verification email"** link on signup page
2. Should see success message
3. Check if new email arrives
4. Verify rate limiting (should block resend within 60 seconds)

### Monitor Resend Dashboard

**Key Metrics to Check:**
- **Status:** Should show "Delivered"
- **Opens/Clicks:** (if tracking enabled)
- **Bounces:** Should be 0%
- **Complaints:** Should be 0%

**If Status Shows "Bounced":**
- Email address might be invalid
- Try with a different email provider

**If Status Shows "Sent" but not "Delivered":**
- Email might be in spam
- Check recipient's spam folder

---

## Troubleshooting

### Issue: "Email API not configured" in logs

**Cause:** Environment variables not loaded

**Fix:**
1. Verify `.env` file exists in `D:\Exammer`
2. Check `EMAIL_API_KEY` and `EMAIL_FROM` are set
3. Restart development server
4. Check for typos in variable names

---

### Issue: "Domain not verified" error

**Cause:** Trying to send before DNS verification complete

**Fix:**
1. Complete Step 5 (Verify Domain) first
2. Ensure green checkmarks in Resend dashboard
3. Temporarily use test domain for testing:
   ```bash
   EMAIL_FROM=Exammer <onboarding@resend.dev>
   ```

---

### Issue: DNS records won't verify

**Cause:** DNS not propagated or incorrect records

**Fix:**
1. Wait 24-48 hours for full propagation
2. Use `nslookup` or https://dnschecker.org/ to verify records exist
3. Check for typos in DNS record values
4. Some registrars add domain automatically - check name field format:
   - ✅ Correct: `mail`
   - ❌ Wrong: `mail.exammer.co.uk.exammer.co.uk` (duplicated)

---

### Issue: Emails going to spam

**Cause:** New domain, missing DMARC, or spammy content

**Fix:**
1. Add DMARC record if you haven't (Step 4)
2. "Warm up" domain by sending to real users gradually
3. Ask recipients to mark as "Not Spam"
4. Check email content for spam triggers
5. Use https://mail-tester.com to check spam score

---

### Issue: API key invalid error

**Cause:** Wrong key format or expired key

**Fix:**
1. Verify key starts with `re_`
2. Check for extra spaces in `.env`
3. Regenerate API key in Resend dashboard if needed
4. Ensure no quotes around the key in `.env`

**Correct format:**
```bash
EMAIL_API_KEY=re_abc123
```

**Wrong formats:**
```bash
EMAIL_API_KEY="re_abc123"  # Don't use quotes
EMAIL_API_KEY= re_abc123   # Extra space
```

---

### Issue: Rate limit exceeded

**Cause:** Exceeded free tier limits (100/day, 3,000/month)

**Fix:**
1. Check current usage: https://resend.com/overview
2. Upgrade to Pro plan ($20/month for 50,000/month)
3. Implement email queuing in your app
4. Remove test emails from sending

---

### Issue: Verification emails not arriving

**Cause:** Email sending failed silently

**Fix:**
1. Check application logs for error messages
2. Check Resend dashboard for failed sends
3. Verify recipient email is valid
4. Try with different email provider (Gmail, Outlook, etc.)
5. Check if firewall/antivirus is blocking

---

### Issue: "DKIM signature failed" in email headers

**Cause:** Incorrect DKIM DNS record

**Fix:**
1. Verify DKIM TXT record copied correctly (full value)
2. Remove any quotes if your registrar added them
3. Wait for DNS propagation
4. Re-verify domain in Resend dashboard
5. Use https://dmarcdkim.com/ to test

---

## Optional: Secure exammer.com

To protect your brand, consider purchasing **exammer.com** and redirecting it to **exammer.co.uk**.

### Why Do This?

- ✅ Prevents competitors from taking exammer.com
- ✅ Prevents phishing attacks using similar domain
- ✅ Captures users who type .com by default
- ✅ Future flexibility if you want to expand internationally

### How to Set Up

1. **Check availability:**
   - Visit https://www.namecheap.com or https://domains.cloudflare.com
   - Search for `exammer.com`

2. **Purchase if available:**
   - Cost: ~$10-15/year
   - Use same registrar as .co.uk for easier management

3. **Set up 301 redirect:**
   - **Option A:** Use registrar's forwarding feature
     - Namecheap: Domain → Redirect Domain → exammer.co.uk
     - GoDaddy: Forwarding → Add Forward → exammer.co.uk

   - **Option B:** Use Cloudflare (free):
     - Add exammer.com to Cloudflare
     - DNS: Add A record pointing to 192.0.2.1 (placeholder)
     - Page Rules: `exammer.com/*` → Forwarding URL (301) → `https://exammer.co.uk/$1`

4. **Test:**
   - Visit `exammer.com` in browser
   - Should redirect to `exammer.co.uk`
   - URL bar should show `exammer.co.uk`

**Priority:** Low-Medium (good to have, not urgent)

---

## Next Steps After Setup

### Immediate (Before Production Launch)

- [ ] Test signup → verify → signin flow multiple times
- [ ] Test with different email providers (Gmail, Outlook, Yahoo)
- [ ] Check spam folder placement
- [ ] Verify all email content renders correctly
- [ ] Test on mobile email clients

### Short-term (Within First Month)

- [ ] Monitor Resend analytics for delivery rates
- [ ] Upgrade DMARC policy from `p=none` to `p=quarantine`
- [ ] Set up webhook for bounce handling (optional)
- [ ] Implement password reset flow (currently incomplete)
- [ ] Add email templates with branding/logo

### Long-term (As You Grow)

- [ ] Monitor quota usage (upgrade when approaching 3,000/month)
- [ ] Set up separate subdomain for marketing emails
- [ ] Implement email tracking/analytics if needed
- [ ] Consider transactional email templates with React Email
- [ ] Set up DMARC reporting analysis

---

## Quick Reference

### Environment Variables
```bash
EMAIL_API_KEY=re_your_api_key_here
EMAIL_FROM=Exammer <notifications@mail.exammer.co.uk>
```

### Resend Dashboard URLs
- API Keys: https://resend.com/api-keys
- Domains: https://resend.com/domains
- Email Logs: https://resend.com/emails
- Documentation: https://resend.com/docs

### DNS Verification Commands
```bash
nslookup -type=MX mail.exammer.co.uk
nslookup -type=TXT mail.exammer.co.uk
nslookup -type=TXT resend._domainkey.mail.exammer.co.uk
nslookup -type=TXT _dmarc.mail.exammer.co.uk
```

### Free Tier Limits
- 3,000 emails/month
- 100 emails/day
- 1 verified domain
- No credit card required

### Support Resources
- Resend Docs: https://resend.com/docs
- Resend Support: https://resend.com/support
- DNS Checker: https://dnschecker.org/
- Email Tester: https://mail-tester.com
- DMARC Validator: https://dmarcdkim.com/

---

## Summary

✅ **Your code is ready** - No code changes needed
✅ **Free tier is generous** - 3,000 emails/month
✅ **Setup is simple** - Just DNS configuration
✅ **.co.uk works perfectly** - No limitations vs .com
✅ **Professional emails** - From your own domain
✅ **Better deliverability** - Using notifications@ instead of noreply@

**Total Cost:** $0/month (stays free if <3,000 emails/month)

**Next Step:** Start with Step 1 and follow this guide. Feel free to reach out if you encounter any issues!

Good luck! 🚀
