import React from 'react';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import { QueuedFile } from '@/store/useImageStore';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

interface FileQueueItemProps {
  file: QueuedFile;
  onRemove: (id: string) => void;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function FileQueueItem({ file, onRemove, isSelected, onClick }: FileQueueItemProps) {
  const isProcessing = file.status === 'processing';
  const isDone = file.status === 'done';
  const isError = file.status === 'error';
  const isPending = file.status === 'pending';

  const truncateFilename = (name: string) => {
    return name.length > 24 ? name.substring(0, 21) + '...' : name;
  };

  return (
    <div 
      className={cn(
        "relative flex items-center p-3 gap-4 border-b border-border transition-colors group cursor-pointer",
        isSelected ? "bg-surface/80" : "bg-background hover:bg-surface/50"
      )}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-md overflow-hidden bg-surface-raised flex-shrink-0 flex items-center justify-center">
        {file.thumbnailUrl ? (
          <img src={file.thumbnailUrl} alt={file.originalFile.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="text-text-muted" size={20} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[14px] font-medium text-text-primary truncate" title={file.originalFile.name}>
            {truncateFilename(file.originalFile.name)}
          </span>
          <span className="text-[13px] text-text-muted font-mono">
            {formatBytes(file.originalFile.size)}
          </span>
        </div>

        <div className="flex items-center justify-between mt-1">
          {/* Status Badge */}
          <div className="flex items-center h-5">
            {isPending && (
              <Badge variant="secondary" className="bg-surface-raised text-text-muted hover:bg-surface-raised text-[11px] font-medium uppercase tracking-wider h-5 px-2">
                Pending
              </Badge>
            )}
            
            {isProcessing && (
              <div className="flex items-center gap-2 text-[12px] text-accent">
                <Loader2 size={14} className="animate-spin" />
                <span>{file.progressStep || 'Processing...'}</span>
              </div>
            )}
            
            {isDone && (
              <div className="flex items-center gap-2">
                <Badge className="bg-success/10 text-success hover:bg-success/10 text-[11px] font-medium uppercase tracking-wider border-0 h-5 px-2">
                  Done
                </Badge>
                {file.stats && file.stats.reductionPercent > 0 && (
                  <span className="text-[13px] font-mono text-success">
                    ↓ {file.stats.reductionPercent}%
                  </span>
                )}
                {file.stats && file.stats.reductionPercent <= 0 && (
                  <span className="text-[13px] font-mono text-warning">
                    ↑ {Math.abs(file.stats.reductionPercent)}% larger
                  </span>
                )}
              </div>
            )}
            
            {isError && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="destructive" className="bg-error/10 text-error hover:bg-error/10 text-[11px] font-medium uppercase tracking-wider border-0 h-5 px-2 cursor-help">
                    Failed
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{file.error || 'Could not process file'}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <Progress value={file.progress} className="h-1.5 mt-2 bg-surface-raised [&>div]:bg-accent" />
        )}
      </div>

      {/* Remove Button */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 h-8 w-8 text-text-muted hover:text-error hover:bg-error/10 focus:opacity-100"
        onClick={(e) => { e.stopPropagation(); onRemove(file.id); }}
        disabled={isProcessing}
        aria-label={`Remove ${file.originalFile.name} from queue`}
      >
        <X size={16} />
      </Button>
    </div>
  );
}
