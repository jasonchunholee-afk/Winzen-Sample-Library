/**
 * Winzen Garment Shot & Suffix Taxonomy Configuration
 * 
 * Shared configuration contract between:
 * - Winzen Sample Library (Main): Review, Ingestion, OCR & Discrepancy Queue
 * - Winzen Sample Library - Capture (Photo Station): Camera presets, shot checklists & filename stamping
 * 
 * Suffix Conventions:
 * Standard:
 *   - Front: [GARMENT_ID] (F) or [GARMENT_ID]_Front
 *   - Back: [GARMENT_ID] (B) or [GARMENT_ID]_Back
 *   - Label/Spec: [GARMENT_ID] or [GARMENT_ID]_Label
 * 
 * Complex Garments:
 *   - Reversible: [GARMENT_ID]_SideA_Front, [GARMENT_ID]_SideA_Back, [GARMENT_ID]_SideB_Front, [GARMENT_ID]_SideB_Back
 *   - Jackets/Outerwear: [GARMENT_ID]_Front_Closed, [GARMENT_ID]_Front_Open, [GARMENT_ID]_Lining
 *   - 2-Piece Sets: [GARMENT_ID]_Top_Front, [GARMENT_ID]_Top_Back, [GARMENT_ID]_Bottom_Front, [GARMENT_ID]_Bottom_Back
 *   - Custom Details: [GARMENT_ID]_Detail_[Feature] (e.g. Detail_Collar, Detail_Zipper, Detail_Embroidery)
 * 
 * Missing Labels / Prototype:
 *   - [UNTAGGED-YYYYMMDD-XX]_Front.jpg
 *   - Handled by Jennifer (Senior Merchandiser) in Review Queue.
 */

export interface ShotPreset {
  id: string;
  label: string;
  suffix: string;
  role: 'Front' | 'Back' | 'Label' | 'Detail';
  description: string;
  required: boolean;
}

export interface GarmentTaxonomyCategory {
  id: string;
  name: string;
  description: string;
  shots: ShotPreset[];
}

export const WINZEN_TAXONOMY_CATEGORIES: GarmentTaxonomyCategory[] = [
  {
    id: 'standard',
    name: 'Standard Tops & Bottoms',
    description: 'T-Shirts, Polos, Pullovers, Hoodies, Pants, Shorts (Default 3-shot set)',
    shots: [
      { id: 'front', label: 'Front View', suffix: '(F)', role: 'Front', description: 'Full front angle', required: true },
      { id: 'back', label: 'Back View', suffix: '(B)', role: 'Back', description: 'Full back angle', required: true },
      { id: 'label', label: 'Care Label / Spec Card', suffix: '', role: 'Label', description: 'Tag, spec card or neck heat-transfer print', required: true }
    ]
  },
  {
    id: 'jacket_outerwear',
    name: 'Jackets & Lined Outerwear',
    description: 'Zip jackets, coats, windbreakers, blazers requiring open/closed and inner lining shots',
    shots: [
      { id: 'front_closed', label: 'Front (Zipped / Closed)', suffix: 'Front_Closed', role: 'Front', description: 'Exterior closed view', required: true },
      { id: 'front_open', label: 'Front (Open / Unzipped)', suffix: 'Front_Open', role: 'Detail', description: 'Shows inner placket & collar construction', required: true },
      { id: 'back', label: 'Back View', suffix: '(B)', role: 'Back', description: 'Full back angle', required: true },
      { id: 'lining', label: 'Inside Lining / Padding', suffix: 'Inside_Lining', role: 'Detail', description: 'Internal quilt, pocketing or mesh lining', required: false },
      { id: 'label', label: 'Care Label / Spec Card', suffix: '', role: 'Label', description: 'Care label & wash instructions', required: true }
    ]
  },
  {
    id: 'reversible',
    name: 'Reversible Outerwear & Tops',
    description: 'Reversible jackets, bomber jackets, double-face vests',
    shots: [
      { id: 'side_a_front', label: 'Side A Front', suffix: 'SideA_Front', role: 'Front', description: 'Primary side front', required: true },
      { id: 'side_a_back', label: 'Side A Back', suffix: 'SideA_Back', role: 'Back', description: 'Primary side back', required: true },
      { id: 'side_b_front', label: 'Side B Front', suffix: 'SideB_Front', role: 'Detail', description: 'Reversed side front', required: true },
      { id: 'side_b_back', label: 'Side B Back', suffix: 'SideB_Back', role: 'Detail', description: 'Reversed side back', required: true },
      { id: 'label', label: 'Care Label / Pocket Tag', suffix: '', role: 'Label', description: 'Hidden pocket label or hanging tag', required: true }
    ]
  },
  {
    id: 'two_piece_set',
    name: '2-Piece Tracksuits & Sets',
    description: 'Tracksuit top + pants, loungewear sets',
    shots: [
      { id: 'top_front', label: 'Top Front', suffix: 'Top_Front', role: 'Front', description: 'Jacket/Hoodie front view', required: true },
      { id: 'top_back', label: 'Top Back', suffix: 'Top_Back', role: 'Back', description: 'Jacket/Hoodie back view', required: true },
      { id: 'bottom_front', label: 'Pants / Bottom Front', suffix: 'Bottom_Front', role: 'Detail', description: 'Bottom front view', required: true },
      { id: 'bottom_back', label: 'Pants / Bottom Back', suffix: 'Bottom_Back', role: 'Detail', description: 'Bottom back view', required: true },
      { id: 'label', label: 'Care Label / Spec Tag', suffix: '', role: 'Label', description: 'Main care label', required: true }
    ]
  }
];

export const DETAIL_SHOT_PRESETS = [
  { id: 'collar', label: 'Collar / Neckline', suffix: 'Detail_Collar' },
  { id: 'embroidery', label: 'Logo / Embroidery', suffix: 'Detail_Embroidery' },
  { id: 'pocket', label: 'Pocket / Zipper', suffix: 'Detail_Pocket' },
  { id: 'cuff', label: 'Sleeve / Cuff / Hem', suffix: 'Detail_Cuff' },
  { id: 'fabric_macro', label: 'Fabric Texture / Macro', suffix: 'Detail_Fabric' },
  { id: 'defect', label: 'Sample Defect / Note', suffix: 'Detail_Defect' },
];

/**
 * Generates standardized filename with optional timestamp.
 * Example:
 * standard: 20S-1004-2 (F).jpg
 * timestamped: 20S-1004-2_Front_1726481920.jpg
 * untagged: UNTAGGED-20260916-01_Front.jpg
 */
export function buildStandardFilename(
  garmentId: string, 
  suffix: string, 
  timestamp?: number | string
): string {
  const cleanId = garmentId.trim();
  const cleanSuffix = suffix.trim();
  const tsPart = timestamp ? `_${timestamp}` : '';

  if (!cleanSuffix) {
    return `${cleanId}${tsPart}.jpg`;
  }

  // Bracket style (F), (B)
  if (cleanSuffix.startsWith('(') && cleanSuffix.endsWith(')')) {
    return `${cleanId} ${cleanSuffix}${tsPart}.jpg`;
  }

  const separator = cleanSuffix.startsWith('_') || cleanSuffix.startsWith('-') ? '' : '_';
  return `${cleanId}${separator}${cleanSuffix}${tsPart}.jpg`;
}
