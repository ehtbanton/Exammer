"use client";

import { useState, useRef, ChangeEvent } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Info } from 'lucide-react';
import { PaperType } from '@/lib/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PaperUploadSectionsProps {
  paperTypes: PaperType[];
  subjectId: string;
  onUpload: (paperTypeId: string, files: File[]) => Promise<void>;
  isLoading: (key: string) => boolean;
}

export function PaperUploadSections({
  paperTypes,
  subjectId,
  onUpload,
  isLoading,
}: PaperUploadSectionsProps) {
  // State: Map<paperTypeId, File[]>
  const [selectedFiles, setSelectedFiles] = useState<Map<string, File[]>>(new Map());

  // Refs: Map<paperTypeId, RefObject>
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Truncate filename if longer than 43 characters
  const truncateFilename = (filename: string) => {
    if (filename.length <= 43) return filename;
    return filename.slice(0, 20) + '...' + filename.slice(-20);
  };

  const handleFileSelect = (paperTypeId: string, e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(paperTypeId) || [];
      newMap.set(paperTypeId, [...existing, ...files]);
      return newMap;
    });
  };

  const removeFile = (paperTypeId: string, index: number) => {
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(paperTypeId) || [];
      newMap.set(paperTypeId, existing.filter((_, i) => i !== index));
      return newMap;
    });
  };

  const handleUpload = async (paperTypeId: string) => {
    const files = selectedFiles.get(paperTypeId) || [];
    if (files.length > 0) {
      await onUpload(paperTypeId, files);
      // Clear selected files for this paper type
      setSelectedFiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(paperTypeId);
        return newMap;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">Important: Include date in filename</p>
            <p>
              For best results, include the paper date in the filename using the format <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">yyyy-mm-dd</code> (e.g., "2024-06-15_physics.pdf").
              Partial dates like <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">2024-06</code> or just <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">2024</code> are also acceptable as long as the year is present.
            </p>
          </div>
        </div>
      </div>

      {paperTypes.map(paperType => {
        const files = selectedFiles.get(paperType.id) || [];
        const isPaperLoading = isLoading(`process-papers-${subjectId}-${paperType.id}`);

        return (
          <Card key={paperType.id} className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {paperType.name}
              </CardTitle>
              <CardDescription>
                Upload past exam papers for this paper type. Questions will be automatically categorized into topics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Button
                  onClick={() => fileInputRefs.current.get(paperType.id)?.click()}
                  variant="outline"
                  type="button"
                  className="w-full"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Add Exam Papers
                </Button>
                <Input
                  type="file"
                  ref={(el) => {
                    if (el) fileInputRefs.current.set(paperType.id, el);
                  }}
                  className="hidden"
                  onChange={(e) => handleFileSelect(paperType.id, e)}
                  accept=".pdf,.txt,.md"
                  multiple
                />

                {files.length > 0 && (
                  <div className="mt-3 max-h-64 overflow-y-auto overflow-x-hidden border rounded-md p-2 space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                        <span className="text-sm flex-1">{truncateFilename(file.name)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(paperType.id, index)}
                          className="shrink-0 whitespace-nowrap"
                        >
                          <span className="text-xs">Remove</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleUpload(paperType.id)}
                className="w-full"
                disabled={isPaperLoading || files.length === 0}
              >
                {isPaperLoading ? <LoadingSpinner /> : `Process ${files.length} Paper${files.length !== 1 ? 's' : ''} & Extract Questions`}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
