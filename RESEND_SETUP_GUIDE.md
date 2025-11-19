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

**YOUR DOMAIN:** exammer.co.uk is registered with **GoDaddy**

#### Accessing GoDaddy DNS Management (Detailed Steps):

**Step 1: Log In**
1. Go to https://account.godaddy.com/products
2. Click **"Sign In"** in the top right corner
3. Enter your GoDaddy username and password
4. Complete 2-factor authentication if enabled

**Step 2: Navigate to Domain List**
1. After login, you should see the **My Products** page
2. If not, click your **account name** in the upper right
3. Select **"My Products"** from the dropdown menu
4. Look for the **Domains** section

**Step 3: Access DNS Settings for exammer.co.uk**

**Option A - Using the Quick Menu (Recommended):**
1. In the **Domains** section, find **exammer.co.uk** in the list
2. Look for the **three dots (...)** or ellipsis icon next to the domain name
3. Click the **three dots (...)**
4. Select **"Edit DNS"** from the dropdown menu
5. You'll be taken directly to the DNS management page

**Option B - Using Domain Details Page:**
1. In the **Domains** section, click **"Manage All"** or the domain name **exammer.co.uk**
2. This opens the domain details page
3. Look for the **"DNS"** button or tab
4. Click **"Manage DNS"** or **"DNS Settings"**
5. You'll see the DNS records table

**What You'll See:**
- A table showing existing DNS records (Type, Name, Value, TTL, Actions)
- An **"Add New Record"** button (usually at the top or bottom)
- Filter options to show specific record types
- Edit and Delete icons next to each existing record

**Keep this page open** - you'll be adding records here in the next steps.

---

### Alternative Registrars (If Not Using GoDaddy):

#### If using **Namecheap:**
1. Log in to Namecheap
2. Dashboard → Domain List
3. Click **"Manage"** next to your domain
4. Go to **"Advanced DNS"** tab

#### If using **Cloudflare:**
1. Log in to Cloudflare
2. Select your domain
3. Click **"DNS"** tab
4. **Note:** Cloudflare supports automatic Resend setup via "Domain Connect"

#### If using **123-reg:**
1. Log in to 123-reg Control Panel
2. Domain Names → Manage
3. Select your domain
4. Advanced Domain Settings → Manage DNS

### Add the DNS Records (GoDaddy-Specific Instructions)

Resend will provide **3-4 DNS records** to add. Follow these steps for each record:

#### 1. **MX Record** (Mail Exchange) - GoDaddy Steps

**Purpose:** Routes bounce messages back to Resend

**Click-by-Click Instructions:**

1. **Open Add Record Modal**
   - On the DNS Management page, locate **"Add New Record"** button (top right or bottom of records table)
   - Click **"Add New Record"** or **"Add"**
   - A modal/popup will appear

2. **Select Record Type**
   - In the modal, you'll see a **"Type"** dropdown menu
   - Click the dropdown
   - Scroll down and select **"MX"** from the list
   - The form will update to show MX-specific fields

3. **Fill in MX Record Details**
   - **Type:** MX (already selected)
   - **Name:** Enter `mail`
     - GoDaddy will automatically append `.exammer.co.uk` to this
     - So it becomes `mail.exammer.co.uk`
     - **Do NOT type the full domain** - just `mail`
   - **Value:** Copy EXACTLY from Resend dashboard
     - Typical value: `feedback-smtp.us-east-1.amazonses.com`
     - **⚠️ Important:** Copy/paste to avoid typos
   - **Priority:** Enter `10`
     - This is the mail server priority (lower = higher priority)
   - **TTL:** Select **"1 hour"** or **"3600"** (recommended)
     - Or leave as **"Automatic"** if that's the default

4. **Save the Record**
   - Click **"Save"** button at the bottom of the modal
   - The modal will close
   - You should see the new MX record appear in the DNS records table
   - ✅ Success indicator: New row with Type=MX, Name=mail, Value=feedback-smtp...

**What the Final Record Looks Like:**
```
Type: MX
Name: mail
Value: feedback-smtp.us-east-1.amazonses.com (check Resend for exact value)
Priority: 10
TTL: 1 hour
```

**⚠️ Common GoDaddy-Specific Issues:**
- **Name field auto-append:** GoDaddy adds `.exammer.co.uk` automatically, so only enter `mail`
- **Wrong Name entry:** If you enter `mail.exammer.co.uk`, it becomes `mail.exammer.co.uk.exammer.co.uk` (WRONG)
- **Priority field:** Some interfaces call this "Priority", others "Preference" - same thing
- **Value must NOT have trailing dot:** Remove any `.` at the end of the mail server address

