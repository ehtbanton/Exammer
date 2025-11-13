import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPayPalService } from '@/lib/paypal/service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for capture requests
const captureSchema = z.object({
  orderId: z.string(),
  amount: z.number(),
  currencyCode: z.string().length(3),
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional(),
  donorMessage: z.string().optional(),
});

// POST /api/donations/capture - Capture a PayPal order and create donation record
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Get current user (if authenticated)
    const user = await getCurrentUser();
    const userId = user?.id || null;

    // Parse and validate request body
    const body = await req.json();
    const validation = captureSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message
        },
        { status: 400 }
      );
    }

    const { orderId, amount, currencyCode, donorName, donorEmail, donorMessage } = validation.data;

    // Capture the PayPal order
    const paypalService = getPayPalService();
    let captureData;

    try {
      captureData = await paypalService.captureOrder(orderId);
    } catch (paypalError) {
      console.error('PayPal capture failed:', paypalError);
      return NextResponse.json(
        {
          success: false,
          error: paypalError instanceof Error ? paypalError.message : 'Failed to capture PayPal payment'
        },
        { status: 500 }
      );
    }

    // Verify the captured amount matches what was sent
    if (Math.abs(captureData.amount - amount) > 0.01) {
      console.error('Amount mismatch:', { expected: amount, received: captureData.amount });
      return NextResponse.json(
        {
          success: false,
          error: 'Payment amount mismatch'
        },
        { status: 400 }
      );
    }

    // Create donation record in database with PAID status
    const result = await db.run<{ lastID: number }>(
      `INSERT INTO donations (
        user_id, amount, currency_code, donor_name, donor_email, donor_message,
        paypal_order_id, payment_capture_id, invoice_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        captureData.amount,
        captureData.currencyCode,
        donorName,
        donorEmail,
        donorMessage,
        captureData.orderId,
        captureData.captureId,
        'PAID'
      ]
    );

    const donationId = result.lastID;

    // Fetch the created donation
    const donation = await db.get<any>(
      'SELECT * FROM donations WHERE id = ?',
      [donationId]
    );

    if (!donation) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch donation after creation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      donation: {
        id: String(donation.id),
        userId: donation.user_id ? String(donation.user_id) : null,
        amount: donation.amount,
        currencyCode: donation.currency_code,
        donorName: donation.donor_name,
        donorEmail: donation.donor_email,
        donorMessage: donation.donor_message,
        paypalOrderId: donation.paypal_order_id,
        paymentCaptureId: donation.payment_capture_id,
        invoiceStatus: donation.invoice_status,
        createdAt: donation.created_at,
        updatedAt: donation.updated_at,
      },
    });
  } catch (error) {
    console.error('Error capturing donation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture donation'
      },
      { status: 500 }
    );
  }
}
