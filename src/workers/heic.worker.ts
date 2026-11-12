/// <reference lib="webworker" />

import { heicTo } from 'heic-to/next';

export type HeicWorkerResponse =
  | { type: 'done'; blob: Blob }
  | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const blob = await heicTo({ blob: event.data, type: 'image/png' });
    self.postMessage({ type: 'done', blob } satisfies HeicWorkerResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ type: 'error', message } satisfies HeicWorkerResponse);
  }
};
