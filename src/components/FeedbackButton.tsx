"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  const { status } = useSession();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accessLevel, setAccessLevel] = useState<number | null>(null);

  // Fetch access level when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchAccessLevel = async () => {
        try {
          const response = await fetch('/api/auth/access-level');
          if (response.ok) {
            const data = await response.json();
            setAccessLevel(data.accessLevel);
          }
        } catch (error) {
          console.error('Error fetching access level:', error);
        }
      };

      fetchAccessLevel();
    }
  }, [status]);

  const handleClick = () => {
    // Redirect level 3 users to admin feedback page
    if (accessLevel === 3) {
      router.push('/admin/feedback');
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Feedback
      </Button>
      <FeedbackModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
