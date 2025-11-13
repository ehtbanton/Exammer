"use client";

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heart, ArrowLeft, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from './LoadingSpinner';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DonationStep = 'amount' | 'payment' | 'success';

const PRESET_AMOUNTS = [5, 10, 25, 50];

const donationFormSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least $1').max(100000, 'Amount cannot exceed $100,000'),
  customAmount: z.string().optional(),
  donorName: z.string().max(100).optional(),
  donorEmail: z.string().email('Invalid email address').max(100).optional().or(z.literal('')),
  donorMessage: z.string().max(500).optional(),
});

type DonationFormData = z.infer<typeof donationFormSchema>;

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const { data: session } = useSession();
  const [step, setStep] = useState<DonationStep>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [donationId, setDonationId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    getValues,
  } = useForm<DonationFormData>({
    resolver: zodResolver(donationFormSchema),
    defaultValues: {
      amount: 0,
      donorName: '',
      donorEmail: '',
      donorMessage: '',
    },
  });

  // Load PayPal SDK when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadPayPalSDK = async () => {
      try {
        // Fetch PayPal config from backend
        const response = await fetch('/api/paypal-config');
        const config = await response.json();
        setPaypalClientId(config.clientId);

        // Check if SDK is already loaded
        if (window.paypal) {
          return;
        }

        // Load PayPal SDK script
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${config.clientId}&currency=USD`;
        script.async = true;
        document.body.appendChild(script);
      } catch (err) {
        console.error('Failed to load PayPal SDK:', err);
        setError('Failed to load PayPal. Please try again.');
      }
    };

    loadPayPalSDK();
  }, [isOpen]);

  // Pre-fill user info if authenticated
  useEffect(() => {
    if (session?.user) {
      setValue('donorName', session.user.name || '');
      setValue('donorEmail', session.user.email || '');
    }
  }, [session, setValue]);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('amount');
        setSelectedAmount(null);
        setCustomAmountInput('');
        setDonationId(null);
        setError(null);
        setIsProcessing(false);
        reset();
      }, 300);
    }
  }, [isOpen, reset]);

  // Render PayPal buttons when step changes to 'payment'
  useEffect(() => {
    if (step !== 'payment' || !window.paypal || !paypalButtonsRef.current) {
      return;
    }

    const amount = selectedAmount || parseFloat(customAmountInput || '0');
    if (amount <= 0) return;

    // Clear any existing buttons
    paypalButtonsRef.current.innerHTML = '';

    // Render PayPal buttons
    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 45,
      },
      createOrder: (data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            description: 'Donation to support Exammer',
            amount: {
              currency_code: 'USD',
              value: amount.toFixed(2),
            },
          }],
        });
      },
      onApprove: async (data: any, actions: any) => {
        setIsProcessing(true);
        setError(null);

        try {
          // Capture the payment on the backend
          const formData = getValues();
          const response = await fetch('/api/donations/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderID,
              amount: amount,
              currencyCode: 'USD',
              donorName: formData.donorName || undefined,
              donorEmail: formData.donorEmail || undefined,
              donorMessage: formData.donorMessage || undefined,
            }),
          });

          const result = await response.json();

          if (result.success && result.donation) {
            setDonationId(result.donation.id);
            setStep('success');
          } else {
            throw new Error(result.error || 'Failed to process donation');
          }
        } catch (err) {
          console.error('Payment capture failed:', err);
          setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
        } finally {
          setIsProcessing(false);
        }
      },
      onError: (err: any) => {
        console.error('PayPal error:', err);
        setError('Payment failed. Please try again.');
        setIsProcessing(false);
      },
      onCancel: () => {
        setError('Payment cancelled.');
        setIsProcessing(false);
      },
    }).render(paypalButtonsRef.current);
  }, [step, selectedAmount, customAmountInput, getValues]);

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmountInput('');
    setValue('amount', amount);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmountInput(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setSelectedAmount(null);
      setValue('amount', numValue);
    }
  };

  const handleContinueToPayment = () => {
    if (selectedAmount || (customAmountInput && parseFloat(customAmountInput) > 0)) {
      setStep('payment');
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[750px] max-h-[90vh] overflow-y-auto">
        {/* Step 1: Amount Selection */}
        {step === 'amount' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Support Exammer
              </DialogTitle>
              <DialogDescription>
                Your donation helps us keep Exammer free and improve our educational tools for students worldwide.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Select an amount</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_AMOUNTS.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant={selectedAmount === amount ? 'default' : 'outline'}
                      className="h-14 text-lg font-semibold"
                      onClick={() => handleAmountSelect(amount)}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="customAmount" className="text-base font-semibold mb-2 block">
                  Or enter a custom amount
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="customAmount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7 h-12 text-lg"
                    value={customAmountInput}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="donorName">Your Name (Optional)</Label>
                <Input
                  id="donorName"
                  placeholder="John Doe"
                  {...register('donorName')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="donorEmail">Email (Optional)</Label>
                <Input
                  id="donorEmail"
                  type="email"
                  placeholder="john@example.com"
                  {...register('donorEmail')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="donorMessage">Message (Optional)</Label>
                <Textarea
                  id="donorMessage"
                  placeholder="Leave a message of support..."
                  rows={3}
                  {...register('donorMessage')}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleContinueToPayment}
                disabled={!selectedAmount && !customAmountInput}
              >
                Continue to Payment
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: PayPal Payment */}
        {step === 'payment' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Complete Your Donation
              </DialogTitle>
              <DialogDescription>
                You're donating ${selectedAmount || parseFloat(customAmountInput || '0').toFixed(2)}
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Donation Amount</p>
                <p className="text-3xl font-bold text-primary">
                  ${selectedAmount || parseFloat(customAmountInput || '0').toFixed(2)}
                </p>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <LoadingSpinner />
                  <p className="mt-4 text-sm text-muted-foreground">Processing your donation...</p>
                </div>
              ) : (
                <>
                  <div className="text-center text-sm text-muted-foreground mb-2">
                    Click the PayPal button below to complete your donation
                  </div>
                  <div ref={paypalButtonsRef} className="min-h-[150px] w-full"></div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button
                onClick={() => setStep('amount')}
                variant="outline"
                disabled={isProcessing}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                Thank You!
              </DialogTitle>
              <DialogDescription>
                Your donation has been successfully processed.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Donation Amount</p>
                <p className="text-3xl font-bold text-primary">
                  ${selectedAmount || parseFloat(customAmountInput || '0').toFixed(2)}
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                <p className="text-sm text-green-900 dark:text-green-100 mb-2">
                  <strong>Payment Successful!</strong>
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Thank you for your generous donation. Your support helps us keep Exammer free for all students.
                </p>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>Your support helps us:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Keep Exammer free for all students</li>
                  <li>Add new features and improve the platform</li>
                  <li>Cover server and infrastructure costs</li>
                  <li>Support educational initiatives</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
