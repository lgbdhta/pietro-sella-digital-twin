import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(process.cwd(), 'rag.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS twins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    public_role TEXT,
    biography TEXT,
    tone_of_voice TEXT,
    communication_style TEXT,
    approved_claims_json TEXT,
    forbidden_topics_json TEXT,
    supported_languages_json TEXT,
    response_rules_json TEXT,
    avatar_provider TEXT,
    avatar_profile_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS knowledge_sources (
    id TEXT PRIMARY KEY,
    twin_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT,
    source_url TEXT,
    raw_text TEXT,
    summary TEXT,
    approved_for_retrieval BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (twin_id) REFERENCES twins(id)
  );

  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    twin_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_summary TEXT,
    topic_tags_json TEXT,
    trust_level INTEGER DEFAULT 1,
    embedding_vector TEXT, -- Stored as JSON string for fallback
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES knowledge_sources(id),
    FOREIGN KEY (twin_id) REFERENCES twins(id)
  );

  CREATE TABLE IF NOT EXISTS retrieval_logs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    message_id TEXT,
    query_text TEXT,
    selected_chunk_ids_json TEXT,
    scores_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
