/** Decode HEIC locally; load the decoder only when a HEIC file is uploaded. */
export async function decodeHeic(file: File): Promise<Blob> {
  const { heicTo } = await import('heic-to/next');

  // Keep the decoded pixels lossless until the user's output settings are applied.
  return heicTo({ blob: file, type: 'image/png' });
}
