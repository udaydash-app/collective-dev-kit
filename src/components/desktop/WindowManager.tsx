import { useEffect, useRef, useState } from 'react';
import { useWindowStore } from '@/store/windowStore';
import { AppWindow } from './AppWindow';

export function WindowManager() {
  const { windows, topZ } = useWindowStore();
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 1200, height: 700 });

  useEffect(() => {
    const update = () => {
      if (ref.current) {
        setBounds({
          width: ref.current.clientWidth,
          height: ref.current.clientHeight,
        });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {windows.map((w) => (
        <AppWindow key={w.id} win={w} desktopBounds={bounds} topZ={topZ} />
      ))}
    </div>
  );
}