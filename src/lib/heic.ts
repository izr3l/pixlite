import type { HeicWorkerResponse } from '../workers/heic.worker';

const DECODE_TIMEOUT_MS = 90_000;
const DECODE_ERROR = 'This HEIC image could not be decoded. Try exporting it as JPEG or PNG.';

async function decodeNatively(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let canvas: OffscreenCanvas | HTMLCanvasElement | undefined;

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = offscreen.getContext('2d');
      if (context) {
        canvas = offscreen;
        context.drawImage(bitmap, 0, 0);
        return await offscreen.convertToBlob({ type: 'image/png' });
      }
    }

    // Safari can support HEIC decoding before supporting OffscreenCanvas.
    const element = document.createElement('canvas');
    canvas = element;
    element.width = bitmap.width;
    element.height = bitmap.height;
    const context = element.getContext('2d');
    if (!context) throw new Error(DECODE_ERROR);
    context.drawImage(bitmap, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      element.toBlob(blob => blob ? resolve(blob) : reject(new Error(DECODE_ERROR)), 'image/png');
    });
  } finally {
    bitmap.close();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}

function decodeInWorker(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      // Each conversion owns its decoder, so a failed library worker cannot poison retries.
      worker = new Worker(new URL('../workers/heic.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      reject(new Error('HEIC decoding is unavailable in this browser. Try exporting the image as JPEG or PNG.'));
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      fail('This HEIC image took too long to decode. Try a smaller image or export it as JPEG first.');
    }, DECODE_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    worker.onmessage = (event: MessageEvent<HeicWorkerResponse>) => {
      if (settled) return;
      const response = event.data;
      if (response?.type === 'done' && response.blob instanceof Blob && response.blob.size > 0) {
        settled = true;
        cleanup();
        resolve(response.blob);
      } else {
        fail(DECODE_ERROR);
      }
    };
    worker.onerror = event => {
      event.preventDefault();
      fail('The HEIC decoder stopped unexpectedly. Try adding the image again.');
    };
    worker.onmessageerror = () => {
      fail('The decoded HEIC image could not be read. Try adding the image again.');
    };

    try {
      worker.postMessage(file);
    } catch {
      fail('This HEIC image could not be read. Try adding the image again.');
    }
  });
}

/** Decode locally and retain lossless pixels until output settings are applied. */
export async function decodeHeic(file: File): Promise<Blob> {
  try {
    return await decodeNatively(file);
  } catch {
    return decodeInWorker(file);
  }
}
