import * as exifr from 'exifr';
import piexif from 'piexifjs';

export async function parseMetadata(file: File | Blob): Promise<Record<string, any> | null> {
  try {
    const metadata = await exifr.parse(file, { tiff: true, exif: true, gps: true, iptc: true });
    return metadata || null;
  } catch (error) {
    // If exifr.parse() throws (e.g. corrupt EXIF, no EXIF present)
    return null;
  }
}

export function stripAllMetadata(jpegDataUrl: string): string {
  try {
    return piexif.remove(jpegDataUrl);
  } catch (error) {
    console.warn('[Pixlite] Could not strip metadata. Exporting without stripping.', error);
    return jpegDataUrl;
  }
}

export function stripGPSOnly(jpegDataUrl: string): string {
  try {
    const exifObj = piexif.load(jpegDataUrl);
    if (exifObj && exifObj['GPS']) {
      delete exifObj['GPS'];
      const exifBytes = piexif.dump(exifObj);
      return piexif.insert(exifBytes, jpegDataUrl);
    }
    return jpegDataUrl;
  } catch (error) {
    console.warn('[Pixlite] Could not strip GPS metadata. Exporting without stripping.', error);
    return jpegDataUrl;
  }
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Important: piexifjs only works on JPEG.
 * For PNG and WebP, metadata stripping is handled implicitly because
 * Canvas.toBlob() does not preserve EXIF metadata chunks by default when drawing and exporting.
 */
