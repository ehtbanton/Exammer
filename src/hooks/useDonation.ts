import { useState, useCallback } from 'react';
import type { CreateDonationRequest } from '@/lib/types';

interface DonationHookResult {
  createDonation: (data: CreateDonationRequest) => Promise<CreateDonationResult>;
  isLoading: boolean;
  error: string | null;
}

interface CreateDonationResult {
  success: boolean;
  donationId?: string;
  invoiceUrl?: string;
  error?: string;
}

export function useDonation(): DonationHookResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDonation = useCallback(async (data: CreateDonationRequest): Promise<CreateDonationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create donation record in database
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create donation');
      }

      const { donation, invoiceUrl } = result;

      return {
        success: true,
        donationId: donation.id,
        invoiceUrl: invoiceUrl || undefined,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createDonation,
    isLoading,
    error,
  };
}
