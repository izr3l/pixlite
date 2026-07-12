/**
 * compress.ts — Uses native OffscreenCanvas for hardware-accelerated compression.
 * This avoids the heavy JavaScript-based browser-image-compression library which
 * is extremely slow on large files (6-10MB+).
 */

export async function compressImage(
  blob: Blob,
  outputFormat: string,
  quality: number,
  useTargetSize: boolean,
  targetSizeKB: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const finalFormat = outputFormat === 'original' ? blob.type || 'image/jpeg' : outputFormat;

  // PNG and GIF are lossless — quality param has no effect, just re-export
  if (finalFormat === 'image/png' || finalFormat === 'image/gif') {
    onProgress?.(50);
    const result = await reEncodeViaCanvas(blob, finalFormat, 1);
    onProgress?.(100);
    return result;
  }

  if (!useTargetSize) {
    // Simple single-pass re-encode at the specified quality
    onProgress?.(30);
    const result = await reEncodeViaCanvas(blob, finalFormat, quality / 100);
    onProgress?.(100);
    return result;
  }

  // Binary search to hit target size (only when useTargetSize is enabled)
  const targetBytes = targetSizeKB * 1024;
  let lo = 0.1;
  let hi = 1.0;
  let bestBlob: Blob | null = null;
  const maxIterations = 8;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    onProgress?.(Math.round((i / maxIterations) * 90));
    const candidate = await reEncodeViaCanvas(blob, finalFormat, mid);

    if (candidate.size <= targetBytes) {
      bestBlob = candidate;
      lo = mid; // too small, try higher quality
    } else {
      hi = mid; // too large, try lower quality
    }

    if (hi - lo < 0.02) break; // converged
  }

  onProgress?.(100);

  // If we never found a result under target, return the lowest quality encode
  if (!bestBlob) {
    bestBlob = await reEncodeViaCanvas(blob, finalFormat, lo);
  }

  return bestBlob;
}

/**
 * Re-encodes an image blob via OffscreenCanvas at the given quality.
 * This is hardware-accelerated by the browser's GPU compositor.
 */
async function reEncodeViaCanvas(blob: Blob, format: string, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    bitmap.close();
    throw new Error('Could not acquire 2D canvas context');
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const result = await canvas.convertToBlob({ type: format, quality });
  return result;
}
