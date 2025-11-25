"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Upload, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OnboardingWizardProps {
  sessionType: 'explore' | 'direct';
  onComplete: (sessionId: number) => void;
}

export default function OnboardingWizard({ sessionType, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form data
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [currentSchool, setCurrentSchool] = useState('');
  const [currentYearGroup, setCurrentYearGroup] = useState('');
  const [targetApplicationYear, setTargetApplicationYear] = useState('');
  const [useExammerData, setUseExammerData] = useState(true);

  const totalSteps = sessionType === 'explore' ? 3 : 3;

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF or Word document',
          variant: 'destructive'
        });
        return;
      }
      setCvFile(file);
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Upload CV if provided
      let cvFilePath = null;
      let cvParsedData = null;

      if (cvFile) {
        const formData = new FormData();
        formData.append('file', cvFile);

        const uploadResponse = await fetch('/api/careers/cv-upload', {
          method: 'POST',
          body: formData
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          cvFilePath = uploadData.filePath;
          cvParsedData = uploadData.parsedData;
        } else {
          toast({
            title: 'CV upload failed',
            description: 'We couldn\'t process your CV. You can continue without it.',
            variant: 'destructive'
          });
        }
      }

      // Update session with onboarding data
      const response = await fetch('/api/careers/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType,
          currentSchool,
          currentYearGroup,
          targetApplicationYear: parseInt(targetApplicationYear) || null,
          useExammerData,
          cvFilePath,
          cvParsedData
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Setup complete!',
          description: 'Let\'s start building your pathway'
        });
        onComplete(data.sessionId);
      } else {
        throw new Error('Failed to save session');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>
              {sessionType === 'explore' ? 'Career Exploration' : 'Set Your Goal'}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              Step {step} of {totalSteps}
            </span>
          </div>
          <CardDescription>
            {step === 1 && 'Optional: Upload your CV for personalized recommendations'}
            {step === 2 && 'Tell us about your current situation'}
            {step === 3 && 'Final step: Configure your preferences'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: CV Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Upload your CV (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll extract your skills, achievements, and experience to personalize your pathway
                </p>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleCvUpload}
                  className="max-w-xs mx-auto"
                />
                {cvFile && (
                  <p className="text-sm text-green-600 mt-2">
                    ✓ {cvFile.name} selected
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: PDF, DOC, DOCX. Your CV is processed securely and never shared.
              </p>
            </div>
          )}

          {/* Step 2: Current Situation */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school">Current School/College</Label>
                <Input
                  id="school"
                  placeholder="e.g., Strathallan School"
                  value={currentSchool}
                  onChange={(e) => setCurrentSchool(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearGroup">Current Year Group</Label>
                <Select value={currentYearGroup} onValueChange={setCurrentYearGroup}>
                  <SelectTrigger id="yearGroup">
                    <SelectValue placeholder="Select your year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Year 9">Year 9</SelectItem>
                    <SelectItem value="Year 10">Year 10</SelectItem>
                    <SelectItem value="Year 11">Year 11</SelectItem>
                    <SelectItem value="Year 12">Year 12 (Lower Sixth)</SelectItem>
                    <SelectItem value="Year 13">Year 13 (Upper Sixth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appYear">Target Application Year</Label>
                <Input
                  id="appYear"
                  type="number"
                  placeholder="e.g., 2026"
                  value={targetApplicationYear}
                  onChange={(e) => setTargetApplicationYear(e.target.value)}
                  min={new Date().getFullYear()}
                  max={new Date().getFullYear() + 10}
                />
                <p className="text-xs text-muted-foreground">
                  When do you plan to apply to university?
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="exammer-data">Use Exammer Performance Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Let us analyze your Exammer progress to identify topics needing improvement
                  </p>
                </div>
                <Switch
                  id="exammer-data"
                  checked={useExammerData}
                  onCheckedChange={setUseExammerData}
                />
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <h4 className="font-semibold mb-2">What's next?</h4>
                  <p className="text-sm text-muted-foreground">
                    {sessionType === 'explore'
                      ? 'We\'ll guide you through an interactive brainstorming session to discover career paths that match your interests.'
                      : 'You\'ll set your target university and course, and we\'ll create a personalized pathway to get you there.'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          {step < totalSteps ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={isSubmitting}>
              {isSubmitting ? 'Setting up...' : 'Complete Setup'}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Progress indicator */}
      <div className="flex gap-2 justify-center mt-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-12 rounded-full transition-colors ${
              i + 1 === step ? 'bg-primary' : i + 1 < step ? 'bg-primary/50' : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
