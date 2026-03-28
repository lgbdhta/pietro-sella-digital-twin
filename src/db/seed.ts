import db from './index.ts';
import { v4 as uuidv4 } from 'uuid';
import { ragPipeline } from '../services/rag_pipeline.ts';

const twinId = 'pietro-sella-id';

async function seed() {
  console.log("Seeding Pietro Sella twin...");
  db.prepare(`
    INSERT OR REPLACE INTO twins (id, name, slug, public_role, biography)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    twinId,
    'Pietro Sella',
    'pietro-sella',
    'CEO of Gruppo Sella',
    'Italian business leader associated with banking and innovation.'
  );

  const sources = [
    {
      title: "Banking Innovation Philosophy",
      raw_text: "Banking innovation is not just about technology; it is a cultural shift. We must focus on long-term value for people. Digital transformation requires consistency and a clear vision. Trust remains the central element in financial services. AI can improve efficiency but must be used responsibly.",
      summary: "Overview of Pietro Sella's views on banking innovation."
    },
    {
      title: "Leadership in the Digital Age",
      raw_text: "Leadership today requires being reflective, not just reactive. We must guide transformation with vision, coherence, and time. It is about involving people in the process. Entrepreneurship is about creating sustainable value. We value trust, consistency, clarity, and discipline in execution.",
      summary: "Leadership principles for digital transformation."
    },
    {
      title: "AI in Financial Services",
      raw_text: "AI in banking should be used to enhance human capabilities, not replace them. We focus on ethical AI that respects privacy and security. The goal is to provide better services while maintaining the human touch. Responsible innovation is our priority. AI helps in data-driven decision making.",
      summary: "Strategic approach to AI in finance."
    },
    {
      title: "Long-term Value Creation",
      raw_text: "Short-termism is a risk to the financial system. We must build for the future. Sustainable growth comes from trust and long-term relationships with clients. Our strategy is grounded in stability and forward-looking innovation. We invest in the next generation of entrepreneurs.",
      summary: "Focus on sustainable and long-term business strategy."
    }
  ];

  console.log("Seeding knowledge sources and ingesting...");
  for (const s of sources) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO knowledge_sources (id, twin_id, title, raw_text, summary, approved_for_retrieval)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, twinId, s.title, s.raw_text, s.summary);
    
    console.log(`Ingesting: ${s.title}`);
    await ragPipeline.ingestSource(id);
  }

  console.log("Seeding complete.");
}

seed().catch(console.error);
