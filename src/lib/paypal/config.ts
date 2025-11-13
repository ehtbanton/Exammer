/**
 * PayPal Configuration Module
 *
 * Centralizes PayPal configuration and validates required environment variables.
 */

export interface PayPalConfig {
  businessName: string;
  businessEmail: string;
}

function validatePayPalConfig(): PayPalConfig {
  const businessName = process.env.PAYPAL_BUSINESS_NAME;
  const businessEmail = process.env.PAYPAL_BUSINESS_EMAIL;

  if (!businessName) {
    console.warn('PAYPAL_BUSINESS_NAME not set in environment variables. Using default.');
  }

  if (!businessEmail) {
    console.warn('PAYPAL_BUSINESS_EMAIL not set in environment variables. Using default.');
  }

  return {
    businessName: businessName || 'Exammer',
    businessEmail: businessEmail || 'donations@exammer.com',
  };
}

export const paypalConfig = validatePayPalConfig();

/**
 * Get the default due date for PayPal invoices (30 days from now)
 */
export function getDefaultDueDate(): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  // Format as YYYY-MM-DD
  const year = dueDate.getFullYear();
  const month = String(dueDate.getMonth() + 1).padStart(2, '0');
  const day = String(dueDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}
