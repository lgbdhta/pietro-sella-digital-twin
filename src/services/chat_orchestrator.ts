import { ragPipeline } from './rag_pipeline.ts';
import { tavusService } from './tavus_service.ts';

export interface ChatResult {
  reply_text: string;
  response_source: 'gemini_rag' | 'general_knowledge' | 'mock';
  retrieval: any;
  app_state: string;
  ai_state: string;
  avatar_state: string;
  warnings: string[];
}

export class ChatOrchestrator {
  async processMessage(
    message: string,
    twinId: string,
    systemInstruction: string,
    history: any[] = []
  ): Promise<ChatResult> {
    const warnings: string[] = [];
    let replyText = "Mi scuso, ma non sono in grado di rispondere al momento.";
    let responseSource: 'gemini_rag' | 'general_knowledge' | 'mock' = 'mock';
    let retrieval: any = null;

    try {
      // 1. Get response from Gemini (RAG)
      const ragResult = await ragPipeline.processChat(message, twinId, systemInstruction, history);
      replyText = ragResult.answer;
      responseSource = ragResult.retrieval.source as any;
      retrieval = ragResult.retrieval;

      // 2. Voice is handled natively by Tavus replica
    } catch (error: any) {
      console.error('ChatOrchestrator error:', error.message);
      if (error.stack) {
        console.error('ChatOrchestrator error stack:', error.stack);
      }
      warnings.push(`Failed to process chat: ${error.message}`);
    }

    return {
      reply_text: replyText,
      response_source: responseSource,
      retrieval,
      app_state: 'speaking',
      ai_state: 'ready',
      avatar_state: 'connected',
      warnings
    };
  }
}

export const chatOrchestrator = new ChatOrchestrator();