#### 2. **TXT Record for SPF** (Sender Policy Framework) - GoDaddy Steps

**Purpose:** Authorizes Resend to send emails on your behalf

**Click-by-Click Instructions:**

1. **Open Add Record Modal**
   - Click **"Add New Record"** button again
   - A new modal will appear

2. **Select Record Type**
   - Click the **"Type"** dropdown
   - Select **"TXT"** from the list
   - The form will show TXT-specific fields

3. **Fill in SPF TXT Record Details**
   - **Type:** TXT (already selected)
   - **Name:** Enter `mail`
     - Same as MX record - for the subdomain `mail.exammer.co.uk`
     - GoDaddy auto-appends `.exammer.co.uk`
   - **Value:** Copy EXACTLY from Resend dashboard
     - Typical value: `v=spf1 include:amazonses.com ~all`
     - **⚠️ Critical:** Must start with `v=spf1`
     - **⚠️ GoDaddy Note:** Do NOT add quotes around the value
     - Paste the value WITHOUT quotes: `v=spf1 include:amazonses.com ~all`
   - **TTL:** Select **"1 hour"** or **"3600"** (recommended)

4. **Save the Record**
   - Click **"Save"** button
   - The modal closes
   - New TXT record appears in the table
   - ✅ Success: Type=TXT, Name=mail, Value=v=spf1...

**What the Final Record Looks Like:**
```
Type: TXT
Name: mail
Value: v=spf1 include:amazonses.com ~all
TTL: 1 hour
```

**⚠️ Common GoDaddy-Specific Issues:**
- **No quotes needed:** GoDaddy interface doesn't require quotes around TXT values
- **If quotes added:** GoDaddy might store the quotes as part of the value (WRONG)
- **Correct:** `v=spf1 include:amazonses.com ~all`
- **Wrong:** `"v=spf1 include:amazonses.com ~all"`
- **Exact copy:** Make sure to copy the EXACT value from Resend - syntax matters!

#### 3. **TXT Record for DKIM** (DomainKeys Identified Mail) - GoDaddy Steps

**Purpose:** Adds cryptographic signature to verify email authenticity

**Click-by-Click Instructions:**

1. **Open Add Record Modal**
   - Click **"Add New Record"** button again
   - A new modal appears

2. **Select Record Type**
   - Click the **"Type"** dropdown
   - Select **"TXT"** from the list

3. **Fill in DKIM TXT Record Details**
   - **Type:** TXT (already selected)
   - **Name:** Copy EXACTLY from Resend dashboard
     - Typical format: `resend._domainkey.mail`
     - Or might be: `[selector]._domainkey.mail`
     - **⚠️ CRITICAL:** Check your Resend dashboard for exact name
     - GoDaddy will auto-append `.exammer.co.uk`
     - Example: If Resend shows `resend._domainkey.mail`, enter exactly that
   - **Value:** Copy the ENTIRE LONG string from Resend
     - **⚠️ This is a VERY LONG value** (200-500+ characters)
     - Starts with: `p=MIGfMA0GCSqGSIb3DQEBAQUAA...`
     - **⚠️ GoDaddy allows long values** - paste the entire string
     - **⚠️ Do NOT add quotes**
     - **⚠️ Do NOT split into multiple lines**
     - Triple-click in Resend to select all, then Ctrl+C to copy
   - **TTL:** Select **"1 hour"** or **"3600"**

4. **Verify the Value Before Saving**
   - **IMPORTANT:** Before clicking Save, double-check:
   - The value starts with `p=` and is very long
   - No line breaks or spaces in the middle
   - No quotes at beginning or end
   - The entire string was copied (scroll in the value field to check)

5. **Save the Record**
   - Click **"Save"** button
   - The modal closes
   - New TXT record appears with Name=resend._domainkey.mail
   - ✅ Success: Type=TXT, Name=resend._domainkey.mail, Value=p=MIG...

**What the Final Record Looks Like:**
```
Type: TXT
Name: resend._domainkey.mail (or whatever Resend provides)
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC... (200+ characters)
TTL: 1 hour
```

**⚠️ Common GoDaddy-Specific Issues:**
- **Name field confusion:** The Name field must include `_domainkey` - copy exact from Resend
- **Value truncation:** Make sure you copied the ENTIRE long string (use Ctrl+A in the field, or triple-click)
- **Hidden characters:** Don't copy extra spaces or line breaks
- **GoDaddy limits:** GoDaddy TXT records support up to 255 characters per string, but Resend values should fit
- **Multiple DKIM records:** You might have multiple DKIM records for different selectors - that's normal

#### 4. **Optional: TXT Record for DMARC** (Recommended) - GoDaddy Steps

