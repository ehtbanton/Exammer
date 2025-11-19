# Quick DNS Setup Checklist for exammer.co.uk
## 15-Minute GoDaddy DNS Configuration for Resend

---

## Before You Start

Have these ready:
- [ ] GoDaddy login credentials
- [ ] Resend account created (https://resend.com)
- [ ] Domain added in Resend: mail.exammer.co.uk
- [ ] Two browser tabs open:
  - Tab 1: GoDaddy DNS Management
  - Tab 2: Resend domain DNS records page

---

## Step 1: Access GoDaddy DNS (3 minutes)

1. [ ] Go to https://account.godaddy.com/products
2. [ ] Log in with your credentials
3. [ ] Find exammer.co.uk in the Domains section
4. [ ] Click the three dots (...) next to exammer.co.uk
5. [ ] Select "Edit DNS"
6. [ ] Confirm you see the DNS records table

---

## Step 2: Add MX Record (3 minutes)

1. [ ] Click "Add New Record" button
2. [ ] Select Type: **MX**
3. [ ] Fill in fields:
   - Name: `mail`
   - Value: (copy from Resend - usually `feedback-smtp.us-east-1.amazonses.com`)
   - Priority: `10`
   - TTL: `1 hour`
4. [ ] Click "Save"
5. [ ] Verify new MX record appears in table

---

## Step 3: Add SPF TXT Record (2 minutes)

1. [ ] Click "Add New Record" button
2. [ ] Select Type: **TXT**
3. [ ] Fill in fields:
   - Name: `mail`
   - Value: (copy from Resend - usually `v=spf1 include:amazonses.com ~all`)
   - TTL: `1 hour`
4. [ ] Click "Save"
5. [ ] Verify new TXT record appears

---

## Step 4: Add DKIM TXT Record (3 minutes)

1. [ ] Click "Add New Record" button
2. [ ] Select Type: **TXT**
3. [ ] Fill in fields:
   - Name: (copy EXACT from Resend - usually `resend._domainkey.mail`)
   - Value: (copy ENTIRE long string from Resend - starts with `p=MIG...`)
   - TTL: `1 hour`
4. [ ] **CRITICAL:** Verify entire long value was pasted (scroll through it)
5. [ ] Click "Save"
6. [ ] Verify new TXT record appears

---

## Step 5: Add DMARC TXT Record - OPTIONAL (2 minutes)

1. [ ] Click "Add New Record" button
2. [ ] Select Type: **TXT**
3. [ ] Fill in fields:
   - Name: `_dmarc.mail`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@exammer.co.uk`
   - TTL: `1 hour`
4. [ ] Click "Save"
5. [ ] Verify new TXT record appears

---

## Step 6: Review Records (2 minutes)

Review your DNS table - should show:

- [ ] **MX record:** Type=MX, Name=mail, Priority=10
- [ ] **SPF TXT:** Type=TXT, Name=mail, Value=v=spf1...
- [ ] **DKIM TXT:** Type=TXT, Name=resend._domainkey.mail, Value=p=MIG... (long)
- [ ] **DMARC TXT (optional):** Type=TXT, Name=_dmarc.mail, Value=v=DMARC1...

All records saved? Note the time: ___________

---

## Step 7: Wait for DNS Propagation (15-60 minutes)

- [ ] Wait at least 15 minutes (30 minutes recommended)
- [ ] Optional: Check propagation at https://dnschecker.org

---

## Step 8: Verify Domain in Resend (1 minute)

1. [ ] Go to https://resend.com/domains
2. [ ] Find mail.exammer.co.uk
3. [ ] Click "Verify DNS Records"
4. [ ] Check for green checkmarks on all records
5. [ ] Status should show "Verified"

**If verification fails:**
- [ ] Wait longer (up to 24-48 hours)
- [ ] Retry verification
- [ ] Check troubleshooting section in GODADDY_DNS_SETUP_RESEND.md

---

## Common Mistakes to Avoid

- ❌ **DON'T** enter full domain in Name field (e.g., `mail.exammer.co.uk`)
  - ✅ **DO** enter just the subdomain (e.g., `mail`)
  - GoDaddy auto-appends `.exammer.co.uk`

- ❌ **DON'T** add quotes around TXT values
  - ✅ **DO** paste values without quotes

- ❌ **DON'T** copy only part of the DKIM value
  - ✅ **DO** copy the ENTIRE long DKIM string (200+ characters)

- ❌ **DON'T** verify immediately after adding records
  - ✅ **DO** wait at least 15-30 minutes for DNS propagation

---

## After Verification Success

Next steps:

1. [ ] Add Resend API key to your `.env` file
2. [ ] Set `EMAIL_FROM=Exammer <notifications@mail.exammer.co.uk>`
3. [ ] Restart your development server
4. [ ] Test email sending through your application
5. [ ] Monitor Resend dashboard for sent emails
6. [ ] After 72 hours of successful delivery, upgrade DMARC from `p=none` to `p=quarantine`

See **RESEND_SETUP_GUIDE.md** for complete application configuration.

---

## Need Help?

**Detailed instructions:** GODADDY_DNS_SETUP_RESEND.md

**Troubleshooting:**
- GoDaddy Support: https://www.godaddy.com/help
- Resend Support: https://resend.com/support
- DNS Checker: https://dnschecker.org
- DMARC Validator: https://dmarcdkim.com

---

**Total Time:** 15 minutes active work + 15-60 minutes DNS propagation

**You've got this!**
