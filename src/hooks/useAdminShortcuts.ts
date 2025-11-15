import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const useAdminShortcuts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isInput && !e.ctrlKey && !e.metaKey) {
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

      // POS specific shortcuts (F keys)
      if (location.pathname === '/admin/pos') {
        switch(e.key) {
          case 'F1':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('pos-cash-in'));
            break;
          case 'F2':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('pos-cash-out'));
            break;
          case 'F3':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('pos-hold-ticket'));
            break;
          case 'F4':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('pos-recall-ticket'));
            break;
          case 'F9':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('pos-process-payment'));
            break;
          case 'F12':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('pos-clear-cart'));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location]);
};
