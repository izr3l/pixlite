'use client';

import Header from '@/components/layout/Header';
import DropZone from '@/components/drop-zone/DropZone';
import FileQueue from '@/components/file-queue/FileQueue';
import SettingsPanel from '@/components/settings-panel/SettingsPanel';
import PreviewPanel from '@/components/preview-panel/PreviewPanel';
import OutputBar from '@/components/output-bar/OutputBar';
import { Toaster } from '@/components/ui/sonner';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary pt-[56px] pb-[56px]">
      <Header />
      
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-5 flex flex-col lg:flex-row gap-5">
        {/* Left Panel */}
        <div className="w-full lg:w-[420px] flex flex-col gap-5 flex-shrink-0">
          <div className="flex flex-col gap-0 overflow-hidden">
            <DropZone />
            <FileQueue />
          </div>
          <SettingsPanel />
        </div>
        
        {/* Right Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <PreviewPanel />
        </div>
      </main>

      <OutputBar />
      <Toaster position="bottom-right" />
    </div>
  );
}
