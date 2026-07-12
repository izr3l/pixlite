'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ComparisonSliderProps {
  originalImageSrc: string;
  optimisedImageSrc: string;
}

export default function ComparisonSlider({ originalImageSrc, optimisedImageSrc }: ComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPosition(percent);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      className="relative w-full h-full overflow-hidden select-none bg-[url('/checkerboard.png')] bg-repeat"
      style={{ backgroundImage: 'linear-gradient(45deg, #1e1e1e 25%, transparent 25%), linear-gradient(-45deg, #1e1e1e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e1e1e 75%), linear-gradient(-45deg, transparent 75%, #1e1e1e 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}
      ref={containerRef}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* Optimised Image (Background) */}
      <img 
        src={optimisedImageSrc} 
        alt="Optimised" 
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
      
      {/* Original Image (Foreground/Clipped) */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img 
          src={originalImageSrc} 
          alt="Original" 
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize hover:bg-accent hover:w-[4px] transition-all duration-150 transform -translate-x-1/2"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center border border-border">
          <div className="w-4 h-4 text-background">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18-6-6 6-6"/><path d="m15 18 6-6-6-6"/></svg>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 bg-black/60 text-white text-[11px] font-medium px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
        Original
      </div>
      <div className="absolute top-4 right-4 bg-black/60 text-white text-[11px] font-medium px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
        Optimised
      </div>
    </div>
  );
}
