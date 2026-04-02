"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Check, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProfileHeaderProps {
  user: {
    id: number;
    name: string;
    image: string | null;
    memberSince: string;
  };
  profileUrl: string;
}

export function ProfileHeader({ user, profileUrl }: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("¡URL del perfil copiada al portapapeles!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Error al copiar la URL");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMemberSince = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-MX", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
      <Avatar className="h-20 w-20 border-2 border-border">
        <AvatarImage src={user.image || undefined} alt={user.name} />
        <AvatarFallback className="text-xl font-semibold bg-primary text-primary-foreground">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <h1 className="text-3xl font-bold text-foreground">{user.name}</h1>
        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Miembro desde {formatMemberSince(user.memberSince)}</span>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleShare}
        className="flex items-center gap-2"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            ¡Copiado!
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            Compartir Perfil
          </>
        )}
      </Button>
    </div>
  );
}
