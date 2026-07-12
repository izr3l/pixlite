'use client';

import React from 'react';
import { useImageStore } from '@/store/useImageStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function ResizeSettings() {
  const { settings, updateSettings } = useImageStore();
  const { resize } = settings;

  const handlePresetChange = (value: string | null) => {
    if (!value) return;
    let update: any = { preset: value };
    if (value !== 'original' && value !== 'custom') {
      const [w, h] = value.split('x').map(Number);
      update.targetWidth = w;
      update.targetHeight = h;
    }
    updateSettings({ resize: { ...resize, ...update } });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    let update: any = { targetWidth: val, preset: 'custom' };
    
    if (resize.maintainAspectRatio && resize.targetWidth > 0 && resize.targetHeight > 0) {
      const ratio = resize.targetHeight / resize.targetWidth;
      update.targetHeight = Math.round(val * ratio);
    }
    
    updateSettings({ resize: { ...resize, ...update } });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    let update: any = { targetHeight: val, preset: 'custom' };
    
    if (resize.maintainAspectRatio && resize.targetWidth > 0 && resize.targetHeight > 0) {
      const ratio = resize.targetWidth / resize.targetHeight;
      update.targetWidth = Math.round(val * ratio);
    }
    
    updateSettings({ resize: { ...resize, ...update } });
  };

  return (
    <div className="p-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="resize-enable" className="text-[14px] font-medium text-text-primary cursor-pointer">
          Enable resizing
        </Label>
        <Switch 
          id="resize-enable" 
          checked={resize.enabled}
          onCheckedChange={(checked) => updateSettings({ resize: { ...resize, enabled: checked } })}
        />
      </div>

      <div className={cn("flex flex-col gap-5 transition-opacity duration-200", !resize.enabled && "opacity-50 pointer-events-none")}>
        <div className="flex flex-col gap-2">
          <Label className="text-[12px] text-text-muted">Preset</Label>
          <Select value={resize.preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-full h-10 border-border bg-background text-[13px]">
              <SelectValue placeholder="Select preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="1920x1080">1920 &times; 1080</SelectItem>
              <SelectItem value="1280x720">1280 &times; 720</SelectItem>
              <SelectItem value="800x600">800 &times; 600</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 flex flex-col gap-2">
            <Label className="text-[12px] text-text-muted">Width (px)</Label>
            <Input 
              type="number" 
              value={resize.targetWidth || ''}
              onChange={handleWidthChange}
              disabled={resize.preset !== 'custom'}
              className="h-10 border-border bg-background font-mono text-[13px]"
            />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <Label className="text-[12px] text-text-muted">Height (px)</Label>
            <Input 
              type="number" 
              value={resize.targetHeight || ''}
              onChange={handleHeightChange}
              disabled={resize.preset !== 'custom'}
              className="h-10 border-border bg-background font-mono text-[13px]"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-1">
          <Checkbox 
            id="maintain-ratio" 
            checked={resize.maintainAspectRatio}
            onCheckedChange={(checked) => updateSettings({ resize: { ...resize, maintainAspectRatio: !!checked } })}
          />
          <Label 
            htmlFor="maintain-ratio"
            className="text-[13px] text-text-primary leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Lock aspect ratio
          </Label>
        </div>
      </div>
    </div>
  );
}
