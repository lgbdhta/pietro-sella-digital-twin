import { v4 as uuidv4 } from "uuid";

import db from "../../dist/db/index.js";
import { ragPipeline } from "../../dist/services/rag_pipeline.js";
import { tavusService } from "../../dist/services/tavus_service.js";
import { chatOrchestrator } from "../../dist/services/chat_orchestrator.js";

console.log("NETLIFY FUNCTION STARTED");

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

/** Map /.netlify/functions/api/chat → /api/chat after redirect */
function normalizePath(event) {
  let p = event.path || "";
  const fnPrefix = "/.netlify/functions/api";
  if (p.startsWith(fnPrefix)) {
    const rest = p.slice(fnPrefix.length) || "/";
    if (rest === "/") return "/api/health";
    return rest.startsWith("/api") ? rest : `/api${rest}`;
  }
  return p;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const path = normalizePath(event);
  const method = event.httpMethod;

  try {
    if (method === "GET" && path === "/api/health") {
      return json(200, { status: "ok", service: "api" });
    }

    if (method === "GET" && path === "/api/health/rag") {
      const chunkCount = db
        .prepare("SELECT COUNT(*) as count FROM knowledge_chunks")
        .get();

      return json(200, {
        status: "ok",
        chunk_count: chunkCount.count,
      });
    }

    if (method === "GET" && path === "/api/health/tavus") {
      return json(200, {
        configured: tavusService.isConfigured(),
      });
    }

    if (method === "POST" && path === "/api/chat") {
      const body = JSON.parse(event.body || "{}");

      try {
        const result = await chatOrchestrator.processMessage(
          body.message,
          body.twinId,
          body.systemInstruction,
          body.history
        );

        return json(200, result);
      } catch (err) {
        console.error("Chat error:", err);
        return json(500, { error: "Chat failed" });
      }
    }

    if (method === "POST" && path === "/api/avatar/session/start") {
      try {
        const conversation = await tavusService.createConversation();
        return json(200, conversation);
      } catch (err) {
        console.error(err);
        return json(500, { error: "Tavus error" });
      }
    }

    if (method === "POST" && path === "/api/admin/knowledge") {
      const body = JSON.parse(event.body || "{}");

      const id = uuidv4();

      db.prepare(`
        INSERT INTO knowledge_sources 
        (id, twin_id, title, source_type, source_url, raw_text, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        body.twin_id,
        body.title,
        body.source_type,
        body.source_url,
        body.raw_text,
        body.summary
      );

      return json(200, { id });
    }

    return json(404, { error: "Not found" });
  } catch (error) {
    console.error("API error:", error);
    return json(500, { error: error.message });
  }
}
