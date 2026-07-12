import React from 'react';
import { Shield } from 'lucide-react';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-[56px] bg-background shadow-sm z-50 px-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Logo Mark: Two overlapping squares */}
        <div className="relative w-6 h-6 flex items-center justify-center">
          <div className="absolute top-0 left-0 w-4 h-4 border-2 border-accent rounded-sm opacity-80" />
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-accent rounded-sm" />
        </div>
        {/* Wordmark */}
        <span className="font-display font-bold text-[20px] text-text-primary tracking-tight">
          Pixlite
        </span>
      </div>

      <div className="flex items-center gap-2 text-text-muted text-[12px] font-medium">
        <Shield size={14} />
        <span>Privacy: your images never leave this page</span>
      </div>
    </header>
  );
}
