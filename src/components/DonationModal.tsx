"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { X, Heart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

const PRESET_AMOUNTS = [5, 10, 25, 50];

interface Currency {
  code: string;
  symbol: string;
  name: string;
}

const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
];

// Map locale regions to currency codes
const LOCALE_TO_CURRENCY: { [key: string]: string } = {
  US: "USD",
  GB: "GBP",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  PT: "EUR",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  SG: "SGD",
  HK: "HKD",
};

function detectCurrencyFromLocale(): string {
  try {
    const locale = navigator.language || "en-US";
    const region = locale.split("-")[1]?.toUpperCase();

    if (region && LOCALE_TO_CURRENCY[region]) {
      return LOCALE_TO_CURRENCY[region];
    }

    // Default to USD
    return "USD";
  } catch {
    return "USD";
  }
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>(1);
  const [currency, setCurrency] = useState<string>(detectCurrencyFromLocale());
  const [amount, setAmount] = useState<number>(25);
  const [isCustomSelected, setIsCustomSelected] = useState<boolean>(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [includeUserInfo, setIncludeUserInfo] = useState<boolean>(true);
  const [donorName, setDonorName] = useState<string>("");
  const [donorEmail, setDonorEmail] = useState<string>("");
  const [donorMessage, setDonorMessage] = useState<string>("");
  const [isPayPalLoaded, setIsPayPalLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");

  // Get current currency symbol
  const getCurrencySymbol = () => {
    return CURRENCIES.find((c) => c.code === currency)?.symbol || "$";
  };

  // Get donor name for display/submission
  const getDonorName = () => {
    if (session?.user && includeUserInfo) {
      return session.user.name || "";
    }
    return donorName;
  };

  // Get donor email for display/submission
  const getDonorEmail = () => {
    if (session?.user && includeUserInfo) {
      return session.user.email || "";
    }
    return donorEmail;
  };

  // Load PayPal SDK when modal opens (reload if currency changes)
  useEffect(() => {
    // Clear existing PayPal SDK if currency changed
    if (window.paypal && isPayPalLoaded) {
      setIsPayPalLoaded(false);
      const existingScript = document.querySelector('script[src*="paypal.com/sdk"]');
      if (existingScript) {
        existingScript.remove();
      }
      delete window.paypal;
    }

    if (isOpen && !isPayPalLoaded && !window.paypal) {
      loadPayPalSDK();
    }
  }, [isOpen, currency]);

  const loadPayPalSDK = async () => {
    try {
      const response = await fetch("/api/paypal-config");
      if (!response.ok) throw new Error("Failed to load PayPal config");

      const { clientId } = await response.json();

      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}`;
      script.async = true;
      script.onload = () => setIsPayPalLoaded(true);
      script.onerror = () => setError("Failed to load PayPal. Please try again.");
      document.body.appendChild(script);
    } catch (err) {
      setError("Failed to initialize payment system. Please try again later.");
      console.error("PayPal SDK load error:", err);
    }
  };

  // Render PayPal buttons when step 2 is reached
  useEffect(() => {
    if (step === 2 && isPayPalLoaded && window.paypal) {
      renderPayPalButtons();
    }
  }, [step, isPayPalLoaded, amount, currency]);

  const renderPayPalButtons = () => {
    const container = document.getElementById("paypal-button-container");
    if (!container || !window.paypal) return;

    // Clear existing buttons
    container.innerHTML = "";

    window.paypal
      .Buttons({
        style: {
          label: "donate",
          color: "blue",
        },
        createOrder: async (data: any, actions: any) => {
          try {
            // Create order on server
            const response = await fetch("/api/paypal-create-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                amount: amount,
                currency: currency,
              }),
            });

            if (!response.ok) {
              throw new Error("Failed to create order");
            }

            const orderData = await response.json();
            return orderData.orderID;
          } catch (err) {
            console.error("Order creation error:", err);
            setError("Failed to create order. Please try again.");
            throw err;
          }
        },
        onApprove: async (data: any, actions: any) => {
          setIsProcessing(true);
          try {
            // Capture the order on server
            const response = await fetch("/api/paypal-capture-order", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderID: data.orderID,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error("Capture error:", errorData);
              throw new Error(errorData.error || "Failed to capture payment");
            }

            const captureData = await response.json();

            if (captureData.success) {
              // Show success
              setStep(3);
            } else {
              throw new Error("Payment capture was not successful");
            }

            setIsProcessing(false);
          } catch (err) {
            setError("Payment processing failed. Please try again.");
            setIsProcessing(false);
            console.error("Payment capture error:", err);
          }
        },
        onError: (err: any) => {
          setError("An error occurred with PayPal. Please try again.");
          setIsProcessing(false);
          console.error("PayPal error:", err);
        },
        onCancel: () => {
          setError("Payment was cancelled.");
          setIsProcessing(false);
        },
      })
      .render("#paypal-button-container");
  };

  const handleAmountSelect = (selectedAmount: number) => {
    setAmount(selectedAmount);
    setIsCustomSelected(false);
    setCustomAmount("");
  };

  const handleCustomSelect = () => {
    setIsCustomSelected(true);
    // If there's already a custom amount entered, use it
    if (customAmount) {
      const numValue = parseFloat(customAmount);
      if (!isNaN(numValue) && numValue > 0) {
        setAmount(numValue);
      } else {
        setAmount(0); // Invalid amount
      }
    } else {
      setAmount(0); // No custom amount yet
    }
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setAmount(numValue);
    } else {
      setAmount(0);
    }
  };

  const handleContinueToPayment = () => {
    if (amount < 0.01) {
      setError("Please enter an amount of at least $0.01");
      return;
    }
    if (amount > 100000) {
      setError("Maximum donation amount is $100,000");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleClose = () => {
    setStep(1);
    setAmount(25);
    setIsCustomSelected(false);
    setCustomAmount("");
    setDonorMessage("");
    setError("");
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            {step === 1 && "Support Exammer"}
            {step === 2 && "Complete Your Donation"}
            {step === 3 && "Thank You!"}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full ${
                s <= step ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Step 1: Amount Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-muted-foreground mb-4">
                Your donation helps keep Exammer free and accessible for everyone.
                Every contribution makes a difference!
              </p>
            </div>

            {/* Currency Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-3 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.symbol} {curr.name} ({curr.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Selection Buttons */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Amount
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PRESET_AMOUNTS.map((preset) => (
                  <Button
                    key={preset}
                    variant={amount === preset && !isCustomSelected ? "default" : "outline"}
                    onClick={() => handleAmountSelect(preset)}
                    className="h-14 text-lg font-semibold"
                  >
                    {getCurrencySymbol()}{preset}
                  </Button>
                ))}
                <Button
                  variant={isCustomSelected ? "default" : "outline"}
                  onClick={handleCustomSelect}
                  className="h-14 text-lg font-semibold"
                >
                  Custom
                </Button>
              </div>
            </div>

            {/* Custom Amount Input (only shown when Custom is selected) */}
            {isCustomSelected && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Enter Custom Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold">
                    {getCurrencySymbol()}
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    max="100000"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    className={`w-full pl-8 pr-4 py-3 text-lg border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background ${
                      customAmount && amount < 0.01 ? "border-red-500" : ""
                    }`}
                  />
                </div>
                {customAmount && amount < 0.01 && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                    Minimum donation amount is {getCurrencySymbol()}0.01
                  </p>
                )}
                {!customAmount && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Minimum: {getCurrencySymbol()}0.01 • Maximum: {getCurrencySymbol()}100,000
                  </p>
                )}
              </div>
            )}

            {/* Optional Info */}
            <div className="space-y-4 border-t pt-4">
              {session?.user ? (
                // Logged in: Show checkbox to include user info
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="includeUserInfo"
                    checked={includeUserInfo}
                    onChange={(e) => setIncludeUserInfo(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                  />
                  <label htmlFor="includeUserInfo" className="text-sm cursor-pointer">
                    <span className="font-medium">Include my name and email with this donation</span>
                    {includeUserInfo && session.user.name && (
                      <span className="block text-muted-foreground mt-1">
                        {session.user.name} ({session.user.email})
                      </span>
                    )}
                  </label>
                </div>
              ) : (
                // Not logged in: Show optional input fields
                <>
                  <p className="text-sm text-muted-foreground">
                    Optional: Let us know who you are
                  </p>
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <input
                      type="text"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={donorMessage}
                  onChange={(e) => setDonorMessage(e.target.value)}
                  placeholder="Leave a message of support..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {donorMessage.length}/500 characters
                </p>
              </div>
            </div>

            <Button
              onClick={handleContinueToPayment}
              className="w-full h-12 text-lg font-semibold"
              disabled={amount < 0.01}
            >
              Continue to Payment • {getCurrencySymbol()}{amount.toFixed(2)}
            </Button>
          </div>
        )}

        {/* Step 2: PayPal Payment */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Donation Amount:</span>
                <span className="text-2xl font-bold">{getCurrencySymbol()}{amount.toFixed(2)}</span>
              </div>
              {getDonorName() && (
                <div className="text-sm text-muted-foreground">
                  From: {getDonorName()}
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                <p className="text-muted-foreground">Processing your donation...</p>
              </div>
            )}

            {!isProcessing && (
              <>
                <div id="paypal-button-container" className="min-h-[200px]" />
                {!isPayPalLoaded && (
                  <div className="text-center py-8">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                    <p className="text-muted-foreground">Loading payment options...</p>
                  </div>
                )}
              </>
            )}

            <Button variant="outline" onClick={() => setStep(1)} className="w-full">
              Back to Amount Selection
            </Button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-2">
                Thank you for your {getCurrencySymbol()}{amount.toFixed(2)} donation!
              </h3>
              <p className="text-muted-foreground">
                Your generous contribution helps us keep Exammer free and continuously improving.
              </p>
            </div>

            <div className="bg-muted p-6 rounded-lg text-left space-y-3">
              <p className="font-semibold">Your donation helps us:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Keep the platform free for all students and teachers</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Cover server and infrastructure costs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Develop new features and improvements</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Maintain and expand our question database</span>
                </li>
              </ul>
            </div>

            <Button onClick={handleClose} className="w-full h-12 text-lg font-semibold">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
