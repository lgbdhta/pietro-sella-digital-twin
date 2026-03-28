import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.ts';
import type { EmbeddingProvider } from './embedding_provider.ts';

export class KnowledgeIngestionService {
  private embeddingProvider: EmbeddingProvider;
  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  async ingest(sourceId: string) {
    const source = db.prepare('SELECT * FROM knowledge_sources WHERE id = ?').get(sourceId) as any;
    if (!source) throw new Error('Source not found');

    const text = source.raw_text;
    const chunks = this.chunkText(text);

    // Clear existing chunks for this source
    db.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(sourceId);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = await this.embeddingProvider.embed(chunkText);
      
      db.prepare(`
        INSERT INTO knowledge_chunks (id, source_id, twin_id, chunk_index, chunk_text, embedding_vector, trust_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        sourceId,
        source.twin_id,
        i,
        chunkText,
        JSON.stringify(embedding),
        1 // Default trust level
      );
    }
  }

  private chunkText(text: string, maxChars: number = 1000): string[] {
    // Simple sentence-aware chunking
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      currentChunk += sentence;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk.trim());
    
    return chunks;
  }
}
