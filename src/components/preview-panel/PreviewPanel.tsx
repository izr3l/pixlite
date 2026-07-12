'use client';

import React, { useEffect, useState } from 'react';
import { useImageStore } from '@/store/useImageStore';
import ComparisonSlider from './ComparisonSlider';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';
import { saveAs } from 'file-saver';

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function PreviewPanel() {
  const { files, selectedFileId, settings } = useImageStore();
  const file = files.find(f => f.id === selectedFileId);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [optimisedUrl, setOptimisedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const oUrl = URL.createObjectURL(file.originalFile);
      setOriginalUrl(oUrl);
      
      let optUrl: string | null = null;
      if (file.outputBlob) {
        optUrl = URL.createObjectURL(file.outputBlob);
        setOptimisedUrl(optUrl);
      } else {
        setOptimisedUrl(null);
      }

      return () => {
        URL.revokeObjectURL(oUrl);
        if (optUrl) URL.revokeObjectURL(optUrl);
      };
    } else {
      setOriginalUrl(null);
      setOptimisedUrl(null);
    }
  }, [file]);

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border border-border rounded-xl bg-surface h-full min-h-[300px]">
        <div className="w-16 h-16 rounded-full bg-surface-raised flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="text-text-primary text-[15px] font-medium mb-1">No file selected</div>
        <div className="text-text-muted text-[13px]">Select a file from the queue to preview it</div>
      </div>
    );
  }

  const isProcessing = file.status === 'processing';
  const isDone = file.status === 'done';
  const isError = file.status === 'error';

  return (
    <div className="flex-1 flex flex-col border border-border rounded-xl bg-surface overflow-hidden min-h-[500px]">
      {/* Top Bar */}
      <div className="h-[52px] border-b border-border flex items-center justify-between px-5 bg-background/50">
        <div className="text-[14px] font-medium text-text-primary truncate pr-4">
          {file.originalFile.name}
        </div>
        
        {isDone && (
          <Button 
            size="sm" 
            className="bg-accent text-background hover:bg-accent-hover h-8 text-[12px] gap-2 flex-shrink-0"
            onClick={() => {
              if (file.outputBlob && file.outputFilename) {
                saveAs(file.outputBlob, file.outputFilename);
              }
            }}
          >
            <Download size={14} />
            Download
          </Button>
        )}
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 relative bg-[url('/checkerboard.png')] bg-repeat" style={{ backgroundImage: 'linear-gradient(45deg, #1e1e1e 25%, transparent 25%), linear-gradient(-45deg, #1e1e1e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e1e1e 75%), linear-gradient(-45deg, transparent 75%, #1e1e1e 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}>
        
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4 text-error">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-text-primary text-[15px] font-medium mb-1">Processing Failed</div>
            <div className="text-text-muted text-[13px] text-center max-w-md">{file.error}</div>
          </div>
        )}

        {(isProcessing || file.status === 'pending') && originalUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src={originalUrl} 
              alt="Original preview" 
              className={`max-w-full max-h-full object-contain ${isProcessing ? 'blur-sm opacity-50' : ''}`}
            />
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/20 backdrop-blur-sm z-10">
                <div className="bg-surface border border-border rounded-lg p-5 flex flex-col items-center shadow-lg min-w-[200px]">
                  <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                  <div className="text-[14px] font-medium text-text-primary mb-1">{file.progressStep || 'Processing...'}</div>
                  <div className="text-[12px] text-text-muted">{Math.round(file.progress)}%</div>
                </div>
              </div>
            )}
          </div>
        )}

        {isDone && originalUrl && optimisedUrl && (
          <ComparisonSlider originalImageSrc={originalUrl} optimisedImageSrc={optimisedUrl} />
        )}
      </div>

      {/* Bottom Stats Area */}
      <div className="border-t border-border bg-background p-5 grid grid-cols-2 gap-4 divide-x divide-border">
        {/* Original Stats */}
        <div className="flex flex-col gap-1 pr-4">
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Original</div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-muted">Size</span>
            <span className="text-[14px] font-medium font-mono text-text-primary">
              {formatBytes(file.originalFile.size)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-muted">Format</span>
            <span className="text-[13px] font-medium text-text-primary uppercase">
              {file.originalFile.type.split('/')[1] || 'Unknown'}
            </span>
          </div>
          {file.stats && (
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-text-muted">Dimensions</span>
              <span className="text-[13px] font-medium font-mono text-text-primary">
                {file.stats.originalWidth} &times; {file.stats.originalHeight}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-muted">Metadata</span>
            <span className="text-[13px] font-medium text-text-primary">
              {file.originalMetadata && Object.keys(file.originalMetadata).length > 0 
                ? `${Object.keys(file.originalMetadata).length} tags` 
                : 'None'}
            </span>
          </div>
        </div>

        {/* Optimised Stats */}
        <div className="flex flex-col gap-1 pl-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Optimised</div>
            {isDone && file.stats && file.stats.reductionPercent > 0 && (
              <div className="bg-success/10 text-success text-[11px] px-2 py-0.5 rounded font-medium">
                Saved {file.stats.reductionPercent}%
              </div>
            )}
            {isDone && file.stats && file.stats.reductionPercent <= 0 && (
              <div className="bg-warning/10 text-warning text-[11px] px-2 py-0.5 rounded font-medium">
                {Math.abs(file.stats.reductionPercent)}% larger
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-muted">Size</span>
            <span className="text-[14px] font-medium font-mono text-text-primary">
              {isDone && file.stats ? formatBytes(file.stats.outputSize) : '-'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-muted">Format</span>
            <span className="text-[13px] font-medium text-text-primary uppercase">
              {isDone && file.outputBlob ? file.outputBlob.type.split('/')[1] || 'Unknown' : '-'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-muted">Dimensions</span>
            <span className="text-[13px] font-medium font-mono text-text-primary">
              {isDone && file.stats ? `${file.stats.outputWidth} \u00D7 ${file.stats.outputHeight}` : '-'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-text-muted">Metadata</span>
            <span className="text-[13px] font-medium text-text-primary">
              {!isDone ? '-' : 
                (file.outputBlob && !file.outputBlob.type.includes('jpeg')) ? 'None' :
                settings.metadata.stripAll ? 'None' : 
                settings.metadata.stripGPSOnly ? 'GPS Removed' : 
                (file.originalMetadata && Object.keys(file.originalMetadata).length > 0 ? `${Object.keys(file.originalMetadata).length} tags` : 'None')
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
