"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAppContext } from '@/app/context/AppContext';
import { backgroundQueue } from '@/lib/background-queue';

interface SubjectNameDescriptionModalProps {
  subjectId: string;
  initialName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SubjectNameDescriptionModal({
  subjectId,
  initialName,
  isOpen,
  onClose,
}: SubjectNameDescriptionModalProps) {
  const { updateSubjectNameDescription } = useAppContext();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [nameError, setNameError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);

  // Check if Process A is complete
  useEffect(() => {
    if (!isOpen) return;

    const processAId = `process-a-${subjectId}`;

    const checkProcessA = () => {
      const task = backgroundQueue.getTaskById(processAId);
      if (!task || task.status === 'completed') {
        setIsProcessingComplete(true);
      } else {
        setIsProcessingComplete(false);
      }
    };

    // Check immediately
    checkProcessA();

    // Subscribe to queue updates
    const unsubscribe = backgroundQueue.subscribe(checkProcessA);

    return () => {
      unsubscribe();
    };
  }, [subjectId, isOpen]);

  // Debounced name uniqueness check
  useEffect(() => {
    if (!name.trim() || name === initialName) {
      setNameAvailable(null);
      setNameError('');
      return;
    }

    setIsCheckingName(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/subjects/${subjectId}/check-name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });

        const data = await response.json();
        setNameAvailable(data.available);
        setNameError(data.available ? '' : data.message || 'Name already in use');
      } catch (error) {
        console.error('Error checking name:', error);
        setNameError('Failed to check name availability');
        setNameAvailable(null);
      } finally {
        setIsCheckingName(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [name, initialName, subjectId]);

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Subject name is required');
      return;
    }

    if (name !== initialName && !nameAvailable) {
      setNameError('Please choose a different name');
      return;
    }

    if (!description.trim()) {
      setNameError('Description is required');
      return;
    }

    setIsSaving(true);
    try {
      await updateSubjectNameDescription(subjectId, name.trim(), description.trim());
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
      // Error is already shown by AppContext toast
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = name.trim() && description.trim() &&
                  (name === initialName || nameAvailable === true) &&
                  isProcessingComplete;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Subject Setup</DialogTitle>
          <DialogDescription>
            Provide a unique name and description for your subject
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Subject Name */}
          <div className="space-y-2">
            <Label htmlFor="subject-name">Subject Name</Label>
            <div className="relative">
              <Input
                id="subject-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., A-Level Physics 2024"
                disabled={!isProcessingComplete}
                className="pr-10"
              />
              {isCheckingName && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!isCheckingName && name !== initialName && nameAvailable === true && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              )}
              {!isCheckingName && name !== initialName && nameAvailable === false && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
              )}
            </div>
            {nameError && (
              <p className="text-sm text-red-600">{nameError}</p>
            )}
            {nameAvailable === true && (
              <p className="text-sm text-green-600">Name is available</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="subject-description">Description</Label>
            <Textarea
              id="subject-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe this subject..."
              rows={3}
              disabled={!isProcessingComplete}
            />
          </div>

          {/* Processing Indicator */}
          {!isProcessingComplete && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for syllabus extraction to finish...</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
