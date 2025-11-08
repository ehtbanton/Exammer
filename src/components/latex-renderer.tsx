"use client";

import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface LatexRendererProps {
  children: string;
  className?: string;
}

/**
 * Validates if content looks like actual LaTeX/math notation.
 * This prevents rendering English prose that was incorrectly placed inside $ delimiters.
 *
 * Checks for:
 * - LaTeX-like characters (math operators, braces, etc.)
 * - LaTeX commands (\frac, \sqrt, Greek letters)
 * - Not too many common English words (>40% = probably not math)
 */
function looksLikeLaTeX(content: string): boolean {
  // Check for LaTeX-like patterns
  const hasLatexChars = /[\\{}^_=+\-*/()[\]|]/.test(content);
  const hasGreekLetters = /\\(alpha|beta|gamma|delta|epsilon|theta|pi|omega|sigma|Delta|Sigma|lambda|mu|nu|xi|rho|tau|phi|chi|psi)/i.test(content);
  const hasLatexCommands = /\\(frac|sqrt|sum|int|lim|text|mathrm|times|div|leq|geq|approx|neq|cdot|partial|infty)/i.test(content);
  const hasNumbers = /\d/.test(content);

  // Should have at least one LaTeX indicator
  if (!hasLatexChars && !hasGreekLetters && !hasLatexCommands && !hasNumbers) {
    return false;
  }

  // Check for too many common English words (heuristic to detect prose)
  const words = content.split(/\s+/).filter(w => w.length > 3);
  const commonWords = words.filter(w =>
    /^(the|and|that|this|with|from|have|they|will|would|there|which|their|about|could|should|where|when|what|into|than|then|them|these|some|other|only|such|also|very|after|just|because|through|during|before|however|between|determine|leading|order|outer|solution|show|boundary|layer|exists|given|using|therefore|hence|thus)$/i.test(w)
  );

  // If more than 40% are common English words, probably not LaTeX
  if (words.length > 0 && (commonWords.length / words.length) > 0.4) {
    return false;
  }

  return true;
}

/**
 * LatexRenderer component that parses text and renders LaTeX expressions.
 *
 * Supports:
 * - Inline LaTeX: $expression$ or \(expression\)
 * - Display LaTeX: $$expression$$ or \[expression\]
 *
 * Example usage:
 * <LatexRenderer>Calculate $x^2 + 5x + 6$ when $x = 3$</LatexRenderer>
 */
export function LatexRenderer({ children, className = '' }: LatexRendererProps) {
  const renderLatex = (text: string): React.ReactNode[] => {
    if (!text) return [text];

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // Regex to match both $...$ and $$...$$ formats, as well as \(...\) and \[...\]
    // Priority: $$...$$ (display) > $...$ (inline) > \[...\] (display) > \(...\) (inline)
    const latexRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([^\)]+?\\\))/g;

    let match;
    while ((match = latexRegex.exec(text)) !== null) {
      // Add text before the LaTeX expression
      if (match.index > lastIndex) {
        elements.push(
          <React.Fragment key={`text-${key++}`}>
            {text.substring(lastIndex, match.index)}
          </React.Fragment>
        );
      }

      const fullMatch = match[0];
      let latexContent = '';
      let displayMode = false;

      // Determine LaTeX format and extract content
      if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
        // Display mode: $$...$$
        latexContent = fullMatch.slice(2, -2);
        displayMode = true;
      } else if (fullMatch.startsWith('\\[') && fullMatch.endsWith('\\]')) {
        // Display mode: \[...\]
        latexContent = fullMatch.slice(2, -2);
        displayMode = true;
      } else if (fullMatch.startsWith('$') && fullMatch.endsWith('$')) {
        // Inline mode: $...$
        latexContent = fullMatch.slice(1, -1);
        displayMode = false;
      } else if (fullMatch.startsWith('\\(') && fullMatch.endsWith('\\)')) {
        // Inline mode: \(...\)
        latexContent = fullMatch.slice(2, -2);
        displayMode = false;
      }

      // Validation: Check if content actually looks like LaTeX
      const MAX_INLINE_LATEX_LENGTH = 200;

      // Skip rendering if content doesn't look like LaTeX or is too long
      if (!looksLikeLaTeX(latexContent) || (!displayMode && latexContent.length > MAX_INLINE_LATEX_LENGTH)) {
        // Treat as plain text instead of attempting to render
        elements.push(
          <React.Fragment key={`text-${key++}`}>
            {fullMatch}
          </React.Fragment>
        );
        lastIndex = match.index + fullMatch.length;
        continue;
      }

      // Render the LaTeX
      try {
        const html = katex.renderToString(latexContent, {
          displayMode,
          throwOnError: false,
          errorColor: '#cc0000',
        });

        elements.push(
          <span
            key={`latex-${key++}`}
            dangerouslySetInnerHTML={{ __html: html }}
            className={displayMode ? 'block my-4' : 'inline'}
          />
        );
      } catch (error) {
        // If rendering fails, show the original text
        console.error('LaTeX rendering error:', error);
        elements.push(
          <span key={`error-${key++}`} className="text-red-500">
            {fullMatch}
          </span>
        );
      }

      lastIndex = match.index + fullMatch.length;
    }

    // Add any remaining text after the last LaTeX expression
    if (lastIndex < text.length) {
      elements.push(
        <React.Fragment key={`text-${key++}`}>
          {text.substring(lastIndex)}
        </React.Fragment>
      );
    }

    return elements.length > 0 ? elements : [text];
  };

  return (
    <div className={className}>
      {renderLatex(children)}
    </div>
  );
}
