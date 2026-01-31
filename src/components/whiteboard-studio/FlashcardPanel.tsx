"use client";

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, Trash2, ChevronLeft, ChevronRight, Download, Edit2, Upload } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

  // Export as Anki-compatible tab-separated format
  const handleExportAnki = () => {
    if (cards.length === 0) {
      toast({
        title: "No cards to export",
        description: "Create some flashcards first",
        variant: "destructive",
      });
      return;
    }

    // Anki imports tab-separated files: front<TAB>back
    // Escape any tabs/newlines in the content
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
      description: "Import into Anki: File → Import → Select the .txt file"
    });
  };

  // Import from Anki-compatible tab-separated format
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
        // Support tab-separated or semicolon-separated
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
        setCurrentIndex(cards.length); // Go to first imported card
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
    // Reset input so same file can be imported again
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
        icon={<Layers className="h-4 w-4 text-purple-500" />}
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
        minimizedIcon={<Layers className="h-5 w-5 text-purple-500" />}
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
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              <div className="flex-1 min-h-0">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Front</label>
                <Textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="Question or term..."
                  className="text-sm resize-none h-20"
                />
              </div>
              <div className="flex-1 min-h-0">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Back</label>
                <Textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="Answer or definition..."
                  className="text-sm resize-none h-20"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMode('view');
                    setEditingCard(null);
                    setNewFront('');
                    setNewBack('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={mode === 'edit' ? handleUpdateCard : handleCreateCard}
                >
                  {mode === 'edit' ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {/* Mode: View Cards */}
          {mode === 'view' && (
            <div className="flex flex-col h-full overflow-hidden">
              {cards.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <Layers className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm mb-3">No flashcards yet</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setMode('create')}>
                      <Plus className="h-4 w-4 mr-1" />
                      Create
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-1" />
                      Import
                    </Button>
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
                      "bg-gradient-to-br overflow-auto",
                      isFlipped
                        ? "from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30"
                        : "from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30"
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
                        <p className="text-xs text-gray-400 mb-2">
                          {isFlipped ? 'BACK' : 'FRONT'} • Click to flip
                        </p>
                        <p className="font-medium whitespace-pre-wrap break-words">
                          {isFlipped ? currentCard?.back : currentCard?.front}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between py-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={handlePrevCard} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-sm text-gray-500">
                      {currentIndex + 1} / {cards.length}
                    </span>

                    <Button variant="ghost" size="icon" onClick={handleNextCard} className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 pt-2 border-t border-gray-200 dark:border-gray-700 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 px-1"
                      onClick={() => setMode('create')}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      <span className="text-xs">Add</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 px-1"
                      onClick={() => currentCard && handleEditCard(currentCard)}
                    >
                      <Edit2 className="h-3 w-3 mr-0.5" />
                      <span className="text-xs">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 px-1 text-red-600 hover:text-red-700"
                      onClick={() => currentCard && handleDeleteCard(currentCard.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-0.5" />
                      <span className="text-xs">Del</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 px-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3 mr-0.5" />
                      <span className="text-xs">Import</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 px-1"
                      onClick={handleExportAnki}
                    >
                      <Download className="h-3 w-3 mr-0.5" />
                      <span className="text-xs">Export</span>
                    </Button>
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
