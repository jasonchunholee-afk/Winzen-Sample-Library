const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const ocrTarget = 'async function runGeminiOCR(imageBuffer: Buffer, garmentId: string) {';
const ocrReplacement = [
  'async function runGeminiOCR(imageBuffer: Buffer, garmentId: string) {',
  '  if (!process.env.GEMINI_API_KEY) return null;',
  '  try {',
  '    const ai = new GoogleGenAI({',
  '      apiKey: process.env.GEMINI_API_KEY,',
  '      httpOptions: { headers: { "User-Agent": "aistudio-build" } }',
  '    });',
  '    const base64 = imageBuffer.toString("base64");',
  '    const activeRules = await db.select().from(labeling_rules).where(eq(labeling_rules.is_active, true));',
  '    const glossary = await db.select().from(abbreviation_library);',
  '    const rulesText = activeRules.map(r => `[${r.rule_code} ${r.rule_type.toUpperCase()}] ${r.rule_title}: ${r.rule_instruction} (FORBIDDEN: ${r.example_negative || "N/A"})`).join("\\n");',
  '    const glossaryText = glossary.map(g => `${g.term}: ${g.expansion_en} | ${g.expansion_zh || ""} (${g.functional_notes || ""})`).join("\\n");'
].join('\n');

if (code.includes(ocrTarget) && !code.includes('activeRules = await db.select()')) {
  code = code.replace(ocrTarget, ocrReplacement);
  code = code.replace(
    'Return ONLY valid JSON with non-null extracted fields.`;',
    'CRITICAL RULES:\\n${rulesText}\\n\\nGLOSSARY:\\n${glossaryText}\\n\\nReturn ONLY valid JSON with non-null extracted fields.`;'
  );
}

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts successfully");
