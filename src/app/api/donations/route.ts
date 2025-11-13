import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, getUserWithAccessLevel } from '@/lib/auth-helpers';
import { paypalConfig, getDefaultDueDate } from '@/lib/paypal/config';
import { getPayPalService } from '@/lib/paypal/service';
import type { CreateDonationRequest, CreateDonationResponse, Donation } from '@/lib/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for donation requests
const createDonationSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least $1').max(100000, 'Amount cannot exceed $100,000'),
  currencyCode: z.string().length(3).optional().default('USD'),
  donorName: z.string().max(100).optional(),
  donorEmail: z.string().email().max(100).optional(),
  donorMessage: z.string().max(500).optional(),
});

// POST /api/donations - Create a new donation and generate PayPal invoice
export async function POST(req: NextRequest): Promise<NextResponse<CreateDonationResponse>> {
  try {
    // Get current user (if authenticated) - donations can be made by anonymous users too
    const user = await getCurrentUser();
    const userId = user?.id || null;

    // Parse and validate request body
    const body = await req.json();
    const validation = createDonationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message
        },
        { status: 400 }
      );
    }

    const { amount, currencyCode, donorName, donorEmail, donorMessage } = validation.data;

    // Use authenticated user's info if not provided
    let finalDonorName = donorName;
    let finalDonorEmail = donorEmail;

    if (user) {
      finalDonorName = donorName || user.name || undefined;
      finalDonorEmail = donorEmail || user.email || undefined;
    }

    // Note: With PayPal SDK integration, the order creation happens on the frontend
    // This endpoint just validates and prepares the donation data
    // The actual PayPal order is created by the frontend SDK

    return NextResponse.json({
      success: true,
      amount,
      currencyCode,
      donorName: finalDonorName,
      donorEmail: finalDonorEmail,
    });
  } catch (error) {
    console.error('Error creating donation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create donation'
      },
      { status: 500 }
    );
  }
}

// GET /api/donations - List all donations (admin only) or user's donations
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get full user data including access level
    const fullUser = await getUserWithAccessLevel(user.id);
    const isAdmin = fullUser?.access_level === 3;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = 'SELECT * FROM donations';
    const params: any[] = [];

    if (!isAdmin) {
      // Regular users can only see their own donations
      query += ' WHERE user_id = ?';
      params.push(user.id);
    }

    if (status) {
      query += isAdmin ? ' WHERE' : ' AND';
      query += ' invoice_status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const donations = await db.all<any>(query, params);

    // Transform to Donation type
    const transformedDonations: Donation[] = donations.map((d: any) => ({
      id: String(d.id),
      userId: d.user_id ? String(d.user_id) : null,
      amount: d.amount,
      currencyCode: d.currency_code,
      donorName: d.donor_name,
      donorEmail: d.donor_email,
      donorMessage: d.donor_message,
      paypalInvoiceId: d.paypal_invoice_id,
      paypalInvoiceUrl: d.paypal_invoice_url,
      invoiceStatus: d.invoice_status,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    return NextResponse.json(transformedDonations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch donations' },
      { status: 500 }
    );
  }
}
