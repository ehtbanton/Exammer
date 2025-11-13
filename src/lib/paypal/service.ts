/**
 * PayPal API Service
 *
 * Handles PayPal REST API integration for creating and capturing orders (donations).
 * Uses Orders API v2 for immediate payment processing.
 * Documentation: https://developer.paypal.com/docs/api/orders/v2/
 */

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
}

interface CreateOrderParams {
  amount: number;
  currencyCode: string;
  description?: string;
}

interface PayPalOrderResponse {
  orderId: string;
  status: string;
}

interface CaptureOrderResponse {
  orderId: string;
  status: string;
  captureId: string;
  amount: number;
  currencyCode: string;
}

class PayPalService {
  private config: PayPalConfig;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox';

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
    }

    this.config = {
      clientId,
      clientSecret,
      mode,
    };

    this.baseUrl = mode === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal OAuth failed: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Set expiry to 90% of actual expiry time for safety
    this.tokenExpiry = Date.now() + (data.expires_in * 1000 * 0.9);

    return this.accessToken;
  }

  /**
   * Create a PayPal order for donation
   * This creates an order that the user will approve and pay through PayPal
   */
  async createOrder(params: CreateOrderParams): Promise<PayPalOrderResponse> {
    const token = await this.getAccessToken();

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: params.description || 'Donation to support Exammer',
          amount: {
            currency_code: params.currencyCode,
            value: params.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'Exammer',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.NEXTAUTH_URL}/donate/success`,
        cancel_url: `${process.env.NEXTAUTH_URL}/donate/cancel`,
      },
    };

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('PayPal order creation failed:', error);
      throw new Error(`Failed to create PayPal order: ${response.statusText}`);
    }

    const order = await response.json();

    return {
      orderId: order.id,
      status: order.status,
    };
  }

  /**
   * Capture payment for an approved order
   * Call this after the user approves the payment on PayPal
   */
  async captureOrder(orderId: string): Promise<CaptureOrderResponse> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('PayPal order capture failed:', error);
      throw new Error(`Failed to capture PayPal order: ${response.statusText}`);
    }

    const captureData = await response.json();

    // Extract capture details
    const capture = captureData.purchase_units[0].payments.captures[0];

    return {
      orderId: captureData.id,
      status: captureData.status,
      captureId: capture.id,
      amount: parseFloat(capture.amount.value),
      currencyCode: capture.amount.currency_code,
    };
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch order');
    }

    return response.json();
  }

  /**
   * Get PayPal Client ID (for frontend SDK)
   */
  getClientId(): string {
    return this.config.clientId;
  }

  /**
   * Get PayPal mode (sandbox or live)
   */
  getMode(): 'sandbox' | 'live' {
    return this.config.mode;
  }
}

// Export singleton instance
let paypalService: PayPalService | null = null;

export function getPayPalService(): PayPalService {
  if (!paypalService) {
    paypalService = new PayPalService();
  }
  return paypalService;
}
