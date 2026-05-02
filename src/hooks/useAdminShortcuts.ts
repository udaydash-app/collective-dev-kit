import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from './useAdmin';

export const useAdminShortcuts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    // Only enable shortcuts for authenticated admin users
    if (!isAdmin) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Allow F-keys to work even when focus is on input fields (POS shortcuts)
      const isFunctionKey = e.key.startsWith('F') && e.key.length >= 2 && e.key.length <= 3;
      
      if (isInput && !e.ctrlKey && !e.metaKey && !isFunctionKey) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Global admin shortcuts
      if (ctrl && shift && e.key === 'D') {
        e.preventDefault();
        navigate('/admin/dashboard');
      } else if (ctrl && shift && e.key === 'P') {
        e.preventDefault();
        navigate('/admin/pos');
      } else if (ctrl && shift && e.key === 'O') {
        e.preventDefault();
        navigate('/admin/orders');
      } else if (ctrl && shift && e.key === 'I') {
        e.preventDefault();
        navigate('/admin/products');
      } else if (ctrl && shift && e.key === 'U') {
        e.preventDefault();
        navigate('/admin/purchases');
      } else if (ctrl && shift && e.key === 'A') {
        e.preventDefault();
        navigate('/admin/analytics');
      } else if (ctrl && shift && e.key === 'S') {
        e.preventDefault();
        navigate('/admin/settings');
      } else if (ctrl && shift && e.key === 'G') {
        e.preventDefault();
        navigate('/admin/general-ledger');
      } else if (ctrl && shift && e.key === 'R') {
        e.preventDefault();
        navigate('/admin/accounts-receivable');
      } else if (ctrl && shift && e.key === 'Y') {
        e.preventDefault();
        navigate('/admin/accounts-payable');
      } else if (ctrl && e.key === 'b') {
        e.preventDefault();
        navigate('/admin/barcode');
      } else if (alt && e.key === 'q') {
        e.preventDefault();
        navigate('/admin/quotations');
      }

      // POS-specific F-key shortcuts are handled inside src/pages/admin/POS.tsx
      // via useKeyboardShortcuts to avoid conflicts (e.g. F2 = Cash Payment).
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location, isAdmin]);
};
