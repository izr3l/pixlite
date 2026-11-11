const MAX_SIZE = 150 * 1024 * 1024; // 150 MB
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
];

export const IMAGE_UPLOAD_ACCEPT = [...ALLOWED_MIMES, '.heic', '.heif'].join(',');

export function isHeicFile(file: Pick<File, 'name' | 'type'>): boolean {
  const mime = file.type.toLowerCase();
  return mime === 'image/heic' || mime === 'image/heif' ||
    ((!mime || mime === 'application/octet-stream') && /\.(heic|heif)$/i.test(file.name));
}

export function validateBatch(files: File[], currentQueueCount: number): { accepted: File[], rejectedCount: number } {
  const MAX_QUEUE = 20;
  const availableSlots = Math.max(0, MAX_QUEUE - currentQueueCount);
  
  if (availableSlots <= 0) {
    return { accepted: [], rejectedCount: files.length };
  }
  
  if (files.length > availableSlots) {
    return {
      accepted: files.slice(0, availableSlots),
      rejectedCount: files.length - availableSlots
    };
  }
  
  return { accepted: files, rejectedCount: 0 };
}

export async function validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // 1. Check file size <= 150MB first (before reading anything to ArrayBuffer)
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `${file.name} is too large. Maximum is 150 MB.` };
  }

  // Some operating systems leave the MIME type of HEIC/HEIF files unset.
  // Extension fallback still requires a matching file signature below.
  const isHeic = isHeicFile(file);
  if (!ALLOWED_MIMES.includes(file.type) && !isHeic) {
    return { valid: false, error: `${file.name} is not a supported format.` };
  }

  // 3. Check magic bytes
  const buffer = await file.slice(0, isHeic ? 4096 : 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  if (!(isHeic ? checkHeicSignature(bytes, file.size) : checkMagicBytes(bytes, file.type))) {
    return { valid: false, error: `${file.name} is not a supported format.` };
  }

  return { valid: true };
}

function checkHeicSignature(bytes: Uint8Array, fileSize: number): boolean {
  // HEIC uses an ISO BMFF ftyp box. mif1 alone is insufficient: AVIF and
  // other codecs share the HEIF container, so require a HEVC-specific brand.
  if (bytes.length < 16 || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxSize = view.getUint32(0);
  if (boxSize < 16 || boxSize > fileSize || boxSize % 4 !== 0) return false;

  const brandAt = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  const brands = [brandAt(8)];
  for (let offset = 16; offset + 4 <= Math.min(boxSize, bytes.length); offset += 4) {
    brands.push(brandAt(offset));
  }

  if (brands.includes('avif') || brands.includes('avis')) return false;
  return brands.some(brand => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs'].includes(brand));
}

function checkMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) {
    // Some very small files might be valid but < 12 bytes? Not realistically for these formats.
    return false; 
  }

  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase());

  switch (mime) {
    case 'image/jpeg':
      // JPEG: FF D8 FF
      return hex[0] === 'FF' && hex[1] === 'D8' && hex[2] === 'FF';
      
    case 'image/png':
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      return hex.slice(0, 8).join(' ') === '89 50 4E 47 0D 0A 1A 0A';
      
    case 'image/webp':
      // WebP: RIFF (52 49 46 46) + 4 bytes + WEBP (57 45 42 50)
      return hex.slice(0, 4).join(' ') === '52 49 46 46' && hex.slice(8, 12).join(' ') === '57 45 42 50';
      
    case 'image/gif':
      // GIF: GIF8 (47 49 46 38)
      return hex.slice(0, 4).join(' ') === '47 49 46 38';
      
    case 'image/avif':
      // AVIF: ... ftypavif -> ftyp (66 74 79 70) avif (61 76 69 66) at offset 4
      return hex.slice(4, 12).join(' ') === '66 74 79 70 61 76 69 66';
      
    default:
      return false;
  }
}
