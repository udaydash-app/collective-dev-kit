import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  fixedScroll?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, fixedScroll = false, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scrollInfo, setScrollInfo] = React.useState({ scrollWidth: 0, clientWidth: 0, scrollLeft: 0 });
    const [mounted, setMounted] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
      return () => setMounted(false);
    }, []);

    const updateScrollInfo = React.useCallback(() => {
      if (containerRef.current) {
        const table = containerRef.current.querySelector('table');
        const sw = table ? table.scrollWidth : containerRef.current.scrollWidth;
        const cw = containerRef.current.clientWidth;
        
        setScrollInfo(prev => ({
          scrollWidth: sw,
          clientWidth: cw,
          scrollLeft: prev.scrollLeft,
        }));
      }
    }, []);

    React.useEffect(() => {
      if (!fixedScroll) return;
      
      updateScrollInfo();
      const timers = [
        setTimeout(updateScrollInfo, 100),
        setTimeout(updateScrollInfo, 300),
        setTimeout(updateScrollInfo, 600),
      ];
      
      const resizeObserver = new ResizeObserver(updateScrollInfo);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
        const table = containerRef.current.querySelector('table');
        if (table) resizeObserver.observe(table);
      }

      window.addEventListener('resize', updateScrollInfo);
      
      return () => {
        timers.forEach(clearTimeout);
        resizeObserver.disconnect();
        window.removeEventListener('resize', updateScrollInfo);
      };
    }, [fixedScroll, updateScrollInfo]);

    const handleScroll = () => {
      if (containerRef.current) {
        setScrollInfo(prev => ({
          ...prev,
          scrollLeft: containerRef.current?.scrollLeft || 0,
        }));
      }
    };

    const scrollTo = (scrollLeft: number) => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = scrollLeft;
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

    const showScrollbar = fixedScroll && scrollInfo.scrollWidth > scrollInfo.clientWidth + 10;
    const thumbWidthPercent = scrollInfo.scrollWidth > 0 
      ? Math.max(10, (scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100)
      : 100;
    const maxScroll = scrollInfo.scrollWidth - scrollInfo.clientWidth;
    const thumbLeftPercent = maxScroll > 0
      ? (scrollInfo.scrollLeft / maxScroll) * (100 - thumbWidthPercent)
      : 0;

    return (
      <>
        <div 
          ref={containerRef}
          onScroll={fixedScroll ? handleScroll : undefined}
          className={cn(
            "relative w-full",
            fixedScroll ? "overflow-x-auto" : "overflow-auto"
          )}
          style={fixedScroll ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : undefined}
        >
          {fixedScroll && (
            <style>{`
              div[data-fixed-scroll]::-webkit-scrollbar {
                display: none !important;
              }
            `}</style>
          )}
          <table 
            ref={ref} 
            className={cn("w-full caption-bottom text-sm", className)} 
            {...props} 
          />
        </div>
        
        {mounted && showScrollbar && createPortal(
          <div
            onClick={handleScrollbarClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
              position: 'fixed',
              bottom: '72px', 
              left: '4px',
              right: '4px',
              height: '12px',
              zIndex: 99999,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: isHovered ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.05)',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                onMouseDown={handleThumbMouseDown}
                style={{ 
                  height: '100%',
                  width: `${thumbWidthPercent}%`,
                  marginLeft: `${thumbLeftPercent}%`,
                  backgroundColor: isHovered ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
                  borderRadius: '4px',
                  cursor: 'grab',
                  transition: 'background-color 0.2s, margin-left 0.05s ease-out',
                }}
              />
            </div>
          </div>,
          document.body
        )}
      </>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
