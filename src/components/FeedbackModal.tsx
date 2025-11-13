"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MessageSquare,
  Bug,
  Lightbulb,
  TrendingUp,
  HelpCircle,
  MoreHorizontal,
  Camera,
  Check,
  ArrowLeft,
  X,
} from 'lucide-react';
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
import { useScreenshot } from '@/hooks/useScreenshot';
import type { FeedbackCategory } from '@/lib/types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackStep = 'category' | 'details' | 'success';

const feedbackFormSchema = z.object({
  category: z.enum(['bug', 'feature', 'improvement', 'question', 'other']),
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().min(1, 'Description is required').max(5000, 'Description cannot exceed 5000 characters'),
});

type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

const CATEGORY_OPTIONS = [
  {
    value: 'bug' as FeedbackCategory,
    label: 'Bug Report',
    icon: Bug,
    description: 'Something isn\'t working correctly',
    color: 'text-red-500',
  },
  {
    value: 'feature' as FeedbackCategory,
    label: 'Feature Request',
    icon: Lightbulb,
    description: 'Suggest a new feature',
    color: 'text-yellow-500',
  },
  {
    value: 'improvement' as FeedbackCategory,
    label: 'Improvement',
    icon: TrendingUp,
    description: 'Suggest an enhancement',
    color: 'text-blue-500',
  },
  {
    value: 'question' as FeedbackCategory,
    label: 'Question',
    icon: HelpCircle,
    description: 'Ask a question',
    color: 'text-purple-500',
  },
  {
    value: 'other' as FeedbackCategory,
    label: 'Other',
    icon: MoreHorizontal,
    description: 'Something else',
    color: 'text-gray-500',
  },
];

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { data: session } = useSession();
  const [step, setStep] = useState<FeedbackStep>('category');
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { screenshot, isCapturing, captureScreenshot, clearScreenshot } = useScreenshot();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      category: 'bug',
      title: '',
      description: '',
    },
  });

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('category');
        setSelectedCategory(null);
        setError(null);
        setIsSubmitting(false);
        clearScreenshot();
        reset();
      }, 300);
    }
  }, [isOpen, reset, clearScreenshot]);

  const handleCategorySelect = (category: FeedbackCategory) => {
    setSelectedCategory(category);
    setValue('category', category);
    setStep('details');
  };

  const handleCaptureScreenshot = async () => {
    // Close modal temporarily to capture screenshot without modal
    const tempClose = () => {
      const modalElement = document.querySelector('[role="dialog"]');
      if (modalElement) {
        (modalElement as HTMLElement).style.display = 'none';
      }
    };

    const tempOpen = () => {
      const modalElement = document.querySelector('[role="dialog"]');
      if (modalElement) {
        (modalElement as HTMLElement).style.display = '';
      }
    };

    tempClose();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for modal to hide

    await captureScreenshot({
      quality: 0.8,
      removeElements: [], // Modal is already hidden
    });

    tempOpen();
  };

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Get browser info
      const browserInfo = JSON.stringify({
        userAgent: navigator.userAgent,
        language: navigator.language,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height,
        },
      });

      // Submit feedback
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: data.category,
          title: data.title,
          description: data.description,
          url: window.location.href,
          screenshotUrl: screenshot || undefined,
          browserInfo,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStep('success');
      } else {
        throw new Error(result.error || 'Failed to submit feedback');
      }
    } catch (err) {
      console.error('Feedback submission failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const getCategoryOption = () => {
    return CATEGORY_OPTIONS.find(opt => opt.value === selectedCategory);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[750px] max-h-[90vh] overflow-y-auto">
        {/* Step 1: Category Selection */}
        {step === 'category' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Send Feedback
              </DialogTitle>
              <DialogDescription>
                Help us improve Exammer by sharing your feedback, reporting bugs, or suggesting new features.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label className="text-base font-semibold mb-3 block">What type of feedback?</Label>
              <div className="grid grid-cols-1 gap-3">
                {CATEGORY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      className="h-auto py-4 justify-start text-left hover:bg-accent"
                      onClick={() => handleCategorySelect(option.value)}
                    >
                      <Icon className={`h-5 w-5 mr-3 flex-shrink-0 ${option.color}`} />
                      <div className="flex-1">
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} variant="outline">
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getCategoryOption() && (
                  <>
                    {(() => {
                      const Icon = getCategoryOption()!.icon;
                      return <Icon className={`h-5 w-5 ${getCategoryOption()!.color}`} />;
                    })()}
                    {getCategoryOption()!.label}
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                Provide details about your feedback. The more information you provide, the better we can help.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief summary of your feedback"
                  {...register('title')}
                  className="mt-1"
                />
                {errors.title && (
                  <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed information..."
                  rows={6}
                  {...register('description')}
                  className="mt-1"
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Screenshot (Optional)</Label>
                {screenshot ? (
                  <div className="relative border rounded-lg p-2 bg-muted">
                    <img
                      src={screenshot}
                      alt="Screenshot"
                      className="w-full h-auto rounded"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-3 right-3"
                      onClick={clearScreenshot}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCaptureScreenshot}
                    disabled={isCapturing}
                    className="w-full"
                  >
                    {isCapturing ? (
                      <>
                        <LoadingSpinner className="mr-2" />
                        Capturing...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Capture Screenshot
                      </>
                    )}
                  </Button>
                )}
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  onClick={() => setStep('category')}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner className="mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Feedback'
                  )}
                </Button>
              </DialogFooter>
            </form>
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
                Your feedback has been submitted successfully.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                <p className="text-sm text-green-900 dark:text-green-100 mb-2">
                  <strong>Feedback Received!</strong>
                </p>
                <p className="text-sm text-green-800 dark:text-green-200">
                  We've received your feedback and will review it shortly. Thank you for helping us improve Exammer!
                </p>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>Your feedback helps us:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Fix bugs and improve stability</li>
                  <li>Understand what features you need</li>
                  <li>Prioritize development efforts</li>
                  <li>Make Exammer better for everyone</li>
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
