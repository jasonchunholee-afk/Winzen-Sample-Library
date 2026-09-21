/**
 * Winzen Capture Station - Image Parser & 3-Tier Folder Architecture
 * 
 * Implements parsing and directory architecture for the Winzen Capture Station:
 * - 3-Tier Pre-Compressed Architecture:
 *   [Selected_Root_Folder]/
 *   ├── raw/   (Full-res master, Q98)
 *   ├── ai/    (1024px max, Q85 - lightweight for Gemini OCR & classification)
 *   └── thumb/ (400px max, Q80 - lightweight for grids & filmstrips)
 * 
 * - Filename Anatomy:
 *   [GARMENT_ID]_[CAMERA_SUFFIX]_[TIMESTAMP].jpg
 *   e.g.: 20S-1004-2_TOP_1_20260920_181405.jpg
 *         WZ-8K29_MACRO_1_20260920_141525.jpg
 *         TEMP-20260920-143022-01_TOP_2_20260920_143025.jpg
 */

import path from 'path';
import fs from 'fs';

export type ImageRole = 'Front' | 'Back' | 'Label' | 'Detail';
export type ImageTier = 'raw' | 'ai' | 'thumb';

export interface ParsedWinzenImage {
  filename: string;
  garmentId: string;
  cameraSuffix: string;
  role: ImageRole;
  isSticker: boolean;
  isUntagged: boolean;
  timestamp: string;
  inferredAngle?: string;
  viewOrder?: number;
  tier?: ImageTier;
}

export interface GarmentGroup {
  garmentId: string;
  isSticker: boolean;
  isUntagged: boolean;
  images: ParsedWinzenImage[];
  front?: ParsedWinzenImage;
  back?: ParsedWinzenImage;
  label?: ParsedWinzenImage;
  details: ParsedWinzenImage[];
}

export interface TierInspectionResult {
  rootDir: string;
  tiersFound: {
    raw: boolean;
    ai: boolean;
    thumb: boolean;
  };
  filesByTier: {
    raw: string[];
    ai: string[];
    thumb: string[];
  };
  parsedImages: ParsmentSummary[];
  missingTiers: {
    filename: string;
    missingIn: ImageTier[];
  }[];
}

export interface ParsmentSummary {
  garmentId: string;
  isSticker: boolean;
  isUntagged: boolean;
  fileCount: number;
  hasFront: boolean;
  hasBack: boolean;
  hasLabel: boolean;
  files: ParsedWinzenImage[];
}

/**
 * Standard Winzen Capture Station Filename Regex
 * Format: [GARMENT_ID]_[CAMERA_SUFFIX]_[TIMESTAMP].jpg
 */
export const WINZEN_FILENAME_REGEX = /^([A-Za-z0-9-]+)_(TOP_\d+|MACRO_\d+|[A-Za-z0-9_]+)_(\d{8}_\d{6}|\d{10,14})\.(jpe?g|png|webp)$/i;

/**
 * Secondary tolerant regex for slight variations (e.g. without timestamp or legacy suffixes)
 */
export const WINZEN_TOLERANT_REGEX = /^([A-Za-z0-9-]+)[_ ](TOP_\d+|MACRO_\d+|Front|Back|Label|Detail|[A-Za-z0-9_]+)(?:[_ ](\d{8}_\d{6}|\d{10,14}))?\.(jpe?g|png|webp)$/i;

/**
 * Legacy parentheses format regex: e.g. 11S-1906 (B).jpg, 11S-1906 (Label).jpg, 11S-1906 (F).jpg
 */
export const WINZEN_LEGACY_PAREN_REGEX = /^([A-Za-z0-9-]+)[ _]?\(([^)]+)\)\.(jpe?g|png|webp)$/i;

/**
 * Bare garment ID format regex: e.g. 11S-1906.jpg
 */
export const WINZEN_BARE_GARMENT_REGEX = /^([A-Za-z0-9-]+)\.(jpe?g|png|webp)$/i;

/**
 * Deduces canonical role and angle from camera hardware suffix
 */
