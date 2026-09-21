import fs from 'fs';
import path from 'path';
import { db } from '../../src/db/index.ts';
import { garments, images, labeling_rules, abbreviation_library, users } from '../../src/db/schema.ts';
import { eq, sql } from 'drizzle-orm';

export interface SeedExportResult {
  garmentsCount: number;
  imagesCount: number;
  rulesCount: number;
  abbreviationsCount: number;
  exportedAt: string;
}

export class SeedManager {
  private static dataDir = path.join(process.cwd(), 'data');

  public static async bakeSeedFiles(): Promise<SeedExportResult> {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const allGarments = await db.select().from(garments).orderBy(garments.id);
    const allImages = await db.select({
      id: images.id,
      garment_id: images.garment_id,
      role: images.role,
      filename: images.filename,
      created_at: images.created_at
    }).from(images).orderBy(images.id);
    const allRules = await db.select().from(labeling_rules).orderBy(labeling_rules.id);
    const allAbbreviations = await db.select().from(abbreviation_library).orderBy(abbreviation_library.id);

    fs.writeFileSync(
      path.join(this.dataDir, 'seed_garments.json'),
      JSON.stringify(allGarments, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      path.join(this.dataDir, 'seed_images.json'),
      JSON.stringify(allImages, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      path.join(this.dataDir, 'seed_rules.json'),
      JSON.stringify(allRules, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      path.join(this.dataDir, 'seed_abbreviations.json'),
      JSON.stringify(allAbbreviations, null, 2),
      'utf8'
    );

    // Also write a consolidated seed bundle
    const bundle = {
      exportedAt: new Date().toISOString(),
      counts: {
        garments: allGarments.length,
        images: allImages.length,
        rules: allRules.length,
        abbreviations: allAbbreviations.length
      },
      garments: allGarments,
      images: allImages,
      rules: allRules,
      abbreviations: allAbbreviations
    };

    fs.writeFileSync(
      path.join(this.dataDir, 'seed_database.json'),
      JSON.stringify(bundle, null, 2),
      'utf8'
    );

    console.log(`[SeedManager] Baked permanent seed files to ${this.dataDir}:`);
    console.log(`  - ${allGarments.length} garments in seed_garments.json`);
    console.log(`  - ${allImages.length} images in seed_images.json`);
    console.log(`  - ${allRules.length} labeling rules in seed_rules.json`);
    console.log(`  - ${allAbbreviations.length} abbreviations in seed_abbreviations.json`);

    return {
      garmentsCount: allGarments.length,
      imagesCount: allImages.length,
      rulesCount: allRules.length,
      abbreviationsCount: allAbbreviations.length,
      exportedAt: bundle.exportedAt
    };
  }

  public static async hydrateDatabase(): Promise<{
    garmentsHydrated: number;
    imagesHydrated: number;
    rulesHydrated: number;
    abbreviationsHydrated: number;
  }> {
    let garmentsHydrated = 0;
    let imagesHydrated = 0;
    let rulesHydrated = 0;
    let abbreviationsHydrated = 0;

    // 1. Ensure default users exist
    try {
      await db.insert(users).values({ uid: 'jason', email: 'jason@example.com' }).onConflictDoNothing();
      await db.insert(users).values({ uid: 'jennifer', email: 'jennifer@example.com' }).onConflictDoNothing();
    } catch (e: any) {
      console.warn('[SeedManager] Users seed warning:', e?.message || e);
    }

    // 2. Hydrate Garments
    const garmentsPath = path.join(this.dataDir, 'seed_garments.json');
    if (fs.existsSync(garmentsPath)) {
      try {
        const fileContent = fs.readFileSync(garmentsPath, 'utf8');
        const seedGarments: any[] = JSON.parse(fileContent);

        if (Array.isArray(seedGarments) && seedGarments.length > 0) {
          for (const g of seedGarments) {
            try {
              await db.insert(garments).values({
                id: g.id,
                brand: g.brand || null,
                buyer: g.buyer || null,
                season: g.season || null,
                sales: g.sales || null,
                merchandiser: g.merchandiser || null,
                brand_code: g.brand_code || null,
                goods_no: g.goods_no || null,
                sample_stage: g.sample_stage || null,
                handwritten_notes: g.handwritten_notes || null,
                cust_style_no: g.cust_style_no || null,
                y_style_no: g.y_style_no || null,
                garment_type: g.garment_type || null,
                washing: g.washing || null,
                fabric_raw: g.fabric_raw || null,
                gnw_weight: g.gnw_weight || null,
                gnw_is_ai_estimated: g.gnw_is_ai_estimated ?? 0,
                fabric_yarn_count: g.fabric_yarn_count || null,
                fabric_material: g.fabric_material || null,
                fabric_construction: g.fabric_construction || null,
                sample_job_no: g.sample_job_no || null,
                color: g.color || null,
                color_is_ai_estimated: g.color_is_ai_estimated ?? 0,
                size: g.size || null,
                print_datetime: g.print_datetime || null,
                description: g.description || null,
                remark_memo: g.remark_memo || null,
                location: g.location || null,
                status: g.status || 'under_review',
                reviewer_feedback: g.reviewer_feedback || null,
                structural_feedback: g.structural_feedback || null,
                content_notes: g.content_notes || null,
                hashtags: g.hashtags || null,
                default_front_image_id: g.default_front_image_id || null,
                invisible_hashtags: g.invisible_hashtags || null,
                previous_generated_code: g.previous_generated_code || null,
                equated_by: g.equated_by || null,
                equated_at: g.equated_at ? new Date(g.equated_at) : null,
                shelving_status: g.shelving_status || 'unshelfed',
                assigned_location: g.assigned_location || null,
                temp_container: g.temp_container || null,
                shelved_at: g.shelved_at ? new Date(g.shelved_at) : null,
                shelved_by: g.shelved_by || null,
                warehouse_batch_id: g.warehouse_batch_id || null
              }).onConflictDoUpdate({
                target: garments.id,
                set: {
                  merchandiser: g.merchandiser || null,
                  brand_code: g.brand_code || null,
                  goods_no: g.goods_no || null,
                  sample_stage: g.sample_stage || null,
                  handwritten_notes: g.handwritten_notes || null,
                  buyer: g.buyer || null,
                  sales: g.sales || null,
                  garment_type: g.garment_type || null,
                  fabric_material: g.fabric_material || null,
                  description: g.description || null,
                  remark_memo: g.remark_memo || null,
                  hashtags: g.hashtags || null
                }
              });
              garmentsHydrated++;
            } catch (err: any) {
              console.warn(`[SeedManager] Note hydrating garment ${g.id}:`, err?.message || err);
            }
          }
        }
      } catch (err: any) {
        console.error('[SeedManager] Error reading seed_garments.json:', err);
      }
    }

    // 3. Hydrate Images
    const imagesPath = path.join(this.dataDir, 'seed_images.json');
    if (fs.existsSync(imagesPath)) {
      try {
        const fileContent = fs.readFileSync(imagesPath, 'utf8');
        const seedImages: any[] = JSON.parse(fileContent);

        if (Array.isArray(seedImages) && seedImages.length > 0) {
          for (const img of seedImages) {
            try {
              await db.insert(images).values({
                id: img.id,
                garment_id: img.garment_id,
                role: img.role || 'Front',
                filename: img.filename,
                created_at: img.created_at ? new Date(img.created_at) : new Date()
              }).onConflictDoNothing();
              imagesHydrated++;
            } catch (err: any) {
              console.warn(`[SeedManager] Note hydrating image ${img.id}:`, err?.message || err);
            }
          }
        }
      } catch (err: any) {
        console.error('[SeedManager] Error reading seed_images.json:', err);
      }
    }

    // 4. Hydrate Labeling Rules
    const rulesPath = path.join(this.dataDir, 'seed_rules.json');
    if (fs.existsSync(rulesPath)) {
      try {
        const fileContent = fs.readFileSync(rulesPath, 'utf8');
        const seedRules: any[] = JSON.parse(fileContent);

        if (Array.isArray(seedRules) && seedRules.length > 0) {
          for (const r of seedRules) {
            try {
              const existing = await db.select().from(labeling_rules).where(eq(labeling_rules.rule_code, r.rule_code));
              if (existing.length === 0) {
                await db.insert(labeling_rules).values({
                  rule_code: r.rule_code,
                  rule_type: r.rule_type || 'positive',
                  target_field: r.target_field || 'buyer',
                  rule_title: r.rule_title,
                  condition_trigger: r.condition_trigger || '',
                  rule_instruction: r.rule_instruction || '',
                  example_positive: r.example_positive || null,
                  example_negative: r.example_negative || null,
                  source_feedback: r.source_feedback || null,
                  is_active: r.is_active ?? true
                });
              } else {
                await db.update(labeling_rules).set({
                  rule_type: r.rule_type || 'positive',
                  target_field: r.target_field || 'buyer',
                  rule_title: r.rule_title,
                  condition_trigger: r.condition_trigger || '',
                  rule_instruction: r.rule_instruction || '',
                  example_positive: r.example_positive || null,
                  example_negative: r.example_negative || null,
                  source_feedback: r.source_feedback || null,
                  is_active: r.is_active ?? true
                }).where(eq(labeling_rules.rule_code, r.rule_code));
              }
              rulesHydrated++;
            } catch (err: any) {
              console.warn(`[SeedManager] Note hydrating rule ${r.rule_code}:`, err?.message || err);
            }
          }
        }
      } catch (err: any) {
        console.error('[SeedManager] Error reading seed_rules.json:', err);
      }
    }

    // 5. Hydrate Abbreviations
    const abbrPath = path.join(this.dataDir, 'seed_abbreviations.json');
    if (fs.existsSync(abbrPath)) {
      try {
        const fileContent = fs.readFileSync(abbrPath, 'utf8');
        const seedAbbr: any[] = JSON.parse(fileContent);

        if (Array.isArray(seedAbbr) && seedAbbr.length > 0) {
          for (const a of seedAbbr) {
            try {
              const term = a.term || a.abbreviation;
              if (!term) continue;
              const existing = await db.select().from(abbreviation_library).where(eq(abbreviation_library.term, term));
              if (existing.length === 0) {
                await db.insert(abbreviation_library).values({
                  term: term,
                  category: a.category || 'fiber/material',
                  expansion_en: a.expansion_en || a.full_text || term,
                  expansion_zh: a.expansion_zh || null,
                  functional_notes: a.functional_notes || a.notes || null,
                  source: a.source || 'seed'
                });
              }
              abbreviationsHydrated++;
            } catch (err: any) {
              console.warn(`[SeedManager] Note hydrating abbreviation ${a.term || a.abbreviation}:`, err?.message || err);
            }
          }
        }
      } catch (err: any) {
        console.error('[SeedManager] Error reading seed_abbreviations.json:', err);
      }
    }

    console.log(`[SeedManager] Startup hydration complete:`);
    console.log(`  - ${garmentsHydrated} garments processed`);
    console.log(`  - ${imagesHydrated} images processed`);
    console.log(`  - ${rulesHydrated} rules processed`);
    console.log(`  - ${abbreviationsHydrated} abbreviations processed`);

    return {
      garmentsHydrated,
      imagesHydrated,
      rulesHydrated,
      abbreviationsHydrated
    };
  }
}
