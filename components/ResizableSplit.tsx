import React, { useState, useRef, useEffect } from 'react';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  gap?: number; // px
}

export default function ResizableSplit({
  left,
  right,
  defaultLeftPercent = 66.67,
  minLeftPercent = 20,
  maxLeftPercent = 82,
  gap = 8,
}: ResizableSplitProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [isLg, setIsLg] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsLg(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleWidthPx = gap + 8;

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startLeft = leftPercent;
    const rect = containerRef.current!.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      const deltaPct = ((ev.clientX - startX) / rect.width) * 100;
      setLeftPercent(
        Math.min(maxLeftPercent, Math.max(minLeftPercent, startLeft + deltaPct))
      );
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={containerRef}
      className={`flex ${isLg ? 'flex-row' : 'flex-col gap-6'}`}
    >
      {/* Left panel */}
      <div
        className="flex flex-col"
        style={isLg ? { width: `calc(${leftPercent}% - ${handleWidthPx / 2}px)` } : undefined}
      >
        {left}
      </div>

      {/* Drag handle — desktop only */}
      {isLg && (
        <div
          className="flex items-center justify-center shrink-0 cursor-col-resize group select-none"
          style={{ width: `${handleWidthPx}px` }}
          onMouseDown={onMouseDown}
        >
          <div className="w-1 self-stretch rounded-full bg-slate-200 group-hover:bg-blue-400 transition-colors duration-150" />
        </div>
      )}

      {/* Right panel */}
      <div
        className="flex flex-col"
        style={isLg ? { width: `calc(${100 - leftPercent}% - ${handleWidthPx / 2}px)` } : undefined}
      >
        {right}
      </div>
    </div>
  );
}
