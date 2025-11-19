# GoDaddy DNS Setup for Resend Email Service
## Complete Step-by-Step Guide for exammer.co.uk

---

## Quick Reference Card

**Your Information:**
- **Domain:** exammer.co.uk
- **Registrar:** GoDaddy
- **Email Subdomain:** mail.exammer.co.uk (recommended)
- **Email Service:** Resend (https://resend.com)

**What You'll Add:**
- 1 MX record
- 2-3 TXT records (SPF, DKIM, optional DMARC)

**Time Required:**
- Active work: 15-30 minutes
- DNS propagation: 15 minutes to 48 hours (typically 1-2 hours)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Access GoDaddy DNS Management](#part-1-access-godaddy-dns-management)
3. [Part 2: Add MX Record](#part-2-add-mx-record)
4. [Part 3: Add SPF TXT Record](#part-3-add-spf-txt-record)
5. [Part 4: Add DKIM TXT Record](#part-4-add-dkim-txt-record)
6. [Part 5: Add DMARC TXT Record (Optional)](#part-5-add-dmarc-txt-record-optional)
7. [Part 6: Review and Verify](#part-6-review-and-verify)
8. [Common GoDaddy Issues and Solutions](#common-godaddy-issues-and-solutions)
9. [Screenshots Reference](#screenshots-reference)

---

## Prerequisites

Before starting, make sure you have:

- [ ] GoDaddy account login credentials (username/password)
- [ ] Access to 2-factor authentication if enabled on your account
- [ ] Resend account created at https://resend.com
- [ ] Domain added in Resend dashboard (mail.exammer.co.uk)
- [ ] Resend DNS records page open (shows the exact values to copy)

**Important:** Have TWO browser tabs open:
1. **Tab 1:** GoDaddy DNS Management (where you'll paste records)
2. **Tab 2:** Resend Domain Settings (where you'll copy values from)

---

## Part 1: Access GoDaddy DNS Management

### Step 1.1: Log Into GoDaddy

1. **Open your browser** and go to:
   ```
   https://account.godaddy.com/products
   ```

2. **Click "Sign In"** in the top right corner

3. **Enter your credentials:**
   - Username or Customer ID
   - Password
   - Click **"Sign In"**

4. **Complete 2-Factor Authentication** (if enabled):
   - Enter the code from your authenticator app or SMS
   - Click **"Verify"** or **"Submit"**

### Step 1.2: Navigate to Domain List

1. **You should land on the "My Products" page**
   - If not, click your **account name** (top right)
   - Select **"My Products"** from the dropdown

2. **Scroll down to the "Domains" section**
   - You'll see a list of your domains
   - Look for **exammer.co.uk** in the list

### Step 1.3: Open DNS Management for exammer.co.uk

**RECOMMENDED METHOD - Quick Access:**

1. **Locate exammer.co.uk** in the domains list

2. **Find the three dots (...)** icon (ellipsis menu)
   - It's usually on the right side of the domain row
   - Might be labeled as "More" or just appear as three vertical dots

3. **Click the three dots (...)**
   - A dropdown menu appears

4. **Select "Edit DNS"** from the menu
   - You'll be taken directly to the DNS Management page

**ALTERNATIVE METHOD - Via Domain Details:**

1. **Click the domain name "exammer.co.uk"** itself
   - Opens the domain details page

2. **Look for the "DNS" section or tab**
   - Might say "Manage DNS", "DNS Settings", or "DNS Zone File"

3. **Click "Manage DNS"** or "DNS"
   - Takes you to the DNS Management page

### Step 1.4: Confirm You're on the DNS Management Page

You should now see:
- **Page title:** Something like "DNS Management" or "Manage DNS"
- **Domain name:** exammer.co.uk (displayed at the top)
- **DNS Records table** with columns:
  - Type
  - Name (or Host)
  - Value (or Points To, or Data)
  - TTL
  - Priority (for MX records)
  - Actions (Edit/Delete icons)
- **"Add New Record"** or **"Add"** button (usually top right or bottom of table)

**If you see this, you're ready to proceed!**

**Keep this page open.** You'll be adding 3-4 records here.

---

## Part 2: Add MX Record

### What is an MX Record?
MX (Mail Exchange) records tell email servers where to send bounce notifications and delivery reports for your domain.

### Step 2.1: Get MX Record Values from Resend

1. **Switch to your Resend tab**
   - Go to https://resend.com/domains
   - Click on **mail.exammer.co.uk**
   - You'll see the DNS records section

2. **Find the MX record** section
   - Look for a record labeled **"MX Record"** or **"Mail Exchange"**

3. **Note the values** (example, yours might differ):
   - **Name:** Usually `mail` or `@`
   - **Value/Points To:** Something like `feedback-smtp.us-east-1.amazonses.com`
   - **Priority:** Usually `10`

### Step 2.2: Add MX Record in GoDaddy

1. **Switch back to the GoDaddy DNS Management tab**

2. **Click "Add New Record"** or **"Add"** button
   - A modal/popup window will appear titled "Add New Record" or "Add DNS Record"

3. **Select Record Type:**
   - Click the **"Type"** dropdown menu
   - Scroll down and select **"MX"**
   - The form will update to show MX-specific fields

4. **Fill in the MX Record fields:**

   **Type:** (already set to MX)
   - Leave as **MX**

   **Name (or Host):**
   - Enter: `mail`
   - **Important:** Only enter `mail` - do NOT enter `mail.exammer.co.uk`
   - GoDaddy automatically appends `.exammer.co.uk` to create `mail.exammer.co.uk`

   **Value (or Points To):**
   - Copy the exact value from Resend
   - Example: `feedback-smtp.us-east-1.amazonses.com`
   - **Important:** Use Ctrl+C / Ctrl+V to copy/paste - avoid typing manually
   - **Remove any trailing dots** (`.`) if present

   **Priority:**
   - Enter: `10`
   - This is the mail server priority (lower number = higher priority)

   **TTL (Time To Live):**
   - Select **"1 hour"** or **"3600"** from the dropdown
   - Or leave as **"Automatic"** if that's the default
   - Recommended: **1 hour** for initial setup (allows faster changes if needed)

5. **Review your entries** before saving:
   - Name = `mail` (not `mail.exammer.co.uk`)
   - Value matches Resend exactly
   - Priority = `10`
   - TTL = `1 hour`

6. **Click "Save"** button
   - The modal will close
   - You'll see the new MX record appear in the DNS records table

7. **Verify the record was added:**
   - Look for a new row in the table:
     - Type = **MX**
     - Name = **mail**
     - Value = **feedback-smtp.us-east-1.amazonses.com** (or similar)
     - Priority = **10**
     - TTL = **1 hour**

✅ **Success!** Your MX record is now configured.

---

## Part 3: Add SPF TXT Record

### What is SPF?
SPF (Sender Policy Framework) is a TXT record that authorizes Resend's servers to send emails on behalf of your domain. It helps prevent email spoofing and improves deliverability.

### Step 3.1: Get SPF Record Value from Resend

1. **Switch to the Resend tab**
   - You should still be on the domain DNS records page

2. **Find the SPF/TXT record** section
   - Look for a record labeled **"SPF"** or **"TXT Record (SPF)"**

3. **Note the value** (example):
   - **Name:** `mail` or `@`
   - **Value:** `v=spf1 include:amazonses.com ~all`
   - **Important:** The value must start with `v=spf1`

### Step 3.2: Add SPF TXT Record in GoDaddy

1. **Switch back to the GoDaddy DNS Management tab**

2. **Click "Add New Record"** or **"Add"** button again
   - A new modal appears

3. **Select Record Type:**
   - Click the **"Type"** dropdown
   - Select **"TXT"**
   - The form shows TXT-specific fields

4. **Fill in the SPF TXT Record fields:**

   **Type:** (already set to TXT)
   - Leave as **TXT**

   **Name (or Host):**
   - Enter: `mail`
   - Same as the MX record - this applies to `mail.exammer.co.uk`
   - GoDaddy auto-appends `.exammer.co.uk`

   **Value (or TXT Value):**
   - Copy the exact value from Resend
   - Example: `v=spf1 include:amazonses.com ~all`
   - **CRITICAL:** Copy the ENTIRE value
   - **Do NOT add quotes** around the value
   - Paste without quotes: `v=spf1 include:amazonses.com ~all`
   - **Verify it starts with:** `v=spf1`

   **TTL:**
   - Select **"1 hour"** or **"3600"**
   - Or leave as **"Automatic"**

5. **Review before saving:**
   - Name = `mail`
   - Value = `v=spf1 include:amazonses.com ~all` (matches Resend)
   - Value has NO quotes at the beginning or end
   - TTL = `1 hour`

6. **Click "Save"** button
   - Modal closes
   - New TXT record appears in the table

7. **Verify the record was added:**
   - Look for a new row:
     - Type = **TXT**
     - Name = **mail**
     - Value = **v=spf1 include:amazonses.com ~all**
     - TTL = **1 hour**

✅ **Success!** Your SPF record is configured.

---

## Part 4: Add DKIM TXT Record

### What is DKIM?
DKIM (DomainKeys Identified Mail) adds a cryptographic signature to your emails, proving they came from your domain and haven't been tampered with. It's essential for email authentication.

### Step 4.1: Get DKIM Record Value from Resend

1. **Switch to the Resend tab**

2. **Find the DKIM record** section
   - Look for **"DKIM"** or **"TXT Record (DKIM)"**

3. **Note the values carefully:**
   - **Name:** Usually something like `resend._domainkey.mail` or `[selector]._domainkey.mail`
   - **Value:** A VERY LONG string starting with `p=MIGfMA0GCSqG...`
   - The value is typically 200-500+ characters long

4. **Prepare to copy the values:**
   - For the **Name field:** Select the entire name (triple-click or Ctrl+A in the field)
   - For the **Value field:** Select the entire long string (triple-click recommended)

### Step 4.2: Add DKIM TXT Record in GoDaddy

1. **Switch back to the GoDaddy DNS Management tab**

2. **Click "Add New Record"** or **"Add"** button again

3. **Select Record Type:**
   - Click the **"Type"** dropdown
   - Select **"TXT"**

4. **Fill in the DKIM TXT Record fields:**

   **Type:** (already set to TXT)
   - Leave as **TXT**

   **Name (or Host):**
   - Copy the EXACT name from Resend
   - Example: `resend._domainkey.mail`
   - **CRITICAL:** Include the `_domainkey` part
   - **CRITICAL:** Copy exactly as shown - character for character
   - GoDaddy will auto-append `.exammer.co.uk`
   - Final result: `resend._domainkey.mail.exammer.co.uk`

   **Value (or TXT Value):**
   - Copy the ENTIRE long string from Resend
   - Starts with: `p=MIGfMA0GCSqGSIb3DQEBAQUAA...`
   - Length: 200-500+ characters
   - **How to copy safely:**
     - Click in the value field in Resend
     - Press **Ctrl+A** (select all)
     - Press **Ctrl+C** (copy)
     - Click in GoDaddy's value field
     - Press **Ctrl+V** (paste)
   - **Do NOT add quotes**
   - **Do NOT add line breaks** or spaces
   - **Do NOT split into multiple lines**

   **TTL:**
   - Select **"1 hour"** or **"3600"**

5. **IMPORTANT: Verify before saving:**
   - **Check the Name field:**
     - Should contain `_domainkey`
     - Should match Resend exactly
     - Example: `resend._domainkey.mail`
   - **Check the Value field:**
     - Should start with `p=`
     - Should be VERY long (200+ characters)
     - Scroll through the value field to ensure it's all there
     - No line breaks or quotes
     - No spaces in the middle

6. **Click "Save"** button
   - Modal closes
   - New TXT record appears

7. **Verify the record was added:**
   - Type = **TXT**
   - Name = **resend._domainkey.mail** (or your specific selector)
   - Value = **p=MIGfMA0GCSqGSIb3...** (very long string)
   - TTL = **1 hour**

8. **Double-check the value:**
   - Click the **Edit** icon (pencil) next to the new DKIM record
   - Scroll through the Value field
   - Verify the entire string was saved
   - Click **Cancel** to close

✅ **Success!** Your DKIM record is configured.

**Note:** If Resend provides multiple DKIM records (different selectors), repeat this process for each one.

---

## Part 5: Add DMARC TXT Record (Optional but Recommended)

### What is DMARC?
DMARC (Domain-based Message Authentication, Reporting, and Conformance) tells email receivers what to do with emails that fail SPF or DKIM checks. It also provides reporting on email authentication.

### Why Add DMARC?
- Improves email deliverability
- Protects against email spoofing and phishing
- Provides visibility into email authentication issues
- Recommended by email security best practices

### Step 5.1: Determine Your DMARC Policy

Choose one of these policies:

**Option 1: Testing/Monitoring (Recommended First)**
- Policy: `p=none`
- Value: `v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk`
- Use for the first 48-72 hours to ensure everything works

**Option 2: Production/Quarantine (After Testing)**
- Policy: `p=quarantine`
- Value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@exammer.co.uk`
- Sends suspicious emails to spam folder

**Option 3: Strict/Reject (After Confirmed Working)**
- Policy: `p=reject`
- Value: `v=DMARC1; p=reject; rua=mailto:dmarc@exammer.co.uk`
- Blocks suspicious emails entirely

**Recommendation:** Start with Option 1 (`p=none`), then upgrade later.

### Step 5.2: Add DMARC TXT Record in GoDaddy

1. **Switch to the GoDaddy DNS Management tab**

2. **Click "Add New Record"** or **"Add"** button

3. **Select Record Type:**
   - Click **"Type"** dropdown
   - Select **"TXT"**

4. **Fill in the DMARC TXT Record fields:**

   **Type:** (already set to TXT)
   - Leave as **TXT**

   **Name (or Host):**
   - Enter: `_dmarc.mail`
   - **Important:** Starts with underscore: `_dmarc.mail`
   - GoDaddy auto-appends `.exammer.co.uk`
   - Final result: `_dmarc.mail.exammer.co.uk`

   **Value (or TXT Value):**
   - Enter your chosen policy (no quotes):
   - **For testing:** `v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk`
   - **For production:** `v=DMARC1; p=quarantine; rua=mailto:dmarc@exammer.co.uk`
   - **For strict:** `v=DMARC1; p=reject; rua=mailto:dmarc@exammer.co.uk`

   **TTL:**
   - Select **"1 hour"** or **"3600"**

5. **Review before saving:**
   - Name = `_dmarc.mail` (starts with underscore)
   - Value = `v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk`
   - No quotes around the value
   - TTL = `1 hour`

6. **Click "Save"** button
   - Modal closes
   - New TXT record appears

7. **Verify the record was added:**
   - Type = **TXT**
   - Name = **_dmarc.mail**
   - Value = **v=DMARC1; p=none; rua=mailto:...**
   - TTL = **1 hour**

✅ **Success!** Your DMARC record is configured.

### Step 5.3: Plan to Upgrade DMARC Policy

**Timeline:**
1. **Days 1-3:** Use `p=none` (monitoring only)
   - Monitor Resend dashboard for delivery issues
   - Check that emails are being sent and delivered
   - Verify no SPF/DKIM authentication errors

2. **After 72 hours of successful delivery:**
   - Edit the DMARC record in GoDaddy
   - Change `p=none` to `p=quarantine`
   - Save the updated record

3. **After several weeks/months of stable operation:**
   - Optionally upgrade to `p=reject` for maximum security

---

## Part 6: Review and Verify

### Step 6.1: Review All DNS Records in GoDaddy

1. **On the GoDaddy DNS Management page**, scroll through your DNS records table

2. **Verify you see these 3-4 new records:**

   **MX Record:**
   ```
   Type: MX
   Name: mail
   Value: feedback-smtp.us-east-1.amazonses.com (or similar)
   Priority: 10
   TTL: 1 hour
   ```

   **SPF TXT Record:**
   ```
   Type: TXT
   Name: mail
   Value: v=spf1 include:amazonses.com ~all
   TTL: 1 hour
   ```

   **DKIM TXT Record:**
   ```
   Type: TXT
   Name: resend._domainkey.mail (or similar)
   Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA... (very long)
   TTL: 1 hour
   ```

   **DMARC TXT Record (if added):**
   ```
   Type: TXT
   Name: _dmarc.mail
   Value: v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk
   TTL: 1 hour
   ```

3. **Double-check each record for accuracy:**
   - Click the **Edit** icon (pencil) next to each record
   - Verify the **Name** matches Resend exactly
   - Verify the **Value** matches Resend exactly
   - Check for typos or extra spaces
   - Click **Cancel** to close (or **Save** if you made corrections)

4. **Note the current time:**
   - Write down the time you finished adding records
   - DNS propagation starts now
   - Typical propagation: 15-60 minutes
   - Maximum: 48 hours (rare)

### Step 6.2: Verify Domain in Resend

**Wait Time:**
- **Minimum:** Wait at least 15 minutes before verifying
- **Recommended:** Wait 30-60 minutes for better results
- **If failed:** Wait up to 24-48 hours, then retry

**Verification Steps:**

1. **Switch to the Resend tab**
   - Go to https://resend.com/domains
   - Find **mail.exammer.co.uk** in your domains list

2. **Click "Verify DNS Records"** button
   - Resend will check your DNS records
   - This takes a few seconds

3. **Check the verification status:**

   **✅ Success (All Green Checkmarks):**
   - All records show green checkmarks ✅
   - Status changes to **"Verified"**
   - You can now send emails from this domain!

   **⚠️ Partial Success (Some Yellow/Red):**
   - Some records verified, others pending
   - Wait longer (DNS might still be propagating)
   - Check the failed records for specific error messages

   **❌ Failed (Red X):**
   - One or more records couldn't be verified
   - Click the failed record to see details
   - See [Common Issues](#common-godaddy-issues-and-solutions) section below

4. **If verification fails:**
   - Wait another 30-60 minutes
   - Click **"Verify DNS Records"** again
   - Resend allows multiple verification attempts for 72 hours

### Step 6.3: Test DNS Propagation (Optional)

You can manually check if DNS records have propagated using online tools or command-line:

**Using Online Tools:**

1. **Go to https://dnschecker.org/**

2. **Check MX Record:**
   - Domain: `mail.exammer.co.uk`
   - Type: **MX**
   - Click **Search**
   - Should show: `feedback-smtp.us-east-1.amazonses.com` with priority 10

3. **Check SPF TXT Record:**
   - Domain: `mail.exammer.co.uk`
   - Type: **TXT**
   - Click **Search**
   - Should show: `v=spf1 include:amazonses.com ~all`

4. **Check DKIM TXT Record:**
   - Domain: `resend._domainkey.mail.exammer.co.uk` (use your exact DKIM subdomain)
   - Type: **TXT**
   - Click **Search**
   - Should show: The long DKIM public key starting with `p=`

5. **Check DMARC TXT Record:**
   - Domain: `_dmarc.mail.exammer.co.uk`
   - Type: **TXT**
   - Click **Search**
   - Should show: `v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk`

**Using Command Line (Windows):**

Open **Command Prompt** or **PowerShell** and run:

```cmd
# Check MX record
nslookup -type=MX mail.exammer.co.uk

# Check SPF TXT record
nslookup -type=TXT mail.exammer.co.uk

# Check DKIM TXT record (replace with your exact DKIM subdomain)
nslookup -type=TXT resend._domainkey.mail.exammer.co.uk

# Check DMARC TXT record
nslookup -type=TXT _dmarc.mail.exammer.co.uk
```

**What to look for:**
- MX record should return the mail server address with priority 10
- TXT records should return the expected values
- If you get "Non-existent domain" or no results, DNS hasn't propagated yet (wait longer)

### Step 6.4: Final Checklist

- [ ] Logged into GoDaddy successfully
- [ ] Accessed DNS Management for exammer.co.uk
- [ ] Added MX record with correct Name, Value, and Priority
- [ ] Added SPF TXT record with correct Name and Value
- [ ] Added DKIM TXT record with correct Name and long Value
- [ ] (Optional) Added DMARC TXT record
- [ ] Reviewed all records in GoDaddy DNS table for accuracy
- [ ] Noted the time DNS changes were made
- [ ] Waited appropriate time for DNS propagation (15-60 minutes minimum)
- [ ] Verified domain in Resend dashboard (all green checkmarks)
- [ ] (Optional) Checked DNS propagation using online tools or nslookup

✅ **All done!** Your domain is now configured for Resend email sending.

---

## Common GoDaddy Issues and Solutions

### Issue 1: "Name" Field Auto-Append Confusion

**Problem:**
- You enter `mail.exammer.co.uk` in the Name field
- GoDaddy appends `.exammer.co.uk` automatically
- Result: `mail.exammer.co.uk.exammer.co.uk` (WRONG - duplicated)

**Solution:**
- Only enter the **subdomain part** in the Name field
- For `mail.exammer.co.uk`, enter just `mail`
- GoDaddy automatically adds `.exammer.co.uk`

**Examples:**
| What You Want | What to Enter in GoDaddy Name Field |
|---------------|-------------------------------------|
| `mail.exammer.co.uk` | `mail` |
| `resend._domainkey.mail.exammer.co.uk` | `resend._domainkey.mail` |
| `_dmarc.mail.exammer.co.uk` | `_dmarc.mail` |

---

### Issue 2: TXT Record Quotes Added

**Problem:**
- You add quotes around the TXT value: `"v=spf1 include:amazonses.com ~all"`
- GoDaddy stores the quotes as part of the value
- DNS returns the value WITH quotes, which breaks SPF validation

**Solution:**
- **Do NOT add quotes** around TXT values in GoDaddy
- Paste the value exactly as shown in Resend, without quotes
- Correct: `v=spf1 include:amazonses.com ~all`
- Wrong: `"v=spf1 include:amazonses.com ~all"`

---

### Issue 3: DKIM Value Truncated

**Problem:**
- The DKIM value is very long (200+ characters)
- You only copied part of it
- Verification fails because the public key is incomplete

**Solution:**
1. **In Resend:** Click in the DKIM value field
2. Press **Ctrl+A** (select all in field)
3. Press **Ctrl+C** (copy)
4. **In GoDaddy:** Click in the Value field
5. Press **Ctrl+V** (paste)
6. **Verify:** Scroll through the entire value in the GoDaddy field to ensure it's all there
7. The value should be 200-500+ characters long

---

### Issue 4: Priority Field Missing or Wrong

**Problem:**
- MX record has no priority set
- Or priority is set to 0 or wrong value
- Email bounces might not route correctly

**Solution:**
- Always set MX record **Priority** to **10** (or value specified by Resend)
- Priority field is required for MX records
- Lower numbers = higher priority (10 is standard)

---

### Issue 5: DNS Verification Fails Immediately

**Problem:**
- You click "Verify DNS Records" in Resend immediately after adding records
- All records show as failed or pending
- DNS hasn't propagated yet

**Solution:**
- **Wait at least 15-30 minutes** before attempting verification
- DNS changes aren't instant - propagation takes time
- GoDaddy changes are usually fast (15-60 minutes), but can take up to 48 hours
- If verification fails, wait longer and retry

---

### Issue 6: Wrong TTL Set

**Problem:**
- TTL set too high (e.g., 1 day or 1 week)
- If you need to change a record, cached values take longer to expire
- Slower troubleshooting if there's an error

**Solution:**
- For initial setup, use **TTL = 1 hour** (3600 seconds)
- This allows faster updates if you need to fix something
- After verification is successful and stable, you can increase TTL to reduce DNS queries
- Recommended final TTL: 1 hour to 1 day

---

### Issue 7: Editing Instead of Adding

**Problem:**
- You accidentally edit an existing DNS record instead of adding a new one
- Existing website or email configuration breaks

**Solution:**
- Always click **"Add New Record"** to create a new record
- Do NOT edit existing A, CNAME, MX, or TXT records unless you know what they're for
- If you accidentally edited a record:
  - Click **Edit** next to the record
  - Change the values back to what they were before
  - Or click **"Undo"** if available immediately after the change

---

### Issue 8: Domain Not Verified in Resend After 72 Hours

**Problem:**
- DNS records added correctly in GoDaddy
- Records propagated (verified with nslookup or dnschecker)
- But Resend still shows "Failed" or "Pending" after 72 hours

**Possible Causes and Solutions:**

1. **Check for typos in values:**
   - Go back to GoDaddy DNS Management
   - Click **Edit** on each Resend-related record
   - Compare character-by-character with Resend's provided values
   - Fix any typos and save

2. **Check for extra spaces or hidden characters:**
   - Copy the value from GoDaddy
   - Paste into a text editor
   - Look for spaces at beginning or end
   - Re-enter the value in GoDaddy without extra spaces

3. **Verify the Name field doesn't have duplication:**
   - Check that Name fields don't show `mail.exammer.co.uk.exammer.co.uk`
   - If duplicated, delete the record and re-add with just the subdomain part

4. **Check nameservers:**
   - In GoDaddy, check that your domain is using GoDaddy nameservers
   - Go to Domain Settings → Nameservers
   - If using custom nameservers (e.g., Cloudflare), you need to add DNS records there instead

5. **Contact Resend Support:**
   - Go to https://resend.com/support
   - Provide your domain name: mail.exammer.co.uk
   - Explain you've added DNS records but verification is failing
   - They can check server-side logs for specific errors

---

### Issue 9: GoDaddy 2-Factor Authentication Problems

**Problem:**
- Can't log into GoDaddy due to 2FA issues
- Lost access to authenticator app or phone

**Solution:**
1. **Use backup codes:**
   - When you set up 2FA, GoDaddy provides backup codes
   - Check your password manager or secure notes for these codes
   - Enter a backup code instead of the authenticator code

2. **Use alternative 2FA method:**
   - Try SMS verification if you set that up as backup
   - Or email verification

3. **Account recovery:**
   - Go to https://www.godaddy.com/help/recover-account
   - Follow the account recovery process
   - May require verifying your identity with support

4. **Contact GoDaddy Support:**
   - Call GoDaddy support (1-480-505-8877 in US)
   - Have your customer ID and domain information ready
   - They can help reset 2FA after verifying your identity

---

### Issue 10: Can't Find "Add New Record" Button

**Problem:**
- On the GoDaddy DNS Management page but can't find how to add records
- Interface looks different than described

**Solution:**
- GoDaddy has different interface versions
- Look for these alternatives:
  - **"Add"** button (top right of records table)
  - **"Add Record"** link
  - **"+" icon** (plus sign)
  - **"Create New Record"**
- Try scrolling down - the button might be at the bottom of the page
- Try different view modes if available (List view vs. Table view)

---

### Issue 11: "DNS Records Locked" or "Protected"

**Problem:**
- GoDaddy won't let you edit DNS records
- Shows message about domain protection or lock

**Solution:**
1. **Check domain lock status:**
   - In GoDaddy, go to Domain Settings
   - Look for "Domain Lock" or "Transfer Lock"
   - This lock prevents domain transfers, not DNS edits (usually not the issue)

2. **Check account permissions:**
   - Make sure you're logged in as the account owner
   - Or that your account has DNS management permissions

3. **Premium DNS or external nameservers:**
   - If using GoDaddy Premium DNS, the interface might be different
   - If nameservers point elsewhere (Cloudflare, etc.), add DNS records there instead

4. **Contact GoDaddy Support** if still unable to edit

---

## Screenshots Reference

**Note:** GoDaddy's interface may vary slightly depending on your account type and region. The following describes what to look for:

### Screenshot 1: GoDaddy Login Page
- **URL:** https://sso.godaddy.com/ or https://account.godaddy.com/
- **Elements:**
  - "Sign In" button (top right)
  - Username/Customer ID field
  - Password field
  - "Sign In" button to submit

### Screenshot 2: My Products Page
- **Location:** After logging in
- **Elements:**
  - Account name in top right
  - "My Products" section
  - List of products including "Domains"
  - Domain list showing your domains including exammer.co.uk

### Screenshot 3: Domain List with Three Dots Menu
- **Elements:**
  - Domain name: exammer.co.uk
  - Three dots (...) icon next to domain
  - Dropdown menu with "Edit DNS" option

### Screenshot 4: DNS Management Page
- **Elements:**
  - Page title: "DNS Management" or "Manage DNS"
  - Domain name: exammer.co.uk (at top)
  - DNS records table with columns: Type, Name, Value, TTL, Priority, Actions
  - "Add New Record" or "Add" button (top right or bottom)
  - Existing DNS records (A, CNAME, etc.)

### Screenshot 5: Add New Record Modal
- **Elements:**
  - Modal title: "Add New Record" or "Add DNS Record"
  - "Type" dropdown (select MX, TXT, etc.)
  - "Name" or "Host" field
  - "Value" or "Points To" field
  - "Priority" field (for MX records)
  - "TTL" dropdown
  - "Save" and "Cancel" buttons

### Screenshot 6: Adding MX Record
- **Filled fields:**
  - Type: MX
  - Name: mail
  - Value: feedback-smtp.us-east-1.amazonses.com
  - Priority: 10
  - TTL: 1 hour

### Screenshot 7: Adding TXT Record (SPF)
- **Filled fields:**
  - Type: TXT
  - Name: mail
  - Value: v=spf1 include:amazonses.com ~all
  - TTL: 1 hour

### Screenshot 8: DNS Records Table After Adding Records
- **Elements:**
  - New MX record visible in table
  - New TXT records visible in table
  - Edit and Delete icons in Actions column

### Screenshot 9: Resend Domain Verification Page
- **URL:** https://resend.com/domains
- **Elements:**
  - Domain name: mail.exammer.co.uk
  - DNS records section showing required records
  - "Verify DNS Records" button
  - Status indicators (green checkmarks or red X's)
  - "Verified" or "Pending" status

---

## Next Steps After DNS Setup

Once your domain is verified in Resend:

1. **Configure your application:**
   - Add Resend API key to your `.env` file
   - Set `EMAIL_FROM=Exammer <notifications@mail.exammer.co.uk>`
   - Restart your development server

2. **Test email sending:**
   - Use your application's signup flow
   - Monitor Resend dashboard for sent emails
   - Check your inbox (including spam folder)

3. **Monitor deliverability:**
   - Check Resend analytics for delivery rates
   - Look for bounces or complaints
   - Adjust DMARC policy if needed

4. **Upgrade DMARC after testing:**
   - After 72 hours of successful delivery
   - Change DMARC policy from `p=none` to `p=quarantine`
   - Edit the DMARC record in GoDaddy

For complete application setup, see the main guide: **RESEND_SETUP_GUIDE.md**

---

## Support Resources

**GoDaddy Support:**
- Help Center: https://www.godaddy.com/help
- Phone Support: 1-480-505-8877 (US)
- Live Chat: Available in account dashboard

**Resend Support:**
- Documentation: https://resend.com/docs
- Support: https://resend.com/support
- Status Page: https://status.resend.com

**DNS Tools:**
- DNS Checker: https://dnschecker.org
- MX Toolbox: https://mxtoolbox.com
- DMARC/DKIM Validator: https://dmarcdkim.com

**Email Testing:**
- Mail Tester: https://mail-tester.com
- Email on Acid: https://www.emailonacid.com

---

## Quick Reference: DNS Records Summary

**For mail.exammer.co.uk:**

| Type | Name | Value | Priority | TTL |
|------|------|-------|----------|-----|
| MX | `mail` | `feedback-smtp.us-east-1.amazonses.com` (check Resend) | 10 | 1 hour |
| TXT | `mail` | `v=spf1 include:amazonses.com ~all` (check Resend) | - | 1 hour |
| TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb...` (check Resend - very long) | - | 1 hour |
| TXT | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk` | - | 1 hour |

**Important Reminders:**
- ✅ Copy values EXACTLY from Resend dashboard (your values may differ)
- ✅ Do NOT add quotes around TXT values
- ✅ Do NOT enter full domain in Name field (GoDaddy auto-appends)
- ✅ Do NOT include trailing dots in values
- ✅ Wait 15-60 minutes after adding records before verifying
- ✅ Use TTL of 1 hour for initial setup (faster troubleshooting)

---

**That's it! You're all set to send emails from exammer.co.uk via Resend.**

If you encounter any issues not covered here, consult the troubleshooting section or reach out to Resend or GoDaddy support.

Good luck!
