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
      const info = {
        scrollWidth: contentRef.current.scrollWidth,
        clientWidth: contentRef.current.clientWidth,
        scrollLeft: contentRef.current.scrollLeft,
      };
      console.log('📏 Scroll info:', info, 'overflow:', info.scrollWidth > info.clientWidth);
      setScrollInfo(info);
    }
  }, []);

  useEffect(() => {
    updateScrollInfo();
    
    const timer = setTimeout(updateScrollInfo, 200);
    const timer2 = setTimeout(updateScrollInfo, 500);
    const timer3 = setTimeout(updateScrollInfo, 1000);
    
    const resizeObserver = new ResizeObserver(updateScrollInfo);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
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
      const trackWidth = window.innerWidth - 32;
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

  console.log('🎯 Fixed scrollbar render:', { mounted, showScrollbar, thumbWidthPercent });

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
            WebkitOverflowScrolling: 'touch',
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
            height: '12px',
            zIndex: 99999,
            backgroundColor: '#e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.15)',
          }}
        >
          <div
            onMouseDown={handleThumbMouseDown}
            style={{ 
              height: '100%',
              width: `${thumbWidthPercent}%`,
              marginLeft: `${thumbLeftPercent}%`,
              backgroundColor: '#22c55e',
              borderRadius: '6px',
              cursor: 'grab',
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
