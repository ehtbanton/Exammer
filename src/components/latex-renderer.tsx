"use client";

import React, { useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/dist/contrib/auto-render';

interface LatexRendererProps {
  children: string;
  className?: string;
}

/**
 * LatexRenderer component that renders text with LaTeX math expressions.
 *
 * Works like Overleaf - plain text stays as plain text, math inside $ delimiters
 * gets rendered automatically. Uses KaTeX's auto-render extension.
 *
 * Supports:
 * - Inline LaTeX: $expression$
 * - Display LaTeX: $$expression$$
 *
 * Example usage:
 * <LatexRenderer>Calculate $x^2 + 5x + 6$ when $x = 3$</LatexRenderer>
 */
export function LatexRenderer({ children, className = '' }: LatexRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Use KaTeX auto-render to find and render all math delimiters
      // This works exactly like Overleaf - finds $ and $$ and renders only the math
      renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false,
        errorColor: '#cc0000',
        strict: false,
        trust: false,
      });
    }
  }, [children]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
