import { create } from 'zustand';
import { isHeicFile, validateBatch, validateFile } from '../lib/validate';
import { decodeHeic } from '../lib/heic';
import { parseMetadata } from '../lib/metadata';
import { toast } from 'sonner';

export type FileStatus = 'loading' | 'pending' | 'processing' | 'done' | 'error';

export type ProcessingStats = {
  originalSize: number;
  outputSize: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  reductionPercent: number;
};

export type QueuedFile = {
  id: string;
  originalFile: File;
  decodedBlob: Blob | null;
  thumbnailUrl: string;
  originalMetadata: Record<string, unknown> | null;
  status: FileStatus;
  progress: number;
  progressStep: string;
  outputBlob: Blob | null;
  outputFilename: string | null;
  stats: ProcessingStats | null;
  error: string | null;
};

export type Settings = {
  resize: {
    enabled: boolean;
    preset: string;
    targetWidth: number;
    targetHeight: number;
    maintainAspectRatio: boolean;
  };
  compress: {
    outputFormat: 'original' | 'image/jpeg' | 'image/webp' | 'image/png' | 'image/avif' | 'image/gif';
    quality: number;
    useTargetSize: boolean;
    targetSizeKB: number;
  };
  metadata: {
    stripAll: boolean;
    stripGPSOnly: boolean;
  };
};

type ImageStore = {
  files: QueuedFile[];
  uploadGeneration: number;
  settings: Settings;
  selectedFileId: string | null;
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (id: string) => void;
  clearAll: () => void;
  updateFileStatus: (id: string, update: Partial<QueuedFile>) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  processAll: () => Promise<void>;
  setSelectedFile: (id: string | null) => void;
};

const defaultSettings: Settings = {
  resize: {
    enabled: false,
    preset: 'original',
    targetWidth: 1920,
    targetHeight: 1080,
    maintainAspectRatio: true,
  },
  compress: {
    outputFormat: 'original',
    quality: 82,
    useTargetSize: false,
    targetSizeKB: 200,
  },
  metadata: {
    stripAll: false,
    stripGPSOnly: false,
  },
};

async function generateThumbnail(file: Blob): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(48, 48);
    const ctx = canvas.getContext('2d');
    if (!ctx) return URL.createObjectURL(file);

    // simple crop to center
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - size) / 2;
    const sy = (bitmap.height - size) / 2;
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 48, 48);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    return URL.createObjectURL(blob);
  } catch {
    // fallback
    return URL.createObjectURL(file);
  }
}

async function prepareImage(file: File) {
  const decodedBlob = isHeicFile(file) ? await decodeHeic(file) : null;
  const thumbnailUrl = await generateThumbnail(decodedBlob ?? file);
  return { decodedBlob, thumbnailUrl };
}

function uploadError(file: File, error: unknown): string {
  const reason = error instanceof Error ? error.message : 'Please try adding the image again.';
  return `Could not load ${file.name}. ${reason}`;
}

