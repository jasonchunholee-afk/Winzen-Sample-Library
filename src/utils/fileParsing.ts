/**
 * File Parsing & Normalization Engine
 * 
 * Sits between raw drag-and-drop / file-input and the batch upload manager.
 * Responsible for:
 * 1. Deeply stripping operating system copy suffixes (e.g. - Copy, (1), - 複製, - 副本).
 * 2. Strict Winzen garment ID extraction and role classification (Front, Back, Label).
 * 3. Deterministic session ID generation for reliable chunk resumption.
 */

export interface ParsedFileInfo {
  detectedGarmentId: string;
  role: 'Front' | 'Back' | 'Label';
  roleDetail?: string;
  timestamp?: string;
  isUntaggedPrototype?: boolean;
  cleanedName: string;
  deterministicSessionId: string;
}

/**
 * Thoroughly strips operating system duplicate and copy suffixes.
 * Loops recursively until all nested copy tags are removed.
 */
export function stripCopySuffixes(str: string): string {
  let prev = '';
  let curr = str;
  while (prev !== curr) {
    prev = curr;
    curr = curr
      .replace(/\s*-\s*copy(\s*\(\d+\))?/gi, '')
      .replace(/\s*-\s*複製.*$/gi, '')
      .replace(/\s*-\s*副本.*$/gi, '')
      .replace(/\s*\(\d+\)$/gi, '')
      .trim();
  }
  return curr;
}

/**
 * Parses a File and extracts its canonical Garment ID, Image Role, Timestamp, and cleaned base name.
 * Supports:
 * - Standard: 20S-1004-2 (F).jpg, 20S-1004-2_Front.jpg
 * - Timestamped: 20S-1004-2_Front_1726481920.jpg
 * - Detail shots: 20S-1004-2_Detail_Collar_1726481920.jpg
 * - Reversible / Jackets: 20S-1004-2_SideA_Front.jpg, 20S-1004-2_Front_Closed.jpg
 * - Untagged Prototypes: UNTAGGED-20260916-01_Front.jpg
 */
export function detectGarmentAndRole(
  file: File, 
  fallbackGarmentId?: string, 
  fallbackRole: 'Front' | 'Back' | 'Label' = 'Label'
): ParsedFileInfo {
  const parsed = file.name.split('.');
  parsed.pop();
  const nameWithoutExt = parsed.join('.').trim();

  let cleanedName = stripCopySuffixes(nameWithoutExt);

  // 0. Extract optional trailing timestamp (e.g. _1726481920 or _20260916123045)
  let timestamp: string | undefined;
  const timestampMatch = cleanedName.match(/_([0-9]{10,14})$/);
  if (timestampMatch) {
    timestamp = timestampMatch[1];
    cleanedName = cleanedName.substring(0, cleanedName.length - timestampMatch[0].length).trim();
  }

  // 1. Detect Untagged or Temporary Prototype Code (UNTAGGED-* or TEMP-*)
  const isUntaggedPrototype = /^(UNTAGGED|TEMP|CAPTURE-TEMP)[-_]/i.test(cleanedName);

  // 2. Detect Role & Role Detail strictly adhering to Winzen conventions
  let role: 'Front' | 'Back' | 'Label' = 'Label';
  let roleDetail: string | undefined;

  if (/\((f|front)\)/i.test(cleanedName) || /[\s_-](f|front|front_closed|sidea_front|top_front)(\s|_|$)/i.test(cleanedName)) {
    role = 'Front';
    if (/front_closed/i.test(cleanedName)) roleDetail = 'Closed';
    if (/sidea_front/i.test(cleanedName)) roleDetail = 'Side A';
    if (/top_front/i.test(cleanedName)) roleDetail = 'Top Front';
  } else if (/\((b|back)\)/i.test(cleanedName) || /[\s_-](b|back|sidea_back|top_back)(\s|_|$)/i.test(cleanedName)) {
    role = 'Back';
    if (/sidea_back/i.test(cleanedName)) roleDetail = 'Side A';
    if (/top_back/i.test(cleanedName)) roleDetail = 'Top Back';
  } else if (/\((l|label|tag)\)/i.test(cleanedName) || /[\s_-](l|label|tag)(\s|_|$)/i.test(cleanedName)) {
    role = 'Label';
  } else if (/[\s_-]detail[_-]/i.test(cleanedName) || /[\s_-](sideb|lining|bottom_front|bottom_back|front_open)/i.test(cleanedName)) {
    // Detail angles or secondary views map to Back or Front in legacy 3-role view with specific detail notes
    if (/sideb_front|front_open|bottom_front/i.test(cleanedName)) {
      role = 'Front';
      roleDetail = 'Alternative Front / Detail';
    } else {
      role = 'Back';
      roleDetail = 'Detail View';
    }
  } else {
    const isGarmentPattern = /^(\d{2}[A-Za-z0-9]*-\d+|UNTAGGED|TEMP|CAPTURE-TEMP)/i.test(cleanedName);
    if (isGarmentPattern) {
      role = 'Label';
    } else {
      role = fallbackRole || 'Label';
    }
  }

  // 3. Extract Garment ID
  let detectedGarmentId = '';
  const untaggedMatch = cleanedName.match(/^((?:UNTAGGED|TEMP|CAPTURE-TEMP)-[A-Za-z0-9-]+)/i);
  const winzenMatch = cleanedName.match(/^(\d{2,}[A-Za-z0-9]*-\d+(?:-\d+)?)/i);

  if (untaggedMatch && untaggedMatch[1]) {
    detectedGarmentId = untaggedMatch[1].toUpperCase();
  } else if (winzenMatch && winzenMatch[1]) {
    detectedGarmentId = winzenMatch[1].toUpperCase();
  } else {
    const cleanId = cleanedName
      .replace(/\s*\([FBLfbl]\)/i, '')
      .replace(/[\s_-]+(front|back|label|tag|detail.*|side[ab].*|lining)/i, '')
      .replace(/\s*\([^\)]*\)/i, '')
      .trim();

    const isGenericCameraName = /^(img|dsc|photo|image|picture|p_|scan|screenshot)[\d_-]*$/i.test(cleanId);
    if (isGenericCameraName || !cleanId) {
      detectedGarmentId = fallbackGarmentId || (isUntaggedPrototype ? 'UNTAGGED-PROTOTYPE' : '17S-2409-1');
    } else {
      detectedGarmentId = cleanId;
    }
  }

  // Deterministic session ID ensures reloaded files resume exactly from the missing packet
  const safeFileIdentifier = file.name.replace(/[^a-zA-Z0-9_-]/g, '');
  const deterministicSessionId = `up_${detectedGarmentId}_${role}_${safeFileIdentifier}_${file.size}_${file.lastModified || 0}`;

  return {
    detectedGarmentId,
    role,
    roleDetail,
    timestamp,
    isUntaggedPrototype,
    cleanedName,
    deterministicSessionId
  };
}