**Purpose:** Tells email receivers what to do with failed authentication

**Click-by-Click Instructions:**

1. **Open Add Record Modal**
   - Click **"Add New Record"** button one more time
   - Modal appears

2. **Select Record Type**
   - Click the **"Type"** dropdown
   - Select **"TXT"**

3. **Fill in DMARC TXT Record Details**
   - **Type:** TXT (already selected)
   - **Name:** Enter `_dmarc.mail`
     - Note the underscore at the beginning: `_dmarc.mail`
     - GoDaddy will auto-append `.exammer.co.uk`
     - Final domain: `_dmarc.mail.exammer.co.uk`
   - **Value:** Enter one of these policies (copy exactly):
     - **For testing (recommended first):** `v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk`
     - **After testing (production):** `v=DMARC1; p=quarantine; rua=mailto:dmarc@exammer.co.uk`
     - **Strict (after confirmed working):** `v=DMARC1; p=reject; rua=mailto:dmarc@exammer.co.uk`
   - **TTL:** Select **"1 hour"** or **"3600"**

4. **Save the Record**
   - Click **"Save"** button
   - Modal closes
   - New TXT record appears with Name=_dmarc.mail
   - ✅ Success: Type=TXT, Name=_dmarc.mail, Value=v=DMARC1...

**What the Final Record Looks Like:**
```
Type: TXT
Name: _dmarc.mail
Value: v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk
TTL: 1 hour
```

**DMARC Policy Options Explained:**
- **`p=none`** - Monitor only, no action taken (recommended for first 48-72 hours)
  - Use this to test and ensure SPF/DKIM are working
  - Email providers will report issues but won't block emails
- **`p=quarantine`** - Send suspicious emails to spam (recommended for production)
  - Emails that fail authentication go to spam folder
  - Good balance of security and deliverability
- **`p=reject`** - Block suspicious emails entirely (strictest)
  - Emails that fail authentication are rejected completely
  - Only use after confirming everything works perfectly

**`rua=` Explanation:**
- `rua=mailto:dmarc@exammer.co.uk` - Where DMARC reports are sent
- You'll receive XML reports about email authentication
- You can use any email address (doesn't need to exist yet)
- Or use a DMARC reporting service

**Recommendation:**
1. Start with `p=none` for initial testing (48-72 hours)
2. Monitor Resend dashboard for delivery issues
3. Upgrade to `p=quarantine` after confirming emails deliver successfully
4. Consider `p=reject` only after months of stable operation

### Save and Review Your DNS Changes (GoDaddy)

**After Adding All Records:**

1. **Review Your DNS Records Table**
   - You should now see 3-4 new records in the DNS management page:
     - ✅ **1 MX record:** Type=MX, Name=mail, Priority=10
     - ✅ **2-3 TXT records:**
       - SPF: Name=mail, Value=v=spf1...
       - DKIM: Name=resend._domainkey.mail, Value=p=MIG...
       - DMARC (optional): Name=_dmarc.mail, Value=v=DMARC1...

2. **Double-Check Each Record**
   - Click the **Edit** icon (pencil) next to each record to review
   - Verify no typos in Name fields
   - Verify values match exactly what Resend provided
   - Check that TTL is set appropriately (1 hour recommended)
   - Click **Cancel** to close without changes, or **Save** if you need to fix something

3. **GoDaddy Auto-Save**
   - **Good news:** GoDaddy saves records immediately when you click "Save" on each modal
   - You don't need a final "Save All" button
   - Each record is saved individually as you add it

4. **Note the Time**
   - Write down the current time
   - DNS propagation begins immediately
   - Most changes propagate within 15-60 minutes
   - Full global propagation can take up to 48 hours

5. **Keep the GoDaddy DNS Page Open**
   - You might need to come back to check or edit records
   - Or bookmark the page for easy access later

**Visual Confirmation:**
Your DNS records table should look similar to this:

```
Type    Name                      Value                                          Priority  TTL
----    ----                      -----                                          --------  ---
MX      mail                      feedback-smtp.us-east-1.amazonses.com         10        1 hour
TXT     mail                      v=spf1 include:amazonses.com ~all             -         1 hour
TXT     resend._domainkey.mail    p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKB...   -         1 hour
TXT     _dmarc.mail               v=DMARC1; p=none; rua=mailto:dmarc@...        -         1 hour
```

**GoDaddy-Specific Notes:**
- Records are active immediately after saving
- No need to restart DNS servers or click "Publish Changes"
- TTL of 1 hour means caching servers will refresh hourly
- You can edit or delete records anytime by clicking the icons in the Actions column

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
