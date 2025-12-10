"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { SummaryCards } from "@/components/profile/SummaryCards";
import { SubjectBreakdown } from "@/components/profile/SubjectBreakdown";
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap";
import { EmployerSearch } from "@/components/profile/EmployerSearch";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface ProfileData {
  user: {
    id: number;
    name: string;
    image: string | null;
    memberSince: string;
  };
  summary: {
    questionsAttempted: number;
    questionsMastered: number;
    avgScore: number | null;
    subjectsCount: number;
    totalStudyDays: number;
    currentStreak: number;
    longestStreak: number;
  };
  subjects: Array<{
    id: number;
    name: string;
    questionsAttempted: number;
    questionsMastered: number;
    totalQuestions: number;
    avgScore: number | null;
    masteryPercent: number;
    paperTypes: Array<{
      id: number;
      name: string;
      topics: Array<{
        id: number;
        name: string;
        questionsAttempted: number;
        questionsMastered: number;
        totalQuestions: number;
        avgScore: number | null;
      }>;
    }>;
  }>;
  activity: Array<{
    date: string;
    count: number;
  }>;
  verification: {
    profileUrl: string;
    generatedAt: string;
  };
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/profile/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        } else if (response.status === 404) {
          setError("Profile not found");
        } else {
          setError("Failed to load profile");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              {error || "Profile not available"}
            </h1>
            <p className="text-muted-foreground text-center">
              The profile you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <ProfileHeader user={profile.user} profileUrl={profile.verification.profileUrl} />

      <SummaryCards summary={profile.summary} />

      <EmployerSearch userId={profile.user.id} />

      <ActivityHeatmap activity={profile.activity} />

      <SubjectBreakdown subjects={profile.subjects} />

      {/* Verification Footer */}
      <div className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
        <p>
          Profile generated: {new Date(profile.verification.generatedAt).toLocaleString()}
        </p>
        <p className="mt-1">
          <a
            href={profile.verification.profileUrl}
            className="text-primary hover:underline"
          >
            {profile.verification.profileUrl}
          </a>
        </p>
      </div>
    </div>
  );
}
