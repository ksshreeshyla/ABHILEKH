/**
 * ARCHIVAL SEARCH & RETRIEVAL SERVICE
 * Dr. B. R. Ambedkar Digital Heritage Archive (SIH26096)
 *
 * Implements layered retrieval:
 * 1. Metadata & Exact Facet Filtering (Category, Era, Source Collection)
 * 2. Full-Text Search Simulation (Mirrors PostgreSQL tsvector / GIN Index logic)
 * 3. Prepared Interface for Future Semantic / Vector Embedding RAG Search
 */

import { ArchiveItem } from '../../types/archive';
import { archiveRepository, SearchFilterParams } from './archiveRepository';

export interface SearchResultMatch {
  item: ArchiveItem;
  score: number;
  highlightSnippets: string[];
  matchedField: 'title' | 'author' | 'keyConcepts' | 'description' | 'ocrText';
}

export class ArchivalSearchService {
  /**
   * Executes multi-field full-text search with scoring and snippet highlighting.
   */
  public static async search(params: SearchFilterParams): Promise<SearchResultMatch[]> {
    const allItems = await archiveRepository.getAllItems();
    const query = (params.query || '').trim().toLowerCase();

    // 1. Facet Filtering
    let filtered = allItems;
    if (params.category && params.category !== 'All') {
      filtered = filtered.filter(i => i.category === params.category);
    }
    if (params.status && params.status !== 'All') {
      filtered = filtered.filter(i => i.publishingStatus === params.status);
    }
    if (params.yearRange) {
      filtered = filtered.filter(i => i.year >= params.yearRange![0] && i.year <= params.yearRange![1]);
    }

    if (!query) {
      return filtered.map(item => ({
        item,
        score: 1.0,
        highlightSnippets: [],
        matchedField: 'title'
      }));
    }

    // 2. Lexical Scoring (Simulates PostgreSQL ts_rank)
    const matches: SearchResultMatch[] = [];
    const tokens = query.split(/\s+/).filter(Boolean);

    filtered.forEach(item => {
      let score = 0;
      let matchedField: SearchResultMatch['matchedField'] = 'ocrText';
      const snippets: string[] = [];

      const titleLower = item.title.toLowerCase();
      const authorLower = item.author.toLowerCase();
      const descLower = item.description.toLowerCase();
      const textLower = item.fullText.toLowerCase();

      // Title matches (Weight A = 10.0)
      if (titleLower.includes(query)) {
        score += 10.0;
        matchedField = 'title';
        snippets.push(`Title match: "${item.title}"`);
      } else if (tokens.some(t => titleLower.includes(t))) {
        score += 5.0;
        matchedField = 'title';
      }

      // Key Concepts matches (Weight B = 6.0)
      const matchedConcept = item.keyConcepts.find(c => c.toLowerCase().includes(query));
      if (matchedConcept) {
        score += 6.0;
        if (score <= 6.0) matchedField = 'keyConcepts';
        snippets.push(`Concept match: "${matchedConcept}"`);
      }

      // Author / Archive ID match (Weight B = 5.0)
      if (authorLower.includes(query) || item.archiveId.toLowerCase().includes(query)) {
        score += 5.0;
        if (score <= 5.0) matchedField = 'author';
      }

      // Description match (Weight C = 3.0)
      if (descLower.includes(query)) {
        score += 3.0;
        if (score <= 3.0) matchedField = 'description';
        const start = Math.max(0, descLower.indexOf(query) - 30);
        const end = Math.min(item.description.length, descLower.indexOf(query) + query.length + 50);
        snippets.push(`...${item.description.substring(start, end)}...`);
      }

      // Full text / OCR match (Weight D = 1.0)
      if (textLower.includes(query)) {
        score += 1.0;
        const start = Math.max(0, textLower.indexOf(query) - 40);
        const end = Math.min(item.fullText.length, textLower.indexOf(query) + query.length + 60);
        snippets.push(`OCR Excerpt: "...${item.fullText.substring(start, end).replace(/\n/g, ' ')}..."`);
      }

      if (score > 0) {
        matches.push({
          item,
          score,
          highlightSnippets: snippets.slice(0, 2),
          matchedField
        });
      }
    });

    // Sort descending by relevance score
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Prepared placeholder for future Semantic / Vector RAG search.
   * Will integrate with pgvector `SELECT * FROM rag_chunk_embeddings ORDER BY embedding <=> $1 LIMIT 5`.
   */
  public static async semanticSearchPrepared(
    queryEmbedding: number[]
  ): Promise<{ message: string; dimensions: number }> {
    return {
      message: 'Schema prepared for pgvector cosine distance ranking. Ready for live vector embeddings.',
      dimensions: queryEmbedding.length
    };
  }
}
