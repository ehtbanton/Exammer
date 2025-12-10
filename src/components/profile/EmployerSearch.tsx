"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, BookOpen, Award, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getScoreColorClass } from "@/lib/utils";

interface SearchResult {
  conversationId: number;
  summary: string;
  relevanceScore: number;
  mmrScore: number;
  questionId: number;
  questionSummary: string;
  topicName: string;
  subjectName: string;
  finalScore: number;
  startedAt: number;
  endedAt: number;
}

interface EmployerSearchProps {
  userId: number;
}

export function EmployerSearch({ userId }: EmployerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalConversations, setTotalConversations] = useState(0);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          userId,
          limit: 10,
          lambda: 0.7, // Balance relevance and diversity
          threshold: 0.0, // No threshold - show all results
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Search failed");
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotalConversations(data.totalConversations || 0);
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error(error.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search Work History
        </CardTitle>
        <CardDescription>
          Paste job requirements or skills to find relevant work this candidate has completed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="e.g., Experience with calculus, problem-solving skills, mathematical proofs, data analysis..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[100px]"
          />
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>

        {searched && !loading && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {results.length > 0
                ? `Found ${results.length} relevant results from ${totalConversations} total conversations`
                : totalConversations > 0
                ? `No relevant results found in ${totalConversations} conversations. Try different search terms.`
                : "This user hasn't completed any interviews yet."}
            </div>

            {results.length > 0 && (
              <div className="space-y-3">
                {results.map((result, index) => (
                  <Card key={result.conversationId} className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="outline" className="text-xs">
                                {result.subjectName}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {result.topicName}
                              </Badge>
                              <Badge
                                className={`text-xs ${getScoreColorClass(result.finalScore)}`}
                              >
                                {result.finalScore}%
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground mt-2">
                              {result.summary}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              Question: {result.questionSummary}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground shrink-0">
                            <div className="flex items-center gap-1 justify-end">
                              <Award className="h-3 w-3" />
                              {Math.round(result.relevanceScore * 100)}% match
                            </div>
                            <div className="flex items-center gap-1 justify-end mt-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(result.endedAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
