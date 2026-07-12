'use client';

import React from 'react';
import { useImageStore } from '@/store/useImageStore';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export default function MetadataSettings() {
  const { settings, updateSettings } = useImageStore();
  const { metadata } = settings;

  let mode = 'keep-all';
  if (metadata.stripAll) mode = 'strip-all';
  else if (metadata.stripGPSOnly) mode = 'strip-gps';

  const handleModeChange = (val: string) => {
    if (val === 'keep-all') {
      updateSettings({ metadata: { stripAll: false, stripGPSOnly: false } });
    } else if (val === 'strip-gps') {
      updateSettings({ metadata: { stripAll: false, stripGPSOnly: true } });
    } else if (val === 'strip-all') {
      updateSettings({ metadata: { stripAll: true, stripGPSOnly: false } });
    }
  };

  return (
    <div className="p-5 flex flex-col gap-5">
      <RadioGroup value={mode} onValueChange={handleModeChange} className="flex flex-col gap-4">
        <div className="flex items-center space-x-3">
          <RadioGroupItem value="keep-all" id="r-keep" className="border-border text-accent focus:ring-accent" />
          <Label htmlFor="r-keep" className="text-[13px] font-medium text-text-primary cursor-pointer leading-tight">
            Keep all metadata
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <RadioGroupItem value="strip-gps" id="r-gps" className="border-border text-accent focus:ring-accent" />
          <Label htmlFor="r-gps" className="text-[13px] font-medium text-text-primary cursor-pointer leading-tight">
            Strip GPS location only
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <RadioGroupItem value="strip-all" id="r-all" className="border-border text-accent focus:ring-accent" />
          <Label htmlFor="r-all" className="text-[13px] font-medium text-text-primary cursor-pointer leading-tight">
            Strip all metadata (EXIF)
          </Label>
        </div>
      </RadioGroup>
      
      <p className="text-[11px] text-text-muted mt-2 leading-relaxed bg-surface-raised p-3 rounded-md border border-border">
        <strong>Note:</strong> Metadata stripping is fully supported for JPEG images. For PNG and WebP, EXIF data is removed automatically during the compression phase by default.
      </p>
    </div>
  );
}
