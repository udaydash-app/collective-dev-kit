import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Customer Navigation
  { keys: ['Ctrl', 'K'], description: 'Open search', category: 'Customer Navigation' },
  { keys: ['Ctrl', 'H'], description: 'Go to home', category: 'Customer Navigation' },
  { keys: ['Ctrl', 'Shift', 'C'], description: 'Go to cart', category: 'Customer Navigation' },
  { keys: ['Ctrl', 'O'], description: 'Go to orders', category: 'Customer Navigation' },
  { keys: ['Ctrl', 'P'], description: 'Go to profile', category: 'Customer Navigation' },
  
  // Admin Navigation
  { keys: ['Ctrl', 'Shift', 'D'], description: 'Admin Dashboard', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'P'], description: 'Point of Sale', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'O'], description: 'Admin Orders', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'I'], description: 'Products Management', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'U'], description: 'Purchases & Stock', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'A'], description: 'Analytics', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'S'], description: 'Settings', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'G'], description: 'General Ledger', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'R'], description: 'Accounts Receivable', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'Shift', 'Y'], description: 'Accounts Payable', category: 'Admin Navigation' },
  { keys: ['Ctrl', 'B'], description: 'Barcode Management', category: 'Admin Navigation' },
  { keys: ['Alt', 'Q'], description: 'Quotations', category: 'Admin Navigation' },
  
  // General
  { keys: ['Escape'], description: 'Close dialog/modal', category: 'General' },
  { keys: ['Enter'], description: 'Submit form/Confirm', category: 'General' },
  { keys: ['Tab'], description: 'Next field/element', category: 'General' },
  { keys: ['Shift', 'Tab'], description: 'Previous field/element', category: 'General' },
  { keys: ['?'], description: 'Show this help', category: 'General' },
  { keys: ['↑', '↓'], description: 'Navigate items', category: 'General' },
  { keys: ['←', '→'], description: 'Navigate tabs/sections', category: 'General' },
  
  // POS System
  { keys: ['F1'], description: 'Cash In', category: 'POS System' },
  { keys: ['F2'], description: 'Cash Out', category: 'POS System' },
  { keys: ['F3'], description: 'Hold Ticket', category: 'POS System' },
  { keys: ['F4'], description: 'Recall Ticket', category: 'POS System' },
  { keys: ['F9'], description: 'Process Payment', category: 'POS System' },
  { keys: ['F12'], description: 'Clear Cart', category: 'POS System' },
];

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const formatKey = (key: string) => {
  if (key === 'Ctrl' && isMac) return '⌘';
  if (key === 'Alt' && isMac) return '⌥';
  if (key === 'Shift') return '⇧';
  if (key === 'Enter') return '↵';
  if (key === 'Escape') return 'Esc';
  return key;
};

export const KeyboardShortcutsDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleShowShortcuts = () => setOpen(true);
    window.addEventListener('show-shortcuts', handleShowShortcuts);
    return () => window.removeEventListener('show-shortcuts', handleShowShortcuts);
  }, []);

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts
                  .filter(s => s.category === category)
                  .map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, i) => (
                          <Badge key={i} variant="secondary" className="font-mono text-xs">
                            {formatKey(key)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
              {category !== categories[categories.length - 1] && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4">
          Press <Badge variant="secondary" className="font-mono mx-1">?</Badge> to toggle this dialog
        </div>
      </DialogContent>
    </Dialog>
  );
};
