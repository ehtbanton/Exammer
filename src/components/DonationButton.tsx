"use client";

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DonationModal from './DonationModal';

interface DonationButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  className?: string;
}

export default function DonationButton({
  variant = 'outline',
  size = 'sm',
  className
}: DonationButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        className={className}
      >
        <Heart className="h-4 w-4 mr-2" />
        Donate
      </Button>

      <DonationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
