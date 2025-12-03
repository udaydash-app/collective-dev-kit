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
      // Get the actual table element inside
      const table = contentRef.current.querySelector('table');
      const scrollContainer = contentRef.current;
      
      const sw = table ? table.scrollWidth : scrollContainer.scrollWidth;
      const cw = scrollContainer.clientWidth;
      
      setScrollInfo(prev => ({
        scrollWidth: sw,
        clientWidth: cw,
        scrollLeft: prev.scrollLeft,
      }));
    }
  }, []);

  useEffect(() => {
    updateScrollInfo();
    
    const timer = setTimeout(updateScrollInfo, 100);
    const timer2 = setTimeout(updateScrollInfo, 300);
    const timer3 = setTimeout(updateScrollInfo, 600);
    
    const resizeObserver = new ResizeObserver(updateScrollInfo);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
      // Also observe the table if it exists
      const table = contentRef.current.querySelector('table');
      if (table) {
        resizeObserver.observe(table);
      }
    }

    window.addEventListener('resize', updateScrollInfo);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      clearTimeout(timer3);
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

  const scrollTo = (scrollLeft: number) => {
    if (contentRef.current) {
      contentRef.current.scrollLeft = scrollLeft;
      setScrollInfo(prev => ({ ...prev, scrollLeft }));
    }
  };

  const handleScrollbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const maxScroll = scrollInfo.scrollWidth - scrollInfo.clientWidth;
    scrollTo(clickPercent * maxScroll);
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startScrollLeft = scrollInfo.scrollLeft;
    const maxScroll = scrollInfo.scrollWidth - scrollInfo.clientWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const trackWidth = window.innerWidth - 32;
      const thumbWidth = (scrollInfo.clientWidth / scrollInfo.scrollWidth) * trackWidth;
      const scrollableTrack = trackWidth - thumbWidth;
      const scrollDelta = (deltaX / scrollableTrack) * maxScroll;
      scrollTo(Math.max(0, Math.min(maxScroll, startScrollLeft + scrollDelta)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const showScrollbar = scrollInfo.scrollWidth > scrollInfo.clientWidth + 10; // 10px threshold
  const thumbWidthPercent = scrollInfo.scrollWidth > 0 
    ? Math.max(10, (scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100)
    : 100;
  const maxScroll = scrollInfo.scrollWidth - scrollInfo.clientWidth;
  const thumbLeftPercent = maxScroll > 0
    ? (scrollInfo.scrollLeft / maxScroll) * (100 - thumbWidthPercent)
    : 0;

  return (
    <>
      <div className={className}>
        <div
          ref={contentRef}
          onScroll={handleContentScroll}
          className="overflow-x-auto"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
          }}
        >
          {children}
        </div>
      </div>
      
      {mounted && showScrollbar && createPortal(
        <div
          id="fixed-horizontal-scrollbar"
          onClick={handleScrollbarClick}
          style={{ 
            position: 'fixed',
            bottom: '72px', 
            left: '16px',
            right: '16px',
            height: '14px',
            zIndex: 99999,
            backgroundColor: '#d1d5db',
            borderRadius: '7px',
            cursor: 'pointer',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
          }}
        >
          <div
            onMouseDown={handleThumbMouseDown}
            style={{ 
              height: '100%',
              width: `${thumbWidthPercent}%`,
              marginLeft: `${thumbLeftPercent}%`,
              backgroundColor: '#22c55e',
              borderRadius: '7px',
              cursor: 'grab',
              transition: 'margin-left 0.05s ease-out',
            }}
          />
        </div>,
        document.body
      )}
      
      <style>{`
        .overflow-x-auto::-webkit-scrollbar {
          display: none !important;
          height: 0 !important;
          width: 0 !important;
        }
      `}</style>
    </>
  );
}
