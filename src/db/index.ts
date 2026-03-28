import initSqlJs from 'sql.js';
import path from 'path';

let dbInstance: any = null;
let initPromise: Promise<void> | null = null;

/**
 * Wrapper that provides better-sqlite3-compatible API over sql.js
 */
class BetterSqlite3Compat {
  private sqlDb: any;

  constructor(sqlDb: any) {
    this.sqlDb = sqlDb;
  }

  exec(sql: string) {
    this.sqlDb.run(sql);
  }

  prepare(sql: string) {
    const db = this.sqlDb;

    return {
      get(...params: any[]) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        if (stmt.step()) {
          const result = stmt.getAsObject();
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      },

      all(...params: any[]) {
        const results: any[] = [];
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },

      run(...params: any[]) {
        const stmt = db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        stmt.step();
        stmt.free();
        return { changes: db.getRowsModified() };
      },
    };
  }
}

async function initializeDb(): Promise<void> {
  if (dbInstance) return;

  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (file === 'sql-wasm.wasm') {
        return path.join(process.cwd(), 'sql-wasm.wasm');
      }
      return file;
    }
  });

  const sqlDb = new SQL.Database();
  dbInstance = new BetterSqlite3Compat(sqlDb);

  dbInstance.exec(`
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
    )
  `);

  dbInstance.exec(`
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
    )
  `);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      twin_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      chunk_summary TEXT,
      topic_tags_json TEXT,
      trust_level INTEGER DEFAULT 1,
      embedding_vector TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES knowledge_sources(id),
      FOREIGN KEY (twin_id) REFERENCES twins(id)
    )
  `);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS retrieval_logs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      message_id TEXT,
      query_text TEXT,
      selected_chunk_ids_json TEXT,
      scores_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getDb() {
  if (!initPromise) {
    initPromise = initializeDb();
  }
  await initPromise;
  return dbInstance;
}

export default { getDb };
