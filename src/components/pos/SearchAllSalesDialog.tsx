import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Search, Loader2, Receipt, User, Calendar, CreditCard, DollarSign, Smartphone, FileText } from 'lucide-react';
import { OrderViewDialog } from './OrderViewDialog';

interface SearchAllSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransactionResult {
  id: string;
  transaction_number: string;
  total: number;
  payment_method: string;
  payment_details: any;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: any;
  subtotal: number;
  tax: number;
  discount: number;
  notes: string | null;
}

export function SearchAllSalesDialog({ open, onOpenChange }: SearchAllSalesDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TransactionResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderView, setShowOrderView] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      // Search by transaction number (case insensitive, partial match)
      const { data, error } = await supabase
        .from('pos_transactions')
        .select(`
          id,
          transaction_number,
          total,
          payment_method,
          payment_details,
          created_at,
          customer_id,
          items,
          subtotal,
          tax,
          discount,
          notes,
          contacts:customer_id(name, phone)
        `)
        .ilike('transaction_number', `%${searchQuery.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedResults = (data || []).map(t => ({
        ...t,
        customer_name: t.contacts?.name || null,
        customer_phone: t.contacts?.phone || null
      }));

      setResults(formattedResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleViewTransaction = (transaction: TransactionResult) => {
    setSelectedOrder({
      id: transaction.id,
      order_number: transaction.transaction_number,
      customer_name: transaction.customer_name,
      customer_phone: transaction.customer_phone,
      type: 'pos',
      status: 'completed',
      payment_method: transaction.payment_method,
      payment_details: transaction.payment_details,
      created_at: transaction.created_at,
      items: transaction.items || [],
      subtotal: transaction.subtotal,
      tax: transaction.tax,
      discount: transaction.discount,
      total: transaction.total,
    });
    setShowOrderView(true);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="h-3 w-3" />;
      case 'credit':
        return <CreditCard className="h-3 w-3" />;
      case 'mobile_money':
        return <Smartphone className="h-3 w-3" />;
      default:
        return <DollarSign className="h-3 w-3" />;
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setResults([]);
    setHasSearched(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Search All Sales
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter transaction number (e.g., POS-3B0DA4B2D7)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            {/* Results */}
            <ScrollArea className="h-[400px]">
              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((transaction) => (
                    <Card 
                      key={transaction.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleViewTransaction(transaction)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Receipt className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{transaction.transaction_number}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDateTime(transaction.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{formatCurrency(transaction.total)}</p>
                            <Badge variant="outline" className="text-xs flex items-center gap-1 mt-1">
                              {getPaymentIcon(transaction.payment_method)}
                              {transaction.payment_method === 'mobile_money' ? 'Mobile' : transaction.payment_method}
                            </Badge>
                          </div>
                        </div>
                        {transaction.customer_name && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{transaction.customer_name}</span>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Try searching with a different transaction number
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Search for any transaction</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a transaction number to find historical sales
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order View Dialog */}
      <OrderViewDialog
        isOpen={showOrderView}
        onClose={() => setShowOrderView(false)}
        order={selectedOrder}
      />
    </>
  );
}
