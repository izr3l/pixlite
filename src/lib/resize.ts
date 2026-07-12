export async function resizeImage(
  file: File | Blob,
  fileType: string,
  targetWidth: number,
  targetHeight: number,
  maintainAspectRatio: boolean,
  skipResize: boolean = false
): Promise<Blob> {
  if (skipResize) {
    return file;
  }

  const bitmap = await createImageBitmap(file);

  let finalWidth = targetWidth;
  let finalHeight = targetHeight;

  if (maintainAspectRatio) {
    // If the aspect ratio needs to be strictly maintained based on one dimension,
    // we assume the UI already provided the correctly calculated width and height.
    // But as a fallback, we can ensure it matches.
    const originalAspect = bitmap.width / bitmap.height;
    const targetAspect = targetWidth / targetHeight;

    // Small epsilon to account for rounding errors in UI
    if (Math.abs(originalAspect - targetAspect) > 0.01) {
      // Re-calculate based on width as source of truth
      finalHeight = Math.round(targetWidth / originalAspect);
    }
  }

  // Ensure minimum 1x1
  finalWidth = Math.max(1, finalWidth);
  finalHeight = Math.max(1, finalHeight);

  // Skip resize if dimensions are exactly the same
  if (finalWidth === bitmap.width && finalHeight === bitmap.height) {
    return file;
  }

  const canvas = new OffscreenCanvas(finalWidth, finalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context from OffscreenCanvas');
  }

  // Draw the image onto the canvas
  ctx.drawImage(bitmap, 0, 0, finalWidth, finalHeight);

  // Close the bitmap to free up memory
  bitmap.close();

  // Convert canvas back to Blob
  // For resize, we keep quality at 1.0; the compress module handles the final quality reduction.
  const blob = await canvas.convertToBlob({ type: fileType, quality: 1 });
  return blob;
}
