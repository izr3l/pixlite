'use client';

import React, { useState } from 'react';
import { useImageStore } from '@/store/useImageStore';
import { Button } from '@/components/ui/button';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Loader2 } from 'lucide-react';

export default function OutputBar() {
  const { files, clearAll } = useImageStore();
  const [isZipping, setIsZipping] = useState(false);

  if (files.length === 0) {
    return null;
  }

  const doneFiles = files.filter(f => f.status === 'done');
  const canDownloadAll = doneFiles.length >= 2;

  const handleDownloadAll = async () => {
    if (!canDownloadAll) return;
    setIsZipping(true);
    
    try {
      const zip = new JSZip();
      
      doneFiles.forEach(file => {
        if (file.outputBlob && file.outputFilename) {
          zip.file(file.outputFilename, file.outputBlob);
        }
      });
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'pixlite-optimised.zip');
    } catch (err) {
      console.error('Failed to create ZIP', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[56px] bg-surface border-t border-border px-5 flex items-center justify-between z-40">
      <div className="text-[14px] text-text-primary font-medium">
        {doneFiles.length} of {files.length} files ready
      </div>
      
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          className="bg-transparent border-border text-text-primary hover:bg-surface-raised hover:text-text-primary h-9 text-[13px]"
          onClick={clearAll}
        >
          Clear all
        </Button>
        
        <Button 
          className="bg-accent text-background hover:bg-accent-hover h-9 text-[13px] gap-2"
          disabled={!canDownloadAll || isZipping}
          onClick={handleDownloadAll}
        >
          {isZipping && <Loader2 size={14} className="animate-spin" />}
          Download all (ZIP)
        </Button>
      </div>
    </div>
  );
}
