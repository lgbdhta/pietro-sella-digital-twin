import express from "express";
import "express-async-errors";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
import { v4 as uuidv4 } from 'uuid';
import db from './src/db/index.ts';
import { ragPipeline } from './src/services/rag_pipeline.ts';
import { tavusService } from './src/services/tavus_service.ts';
import { chatOrchestrator } from './src/services/chat_orchestrator.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health/rag", async (req, res) => {
    const chunkCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_chunks').get() as any;
    let geminiStatus = "ok";
    let geminiError = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const { getEmbeddingProvider } = await import('./src/services/embedding_provider.ts');
        const provider = getEmbeddingProvider();
        await provider.embed("health check");
      } catch (error: any) {
        geminiStatus = "error";
        geminiError = error.message;
      }
    } else {
      geminiStatus = "not_configured";
    }

    res.json({
      status: geminiStatus,
      error: geminiError,
      embeddings: process.env.GEMINI_API_KEY ? "configured" : "mock",
      vector_store: "sqlite_fallback",
      chunk_count: chunkCount.count
    });
  });

  app.get("/api/health/tavus", (req, res) => {
    res.json({
      configured: tavusService.isConfigured(),
      provider: "tavus",
      replica_id: tavusService.getReplicaId() || "not_set"
    });
  });

  app.post("/api/chat", async (req, res) => {
    const { message, twinId, systemInstruction, history } = req.body;
    try {
      const result = await chatOrchestrator.processMessage(message, twinId, systemInstruction, history);
      res.json(result);
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Avatar Session Endpoints
  app.post("/api/avatar/session/start", async (req, res) => {
    try {
      console.log("Starting avatar session...");
      const replicaId = tavusService.getReplicaId();
      console.log("Tavus Config:", {
        replica_id: replicaId,
        is_configured: tavusService.isConfigured()
      });
      
      let conversation;
      try {
        conversation = await tavusService.createConversation();
      } catch (error: any) {
        if (error.message.toLowerCase().includes("maximum concurrent conversations")) {
          console.log("Maximum concurrent conversations reached. Attempting to stop all active sessions and retry...");
          await tavusService.stopAllConversations();
          // Wait a bit longer for the API to register the closed sessions
          console.log("Waiting for sessions to terminate...");
          await new Promise(resolve => setTimeout(resolve, 4000));
          conversation = await tavusService.createConversation();
        } else {
          throw error;
        }
      }
      
      console.log("Avatar session started:", conversation.conversation_id);
      res.json(conversation);
    } catch (error: any) {
      console.error("Avatar session start error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/avatar/session/:id", async (req, res) => {
    try {
      const status = await tavusService.getConversationStatus(req.params.id);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/avatar/session/:id/stop", async (req, res) => {
    try {
      await tavusService.stopConversation(req.params.id);
      res.json({ status: "stopped" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tavus Custom LLM Endpoint
  app.post("/api/tavus/llm", async (req, res) => {
    const { transcript, conversation_id } = req.body;
    console.log(`Tavus LLM Request for ${conversation_id}: ${transcript}`);
    try {
      const result = await chatOrchestrator.processMessage(
        transcript, 
        'pietro-sella-id', 
        process.env.PIETRO_SELLA_SYSTEM_INSTRUCTION || "You are Pietro Sella.",
        [] // We might want to handle history better here if Tavus doesn't provide it
      );
      res.json({ response: result.reply_text });
    } catch (error) {
      console.error("Tavus LLM error:", error);
      res.json({ response: "Mi scuso, ho avuto un problema tecnico nell'elaborare la risposta." });
    }
  });

  app.post("/api/avatar/session/:id/comment", async (req, res) => {
    const { text } = req.body;
    try {
      await tavusService.sendComment(req.params.id, text);
      res.json({ status: "sent" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Knowledge Endpoints
  app.post("/api/admin/knowledge", (req, res) => {
    const { twin_id, title, source_type, source_url, raw_text, summary } = req.body;
    const id = uuidv4();
    db.prepare(`
      INSERT INTO knowledge_sources (id, twin_id, title, source_type, source_url, raw_text, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, twin_id, title, source_type, source_url, raw_text, summary);
    res.json({ id });
  });

  app.get("/api/admin/knowledge", (req, res) => {
    const sources = db.prepare('SELECT * FROM knowledge_sources').all();
    res.json(sources);
  });

  app.post("/api/admin/knowledge/:id/ingest", async (req, res) => {
    const { id } = req.params;
    try {
      await ragPipeline.ingestSource(id);
      res.json({ status: "ingested" });
    } catch (error) {
      console.error("Ingestion error:", error);
      res.status(500).json({ error: "Ingestion failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
