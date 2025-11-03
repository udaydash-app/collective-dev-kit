import React, { useState, useEffect, useRef } from 'react';
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
  Edit,
  MessageCircle,
  LogOut,
  Receipt as ReceiptIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { VariantSelector } from '@/components/pos/VariantSelector';
import { CashInDialog } from '@/components/pos/CashInDialog';
import { CashOutDialog } from '@/components/pos/CashOutDialog';
import { HoldTicketDialog } from '@/components/pos/HoldTicketDialog';
import { Receipt } from '@/components/pos/Receipt';
import { TransactionCart } from '@/components/pos/TransactionCart';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { qzTrayService } from "@/lib/qzTray";
import { kioskPrintService } from "@/lib/kioskPrint";
import { offlineDB } from "@/lib/offlineDB";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

import { NumericKeypad } from '@/components/pos/NumericKeypad';

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
  const [showHoldTicket, setShowHoldTicket] = useState(false);
  const [heldTickets, setHeldTickets] = useState<Array<{
    id: string;
    name: string;
    items: typeof cart;
    total: number;
    timestamp: Date;
  }>>([]);
  const [currentCashSession, setCurrentCashSession] = useState<any>(null);
  const [lastTransactionData, setLastTransactionData] = useState<any>(null);
  const lastReceiptRef = useRef<HTMLDivElement>(null);
  const [showLastReceiptOptions, setShowLastReceiptOptions] = useState(false);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [keypadMode, setKeypadMode] = useState<'qty' | 'discount' | 'price' | 'cartDiscount' | null>(null);
  const [keypadInput, setKeypadInput] = useState<string>('');
  const [isPercentMode, setIsPercentMode] = useState<boolean>(false);
  const [cartDiscountItem, setCartDiscountItem] = useState<any>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderType, setEditingOrderType] = useState<'pos' | 'online' | null>(null);
  
  const ITEMS_PER_PAGE = 12;

  // Initialize offline database
  useEffect(() => {
    offlineDB.init().catch(error => {
      console.error('Failed to initialize offline database:', error);
      toast.error('Failed to initialize offline storage');
    });
  }, []);

  // Load held tickets from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('pos-held-tickets');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setHeldTickets(parsed.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        })));
      } catch (e) {
        console.error('Failed to load held tickets:', e);
      }
    }
  }, []);

  // Save held tickets to localStorage
  React.useEffect(() => {
    if (heldTickets.length > 0) {
      localStorage.setItem('pos-held-tickets', JSON.stringify(heldTickets));
    }
  }, [heldTickets]);
  
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
  const loadedOrderRef = useRef<string | null>(null);
  const editedOrderRef = useRef<string | null>(null);
  
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId && orderId !== loadedOrderRef.current && !isLoadingOrder && cart.length === 0) {
      loadedOrderRef.current = orderId;
      setIsLoadingOrder(true);
      loadOrderToPOS(orderId);
    }
  }, [searchParams, isLoadingOrder, cart.length]);

  // Load order for editing from localStorage
  useEffect(() => {
    const editOrderId = searchParams.get('editOrder');
    if (editOrderId && editOrderId !== editedOrderRef.current && !isLoadingOrder && cart.length === 0) {
      editedOrderRef.current = editOrderId;
      setIsLoadingOrder(true);
      loadEditOrderToPOS(editOrderId);
    }
  }, [searchParams, isLoadingOrder, cart.length]);

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
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        toast.error('Order not found');
        navigate('/admin/pos', { replace: true });
        return;
      }

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

      // Add items to cart with correct quantities
      if (items && items.length > 0) {
        // Process items sequentially to avoid race conditions
        for (const item of items) {
          if (item.products) {
            // Add product to cart with the correct quantity directly
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
        }
        
        // Update order status to confirmed
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'confirmed' })
          .eq('id', orderId);
          
        if (updateError) {
          console.error('Error updating order status:', updateError);
        }
        
        // Clear orderId from URL to prevent reloading on refresh
        navigate('/admin/pos', { replace: true });
        
        toast.success(`Loaded order ${order.order_number} into POS and marked as confirmed`);
      }
    } catch (error: any) {
      console.error('Error loading order:', error);
      toast.error('Failed to load order into POS');
      // Clear orderId from URL even on error
      navigate('/admin/pos', { replace: true });
    } finally {
      setIsLoadingOrder(false);
    }
  };

  const loadEditOrderToPOS = async (editOrderId: string) => {
    try {
      // Get order data from localStorage
      const storedData = localStorage.getItem('pos-edit-order');
      if (!storedData) {
        toast.error('Order data not found');
        navigate('/admin/pos', { replace: true });
        return;
      }

      const orderData = JSON.parse(storedData);
      
      // Clear localStorage
      localStorage.removeItem('pos-edit-order');
      
      // Store editing info
      setEditingOrderId(orderData.id);
      setEditingOrderType(orderData.type);
      
      // Set store if available
      if (orderData.storeId) {
        setSelectedStoreId(orderData.storeId);
      }

      // Load items into cart
      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          // Skip cart-discount items as they'll be recalculated
          if (item.id === 'cart-discount') {
            // Recreate the cart discount
            setCartDiscountItem({
              id: 'cart-discount',
              name: 'Cart Discount',
              price: item.price || 0,
              quantity: 1,
              itemDiscount: 0,
            });
            continue;
          }

          // Add each item with quantity of 1, then update quantity
          addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            barcode: item.barcode,
          });
          
          // Update quantity if greater than 1
          if (item.quantity > 1) {
            updateQuantity(item.id, item.quantity);
          }
          
          // Apply custom price if present
          if (item.customPrice) {
            updateItemPrice(item.id, item.customPrice);
          }
          
          // Apply item discount if present
          if (item.itemDiscount && item.itemDiscount > 0) {
            updateItemDiscount(item.id, item.itemDiscount);
          }
        }
        
        // Clear URL parameter
        navigate('/admin/pos', { replace: true });
        
        toast.success(`Loaded ${orderData.type === 'pos' ? 'sale' : 'order'} for editing`);
      }
    } catch (error: any) {
      console.error('Error loading order for editing:', error);
      toast.error('Failed to load order for editing');
      navigate('/admin/pos', { replace: true });
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

  // Fetch company settings for receipt
  const { data: settings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('settings')
        .select('logo_url, company_phone, company_name')
        .single();
      return data;
    },
  });

  // Set "Global Market" as default store
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreId) {
      const globalMarket = stores.find(store => store.name.toLowerCase().includes('global market'));
      const defaultStore = globalMarket || stores[0];
      setSelectedStoreId(defaultStore.id);
      console.log('Default store selected:', defaultStore.name);
    }
  }, [stores, selectedStoreId]);

  // Check for active cash session
  const { data: activeCashSession, refetch: refetchCashSession, isLoading: isLoadingCashSession } = useQuery({
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
    if (selectedStoreId && !isLoadingCashSession && !activeCashSession && !showCashIn) {
      setShowCashIn(true);
    }
    setCurrentCashSession(activeCashSession);
  }, [activeCashSession, selectedStoreId, isLoadingCashSession]);

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
    mobileMoneySales: sessionTransactions
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

  // Fetch payment receipts for this session
  const { data: paymentReceipts } = useQuery({
    queryKey: ['session-payment-receipts', currentCashSession?.id],
    queryFn: async () => {
      if (!currentCashSession) return [];
      
      const { data, error } = await supabase
        .from('payment_receipts')
        .select('amount, payment_method')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCashSession
  });

  // Fetch supplier payments for this session
  const { data: supplierPayments } = useQuery({
    queryKey: ['session-supplier-payments', currentCashSession?.id],
    queryFn: async () => {
      if (!currentCashSession) return [];
      
      const { data, error } = await supabase
        .from('supplier_payments')
        .select('amount, payment_method')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCashSession
  });

  const cashPayments = paymentReceipts
    ?.filter(p => p.payment_method === 'cash')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;
  
  const mobileMoneyPayments = paymentReceipts
    ?.filter(p => p.payment_method === 'mobile_money')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

  const cashSupplierPayments = supplierPayments
    ?.filter(p => p.payment_method === 'cash')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;
  
  const mobileMoneySupplierPayments = supplierPayments
    ?.filter(p => p.payment_method === 'mobile_money')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

  // Calculate expected cash (opening + cash sales + cash payments - cash purchases - cash expenses - cash supplier payments)
  const expectedCashAtClose = currentCashSession 
    ? parseFloat(currentCashSession.opening_cash?.toString() || '0') + 
      dayActivity.cashSales + 
      cashPayments - 
      dayActivity.cashPurchases - 
      dayActivity.cashExpenses - 
      cashSupplierPayments
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
      
      const mobileMoneySales = transactions
        ?.filter(t => t.payment_method === 'mobile_money')
        .reduce((sum, t) => sum + parseFloat(t.total.toString()), 0) || 0;

      // Fetch purchases for this session
      const { data: purchases } = await supabase
        .from('purchases')
        .select('total_amount, payment_method')
        .eq('store_id', currentCashSession.store_id)
        .gte('purchased_at', currentCashSession.opened_at);

      const cashPurchases = purchases
        ?.filter(p => p.payment_method === 'cash')
        .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0;
      
      const mobileMoneyPurchases = purchases
        ?.filter(p => p.payment_method === 'mobile_money')
        .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0;

      // Fetch expenses for this session
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, payment_method')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);

      const cashExpenses = expenses
        ?.filter(e => e.payment_method === 'cash')
        .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0;
      
      const mobileMoneyExpenses = expenses
        ?.filter(e => e.payment_method === 'mobile_money')
        .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0) || 0;

      // Fetch payment receipts for this session
      const { data: paymentReceipts } = await supabase
        .from('payment_receipts')
        .select('amount, payment_method')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);

      const cashPayments = paymentReceipts
        ?.filter(p => p.payment_method === 'cash')
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;
      
      const mobileMoneyPayments = paymentReceipts
        ?.filter(p => p.payment_method === 'mobile_money')
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

      // Fetch supplier payments for this session
      const { data: supplierPayments } = await supabase
        .from('supplier_payments')
        .select('amount, payment_method')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);

      const cashSupplierPayments = supplierPayments
        ?.filter(p => p.payment_method === 'cash')
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;
      
      const mobileMoneySupplierPayments = supplierPayments
        ?.filter(p => p.payment_method === 'mobile_money')
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

      const expectedCash = parseFloat(currentCashSession.opening_cash.toString()) + 
        cashSales + 
        cashPayments - 
        cashPurchases - 
        cashExpenses - 
        cashSupplierPayments;
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
    console.log('Scanning barcode:', barcode);
    
    // First, try to find a product variant with this barcode
    const { data: variantData, error: variantError } = await supabase
      .from('product_variants')
      .select(`
        id,
        label,
        quantity,
        unit,
        price,
        is_available,
        is_default,
        barcode,
        product_id,
        products (
          id,
          name,
          barcode,
          image_url,
          is_available
        )
      `)
      .eq('barcode', barcode)
      .eq('is_available', true)
      .maybeSingle();

    console.log('Variant barcode scan result:', { variantData, variantError });

    if (variantData && variantData.products) {
      // Found a variant with this barcode
      console.log('Adding variant to cart:', variantData);
      addToCart({
        ...variantData.products,
        price: variantData.price,
        selectedVariant: variantData,
      });
      return;
    }

    // If no variant found, check main product barcode
    const { data, error } = await supabase
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
          is_default,
          barcode
        )
      `)
      .eq('barcode', barcode)
      .eq('is_available', true)
      .maybeSingle();

    console.log('Product barcode scan result:', { data, error });

    if (data) {
      // For barcode scans, add directly to cart with smart variant selection
      const availableVariants = data.product_variants?.filter((v: any) => v.is_available) || [];
      console.log('Available variants:', availableVariants);
      
      if (availableVariants.length > 0) {
        // Prioritize default variant, otherwise use first available
        const variantToAdd = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
        console.log('Adding variant to cart:', variantToAdd);
        addToCart({
          ...data,
          price: variantToAdd.price,
          selectedVariant: variantToAdd,
        });
      } else {
        // No variants, use product price
        console.log('Adding product without variants to cart');
        addToCart(data);
      }
    } else {
      console.error('Product not found for barcode:', barcode);
      toast.error('Product not found');
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
  const cartDiscountAmount = cartDiscountItem ? Math.abs(cartDiscountItem.price) : 0;
  const total = subtotal - cartDiscountAmount;

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

  const handlePaymentConfirm = async (payments: Array<{ id: string; method: string; amount: number }>, totalPaid: number) => {
    // Prepare transaction data BEFORE processing (because processTransaction clears the cart)
    const allItems = cartDiscountItem ? [...cart, cartDiscountItem] : cart;
    const transactionDataPrep = {
      items: allItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price, // Original price
        customPrice: item.customPrice, // Custom/modified price if any
        itemDiscount: item.itemDiscount || 0,
      })),
      subtotal: calculateSubtotal(),
      discount: cartDiscountAmount,
      total: total,
      paymentMethod: payments.length > 1 ? "Multiple" : payments[0]?.method || "Cash",
      cashierName: currentCashSession?.cashier_name || "Cashier",
      storeName: stores?.find(s => s.id === selectedStoreId)?.name || settings?.company_name || "Global Market",
      logoUrl: settings?.logo_url,
      supportPhone: settings?.company_phone,
    };
    
    // Pass cartDiscountItem as additionalItems to processTransaction
    // Add customer ID to notes for credit sales journal entry tracking
    const notesWithCustomer = selectedCustomer && payments.some(p => p.method === 'credit')
      ? `${orderNotes ? orderNotes + ' | ' : ''}customer:${selectedCustomer.id}`
      : orderNotes;
    
    const result = await processTransaction(
      payments, 
      selectedStoreId, 
      selectedCustomer?.id, 
      notesWithCustomer,
      cartDiscountItem ? [cartDiscountItem] : undefined,
      cartDiscountAmount // Pass the cart discount amount
    );
    
    if (result) {
      // If editing an existing order/transaction, delete the old one
      if (editingOrderId) {
        try {
          if (editingOrderType === 'pos') {
            await supabase
              .from('pos_transactions')
              .delete()
              .eq('id', editingOrderId);
          } else if (editingOrderType === 'online') {
            await supabase
              .from('orders')
              .delete()
              .eq('id', editingOrderId);
          }
          toast.info('Previous transaction replaced with updated version');
        } catch (error) {
          console.error('Error deleting old transaction:', error);
        }
        
        // Clear editing state
        setEditingOrderId(null);
        setEditingOrderType(null);
      }
      
      // Clear cart discount after successful transaction
      setCartDiscountItem(null);
      
      // Add transaction number to the prepared data
      const transactionId = 'id' in result ? result.id : 'offline-' + Date.now();
      const transactionNumber = 'transaction_number' in result ? result.transaction_number : transactionId;
      
      setLastTransactionData({
        ...transactionDataPrep,
        transactionNumber,
      });
      
      const displayNumber = 'transaction_number' in result ? result.transaction_number : transactionId.slice(0, 8);
      toast.success(`Transaction ${displayNumber} processed successfully`);
    }
  };

  const handlePrintLastReceipt = useReactToPrint({
    contentRef: lastReceiptRef,
  });

  const handleLastReceiptClick = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to view receipts');
        return;
      }

      // Fetch the most recent transaction for this cashier
      const { data: transaction, error } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('cashier_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !transaction) {
        toast.error('No previous receipt available');
        return;
      }

      // Parse transaction items
      const items = Array.isArray(transaction.items) ? transaction.items : [];
      
      // Prepare transaction data - properly preserve item structure including custom prices and discounts
      const transactionData = {
        transactionNumber: transaction.transaction_number,
        items: items.map((item: any) => ({
          id: item.id || 'unknown',
          name: item.name || 'Unknown Item',
          quantity: item.quantity || 1,
          price: (item.customPrice ?? item.price) || 0, // Use custom price if available
          itemDiscount: item.itemDiscount || 0,
        })),
        subtotal: parseFloat(transaction.subtotal?.toString() || '0'),
        discount: parseFloat(transaction.discount?.toString() || '0'),
        tax: parseFloat(transaction.tax?.toString() || '0'),
        total: parseFloat(transaction.total?.toString() || '0'),
        paymentMethod: transaction.payment_method || 'Cash',
        cashierName: currentCashSession?.cashier_name || 'Cashier',
        storeName: stores?.find(s => s.id === transaction.store_id)?.name || settings?.company_name || 'Global Market',
        logoUrl: settings?.logo_url,
        supportPhone: settings?.company_phone,
      };

      setLastTransactionData(transactionData);
      setShowLastReceiptOptions(true);
    } catch (error) {
      console.error('Error fetching last receipt:', error);
      toast.error('Failed to load receipt');
    }
  };

  const handleSaveLastReceiptPDF = async () => {
    if (!lastReceiptRef.current || !lastTransactionData) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const canvas = await html2canvas(lastReceiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 297],
      });
      
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`receipt-${lastTransactionData.transactionNumber}.pdf`);
      toast.success('Receipt saved as PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleSendLastReceiptWhatsApp = () => {
    if (!lastTransactionData) return;
    
    // Format items list with proper pricing and discounts
    const itemsList = lastTransactionData.items.map((item: any) => {
      const isCartDiscount = item.id === 'cart-discount';
      if (isCartDiscount) {
        return `${item.name}: ${formatCurrency(item.price * item.quantity)}`;
      }
      
      const itemTotal = item.price * item.quantity;
      const itemDiscount = item.itemDiscount || 0;
      const finalAmount = itemTotal - itemDiscount;
      
      let line = `${item.name}\n  ${item.quantity} x ${formatCurrency(item.price)}`;
      if (itemDiscount > 0) {
        line += ` - ${formatCurrency(itemDiscount)} disc`;
      }
      line += ` = ${formatCurrency(finalAmount)}`;
      return line;
    }).join('\n\n');
    
    // Build receipt-formatted message
    let message = `*${lastTransactionData.storeName || 'Global Market'}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Receipt #${lastTransactionData.transactionNumber}\n`;
    message += `Date: ${new Date().toLocaleString()}\n`;
    if (lastTransactionData.cashierName) {
      message += `Cashier: ${lastTransactionData.cashierName}\n`;
    }
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*ITEMS*\n\n${itemsList}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Subtotal: ${formatCurrency(lastTransactionData.subtotal)}\n`;
    if (lastTransactionData.discount > 0) {
      message += `Discount: -${formatCurrency(lastTransactionData.discount)}\n`;
    }
    if (lastTransactionData.tax > 0) {
      message += `Tax: ${formatCurrency(lastTransactionData.tax)}\n`;
    }
    message += `\n*TOTAL: ${formatCurrency(lastTransactionData.total)}*\n\n`;
    message += `Payment: ${lastTransactionData.paymentMethod}\n`;
    if (lastTransactionData.supportPhone) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `Support: ${lastTransactionData.supportPhone}\n`;
    }
    message += `\nThank you for your business!`;
    
    window.location.href = `whatsapp://send?text=${encodeURIComponent(message)}`;
    toast.success('Opening WhatsApp...');
  };

  const handleDirectPrintLastReceipt = async () => {
    if (!lastTransactionData) return;
    
    toast.loading('Preparing receipt for printing...', { id: 'kiosk-print' });
    
    try {
      console.log('🖨️ Calling kiosk print service...');
      
      await kioskPrintService.printReceipt({
        storeName: lastTransactionData.storeName || 'Global Market',
        transactionNumber: lastTransactionData.transactionNumber,
        date: new Date(),
        items: lastTransactionData.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          itemDiscount: item.itemDiscount || 0
        })),
        subtotal: lastTransactionData.subtotal,
        tax: lastTransactionData.tax || 0,
        discount: lastTransactionData.discount || 0,
        total: lastTransactionData.total,
        paymentMethod: lastTransactionData.paymentMethod,
        cashierName: lastTransactionData.cashierName,
        logoUrl: lastTransactionData.logoUrl,
        supportPhone: lastTransactionData.supportPhone
      });
      
      toast.success('✅ Print dialog opened! Check your printer.', { id: 'kiosk-print' });
      setShowLastReceiptOptions(false);
    } catch (error: any) {
      console.error('❌ Print error:', error);
      toast.error(error.message || 'Failed to print receipt', { id: 'kiosk-print' });
    }
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
      { icon: DollarSign, label: 'Open Cash', action: () => setShowCashIn(true) },
      { icon: BookOpen, label: 'Chart of Accounts', path: '/admin/chart-of-accounts' },
      { icon: FileText, label: 'Journal Entries', path: '/admin/journal-entries' },
      { icon: BookOpen, label: 'General Ledger', path: '/admin/general-ledger' },
      { icon: ReceiptIcon, label: 'Payment Receipts', path: '/admin/payment-receipts' },
      { icon: DollarSign, label: 'Supplier Payments', path: '/admin/supplier-payments' },
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
      icon: Clock, 
      label: 'Hold / Fire', 
      color: 'bg-[#F97316]', 
      action: () => setShowHoldTicket(true)
    },
    { 
      icon: Package, 
      label: 'Pickup orders', 
      color: 'bg-[#5DADE2]', 
      action: () => alert('No pickup orders')
    },
    { 
      icon: BarChart3, 
      label: 'End Of Day', 
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
      action: handleLastReceiptClick
    },
    { 
      icon: Gift, 
      label: 'Notes', 
      color: 'bg-[#5DADE2]', 
      action: () => setShowNotesDialog(true)
    },
  ];

  const handleHoldTicket = (ticketName: string) => {
    if (cart.length === 0) {
      toast.error('Cannot hold empty cart');
      return;
    }

    const newTicket = {
      id: Date.now().toString(),
      name: ticketName,
      items: [...cart],
      total: calculateTotal(),
      timestamp: new Date(),
    };

    setHeldTickets([...heldTickets, newTicket]);
    clearCart();
    toast.success(`Ticket "${ticketName}" held successfully`);
    setShowHoldTicket(false);
  };

  const handleRecallTicket = (ticket: any) => {
    // Auto-hold current cart if not empty
    if (cart.length > 0) {
      const autoHoldTicket = {
        id: Date.now().toString(),
        name: `Auto-hold ${new Date().toLocaleTimeString()}`,
        items: [...cart],
        total: calculateTotal(),
        timestamp: new Date(),
      };
      setHeldTickets(prev => [...prev, autoHoldTicket]);
      toast.info('Current cart auto-held');
    }

    // Clear cart first
    clearCart();

    // Add ticket items to cart
    setTimeout(() => {
      ticket.items.forEach((item: any) => {
        addToCart(item);
      });

      // Remove recalled ticket from held tickets list
      setHeldTickets(prev => prev.filter(t => t.id !== ticket.id));
      toast.success(`Ticket "${ticket.name}" recalled`);
      setShowHoldTicket(false);
    }, 50);
  };

  const handleDeleteTicket = (ticketId: string) => {
    setHeldTickets(heldTickets.filter(t => t.id !== ticketId));
    toast.success('Ticket deleted');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/pos-login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to logout');
    }
  };

  // Numeric Keypad Handlers
  const handleSelectCartItem = (itemId: string) => {
    // Don't allow selecting cart discount item
    if (itemId === 'cart-discount') return;
    setSelectedCartItemId(itemId);
    setKeypadInput('');
  };

  const handleKeypadNumber = (value: string) => {
    if (keypadMode === 'cartDiscount') {
      setKeypadInput(prev => prev + value);
      return;
    }
    if (!selectedCartItemId) {
      toast.error('Please select a product from the cart first');
      return;
    }
    setKeypadInput(prev => prev + value);
  };

  const handleKeypadQty = () => {
    if (!selectedCartItemId) {
      toast.error('Please select a product from the cart first');
      return;
    }
    setKeypadMode('qty');
    setKeypadInput('');
  };

  const handleKeypadDiscount = () => {
    if (!selectedCartItemId) {
      toast.error('Please select a product from the cart first');
      return;
    }
    setKeypadMode('discount');
    setKeypadInput('');
    setIsPercentMode(false);
  };

  const handleKeypadCartDiscount = () => {
    setKeypadMode('cartDiscount');
    setKeypadInput('');
    setIsPercentMode(false);
    setSelectedCartItemId(null);
  };

  const handleKeypadPercent = () => {
    if (keypadMode === 'cartDiscount') {
      setIsPercentMode(!isPercentMode);
      return;
    }
    if (!selectedCartItemId) {
      toast.error('Please select a product or use cart discount first');
      return;
    }
    if (keypadMode !== 'discount') {
      toast.error('Please select discount mode first');
      return;
    }
    setIsPercentMode(!isPercentMode);
  };

  const handleKeypadPrice = () => {
    if (!selectedCartItemId) {
      toast.error('Please select a product from the cart first');
      return;
    }
    setKeypadMode('price');
    setKeypadInput('');
  };

  const handleKeypadClear = () => {
    setKeypadInput('');
    setIsPercentMode(false);
    if (keypadMode === 'cartDiscount') {
      setKeypadMode(null);
    }
  };

  const handleKeypadEnter = () => {
    if (!keypadMode || !keypadInput) {
      toast.error('Please select mode and enter a value');
      return;
    }

    const value = parseFloat(keypadInput);
    if (isNaN(value) || value < 0) {
      toast.error('Invalid value');
      return;
    }

    switch (keypadMode) {
      case 'qty':
        if (!selectedCartItemId) return;
        if (value === 0) {
          toast.error('Quantity must be greater than 0');
          return;
        }
        updateQuantity(selectedCartItemId, Math.floor(value));
        toast.success(`Quantity updated to ${Math.floor(value)}`);
        break;
      case 'discount':
        if (!selectedCartItemId) return;
        // Calculate discount based on percentage or fixed amount
        let discountAmount = value;
        if (isPercentMode) {
          const selectedItem = cart.find(item => item.id === selectedCartItemId);
          if (selectedItem) {
            const itemTotal = selectedItem.price * selectedItem.quantity;
            discountAmount = (itemTotal * value) / 100;
            toast.success(`Discount updated to ${value}% (${formatCurrency(discountAmount)})`);
          }
        } else {
          toast.success(`Discount updated to ${formatCurrency(value)}`);
        }
        updateItemDiscount(selectedCartItemId, discountAmount);
        break;
      case 'price':
        if (!selectedCartItemId) return;
        if (value === 0) {
          toast.error('Price must be greater than 0');
          return;
        }
        updateItemPrice(selectedCartItemId, value);
        toast.success(`Price updated to ${formatCurrency(value)}`);
        break;
      case 'cartDiscount':
        // Calculate cart discount
        let cartDiscountAmount = value;
        if (isPercentMode) {
          const cartSubtotal = calculateSubtotal();
          cartDiscountAmount = (cartSubtotal * value) / 100;
          toast.success(`Cart discount applied: ${value}% (${formatCurrency(cartDiscountAmount)})`);
        } else {
          toast.success(`Cart discount applied: ${formatCurrency(value)}`);
        }
        // Add or update cart discount as a special item
        setCartDiscountItem({
          id: 'cart-discount',
          name: 'Cart Discount',
          price: -cartDiscountAmount,
          quantity: 1,
          itemDiscount: 0,
        });
        break;
    }

    setKeypadInput('');
    setKeypadMode(null);
    setIsPercentMode(false);
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar - Cart */}
      <div className="w-[550px] border-r flex flex-col bg-card">
        {/* Header */}
        <div className="p-2 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold">POS</h1>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                title="Logout"
                className="h-7 w-7 p-0"
              >
                <LogOut className="h-3 w-3 text-muted-foreground" />
              </Button>
              <Settings className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerResults(true);
              }}
              onFocus={() => setShowCustomerResults(true)}
              className="pl-7 h-7 text-xs"
            />
            
            {/* Customer Search Results Dropdown */}
            {showCustomerResults && customerSearch.length >= 2 && customers && customers.length > 0 && (
              <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-40 overflow-y-auto">
                <div className="p-1 space-y-0.5">
                  {customers.map((customer) => (
                    <Button
                      key={customer.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-1.5"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerSearch('');
                        setShowCustomerResults(false);
                      }}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-xs">{customer.name}</span>
                        <span className="text-[10px] text-muted-foreground">
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
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              {stores?.map((store) => (
                <SelectItem key={store.id} value={store.id} className="py-1.5 text-xs">
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Customer Info */}
        <div className="p-2 border-b">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-xs">{selectedCustomer ? selectedCustomer.name : 'Guest'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedCustomer ? (selectedCustomer.phone || selectedCustomer.email || 'No info') : 'Walk-in'}
                </p>
              </div>
            </div>
            {selectedCustomer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-hidden p-1">
          {editingOrderId && (
            <div className="mb-2 p-2 bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-900 dark:text-amber-200">
              <div className="font-semibold">Editing {editingOrderType === 'pos' ? 'Sale' : 'Order'}</div>
              <div className="text-[10px] opacity-80">ID: {editingOrderId.slice(0, 8)}...</div>
            </div>
          )}
          <TransactionCart
            items={[...cart, ...(cartDiscountItem ? [cartDiscountItem] : [])]}
            onUpdateQuantity={updateQuantity}
            onUpdateDiscount={updateItemDiscount}
            onUpdatePrice={updateItemPrice}
            onRemove={(id) => {
              if (id === 'cart-discount') {
                setCartDiscountItem(null);
                toast.success('Cart discount removed');
              } else {
                removeFromCart(id);
              }
            }}
            onClear={() => {
              clearCart();
              setCartDiscountItem(null);
            }}
            selectedItemId={selectedCartItemId || undefined}
            onSelectItem={handleSelectCartItem}
          />
        </div>

        {/* Total Section */}
        <div className="border-t p-3">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold">TOTAL</span>
            <span className="text-4xl font-bold text-primary">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Right Side - Products & Actions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Admin Menu - Horizontal Layout */}
        <div className="bg-primary/5 border-b border-primary/20 px-2 py-1">
          <div className="flex gap-1 overflow-x-auto">
            {/* Sales Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-0.5 whitespace-nowrap h-7 text-[10px] px-2">
                  <ShoppingCart className="h-3 w-3" />
                  Sales
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-background z-50">
                {menuSections.sales.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer py-1.5 text-xs"
                  >
                    <item.icon className="h-3 w-3 mr-1.5" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Inventory Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-0.5 whitespace-nowrap h-7 text-[10px] px-2">
                  <Package className="h-3 w-3" />
                  Inventory
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-background z-50">
                {menuSections.inventory.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer py-1.5 text-xs"
                  >
                    <item.icon className="h-3 w-3 mr-1.5" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Accounting Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-0.5 whitespace-nowrap h-7 text-[10px] px-2">
                  <DollarSign className="h-3 w-3" />
                  Accounting
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-background z-50">
                {menuSections.accounting.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => item.action ? item.action() : navigate(item.path)}
                    className="cursor-pointer py-1.5 text-xs"
                  >
                    <item.icon className="h-3 w-3 mr-1.5" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reports Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-0.5 whitespace-nowrap h-7 text-[10px] px-2">
                  <BarChart3 className="h-3 w-3" />
                  Reports
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-background z-50">
                {menuSections.reports.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer py-1.5 text-xs"
                  >
                    <item.icon className="h-3 w-3 mr-1.5" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Section */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-0.5 whitespace-nowrap h-7 text-[10px] px-2">
                  <Settings className="h-3 w-3" />
                  Settings
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-background z-50">
                {menuSections.settings.map((item, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer py-1.5 text-xs"
                  >
                    <item.icon className="h-3 w-3 mr-1.5" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-1.5 border-b bg-card">
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    // Check if it looks like a barcode (all digits)
                    if (/^\d+$/.test(searchTerm.trim())) {
                      handleBarcodeScan(searchTerm.trim());
                      setSearchTerm(''); // Clear after scanning
                    }
                  }
                }}
                className="pl-7 h-7 text-xs"
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Categories/Products Grid - Scrollable */}
        <div className="flex-1 overflow-y-auto p-2 pb-0">
          {/* Breadcrumb */}
          {(selectedCategory || searchTerm) && (
            <div className="mb-2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToCategories}
                className="h-7 text-xs"
              >
                ← Back
              </Button>
              {selectedCategory && (
                <span className="text-xs text-muted-foreground">
                  / {categories?.find(c => c.id === selectedCategory)?.name}
                </span>
              )}
            </div>
          )}

          {/* Paginated Items Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {/* Show Categories when no category selected and no search */}
            {!selectedCategory && !searchTerm && paginatedItems?.map((category: any) => (
              <Button
                key={category.id}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center p-1.5 hover:bg-[#5DADE2] hover:text-white hover:border-[#5DADE2] transition-colors"
                onClick={() => handleCategorySelect(category.id)}
              >
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="h-10 w-10 object-cover rounded mb-1 flex-shrink-0"
                  />
                ) : (
                  <Package className="h-7 w-7 mb-1 opacity-50 flex-shrink-0" />
                )}
                <p className="text-[10px] font-medium text-center line-clamp-2 break-words w-full leading-tight">
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
                  className="h-20 flex flex-col items-center justify-center p-1.5 hover:bg-[#5DADE2] hover:text-white hover:border-[#5DADE2] transition-colors"
                  onClick={() => handleProductClick(product)}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-10 w-10 object-cover rounded mb-0.5"
                    />
                  ) : (
                    <Package className="h-7 w-7 mb-0.5 opacity-50" />
                  )}
                  <p className="text-[10px] font-medium text-center line-clamp-1 mb-0.5">
                    {product.name}
                  </p>
                  <p className="text-xs font-bold">
                    {displayPrice ? formatCurrency(Number(displayPrice)) : 'N/A'}
                  </p>
                  {availableVariants.length > 1 && (
                    <span className="text-[8px] text-muted-foreground">
                      {availableVariants.length} variants
                    </span>
                  )}
                </Button>
              );
            })}
            
            {(selectedCategory || searchTerm) && paginatedItems?.length === 0 && (
              <div className="col-span-full text-center py-8 text-xs text-muted-foreground">
                No products found
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 px-3 text-xs"
              >
                Prev
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="w-7 h-7 text-xs p-0"
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
                className="h-12 px-6"
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Numeric Keypad and Quick Actions - Fixed at Bottom */}
        <div className="flex gap-2 p-2 border-t bg-background">
          {/* Numeric Keypad - left side */}
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-2 px-2">
              {keypadMode === 'cartDiscount' ? (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">Cart Discount Mode - Enter amount</span>
                  <span className="font-semibold text-primary">
                    {keypadInput || '0'}{isPercentMode ? '%' : ''}
                  </span>
                </div>
              ) : selectedCartItemId ? (
                <div className="flex items-center justify-between">
                  <span>Selected: {cart.find(item => item.id === selectedCartItemId)?.name || 'Product'}</span>
                  {keypadMode && (
                    <span className="font-semibold text-primary">
                      {keypadMode.toUpperCase()}: {keypadInput || '0'}{isPercentMode && keypadMode === 'discount' ? '%' : ''}
                    </span>
                  )}
                </div>
              ) : (
                <span>Select a product from cart or use CART DISC</span>
              )}
            </div>
            <NumericKeypad
              onNumberClick={handleKeypadNumber}
              onQtyClick={handleKeypadQty}
              onDiscountClick={handleKeypadDiscount}
              onPriceClick={handleKeypadPrice}
              onPercentClick={handleKeypadPercent}
              onCartDiscountClick={handleKeypadCartDiscount}
              onPayClick={handleCheckout}
              onClear={handleKeypadClear}
              onEnter={handleKeypadEnter}
              disabled={!selectedCartItemId && keypadMode !== 'cartDiscount'}
              activeMode={keypadMode}
              isPercentMode={isPercentMode}
              payDisabled={cart.length === 0 || !selectedStoreId}
            />
          </div>

          {/* Quick Actions Grid - 2 columns, right side */}
          <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className={cn(
                  "h-16 w-28 flex flex-col items-center justify-center p-1.5 text-white border-none transition-colors",
                  action.color,
                  "hover:opacity-90"
                )}
                onClick={action.action}
              >
                <action.icon className="h-4 w-4 mb-0.5" />
                <span className="text-[10px] text-center leading-tight">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => {
          setShowPayment(false);
          setLastTransactionData(null);
        }}
        total={total}
        onConfirm={handlePaymentConfirm}
        selectedCustomer={selectedCustomer}
        transactionData={lastTransactionData}
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
        onClose={() => setShowCashIn(false)}
        onConfirm={handleCashIn}
        onSkip={() => {
          setShowCashIn(false);
          toast.info('Starting POS without cash session. You can open a cash session later.');
        }}
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

      <HoldTicketDialog
        isOpen={showHoldTicket}
        onClose={() => setShowHoldTicket(false)}
        currentCart={cart}
        currentTotal={calculateTotal()}
        onHoldTicket={handleHoldTicket}
        onRecallTicket={handleRecallTicket}
        onDeleteTicket={handleDeleteTicket}
        heldTickets={heldTickets}
      />


      {/* Last Receipt Options Dialog */}
      <Dialog open={showLastReceiptOptions} onOpenChange={setShowLastReceiptOptions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt Options</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => {
                handleDirectPrintLastReceipt();
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Direct Print (Kiosk Mode)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                handlePrintLastReceipt();
                setShowLastReceiptOptions(false);
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Browser Print
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                handleSaveLastReceiptPDF();
                setShowLastReceiptOptions(false);
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Save as PDF
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                handleSendLastReceiptWhatsApp();
                setShowLastReceiptOptions(false);
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Send via WhatsApp
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowLastReceiptOptions(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden receipt for reprinting */}
      <div className="fixed -left-[9999px] top-0 bg-white">
        <div ref={lastReceiptRef}>
          {lastTransactionData && (
            <Receipt
              transactionNumber={lastTransactionData.transactionNumber}
              items={lastTransactionData.items.map((item: any) => ({
                ...item,
                id: item.name,
                subtotal: item.quantity * item.price,
              }))}
              subtotal={lastTransactionData.subtotal}
              tax={lastTransactionData.tax || 0}
              discount={lastTransactionData.discount}
              total={lastTransactionData.total}
              paymentMethod={lastTransactionData.paymentMethod}
              date={new Date()}
              cashierName={lastTransactionData.cashierName}
              storeName={lastTransactionData.storeName}
              logoUrl={lastTransactionData.logoUrl}
              supportPhone={lastTransactionData.supportPhone}
            />
          )}
        </div>
      </div>
    </div>
  );
}
