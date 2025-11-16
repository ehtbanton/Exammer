import { NextResponse } from "next/server";

export async function GET() {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: "PayPal configuration is not available" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientId,
    });
  } catch (error) {
    console.error("PayPal config error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve PayPal configuration" },
      { status: 500 }
    );
  }
}
