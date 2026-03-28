import { GoogleGenAI } from "@google/genai";
import type { RetrievalResult } from './retrieval_service.ts';

export class ResponseGenerationService {
  private ai: GoogleGenAI | null = null;

  private getAI(): GoogleGenAI {
    if (!this.ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
      }
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return this.ai;
  }

  async generate(
    query: string, 
    context: RetrievalResult[], 
    systemInstruction: string,
    history: any[] = []
  ) {
    const contextText = context.length > 0 
      ? `\n\nApproved Knowledge Context (Use this for facts):\n${context.map(c => `[Source: ${c.source_title}] ${c.text}`).join('\n\n')}`
      : "\n\nNo specific approved knowledge found for this query. Answer based on general leadership philosophy and public positioning.";

    const fullInstruction = `${systemInstruction}${contextText}\n\nIMPORTANT: Be concise. Limit your response to 2-3 short paragraphs. Only use the provided context for specific facts. If the context is missing, answer in general executive terms. Do not invent details.`;

    const ai = this.getAI();
    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: fullInstruction,
        maxOutputTokens: 2048,
      },
      history: history.slice(-10) // Keep only last 10 messages for context
    });

    const response = await chat.sendMessage({ message: query });
    return response.text;
  }
}
