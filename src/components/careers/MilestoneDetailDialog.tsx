"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface Milestone {
  id: number;
  month: string;
  title: string;
  description: string;
  category: 'academic' | 'extracurricular' | 'application' | 'skill-building';
  priority: 'essential' | 'important' | 'optional';
  status: 'pending' | 'in_progress' | 'completed';
  completion_notes?: string;
}

interface MilestoneDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone: Milestone | null;
  onUpdate: (id: number, status: string, notes: string) => Promise<void>;
}

export default function MilestoneDetailDialog({
  open,
  onOpenChange,
  milestone,
  onUpdate,
}: MilestoneDetailDialogProps) {
  const [status, setStatus] = useState<string>('pending');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (milestone) {
      setStatus(milestone.status);
      setNotes(milestone.completion_notes || '');
    }
  }, [milestone]);

  const handleSave = async () => {
    if (!milestone) return;
    setIsSaving(true);
    try {
      await onUpdate(milestone.id, status, notes);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!milestone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{milestone.month}</Badge>
            <Badge>{milestone.category}</Badge>
          </div>
          <DialogTitle>{milestone.title}</DialogTitle>
          <DialogDescription>
            {milestone.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">
              Result / Notes
              <span className="text-xs text-muted-foreground ml-2">
                (e.g., "Scored 76%", "Submitted application")
              </span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your result or any notes here..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
