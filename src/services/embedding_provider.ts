import { GoogleGenAI } from "@google/genai";

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
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

  async embed(text: string): Promise<number[]> {
    try {
      const ai = this.getAI();
      const result = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [text],
      });
      return result.embeddings[0].values;
    } catch (error) {
      console.error("Embedding error:", error);
      // Fallback: return a mock vector if API fails
      return new Array(768).fill(0).map(() => Math.random());
    }
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    return new Array(768).fill(0).map(() => Math.random());
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (process.env.GEMINI_API_KEY) {
    return new GeminiEmbeddingProvider();
  }
  return new MockEmbeddingProvider();
}