export function deduceRoleFromSuffix(cameraSuffix: string): {
  role: ImageRole;
  inferredAngle: string;
  viewOrder: number;
} {
  const upper = cameraSuffix.toUpperCase().trim();

  // Top overhead angles
  if (upper === 'TOP_1' || upper === 'F' || upper.includes('FRONT')) {
    return {
      role: 'Front',
      inferredAngle: 'Overhead Primary Front Flat-Lay (Pedal 1 - Shot #1)',
      viewOrder: 1
    };
  }

  if (upper === 'TOP_2' || upper === 'B' || upper.includes('BACK')) {
    return {
      role: 'Back',
      inferredAngle: 'Overhead Primary Back Flat-Lay (Pedal 1 - Shot #2)',
      viewOrder: 2
    };
  }

  if (upper === 'TOP_3' || upper === 'TOP_4' || /^TOP_[3-9]\d*/.test(upper)) {
    const shotNum = upper.replace('TOP_', '');
    return {
      role: 'Detail',
      inferredAngle: `Overhead Extra Styling View (Pedal 1 - Shot #${shotNum})`,
      viewOrder: 2 + (parseInt(shotNum, 10) || 3)
    };
  }

  // Macro camera angles
  if (upper === 'MACRO_1' || upper === 'L' || upper.includes('LABEL') || upper.includes('TAG') || upper.includes('CARD') || upper.includes('STICKER')) {
    return {
      role: 'Label',
      inferredAngle: 'Macro Physical Label / Spec Card / WZ-* Sticker (Pedal 2 - Shot #1)',
      viewOrder: 1
    };
  }

  if (/^MACRO_[2-9]\d*/.test(upper) || upper.includes('COLLAR') || upper.includes('STITCH') || upper.includes('ZIPPER') || upper.includes('GRAIN') || upper.includes('DETAIL')) {
    const shotNum = upper.replace('MACRO_', '');
    return {
      role: 'Detail',
      inferredAngle: `Macro Feature / Defect / Texture Detail (Pedal 2 - Shot #${shotNum})`,
      viewOrder: 10 + (parseInt(shotNum, 10) || 2)
    };
  }

  return {
    role: 'Detail',
    inferredAngle: `Angle Detail: ${cameraSuffix}`,
    viewOrder: 20
  };
}

/**
 * Parses any filename against the Winzen Capture Station specification
 */
export function parseWinzenFilename(filename: string): ParsedWinzenImage | null {
  const baseName = path.basename(filename).trim();
  
  let match = baseName.match(WINZEN_FILENAME_REGEX);
  let garmentId = '';
  let cameraSuffix = '';
  let timestamp = '';

  if (match) {
    garmentId = match[1];
    cameraSuffix = match[2];
    timestamp = match[3];
  } else {
    // Attempt tolerant match
    const tolerantMatch = baseName.match(WINZEN_TOLERANT_REGEX);
    if (tolerantMatch) {
      garmentId = tolerantMatch[1];
      cameraSuffix = tolerantMatch[2];
      timestamp = tolerantMatch[3] || '';
    } else {
      // Attempt legacy parentheses match e.g. 11S-1906 (B).jpg
      const parenMatch = baseName.match(WINZEN_LEGACY_PAREN_REGEX);
      if (parenMatch) {
        garmentId = parenMatch[1];
        cameraSuffix = parenMatch[2];
        timestamp = '';
      } else {
        // Attempt bare garment ID match e.g. 11S-1906.jpg
        const bareMatch = baseName.match(WINZEN_BARE_GARMENT_REGEX);
        if (bareMatch) {
          garmentId = bareMatch[1];
          cameraSuffix = 'TOP_1';
          timestamp = '';
        } else {
          return null;
        }
      }
    }
  }

  const { role, inferredAngle, viewOrder } = deduceRoleFromSuffix(cameraSuffix);
  const cleanId = garmentId.trim();
  const upperId = cleanId.toUpperCase();

  const isSticker = upperId.startsWith('WZ-');
  const isUntagged = upperId.startsWith('UNTAGGED-') || upperId.startsWith('TEMP-') || upperId.startsWith('CAPTURE-TEMP-');

  return {
    filename: baseName,
    garmentId: cleanId,
    cameraSuffix,
    role,
    isSticker,
    isUntagged,
    timestamp,
    inferredAngle,
    viewOrder
  };
}

/**
 * Groups an array of parsed image records by Garment ID
 */
