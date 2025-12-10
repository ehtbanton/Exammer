/**
 * Maximal Marginal Relevance (MMR) Search Implementation
 *
 * MMR balances relevance to the query with diversity among results.
 * Formula: MMR = λ * sim(query, doc) - (1-λ) * max(sim(doc, selected_docs))
 *
 * Where:
 * - λ (lambda) controls the tradeoff (0.7 = more relevance, 0.3 = more diversity)
 * - sim() is cosine similarity
 */

export interface Document {
  id: number;
  embedding: number[];
  content: string;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  id: number;
  content: string;
  score: number;           // MMR score
  relevance: number;       // Raw relevance to query
  metadata?: Record<string, any>;
}

/**
 * Calculate cosine similarity between two vectors.
 * Returns value between -1 and 1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Perform MMR search to find relevant and diverse results.
 *
 * @param queryEmbedding - The embedding vector for the search query
 * @param documents - Array of documents with embeddings to search
 * @param k - Number of results to return
 * @param lambda - Balance between relevance (1.0) and diversity (0.0). Default 0.7
 * @param threshold - Minimum relevance score to include. Default 0.0
 * @returns Array of search results sorted by MMR score
 */
export function mmrSearch(
  queryEmbedding: number[],
  documents: Document[],
  k: number = 10,
  lambda: number = 0.7,
  threshold: number = 0.0
): SearchResult[] {
  if (documents.length === 0) {
    return [];
  }

  if (k <= 0) {
    return [];
  }

  // Calculate relevance scores for all documents
  const scoredDocs = documents.map(doc => ({
    ...doc,
    relevance: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  // Filter by threshold
  const candidateDocs = scoredDocs.filter(doc => doc.relevance >= threshold);

  if (candidateDocs.length === 0) {
    return [];
  }

  const selected: SearchResult[] = [];
  const selectedEmbeddings: number[][] = [];
  const remaining = new Set(candidateDocs.map((_, i) => i));

  // Iteratively select documents using MMR
  while (selected.length < k && remaining.size > 0) {
    let bestScore = -Infinity;
    let bestIdx = -1;

    for (const idx of remaining) {
      const doc = candidateDocs[idx];

      // Calculate max similarity to already selected documents
      let maxSimToSelected = 0;
      if (selectedEmbeddings.length > 0) {
        for (const selectedEmb of selectedEmbeddings) {
          const sim = cosineSimilarity(doc.embedding, selectedEmb);
          maxSimToSelected = Math.max(maxSimToSelected, sim);
        }
      }

      // MMR score: balance relevance and diversity
      const mmrScore = lambda * doc.relevance - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = idx;
      }
    }

    if (bestIdx === -1) {
      break;
    }

    const doc = candidateDocs[bestIdx];
    selected.push({
      id: doc.id,
      content: doc.content,
      score: bestScore,
      relevance: doc.relevance,
      metadata: doc.metadata,
    });
    selectedEmbeddings.push(doc.embedding);
    remaining.delete(bestIdx);
  }

  return selected;
}

/**
 * Simple similarity search without MMR diversity.
 * Use when you want just the most relevant results.
 */
export function similaritySearch(
  queryEmbedding: number[],
  documents: Document[],
  k: number = 10,
  threshold: number = 0.0
): SearchResult[] {
  if (documents.length === 0) {
    return [];
  }

  const scoredDocs = documents.map(doc => ({
    id: doc.id,
    content: doc.content,
    relevance: cosineSimilarity(queryEmbedding, doc.embedding),
    metadata: doc.metadata,
  }));

  return scoredDocs
    .filter(doc => doc.relevance >= threshold)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, k)
    .map(doc => ({
      ...doc,
      score: doc.relevance, // For simple search, score equals relevance
    }));
}

/**
 * Normalize an embedding vector to unit length.
 * Useful for consistent cosine similarity calculations.
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude === 0) {
    return embedding;
  }

  return embedding.map(val => val / magnitude);
}
