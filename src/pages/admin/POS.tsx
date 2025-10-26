import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductSearch } from '@/components/pos/ProductSearch';
import { TransactionCart } from '@/components/pos/TransactionCart';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { usePOSTransaction } from '@/hooks/usePOSTransaction';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, Percent } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function POS() {
  const [showPayment, setShowPayment] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const {
    cart,
    discount,
    setDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    calculateSubtotal,
    calculateTax,
    calculateTotal,
    processTransaction,
  } = usePOSTransaction();

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const subtotal = calculateSubtotal();
  const tax = calculateTax(subtotal);
  const total = calculateTotal();

  const handleCheckout = () => {
    if (!selectedStoreId) {
      alert('Please select a store');
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentConfirm = async (paymentMethod: string) => {
    await processTransaction(paymentMethod, selectedStoreId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Point of Sale</h1>
          <p className="text-muted-foreground">In-store transaction system</p>
        </div>

        <div className="mb-4">
          <Label htmlFor="store-select">Select Store</Label>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger id="store-select" className="w-full max-w-xs">
              <SelectValue placeholder="Select a store" />
            </SelectTrigger>
            <SelectContent>
              {stores?.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Product Search */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Search Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductSearch onProductSelect={addToCart} />
            </CardContent>
          </Card>

          {/* Cart */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Current Transaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionCart
                items={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                onClear={clearCart}
              />
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Transaction Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (15%):</span>
                  <span className="font-medium">{formatCurrency(tax)}</span>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="discount" className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Discount
                  </Label>
                  <Input
                    id="discount"
                    type="number"
                    placeholder="0.00"
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !selectedStoreId}
                  className="w-full"
                  size="lg"
                >
                  Proceed to Payment
                </Button>
                <Button
                  onClick={clearCart}
                  variant="outline"
                  disabled={cart.length === 0}
                  className="w-full"
                >
                  Clear Transaction
                </Button>
              </div>

              <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                <p>Items in cart: {cart.length}</p>
                <p>Total quantity: {cart.reduce((sum, item) => sum + item.quantity, 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        onConfirm={handlePaymentConfirm}
      />
    </div>
  );
}
