"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Bug,
  Lightbulb,
  TrendingUp,
  HelpCircle,
  MoreHorizontal,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Calendar,
  User,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import type {
  FeedbackWithDetails,
  FeedbackCategory,
  FeedbackStatus,
  FeedbackPriority,
} from '@/lib/types';

const CATEGORY_ICONS = {
  bug: Bug,
  feature: Lightbulb,
  improvement: TrendingUp,
  question: HelpCircle,
  other: MoreHorizontal,
};

const CATEGORY_COLORS = {
  bug: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  feature: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  improvement: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  question: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function AdminFeedbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [feedbackList, setFeedbackList] = useState<FeedbackWithDetails[]>([]);
  const [filteredList, setFilteredList] = useState<FeedbackWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackWithDetails | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);
  const [accessLevel, setAccessLevel] = useState<number | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Check authentication
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Fetch access level and check authorization
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchAccessLevel = async () => {
        try {
          const response = await fetch('/api/auth/access-level');
          if (response.ok) {
            const data = await response.json();
            setAccessLevel(data.accessLevel);

            // Only level 3 users can access this page
            if (data.accessLevel !== 3) {
              router.push('/home');
            }
          }
        } catch (error) {
          console.error('Error fetching access level:', error);
          router.push('/home');
        }
      };

      fetchAccessLevel();
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && accessLevel === 3) {
      fetchFeedback();
    }
  }, [status, accessLevel]);

  // Apply filters
  useEffect(() => {
    let filtered = [...feedbackList];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(f => f.category === categoryFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(f => f.priority === priorityFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.userName?.toLowerCase().includes(query) ||
        f.userEmail?.toLowerCase().includes(query)
      );
    }

    setFilteredList(filtered);
  }, [feedbackList, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/feedback');
      if (response.ok) {
        const data = await response.json();
        setFeedbackList(data);
      } else {
        console.error('Failed to fetch feedback');
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFeedbackDetails = async (feedbackId: string) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedFeedback(data);
        setIsDetailModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching feedback details:', error);
    }
  };

  const updateFeedback = async (
    feedbackId: string,
    updates: { status?: FeedbackStatus; priority?: FeedbackPriority }
  ) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        // Refresh feedback list and details
        await fetchFeedback();
        if (selectedFeedback) {
          await fetchFeedbackDetails(feedbackId);
        }
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const addNote = async (feedbackId: string) => {
    if (!noteText.trim()) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/feedback/${feedbackId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: noteText,
          isInternal: noteInternal,
        }),
      });

      if (response.ok) {
        setNoteText('');
        // Refresh feedback details
        await fetchFeedbackDetails(feedbackId);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Feedback Management</h1>
        <p className="text-muted-foreground">
          View and manage user feedback, bug reports, and feature requests
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <Input
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <div className="space-y-4">
        {filteredList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No feedback found</p>
            </CardContent>
          </Card>
        ) : (
          filteredList.map((feedback) => {
            const CategoryIcon = CATEGORY_ICONS[feedback.category];
            return (
              <Card
                key={feedback.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => fetchFeedbackDetails(feedback.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon className="h-4 w-4" />
                        <h3 className="font-semibold">{feedback.title}</h3>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {feedback.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={CATEGORY_COLORS[feedback.category]}>
                          {feedback.category}
                        </Badge>
                        <Badge className={STATUS_COLORS[feedback.status]}>
                          {feedback.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={PRIORITY_COLORS[feedback.priority]}>
                          {feedback.priority}
                        </Badge>
                        {feedback.screenshotUrl && (
                          <Badge variant="outline">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Screenshot
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-sm text-muted-foreground ml-4">
                      <div className="flex items-center gap-1 mb-1">
                        <User className="h-3 w-3" />
                        <span>{feedback.userName || 'Anonymous'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(feedback.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedFeedback && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[700px] md:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => {
                  const CategoryIcon = CATEGORY_ICONS[selectedFeedback.category];
                  return <CategoryIcon className="h-5 w-5" />;
                })()}
                {selectedFeedback.title}
              </DialogTitle>
              <DialogDescription>
                Feedback #{selectedFeedback.id} - Submitted {formatDate(selectedFeedback.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={selectedFeedback.status}
                    onValueChange={(value) =>
                      updateFeedback(selectedFeedback.id, { status: value as FeedbackStatus })
                    }
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select
                    value={selectedFeedback.priority}
                    onValueChange={(value) =>
                      updateFeedback(selectedFeedback.id, { priority: value as FeedbackPriority })
                    }
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label>Description</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg whitespace-pre-wrap">
                  {selectedFeedback.description}
                </div>
              </div>

              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>User</Label>
                  <div className="mt-1 text-sm">{selectedFeedback.userName || 'Anonymous'}</div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="mt-1 text-sm">{selectedFeedback.userEmail || 'N/A'}</div>
                </div>
              </div>

              {/* URL */}
              {selectedFeedback.url && (
                <div>
                  <Label>Page URL</Label>
                  <div className="mt-1">
                    <a
                      href={selectedFeedback.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {selectedFeedback.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Screenshot */}
              {selectedFeedback.screenshotUrl && (
                <div>
                  <Label>Screenshot</Label>
                  <div className="mt-1">
                    <img
                      src={selectedFeedback.screenshotUrl}
                      alt="Feedback screenshot"
                      className="border rounded-lg max-w-full h-auto"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="mb-2 block">Admin Notes</Label>
                <div className="space-y-3 mb-4">
                  {selectedFeedback.notes && selectedFeedback.notes.length > 0 ? (
                    selectedFeedback.notes.map((note) => (
                      <div key={note.id} className="border rounded-lg p-3 bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{note.adminUserName}</span>
                          <div className="flex items-center gap-2">
                            {note.isInternal && (
                              <Badge variant="secondary" className="text-xs">Internal</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(note.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes yet</p>
                  )}
                </div>

                {/* Add Note */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a note..."
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={noteInternal}
                        onChange={(e) => setNoteInternal(e.target.checked)}
                        className="rounded"
                      />
                      Internal note (not visible to user)
                    </label>
                    <Button
                      onClick={() => addNote(selectedFeedback.id)}
                      disabled={!noteText.trim() || isUpdating}
                      size="sm"
                    >
                      {isUpdating ? <LoadingSpinner className="mr-2" /> : null}
                      Add Note
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
