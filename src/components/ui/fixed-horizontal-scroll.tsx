import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface FixedHorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

export function FixedHorizontalScroll({ children, className = "" }: FixedHorizontalScrollProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({ scrollWidth: 0, clientWidth: 0, scrollLeft: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const updateScrollInfo = useCallback(() => {
    if (contentRef.current) {
      setScrollInfo({
        scrollWidth: contentRef.current.scrollWidth,
        clientWidth: contentRef.current.clientWidth,
        scrollLeft: contentRef.current.scrollLeft,
      });
    }
  }, []);

  useEffect(() => {
    updateScrollInfo();
    
    const timer = setTimeout(updateScrollInfo, 200);
    const timer2 = setTimeout(updateScrollInfo, 500);
    
    const resizeObserver = new ResizeObserver(updateScrollInfo);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateScrollInfo);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollInfo);
    };
  }, [updateScrollInfo, children]);

  const handleContentScroll = () => {
    if (contentRef.current) {
      setScrollInfo(prev => ({
        ...prev,
        scrollLeft: contentRef.current?.scrollLeft || 0,
      }));
    }
  };

  const handleScrollbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!contentRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const maxScroll = scrollInfo.scrollWidth - scrollInfo.clientWidth;
    contentRef.current.scrollLeft = clickPercent * maxScroll;
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startScrollLeft = contentRef.current?.scrollLeft || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!contentRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const trackWidth = window.innerWidth - 32; // Account for mx-4
      const maxScroll = scrollInfo.scrollWidth - scrollInfo.clientWidth;
      const scrollDelta = (deltaX / trackWidth) * maxScroll;
      contentRef.current.scrollLeft = startScrollLeft + scrollDelta;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const showScrollbar = scrollInfo.scrollWidth > scrollInfo.clientWidth;
  const thumbWidthPercent = scrollInfo.scrollWidth > 0 
    ? (scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100 
    : 100;
  const thumbLeftPercent = scrollInfo.scrollWidth > scrollInfo.clientWidth
    ? (scrollInfo.scrollLeft / (scrollInfo.scrollWidth - scrollInfo.clientWidth)) * (100 - thumbWidthPercent)
    : 0;

  return (
    <>
      <div className={className}>
        <div
          ref={contentRef}
          onScroll={handleContentScroll}
          className="overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`.overflow-x-auto::-webkit-scrollbar { display: none; }`}</style>
          {children}
        </div>
      </div>
      
      {mounted && showScrollbar && createPortal(
        <div
          onClick={handleScrollbarClick}
          className="fixed left-4 right-4 h-3 rounded-full cursor-pointer"
          style={{ 
            bottom: '72px', 
            zIndex: 99999,
            backgroundColor: 'hsl(var(--muted))',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
          }}
        >
          <div
            onMouseDown={handleThumbMouseDown}
            className="h-full rounded-full cursor-grab active:cursor-grabbing"
            style={{ 
              width: `${thumbWidthPercent}%`,
              marginLeft: `${thumbLeftPercent}%`,
              backgroundColor: 'hsl(var(--primary))',
              opacity: 0.7,
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}
