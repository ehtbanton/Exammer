"use client";

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FeedbackModal from './FeedbackModal';

interface FeedbackButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export default function FeedbackButton({
  variant = 'ghost',
  size = 'sm',
  className
}: FeedbackButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        className={className}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Feedback
      </Button>
      <FeedbackModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
