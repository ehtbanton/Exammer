"use client";

import { ChangeEvent, useRef, useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/app/context/AppContext';
import { AuthGuard } from '@/components/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import LoadingSpinner from '@/components/LoadingSpinner';
import PageSpinner from '@/components/PageSpinner';
import { ArrowLeft, BookCopy, FileText, List, Upload, Crown } from 'lucide-react';
import { getScoreColorStyle, getDefaultBoxStyle, getUnattemptedBoxStyle } from '@/lib/utils';
import { PaperType } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UnderstandingIndicator } from '@/components/ui/understanding-indicator';
import { EnrichmentPanel } from '@/components/enrichment/EnrichmentPanel';

export default function SubjectPage() {
  return (
    <AuthGuard>
      <SubjectPageContent />
    </AuthGuard>
  );
}

function SubjectPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processExamPapers, processMarkschemes, loadSubjectsList, loadPaperTypes, isLoading, setLoading, cacheVersion } = useAppContext();
  const subjectId = params.subjectId as string;
  const [subject, setSubject] = useState<import('@/app/context/AppContext').SubjectPreview | null>(null);
  const [paperTypes, setPaperTypes] = useState<import('@/app/context/AppContext').PaperTypeWithMetrics[]>([]);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const paperInputRef = useRef<HTMLInputElement>(null);
  const markschemeInputRef = useRef<HTMLInputElement>(null);
  const [isPaperDialogOpen, setPaperDialogOpen] = useState(false);
  const [isMarkschemeDialogOpen, setMarkschemeDialogOpen] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<File[]>([]);
  const [selectedMarkschemes, setSelectedMarkschemes] = useState<File[]>([]);
  const [hideEmptyPapers, setHideEmptyPapers] = useState(true);

  // Load subject and paper types on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const subjectsList = await loadSubjectsList();
        const foundSubject = subjectsList.find(s => s.id === subjectId);
        setSubject(foundSubject || null);

        if (foundSubject) {
          const paperTypesList = await loadPaperTypes(subjectId);
          setPaperTypes(paperTypesList);
        }
      } catch (error) {
        console.error('Error loading subject data:', error);
      }
    };

    loadData();
  }, [subjectId, loadSubjectsList, loadPaperTypes, cacheVersion]);

  // Truncate filename if longer than 43 characters: first 20 + "..." + last 20
  const truncateFilename = (filename: string) => {
    if (filename.length <= 43) return filename;
    return filename.slice(0, 20) + '...' + filename.slice(-20);
  };

  useEffect(() => {
    // Reset loading state on mount in case user navigated back
    if (subject) {
      setLoading(`navigate-${subject.id}`, false);
      paperTypes.forEach(pt => setLoading(`navigate-paper-${pt.id}`, false));
    }
  }, [subject, paperTypes, setLoading]);

  useEffect(() => {
    // Auto-open paper upload dialog if redirected from syllabus upload
    if (searchParams.get('openPapers') === 'true') {
      setPaperDialogOpen(true);
      // Clean up the URL parameter
      router.replace(`/workspace/subject/${subjectId}`);
    }
  }, [searchParams, subjectId, router]);

  const handlePaperSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedPapers(prev => [...prev, ...files]);
  };

  const removePaper = (index: number) => {
    setSelectedPapers(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkschemeSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedMarkschemes(prev => [...prev, ...files]);
  };

  const removeMarkscheme = (index: number) => {
    setSelectedMarkschemes(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadPapers = async () => {
    if (selectedPapers.length > 0 && subject) {
      await processExamPapers(subject.id, selectedPapers);
      setSelectedPapers([]);
      setPaperDialogOpen(false);
    }
  };

  const handleUploadMarkschemes = async () => {
    if (selectedMarkschemes.length > 0 && subject) {
      await processMarkschemes(subject.id, selectedMarkschemes);
      setSelectedMarkschemes([]);
      setMarkschemeDialogOpen(false);
    }
  };

  const handleCancelPaperDialog = () => {
    setSelectedPapers([]);
    setPaperDialogOpen(false);
  };

  const handleCancelMarkschemeDialog = () => {
    setSelectedMarkschemes([]);
    setMarkschemeDialogOpen(false);
  };

  const handleNavigate = (paperTypeId: string) => {
    setLoading(`navigate-paper-${paperTypeId}`, true);
    setNavigatingTo(paperTypeId);
    router.push(`/workspace/subject/${subjectId}/paper/${paperTypeId}`);
  };
  
  if (navigatingTo && isLoading(`navigate-paper-${navigatingTo}`)) {
    return <PageSpinner />;
  }

  // Show loading spinner while subjects are being fetched
  if (isLoading('fetch-subjects')) {
    return <PageSpinner />;
  }

  if (!subject) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Curso no encontrado</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href="/">Volver a cursos</Link>
        </Button>
      </div>
    );
  }

  const isPaperLoading = isLoading(`process-papers-${subjectId}`);
  const isMarkschemeLoading = isLoading(`process-markschemes-${subjectId}`);

  // Filter papers based on toggle (now using metrics from API)
  const filteredPaperTypes = hideEmptyPapers
    ? paperTypes.filter(pt => pt.total_questions > 0)
    : paperTypes;

  return (
    <div className="container mx-auto">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
        <ArrowLeft />
        Volver a Cursos
      </Button>
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-3xl font-bold font-headline">{subject?.name}</h1>
        {subject?.isCreator && (
          <span title="Created by you">
            <Crown className="h-6 w-6 text-yellow-500" />
          </span>
        )}
      </div>
      <p className="text-muted-foreground mb-8">
        {subject?.isCreator ? 'Administra tu curso y documentos' : 'Ve y practica las preguntas de este curso'}
      </p>

      {/* Syllabus and Past Papers Info - Only show for creators */}
      {subject?.isCreator && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText /> Info del Documento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-600">Documento subido y {paperTypes.length} módulos identificados.</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><List /> Documentos Adicionales</CardTitle>
              <CardDescription>Sube más documentos para extraer preguntas adicionales.</CardDescription>
            </CardHeader>
            <CardFooter className="flex gap-2">
              <Dialog open={isPaperDialogOpen} onOpenChange={setPaperDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary">Agregar Documentos</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Subir Documentos</DialogTitle>
                    <DialogDescription>
                      Sube documentos para extraer preguntas de todos los temas en "{subject.name}". Opcionalmente puedes subir guías de respuestas después.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Nota:</strong> Las preguntas se extraerán automáticamente. Opcionalmente puedes agregar guías de respuestas después para calificación por objetivos.
                      </p>
                    </div>

                    <div>
                      <Button onClick={() => paperInputRef.current?.click()} variant="outline" type="button" className="w-full">
                        <FileText className="mr-2 h-4 w-4" />
                        Agregar Documentos
                      </Button>
                      <Input
                        type="file"
                        ref={paperInputRef}
                        className="hidden"
                        onChange={handlePaperSelect}
                        accept=".pdf,.txt,.md"
                        multiple
                      />

                      {selectedPapers.length > 0 && (
                        <div className="mt-3 max-h-64 overflow-y-auto overflow-x-hidden border rounded-md p-2 space-y-2">
                          {selectedPapers.map((paper, index) => (
                            <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                              <span className="text-sm flex-1">{truncateFilename(paper.name)}</span>
                              <Button variant="ghost" size="sm" onClick={() => removePaper(index)} className="shrink-0 whitespace-nowrap">
                                <span className="text-xs">Quitar</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={handleCancelPaperDialog}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleUploadPapers}
                        className="flex-1"
                        disabled={isPaperLoading || selectedPapers.length === 0}
                      >
                        {isPaperLoading ? <LoadingSpinner /> : 'Procesar y Extraer Preguntas'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isMarkschemeDialogOpen} onOpenChange={setMarkschemeDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Subir Guías de Respuestas</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Subir Guías de Respuestas</DialogTitle>
                    <DialogDescription>
                      Sube guías de respuestas para vincularlas con las preguntas existentes y habilitar la calificación por objetivos.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Nota:</strong> Las guías de respuestas se vincularán automáticamente con las preguntas existentes.
                      </p>
                    </div>

                    <div>
                      <Button onClick={() => markschemeInputRef.current?.click()} variant="outline" type="button" className="w-full">
                        <FileText className="mr-2 h-4 w-4" />
                        Agregar Guías
                      </Button>
                      <Input
                        type="file"
                        ref={markschemeInputRef}
                        className="hidden"
                        onChange={handleMarkschemeSelect}
                        accept=".pdf,.txt,.md"
                        multiple
                      />

                      {selectedMarkschemes.length > 0 && (
                        <div className="mt-3 max-h-64 overflow-y-auto overflow-x-hidden border rounded-md p-2 space-y-2">
                          {selectedMarkschemes.map((markscheme, index) => (
                            <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                              <span className="text-sm flex-1">{truncateFilename(markscheme.name)}</span>
                              <Button variant="ghost" size="sm" onClick={() => removeMarkscheme(index)} className="shrink-0 whitespace-nowrap">
                                <span className="text-xs">Quitar</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={handleCancelMarkschemeDialog}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleUploadMarkschemes}
                        className="flex-1"
                        disabled={isMarkschemeLoading || selectedMarkschemes.length === 0}
                      >
                        {isMarkschemeLoading ? <LoadingSpinner /> : 'Procesar Guías y Vincular'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2"><BookCopy /> Módulos</h2>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-empty-papers"
              checked={hideEmptyPapers}
              onCheckedChange={setHideEmptyPapers}
            />
            <Label htmlFor="hide-empty-papers" className="text-sm">Ocultar módulos sin preguntas</Label>
          </div>
        </div>
        {filteredPaperTypes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPaperTypes.map(paperType => {
              // Use metrics from API (already calculated server-side)
              const avgScore = paperType.avg_score;
              const hasScore = avgScore !== null && paperType.attempted_questions > 0;
              const hasQuestions = paperType.total_questions > 0;
              const progressPercentage = paperType.total_questions > 0
                ? (paperType.attempted_questions / paperType.total_questions) * 100
                : 0;

              // Determine which style to use
              let boxStyle;
              if (hasScore && avgScore !== null) {
                boxStyle = getScoreColorStyle(avgScore);
              } else if (hasQuestions) {
                boxStyle = getUnattemptedBoxStyle(); // Has questions but no attempts
              } else {
                boxStyle = getDefaultBoxStyle(); // No questions at all
              }

              return (
                <Card
                  key={paperType.id}
                  className="hover:shadow-[0_0_0_4px_rgb(55,65,81)] dark:hover:shadow-[0_0_0_4px_white] transition-all cursor-pointer h-full border-2"
                  style={boxStyle}
                  onClick={() => handleNavigate(paperType.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg text-black flex-1">{paperType.name}</CardTitle>
                      {hasScore && avgScore !== null && (
                        <UnderstandingIndicator percentage={avgScore} size="sm" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-black">
                      {hasQuestions ? `${paperType.attempted_questions}/${paperType.total_questions} intentadas` : 'Sin preguntas aún'}
                    </p>
                    {hasQuestions && (
                      <Progress value={progressPercentage} className="h-2" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-semibold">No se encontraron módulos</h3>
              <p className="text-muted-foreground mt-1">Este curso aún no tiene módulos.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Curriculum Enrichment */}
      <EnrichmentPanel subjectId={subjectId} />
    </div>
  );
}
