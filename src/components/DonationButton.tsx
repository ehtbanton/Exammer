"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DonationModal } from "./DonationModal";

interface DonationButtonProps {
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function DonationButton({
  variant = "ghost",
  size = "sm",
  className = "",
}: DonationButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        className={`font-semibold ${className}`}
      >
        <Heart className="h-4 w-4 mr-2 fill-current" />
        Donate
      </Button>
      <DonationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
