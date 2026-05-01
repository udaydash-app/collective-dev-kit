import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Search, Loader2, Receipt, Calendar, FileText, User } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (data: {
    items: any[];
    contactId: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    notes?: string | null;
  }) => void;
}

export function CreateQuotationFromBillDialog({ open, onOpenChange, onLoad }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase
        .from('pos_transactions')
        .select(`
          id, transaction_number, total, created_at, customer_id, items, subtotal, tax, discount, notes,
          contacts:customer_id(name, phone, email)
        `)
        .ilike('transaction_number', `%${searchQuery.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setResults(data || []);
    } catch (e: any) {
      toast.error('Search failed: ' + e.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (t: any) => {
    const items = (t.items || []).map((it: any) => ({
      productId: it.productId || it.id,
      productName: it.name,
      variantId: it.variantId,
      variantName: it.variantName,
      quantity: Number(it.quantity) || 1,
      price: Number(it.price) || 0,
      discount: Number(it.itemDiscount) || 0,
      total: ((Number(it.price) || 0) * (Number(it.quantity) || 1)) - (Number(it.itemDiscount) || 0),
    }));

    if (items.length === 0) {
      toast.error('This bill has no items');
      return;
    }

    onLoad({
      items,
      contactId: t.customer_id || null,
      customerName: t.contacts?.name || null,
      customerPhone: t.contacts?.phone || null,
      customerEmail: t.contacts?.email || null,
      notes: t.notes ? `From bill ${t.transaction_number}\n${t.notes}` : `From bill ${t.transaction_number}`,
    });
    handleClose();
    toast.success(`Loaded ${items.length} item(s) from ${t.transaction_number}`);
  };

  const handleClose = () => {
    setSearchQuery('');
    setResults([]);
    setHasSearched(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Quotation from Previous Bill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter transaction number (e.g., POS-XXXXX)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map((t) => (
                  <Card
                    key={t.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleSelect(t)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Receipt className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{t.transaction_number}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDateTime(t.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(t.total)}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {(t.items || []).length} item(s)
                          </Badge>
                        </div>
                      </div>
                      {t.contacts?.name && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{t.contacts.name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : hasSearched ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Search for a previous bill</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the transaction number to load its items into a new quotation
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}