export function groupFilesByGarment(images: (ParsedWinzenImage | string)[]): Map<string, GarmentGroup> {
  const map = new Map<string, GarmentGroup>();

  for (const item of images) {
    const parsed = typeof item === 'string' ? parseWinzenFilename(item) : item;
    if (!parsed) continue;

    let group = map.get(parsed.garmentId);
    if (!group) {
      group = {
        garmentId: parsed.garmentId,
        isSticker: parsed.isSticker,
        isUntagged: parsed.isUntagged,
        images: [],
        details: []
      };
      map.set(parsed.garmentId, group);
    }

    group.images.push(parsed);

    if (parsed.role === 'Front' && !group.front) {
      group.front = parsed;
    } else if (parsed.role === 'Back' && !group.back) {
      group.back = parsed;
    } else if (parsed.role === 'Label' && !group.label) {
      group.label = parsed;
    } else {
      group.details.push(parsed);
    }
  }

  return map;
}

/**
 * Scans a 3-tier root folder ([root]/raw, [root]/ai, [root]/thumb) and checks integrity
 */
export async function inspect3TierRoot(rootDir: string): Promise<TierInspectionResult> {
  const tiers: ImageTier[] = ['raw', 'ai', 'thumb'];
  const tiersFound = {
    raw: false,
    ai: false,
    thumb: false
  };

  const filesByTier: { raw: string[]; ai: string[]; thumb: string[] } = {
    raw: [],
    ai: [],
    thumb: []
  };

  for (const tier of tiers) {
    const tierPath = path.join(rootDir, tier);
    if (fs.existsSync(tierPath) && fs.statSync(tierPath).isDirectory()) {
      tiersFound[tier] = true;
      try {
        const files = fs.readdirSync(tierPath).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
        filesByTier[tier] = files;
      } catch (e) {
        console.warn(`[WinzenCaptureParser] Error reading tier ${tier}:`, e);
      }
    }
  }

  // Use ai/ or raw/ or thumb/ as the union of all captured filenames
  const allFilenames = new Set<string>([
    ...filesByTier.raw,
    ...filesByTier.ai,
    ...filesByTier.thumb
  ]);

  const missingTiers: { filename: string; missingIn: ImageTier[] }[] = [];
  const parsedMap = new Map<string, ParsedWinzenImage>();

  for (const filename of allFilenames) {
    const parsed = parseWinzenFilename(filename);
    if (parsed) {
      parsedMap.set(filename, parsed);
    }

    const missingIn: ImageTier[] = [];
    if (tiersFound.raw && !filesByTier.raw.includes(filename)) missingIn.push('raw');
    if (tiersFound.ai && !filesByTier.ai.includes(filename)) missingIn.push('ai');
    if (tiersFound.thumb && !filesByTier.thumb.includes(filename)) missingIn.push('thumb');

    if (missingIn.length > 0) {
      missingTiers.push({ filename, missingIn });
    }
  }

  // Summarize per Garment
  const garmentGroups = groupFilesByGarment(Array.from(parsedMap.values()));
  const parsedSummaries: ParsmentSummary[] = [];

  for (const [garmentId, group] of garmentGroups.entries()) {
    parsedSummaries.push({
      garmentId,
      isSticker: group.isSticker,
      isUntagged: group.isUntagged,
      fileCount: group.images.length,
      hasFront: !!group.front,
      hasBack: !!group.back,
      hasLabel: !!group.label,
      files: group.images.sort((a, b) => (a.viewOrder || 0) - (b.viewOrder || 0))
    });
  }

  return {
    rootDir,
    tiersFound,
    filesByTier,
    parsedImages: parsedSummaries,
    missingTiers
  };
}

/**
 * Returns canonical public/server relative URL for an image given tier and filename
 */
export function getTierUrl(tier: ImageTier, filename: string): string {
  // If tier is ai, mapped to /images_ai/ or /ai/
  // If thumb, mapped to /images_thumb/ or /thumb/
  // If raw, mapped to /images/ or /raw/
  switch (tier) {
    case 'ai':
      return `/ai/${filename}`;
    case 'thumb':
      return `/thumb/${filename}`;
    case 'raw':
    default:
      return `/raw/${filename}`;
  }
}