export const useImageStore = create<ImageStore>((set, get) => ({
  files: [],
  uploadGeneration: 0,
  settings: defaultSettings,
  selectedFileId: null,
  
  setSelectedFile: (id) => set({ selectedFileId: id }),
  
  addFiles: async (newFiles) => {
    const { files, uploadGeneration } = get();
    
    const uniqueNewFiles: File[] = [];
    let duplicateCount = 0;
    
    for (const newFile of newFiles) {
      const isDuplicate = files.some(
        (existingFile) => 
          existingFile.originalFile.name === newFile.name && 
          existingFile.originalFile.size === newFile.size &&
          existingFile.originalFile.lastModified === newFile.lastModified
      );
      if (isDuplicate) {
        duplicateCount++;
      } else {
        uniqueNewFiles.push(newFile);
      }
    }
    
    if (duplicateCount > 0) {
      toast.info(`Skipped ${duplicateCount} duplicate file${duplicateCount > 1 ? 's' : ''}.`);
    }

    if (uniqueNewFiles.length === 0) return;

    const { accepted, rejectedCount } = validateBatch(uniqueNewFiles, files.length);

    if (rejectedCount > 0) {
      toast.error(`${rejectedCount} files were not added. Maximum is 20 files.`);
    }

    const queuedFiles: QueuedFile[] = [];
    for (const file of accepted) {
      let validation;
      try {
        validation = await validateFile(file);
      } catch (error) {
        if (get().uploadGeneration !== uploadGeneration) break;
        toast.error(uploadError(file, error));
        continue;
      }
      if (get().uploadGeneration !== uploadGeneration) break;
      if (!validation.valid) {
        toast.error(validation.error);
        continue;
      }

      // Recheck after validation, since another upload may have filled the queue.
      const currentFiles = get().files;
      if (currentFiles.some(existing => existing.originalFile.name === file.name &&
        existing.originalFile.size === file.size && existing.originalFile.lastModified === file.lastModified)) {
        toast.info(`${file.name} is already in the queue.`);
        continue;
      }
      if (currentFiles.length >= 20) {
        toast.error(`${file.name} was not added. Maximum is 20 files.`);
        continue;
      }

      const queuedFile: QueuedFile = {
        id: crypto.randomUUID(),
        originalFile: file,
        decodedBlob: null,
        thumbnailUrl: '',
        originalMetadata: null,
        status: 'loading',
        progress: 0,
        progressStep: isHeicFile(file) ? 'Opening HEIC image...' : 'Loading image...',
        outputBlob: null,
        outputFilename: null,
        stats: null,
        error: null,
      };

      queuedFiles.push(queuedFile);
      set((state) => ({
        files: [...state.files, queuedFile],
        selectedFileId: state.selectedFileId ?? queuedFile.id,
      }));
    }

    // Queue every validated file before awaiting the more expensive HEIC decoder.
    let prepareIndex = 0;
    const prepareNext = async () => {
      while (prepareIndex < queuedFiles.length) {
        const queuedFile = queuedFiles[prepareIndex++];
        if (!get().files.some(file => file.id === queuedFile.id)) continue;
        try {
          const prepared = await prepareImage(queuedFile.originalFile);
          if (!get().files.some(file => file.id === queuedFile.id)) {
            URL.revokeObjectURL(prepared.thumbnailUrl);
            continue;
          }
          get().updateFileStatus(queuedFile.id, { ...prepared, status: 'pending', progressStep: '' });
          // Optional metadata must not hold up the preview or the processing controls.
          void parseMetadata(queuedFile.originalFile).then(originalMetadata => {
            get().updateFileStatus(queuedFile.id, { originalMetadata });
          });
        } catch (error) {
          if (!get().files.some(file => file.id === queuedFile.id)) continue;
          const message = uploadError(queuedFile.originalFile, error);
          get().updateFileStatus(queuedFile.id, { status: 'error', error: message, progressStep: '' });
          toast.error(message);
        }
      }
    };
    // One slow HEIC must not prevent the other queued images from opening.
    await Promise.all(Array.from({ length: Math.min(3, queuedFiles.length) }, prepareNext));
  },

  removeFile: (id) => set((state) => {
    const file = state.files.find(f => f.id === id);
    if (file && file.thumbnailUrl) {
      URL.revokeObjectURL(file.thumbnailUrl);
    }
    if (file && file.outputBlob) {
      // we might want to revoke outputBlob URL if we created one, but we haven't
    }
    const remainingFiles = state.files.filter(f => f.id !== id);
    return {
      files: remainingFiles,
      selectedFileId: state.selectedFileId === id ? remainingFiles[0]?.id ?? null : state.selectedFileId,
    };
  }),

  clearAll: () => set((state) => {
    state.files.forEach(f => {
      if (f.thumbnailUrl) URL.revokeObjectURL(f.thumbnailUrl);
    });
    return { files: [], selectedFileId: null, uploadGeneration: state.uploadGeneration + 1 };
  }),

  updateFileStatus: (id, update) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, ...update } : f)
  })),

  updateSettings: (newSettings) => set((state) => ({
    settings: {
      ...state.settings,
      ...newSettings,
      resize: { ...state.settings.resize, ...(newSettings.resize || {}) },
      compress: { ...state.settings.compress, ...(newSettings.compress || {}) },
      metadata: { ...state.settings.metadata, ...(newSettings.metadata || {}) },
    }
  })),

  processAll: async () => {
    const { files, settings, updateFileStatus } = get();
    
    const toProcess = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (toProcess.length === 0) return;

    const concurrency = 3;
    let index = 0;

    const runWorker = async () => {
      while (index < toProcess.length) {
        const file = toProcess[index++];
        updateFileStatus(file.id, { status: 'processing', progress: 0, progressStep: 'Starting...', error: null });

        try {
          let decodedBlob = file.decodedBlob;
          // A failed HEIC import can be retried with a fresh decoder.
          if (isHeicFile(file.originalFile) && !decodedBlob) {
            updateFileStatus(file.id, { status: 'loading', progressStep: 'Opening HEIC image...' });
            try {
              const prepared = await prepareImage(file.originalFile);
              if (!get().files.some(queued => queued.id === file.id)) {
                URL.revokeObjectURL(prepared.thumbnailUrl);
                continue;
              }
              decodedBlob = prepared.decodedBlob;
              updateFileStatus(file.id, { ...prepared, status: 'processing', progressStep: 'Starting...' });
              void parseMetadata(file.originalFile).then(originalMetadata => {
                updateFileStatus(file.id, { originalMetadata });
              });
            } catch (error) {
              updateFileStatus(file.id, { status: 'error', error: uploadError(file.originalFile, error), progressStep: '' });
              continue;
            }
          }

          await new Promise<void>((resolve) => {
            const worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), { type: 'module' });
            
            worker.onmessage = (e) => {
              const data = e.data;
              if (data.type === 'progress') {
                const { step, percent } = data;
                let progressText = 'Processing...';
                if (step === 'resize') progressText = 'Resizing...';
                if (step === 'compress') progressText = 'Compressing...';
                if (step === 'metadata') progressText = 'Cleaning metadata...';
                
                let totalPercent = 0;
                if (step === 'resize') totalPercent = percent / 3;
                if (step === 'compress') totalPercent = 33 + (percent / 3);
                if (step === 'metadata') totalPercent = 66 + (percent / 3);
                
                updateFileStatus(file.id, { progress: totalPercent, progressStep: progressText });
              } else if (data.type === 'done') {
                const { outputBlob, stats, outputFilename } = data;
                updateFileStatus(file.id, { 
                  status: 'done', 
                  outputBlob, 
                  stats, 
                  outputFilename,
                  progress: 100,
                  progressStep: 'Done'
                });
                worker.terminate();
                resolve();
              } else if (data.type === 'error') {
                updateFileStatus(file.id, { status: 'error', error: data.message });
                worker.terminate();
                resolve();
              }
            };

            worker.onerror = () => {
              updateFileStatus(file.id, { status: 'error', error: 'Worker crashed' });
              worker.terminate();
              resolve();
            };

            const processingBlob = decodedBlob ?? file.originalFile;
            const processingSettings = decodedBlob && settings.compress.outputFormat === 'original'
              ? { ...settings, compress: { ...settings.compress, outputFormat: 'image/jpeg' as const } }
              : settings;

            processingBlob.arrayBuffer().then(buffer => {
              worker.postMessage({
                id: file.id,
                fileBuffer: buffer,
                fileName: file.originalFile.name,
                fileType: processingBlob.type,
                originalSize: file.originalFile.size,
                settings: processingSettings,
              }, [buffer]);
            }).catch(() => {
              updateFileStatus(file.id, { status: 'error', error: 'Could not read file' });
              worker.terminate();
              resolve();
            });
          });
        } catch {
          updateFileStatus(file.id, { status: 'error', error: 'Unexpected error' });
        }
      }
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
  },
}));
