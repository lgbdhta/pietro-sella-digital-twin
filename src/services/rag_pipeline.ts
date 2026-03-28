import { type EmbeddingProvider, getEmbeddingProvider } from './embedding_provider.ts';
import { RetrievalService } from './retrieval_service.ts';
import { KnowledgeIngestionService } from './knowledge_ingestion_service.ts';
import { ResponseGenerationService } from './response_generation_service.ts';
import db from '../db/index.ts';
import { v4 as uuidv4 } from 'uuid';

export class RAGPipeline {
  private embeddingProvider: EmbeddingProvider;
  private retrievalService: RetrievalService;
  private ingestionService: KnowledgeIngestionService;
  private generationService: ResponseGenerationService;

  constructor() {
    this.embeddingProvider = getEmbeddingProvider();
    this.retrievalService = new RetrievalService(this.embeddingProvider);
    this.ingestionService = new KnowledgeIngestionService(this.embeddingProvider);
    this.generationService = new ResponseGenerationService();
  }

  async processChat(query: string, twinId: string, systemInstruction: string, history: any[] = []) {
    // 1. Intent classification (simplified)
    const needsKnowledge = query.length > 15; // Simple heuristic

    let context: any[] = [];
    if (needsKnowledge) {
      context = await this.retrievalService.retrieve(query, twinId);
    }

    // 2. Generate answer
    const answer = await this.generationService.generate(query, context, systemInstruction, history);

    // 3. Log retrieval
    const logId = uuidv4();
    db.prepare(`
      INSERT INTO retrieval_logs (id, query_text, selected_chunk_ids_json, scores_json)
      VALUES (?, ?, ?, ?)
    `).run(
      logId,
      query,
      JSON.stringify(context.map(c => c.chunk_id)),
      JSON.stringify(context.map(c => c.score))
    );

    return {
      answer,
      retrieval: {
        chunks: context,
        source: context.length > 0 ? 'gemini_rag' : 'general_knowledge'
      }
    };
  }

  async ingestSource(sourceId: string) {
    return this.ingestionService.ingest(sourceId);
  }
}

export const ragPipeline = new RAGPipeline();
