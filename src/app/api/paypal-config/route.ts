import { NextResponse } from 'next/server';
import { getPayPalService } from '@/lib/paypal/service';

export const dynamic = 'force-dynamic';

// GET /api/paypal-config - Get PayPal client configuration for frontend SDK
export async function GET(): Promise<NextResponse> {
  try {
    const paypalService = getPayPalService();

    return NextResponse.json({
      clientId: paypalService.getClientId(),
      mode: paypalService.getMode(),
    });
  } catch (error) {
    console.error('Error getting PayPal config:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get PayPal configuration'
      },
      { status: 500 }
    );
  }
}
