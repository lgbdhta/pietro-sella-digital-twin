import db from '../db/index.ts';
import type { EmbeddingProvider } from './embedding_provider.ts';

export interface RetrievalResult {
  chunk_id: string;
  text: string;
  source_title: string;
  score: number;
  trust_level: number;
}

export class RetrievalService {
  private embeddingProvider: EmbeddingProvider;
  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async retrieve(query: string, twinId: string, limit: number = 5): Promise<RetrievalResult[]> {
    const queryVector = await this.embeddingProvider.embed(query);
    
    // Fallback: Similarity search in JS since we don't have pgvector
    const chunks = db.prepare(`
      SELECT kc.id, kc.chunk_text, kc.embedding_vector, kc.trust_level, ks.title as source_title
      FROM knowledge_chunks kc
      JOIN knowledge_sources ks ON kc.source_id = ks.id
      WHERE kc.twin_id = ? AND ks.approved_for_retrieval = 1
    `).all(twinId) as any[];

    const results = chunks.map(chunk => {
      const chunkVector = JSON.parse(chunk.embedding_vector);
      const similarity = this.cosineSimilarity(queryVector, chunkVector);
      return {
        chunk_id: chunk.id,
        text: chunk.chunk_text,
        source_title: chunk.source_title,
        score: similarity,
        trust_level: chunk.trust_level
      };
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
