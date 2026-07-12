'use client';

import React from 'react';
import { useImageStore } from '@/store/useImageStore';
import FileQueueItem from './FileQueueItem';

export default function FileQueue() {
  const { files, removeFile, selectedFileId, setSelectedFile } = useImageStore();

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col w-full rounded-xl overflow-hidden bg-background">
      <div className="overflow-y-auto max-h-[320px] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-surface-raised [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        {files.map((file) => (
          <FileQueueItem 
            key={file.id} 
            file={file} 
            onRemove={removeFile} 
            isSelected={file.id === selectedFileId}
            onClick={() => setSelectedFile(file.id)}
          />
        ))}
      </div>
    </div>
  );
}