/**
 * Extracts 2-digit year and 4-digit code from garment ID for strict chronological tile sorting.
 * 
 * Rules:
 * 1. First by the 2 beginning digits (Year, e.g. '11', '13', '17', '20', etc.)
 * 2. Followed by the next 4 digits (Garment code, e.g. '1906', '1060', '2409', etc.)
 * 
 * Examples:
 * - '11S-1906' -> year: 11, code: 1906
 * - '13S-1060' -> year: 13, code: 1060
 * - '20S-1004-2' -> year: 20, code: 1004
 * - 'UNTAGGED-01' -> fallback to 999999 so standard garments come first, or sorted alphabetically
 */
export function extractGarmentYearAndCode(id: string): { year: number; code: number; raw: string } {
  if (!id) return { year: 9999, code: 9999, raw: '' };
  
  const trimmed = id.trim().toUpperCase();
  // Match standard Winzen garment ID pattern: 2 digits (year) + optional letters/seasons (e.g. S, W, SS) + separator + 4 digits (code)
  const match = trimmed.match(/^(\d{2})[A-Za-z0-9]*-(\d{4})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const code = parseInt(match[2], 10);
    return { year: isNaN(year) ? 9999 : year, code: isNaN(code) ? 9999 : code, raw: trimmed };
  }

  // Secondary fallback: match any 2 leading digits, and then the first subsequent 3-5 digits
  const fallbackMatch = trimmed.match(/^(\d{2})[^\d]*(\d{3,5})/);
  if (fallbackMatch) {
    const year = parseInt(fallbackMatch[1], 10);
    const code = parseInt(fallbackMatch[2], 10);
    return { year: isNaN(year) ? 9999 : year, code: isNaN(code) ? 9999 : code, raw: trimmed };
  }

  // Untagged or non-standard format
  return { year: 9999, code: 9999, raw: trimmed };
}

/**
 * Comparator to sort garments primarily by 2 beginning digits (year),
 * followed by next 4 digits (code).
 * Supports both 'asc' (oldest first: 11S, 13S, 20S...) and 'desc' (newest first: 22S, 21S, 20S...).
 */
export function compareGarmentsByYearAndCode(a: { id: string }, b: { id: string }, order: 'asc' | 'desc' = 'asc'): number {
  const parsedA = extractGarmentYearAndCode(a?.id || '');
  const parsedB = extractGarmentYearAndCode(b?.id || '');

  // 1. Sort by 2-digit year
  if (parsedA.year !== parsedB.year) {
    return order === 'desc' 
      ? parsedB.year - parsedA.year 
      : parsedA.year - parsedB.year;
  }

  // 2. Sort by 4-digit code
  if (parsedA.code !== parsedB.code) {
    return order === 'desc'
      ? parsedB.code - parsedA.code
      : parsedA.code - parsedB.code;
  }

  // 3. Tie-breaker: alphabetical raw ID string
  return order === 'desc'
    ? (b?.id || '').localeCompare(a?.id || '')
    : (a?.id || '').localeCompare(b?.id || '');
}
