import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Search, Loader2, Receipt, Calendar as CalendarIcon, FileText, User, Hash, Phone } from 'lucide-react';
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
  const [mode, setMode] = useState<'bill' | 'customer' | 'date'>('bill');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      let query = supabase
        .from('pos_transactions')
        .select(`
          id, transaction_number, total, created_at, customer_id, items, subtotal, tax, discount, notes,
          contacts:customer_id(name, phone, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (mode === 'bill') {
        if (!searchQuery.trim()) { setIsSearching(false); return; }
        query = query.ilike('transaction_number', `%${searchQuery.trim()}%`);
      } else if (mode === 'customer') {
        if (!searchQuery.trim()) { setIsSearching(false); return; }
        const term = searchQuery.trim();
        const { data: matchedContacts, error: cErr } = await supabase
          .from('contacts')
          .select('id')
          .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(50);
        if (cErr) throw cErr;
        const ids = (matchedContacts || []).map((c: any) => c.id);
        if (ids.length === 0) { setResults([]); setIsSearching(false); return; }
        query = query.in('customer_id', ids);
      } else if (mode === 'date') {
        if (!selectedDate) { setIsSearching(false); return; }
        query = query
          .gte('created_at', startOfDay(selectedDate).toISOString())
          .lte('created_at', endOfDay(selectedDate).toISOString());
      }

      const { data, error } = await query;
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
    setMode('bill');
    setSelectedDate(new Date());
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
          <Tabs value={mode} onValueChange={(v) => { setMode(v as any); setResults([]); setHasSearched(false); setSearchQuery(''); }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bill"><Hash className="h-3.5 w-3.5 mr-1" />Bill #</TabsTrigger>
              <TabsTrigger value="customer"><User className="h-3.5 w-3.5 mr-1" />Customer</TabsTrigger>
              <TabsTrigger value="date"><CalendarIcon className="h-3.5 w-3.5 mr-1" />By Date</TabsTrigger>
            </TabsList>

            <TabsContent value="bill" className="mt-3">
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
            </TabsContent>

            <TabsContent value="customer" className="mt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Customer name or phone"
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
            </TabsContent>

            <TabsContent value="date" className="mt-3">
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("flex-1 justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Button onClick={handleSearch} disabled={isSearching || !selectedDate}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load Bills'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

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
                              <CalendarIcon className="h-3 w-3" />
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
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.contacts.name}</span>
                          {t.contacts.phone && (
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{t.contacts.phone}</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : hasSearched ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No bills found</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  {mode === 'bill' && 'Search by bill number'}
                  {mode === 'customer' && 'Search by customer name or phone'}
                  {mode === 'date' && 'Pick a date and load all bills from that day'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a bill to load its items into a new quotation
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}