/**
 * Client-Side Image Compression Pipeline
 * 
 * Takes an uncompressed raw image (File or Blob or Canvas) and generates:
 * 1. Raw Blob (for lossless server archival / Google Photos-like storage, 0 AI tokens)
 * 2. Thumbnail Blob (max 400x400, JPEG quality 0.8 - for fast multi-image review grid)
 * 3. AI Inspection Blob (max 1024x1024, JPEG quality 0.85 - token-optimized for OCR analysis)
 */

export interface CompressionResult {
  rawBlob: Blob;
  thumbBlob: Blob;
  aiBlob: Blob;
  originalWidth: number;
  originalHeight: number;
}

export async function compressImageClientSide(
  source: File | Blob | HTMLCanvasElement
): Promise<CompressionResult> {
  let imgBitmap: ImageBitmap | null = null;

  try {
    let rawBlob: Blob;
    if (source instanceof HTMLCanvasElement) {
      rawBlob = await new Promise<Blob>((resolve, reject) => {
        source.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/jpeg', 0.95);
      });
    } else {
      rawBlob = source;
    }

    imgBitmap = await createImageBitmap(rawBlob);
    const originalWidth = imgBitmap.width;
    const originalHeight = imgBitmap.height;

    const thumbBlob = await resizeToBlob(imgBitmap, 400, 400, 0.82);
    const aiBlob = await resizeToBlob(imgBitmap, 1024, 1024, 0.85);

    // If raw image is very large (> 2.5MB from ProArt/DSLR), generate a high-res archive blob (max 2560px, 0.92 quality)
    // This preserves all weave/fabric/spec details while cutting upload payload from 25MB down to ~800KB (30x faster)
    let optimizedRawBlob = rawBlob;
    if (rawBlob.size > 2.5 * 1024 * 1024) {
      try {
        optimizedRawBlob = await resizeToBlob(imgBitmap, 2560, 2560, 0.92);
      } catch (e) {
        console.warn("High-res optimization fallback to original:", e);
      }
    }

    return {
      rawBlob: optimizedRawBlob,
      thumbBlob,
      aiBlob,
      originalWidth,
      originalHeight
    };
  } finally {
    // Explicitly release GPU texture and RAM allocated by createImageBitmap immediately
    if (imgBitmap && typeof imgBitmap.close === 'function') {
      imgBitmap.close();
      imgBitmap = null;
    }
  }
}

async function resizeToBlob(
  source: ImageBitmap,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> {
  let width = source.width;
  let height = source.height;

  // Calculate aspect-ratio preserving dimensions without enlarging
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not obtain canvas 2D rendering context');
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);

  try {
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate JPEG blob'));
        },
        'image/jpeg',
        quality
      );
    });
  } finally {
    // Release canvas buffer memory
    canvas.width = 0;
    canvas.height = 0;
  }
}
