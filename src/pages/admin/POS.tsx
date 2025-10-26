import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePOSTransaction } from '@/hooks/usePOSTransaction';
import { formatCurrency } from '@/lib/utils';
import { 
  Search, 
  User, 
  ShoppingCart, 
  Package, 
  Clock,
  Gift,
  Trash2,
  Settings,
  BarChart3,
  Tag,
  Printer,
  CreditCard,
  DollarSign,
  X
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { cn } from '@/lib/utils';

export default function POS() {
  const [showPayment, setShowPayment] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  
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

  const { data: products } = useQuery({
    queryKey: ['pos-products', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_variants (
            id,
            label,
            quantity,
            unit,
            price,
            is_available,
            is_default
          )
        `)
        .eq('is_available', true)
        .order('name');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);
      }

      const { data } = await query.limit(50);
      return data || [];
    },
  });

  const handleBarcodeScan = async (barcode: string) => {
    const { data } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (
          id,
          label,
          quantity,
          unit,
          price,
          is_available,
          is_default
        )
      `)
      .eq('barcode', barcode)
      .eq('is_available', true)
      .maybeSingle();

    if (data) {
      handleProductClick(data);
    }
  };

  const handleProductClick = (product: any) => {
    const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
    
    if (availableVariants.length > 0) {
      // Use default variant or first available variant
      const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
      addToCart({
        ...product,
        price: defaultVariant.price,
        selectedVariant: defaultVariant,
      });
    } else {
      // No variants, use product price
      addToCart(product);
    }
  };

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

  const quickActions = [
    { icon: Clock, label: 'Recent sales', color: 'bg-[#5DADE2]' },
    { icon: Clock, label: 'Pending sales', color: 'bg-[#5DADE2]' },
    { icon: Package, label: 'Pickup orders', color: 'bg-[#5DADE2]' },
    { icon: BarChart3, label: 'Layaways', color: 'bg-[#5DADE2]' },
    { icon: ShoppingCart, label: 'Stock & Price', color: 'bg-[#5DADE2]' },
    { icon: Clock, label: 'Clock in/Out', color: 'bg-[#5DADE2]' },
    { icon: Gift, label: 'Check Gift Card', color: 'bg-[#5DADE2]' },
    { icon: Tag, label: 'Coupons', color: 'bg-[#5DADE2]' },
    { icon: Tag, label: 'Discount', color: 'bg-[#5DADE2]' },
    { icon: Tag, label: 'Tax exempt', color: 'bg-[#5DADE2]' },
    { icon: Printer, label: 'Last receipt', color: 'bg-[#5DADE2]' },
    { icon: Gift, label: 'Receipt', color: 'bg-[#5DADE2]' },
  ];

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar - Cart */}
      <div className="w-[380px] border-r flex flex-col bg-card">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">POS System</h1>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Customer"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Select store" />
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

        {/* Customer Info */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Guest Customer</p>
              <p className="text-sm text-muted-foreground">Walk-in</p>
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-2 opacity-50" />
              <p>Cart is empty</p>
              <p className="text-sm">Scan or add products</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Items</span>
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              </div>
              {cart.map((item) => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} each
                        {(item as any).selectedVariant && (
                          <span className="ml-1">
                            • {(item as any).selectedVariant.label || 
                               `${(item as any).selectedVariant.quantity}${(item as any).selectedVariant.unit}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Total Section */}
        <div className="border-t p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (15%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-bold">TOTAL</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="bg-[#F7DC6F] hover:bg-[#F4D03F] text-foreground"
            >
              <User className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              className="bg-[#EC7063] hover:bg-[#E74C3C]"
              onClick={clearCart}
              disabled={cart.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              CLEAR
            </Button>
            <Button
              className="bg-[#7DCEA0] hover:bg-[#52BE80] text-foreground"
              onClick={handleCheckout}
              disabled={cart.length === 0 || !selectedStoreId}
            >
              PAY
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side - Products & Actions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b bg-card">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <BarcodeScanner onScan={handleBarcodeScan} />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
            {products?.slice(0, 12).map((product) => {
              const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
              const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
              const displayPrice = availableVariants.length > 0 
                ? defaultVariant?.price 
                : product.price;

              return (
                <Button
                  key={product.id}
                  variant="outline"
                  className="h-32 flex flex-col items-center justify-center p-3 hover:bg-[#5DADE2] hover:text-white hover:border-[#5DADE2] transition-colors"
                  onClick={() => handleProductClick(product)}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-16 w-16 object-cover rounded mb-2"
                    />
                  ) : (
                    <Package className="h-12 w-12 mb-2 opacity-50" />
                  )}
                  <p className="text-xs font-medium text-center line-clamp-1 mb-1">
                    {product.name}
                  </p>
                  <p className="text-sm font-bold">
                    {displayPrice ? formatCurrency(Number(displayPrice)) : 'N/A'}
                  </p>
                  {availableVariants.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      {availableVariants.length} variants
                    </span>
                  )}
                </Button>
              );
            })}
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-4 xl:grid-cols-6 gap-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className={cn(
                  "h-24 flex flex-col items-center justify-center p-3 text-white border-none transition-colors",
                  action.color,
                  "hover:opacity-90"
                )}
              >
                <action.icon className="h-6 w-6 mb-1" />
                <span className="text-xs text-center">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        onConfirm={handlePaymentConfirm}
      />
    </div>
  );
}
