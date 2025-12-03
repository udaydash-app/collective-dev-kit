import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface FixedHorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

export function FixedHorizontalScroll({ children, className = "" }: FixedHorizontalScrollProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const scrollThumbRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (contentRef.current) {
        const sw = contentRef.current.scrollWidth;
        const cw = contentRef.current.clientWidth;
        setScrollWidth(sw);
        setClientWidth(cw);
        setShowScrollbar(sw > cw);
      }
    };

    updateDimensions();
    
    // Small delay to ensure content is rendered
    const timeoutId = setTimeout(updateDimensions, 100);
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [children]);

  // Sync scroll positions
  const handleContentScroll = () => {
    if (contentRef.current && scrollThumbRef.current && scrollbarRef.current) {
      const scrollPercent = contentRef.current.scrollLeft / (scrollWidth - clientWidth);
      const thumbWidth = (clientWidth / scrollWidth) * scrollbarRef.current.clientWidth;
      const maxThumbLeft = scrollbarRef.current.clientWidth - thumbWidth;
      scrollThumbRef.current.style.transform = `translateX(${scrollPercent * maxThumbLeft}px)`;
    }
  };

  const handleScrollbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scrollbarRef.current && contentRef.current && scrollThumbRef.current) {
      const rect = scrollbarRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const thumbWidth = (clientWidth / scrollWidth) * rect.width;
      const scrollableTrack = rect.width - thumbWidth;
      const clickPercent = Math.max(0, Math.min(1, (clickX - thumbWidth / 2) / scrollableTrack));
      contentRef.current.scrollLeft = clickPercent * (scrollWidth - clientWidth);
    }
  };

  // Handle thumb dragging
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startScrollLeft = contentRef.current?.scrollLeft || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!contentRef.current || !scrollbarRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const trackWidth = scrollbarRef.current.clientWidth;
      const thumbWidth = (clientWidth / scrollWidth) * trackWidth;
      const scrollableTrack = trackWidth - thumbWidth;
      const scrollDelta = (deltaX / scrollableTrack) * (scrollWidth - clientWidth);
      contentRef.current.scrollLeft = startScrollLeft + scrollDelta;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const thumbWidth = scrollWidth > 0 ? (clientWidth / scrollWidth) * 100 : 0;

  const scrollbarElement = showScrollbar && mounted ? createPortal(
    <div
      ref={scrollbarRef}
      onClick={handleScrollbarClick}
      className="fixed left-4 right-4 h-3 bg-muted/90 backdrop-blur-sm cursor-pointer rounded-full shadow-lg border border-border/50"
      style={{ bottom: '70px', zIndex: 9999 }}
    >
      <div
        ref={scrollThumbRef}
        onMouseDown={handleThumbMouseDown}
        className="h-full bg-primary/60 hover:bg-primary/80 rounded-full cursor-grab active:cursor-grabbing transition-colors"
        style={{ width: `${thumbWidth}%` }}
      />
    </div>,
    document.body
  ) : null;

  return (
    <div className={className}>
      <div
        ref={contentRef}
        onScroll={handleContentScroll}
        className="overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
      {scrollbarElement}
    </div>
  );
}
