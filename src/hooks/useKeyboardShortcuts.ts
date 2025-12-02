import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './useAdmin';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields (except for specific combinations)
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    // Allow F-keys to work even in input fields (for POS shortcuts)
    const isFunctionKey = event.key.startsWith('F') && event.key.length >= 2 && event.key.length <= 3;
    
    for (const shortcut of shortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
      const shiftMatches = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
      const altMatches = shortcut.altKey === undefined || event.altKey === shortcut.altKey;
      const metaMatches = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;

      if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
        // Allow Ctrl/Cmd shortcuts and F-keys even in inputs
        if (isInput && !(event.ctrlKey || event.metaKey || isFunctionKey)) {
          continue;
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        break;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

// Global shortcuts available everywhere
export const useGlobalShortcuts = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  // Only enable shortcuts for authenticated admin users
  if (!isAdmin) {
    return;
  }

  const shortcuts: KeyboardShortcut[] = [
    // Customer navigation
    {
      key: 'k',
      ctrlKey: true,
      description: 'Open search',
      action: () => navigate('/search'),
    },
    {
      key: 'k',
      metaKey: true,
      description: 'Open search (Mac)',
      action: () => navigate('/search'),
    },
    {
      key: 'h',
      ctrlKey: true,
      description: 'Go to home',
      action: () => navigate('/'),
    },
    {
      key: 'h',
      metaKey: true,
      description: 'Go to home (Mac)',
      action: () => navigate('/'),
    },
    {
      key: 'c',
      ctrlKey: true,
      shiftKey: true,
      description: 'Go to cart',
      action: () => navigate('/cart'),
    },
    {
      key: 'c',
      metaKey: true,
      shiftKey: true,
      description: 'Go to cart (Mac)',
      action: () => navigate('/cart'),
    },
    {
      key: 'o',
      ctrlKey: true,
      description: 'Go to orders',
      action: () => navigate('/orders'),
    },
    {
      key: 'o',
      metaKey: true,
      description: 'Go to orders (Mac)',
      action: () => navigate('/orders'),
    },
    {
      key: 'p',
      ctrlKey: true,
      description: 'Go to profile',
      action: () => navigate('/profile'),
    },
    {
      key: 'p',
      metaKey: true,
      description: 'Go to profile (Mac)',
      action: () => navigate('/profile'),
    },
    {
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts',
      action: () => {
        const event = new CustomEvent('show-shortcuts');
        window.dispatchEvent(event);
      },
    },
    // Arrow key navigation
    {
      key: 'ArrowUp',
      description: 'Navigate up in lists',
      action: () => {
        const focusable = document.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
        const currentIndex = Array.from(focusable).indexOf(document.activeElement as HTMLElement);
        if (currentIndex > 0) {
          focusable[currentIndex - 1].focus();
        }
      },
      preventDefault: false,
    },
    {
      key: 'ArrowDown',
      description: 'Navigate down in lists',
      action: () => {
        const focusable = document.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
        const currentIndex = Array.from(focusable).indexOf(document.activeElement as HTMLElement);
        if (currentIndex < focusable.length - 1 && currentIndex >= 0) {
          focusable[currentIndex + 1].focus();
        }
      },
      preventDefault: false,
    },
  ];

  useKeyboardShortcuts({ shortcuts });
};
