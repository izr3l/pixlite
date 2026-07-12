'use client';

import React from 'react';
import { useImageStore } from '@/store/useImageStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

export default function CompressSettings() {
  const { settings, updateSettings } = useImageStore();
  const { compress } = settings;

  const handleFormatChange = (value: string | null) => {
    if (value) {
      updateSettings({ compress: { ...compress, outputFormat: value as any } });
    }
  };

  const handleQualityChange = (val: number | readonly number[]) => {
    const quality = Array.isArray(val) ? val[0] : val;
    updateSettings({ compress: { ...compress, quality } });
  };

  return (
    <div className="p-5 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-text-muted">Output Format</Label>
        <Select value={compress.outputFormat} onValueChange={handleFormatChange}>
          <SelectTrigger className="w-full h-10 border-border bg-background text-[13px]">
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">Original (No change)</SelectItem>
            <SelectItem value="image/jpeg">JPEG</SelectItem>
            <SelectItem value="image/png">PNG</SelectItem>
            <SelectItem value="image/webp">WebP</SelectItem>
            <SelectItem value="image/avif">AVIF</SelectItem>
            <SelectItem value="image/gif">GIF</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-5 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <Label htmlFor="target-size-enable" className="text-[13px] font-medium text-text-primary cursor-pointer">
            Target file size
          </Label>
          <Switch 
            id="target-size-enable" 
            checked={compress.useTargetSize}
            onCheckedChange={(checked) => updateSettings({ compress: { ...compress, useTargetSize: checked } })}
          />
        </div>

        {compress.useTargetSize ? (
          <div className="flex flex-col gap-2">
            <Label className="text-[12px] text-text-muted">Max size (KB)</Label>
            <div className="relative">
              <Input 
                type="number" 
                value={compress.targetSizeKB || ''}
                onChange={(e) => updateSettings({ compress: { ...compress, targetSizeKB: parseInt(e.target.value) || 0 } })}
                className="h-10 border-border bg-background font-mono text-[13px] pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-muted font-mono pointer-events-none">
                KB
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              Quality will be adjusted automatically to reach this target using binary search.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <Label className="text-[12px] text-text-muted">Quality</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={compress.quality || ''}
                  onChange={(e) => updateSettings({ compress: { ...compress, quality: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)) } })}
                  className="h-8 w-16 px-2 border-border bg-background font-mono text-[13px] text-center"
                />
                <span className="text-[12px] text-text-muted font-mono">%</span>
              </div>
            </div>
            <Slider 
              value={[compress.quality]} 
              min={1} 
              max={100} 
              step={1}
              onValueChange={handleQualityChange}
              className="[&>span:first-child]:bg-surface-raised [&_[role=slider]]:bg-accent [&_[role=slider]]:border-accent"
            />
          </div>
        )}
      </div>
    </div>
  );
}
