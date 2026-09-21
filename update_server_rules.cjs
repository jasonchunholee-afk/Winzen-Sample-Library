const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Ensure schema imports labeling_rules and abbreviation_library
if (!serverCode.includes('labeling_rules')) {
  serverCode = serverCode.replace(
    'structural_change_requests',
    'structural_change_requests, labeling_rules, abbreviation_library'
  );
}

// Add API endpoints for rules and abbreviations
const endpoints = `
  // --- LABELING RULES API ---
  app.get("/api/rules", async (req, res) => {
    try {
      const allRules = await db.select().from(labeling_rules).orderBy(desc(labeling_rules.created_at));
      res.json(allRules);
    } catch (err) {
      console.error("Error fetching rules:", err);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });

  app.post("/api/rules", async (req, res) => {
    try {
      const { rule_code, rule_type, target_field, rule_title, condition_trigger, rule_instruction, example_positive, example_negative, source_feedback } = req.body;
      const newRule = await db.insert(labeling_rules).values({
        rule_code: rule_code || 'RULE-' + Date.now().toString().slice(-4),
        rule_type: rule_type || 'positive',
        target_field: target_field || 'general',
        rule_title: rule_title || 'Untitled Rule',
        condition_trigger: condition_trigger || '',
        rule_instruction: rule_instruction || '',
        example_positive: example_positive || '',
        example_negative: example_negative || '',
        source_feedback: source_feedback || 'Developer Manual Entry',
        is_active: true
      }).returning();
      res.json(newRule[0]);
    } catch (err) {
      console.error("Error creating rule:", err);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });

  app.patch("/api/rules/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.select().from(labeling_rules).where(eq(labeling_rules.id, parseInt(id)));
      if (existing.length === 0) return res.status(404).json({ error: "Rule not found" });
      const updated = await db.update(labeling_rules)
        .set({ is_active: !existing[0].is_active, updated_at: new Date() })
        .where(eq(labeling_rules.id, parseInt(id)))
        .returning();
      res.json(updated[0]);
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle rule" });
    }
  });

  // --- ABBREVIATION & GLOSSARY API ---
  app.get("/api/abbreviations", async (req, res) => {
    try {
      const allTerms = await db.select().from(abbreviation_library).orderBy(abbreviation_library.term);
      res.json(allTerms);
    } catch (err) {
      console.error("Error fetching abbreviations:", err);
      res.status(500).json({ error: "Failed to fetch abbreviations" });
    }
  });

  app.post("/api/abbreviations", async (req, res) => {
    try {
      const { term, category, expansion_en, expansion_zh, functional_notes, source } = req.body;
      const newTerm = await db.insert(abbreviation_library).values({
        term: term.trim(),
        category: category || 'general',
        expansion_en: expansion_en || '',
        expansion_zh: expansion_zh || '',
        functional_notes: functional_notes || '',
        source: source || 'Developer Console'
      }).returning();
      res.json(newTerm[0]);
    } catch (err) {
      console.error("Error creating abbreviation:", err);
      res.status(500).json({ error: "Failed to create abbreviation" });
    }
  });
`;

if (!serverCode.includes('app.get("/api/rules"')) {
  serverCode = serverCode.replace('app.get("/api/garments"', endpoints + '\n  app.get("/api/garments"');
}

fs.writeFileSync('server.ts', serverCode);
console.log("Updated server.ts with Rules & Abbreviations APIs");
