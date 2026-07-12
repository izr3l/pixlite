'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useImageStore } from '@/store/useImageStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DropZone() {
  const { files, addFiles } = useImageStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFiles = files.length > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    // Reset input value so same files can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  if (hasFiles) {
    return (
      <div 
        className={cn(
          "w-full h-12 flex items-center justify-center border border-dashed rounded-xl cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-accent outline-none",
          isDragOver ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-text-muted hover:border-text-muted hover:text-text-primary"
        )}
        onClick={openFileDialog}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFileDialog();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Add more files"
      >
        <input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          multiple 
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          onChange={handleFileSelect} 
        />
        <span className="text-[14px] font-medium">+ Add more files</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "w-full h-[320px] flex flex-col items-center justify-center border border-dashed rounded-xl cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-accent outline-none",
        isDragOver ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-text-muted"
      )}
      onClick={openFileDialog}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFileDialog();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label="Drop images here or click to browse"
    >
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        multiple 
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        onChange={handleFileSelect} 
      />
      
      <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mb-4 text-text-primary">
        <ImagePlus size={24} />
      </div>
      
      <h2 className="text-[14px] font-medium text-text-primary mb-1">Drop images here</h2>
      <p className="text-[12px] text-text-muted mb-6">
        JPEG, PNG, WebP, AVIF, GIF &middot; Up to 20 files &middot; 20 MB each
      </p>
      
      <Button variant="outline" className="pointer-events-none bg-background text-text-primary hover:bg-surface-raised hover:text-text-primary border-border">
        Browse files
      </Button>
    </div>
  );
}
