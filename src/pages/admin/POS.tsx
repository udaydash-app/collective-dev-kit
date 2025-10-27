import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  X,
  Tags,
  Megaphone,
  FileSpreadsheet,
  ChevronDown,
  Building2,
  BookOpen,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Droplets,
  Edit
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { VariantSelector } from '@/components/pos/VariantSelector';
import { CashInDialog } from '@/components/pos/CashInDialog';
import { CashOutDialog } from '@/components/pos/CashOutDialog';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

export default function POS() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPayment, setShowPayment] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [showCashIn, setShowCashIn] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [currentCashSession, setCurrentCashSession] = useState<any>(null);
  
  const ITEMS_PER_PAGE = 12;
  
  const {
    cart,
    discount,
    setDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemPrice,
    updateItemDiscount,
    clearCart,
    calculateSubtotal,
    calculateTotal,
    processTransaction,
  } = usePOSTransaction();

  // Load order into POS if orderId is in URL params
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId && !isLoadingOrder && cart.length === 0) {
      setIsLoadingOrder(true);
      loadOrderToPOS(orderId);
    }
  }, [searchParams]);

  const loadOrderToPOS = async (orderId: string) => {
    try {
      // Fetch the order with its items
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          stores(id, name)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch order items with product details
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products(id, name, price, image_url, barcode)
        `)
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // Set store
      if (order.stores?.id) {
        setSelectedStoreId(order.stores.id);
      }

      // Add items to cart
      if (items && items.length > 0) {
        items.forEach(item => {
          if (item.products) {
            // Add product to cart with the quantity from the order
            for (let i = 0; i < item.quantity; i++) {
              addToCart({
                id: item.products.id,
                name: item.products.name,
                price: item.products.price,
                image_url: item.products.image_url,
                barcode: item.products.barcode,
              });
            }
          }
        });
        toast.success(`Loaded order ${order.order_number} into POS`);
      }
    } catch (error: any) {
      console.error('Error loading order:', error);
      toast.error('Failed to load order into POS');
    } finally {
      setIsLoadingOrder(false);
    }
  };

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

  // Set "Global Market" as default store
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreId) {
      const globalMarket = stores.find(store => store.name.toLowerCase().includes('global market'));
      if (globalMarket) {
        setSelectedStoreId(globalMarket.id);
      } else {
        // Fallback to first store if Global Market not found
        setSelectedStoreId(stores[0].id);
      }
    }
  }, [stores, selectedStoreId]);

  // Check for active cash session
  const { data: activeCashSession, refetch: refetchCashSession } = useQuery({
    queryKey: ['active-cash-session', selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('cashier_id', user.id)
        .eq('store_id', selectedStoreId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return data;
    },
    enabled: !!selectedStoreId,
  });

  // Show cash in dialog if no active session
  useEffect(() => {
    if (selectedStoreId && activeCashSession === null && !showCashIn) {
      setShowCashIn(true);
    }
    setCurrentCashSession(activeCashSession);
  }, [activeCashSession, selectedStoreId]);

  // Get session transactions for expected cash calculation
  const { data: sessionTransactions } = useQuery({
    queryKey: ['session-transactions', currentCashSession?.id],
    queryFn: async () => {
      if (!currentCashSession) return [];

      const { data } = await supabase
        .from('pos_transactions')
        .select('total, payment_method')
        .eq('cashier_id', currentCashSession.cashier_id)
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);

      return data || [];
    },
    enabled: !!currentCashSession,
  });

  // Get day's purchases
  const { data: dayPurchases } = useQuery({
    queryKey: ['day-purchases', currentCashSession?.id],
    queryFn: async () => {
      if (!currentCashSession) return [];

      const { data } = await supabase
        .from('purchases')
        .select('total_amount, payment_method, payment_status')
        .eq('store_id', currentCashSession.store_id)
        .gte('purchased_at', currentCashSession.opened_at);

      return data || [];
    },
    enabled: !!currentCashSession,
  });

  // Get day's expenses
  const { data: dayExpenses } = useQuery({
    queryKey: ['day-expenses', currentCashSession?.id],
    queryFn: async () => {
      if (!currentCashSession) return [];

      const { data } = await supabase
        .from('expenses')
        .select('amount, payment_method')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);

      return data || [];
    },
    enabled: !!currentCashSession,
  });

  // Calculate day activity
  const dayActivity = {
    cashSales: sessionTransactions
      ?.filter(t => t.payment_method === 'cash')
      .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    creditSales: sessionTransactions
      ?.filter(t => t.payment_method === 'credit')
      .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    mobileMoneyS: sessionTransactions
      ?.filter(t => t.payment_method === 'mobile_money')
      .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    totalSales: sessionTransactions
      ?.reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0,
    totalTransactions: sessionTransactions?.length || 0,
    purchases: dayPurchases
      ?.reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    cashPurchases: dayPurchases
      ?.filter(p => p.payment_method === 'cash')
      .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    creditPurchases: dayPurchases
      ?.filter(p => p.payment_method === 'credit')
      .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    mobileMoneyPurchases: dayPurchases
      ?.filter(p => p.payment_method === 'mobile_money')
      .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    expenses: dayExpenses
      ?.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
    cashExpenses: dayExpenses
      ?.filter(e => e.payment_method === 'cash')
      .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
    creditExpenses: dayExpenses
      ?.filter(e => e.payment_method === 'credit')
      .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
    mobileMoneyExpenses: dayExpenses
      ?.filter(e => e.payment_method === 'mobile_money')
      .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0,
  };

  // Calculate expected cash (opening cash + cash sales)
  const expectedCashAtClose = currentCashSession 
    ? parseFloat(currentCashSession.opening_cash?.toString() || '0') + dayActivity.cashSales
    : 0;

  const { data: categories } = useQuery({
    queryKey: ['pos-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, image_url, icon')
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['pos-customers', customerSearch],
    queryFn: async () => {
      if (!customerSearch || customerSearch.length < 2) return [];
      
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_customer', true)
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`)
        .limit(10);
      
      return data || [];
    },
    enabled: customerSearch.length >= 2,
  });

  const { data: products } = useQuery({
    queryKey: ['pos-products', searchTerm, selectedCategory],
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
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
      }

      const { data } = await query.limit(50);
      return data || [];
    },
    enabled: !!selectedCategory || !!searchTerm,
  });

  // Cash management handlers
  const handleCashIn = async (openingCash: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedStoreId) return;

      const { error } = await supabase
        .from('cash_sessions')
        .insert({
          store_id: selectedStoreId,
          cashier_id: user.id,
          opening_cash: openingCash,
          status: 'open',
        });

      if (error) throw error;

      toast.success('Cash register opened successfully');
      setShowCashIn(false);
      await refetchCashSession();
    } catch (error: any) {
      console.error('Error opening cash register:', error);
      toast.error('Failed to open cash register');
      throw error;
    }
  };

  const handleCashOut = async (closingCash: number, notes?: string) => {
    try {
      if (!currentCashSession) return;

      // Calculate expected cash from cash transactions only
      const { data: transactions } = await supabase
        .from('pos_transactions')
        .select('total, payment_method')
        .eq('cashier_id', currentCashSession.cashier_id)
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);

      const cashSales = transactions
        ?.filter(t => t.payment_method === 'cash')
        .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0;
      const expectedCash = parseFloat(currentCashSession.opening_cash.toString()) + cashSales;
      const cashDifference = closingCash - expectedCash;

      const { error } = await supabase
        .from('cash_sessions')
        .update({
          closing_cash: closingCash,
          expected_cash: expectedCash,
          cash_difference: cashDifference,
          closed_at: new Date().toISOString(),
          status: 'closed',
          notes,
        })
        .eq('id', currentCashSession.id);

      if (error) throw error;

      toast.success('Cash register closed successfully');
      setCurrentCashSession(null);
      clearCart();
      await refetchCashSession();
    } catch (error: any) {
      console.error('Error closing cash register:', error);
      toast.error('Failed to close cash register');
    }
  };

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
    
    if (availableVariants.length > 1) {
      // Show variant selector if multiple variants
      setSelectedProduct(product);
      setVariantSelectorOpen(true);
    } else if (availableVariants.length === 1) {
      // Auto-select single variant
      addToCart({
        ...product,
        price: availableVariants[0].price,
        selectedVariant: availableVariants[0],
      });
    } else {
      // No variants, use product price
      addToCart(product);
    }
  };

  const handleVariantSelect = (variant: any) => {
    if (selectedProduct) {
      addToCart({
        ...selectedProduct,
        price: variant.price,
        selectedVariant: variant,
      });
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Pagination logic
  const displayItems = selectedCategory || searchTerm ? products : categories;
  const totalPages = Math.ceil((displayItems?.length || 0) / ITEMS_PER_PAGE);
  const paginatedItems = displayItems?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const subtotal = calculateSubtotal();
  const total = calculateTotal();

  const handleCheckout = () => {
    if (!selectedStoreId) {
      toast.error('Please select a store');
      return;
    }
    if (!currentCashSession) {
      toast.error('Please open the cash register first');
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentConfirm = async (paymentMethod: string) => {
    await processTransaction(paymentMethod, selectedStoreId);
  };

  const menuSections = {
    sales: [
      { icon: ShoppingCart, label: 'Manage Orders', path: '/admin/orders' },
      { icon: Tag, label: 'Manage Offers', path: '/admin/offers' },
      { icon: Megaphone, label: 'Announcements', path: '/admin/announcements' },
    ],
    inventory: [
      { icon: Package, label: 'Manage Products', path: '/admin/products' },
      { icon: Tags, label: 'Manage Categories', path: '/admin/categories' },
      { icon: Edit, label: 'Stock Adjustment', path: '/admin/stock-adjustment' },
      { icon: Package, label: 'Purchases & Stock', path: '/admin/purchases' },
      { icon: FileSpreadsheet, label: 'Import Products', path: '/admin/import-products' },
    ],
    accounting: [
      { icon: BookOpen, label: 'Chart of Accounts', path: '/admin/chart-of-accounts' },
      { icon: FileText, label: 'Journal Entries', path: '/admin/journal-entries' },
      { icon: BookOpen, label: 'General Ledger', path: '/admin/general-ledger' },
      { icon: TrendingDown, label: 'Daily Expenses', path: '/admin/expenses' },
      { icon: DollarSign, label: 'Trial Balance', path: '/admin/trial-balance' },
      { icon: TrendingUp, label: 'Profit & Loss', path: '/admin/profit-loss' },
      { icon: Building2, label: 'Balance Sheet', path: '/admin/balance-sheet' },
      { icon: Droplets, label: 'Cash Flow', path: '/admin/cash-flow' },
    ],
    reports: [
      { icon: BarChart3, label: 'Analytics Dashboard', path: '/admin/analytics' },
      { icon: FileText, label: 'Sales & Purchase Reports', path: '/admin/close-day-report' },
      { icon: Package, label: 'Inventory Reports', path: '/admin/inventory-reports' },
    ],
    settings: [
      { icon: Users, label: 'POS Users', path: '/admin/pos-users' },
      { icon: Users, label: 'Contacts', path: '/admin/contacts' },
      { icon: Settings, label: 'Company Settings', path: '/admin/settings' },
    ],
  };

  const quickActions = [
    { 
      icon: Clock, 
      label: 'Recent sales', 
      color: 'bg-[#5DADE2]', 
      action: () => navigate('/admin/orders')
    },
    { 
      icon: Clock, 
      label: 'Pending sales', 
      color: 'bg-[#5DADE2]', 
      action: () => alert('No pending sales')
    },
    { 
      icon: Package, 
      label: 'Pickup orders', 
      color: 'bg-[#5DADE2]', 
      action: () => alert('No pickup orders')
    },
    { 
      icon: BarChart3, 
      label: 'Close day', 
      color: 'bg-[#5DADE2]', 
      action: () => {
        if (!currentCashSession) {
          toast.error('No active cash session to close');
          return;
        }
        setShowCashOut(true);
      }
    },
    { 
      icon: ShoppingCart, 
      label: 'Stock & Price', 
      color: 'bg-[#5DADE2]', 
      action: () => navigate('/admin/products')
    },
    { 
      icon: Clock, 
      label: 'Clock in/Out', 
      color: 'bg-[#5DADE2]', 
      action: () => {
        const now = new Date().toLocaleTimeString();
        alert(`Clocked in at ${now}`);
      }
    },
    { 
      icon: Gift, 
      label: 'Gift Card', 
      color: 'bg-[#5DADE2]', 
      action: () => alert('Gift card - Coming soon')
    },
    { 
      icon: Tag, 
      label: 'Coupons', 
      color: 'bg-[#5DADE2]', 
      action: () => {
        const code = prompt('Enter coupon code:');
        if (code) alert(`Coupon ${code} - Coming soon`);
      }
    },
    { 
      icon: Tag, 
      label: 'Discount', 
      color: 'bg-[#F39C12]', 
      action: () => {
        const amount = prompt('Enter discount amount:');
        if (amount) setDiscount(parseFloat(amount) || 0);
      }
    },
    { 
      icon: Printer, 
      label: 'Last receipt', 
      color: 'bg-[#5DADE2]', 
      action: () => alert('No previous receipt')
    },
    { 
      icon: Gift, 
      label: 'Notes', 
      color: 'bg-[#5DADE2]', 
      action: () => setShowNotesDialog(true)
    },
  ];

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar - Cart */}
      <div className="w-[500px] border-r flex flex-col bg-card">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">POS System</h1>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customer (name, phone, email)"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerResults(true);
              }}
              onFocus={() => setShowCustomerResults(true)}
              className="pl-10"
            />
            
            {/* Customer Search Results Dropdown */}
            {showCustomerResults && customerSearch.length >= 2 && customers && customers.length > 0 && (
              <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-64 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {customers.map((customer) => (
                    <Button
                      key={customer.id}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerSearch('');
                        setShowCustomerResults(false);
                      }}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.phone && `${customer.phone}`}
                          {customer.email && ` • ${customer.email}`}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              </Card>
            )}
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
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">{selectedCustomer ? selectedCustomer.name : 'Guest Customer'}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedCustomer ? (selectedCustomer.phone || selectedCustomer.email || 'No contact info') : 'Walk-in'}
                </p>
              </div>
            </div>
            {selectedCustomer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
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
              {cart.map((item) => {
                const effectivePrice = item.customPrice ?? item.price;
                const itemTotal = effectivePrice * item.quantity;
                const itemDiscountAmount = item.itemDiscount ?? 0;
                const finalItemTotal = itemTotal - itemDiscountAmount;

                return (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Original: {formatCurrency(item.price)}
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
                    
                    {/* Quantity and Price Controls */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                      
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs text-muted-foreground shrink-0">Price:</span>
                        <Input
                          type="number"
                          value={effectivePrice}
                          onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || item.price)}
                          className="h-7 text-xs text-center"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>

                    {/* Item Discount */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs text-muted-foreground shrink-0">Disc:</span>
                        <Input
                          type="number"
                          value={itemDiscountAmount}
                          onChange={(e) => updateItemDiscount(item.id, parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs text-center"
                          placeholder="0"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <span className="font-semibold text-sm">
                        {formatCurrency(finalItemTotal)}
                      </span>
                    </div>
                  </Card>
                );
              })}
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
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bill Discount</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 py-2">
              <span className="text-xs text-muted-foreground shrink-0">Bill Discount:</span>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
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
        {/* Admin Menu - Horizontal Layout */}
        <div className="bg-primary/5 border-b border-primary/20 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {/* Sales Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <ShoppingCart className="h-4 w-4" />
                  Sales
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-background z-50">
                {menuSections.sales.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Inventory Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <Package className="h-4 w-4" />
                  Inventory
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-background z-50">
                {menuSections.inventory.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Accounting Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <DollarSign className="h-4 w-4" />
                  Accounting
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-background z-50">
                {menuSections.accounting.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reports Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <BarChart3 className="h-4 w-4" />
                  Reports
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-background z-50">
                {menuSections.reports.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <Settings className="h-4 w-4" />
                  Settings
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-background z-50">
                {menuSections.settings.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b bg-card">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
                autoFocus
              />
            </div>
            <BarcodeScanner onScan={handleBarcodeScan} />
          </div>
        </div>

        {/* Categories/Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Breadcrumb */}
          {(selectedCategory || searchTerm) && (
            <div className="mb-4 flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToCategories}
              >
                ← Back to Categories
              </Button>
              {selectedCategory && (
                <span className="text-sm text-muted-foreground">
                  / {categories?.find(c => c.id === selectedCategory)?.name}
                </span>
              )}
            </div>
          )}

          {/* Paginated Items Grid */}
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {/* Show Categories when no category selected and no search */}
            {!selectedCategory && !searchTerm && paginatedItems?.map((category: any) => (
              <Button
                key={category.id}
                variant="outline"
                className="h-32 flex flex-col items-center justify-center p-3 hover:bg-[#5DADE2] hover:text-white hover:border-[#5DADE2] transition-colors"
                onClick={() => handleCategorySelect(category.id)}
              >
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="h-14 w-14 object-cover rounded mb-2 flex-shrink-0"
                  />
                ) : (
                  <Package className="h-10 w-10 mb-2 opacity-50 flex-shrink-0" />
                )}
                <p className="text-sm font-medium text-center line-clamp-2 break-words w-full leading-snug">
                  {category.name}
                </p>
              </Button>
            ))}

            {/* Show Products when category selected or searching */}
            {(selectedCategory || searchTerm) && paginatedItems?.map((product: any) => {
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
            
            {(selectedCategory || searchTerm) && paginatedItems?.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No products found
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="w-10"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-4 xl:grid-cols-6 gap-3 mt-4">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className={cn(
                  "h-24 flex flex-col items-center justify-center p-3 text-white border-none transition-colors",
                  action.color,
                  "hover:opacity-90"
                )}
                onClick={action.action}
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

      <VariantSelector
        isOpen={variantSelectorOpen}
        onClose={() => setVariantSelectorOpen(false)}
        product={selectedProduct}
        onSelectVariant={handleVariantSelect}
      />

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              className="w-full min-h-[100px] p-3 border rounded-md"
              placeholder="Add notes for this order..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNotesDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowNotesDialog(false);
                  if (orderNotes) {
                    alert(`Notes saved: ${orderNotes}`);
                  }
                }}
                className="flex-1"
              >
                Save Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CashInDialog
        isOpen={showCashIn}
        onClose={() => {
          if (!currentCashSession) {
            toast.error('Cash in is required to use the POS');
            return;
          }
          setShowCashIn(false);
        }}
        onConfirm={handleCashIn}
      />

      {currentCashSession && (
        <CashOutDialog
          isOpen={showCashOut}
          onClose={() => setShowCashOut(false)}
          onConfirm={handleCashOut}
          openingCash={parseFloat(currentCashSession.opening_cash?.toString() || '0')}
          expectedCash={expectedCashAtClose}
          dayActivity={dayActivity}
        />
      )}
    </div>
  );
}
