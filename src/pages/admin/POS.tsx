import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
  Receipt as ReceiptIcon,
  Plus,
  Calendar,
  Award,
  Banknote
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { AssignBarcodeDialog } from '@/components/pos/AssignBarcodeDialog';
import { RefundDialog } from '@/components/pos/RefundDialog';
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
import { ProductSearch } from '@/components/pos/ProductSearch';
import { Label } from '@/components/ui/label';

export default function POS() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});
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
  const [showCustomPriceConfirm, setShowCustomPriceConfirm] = useState(false);
  const [heldTickets, setHeldTickets] = useState<Array<{
    id: string;
    name: string;
    items: typeof cart;
    total: number;
    timestamp: Date;
  }>>([]);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [currentCashSession, setCurrentCashSession] = useState<any>(null);
  const [lastTransactionData, setLastTransactionData] = useState<any>(null);
  const [dateRange, setDateRange] = useState<'today' | 'month' | 'year' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [expandedMetric, setExpandedMetric] = useState<'sales' | 'products' | 'customers' | null>(null);
  const lastReceiptRef = useRef<HTMLDivElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const [showLastReceiptOptions, setShowLastReceiptOptions] = useState(false);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [keypadMode, setKeypadMode] = useState<'qty' | 'discount' | 'price' | 'cartDiscount' | null>(null);
  const [keypadInput, setKeypadInput] = useState<string>('');
  const [isPercentMode, setIsPercentMode] = useState<boolean>(false);
  const [cartDiscountItem, setCartDiscountItem] = useState<any>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderType, setEditingOrderType] = useState<'pos' | 'online' | null>(null);
  const [assignBarcodeOpen, setAssignBarcodeOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [showRefund, setShowRefund] = useState(false);
  
  
  const ITEMS_PER_PAGE = 12;

  // Initialize offline database
  useEffect(() => {
    offlineDB.init().catch(error => {
      console.error('Failed to initialize offline database:', error);
      toast.error('Failed to initialize offline storage');
    });
  }, []);

  // Load held tickets from localStorage only once on mount
  const loadedTicketsRef = useRef(false);
  React.useEffect(() => {
    if (loadedTicketsRef.current) return;
    loadedTicketsRef.current = true;
    
    const stored = localStorage.getItem('pos-held-tickets');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const tickets = parsed.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        }));
        setHeldTickets(tickets);
        console.log('Loaded tickets from localStorage:', tickets.length);
        
        // Auto-open hold ticket dialog if there are held tickets
        if (tickets.length > 0) {
          setTimeout(() => setShowHoldTicket(true), 500);
        }
      } catch (e) {
        console.error('Failed to load held tickets:', e);
      }
    }
  }, []);

  // Save held tickets to localStorage (with debounce to prevent interference)
  const saveTimeoutRef = useRef<number | null>(null);
  React.useEffect(() => {
    if (!loadedTicketsRef.current) return; // Don't save before initial load
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce the save to prevent rapid updates
    saveTimeoutRef.current = window.setTimeout(() => {
      console.log('Syncing heldTickets to localStorage, count:', heldTickets.length);
      if (heldTickets.length > 0) {
        localStorage.setItem('pos-held-tickets', JSON.stringify(heldTickets));
      } else {
        localStorage.removeItem('pos-held-tickets');
      }
    }, 100);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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
    loadCart,
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
              await addToCart({
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
      console.log('🔧 Loading order for editing:', orderData);
      
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
        console.log('🔧 Loading items:', orderData.items);
        
        // Build cart items array directly (avoid multiple addToCart calls with stale state)
        const cartItems: any[] = [];
        
        for (const item of orderData.items) {
          // Skip cart-discount items as they'll be recalculated
          if (item.id === 'cart-discount') {
            setCartDiscountItem({
              id: 'cart-discount',
              name: 'Cart Discount',
              price: item.price || 0,
              quantity: 1,
              itemDiscount: 0,
            });
            continue;
          }

          // Get the correct product ID
          const productId = item.productId || item.id;
          console.log(`🔧 Loading item: ${item.name}, productId: ${productId}`);
          
          // Create cart item
          cartItems.push({
            id: productId,
            productId: productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            barcode: item.barcode,
            customPrice: item.customPrice,
            itemDiscount: item.itemDiscount || 0,
          });
        }
        
        // Load all items at once
        console.log('🔧 Loading', cartItems.length, 'items into cart');
        loadCart(cartItems);
        
        console.log('🔧 All items loaded. Setting edit mode metadata...');
        
        // Set customer if available
        if (orderData.customerId) {
          console.log(`🔧 Loading customer: ${orderData.customerId}`);
          const { data: customer, error: customerError } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', orderData.customerId)
            .maybeSingle();
          
          if (customerError) {
            console.error('🔧 Error loading customer:', customerError);
            toast.error(`Failed to load customer: ${customerError.message}`);
          } else if (customer) {
            setSelectedCustomer(customer);
            console.log(`🔧 Customer loaded: ${customer.name}`);
          } else {
            console.warn('🔧 Customer not found with ID:', orderData.customerId);
            toast.warning('Customer from original bill not found - it may have been deleted');
          }
        } else {
          console.log('🔧 No customer ID in order data');
        }
        
        // Set cart discount
        if (orderData.discount) {
          setDiscount(orderData.discount);
          console.log(`🔧 Cart discount set: ${orderData.discount}`);
        }
        
        console.log('🔧 ✅ Edit mode setup complete! Editing:', {
          orderId: editingOrderId,
          orderType: editingOrderType,
          itemCount: cart.length
        });
        
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

  // Fetch all cash sessions for today to calculate total opening cash
  const { data: todayCashSessions } = useQuery({
    queryKey: ['today-cash-sessions', selectedStoreId, currentCashSession?.opened_at],
    queryFn: async () => {
      if (!selectedStoreId || !currentCashSession) return [];
      
      const { data } = await supabase
        .from('cash_sessions')
        .select('opening_cash')
        .eq('store_id', selectedStoreId)
        .gte('opened_at', currentCashSession.opened_at);
      
      return data || [];
    },
    enabled: !!selectedStoreId && !!currentCashSession,
  });

  // Calculate total opening cash from all users
  const totalOpeningCash = todayCashSessions?.reduce((sum, session) => {
    return sum + parseFloat(session.opening_cash?.toString() || '0');
  }, 0) || 0;

  // Show cash in dialog if no active session
  useEffect(() => {
    if (selectedStoreId && !isLoadingCashSession && !activeCashSession && !showCashIn) {
      setShowCashIn(true);
    }
    setCurrentCashSession(activeCashSession);
  }, [activeCashSession, selectedStoreId, isLoadingCashSession]);

  // Get all transactions for today from all users
  const { data: sessionTransactions } = useQuery({
    queryKey: ['today-all-transactions', selectedStoreId, currentCashSession?.opened_at],
    queryFn: async () => {
      if (!currentCashSession) return [];

      const { data } = await supabase
        .from('pos_transactions')
        .select('id, total, payment_method, created_at')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!currentCashSession,
  });

  // Get day's purchases from all users
  const { data: dayPurchases } = useQuery({
    queryKey: ['today-all-purchases', selectedStoreId, currentCashSession?.opened_at],
    queryFn: async () => {
      if (!currentCashSession) return [];

      const { data } = await supabase
        .from('purchases')
        .select(`
          id, 
          total_amount, 
          payment_method, 
          payment_status,
          purchased_at
        `)
        .eq('store_id', currentCashSession.store_id)
        .gte('purchased_at', currentCashSession.opened_at)
        .lte('purchased_at', new Date().toISOString())
        .order('purchased_at', { ascending: false });

      return data || [];
    },
    enabled: !!currentCashSession,
  });

  // Get day's expenses from all users
  const { data: dayExpenses } = useQuery({
    queryKey: ['today-all-expenses', selectedStoreId, currentCashSession?.opened_at],
    queryFn: async () => {
      if (!currentCashSession) return [];

      const { data } = await supabase
        .from('expenses')
        .select('id, amount, payment_method, description, category, created_at')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at)
        .lte('created_at', new Date().toISOString())
        .order('created_at', { ascending: false });

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
      ?.filter(p => p.payment_status === 'paid' && p.payment_method === 'cash')
      .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    creditPurchases: dayPurchases
      ?.filter(p => p.payment_status === 'pending' || p.payment_status === 'partial' || p.payment_method === 'credit')
      .reduce((sum, p) => sum + parseFloat(p.total_amount.toString()), 0) || 0,
    mobileMoneyPurchases: dayPurchases
      ?.filter(p => p.payment_status === 'paid' && p.payment_method === 'mobile_money')
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

  // Fetch payment receipts for today from all users
  const { data: paymentReceipts } = useQuery({
    queryKey: ['today-payment-receipts', selectedStoreId, currentCashSession?.opened_at],
    queryFn: async () => {
      if (!currentCashSession) return [];
      
      const { data, error } = await supabase
        .from('payment_receipts')
        .select('id, amount, payment_method, created_at, contact_id')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch contact names
      const receiptsWithContacts = await Promise.all(
        (data || []).map(async (r) => {
          if (r.contact_id) {
            const { data: contact } = await supabase
              .from('contacts')
              .select('name')
              .eq('id', r.contact_id)
              .single();
            return { ...r, contact_name: contact?.name };
          }
          return r;
        })
      );
      
      return receiptsWithContacts;
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
  
  const bankPayments = paymentReceipts
    ?.filter(p => p.payment_method === 'bank_transfer' || p.payment_method === 'cheque')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

  // Create payment receipts data object
  const paymentReceiptsData = {
    cashPayments,
    mobileMoneyPayments,
    bankPayments,
    totalPayments: cashPayments + mobileMoneyPayments + bankPayments
  };

  const cashSupplierPayments = supplierPayments
    ?.filter(p => p.payment_method === 'cash')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;
  
  const mobileMoneySupplierPayments = supplierPayments
    ?.filter(p => p.payment_method === 'mobile_money')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

  // Fetch journal entries affecting cash account for the session period (excluding POS, purchases, expenses, and payment receipts to avoid double counting)
  const { data: cashJournalEntries } = useQuery({
    queryKey: ['session-cash-journal-entries', selectedStoreId, currentCashSession?.opened_at, currentCashSession?.closed_at],
    queryFn: async () => {
      if (!currentCashSession) return [];
      
      // Get cash account ID
      const { data: cashAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('account_code', '1010')
        .single();
      
      if (!cashAccount) return [];
      
      // Get the session date range
      const sessionStartDate = new Date(currentCashSession.opened_at).toISOString().split('T')[0];
      const sessionEndDate = currentCashSession.closed_at 
        ? new Date(currentCashSession.closed_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      // Get journal entry lines for cash account from posted entries during the session
      // Include only truly manual journal entries by excluding system-generated prefixes
      // (POS-, PUR-, SPM-, PMT-, OB-)
      const { data } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entries!inner(status, entry_date, created_at, reference, description)
        `)
        .eq('account_id', cashAccount.id)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', sessionStartDate)
        .lte('journal_entries.entry_date', sessionEndDate)
        .not('journal_entries.reference', 'like', 'POS-%')
        .not('journal_entries.reference', 'like', 'PUR-%')
        .not('journal_entries.reference', 'like', 'SPM-%')
        .not('journal_entries.reference', 'like', 'PMT-%')
        .not('journal_entries.reference', 'like', 'OB-%')
        .order('journal_entries.entry_date', { ascending: true });
      
      return data || [];
    },
    enabled: !!currentCashSession
  });

  // Fetch mobile money journal entries for the entire session period
  const { data: mobileMoneyJournalEntries } = useQuery({
    queryKey: ['session-mobile-money-journal-entries', selectedStoreId, currentCashSession?.opened_at, currentCashSession?.closed_at],
    queryFn: async () => {
      if (!currentCashSession) return [];
      
      // Get mobile money account ID
      const { data: mobileMoneyAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('account_code', '1015')
        .single();
      
      if (!mobileMoneyAccount) return [];
      
      // Get the session date range
      const sessionStartDate = new Date(currentCashSession.opened_at).toISOString().split('T')[0];
      const sessionEndDate = currentCashSession.closed_at 
        ? new Date(currentCashSession.closed_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      // Get journal entry lines for mobile money account from posted entries during the session
      // Include only truly manual journal entries by excluding system-generated prefixes
      const { data } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entries!inner(status, entry_date, created_at, reference, description)
        `)
        .eq('account_id', mobileMoneyAccount.id)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', sessionStartDate)
        .lte('journal_entries.entry_date', sessionEndDate)
        .not('journal_entries.reference', 'like', 'POS-%')
        .not('journal_entries.reference', 'like', 'PUR-%')
        .not('journal_entries.reference', 'like', 'SPM-%')
        .not('journal_entries.reference', 'like', 'PMT-%')
        .not('journal_entries.reference', 'like', 'OB-%')
        .order('journal_entries.entry_date', { ascending: true });
      
      return data || [];
    },
    enabled: !!currentCashSession
  });

  // Calculate net cash from journal entries (debits increase cash, credits decrease cash)
  const journalCashEffect = cashJournalEntries
    ?.reduce((sum, entry) => {
      const debit = parseFloat(entry.debit_amount?.toString() || '0');
      const credit = parseFloat(entry.credit_amount?.toString() || '0');
      return sum + debit - credit;
    }, 0) || 0;

  // Calculate net mobile money from journal entries
  const journalMobileMoneyEffect = mobileMoneyJournalEntries
    ?.reduce((sum, entry) => {
      const debit = parseFloat(entry.debit_amount?.toString() || '0');
      const credit = parseFloat(entry.credit_amount?.toString() || '0');
      return sum + debit - credit;
    }, 0) || 0;

  // Calculate expected cash (Opening cash + cash sales + cash payments received - cash purchases - expenses - cash supplier payments + journal entries)
  const expectedCashAtClose = currentCashSession 
    ? (totalOpeningCash || 0) + 
      dayActivity.cashSales + 
      cashPayments - 
      dayActivity.cashPurchases - 
      dayActivity.cashExpenses -
      cashSupplierPayments +
      journalCashEffect
    : 0;

  // Calculate expected mobile money (mobile money sales + mobile money payments - mobile money purchases - mobile money expenses - mobile money supplier payments + journal entries)
  const expectedMobileMoneyAtClose = currentCashSession
    ? dayActivity.mobileMoneySales +
      mobileMoneyPayments -
      dayActivity.mobileMoneyPurchases -
      dayActivity.mobileMoneyExpenses -
      mobileMoneySupplierPayments +
      journalMobileMoneyEffect
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
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('is_customer', true)
        .order('name');
      
      // Apply search filter if search term exists
      if (customerSearch && customerSearch.length >= 2) {
        query = query.or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`);
      }
      
      const { data } = await query.limit(50);
      return data || [];
    },
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

  // Get date range for analytics
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        if (customStartDate && customEndDate) {
          return { 
            start: startOfDay(new Date(customStartDate)), 
            end: endOfDay(new Date(customEndDate)) 
          };
        }
        return { start: startOfDay(now), end: endOfDay(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  // Analytics queries
  const { data: analyticsData } = useQuery({
    queryKey: ['pos-analytics', selectedStoreId, dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      if (!selectedStoreId) return null;
      
      const { start, end } = getDateRange();
      
      // Get transactions for the period
      const { data: transactions } = await supabase
        .from('pos_transactions')
        .select('*, items')
        .eq('store_id', selectedStoreId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (!transactions) return null;

      // Calculate cash and credit sales
      const cashSales = transactions
        .filter(t => t.payment_method === 'cash')
        .reduce((sum, t) => sum + Number(t.total), 0);
      
      const creditSales = transactions
        .filter(t => t.payment_method === 'credit')
        .reduce((sum, t) => sum + Number(t.total), 0);

      const mobileMoneySales = transactions
        .filter(t => t.payment_method === 'mobile_money')
        .reduce((sum, t) => sum + Number(t.total), 0);

      // Calculate top selling item
      const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
      
      transactions.forEach(transaction => {
        const items = transaction.items as any[];
        items.forEach(item => {
          // Skip cart-discount items
          if (item.id === 'cart-discount') return;
          
          if (!productSales[item.id]) {
            productSales[item.id] = {
              name: item.name,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[item.id].quantity += item.quantity;
          // Use customPrice if available, otherwise use regular price
          const itemPrice = item.customPrice || item.price;
          productSales[item.id].revenue += itemPrice * item.quantity;
        });
      });

      const topItem = Object.values(productSales).sort((a, b) => b.revenue - a.revenue)[0] || null;

      // Get top customer (from notes field where customer info is stored)
      const customerTransactions: Record<string, { name: string; total: number; count: number }> = {};
      
      transactions.forEach(transaction => {
        if (transaction.notes?.includes('customer:')) {
          const customerMatch = transaction.notes.match(/customer:([^,]+),([^)]+)/);
          if (customerMatch) {
            const [, customerId, customerName] = customerMatch;
            if (!customerTransactions[customerId]) {
              customerTransactions[customerId] = {
                name: customerName,
                total: 0,
                count: 0
              };
            }
            customerTransactions[customerId].total += Number(transaction.total);
            customerTransactions[customerId].count += 1;
          }
        }
      });

      const topCustomer = Object.values(customerTransactions).sort((a, b) => b.total - a.total)[0] || null;

      // Prepare data for charts
      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const topCustomers = Object.values(customerTransactions)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const paymentMethodData = [
        { name: 'Cash', value: cashSales },
        { name: 'Credit', value: creditSales },
        { name: 'Mobile Money', value: mobileMoneySales }
      ].filter(item => item.value > 0);

      return {
        cashSales,
        creditSales,
        mobileMoneySales,
        topItem,
        topCustomer,
        totalTransactions: transactions.length,
        topProducts,
        topCustomers,
        paymentMethodData,
        allTransactions: transactions
      };
    },
    enabled: !!selectedStoreId,
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

      const expectedCash = (totalOpeningCash || 0) + 
        cashSales + 
        cashPayments - 
        cashPurchases - 
        cashExpenses -
        cashSupplierPayments;
      const cashDifference = closingCash - expectedCash;

      const expectedMobileMoney = mobileMoneySales +
        mobileMoneyPayments -
        mobileMoneyPurchases -
        mobileMoneyExpenses -
        mobileMoneySupplierPayments;

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
      const productToAdd = {
        ...variantData.products,
        price: variantData.price,
        selectedVariant: variantData,
      };
      addToCartWithCustomPrice(productToAdd);
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
        const productToAdd = {
          ...data,
          price: variantToAdd.price,
          selectedVariant: variantToAdd,
        };
        addToCartWithCustomPrice(productToAdd);
      } else {
        // No variants, use product price
        console.log('Adding product without variants to cart');
        addToCartWithCustomPrice(data);
      }
    } else {
      // Product not found - open assign barcode dialog
      console.log('Product not found for barcode:', barcode);
      setScannedBarcode(barcode);
      setAssignBarcodeOpen(true);
    }
  };

  const handleProductClick = (product: any) => {
    // If a specific variant was already selected (from barcode scan), use it directly
    if (product.selectedVariant) {
      console.log('🎯 Product has pre-selected variant, adding directly to cart');
      addToCartWithCustomPrice(product);
      return;
    }
    
    const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
    
    if (availableVariants.length > 1) {
      // Show variant selector if multiple variants
      setSelectedProduct(product);
      setVariantSelectorOpen(true);
    } else if (availableVariants.length === 1) {
      // Auto-select single variant
      const productToAdd = {
        ...product,
        price: availableVariants[0].price,
        selectedVariant: availableVariants[0],
      };
      addToCartWithCustomPrice(productToAdd);
    } else {
      // No variants, use product price
      addToCartWithCustomPrice(product);
    }
  };

  const handleVariantSelect = (variant: any) => {
    if (selectedProduct) {
      const productToAdd = {
        ...selectedProduct,
        price: variant.price,
        selectedVariant: variant,
      };
      addToCartWithCustomPrice(productToAdd);
    }
  };

  // Helper function to add to cart with custom pricing logic
  const addToCartWithCustomPrice = async (product: any) => {
    // Check if customer has custom price for this product
    const customPrice = customerPrices[product.id];
    
    if (customPrice && customPrice < product.price) {
      // Calculate discount as difference between retail and custom price
      const discount = product.price - customPrice;
      
      // Add product with original price
      await addToCart(product);
      
      // Apply discount immediately
      setTimeout(() => {
        updateItemDiscount(product.selectedVariant?.id || product.id, discount);
      }, 50);
    } else {
      // No custom price, add normally
      await addToCart(product);
    }
  };

  // Fetch customer prices when customer is selected
  useEffect(() => {
    const fetchCustomerPrices = async () => {
      // First, reset all cart items to retail price
      cart.forEach((item) => {
        if (item.itemDiscount && item.itemDiscount > 0) {
          updateItemDiscount(item.id, 0);
        }
      });

      if (!selectedCustomer) {
        setCustomerPrices({});
        toast.info('Prices reset to retail');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('customer_product_prices')
          .select('product_id, price')
          .eq('customer_id', selectedCustomer.id);

        if (error) throw error;

        // Convert to map for easy lookup
        const pricesMap: Record<string, number> = {};
        data?.forEach((item) => {
          pricesMap[item.product_id] = item.price;
        });

        setCustomerPrices(pricesMap);
        
        // Apply custom prices to existing cart items
        if (Object.keys(pricesMap).length > 0) {
          let appliedCount = 0;
          cart.forEach((cartItem) => {
            // Use the base productId stored in cart item
            const customPrice = pricesMap[cartItem.productId];
            
            console.log('Checking custom price for cart item:', {
              cartItemId: cartItem.id,
              productId: cartItem.productId,
              retailPrice: cartItem.price,
              customPrice: customPrice
            });
            
            if (customPrice && customPrice < cartItem.price) {
              const discount = cartItem.price - customPrice;
              updateItemDiscount(cartItem.id, discount);
              appliedCount++;
              console.log('Applied discount:', discount, 'to item:', cartItem.id);
            }
          });
          
          if (appliedCount > 0) {
            toast.success(`Custom prices applied to ${appliedCount} items for ${selectedCustomer.name}`);
          } else {
            toast.info(`No custom prices available for current cart items`);
          }
        } else {
          toast.info(`No custom prices set for ${selectedCustomer.name}`);
        }
      } catch (error) {
        console.error('Error fetching customer prices:', error);
      }
    };

    fetchCustomerPrices();
  }, [selectedCustomer]);

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
    
    // Prepare transaction data BEFORE opening payment modal
    const allItems = cartDiscountItem ? [...cart, cartDiscountItem] : cart;
    const transactionDataPrep = {
      transactionNumber: 'Pending',
      items: allItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price, // Original price (can be negative for cart-discount)
        customPrice: item.customPrice, // Custom/modified price if any
        itemDiscount: item.itemDiscount || 0,
        isCombo: item.isCombo,
        comboItems: item.comboItems,
      })),
      subtotal: calculateSubtotal(),
      discount: cartDiscountAmount,
      tax: 0,
      total: total,
      paymentMethod: "Pending",
      cashierName: currentCashSession?.cashier_name || "Cashier",
      storeName: stores?.find(s => s.id === selectedStoreId)?.name || settings?.company_name || "Global Market",
      logoUrl: settings?.logo_url,
      supportPhone: settings?.company_phone,
    };
    
    setLastTransactionData(transactionDataPrep);
    
    // Check if customer is selected and has custom prices or discounts
    if (selectedCustomer) {
      const itemsWithCustomPrices = cart.filter(item => {
        // Exclude special items (combos, BOGOs, cart discounts)
        const isSpecialItem = !item.productId || 
                             item.id.startsWith('combo-') || 
                             item.id.startsWith('bogo-') || 
                             item.id.startsWith('multi-bogo-') ||
                             item.id === 'cart-discount';
        
        if (isSpecialItem) return false;
        
        // Check if item has custom price or discount
        return (item.customPrice !== undefined && item.customPrice !== item.price) ||
               (item.itemDiscount !== undefined && item.itemDiscount > 0);
      });
      
      if (itemsWithCustomPrices.length > 0) {
        setShowCustomPriceConfirm(true);
        return;
      }
    }
    
    setShowPayment(true);
  };

  const handleSaveCustomerPrices = async () => {
    if (!selectedCustomer) return;
    
    try {
      const itemsWithCustomPrices = cart.filter(item => 
        (item.customPrice !== undefined && item.customPrice !== item.price) ||
        (item.itemDiscount !== undefined && item.itemDiscount > 0)
      );
      
      if (itemsWithCustomPrices.length === 0) {
        setShowCustomPriceConfirm(false);
        setShowPayment(true);
        return;
      }
      
      // Prepare prices to save - only for valid product IDs (exclude combos, BOGOs, cart discounts)
      const pricesToUpsert = itemsWithCustomPrices
        .filter(item => {
          // Exclude items without valid product IDs or special items
          return item.productId && 
                 !item.id.startsWith('combo-') && 
                 !item.id.startsWith('bogo-') && 
                 !item.id.startsWith('multi-bogo-') &&
                 item.id !== 'cart-discount';
        })
        .map(item => {
          // Calculate effective price: use customPrice if set, otherwise price minus discount
          const effectivePrice = item.customPrice ?? (item.price - (item.itemDiscount || 0));
          return {
            customer_id: selectedCustomer.id,
            product_id: item.productId,
            price: effectivePrice,
          };
        });

      if (pricesToUpsert.length === 0) {
        toast.info('No items with valid product IDs to save');
        setShowCustomPriceConfirm(false);
        setShowPayment(true);
        return;
      }

      // Upsert prices (will update existing or insert new)
      const { error } = await supabase
        .from('customer_product_prices')
        .upsert(pricesToUpsert, {
          onConflict: 'customer_id,product_id'
        });

      if (error) throw error;
      
      toast.success(`Custom prices saved for ${pricesToUpsert.length} product(s)`);
    } catch (error: any) {
      console.error('Error saving customer prices:', error);
      toast.error('Failed to save custom prices');
    } finally {
      setShowCustomPriceConfirm(false);
      setShowPayment(true);
    }
  };

  const handleSkipCustomerPrices = () => {
    setShowCustomPriceConfirm(false);
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
        price: item.price, // Original price (can be negative for cart-discount)
        customPrice: item.customPrice, // Custom/modified price if any
        itemDiscount: item.itemDiscount || 0,
        isCombo: item.isCombo,
        comboItems: item.comboItems,
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
          // Verify the new transaction was created before deleting the old one
          if ('id' in result && result.id) {
            if (editingOrderType === 'pos') {
              const { error: deleteError } = await supabase
                .from('pos_transactions')
                .delete()
                .eq('id', editingOrderId);
              
              if (deleteError) {
                console.error('Error deleting old POS transaction:', deleteError);
                toast.error('Failed to remove old transaction. Please contact support.');
              } else {
                toast.success('Transaction updated successfully');
              }
            } else if (editingOrderType === 'online') {
              // First delete order items
              const { error: itemsDeleteError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', editingOrderId);
              
              if (itemsDeleteError) {
                console.error('Error deleting old order items:', itemsDeleteError);
              }
              
              // Then delete the order
              const { error: deleteError } = await supabase
                .from('orders')
                .delete()
                .eq('id', editingOrderId);
              
              if (deleteError) {
                console.error('Error deleting old order:', deleteError);
                toast.error('Failed to remove old order. Please contact support.');
              } else {
                toast.success('Order updated successfully');
              }
            }
          } else {
            // New transaction was saved offline, don't delete old one yet
            toast.warning('Transaction saved offline. Old transaction will be replaced when synced.');
          }
        } catch (error) {
          console.error('Error during edit cleanup:', error);
          toast.error('Transaction saved but cleanup failed. You may see duplicate entries.');
        }
        
        // Clear editing state
        setEditingOrderId(null);
        setEditingOrderType(null);
      }
      
      // Custom prices are handled by the confirmation dialog before payment
      // No automatic saving here to respect user's choice
      
      // Clear cart discount after successful transaction
      setCartDiscountItem(null);
      
      // Reset customer selection to walk-in customer
      setSelectedCustomer(null);
      setCustomerPrices({});
      
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

      // Fetch customer name and balance if customer_id exists (unified if both customer and supplier)
      let customerName = undefined;
      let customerBalance = undefined;
      if (transaction.customer_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('name, customer_ledger_account_id, supplier_ledger_account_id, is_customer, is_supplier')
          .eq('id', transaction.customer_id)
          .maybeSingle();

        if (contact) {
          customerName = contact.name;
          
          let totalBalance = 0;

          // Fetch customer balance if they are a customer
          if (contact.is_customer && contact.customer_ledger_account_id) {
            const { data: customerLines } = await supabase
              .from('journal_entry_lines')
              .select(`
                debit_amount,
                credit_amount,
                journal_entries!inner (
                  status
                )
              `)
              .eq('account_id', contact.customer_ledger_account_id)
              .eq('journal_entries.status', 'posted');

            if (customerLines && customerLines.length > 0) {
              const custBalance = customerLines.reduce((sum, line) => {
                return sum + (line.debit_amount - line.credit_amount);
              }, 0);
              totalBalance += custBalance;
            }
          }

          // Fetch supplier balance if they are also a supplier (unified balance)
          if (contact.is_supplier && contact.supplier_ledger_account_id) {
            const { data: supplierLines } = await supabase
              .from('journal_entry_lines')
              .select(`
                debit_amount,
                credit_amount,
                journal_entries!inner (
                  status
                )
              `)
              .eq('account_id', contact.supplier_ledger_account_id)
              .eq('journal_entries.status', 'posted');

            if (supplierLines && supplierLines.length > 0) {
              const suppBalance = supplierLines.reduce((sum, line) => {
                return sum + (line.debit_amount - line.credit_amount);
              }, 0);
              // Add supplier balance (already negative if we owe them) for unified view
              totalBalance += suppBalance;
            }
          }

          customerBalance = totalBalance;
        }
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
          price: item.customPrice !== undefined ? item.customPrice : (item.price !== undefined ? item.price : 0), // Preserve negative prices for cart-discount
          customPrice: item.customPrice,
          itemDiscount: item.itemDiscount || 0,
          isCombo: item.isCombo,
          comboItems: item.comboItems,
        })),
        subtotal: parseFloat(transaction.subtotal?.toString() || '0'),
        discount: parseFloat(transaction.discount?.toString() || '0'),
        tax: parseFloat(transaction.tax?.toString() || '0'),
        total: parseFloat(transaction.total?.toString() || '0'),
        paymentMethod: transaction.payment_method || 'Cash',
        cashierName: currentCashSession?.cashier_name || 'Cashier',
        customerName,
        customerBalance,
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
      
      const effectivePrice = item.customPrice ?? item.price;
      const itemTotal = effectivePrice * item.quantity;
      const itemDiscount = item.itemDiscount || 0;
      const finalAmount = itemTotal - itemDiscount;
      
      let line = `${item.name}\n  ${item.quantity} x ${formatCurrency(effectivePrice)}`;
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
    if (lastTransactionData.customerName) {
      message += `Customer: ${lastTransactionData.customerName}\n`;
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
    if (lastTransactionData.customerBalance !== undefined && lastTransactionData.customerName) {
      message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*Customer Balance: ${formatCurrency(lastTransactionData.customerBalance)}*\n`;
    }
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
          price: item.customPrice ?? item.price,
          itemDiscount: item.itemDiscount || 0
        })),
        subtotal: lastTransactionData.subtotal,
        tax: lastTransactionData.tax || 0,
        discount: lastTransactionData.discount || 0,
        total: lastTransactionData.total,
        paymentMethod: lastTransactionData.paymentMethod,
        cashierName: lastTransactionData.cashierName,
        customerName: lastTransactionData.customerName,
        customerBalance: lastTransactionData.customerBalance,
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
      { icon: DollarSign, label: 'Pricing Management', path: '/admin/pricing' },
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
      { icon: FileText, label: 'Reports', path: '/admin/close-day-report' },
      { icon: Package, label: 'Inventory Reports', path: '/admin/inventory-reports' },
      { icon: Users, label: 'Accounts Receivable', path: '/admin/accounts-receivable' },
      { icon: Building2, label: 'Accounts Payable', path: '/admin/accounts-payable' },
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
      icon: Banknote, 
      label: 'Refund', 
      color: 'bg-[#EF4444]', 
      action: () => {
        if (cart.length === 0) {
          toast.error('Add items to cart to process refund');
          return;
        }
        setShowRefund(true);
      }
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
      action: () => navigate('/admin/stock-and-price')
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
      icon: Gift, 
      label: 'Notes', 
      color: 'bg-[#5DADE2]', 
      action: () => setShowNotesDialog(true)
    },
    { 
      icon: Printer, 
      label: 'Last receipt', 
      color: 'bg-[#5DADE2]', 
      action: handleLastReceiptClick
    },
    { 
      icon: LogOut, 
      label: 'Logout', 
      color: 'bg-[#EF4444]', 
      action: async () => {
        await supabase.auth.signOut();
        navigate('/auth/pos-login');
      }
    },
  ];

  const handleHoldTicket = (ticketName: string) => {
    if (cart.length === 0) {
      toast.error('Cannot hold empty cart');
      return;
    }

    // Include cart discount item if present
    const itemsToHold = cartDiscountItem ? [...cart, cartDiscountItem] : [...cart];
    
    const newTicket = {
      id: Date.now().toString(),
      name: ticketName,
      items: itemsToHold,
      total: calculateTotal(),
      timestamp: new Date(),
    };

    // Close dialog immediately for better UX
    setShowHoldTicket(false);
    
    // Update state
    setHeldTickets(prev => [...prev, newTicket]);
    clearCart();
    
    // Clear cart discount
    setCartDiscountItem(null);
    
    toast.success(`Ticket "${ticketName}" held successfully`);
  };

  const handleRecallTicket = (ticket: any) => {
    // Close dialog
    setShowHoldTicket(false);
    
    // Capture current cart state before clearing
    const currentCartSnapshot = cart.length > 0 ? [...cart] : null;
    const currentTotal = calculateTotal();
    
    // Clear cart first
    clearCart();
    
    // Remove recalled ticket and optionally add auto-hold
    setHeldTickets(prev => {
      let updatedTickets = prev.filter(t => t.id !== ticket.id);
      
      // If there was a current cart, auto-hold it
      if (currentCartSnapshot) {
        const autoHoldTicket = {
          id: Date.now().toString(),
          name: `Auto-hold ${new Date().toLocaleTimeString()}`,
          items: currentCartSnapshot,
          total: currentTotal,
          timestamp: new Date(),
        };
        updatedTickets = [...updatedTickets, autoHoldTicket];
        toast.info('Current cart auto-held');
      }
      
      return updatedTickets;
    });

    // Restore ticket items to cart all at once to avoid race conditions
    setTimeout(() => {
      // Build cart items array
      const cartItems: any[] = [];
      
      for (const item of ticket.items) {
        // Skip cart-discount items as they'll be recalculated
        if (item.id === 'cart-discount') {
          if (item.price < 0) {
            setCartDiscountItem({
              id: 'cart-discount',
              name: 'Cart Discount',
              price: item.price,
              quantity: 1,
              itemDiscount: 0,
            });
          }
          continue;
        }

        // Add item to cart array with all properties
        cartItems.push({
          id: item.id,
          productId: item.productId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          barcode: item.barcode,
          image_url: item.image_url,
          customPrice: item.customPrice,
          itemDiscount: item.itemDiscount || 0,
        });
      }
      
      // Load all items at once
      if (cartItems.length > 0) {
        loadCart(cartItems);
      }
      
      toast.success(`Ticket "${ticket.name}" recalled`);
    }, 100);
  };

  const handleDeleteTicket = (ticketId: string) => {
    setHeldTickets(prev => {
      const updatedTickets = prev.filter(t => t.id !== ticketId);
      // Close dialog if no tickets remain
      if (updatedTickets.length === 0) {
        setShowHoldTicket(false);
      }
      return updatedTickets;
    });
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
          
          <div>
            <Label className="text-xs">Search Products</Label>
            <ProductSearch 
              onProductSelect={handleProductClick}
            />
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
            <Button
              variant="ghost"
              className="flex items-center gap-1.5 p-0 h-auto hover:bg-transparent"
              onClick={() => setShowCustomerDialog(true)}
            >
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-xs">{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedCustomer ? (selectedCustomer.phone || selectedCustomer.email || 'No info') : 'Click to select customer'}
                </p>
              </div>
            </Button>
            {selectedCustomer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCustomer(null);
                  toast.info('Customer removed - prices reset to retail');
                }}
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

        {/* Search Bar - Only show when browsing products */}
        {(selectedCategory || searchTerm) && (
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
        )}

        {/* Dashboard/Analytics or Products Grid - Scrollable */}
        <div className="flex-1 overflow-y-auto p-2 pb-0">
          {/* Show Dashboard when no category/search selected */}
          {!selectedCategory && !searchTerm ? (
            <>
              {/* Date Range Selector */}
              <div className="mb-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Period</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {dateRange === 'custom' && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="Start Date"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="End Date"
                    />
                  </div>
                )}
              </div>

              {/* Analytics Cards Grid - Compact Version */}
              <div className="space-y-1.5">
                {/* Sales Overview Card - Compact */}
                <Card 
                  className="p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800 cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setExpandedMetric('sales')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="p-0.5 rounded bg-emerald-500/20">
                          <BarChart3 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-900 dark:text-emerald-100">Sales</span>
                      </div>
                      <p className="text-base font-bold text-emerald-900 dark:text-emerald-100 mb-0.5 truncate">
                        {formatCurrency((analyticsData?.cashSales || 0) + (analyticsData?.creditSales || 0) + (analyticsData?.mobileMoneySales || 0))}
                      </p>
                      <div className="flex gap-2 text-[8px]">
                        <span className="text-emerald-700 dark:text-emerald-300">💵 {formatCurrency(analyticsData?.cashSales || 0)}</span>
                        <span className="text-emerald-700 dark:text-emerald-300">💳 {formatCurrency(analyticsData?.creditSales || 0)}</span>
                        {(analyticsData?.mobileMoneySales || 0) > 0 && (
                          <span className="text-emerald-700 dark:text-emerald-300">📱 {formatCurrency(analyticsData?.mobileMoneySales || 0)}</span>
                        )}
                      </div>
                    </div>
                    {analyticsData?.paymentMethodData && analyticsData.paymentMethodData.length > 0 && (
                      <div className="w-14 h-14 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.paymentMethodData}
                              cx="50%"
                              cy="50%"
                              innerRadius={8}
                              outerRadius={20}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {analyticsData.paymentMethodData.map((_: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={['#22C55E', '#3B82F6', '#F59E0B'][index % 3]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Top Products Card - Compact */}
                <Card 
                  className="p-2 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800 cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setExpandedMetric('products')}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="p-0.5 rounded bg-amber-500/20">
                      <Award className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-[10px] font-semibold text-amber-900 dark:text-amber-100">Top Product</span>
                  </div>
                  {analyticsData?.topItem ? (
                    <>
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-100 mb-0.5 truncate">
                        {analyticsData.topItem.name}
                      </p>
                      <div className="flex items-center justify-between text-[9px] mb-1">
                        <span className="text-amber-700 dark:text-amber-300">Qty: {analyticsData.topItem.quantity}</span>
                        <span className="font-semibold text-amber-900 dark:text-amber-100">{formatCurrency(analyticsData.topItem.revenue)}</span>
                      </div>
                      {analyticsData?.topProducts && analyticsData.topProducts.length > 0 && (
                        <div className="h-10 -mx-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.topProducts.slice(0, 3)}>
                              <Bar dataKey="revenue" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">No data</p>
                  )}
                </Card>

                {/* Top Customers Card - Compact */}
                <Card 
                  className="p-2 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setExpandedMetric('customers')}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="p-0.5 rounded bg-purple-500/20">
                      <User className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-[10px] font-semibold text-purple-900 dark:text-purple-100">Top Customer</span>
                  </div>
                  {analyticsData?.topCustomer ? (
                    <>
                      <p className="text-xs font-bold text-purple-900 dark:text-purple-100 mb-0.5 truncate">
                        {analyticsData.topCustomer.name}
                      </p>
                      <div className="flex items-center justify-between text-[9px] mb-1">
                        <span className="text-purple-700 dark:text-purple-300">{analyticsData.topCustomer.count} orders</span>
                        <span className="font-semibold text-purple-900 dark:text-purple-100">{formatCurrency(analyticsData.topCustomer.total)}</span>
                      </div>
                      {analyticsData?.topCustomers && analyticsData.topCustomers.length > 0 && (
                        <div className="h-10 -mx-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analyticsData.topCustomers.slice(0, 3)}>
                              <Bar dataKey="total" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-purple-700 dark:text-purple-300">No data</p>
                  )}
                </Card>

                {/* Quick Stats Row - Compact */}
                <div className="grid grid-cols-2 gap-1.5">
                  <Card className="p-1.5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1 mb-0.5">
                      <ReceiptIcon className="h-2.5 w-2.5 text-slate-600 dark:text-slate-400" />
                      <span className="text-[9px] font-medium text-slate-900 dark:text-slate-100">Transactions</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {analyticsData?.totalTransactions || 0}
                    </p>
                  </Card>

                  <Card className="p-1.5 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center gap-1 mb-0.5">
                      <TrendingUp className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-[9px] font-medium text-indigo-900 dark:text-indigo-100">Avg Sale</span>
                    </div>
                    <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100 truncate">
                      {analyticsData?.totalTransactions 
                        ? formatCurrency(((analyticsData.cashSales || 0) + (analyticsData.creditSales || 0) + (analyticsData.mobileMoneySales || 0)) / analyticsData.totalTransactions)
                        : formatCurrency(0)
                      }
                    </p>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Breadcrumb */}
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

              {/* Products Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {paginatedItems?.map((product: any) => {
                  const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
                  const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
                  const displayPrice = availableVariants.length > 0 
                    ? defaultVariant?.price 
                    : product.price;

                  return (
                    <Button
                      key={product.id}
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center p-1.5 hover:bg-primary hover:text-primary-foreground transition-colors"
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
                
                {paginatedItems?.length === 0 && (
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
                    className="h-7 px-3 text-xs"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Numeric Keypad and Quick Actions - Fixed at Bottom */}
        <div className="flex gap-2 p-2 border-t bg-background">
          {/* Numeric Keypad - left side */}
          <div className="flex-1">
            <NumericKeypad
              onNumberClick={handleKeypadNumber}
              onQtyClick={handleKeypadQty}
              onDiscountClick={handleKeypadDiscount}
              onPriceClick={handleKeypadPrice}
              onPercentClick={handleKeypadPercent}
              onCartDiscountClick={handleKeypadCartDiscount}
              onPayClick={() => setShowPayment(true)}
              onClear={handleKeypadClear}
              onEnter={handleKeypadEnter}
              disabled={!selectedCartItemId && keypadMode !== 'cartDiscount'}
              activeMode={keypadMode}
              isPercentMode={isPercentMode}
              payDisabled={cart.length === 0}
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

      <AssignBarcodeDialog
        isOpen={assignBarcodeOpen}
        onClose={() => {
          setAssignBarcodeOpen(false);
          setScannedBarcode('');
        }}
        barcode={scannedBarcode}
        onBarcodeAssigned={() => {
          setScannedBarcode('');
          queryClient.invalidateQueries({ queryKey: ['pos-products'] });
        }}
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
          expectedMobileMoney={expectedMobileMoneyAtClose}
          transactions={sessionTransactions || []}
          purchases={dayPurchases || []}
          expenses={dayExpenses || []}
          paymentReceipts={paymentReceipts || []}
          journalEntries={cashJournalEntries || []}
          journalCashEffect={journalCashEffect}
          mobileMoneyJournalEntries={mobileMoneyJournalEntries || []}
          journalMobileMoneyEffect={journalMobileMoneyEffect}
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

      <RefundDialog
        open={showRefund}
        onClose={() => setShowRefund(false)}
        cartItems={cart}
        storeId={selectedStoreId}
        onRefundComplete={() => {
          clearCart();
          setCartDiscountItem(null);
          queryClient.invalidateQueries({ queryKey: ['pos-products'] });
        }}
      />

      {/* Customer Selection Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customer by name, phone or email..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <Button 
                  onClick={() => {
                    setShowCustomerDialog(false);
                    navigate('/admin/contacts', { state: { openAddDialog: true } });
                  }}
                  variant="default"
                >
                  <User className="h-4 w-4 mr-2" />
                  Add New Customer
                </Button>
              </div>
              
              {/* Customer Results */}
              {customers && customers.length > 0 && (
                <div className="space-y-2">
                  {customers.map((customer) => (
                    <Button
                      key={customer.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerSearch('');
                        setShowCustomerDialog(false);
                      }}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {customer.phone && customer.phone}
                          {customer.email && ` • ${customer.email}`}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
              
              {(!customers || customers.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  {customerSearch.length >= 2 ? 'No customers found' : 'No customers available'}
                  <div className="mt-4">
                    <Button 
                      onClick={() => {
                        setShowCustomerDialog(false);
                        navigate('/admin/contacts', { state: { openAddDialog: true } });
                      }}
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Customer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Custom Price Confirmation Dialog */}
      <AlertDialog open={showCustomPriceConfirm} onOpenChange={setShowCustomPriceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Custom Prices?</AlertDialogTitle>
            <AlertDialogDescription>
              You have changed prices or applied discounts for some items in this cart. Would you like to save these custom prices to {selectedCustomer?.name}'s profile for future orders?
              {cart.filter(item => (item.customPrice !== undefined && item.customPrice !== item.price) || (item.itemDiscount !== undefined && item.itemDiscount > 0)).length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="font-semibold text-sm">Items with custom prices/discounts:</p>
                  <ul className="list-disc list-inside text-sm">
                    {cart
                      .filter(item => (item.customPrice !== undefined && item.customPrice !== item.price) || (item.itemDiscount !== undefined && item.itemDiscount > 0))
                      .map(item => {
                        const effectivePrice = item.customPrice ?? (item.price - (item.itemDiscount || 0));
                        return (
                          <li key={item.id}>
                            {item.name}: {formatCurrency(item.price)} → {formatCurrency(effectivePrice)}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipCustomerPrices}>
              No, Continue Without Saving
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveCustomerPrices}>
              Yes, Save Prices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              customerName={lastTransactionData.customerName}
              customerBalance={lastTransactionData.customerBalance}
              storeName={lastTransactionData.storeName}
              logoUrl={lastTransactionData.logoUrl}
              supportPhone={lastTransactionData.supportPhone}
            />
          )}
        </div>
      </div>

      {/* Analytics Detail Dialog */}
      <Dialog open={expandedMetric !== null} onOpenChange={() => setExpandedMetric(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {expandedMetric === 'sales' && 'Sales Breakdown'}
              {expandedMetric === 'products' && 'Top Selling Products'}
              {expandedMetric === 'customers' && 'Top Customers'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Sales Breakdown */}
            {expandedMetric === 'sales' && analyticsData?.paymentMethodData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pie Chart */}
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-4">Sales by Payment Method</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={analyticsData.paymentMethodData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analyticsData.paymentMethodData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={['#22C55E', '#3B82F6', '#F59E0B'][index % 3]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: any) => formatCurrency(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* Summary Stats */}
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-4">Summary</h3>
                    <div className="space-y-3">
                      {analyticsData.paymentMethodData.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between items-center border-b pb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: ['#22C55E', '#3B82F6', '#F59E0B'][index % 3] }}
                            />
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          <span className="text-sm font-bold">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2 border-t-2">
                        <span className="text-sm font-bold">Total Sales</span>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(analyticsData.paymentMethodData.reduce((sum: number, item: any) => sum + item.value, 0))}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* Top Products */}
            {expandedMetric === 'products' && analyticsData?.topProducts && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-4">Top 5 Products by Revenue</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.topProducts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'revenue') return [formatCurrency(Number(value)), 'Revenue'];
                        return [value, 'Quantity'];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="quantity" fill="#F59E0B" name="Quantity Sold" />
                    <Bar dataKey="revenue" fill="#22C55E" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Top Customers */}
            {expandedMetric === 'customers' && analyticsData?.topCustomers && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-4">Top 5 Customers by Spending</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.topCustomers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'total') return [formatCurrency(Number(value)), 'Total Spent'];
                        return [value, 'Orders'];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="#3B82F6" name="Number of Orders" />
                    <Bar dataKey="total" fill="#8B5CF6" name="Total Spent" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
