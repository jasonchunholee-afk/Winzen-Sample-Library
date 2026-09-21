import { db } from './src/db/index.ts';
import { garments, summaries } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function updateRemainingGarments() {
  console.log("Updating remaining garments with new rules & abbreviations...");

  // 1. 11S-1906
  await db.update(garments).set({
    buyer: 'HUGO BOSS (HB)',
    garment_type: 'Short-Sleeve V-Neck T-Shirt',
    remark_memo: '洗水辦 (Washed Sample)',
    fabric_raw: '32/1 100% COTTON SINGLE JERSEY / 32/1 棉平紋布',
    gnw_weight: '185gm/m2',
    fabric_yarn_count: '32/1',
    fabric_material: '100% COTTON',
    fabric_construction: 'SINGLE JERSEY',
    color: 'Blue Tie-Dye',
    size: 'L',
    description: "Men's knitted short-sleeve V-neck T-shirt in blue tie-dye single jersey cotton.",
    hashtags: '#reactive_tie_dye, #v_neck, #s_slv, #single_jersey, #cotton',
    invisible_hashtags: '#pigment_tie_dye, #washed_out, #dip_dye, #vintage_wash'
  }).where(eq(garments.id, '11S-1906'));

  await db.insert(summaries).values({
    garment_id: '11S-1906',
    summary_text: "Hugo Boss men's knitted short-sleeve V-neck T-shirt (11S-1906) crafted from 32/1 100% Cotton Single Jersey (185gm/m2). The garment features a vibrant Blue Tie-Dye treatment evaluated as reactive dye due to deep fiber saturation and uniform chromatic depth. Under Winzen labeling rules, '#reactive_tie_dye' is designated as the primary classification with '#pigment_tie_dye' indexed as an invisible alternative tag for similarity retrieval. Sample stage is classified as 洗水辦 (Washed Sample).",
    rating: 5
  });

  // 2. 13S-1060
  await db.update(garments).set({
    buyer: 'HUGO BOSS / Boss Green Men (BGM)',
    garment_type: 'Quarter-Zip Pullover', // Stripped 'Jacket' per NEG-001
    remark_memo: 'ESP-SHA-SWIND PRO 13 Performance Layer',
    fabric_raw: '54% Polyester 30% S.Cafe Polyester 16% PU Bonded Fleece, 190gm/m2', // Stripped F-670: per NEG-002
    gnw_weight: '190gm/m2', // Standardized from 11.5 LBS/DOZ per NEG-003
    fabric_material: '54% Polyester, 30% S.Café Coffee Polyester, 16% PU (Polyurethane)',
    fabric_construction: 'Bonded Fleece',
    color: 'Dark Navy',
    description: "Hugo Boss Green Men (BGM) athletic quarter-zip performance pullover in dark navy bonded fleece with S.Café odour control and PU stretch.",
    hashtags: '#quarter_zip_pullover, #s_cafe, #coffee_yarn, #bonded_fleece, #pu_stretch, #boss_green',
    invisible_hashtags: '#jacket, #fleece_jacket, #half_zip, #windbreaker, #outerwear'
  }).where(eq(garments.id, '13S-1060'));

  await db.insert(summaries).values({
    garment_id: '13S-1060',
    summary_text: "Hugo Boss Green Men (BGM) technical performance quarter-zip pullover (13S-1060, style ESP-SHA-SWIND PRO 13). Fabric is a specialized bonded fleece (190gm/m2) composed of 54% Polyester, 30% S.Café recycled coffee polyester (providing permanent natural odour-absorption and UV protection), and 16% PU (Polyurethane) delivering athletic 4-way mechanical stretch. Internal factory code F-670 has been stripped from buyer-facing specs in accordance with NEG-002, and classification is firmly set as Quarter-Zip Pullover rather than Jacket per NEG-001.",
    rating: 5
  });

  // 3. 13S-1160-5
  await db.update(garments).set({
    buyer: 'HUGO BOSS / Boss Green Men (BGM)',
    garment_type: 'Short-Sleeve Polo Shirt', // Replaced '復辦' per NEG-005
    remark_memo: '復辦 (Repeat Sample)',
    fabric_raw: '60/2 100% Mercerized Cotton Stripe Jacquard Jersey / 60/2 全棉橫間提花平紋布(單絲光)',
    gnw_weight: '195gm/m2', // Standardized from 5 7/8 P
    fabric_yarn_count: '60/2',
    fabric_material: '100% Mercerized Cotton',
    fabric_construction: 'Stripe Jacquard Jersey, Mercerized',
    color: 'Grey Melange',
    size: 'L',
    description: "Hugo Boss Green Men (BGM) men's knitted short-sleeve polo shirt (Pavel) in grey melange with 60/2 fine mercerized stripe jacquard jersey.",
    hashtags: '#polo_shirt, #s_slv, #mercerized_cotton, #stripe_jacquard, #grey_melange, #boss_green',
    invisible_hashtags: '#t_shirt, #knit_shirt, #golf_polo'
  }).where(eq(garments.id, '13S-1160-5'));

  await db.insert(summaries).values({
    garment_id: '13S-1160-5',
    summary_text: "Hugo Boss Green Men (BGM) men's knitted short-sleeve polo shirt (13S-1160-5, style Pavel). Built from premium 60/2 two-ply 100% mercerized cotton stripe jacquard jersey (195gm/m2) in Grey Melange. Single mercerization treatment imparts a silky luster, refined hand-feel, and enhanced dimensional stability. Sample development stage is classified as 復辦 (Repeat Sample) and excluded from the garment_type taxonomy per Rule NEG-005.",
    rating: 5
  });

  // 4. 17S-2409-1
  await db.update(garments).set({
    buyer: 'HUGO BOSS / Boss Black Men (BBM)', // Corrected corrupted "BMB黑喽"
    garment_type: 'Short-Sleeve Polo Shirt (Phillipson 43)', // Replaced '大辦' per NEG-005
    remark_memo: '大辦 (Production / Size Set Sample)',
    fabric_raw: '60/1x2 100% Mercerized Cotton Double Pique / 60/1x2 100% 棉雙珠地布(布絲光)',
    gnw_weight: '250gm/m2',
    fabric_yarn_count: '60/1x2',
    fabric_material: '100% Mercerized Cotton',
    fabric_construction: 'Double Pique (雙珠地)',
    color: 'Dark Navy / 深藍',
    size: 'L',
    description: "Hugo Boss Black Men (BBM) Phillipson 43 short-sleeve tailored polo shirt in dark navy 60/1x2 double pique mercerized cotton.",
    hashtags: '#polo_shirt, #double_pique, #mercerized_cotton, #phillipson_43, #boss_black, #s_slv',
    invisible_hashtags: '#t_shirt, #pique_shirt, #classic_polo'
  }).where(eq(garments.id, '17S-2409-1'));

  await db.insert(summaries).values({
    garment_id: '17S-2409-1',
    summary_text: "Hugo Boss Black Men (BBM) tailored luxury short-sleeve polo shirt (17S-2409-1, style Phillipson 43). Fabric is a substantial 250gm/m2 60/1x2 double-knit mercerized cotton double pique (布絲光雙珠地) in deep dark navy. The fabric treatment ensures high-definition pique honeycomb texture, breathability, and wrinkle resistance suitable for core business casual attire. Buyer identification corrected from OCR corruption to BBM (Boss Black Men).",
    rating: 5
  });

  // 5. 18S-1859-1
  await db.update(garments).set({
    buyer: 'HUGO BOSS (HB)',
    garment_type: 'Long-Sleeve Polo Shirt (PEOS)', // Replaced '大辦' per NEG-005
    remark_memo: '大辦 (Production Sample)',
    fabric_raw: '26/1 Cotton + 150D/48F Polyester Yarn-Dyed Jacquard Jersey / 26/1 全棉 + 150D/48F POLY 色紗提花平紋布',
    gnw_weight: '205gm/m2', // Standardized from 6 1/8 CB
    fabric_yarn_count: '26/1, 150D/48F',
    fabric_material: 'Cotton + Polyester',
    fabric_construction: 'Yarn-Dyed Jacquard Jersey',
    color: 'Royal Blue Combo / 寶藍組',
    size: 'M(存)',
    description: "Hugo Boss men's long-sleeve polo shirt (PEOS 50413982) in royal blue yarn-dyed cotton/poly jacquard jersey.",
    hashtags: '#l_slv_polo, #long_sleeve, #jacquard_jersey, #yarn_dyed, #peos, #royal_blue',
    invisible_hashtags: '#s_slv, #t_shirt, #knit_sweater, #sweatshirt'
  }).where(eq(garments.id, '18S-1859-1'));

  await db.insert(summaries).values({
    garment_id: '18S-1859-1',
    summary_text: "Hugo Boss men's long-sleeve polo shirt (18S-1859-1, customer style PEOS 50413982, FW19). Featuring a customized 205gm/m2 yarn-dyed jacquard jersey blended from 26/1 cotton and 150D/48F filament polyester in a royal blue chromatic grouping. The dual-yarn composition gives crisp shape retention, vivid color contrast, and durability for long-sleeve autumn/winter knitwear. Development sample stage是大辦 (Production Sample).",
    rating: 5
  });

  console.log("Successfully updated all remaining garments with new rules and generated updated archival summaries!");
}

updateRemainingGarments().catch(console.error);
