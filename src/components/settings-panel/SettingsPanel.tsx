'use client';

import React from 'react';
import { useImageStore } from '@/store/useImageStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ResizeSettings from './ResizeSettings';
import CompressSettings from './CompressSettings';
import MetadataSettings from './MetadataSettings';

export default function SettingsPanel() {
  const { files, processAll } = useImageStore();

  const unprocessedFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
  const isProcessing = files.some(f => f.status === 'processing');
  
  const canProcess = unprocessedFiles.length > 0 && !isProcessing;

  const getButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (unprocessedFiles.length === 0) return 'Process files';
    if (unprocessedFiles.length === 1) return 'Process 1 file';
    return `Process ${unprocessedFiles.length} files`;
  };

  return (
    <div className="flex flex-col border border-border rounded-xl bg-surface overflow-hidden">
      <Tabs defaultValue="resize" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto">
          <TabsTrigger 
            value="resize" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 text-[13px] font-medium transition-colors"
          >
            Resize
          </TabsTrigger>
          <TabsTrigger 
            value="compress" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 text-[13px] font-medium transition-colors"
          >
            Compress
          </TabsTrigger>
          <TabsTrigger 
            value="metadata" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 text-[13px] font-medium transition-colors"
          >
            Metadata
          </TabsTrigger>
        </TabsList>
        
        <div className="p-0">
          <TabsContent value="resize" className="m-0 border-0 outline-none">
            <ResizeSettings />
          </TabsContent>
          <TabsContent value="compress" className="m-0 border-0 outline-none">
            <CompressSettings />
          </TabsContent>
          <TabsContent value="metadata" className="m-0 border-0 outline-none">
            <MetadataSettings />
          </TabsContent>
        </div>
      </Tabs>

      <div className="p-5 mt-auto border-t border-border bg-background/50">
        <Button 
          className="w-full bg-accent text-background hover:bg-accent-hover h-11 text-[14px] font-medium"
          disabled={!canProcess}
          onClick={processAll}
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {getButtonText()}
        </Button>
      </div>
    </div>
  );
}
