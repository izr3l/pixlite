/// <reference lib="webworker" />

import { resizeImage } from '../lib/resize';
import { compressImage } from '../lib/compress';
import { stripAllMetadata, stripGPSOnly, blobToDataURL, dataURLToBlob } from '../lib/metadata';

export type WorkerInput = {
  id: string;
  fileBuffer: ArrayBuffer;
  fileName: string;
  fileType: string;
  settings: {
    resize: {
      enabled: boolean;
      targetWidth: number;
      targetHeight: number;
      maintainAspectRatio: boolean;
    };
    compress: {
      outputFormat: 'original' | 'image/jpeg' | 'image/webp';
      quality: number;
      targetSizeKB: number | null;
      useTargetSize: boolean;
    };
    metadata: {
      stripAll: boolean;
      stripGPSOnly: boolean;
    };
  };
};

export type ProcessingStats = {
  originalSize: number;
  outputSize: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  reductionPercent: number;
};

export type WorkerOutput =
  | { type: 'progress'; id: string; step: 'resize' | 'compress' | 'metadata'; percent: number }
  | { type: 'done'; id: string; outputBlob: Blob; stats: ProcessingStats; outputFilename: string }
  | { type: 'error'; id: string; message: string };

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { id, fileBuffer, fileName, fileType, settings } = e.data;
  
  try {
    const originalFile = new File([fileBuffer], fileName, { type: fileType });
    const originalSize = originalFile.size;
    
    const originalBitmap = await createImageBitmap(originalFile);
    const originalWidth = originalBitmap.width;
    const originalHeight = originalBitmap.height;
    originalBitmap.close();

    let currentBlob: Blob = originalFile;
    let finalFormat = settings.compress.outputFormat === 'original' ? fileType : settings.compress.outputFormat;

    // Resize step
    self.postMessage({ type: 'progress', id, step: 'resize', percent: 0 });
    let outputWidth = originalWidth;
    let outputHeight = originalHeight;
    
    if (settings.resize.enabled) {
      currentBlob = await resizeImage(
        currentBlob,
        finalFormat,
        settings.resize.targetWidth,
        settings.resize.targetHeight,
        settings.resize.maintainAspectRatio,
        false
      );
      
      const resizedBitmap = await createImageBitmap(currentBlob);
      outputWidth = resizedBitmap.width;
      outputHeight = resizedBitmap.height;
      resizedBitmap.close();
    }
    self.postMessage({ type: 'progress', id, step: 'resize', percent: 100 });

    // Compress step
    self.postMessage({ type: 'progress', id, step: 'compress', percent: 0 });
    currentBlob = await compressImage(
      currentBlob,
      settings.compress.outputFormat,
      settings.compress.quality,
      settings.compress.useTargetSize,
      settings.compress.targetSizeKB || 200,
      (p) => self.postMessage({ type: 'progress', id, step: 'compress', percent: p })
    );
    self.postMessage({ type: 'progress', id, step: 'compress', percent: 100 });

    // Metadata step
    self.postMessage({ type: 'progress', id, step: 'metadata', percent: 0 });
    if (finalFormat === 'image/jpeg' && (settings.metadata.stripAll || settings.metadata.stripGPSOnly)) {
      const dataUrl = await blobToDataURL(currentBlob);
      let newJpegDataUrl = dataUrl;
      
      if (settings.metadata.stripAll) {
        newJpegDataUrl = stripAllMetadata(dataUrl);
      } else if (settings.metadata.stripGPSOnly) {
        newJpegDataUrl = stripGPSOnly(dataUrl);
      }
      
      currentBlob = await dataURLToBlob(newJpegDataUrl);
    }
    self.postMessage({ type: 'progress', id, step: 'metadata', percent: 100 });

    // Calculate final stats
    const outputSize = currentBlob.size;
    const reductionPercent = Math.round(((originalSize - outputSize) / originalSize) * 100);

    const stats: ProcessingStats = {
      originalSize,
      outputSize,
      originalWidth,
      originalHeight,
      outputWidth,
      outputHeight,
      reductionPercent,
    };

    // Construct new filename
    const extMatch = fileName.match(/\.([^.]+)$/);
    const ext = extMatch ? extMatch[1] : '';
    const baseName = ext ? fileName.substring(0, fileName.length - ext.length - 1) : fileName;
    
    let outExt = ext;
    if (finalFormat === 'image/jpeg') outExt = 'jpg';
    else if (finalFormat === 'image/webp') outExt = 'webp';
    else if (finalFormat === 'image/png') outExt = 'png';
    else if (finalFormat === 'image/gif') outExt = 'gif';
    else if (finalFormat === 'image/avif') outExt = 'avif';
    
    const outputFilename = `${baseName}-optimised.${outExt}`;

    self.postMessage({ type: 'done', id, outputBlob: currentBlob, stats, outputFilename });

  } catch (err: any) {
    self.postMessage({ type: 'error', id, message: err.message || 'Worker processing failed' });
  }
};
