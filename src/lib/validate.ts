const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif'
];

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
  // 1. Check file size <= 20MB first (before reading anything to ArrayBuffer)
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `${file.name} is too large. Maximum is 20 MB.` };
  }

  // 2. Check MIME type
  if (!ALLOWED_MIMES.includes(file.type)) {
    return { valid: false, error: `${file.name} is not a supported format.` };
  }

  // 3. Check magic bytes
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  if (!checkMagicBytes(bytes, file.type)) {
    return { valid: false, error: `${file.name} is not a supported format.` };
  }

  return { valid: true };
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
