"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, RefreshCw } from 'lucide-react';

interface ReplanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplan: (reason: string, reasonType: string) => Promise<void>;
}

export default function ReplanDialog({ open, onOpenChange, onReplan }: ReplanDialogProps) {
  const [reasonType, setReasonType] = useState('goal_changed');
  const [customReason, setCustomReason] = useState('');
  const [isReplanning, setIsReplanning] = useState(false);

  const reasonTypes = [
    { value: 'goal_changed', label: 'My university goal changed' },
    { value: 'milestone_failed', label: 'I failed or couldn\'t complete a milestone' },
    { value: 'new_interests', label: 'My interests or priorities changed' },
    { value: 'time_constraint', label: 'My timeline needs to be adjusted' },
    { value: 'performance_improved', label: 'My performance has improved significantly' },
    { value: 'other', label: 'Other reason' },
  ];

  const handleReplan = async () => {
    setIsReplanning(true);
    try {
      const reason = reasonType === 'other' ? customReason : reasonTypes.find(r => r.value === reasonType)?.label || '';
      await onReplan(reason, reasonType);
      onOpenChange(false);
      setCustomReason('');
      setReasonType('goal_changed');
    } catch (error) {
      console.error('Error replanning:', error);
    } finally {
      setIsReplanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Replan Your Pathway
          </DialogTitle>
          <DialogDescription>
            Your pathway will be regenerated based on your current situation and new information.
            This helps adapt to changes in your goals, performance, or circumstances.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Why are you replanning?</Label>
            <RadioGroup value={reasonType} onValueChange={setReasonType}>
              {reasonTypes.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label htmlFor={type.value} className="font-normal cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reasonType === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason">Please explain</Label>
              <Textarea
                id="custom-reason"
                placeholder="Describe what changed..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">What will be regenerated:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• All milestones with updated timing</li>
              <li>• Subject focus areas based on current performance</li>
              <li>• Extracurricular recommendations</li>
              <li>• Timeline adjusted to your deadline</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isReplanning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReplan}
            disabled={isReplanning || (reasonType === 'other' && !customReason.trim())}
          >
            {isReplanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Replanning...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Replan Pathway
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
