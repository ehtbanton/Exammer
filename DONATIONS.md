# PayPal Donation Feature Documentation

## Overview

The Exammer donation feature allows users to support the platform through PayPal donations. The feature includes a user-friendly donation button in the header, a multi-step donation modal, and full PayPal invoice integration.

## Features

- **Donation Button**: Prominent "Donate" button with heart icon in the header
- **Multi-Step Modal**: Three-step donation flow
  1. Amount selection (preset amounts + custom input)
  2. Donor information (optional)
  3. Success screen with PayPal invoice link
- **PayPal Integration**: Automatic PayPal invoice generation via REST API
- **Database Tracking**: All donations are stored in the database
- **Authentication Support**: Pre-fills donor info for authenticated users
- **Anonymous Donations**: Allows donations without logging in

## Architecture

### Frontend Components

#### `src/components/DonationButton.tsx`
- Reusable button component
- Opens the donation modal on click
- Configurable size and variant props

#### `src/components/DonationModal.tsx`
- Multi-step form with React Hook Form
- Form validation with Zod
- Three steps: amount selection, donor info, success
- Automatically opens PayPal invoice in new tab
- Mobile responsive design

#### `src/hooks/useDonation.ts`
- Custom React hook for donation logic
- Handles API communication
- Loading and error state management

### Backend

