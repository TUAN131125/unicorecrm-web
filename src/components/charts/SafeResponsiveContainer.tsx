import React, { useRef, useState, useEffect } from "react";
import { ResponsiveContainer } from "recharts";

interface SafeResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  height?: number;
  minHeight?: number;
  fallback?: React.ReactNode;
}

export const SafeResponsiveContainer: React.FC<SafeResponsiveContainerProps> = ({
  children,
  className,
  height = 280,
  minHeight = height,
  fallback,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(element);

    // Set initial dimensions right away as a fallback
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const isReady = dimensions.width > 1 && dimensions.height > 1;

  // Render a simple pulse skeleton placeholder while waiting for initial layout measurement
  const renderFallback = () => {
    if (fallback) return fallback;
    return (
      <div 
        className="w-full bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center animate-pulse"
        style={{ height }}
      >
        <span className="text-xs text-slate-400 font-medium font-mono">Measuring container...</span>
      </div>
    );
  };

  const safeWidth = Math.max(1, Math.floor(dimensions.width));
  const safeHeight = Math.max(1, Math.floor(dimensions.height));

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 overflow-hidden ${className || ""}`}
      style={{ height, minHeight }}
    >
      {isReady ? (
        <ResponsiveContainer
          width={safeWidth}
          height={safeHeight}
        >
          {children}
        </ResponsiveContainer>
      ) : (
        renderFallback()
      )}
    </div>
  );
};
