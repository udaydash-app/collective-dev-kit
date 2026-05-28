import { createContext, useContext } from 'react';

// Holds the current desktop window id when a page is rendered inside an
// AppWindow on the Desktop, or null when rendered as a normal route.
export const DesktopWindowContext = createContext<string | null>(null);
export const useInDesktopWindow = () => useContext(DesktopWindowContext) !== null;
export const useDesktopWindowId = () => useContext(DesktopWindowContext);