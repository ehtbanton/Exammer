"use client";

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, Trash2, ChevronLeft, ChevronRight, Download, Edit2, Upload } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardPanelProps {
  defaultPosition?: { x: number; y: number };
  onClose: () => void;
}

export function FlashcardPanel({ defaultPosition = { x: 800, y: 70 }, onClose }: FlashcardPanelProps) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const currentCard = cards[currentIndex];

  const handleCreateCard = () => {
    if (!newFront.trim() || !newBack.trim()) {
      toast({
        title: "Both sides required",
        description: "Please fill in both the front and back of the card",
        variant: "destructive",
      });
      return;
    }

    const newCard: Flashcard = {
      id: Date.now().toString(),
      front: newFront.trim(),
      back: newBack.trim(),
    };

    setCards([...cards, newCard]);
    setNewFront('');
    setNewBack('');
    setMode('view');
    setCurrentIndex(cards.length);
    toast({ title: "Card created!" });
  };

  const handleUpdateCard = () => {
    if (!editingCard || !newFront.trim() || !newBack.trim()) return;

    setCards(cards.map(card =>
      card.id === editingCard.id
        ? { ...card, front: newFront.trim(), back: newBack.trim() }
        : card
    ));
    setEditingCard(null);
    setNewFront('');
    setNewBack('');
    setMode('view');
    toast({ title: "Card updated!" });
  };

  const handleDeleteCard = (id: string) => {
    const newCards = cards.filter(card => card.id !== id);
    setCards(newCards);
    if (currentIndex >= newCards.length) {
      setCurrentIndex(Math.max(0, newCards.length - 1));
    }
    setIsFlipped(false);
    toast({ title: "Card deleted" });
  };

  const handleEditCard = (card: Flashcard) => {
    setEditingCard(card);
    setNewFront(card.front);
    setNewBack(card.back);
    setMode('edit');
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : cards.length - 1));
  };

  const handleNextCard = () => {
    setIsFlipped(false);
    setCurrentIndex(prev => (prev < cards.length - 1 ? prev + 1 : 0));
  };

  const handleExportAnki = () => {
    if (cards.length === 0) {
      toast({
        title: "No cards to export",
        description: "Create some flashcards first",
        variant: "destructive",
      });
      return;
    }

    const content = cards.map(card => {
      const front = card.front.replace(/\t/g, '    ').replace(/\n/g, '<br>');
      const back = card.back.replace(/\t/g, '    ').replace(/\n/g, '<br>');
      return `${front}\t${back}`;
    }).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Cards exported!",
      description: "Import into Anki: File > Import > Select the .txt file"
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split('\n').filter(line => line.trim());
      const importedCards: Flashcard[] = [];

      for (const line of lines) {
        let parts = line.split('\t');
        if (parts.length < 2) {
          parts = line.split(';');
        }

        if (parts.length >= 2) {
          const front = parts[0].replace(/<br>/g, '\n').trim();
          const back = parts[1].replace(/<br>/g, '\n').trim();
          if (front && back) {
            importedCards.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              front,
              back,
            });
          }
        }
      }

      if (importedCards.length > 0) {
        setCards(prev => [...prev, ...importedCards]);
        setCurrentIndex(cards.length);
        toast({
          title: `Imported ${importedCards.length} cards!`,
        });
      } else {
        toast({
          title: "No cards found",
          description: "File should have tab or semicolon separated front;back pairs",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <FloatingPanel
        title="Flashcards"
        icon={<Layers className="h-4 w-4 text-[var(--s-text-muted)]" />}
        defaultPosition={defaultPosition}
        minWidth={200}
        maxWidth={800}
        minHeight={150}
        maxHeight={700}
        defaultWidth={360}
        defaultHeight={380}
        resizable={true}
        closable={true}
        onClose={onClose}
        zIndex={112}
        squareMinimize={true}
        minimizedIcon={<Layers className="h-5 w-5 text-[var(--s-text-muted)]" />}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            onChange={handleImport}
            className="hidden"
          />

          {/* Mode: Create/Edit Card */}
          {(mode === 'create' || mode === 'edit') && (
            <div className="flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex-1 min-h-0">
                <label className="text-[11px] font-medium text-[var(--s-text-muted)] mb-1 block">Front</label>
                <textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="Question or term..."
                  className="w-full h-20 px-3 py-2 text-[13px] rounded-xl bg-[var(--s-input-bg)] text-[var(--s-text)] placeholder:text-[var(--s-text-placeholder)] outline-none focus:[box-shadow:var(--s-focus-ring)] transition-shadow resize-none"
                />
              </div>
              <div className="flex-1 min-h-0">
                <label className="text-[11px] font-medium text-[var(--s-text-muted)] mb-1 block">Back</label>
                <textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="Answer or definition..."
                  className="w-full h-20 px-3 py-2 text-[13px] rounded-xl bg-[var(--s-input-bg)] text-[var(--s-text)] placeholder:text-[var(--s-text-placeholder)] outline-none focus:[box-shadow:var(--s-focus-ring)] transition-shadow resize-none"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setMode('view');
                    setEditingCard(null);
                    setNewFront('');
                    setNewBack('');
                  }}
                  className="flex-1 h-8 rounded-lg text-[12px] font-medium text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={mode === 'edit' ? handleUpdateCard : handleCreateCard}
                  className="flex-1 h-8 rounded-lg bg-[var(--s-accent)] text-white text-[12px] font-medium hover:bg-[var(--s-accent-hover)] active:scale-95 transition-all"
                >
                  {mode === 'edit' ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Mode: View Cards */}
          {mode === 'view' && (
            <div className="flex flex-col h-full overflow-hidden">
              {cards.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--s-text-muted)]">
                  <Layers className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-[13px] mb-3">No flashcards yet</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode('create')}
                      className="h-8 px-3 rounded-lg bg-[var(--s-accent)] text-white text-[12px] font-medium hover:bg-[var(--s-accent-hover)] active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--s-text-secondary)] hover:bg-[var(--s-hover)] active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Card Display */}
                  <div
                    className={cn(
                      "flex-1 rounded-xl p-4 cursor-pointer min-h-0",
                      "flex items-center justify-center text-center",
                      "transition-all duration-300 transform-gpu",
                      "overflow-auto",
                      isFlipped
                        ? "bg-[var(--s-card)] [box-shadow:var(--s-shadow-sm),inset_0_0_0_1.5px_rgba(52,199,89,0.3)]"
                        : "bg-[var(--s-card)] [box-shadow:var(--s-shadow-sm)]"
                    )}
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isFlipped ? 'back' : 'front'}
                        initial={{ rotateY: 90, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        exit={{ rotateY: -90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm w-full"
                      >
                        <p className="text-[11px] text-[var(--s-text-muted)] mb-2">
                          {isFlipped ? 'BACK' : 'FRONT'} · Click to flip
                        </p>
                        <p className="font-medium text-[var(--s-text)] whitespace-pre-wrap break-words">
                          {isFlipped ? currentCard?.back : currentCard?.front}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between py-2 shrink-0">
                    <button
                      onClick={handlePrevCard}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-95 transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="text-[12px] text-[var(--s-text-muted)]">
                      {currentIndex + 1} / {cards.length}
                    </span>

                    <button
                      onClick={handleNextCard}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-95 transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-0.5 pt-2 shrink-0">
                    <div className="mx-0 mb-2 w-full">
                      <div className="h-px bg-gradient-to-r from-transparent via-[var(--s-divider)] to-transparent" />
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button
                      onClick={() => setMode('create')}
                      className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-95 transition-all"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                    <button
                      onClick={() => currentCard && handleEditCard(currentCard)}
                      className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-95 transition-all"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => currentCard && handleDeleteCard(currentCard.id)}
                      className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] text-[var(--s-danger)] hover:bg-[var(--s-danger-hover-bg)] active:scale-95 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                      Del
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-95 transition-all"
                    >
                      <Upload className="h-3 w-3" />
                      Import
                    </button>
                    <button
                      onClick={handleExportAnki}
                      className="flex-1 h-7 rounded-lg flex items-center justify-center gap-1 text-[11px] text-[var(--s-text-muted)] hover:bg-[var(--s-hover)] active:scale-95 transition-all"
                    >
                      <Download className="h-3 w-3" />
                      Export
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </FloatingPanel>
    </motion.div>
  );
}