#### `src/app/api/donations/route.ts`
- **POST**: Create donation and generate PayPal invoice
- **GET**: List donations (user's own or all for admins)

#### `src/app/api/donations/[id]/route.ts`
- **GET**: Get single donation details
- **PATCH**: Update donation (for webhook updates)

#### `src/lib/paypal/service.ts`
- PayPal REST API integration
- OAuth token management
- Invoice creation and management
- Handles both sandbox and production modes

#### `src/lib/paypal/config.ts`
- PayPal configuration
- Environment variable validation
- Utility functions (date formatting, currency formatting)

### Database

#### `donations` Table Schema

```sql
CREATE TABLE donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount REAL NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  donor_name TEXT,
  donor_email TEXT,
  donor_message TEXT,
  paypal_invoice_id TEXT,
  paypal_invoice_url TEXT,
  invoice_status TEXT DEFAULT 'DRAFT',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

**Invoice Status Values**:
- `DRAFT`: Donation created, invoice pending
- `SENT`: Invoice created and sent
- `PAID`: Invoice paid (updated via webhook)
- `CANCELLED`: Invoice cancelled
- `REFUNDED`: Payment refunded

## Setup Instructions

### 1. Get PayPal API Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create an application (or use existing)
3. Get your **Client ID** and **Client Secret**
4. For testing, use **Sandbox** credentials
5. For production, use **Live** credentials

### 2. Configure Environment Variables

Create a `.env` file (or update existing) with:

```bash
# PayPal Configuration
PAYPAL_BUSINESS_NAME=Exammer
PAYPAL_BUSINESS_EMAIL=donations@exammer.com
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_MODE=sandbox  # or 'live' for production
```

**Important**: Never commit `.env` file to version control!

### 3. Run Database Migration

```bash
npx ts-node scripts/migrate-donations.ts
```

This creates the `donations` table and necessary indexes.

### 4. Test the Feature

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:8933`
3. Click the "Donate" button in the header
4. Complete the donation flow
5. Verify PayPal invoice opens in new tab

## Usage Examples

### For Users

1. Click the **"Donate"** button in the header
2. Select a preset amount ($5, $10, $25, $50) or enter a custom amount
3. Click **"Continue"**
4. (Optional) Fill in your name, email, and message
5. Click **"Complete Donation"**
6. PayPal invoice opens automatically in a new tab
7. Complete payment on PayPal

### For Developers

#### Create a Donation Programmatically

```typescript
const response = await fetch('/api/donations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 25.00,
    currencyCode: 'USD',
    donorName: 'John Doe',
    donorEmail: 'john@example.com',
    donorMessage: 'Keep up the great work!',
  }),
});

const result = await response.json();
console.log('Invoice URL:', result.invoiceUrl);
```

#### List Donations (Admin Only)

```typescript
const response = await fetch('/api/donations?limit=10&status=PAID');
const donations = await response.json();
```

#### Get Single Donation

```typescript
const response = await fetch('/api/donations/123');
const donation = await response.json();
```

## Testing

### Testing with PayPal Sandbox

1. Set `PAYPAL_MODE=sandbox` in `.env`
2. Use sandbox credentials
3. Create a test donation
4. Log in to [PayPal Sandbox](https://www.sandbox.paypal.com) to verify invoice
5. Use test credit cards to complete payment

### Test Credit Cards (Sandbox)

- **Visa**: 4032039686196102
- **Mastercard**: 5425233430109903
- **Amex**: 374245455400126

**Expiry**: Any future date
**CVV**: Any 3-4 digits

## Webhook Integration (Future Enhancement)

To automatically update donation status when paid:

1. Set up PayPal webhook endpoint: `/api/donations/webhook`
2. Subscribe to `INVOICING.INVOICE.PAID` event
3. Verify webhook signature
4. Update donation status in database

Example webhook handler:

```typescript
// src/app/api/donations/webhook/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.event_type === 'INVOICING.INVOICE.PAID') {
    const invoiceId = body.resource.id;

    await db.run(
      'UPDATE donations SET invoice_status = ? WHERE paypal_invoice_id = ?',
      ['PAID', invoiceId]
    );
  }

  return NextResponse.json({ received: true });
}
```

## Troubleshooting

### "PayPal credentials not configured" Error

**Problem**: Missing PayPal API credentials
**Solution**: Add `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to `.env`

### "Failed to create PayPal invoice" Error

**Problem**: Invalid credentials or network issue
**Solution**:
1. Verify credentials are correct
2. Check `PAYPAL_MODE` matches credential type (sandbox/live)
3. Ensure API application has invoicing permissions
4. Check server logs for detailed error

### Invoice Doesn't Open Automatically

**Problem**: Browser blocked popup
**Solution**: Users can click "Open PayPal Invoice" button in success screen

### "Unauthorized" Error When Listing Donations

**Problem**: User not authenticated
**Solution**: Only authenticated users can view donations

## Security Considerations

1. **API Credentials**: Never expose PayPal credentials in client code
2. **Input Validation**: All amounts and inputs are validated server-side
3. **SQL Injection**: Parameterized queries prevent SQL injection
4. **XSS Prevention**: Donor messages are sanitized
5. **Rate Limiting**: Consider adding rate limiting to prevent abuse
6. **Authentication**: Donations are linked to users when authenticated

## Future Enhancements

- [ ] Webhook integration for automatic status updates
- [ ] Recurring donations (subscription model)
- [ ] Donation history page for users
- [ ] Admin dashboard with analytics
- [ ] Email notifications for donations
- [ ] Tax receipt generation
- [ ] Multiple currency support
- [ ] Donation goals/progress tracker
- [ ] Public donation wall (with donor permission)

## API Reference

### POST /api/donations

Create a new donation and generate PayPal invoice.

**Request Body**:
```json
{
  "amount": 25.00,
  "currencyCode": "USD",
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "donorMessage": "Keep up the great work!"
}
```

**Response** (Success):
```json
{
  "success": true,
  "donation": {
    "id": "123",
    "amount": 25.00,
    "currencyCode": "USD",
    "invoiceStatus": "SENT",
    // ... other fields
  },
  "invoiceUrl": "https://www.sandbox.paypal.com/invoice/p/..."
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Failed to create PayPal invoice"
}
```

### GET /api/donations

List donations (user's own or all for admins).

**Query Parameters**:
- `status`: Filter by invoice status
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response**:
```json
[
  {
    "id": "123",
    "userId": "456",
    "amount": 25.00,
    "currencyCode": "USD",
    "invoiceStatus": "PAID",
    // ... other fields
  }
]
```

### GET /api/donations/[id]

Get a single donation by ID.

**Response**:
```json
{
  "id": "123",
  "userId": "456",
  "amount": 25.00,
  "currencyCode": "USD",
  "donorName": "John Doe",
  "donorEmail": "john@example.com",
  "donorMessage": "Keep up the great work!",
  "paypalInvoiceId": "INV2-XXXX-XXXX-XXXX-XXXX",
  "paypalInvoiceUrl": "https://www.sandbox.paypal.com/invoice/p/...",
  "invoiceStatus": "PAID",
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

### PATCH /api/donations/[id]

Update donation (typically used by webhooks).

**Request Body**:
```json
{
  "invoiceStatus": "PAID",
  "paypalInvoiceId": "INV2-XXXX-XXXX-XXXX-XXXX",
  "paypalInvoiceUrl": "https://..."
}
```

## Support

For issues or questions:
1. Check this documentation first
2. Review server logs for errors
3. Check PayPal Developer Dashboard for API status
4. Open an issue on GitHub

## License

This feature is part of the Exammer project and follows the same license.
