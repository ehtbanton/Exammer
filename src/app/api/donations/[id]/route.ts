import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, getUserWithAccessLevel } from '@/lib/auth-helpers';
import type { Donation } from '@/lib/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for updating donation with PayPal info
const updateDonationSchema = z.object({
  paypalInvoiceId: z.string().optional(),
  paypalInvoiceUrl: z.string().url().optional(),
  invoiceStatus: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'REFUNDED']).optional(),
});

// GET /api/donations/[id] - Get a single donation
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const donationId = params.id;

    // Get the donation
    const donation = await db.get<any>(
      'SELECT * FROM donations WHERE id = ?',
      [donationId]
    );

    if (!donation) {
      return NextResponse.json(
        { error: 'Donation not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view this donation
    const fullUser = await getUserWithAccessLevel(user.id);
    const isAdmin = fullUser?.access_level === 3;
    const isOwner = donation.user_id && String(donation.user_id) === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Transform to Donation type
    const donationResponse: Donation = {
      id: String(donation.id),
      userId: donation.user_id ? String(donation.user_id) : null,
      amount: donation.amount,
      currencyCode: donation.currency_code,
      donorName: donation.donor_name,
      donorEmail: donation.donor_email,
      donorMessage: donation.donor_message,
      paypalInvoiceId: donation.paypal_invoice_id,
      paypalInvoiceUrl: donation.paypal_invoice_url,
      invoiceStatus: donation.invoice_status,
      createdAt: donation.created_at,
      updatedAt: donation.updated_at,
    };

    return NextResponse.json(donationResponse);
  } catch (error) {
    console.error('Error fetching donation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch donation' },
      { status: 500 }
    );
  }
}

// PATCH /api/donations/[id] - Update a donation with PayPal invoice information
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const donationId = params.id;

    // Parse and validate request body
    const body = await req.json();
    const validation = updateDonationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message
        },
        { status: 400 }
      );
    }

    const { paypalInvoiceId, paypalInvoiceUrl, invoiceStatus } = validation.data;

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const params: any[] = [];

    if (paypalInvoiceId !== undefined) {
      updates.push('paypal_invoice_id = ?');
      params.push(paypalInvoiceId);
    }

    if (paypalInvoiceUrl !== undefined) {
      updates.push('paypal_invoice_url = ?');
      params.push(paypalInvoiceUrl);
    }

    if (invoiceStatus !== undefined) {
      updates.push('invoice_status = ?');
      params.push(invoiceStatus);
    }

    // Always update updated_at timestamp
    updates.push('updated_at = unixepoch()');

    if (updates.length === 1) { // Only updated_at, no actual updates
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add donation ID to params
    params.push(donationId);

    // Execute update
    await db.run(
      `UPDATE donations SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated donation
    const updatedDonation = await db.get<any>(
      'SELECT * FROM donations WHERE id = ?',
      [donationId]
    );

    if (!updatedDonation) {
      return NextResponse.json(
        { success: false, error: 'Donation not found after update' },
        { status: 404 }
      );
    }

    // Transform to Donation type
    const donationResponse: Donation = {
      id: String(updatedDonation.id),
      userId: updatedDonation.user_id ? String(updatedDonation.user_id) : null,
      amount: updatedDonation.amount,
      currencyCode: updatedDonation.currency_code,
      donorName: updatedDonation.donor_name,
      donorEmail: updatedDonation.donor_email,
      donorMessage: updatedDonation.donor_message,
      paypalInvoiceId: updatedDonation.paypal_invoice_id,
      paypalInvoiceUrl: updatedDonation.paypal_invoice_url,
      invoiceStatus: updatedDonation.invoice_status,
      createdAt: updatedDonation.created_at,
      updatedAt: updatedDonation.updated_at,
    };

    return NextResponse.json({
      success: true,
      donation: donationResponse
    });
  } catch (error) {
    console.error('Error updating donation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update donation'
      },
      { status: 500 }
    );
  }
}
