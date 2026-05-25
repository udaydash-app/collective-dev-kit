import { createContext, useContext } from 'react';

export const DesktopWindowContext = createContext(false);
export const useInDesktopWindow = () => useContext(DesktopWindowContext);