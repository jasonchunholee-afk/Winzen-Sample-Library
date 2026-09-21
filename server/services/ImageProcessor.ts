import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface ProcessedImageResult {
  savedFilename: string;
  role: 'Front' | 'Back' | 'Label';
  thumbPath: string;
  aiPath: string;
  rawPath: string;
  thumbBase64: string;
  aiBase64: string;
  rawBase64: string;
  url: string;
  fullUrl: string;
  fallbackUrl: string;
}

/**
 * GarmentImageProcessor
 * 
 * Modular Object-Oriented service for processing and optimizing garment images:
 * - Enforces Winzen naming conventions:
 *   - Front: `${garmentId} (F).jpg`
 *   - Back: `${garmentId} (B).jpg`
 *   - Label / Spec Sheet: `${garmentId}.jpg`
 * - Runs 400px thumbnail and 1024px token-friendly AI pipelines in parallel (Promise.all)
 * - Writes optimized files to disk asynchronously
 */
export class GarmentImageProcessor {
  private imagesDir: string;
  private thumbDir: string;
  private aiDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.imagesDir = path.join(baseDir, 'public', 'images');
    this.thumbDir = path.join(baseDir, 'public', 'images_thumb');
    this.aiDir = path.join(baseDir, 'public', 'images_ai');

    // Ensure target directories exist
    [this.imagesDir, this.thumbDir, this.aiDir].forEach(d => {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    });
  }

  /**
   * Resolves the canonical Winzen filename based on garment ID and role
   */
  public resolveFilename(garmentId: string, role: 'Front' | 'Back' | 'Label'): string {
    const cleanId = garmentId.trim();
    if (role === 'Front') {
      return `${cleanId} (F).jpg`;
    } else if (role === 'Back') {
      return `${cleanId} (B).jpg`;
    } else {
      return `${cleanId}.jpg`;
    }
  }

  /**
   * Processes an assembled raw buffer through parallel Sharp optimization pipelines
   */
  public async process(
    rawBuffer: Buffer,
    garmentId: string,
    role: 'Front' | 'Back' | 'Label'
  ): Promise<ProcessedImageResult> {
    const savedFilename = this.resolveFilename(garmentId, role);
    const rawPath = path.join(this.imagesDir, savedFilename);
    const thumbPath = path.join(this.thumbDir, savedFilename);
    const aiPath = path.join(this.aiDir, savedFilename);

    // Parallel execution of Sharp pipelines to maximize performance
    const [thumbBuffer, aiBuffer] = await Promise.all([
      sharp(rawBuffer)
        .rotate()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer(),
      sharp(rawBuffer)
        .rotate()
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer(),
    ]);

    // Asynchronous parallel file writes
    await Promise.all([
      fs.promises.writeFile(rawPath, rawBuffer),
      fs.promises.writeFile(thumbPath, thumbBuffer),
      fs.promises.writeFile(aiPath, aiBuffer),
    ]);

    return {
      savedFilename,
      role,
      rawPath,
      thumbPath,
      aiPath,
      rawBase64: rawBuffer.toString('base64'),
      thumbBase64: thumbBuffer.toString('base64'),
      aiBase64: aiBuffer.toString('base64'),
      url: `/images_thumb/${savedFilename}`,
      fullUrl: `/images_ai/${savedFilename}`,
      fallbackUrl: `/images/${savedFilename}`
    };
  }
}
