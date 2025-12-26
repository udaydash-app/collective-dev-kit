import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePOSTransaction } from '@/hooks/usePOSTransaction';
import { barcodeCache } from '@/hooks/useBarcodeCache';
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
  Smartphone,
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
  Banknote,
  Factory,
  ScanBarcode as BarcodeIcon
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
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import { TransactionCart } from '@/components/pos/TransactionCart';
import { AssignBarcodeDialog } from '@/components/pos/AssignBarcodeDialog';
import { RefundDialog } from '@/components/pos/RefundDialog';
import { CustomPriceDialog } from '@/components/pos/CustomPriceDialog';
import { JournalEntryViewDialog } from '@/components/pos/JournalEntryViewDialog';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { qzTrayService } from "@/lib/qzTray";
import { kioskPrintService } from "@/lib/kioskPrint";
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
import { ProductSearch, ProductSearchRef } from '@/components/pos/ProductSearch';
import { Label } from '@/components/ui/label';
import { UpdateButton } from '@/components/UpdateButton';
import { APP_VERSION } from '@/config/version';
import { useKeyboardShortcuts, KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { KeyboardBadge } from '@/components/ui/keyboard-badge';
import { QuickPaymentDialog } from '@/components/pos/QuickPaymentDialog';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { shouldUseLocalData, isLocalSupabase, shouldQuerySupabase, checkLocalSupabaseReachable } from '@/lib/localModeHelper';

export default function POS() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});
  const [prevCustomerId, setPrevCustomerId] = useState<string | null>(null);
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false);
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<string>('');
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
  const productSearchRef = useRef<ProductSearchRef>(null);
  const [showLastReceiptOptions, setShowLastReceiptOptions] = useState(false);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [keypadMode, setKeypadMode] = useState<'qty' | 'discount' | 'price' | 'cartDiscount' | null>(null);
  const [keypadInput, setKeypadInput] = useState<string>('');
  const keypadInputRef = useRef<string>(''); // Persist across re-renders
  const [keypadRenderKey, setKeypadRenderKey] = useState(0); // Force re-render when input changes
  const [isPercentMode, setIsPercentMode] = useState<boolean>(false);
  const [cartDiscountItem, setCartDiscountItem] = useState<any>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderType, setEditingOrderType] = useState<'pos' | 'online' | null>(null);
  const [assignBarcodeOpen, setAssignBarcodeOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [showRefund, setShowRefund] = useState(false);
  const [isWholesaleMode, setIsWholesaleMode] = useState(false);
  const [originalRetailPrices, setOriginalRetailPrices] = useState<Map<string, number>>(new Map());
  const [journalEntryDialogOpen, setJournalEntryDialogOpen] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<any>(null);
  
  // Cart resize and drag state
  const [cartWidth, setCartWidth] = useState(() => {
    const saved = localStorage.getItem('pos-cart-width');
    return saved ? parseInt(saved) : 700;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cartPosition, setCartPosition] = useState(() => {
    const saved = localStorage.getItem('pos-cart-position');
    return saved ? JSON.parse(saved) : null;
  });
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  
  // Track processed customer IDs to prevent re-selecting
  const processedCustomerIdRef = useRef<string | null>(null);
  const processedProductIdRef = useRef<string | null>(null);
  
  const ITEMS_PER_PAGE = 12;

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
    updateItemDisplayName,
    clearCart,
    loadCart,
    calculateSubtotal,
    calculateTimbre,
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
      // Set flag to indicate we're loading an online order
      setIsLoadingTransaction(true);
      
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
        console.error('Order not found');
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
      
      // Set editing info to track it's an online order
      setEditingOrderId(orderId);
      setEditingOrderType('online');

      // Add items to cart with correct quantities - load all at once to avoid race conditions
      if (items && items.length > 0) {
        const cartItems = items
          .filter(item => item.products)
          .map(item => ({
            id: item.products.id,
            productId: item.products.id,
            name: item.products.name,
            price: item.unit_price || item.products.price,
            quantity: item.quantity,
            image_url: item.products.image_url,
            barcode: item.products.barcode,
          }));
        
        // Load all items at once
        loadCart(cartItems);
        
        // Update order status to processing when loaded to POS
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'processing' })
          .eq('id', orderId);
          
        if (updateError) {
          console.error('Error updating order status:', updateError);
        } else {
          // Invalidate pending orders count query to refresh notifications
          queryClient.invalidateQueries({ queryKey: ['pending-orders-count'] });
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          toast.success('Order loaded to POS and marked as processing');
        }
        
        // Clear orderId from URL to prevent reloading on refresh
        navigate('/admin/pos', { replace: true });
        
        console.log(`Loaded order ${order.order_number} into POS and marked as processing`);
      }
    } catch (error: any) {
      console.error('Error loading order:', error);
      // Clear orderId from URL even on error
      navigate('/admin/pos', { replace: true });
    } finally {
      setIsLoadingOrder(false);
      setIsLoadingTransaction(false);
    }
  };

  const loadEditOrderToPOS = async (editOrderId: string) => {
    try {
      // Set flag to prevent price re-application
      setIsLoadingTransaction(true);
      
      // Get order data from localStorage
      const storedData = localStorage.getItem('pos-edit-order');
      if (!storedData) {
        console.error('Order data not found');
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
          
          // Create cart item with proper custom pricing and discounts
          cartItems.push({
            id: productId,
            productId: productId,
            name: item.name,
            displayName: item.display_name || item.displayName, // Map from DB or existing
            price: item.price,
            quantity: item.quantity || 1,
            barcode: item.barcode,
            customPrice: item.customPrice || null,
            itemDiscount: item.itemDiscount || 0,
          });
          
          console.log(`🔧 Item loaded with customPrice: ${item.customPrice}, itemDiscount: ${item.itemDiscount}`);
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
          } else if (customer) {
            setSelectedCustomer(customer);
            console.log(`🔧 Customer loaded: ${customer.name}`);
          } else {
            console.warn('🔧 Customer not found with ID:', orderData.customerId);
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
        
        console.log(`Loaded ${orderData.type === 'pos' ? 'sale' : 'order'} for editing`);
      }
    } catch (error: any) {
      console.error('Error loading order for editing:', error);
      navigate('/admin/pos', { replace: true });
    } finally {
      setIsLoadingOrder(false);
      // Clear loading flag after a delay to ensure customer price fetching is skipped
      setTimeout(() => setIsLoadingTransaction(false), 500);
    }
  };

  // Track offline/local mode status for queries
  // With local Supabase, check if it's actually reachable
  const localMode = isLocalSupabase();
  const [isOffline, setIsOffline] = useState(!shouldQuerySupabase());
  
  // On mount, check local Supabase reachability
  useEffect(() => {
    const checkReachability = async () => {
      if (localMode) {
        const reachable = await checkLocalSupabaseReachable();
        setIsOffline(!reachable);
      }
    };
    checkReachability();
  }, [localMode]);
  
  useEffect(() => {
    const updateQueryState = async () => {
      if (localMode) {
        const reachable = await checkLocalSupabaseReachable();
        setIsOffline(!reachable);
      } else {
        setIsOffline(!navigator.onLine);
      }
    };
    window.addEventListener('online', updateQueryState);
    window.addEventListener('offline', updateQueryState);
    return () => {
      window.removeEventListener('online', updateQueryState);
      window.removeEventListener('offline', updateQueryState);
    };
  }, [localMode]);

  const { data: stores } = useQuery({
    queryKey: ['stores', localMode ? 'local' : 'cloud'],
    queryFn: async () => {
      // Always try Supabase first (local or cloud) unless truly offline
      if (!isOffline) {
        try {
          const { data, error } = await supabase
            .from('stores')
            .select('id, name')
            .eq('is_active', true)
            .order('name');
          
          if (error) throw error;
          
          console.log(`[${localMode ? 'Local' : 'Cloud'} Supabase] Stores: ${data?.length || 0}`);
          return data || [];
        } catch (error) {
          console.error('[POS] Supabase stores error, falling back to IndexedDB:', error);
        }
      }
      
      // Fallback to IndexedDB
      try {
        const { offlineDB } = await import('@/lib/offlineDB');
        const offlineStores = await offlineDB.getStores();
        console.log('[POS] IndexedDB stores:', offlineStores.length);
        return offlineStores;
      } catch (e) {
        console.error('[POS] IndexedDB stores error:', e);
        return [];
      }
    },
    staleTime: localMode ? 10 * 1000 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: !localMode,
    refetchOnMount: true,
  });

  // Fetch company settings for receipt
  const { data: settings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      if (isOffline) return null;
      const { data } = await supabase
        .from('settings')
        .select('logo_url, company_phone, company_name')
        .single();
      return data;
    },
    enabled: !isOffline,
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

  // Check for active cash session (skip if offline - use stored session)
  const { data: activeCashSession, refetch: refetchCashSession, isLoading: isLoadingCashSession } = useQuery({
    queryKey: ['active-cash-session', selectedStoreId, isOffline],
    queryFn: async () => {
      if (!selectedStoreId) return null;
      
      // If in local/offline mode, check IndexedDB first for cash sessions
      if (isOffline) {
        try {
          const { offlineDB } = await import('@/lib/offlineDB');
          const sessions = await offlineDB.getCashSessions();
          const offlineSession = localStorage.getItem('offline_pos_session');
          const sessionData = offlineSession ? JSON.parse(offlineSession) : null;
          
          // Find an open session for this store and user
          const activeSession = sessions.find(s => 
            s.store_id === selectedStoreId && 
            s.status === 'open' &&
            (sessionData ? s.cashier_id === sessionData.pos_user_id : true)
          );
          
          if (activeSession) {
            console.log('[POS] Found active cash session in IndexedDB:', activeSession);
            return activeSession;
          }
          
          // If no session found in IndexedDB, create a mock from localStorage
          if (sessionData) {
            return {
              id: sessionData.cash_session_id || 'offline-session',
              store_id: selectedStoreId,
              cashier_id: sessionData.pos_user_id,
              status: 'open',
              opening_cash: 0,
              opened_at: sessionData.timestamp,
            };
          }
          return null;
        } catch (e) {
          console.error('[POS] Error fetching offline cash session:', e);
          return null;
        }
      }
      
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
    staleTime: isOffline ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !isOffline,
  });

  // Fetch pending orders count with real-time updates (only when online)
  const { data: pendingOrdersCount = 0 } = useQuery({
    queryKey: ['pending-orders-count'],
    queryFn: async () => {
      if (isOffline) return 0;
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
    enabled: !isOffline,
  });

  // Subscribe to real-time updates for pending orders (only when online)
  useEffect(() => {
    if (isOffline) return;
    
    const channel = supabase
      .channel('pending-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          // Invalidate query when any order changes
          queryClient.invalidateQueries({ queryKey: ['pending-orders-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, isOffline]);

  // Focus product search on Esc key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        productSearchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch all cash sessions for today to calculate total opening cash (only when online)
  const { data: todayCashSessions } = useQuery({
    queryKey: ['today-cash-sessions', selectedStoreId, currentCashSession?.opened_at],
    queryFn: async () => {
      if (!selectedStoreId || !currentCashSession || isOffline) return [];
      
      const { data } = await supabase
        .from('cash_sessions')
        .select('opening_cash')
        .eq('store_id', selectedStoreId)
        .gte('opened_at', currentCashSession.opened_at);
      
      return data || [];
    },
    enabled: !!selectedStoreId && !!currentCashSession && !isOffline,
  });

  // Calculate total opening cash from all users
  const totalOpeningCash = todayCashSessions?.reduce((sum, session) => {
    return sum + parseFloat(session.opening_cash?.toString() || '0');
  }, 0) || 0;

  // Show cash in dialog if no active session (don't show when offline if we have an offline session)
  useEffect(() => {
    if (isOffline) {
      // When offline, use the offline session as the cash session
      const offlineSession = localStorage.getItem('offline_pos_session');
      if (offlineSession) {
        setCurrentCashSession(activeCashSession);
      }
      return;
    }
    
    if (selectedStoreId && !isLoadingCashSession && !activeCashSession && !showCashIn) {
      setShowCashIn(true);
    }
    setCurrentCashSession(activeCashSession);
  }, [activeCashSession, selectedStoreId, isLoadingCashSession, isOffline]);

  // Get all transactions for today from all users
  const { data: sessionTransactions } = useQuery({
    queryKey: ['today-all-transactions', selectedStoreId, currentCashSession?.opened_at, isOffline ? 'local' : 'online'],
    queryFn: async () => {
      if (!currentCashSession) return [];

      // Use IndexedDB in local mode
      if (isOffline) {
        try {
          const { offlineDB } = await import('@/lib/offlineDB');
          const transactions = await offlineDB.getPOSTransactions();
          const sessionStart = new Date(currentCashSession.opened_at).getTime();
          return transactions
            .filter(t => t.store_id === currentCashSession.store_id && new Date(t.created_at).getTime() >= sessionStart)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } catch (e) {
          console.error('[POS] Error fetching offline transactions:', e);
          return [];
        }
      }

      const { data } = await supabase
        .from('pos_transactions')
        .select('id, total, payment_method, payment_details, created_at, transaction_number, customer_id, contacts:customer_id(name)')
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at)
        .order('created_at', { ascending: false });

      return (data || []).map(t => ({
        ...t,
        customer_name: t.contacts?.name || null
      }));
    },
    enabled: !!currentCashSession,
    staleTime: isOffline ? Infinity : 30 * 1000,
  });

  // Get day's purchases from all users
  const { data: dayPurchases } = useQuery({
    queryKey: ['today-all-purchases', selectedStoreId, currentCashSession?.opened_at],
    queryFn: async () => {
      if (!currentCashSession) return [];

      // Use IndexedDB in local mode
      if (isOffline) {
        try {
          const { offlineDB } = await import('@/lib/offlineDB');
          const purchases = await offlineDB.getPurchases();
          const sessionStart = new Date(currentCashSession.opened_at).getTime();
          return purchases
            .filter(p => p.store_id === currentCashSession.store_id && new Date(p.purchased_at).getTime() >= sessionStart)
            .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());
        } catch (e) {
          console.error('[POS] Error fetching offline purchases:', e);
          return [];
        }
      }

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
    staleTime: isOffline ? Infinity : 30 * 1000,
  });

  // Get day's expenses from all users
  const { data: dayExpenses } = useQuery({
    queryKey: ['today-all-expenses', selectedStoreId, currentCashSession?.opened_at, isOffline ? 'local' : 'online'],
    queryFn: async () => {
      if (!currentCashSession) return [];

      // Use IndexedDB in local mode
      if (isOffline) {
        try {
          const { offlineDB } = await import('@/lib/offlineDB');
          const expenses = await offlineDB.getExpenses();
          const sessionStart = new Date(currentCashSession.opened_at).getTime();
          return expenses
            .filter(e => e.store_id === currentCashSession.store_id && new Date(e.created_at).getTime() >= sessionStart)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } catch (e) {
          console.error('[POS] Error fetching offline expenses:', e);
          return [];
        }
      }

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
    staleTime: isOffline ? Infinity : 30 * 1000,
  });

  // Get top credit customers with outstanding balances - optimized single query
  const { data: topCreditCustomers, isLoading: creditCustomersLoading } = useQuery({
    queryKey: ['top-credit-customers', selectedStoreId, isOffline ? 'local' : 'online'],
    queryFn: async () => {
      if (!selectedStoreId) return [];

      // Skip in offline mode - no RPC available
      if (isOffline) {
        try {
          const { offlineDB } = await import('@/lib/offlineDB');
          const contacts = await offlineDB.getContacts();
          // Filter to customers with outstanding balance
          return contacts
            .filter(c => c.is_customer && (c.opening_balance || 0) > 0)
            .sort((a, b) => (b.opening_balance || 0) - (a.opening_balance || 0))
            .slice(0, 10);
        } catch (e) {
          console.error('[POS] Error fetching offline credit customers:', e);
          return [];
        }
      }

      // Try optimized database function first, fallback to direct query for local Supabase
      const { data, error } = await supabase
        .rpc('get_top_credit_customers', { limit_count: 10 });

      if (error) {
        // Fallback to direct query if RPC function doesn't exist (local Supabase)
        if (error.code === 'PGRST202') {
          const { data: contacts, error: contactsError } = await supabase
            .from('contacts')
            .select('id, name, email, phone, opening_balance, credit_limit')
            .eq('is_customer', true)
            .gt('opening_balance', 0)
            .order('opening_balance', { ascending: false })
            .limit(10);
          
          if (contactsError) {
            console.error('Error fetching credit customers fallback:', contactsError);
            return [];
          }
          return contacts || [];
        }
        console.error('Error fetching top credit customers:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!selectedStoreId,
    staleTime: isOffline ? Infinity : 5 * 60 * 1000,
  });

  // Calculate day activity - parse payment_details for multiple payment support
  const dayActivity = {
    cashSales: sessionTransactions?.reduce((sum, t) => {
      const paymentDetails = t.payment_details as Array<{ method: string; amount: number }> | null;
      if (paymentDetails && Array.isArray(paymentDetails)) {
        return sum + paymentDetails.filter(p => p.method === 'cash').reduce((pSum, p) => pSum + (p.amount || 0), 0);
      }
      return t.payment_method === 'cash' ? sum + parseFloat(t.total.toString()) : sum;
    }, 0) || 0,
    creditSales: sessionTransactions?.reduce((sum, t) => {
      const paymentDetails = t.payment_details as Array<{ method: string; amount: number }> | null;
      if (paymentDetails && Array.isArray(paymentDetails)) {
        return sum + paymentDetails.filter(p => p.method === 'credit').reduce((pSum, p) => pSum + (p.amount || 0), 0);
      }
      return t.payment_method === 'credit' ? sum + parseFloat(t.total.toString()) : sum;
    }, 0) || 0,
    mobileMoneySales: sessionTransactions?.reduce((sum, t) => {
      const paymentDetails = t.payment_details as Array<{ method: string; amount: number }> | null;
      if (paymentDetails && Array.isArray(paymentDetails)) {
        return sum + paymentDetails.filter(p => p.method === 'mobile_money').reduce((pSum, p) => pSum + (p.amount || 0), 0);
      }
      return t.payment_method === 'mobile_money' ? sum + parseFloat(t.total.toString()) : sum;
    }, 0) || 0,
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
        .select(`
          id,
          amount,
          payment_method,
          created_at,
          contacts!supplier_payments_contact_id_fkey(name)
        `)
        .eq('store_id', currentCashSession.store_id)
        .gte('created_at', currentCashSession.opened_at);
      
      if (error) throw error;
      
      // Transform data to include contact_name
      return (data || []).map(payment => ({
        ...payment,
        contact_name: payment.contacts?.name
      }));
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
  const { data: cashJournalEntries, isLoading: cashJournalLoading, error: cashJournalError } = useQuery({
    queryKey: ['session-cash-journal-entries-v3', selectedStoreId, currentCashSession?.opened_at, currentCashSession?.closed_at],
    queryFn: async () => {
      if (!currentCashSession) {
        return [];
      }
      
      // Get cash account ID - SYSCOHADA code 571 (Caisse)
      const { data: cashAccounts, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('account_code', '571')
        .eq('is_active', true)
        .limit(1);
      
      if (accountError) {
        console.error('Error fetching cash account:', accountError);
        return [];
      }
      
      const cashAccount = cashAccounts?.[0];
      if (!cashAccount) {
        console.warn('No active cash account (571 - Caisse) found');
        return [];
      }
      
      // Get the session timestamp range
      const sessionStart = currentCashSession.opened_at;
      const sessionEnd = currentCashSession.closed_at || new Date().toISOString();

      // Get journal entry lines for cash account from posted entries created during the session
      // Include only truly manual journal entries by excluding system-generated prefixes
      const { data, error: queryError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entries!inner(status, entry_date, created_at, reference, description)
        `)
        .eq('account_id', cashAccount.id)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.created_at', sessionStart)
        .lte('journal_entries.created_at', sessionEnd)
        .order('created_at', { foreignTable: 'journal_entries', ascending: true });
      
      // Filter out system-generated entries client-side
      const filteredData = data?.filter(entry => {
        const ref = entry.journal_entries.reference || '';
        return !ref.startsWith('POS-') && 
               !ref.startsWith('PUR-') && 
               !ref.startsWith('SPM-') && 
               !ref.startsWith('PMT-') &&
               !ref.startsWith('OB-') &&
               !ref.startsWith('CASHREG-') &&
               !ref.startsWith('CAISSE-') &&  // Cash register opening entries
               !ref.startsWith('CASHCLOSE-') &&  // Cash register closing entries
               !ref.endsWith('-PMT');
      });
      
      return filteredData || [];
    },
    enabled: !!currentCashSession,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Fetch ALL journal entries for display (including payment receipts) - separate from calculation entries
  const { data: displayJournalEntries, isLoading: displayJournalLoading } = useQuery({
    queryKey: ['session-display-journal-entries-v3', selectedStoreId, currentCashSession?.opened_at, currentCashSession?.closed_at],
    queryFn: async () => {
      if (!currentCashSession) {
        return [];
      }
      
      // Get the session timestamp range
      const sessionStart = currentCashSession.opened_at;
      const sessionEnd = currentCashSession.closed_at || new Date().toISOString();

      // Get ALL journal entries (including credit sales) created during the session
      // Exclude cash register opening entries
      const { data, error: queryError } = await supabase
        .from('journal_entries')
        .select(`
          id,
          reference,
          description,
          entry_date,
          created_at,
          total_debit,
          total_credit,
          status
        `)
        .eq('status', 'posted')
        .gte('created_at', sessionStart)
        .lte('created_at', sessionEnd)
        .not('reference', 'ilike', 'CASHREG%')
        .order('created_at', { ascending: false });
      
      console.log('Display journal entries query result:', { 
        data, 
        error: queryError, 
        sessionStart, 
        sessionEnd
      });
      
      return data || [];
    },
    enabled: !!currentCashSession,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Fetch mobile money journal entries for the entire session period
  const { data: mobileMoneyJournalEntries } = useQuery({
    queryKey: ['session-mobile-money-journal-entries-v3', selectedStoreId, currentCashSession?.opened_at, currentCashSession?.closed_at],
    queryFn: async () => {
      if (!currentCashSession) {
        return [];
      }
      
      // Get mobile money account ID - SYSCOHADA code 521 (Banque Mobile Money)
      const { data: mobileMoneyAccounts, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('account_code', '521')
        .eq('is_active', true)
        .limit(1);
      
      if (accountError) {
        console.error('Error fetching mobile money account:', accountError);
        return [];
      }
      
      const mobileMoneyAccount = mobileMoneyAccounts?.[0];
      if (!mobileMoneyAccount) {
        console.warn('No active mobile money account (521 - Banque Mobile Money) found');
        return [];
      }
      
      // Get the session timestamp range
      const sessionStart = currentCashSession.opened_at;
      const sessionEnd = currentCashSession.closed_at || new Date().toISOString();
      
      // Get journal entry lines for mobile money account from posted entries created during the session
      // Include only truly manual journal entries by excluding system-generated prefixes
      const { data, error: queryError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit_amount,
          credit_amount,
          journal_entries!inner(status, entry_date, created_at, reference, description)
        `)
        .eq('account_id', mobileMoneyAccount.id)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.created_at', sessionStart)
        .lte('journal_entries.created_at', sessionEnd)
        .order('created_at', { foreignTable: 'journal_entries', ascending: true });
      
      // Filter out system-generated entries client-side
      const filteredData = data?.filter(entry => {
        const ref = entry.journal_entries.reference || '';
        return !ref.startsWith('POS-') && 
               !ref.startsWith('PUR-') && 
               !ref.startsWith('SPM-') && 
               !ref.startsWith('PMT-') &&
               !ref.startsWith('OB-') &&
               !ref.startsWith('CASHREG-') &&
               !ref.endsWith('-PMT');
      });
      
      return filteredData || [];
    },
    enabled: !!currentCashSession,
    refetchOnMount: 'always',
    staleTime: 0
  });

  // Real-time subscription for journal entries
  useEffect(() => {
    if (!currentCashSession) return;

    const channel = supabase
      .channel('journal-entries-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'journal_entries'
        },
        () => {
          // Refetch all journal entry queries when new entries are created
          queryClient.invalidateQueries({ queryKey: ['session-display-journal-entries'] });
          queryClient.invalidateQueries({ queryKey: ['session-cash-journal-entries'] });
          queryClient.invalidateQueries({ queryKey: ['session-mobile-money-journal-entries-v2'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCashSession, queryClient]);

  // Debug logging for journal entries
  useEffect(() => {
    console.log('Display journal entries updated:', {
      count: displayJournalEntries?.length || 0,
      loading: displayJournalLoading,
      entries: displayJournalEntries
    });
  }, [displayJournalEntries, displayJournalLoading]);

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
  // Use current session's opening cash, not totalOpeningCash from all sessions
  const currentSessionOpeningCash = currentCashSession 
    ? parseFloat(currentCashSession.opening_cash?.toString() || '0') 
    : 0;
  
  const expectedCashAtClose = currentCashSession 
    ? currentSessionOpeningCash + 
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
      // Try online first
      if (navigator.onLine) {
        try {
          const { data } = await supabase
            .from('categories')
            .select('id, name, image_url, icon')
            .eq('is_active', true)
            .order('display_order');
          return data || [];
        } catch (error) {
          console.error('Failed to fetch categories:', error);
          return [];
        }
      }
      return [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['pos-customers', customerSearch, isOffline ? 'local' : 'online'],
    queryFn: async () => {
      // Use IndexedDB in local mode
      if (isOffline) {
        try {
          const { offlineDB } = await import('@/lib/offlineDB');
          const contacts = await offlineDB.getContacts();
          let result = contacts.filter(c => c.is_customer);
          
          if (customerSearch && customerSearch.length >= 2) {
            const search = customerSearch.toLowerCase();
            result = result.filter(c => 
              c.name?.toLowerCase().includes(search) ||
              c.phone?.toLowerCase().includes(search) ||
              c.email?.toLowerCase().includes(search)
            );
          }
          
          return result.slice(0, 50);
        } catch (e) {
          console.error('[POS] Error fetching offline customers:', e);
          return [];
        }
      }
      
      // Online mode
      try {
        let query = supabase
          .from('contacts')
          .select('*')
          .eq('is_customer', true)
          .order('name');
        
        if (customerSearch && customerSearch.length >= 2) {
          query = query.or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`);
        }
        
        const { data } = await query.limit(50);
        return data || [];
      } catch (error) {
        console.error('Failed to fetch customers:', error);
        return [];
      }
    },
    staleTime: isOffline ? Infinity : 30 * 1000,
  });

  const { data: products } = useQuery({
    queryKey: ['pos-products', searchTerm, selectedCategory],
    queryFn: async () => {
      // Try online first
      if (navigator.onLine) {
        try {
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
        } catch (error) {
          console.error('Failed to fetch products:', error);
          return [];
        }
      }
      return [];
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

      console.log('Cash register opened successfully');
      setShowCashIn(false);
      await refetchCashSession();
    } catch (error: any) {
      console.error('Error opening cash register:', error);
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

      // Use current session's opening cash, not totalOpeningCash from all sessions
      const sessionOpeningCash = parseFloat(currentCashSession.opening_cash?.toString() || '0');
      
      const expectedCash = sessionOpeningCash + 
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

      // Create journal entry for cash register closing
      // Debit: Owner account (cash returned to owner)
      // Credit: Cash account (cash removed from register)
      if (closingCash > 0) {
        try {
          const cashAccountCode = '571';  // Caisse SYSCOHADA
          const ownerAccountCode = '109';  // Compte de l'exploitant SYSCOHADA
          
          // Get account IDs
          const { data: accounts } = await supabase
            .from('accounts')
            .select('id, account_code')
            .in('account_code', [cashAccountCode, ownerAccountCode]);
          
          const cashAccount = accounts?.find(a => a.account_code === cashAccountCode);
          const ownerAccount = accounts?.find(a => a.account_code === ownerAccountCode);
          
          if (cashAccount && ownerAccount) {
            // Create journal entry
            const { data: journalEntry, error: jeError } = await supabase
              .from('journal_entries')
              .insert({
                description: 'Cash Register Closing - Session ' + currentCashSession.id,
                entry_date: new Date().toISOString().split('T')[0],
                reference: 'CASHCLOSE-' + currentCashSession.id.substring(0, 10).toUpperCase().replace(/-/g, ''),
                total_debit: closingCash,
                total_credit: closingCash,
                status: 'posted',
                posted_at: new Date().toISOString(),
              })
              .select()
              .single();
            
            if (!jeError && journalEntry) {
              // Insert journal entry lines
              await supabase.from('journal_entry_lines').insert([
                {
                  journal_entry_id: journalEntry.id,
                  account_id: ownerAccount.id,
                  description: 'Cash returned to owner from register closing',
                  debit_amount: closingCash,
                  credit_amount: 0,
                },
                {
                  journal_entry_id: journalEntry.id,
                  account_id: cashAccount.id,
                  description: 'Cash removed from register',
                  debit_amount: 0,
                  credit_amount: closingCash,
                },
              ]);
              console.log('Journal entry created for cash register closing');
            }
          }
        } catch (jeError) {
          console.error('Error creating journal entry for cash closing:', jeError);
          // Don't fail the cash session close if journal entry fails
        }
      }

      console.log('Cash register closed successfully');
      setCurrentCashSession(null);
      clearCart();
      await refetchCashSession();
    } catch (error: any) {
      console.error('Error closing cash register:', error);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    // Check cache first for instant response
    const cached = barcodeCache.get(barcode);
    if (cached) {
      if (cached.type === 'variant') {
        addToCartWithCustomPrice(cached.data);
      } else {
        const availableVariants = cached.data.product_variants?.filter((v: any) => v.is_available) || [];
        if (availableVariants.length > 0) {
          const variantToAdd = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
          addToCartWithCustomPrice({ ...cached.data, price: variantToAdd.price, selectedVariant: variantToAdd });
        } else {
          addToCartWithCustomPrice(cached.data);
        }
      }
      return;
    }

    // Query variant and product barcode in PARALLEL for maximum speed
    const [variantResult, productResult] = await Promise.all([
      supabase
        .from('product_variants')
        .select(`
          id, label, quantity, unit, price, is_available, is_default, barcode, product_id,
          products (id, name, barcode, image_url, is_available)
        `)
        .eq('barcode', barcode)
        .eq('is_available', true)
        .limit(1)
        .single(),
      supabase
        .from('products')
        .select(`
          *, product_variants (id, label, quantity, unit, price, is_available, is_default, barcode)
        `)
        .eq('barcode', barcode)
        .eq('is_available', true)
        .limit(1)
        .single()
    ]);

    // Check variant first (priority)
    if (variantResult.data?.products) {
      const productToAdd = {
        ...variantResult.data.products,
        price: variantResult.data.price,
        selectedVariant: variantResult.data,
      };
      // Cache for future scans
      barcodeCache.set(barcode, 'variant', productToAdd);
      addToCartWithCustomPrice(productToAdd);
      return;
    }

    // Then check product
    if (productResult.data) {
      // Cache for future scans
      barcodeCache.set(barcode, 'product', productResult.data);
      const availableVariants = productResult.data.product_variants?.filter((v: any) => v.is_available) || [];
      if (availableVariants.length > 0) {
        const variantToAdd = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
        addToCartWithCustomPrice({ ...productResult.data, price: variantToAdd.price, selectedVariant: variantToAdd });
      } else {
        addToCartWithCustomPrice(productResult.data);
      }
      return;
    }

    // Not found - open assign dialog
    setScannedBarcode(barcode);
    setAssignBarcodeOpen(true);
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
    // Get base product ID (in case product has variants, we still use base ID for custom pricing)
    const baseProductId = product.id;
    
    console.log('🛒 addToCartWithCustomPrice called');
    console.log('🛒 Product:', { id: baseProductId, name: product.name, price: product.price });
    console.log('🛒 Selected customer:', selectedCustomer?.name || 'None');
    console.log('🛒 Available custom prices:', customerPrices);
    
    // Check if customer is selected and has custom price for this product
    const customPrice = selectedCustomer ? customerPrices[baseProductId] : null;
    
    console.log('🔍 Custom price lookup:', {
      baseProductId,
      productName: product.name,
      retailPrice: product.price,
      customPrice,
      hasCustomer: !!selectedCustomer,
      customerPricesKeys: Object.keys(customerPrices)
    });
    
    if (customPrice && customPrice < product.price) {
      // Calculate discount as difference between retail and custom price
      const discount = product.price - customPrice;
      
      console.log('✅ Applying custom price discount:', discount);
      
      // Add product with discount already applied
      await addToCart({
        ...product,
        itemDiscount: discount
      });
    } else {
      console.log('❌ No custom price or custom price not lower, adding normally');
      // No custom price, add normally
      await addToCart(product);
    }
  };

  // Fetch customer prices when customer is selected
  useEffect(() => {
    const fetchCustomerPrices = async () => {
      // Detect customer change (including removal)
      const currentCustomerId = selectedCustomer?.id || null;
      const customerChanged = currentCustomerId !== prevCustomerId;
      
      // Only proceed if customer actually changed
      if (!customerChanged) return;
      
      setPrevCustomerId(currentCustomerId);
      
      // Don't reset or apply prices when loading an existing transaction
      if (isLoadingTransaction) {
        console.log('⏭️ Skipping price application - loading existing transaction');
        return;
      }
      
      // Reset all cart items to retail price when customer changes
      cart.forEach((item) => {
        if (item.itemDiscount && item.itemDiscount > 0) {
          updateItemDiscount(item.id, 0);
        }
      });

      // If customer removed, clear prices and exit
      if (!selectedCustomer) {
        setCustomerPrices({});
        console.log('Customer removed - prices reset to retail');
        return;
      }

      // Fetch custom prices for the new customer
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

        console.log('📦 Fetched custom prices for customer:', selectedCustomer.name);
        console.log('📦 Prices map:', pricesMap);
        console.log('📦 Product IDs with custom prices:', Object.keys(pricesMap));
        
        setCustomerPrices(pricesMap);
        
        // Apply custom prices to existing cart items
        if (Object.keys(pricesMap).length > 0 && cart.length > 0) {
          let appliedCount = 0;
          
          // Small delay to ensure cart is updated
          setTimeout(() => {
            cart.forEach((cartItem) => {
              // Skip items that already have custom prices or discounts
              if (cartItem.customPrice || (cartItem.itemDiscount && cartItem.itemDiscount > 0)) {
                console.log('⏭️ Skipping item - already has custom price/discount:', cartItem.id);
                return;
              }
              
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
                updateItemDiscount(cartItem.id, discount, false); // false = not manual
                appliedCount++;
                console.log('✅ Applied discount:', discount, 'to item:', cartItem.id);
              }
            });
            
            if (appliedCount > 0) {
              console.log(`Custom prices applied to ${appliedCount} items for ${selectedCustomer.name}`);
            } else {
              console.log(`No custom prices available for current cart items`);
            }
          }, 100);
        } else if (Object.keys(pricesMap).length === 0) {
          console.log(`No custom prices set for ${selectedCustomer.name}`);
        }
      } catch (error) {
        console.error('Error fetching customer prices:', error);
      }
    };

    fetchCustomerPrices();
  }, [selectedCustomer?.id, isLoadingTransaction]);

  // Auto-select newly created customer from Contacts page
  useEffect(() => {
    const newCustomerId = location.state?.newCustomerId;
    if (newCustomerId && newCustomerId !== processedCustomerIdRef.current) {
      processedCustomerIdRef.current = newCustomerId;
      
      // Fetch the new customer details
      const fetchNewCustomer = async () => {
        try {
          const { data: customer, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', newCustomerId)
            .single();
          
          if (error) throw error;
          
          if (customer) {
            setSelectedCustomer(customer);
            setShowCustomerDialog(false);
            console.log(`Customer "${customer.name}" selected`);
          }
        } catch (error) {
          console.error('Error fetching new customer:', error);
        }
      };
      
      fetchNewCustomer();
    }
  }, [location.state?.newCustomerId]);
  
  // Auto-add newly created product from Products page
  useEffect(() => {
    const newProductId = location.state?.newProductId;
    if (newProductId && newProductId !== processedProductIdRef.current) {
      processedProductIdRef.current = newProductId;
      
      // Fetch and add the new product to cart
      const fetchAndAddProduct = async () => {
        try {
          const { data: product, error } = await supabase
            .from('products')
            .select(`
              id,
              name,
              price,
              unit,
              barcode,
              image_url,
              product_variants (
                id,
                label,
                price,
                unit,
                is_available,
                is_default,
                barcode
              )
            `)
            .eq('id', newProductId)
            .single();
          
          if (error) throw error;
          
          if (product) {
            // Check if product has variants
            const availableVariants = product.product_variants?.filter((v: any) => v.is_available) || [];
            
            if (availableVariants.length > 0) {
              // Product has variants, find default or first available
              const defaultVariant = availableVariants.find((v: any) => v.is_default) || availableVariants[0];
              
              // Add variant to cart
              const productToAdd = {
                ...product,
                selectedVariant: defaultVariant,
              };
              addToCartWithCustomPrice(productToAdd);
            } else {
              // No variants, add product directly
              addToCartWithCustomPrice(product);
            }
            
            console.log(`Added "${product.name}" to cart`);
          }
        } catch (error) {
          console.error('Error fetching new product:', error);
        }
      };
      
      fetchAndAddProduct();
    }
  }, [location.state?.newProductId]);

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
  const timbreTax = calculateTimbre();
  const total = subtotal - cartDiscountAmount + timbreTax;

  // POS Keyboard Shortcuts
  const posShortcuts: KeyboardShortcut[] = [
    {
      key: 'F1',
      description: 'Cash In',
      action: () => setShowCashIn(true),
    },
    {
      key: 'F2',
      description: 'Cash Payment (Print)',
      action: async () => {
        if (cart.length === 0) {
          return;
        }
        
        // Directly process cash payment and print
        const total = calculateTotal();
        const payment = {
          id: '1',
          method: 'cash',
          amount: total
        };
        
        const transactionData = await handlePaymentConfirm([payment], total);
        
        // Automatic printing disabled - use "Last Receipt" button to print
        console.log('Cash payment completed:', transactionData?.transactionNumber);
      },
    },
    {
      key: 'F3',
      description: 'Credit Payment (Print)',
      action: async () => {
        if (cart.length === 0) {
          return;
        }
        if (!selectedCustomer) {
          return;
        }
        
        // Directly process credit payment and print
        const total = calculateTotal();
        const payment = {
          id: '1',
          method: 'credit',
          amount: total
        };
        
        const transactionData = await handlePaymentConfirm([payment], total);
        
        // Automatic printing disabled - use "Last Receipt" button to print
        console.log('Credit payment completed:', transactionData?.transactionNumber);
      },
    },
    {
      key: 'F4',
      description: 'Mobile Money Payment (Print)',
      action: async () => {
        if (cart.length === 0) {
          return;
        }
        
        // Directly process mobile money payment and print
        const total = calculateTotal();
        const payment = {
          id: '1',
          method: 'mobile_money',
          amount: total
        };
        
        const transactionData = await handlePaymentConfirm([payment], total);
        
        // Automatic printing disabled - use "Last Receipt" button to print
        console.log('Mobile Money payment completed:', transactionData?.transactionNumber);
      },
    },
    {
      key: 'F5',
      description: 'Hold Ticket',
      action: () => {
        if (cart.length > 0) {
          setShowHoldTicket(true);
        } else {
          return;
        }
      },
    },
    {
      key: 'F6',
      description: 'Recall Held Ticket',
      action: () => {
        if (heldTickets.length > 0) {
          setShowHoldTicket(true);
        }
      },
    },
    {
      key: 'F9',
      description: 'Process Payment',
      action: () => {
        if (cart.length > 0) {
          handleCheckout();
        }
      },
    },
    {
      key: 'F12',
      description: 'Clear Cart',
      action: () => {
        if (cart.length > 0) {
          const confirmed = window.confirm('Are you sure you want to clear the cart?');
          if (confirmed) {
            clearCart();
            setSelectedCustomer(null);
          }
        }
      },
    },
    {
      key: 'Escape',
      description: 'Close dialogs',
      action: () => {
        setShowPayment(false);
        setShowCashIn(false);
        setShowCashOut(false);
        setShowHoldTicket(false);
        setShowCustomerDialog(false);
        setShowRefund(false);
        setShowNotesDialog(false);
        setVariantSelectorOpen(false);
        setAssignBarcodeOpen(false);
        setShowCustomPriceConfirm(false);
        setShowQuickPayment(false);
      },
      preventDefault: false,
    },
  ];

  useKeyboardShortcuts({ 
    shortcuts: posShortcuts,
    enabled: !showPayment && !showNotesDialog // Disable when typing in modals
  });

  const handleCheckout = () => {
    if (!selectedStoreId) {
      return;
    }
    if (!currentCashSession) {
      return;
    }
    
    // Prepare transaction data BEFORE opening payment modal
    const allItems = cartDiscountItem ? [...cart, cartDiscountItem] : cart;
    const transactionDataPrep = {
      transactionNumber: 'Pending',
      items: allItems.map(item => ({
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        quantity: item.quantity,
        price: item.price, // Original price (can be negative for cart-discount)
        customPrice: item.customPrice, // Custom/modified price if any
        itemDiscount: item.itemDiscount || 0,
        isCombo: item.isCombo,
        comboItems: item.comboItems,
      })),
      subtotal: calculateSubtotal(),
      discount: cartDiscountAmount,
      tax: timbreTax,
      total: total,
      paymentMethod: "Pending",
      cashierName: currentCashSession?.cashier_name || "Cashier",
      storeName: stores?.find(s => s.id === selectedStoreId)?.name || settings?.company_name || "Global Market",
      logoUrl: settings?.logo_url,
      supportPhone: settings?.company_phone,
    };
    
    setLastTransactionData(transactionDataPrep);
    
    // Check if customer is selected and has items with manually changed prices
    if (selectedCustomer) {
      const itemsWithManualChanges = cart.filter(item => {
        // Only include items where price was MANUALLY changed by cashier
        return item.manualPriceChange === true && item.productId && 
               !item.id.startsWith('combo-') && 
               !item.id.startsWith('bogo-') && 
               !item.id.startsWith('multi-bogo-') && 
               item.id !== 'cart-discount';
      });
      
      if (itemsWithManualChanges.length > 0) {
        setShowCustomPriceConfirm(true);
        return;
      }
    }
    
    setShowPayment(true);
  };

  const handleSaveCustomerPrices = async (selectedProductIds: string[]) => {
    if (!selectedCustomer || selectedProductIds.length === 0) {
      setShowCustomPriceConfirm(false);
      setShowPayment(true);
      return;
    }
    
    try {
      // Get items with custom prices that were selected
      const itemsWithCustomPrices = cart.filter(item => 
        selectedProductIds.includes(item.productId) &&
        ((item.customPrice !== undefined && item.customPrice !== item.price) ||
        (item.itemDiscount !== undefined && item.itemDiscount > 0))
      );
      
      if (itemsWithCustomPrices.length === 0) {
        setShowCustomPriceConfirm(false);
        setShowPayment(true);
        return;
      }
      
      // Prepare prices to save
      const pricesToUpsert = itemsWithCustomPrices
        .filter(item => {
          // Exclude special items
          return item.productId && 
                 !item.id.startsWith('combo-') && 
                 !item.id.startsWith('bogo-') && 
                 !item.id.startsWith('multi-bogo-') &&
                 item.id !== 'cart-discount';
        })
        .map(item => {
          const effectivePrice = item.customPrice ?? (item.price - (item.itemDiscount || 0));
          return {
            customer_id: selectedCustomer.id,
            product_id: item.productId,
            price: effectivePrice,
          };
        });

      if (pricesToUpsert.length === 0) {
        console.log('No valid items to save');
        setShowCustomPriceConfirm(false);
        setShowPayment(true);
        return;
      }

      // Upsert selected prices
      const { error } = await supabase
        .from('customer_product_prices')
        .upsert(pricesToUpsert, {
          onConflict: 'customer_id,product_id'
        });

      if (error) throw error;
      
      // Update local price map
      const updatedPrices = { ...customerPrices };
      pricesToUpsert.forEach(item => {
        updatedPrices[item.product_id] = item.price;
      });
      setCustomerPrices(updatedPrices);
      
      console.log(`Custom prices saved for ${pricesToUpsert.length} product(s)`);
    } catch (error: any) {
      console.error('Error saving customer prices:', error);
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
    
    // Log editing state for debugging
    console.log('🔧 [PAYMENT] Starting payment with editing state:', {
      editingOrderId,
      editingOrderType,
      cartLength: cart.length
    });
    
    const transactionDataPrep = {
      items: allItems.map(item => ({
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        quantity: item.quantity,
        price: item.price, // Original price (can be negative for cart-discount)
        customPrice: item.customPrice, // Custom/modified price if any
        itemDiscount: item.itemDiscount || 0,
        isCombo: item.isCombo,
        comboItems: item.comboItems,
      })),
      subtotal: calculateSubtotal(),
      discount: cartDiscountAmount,
      tax: timbreTax,
      total: total,
      paymentMethod: payments.length > 1 ? "Multiple" : payments[0]?.method || "Cash",
      cashierName: currentCashSession?.cashier_name || "Cashier",
      customerName: selectedCustomer?.name,
      customerBalance: undefined, // Will be fetched after transaction for credit payments
      isUnifiedBalance: false,
      storeName: stores?.find(s => s.id === selectedStoreId)?.name || settings?.company_name || "Global Market",
      logoUrl: settings?.logo_url,
      supportPhone: settings?.company_phone,
    };
    
    // Pass cartDiscountItem as additionalItems to processTransaction
    // Add customer ID to notes for credit sales journal entry tracking
    const notesWithCustomer = selectedCustomer && payments.some(p => p.method === 'credit')
      ? `${orderNotes ? orderNotes + ' | ' : ''}customer:${selectedCustomer.id}`
      : orderNotes;
    
    console.log('🔧 [PAYMENT] Calling processTransaction with editing params:', {
      editingOrderId: editingOrderId || undefined,
      editingOrderType: editingOrderType || undefined
    });
    
    const result = await processTransaction(
      payments, 
      selectedStoreId, 
      selectedCustomer?.id, 
      notesWithCustomer,
      cartDiscountItem ? [cartDiscountItem] : undefined,
      cartDiscountAmount, // Pass the cart discount amount
      editingOrderId || undefined,
      editingOrderType || undefined
    );
    
    if (result) {
      console.log('🔧 [PAYMENT] Transaction result:', {
        hasResult: !!result,
        resultType: result ? typeof result : 'null',
        transactionNumber: 'transaction_number' in result ? result.transaction_number : 'unknown'
      });
      
      // Clear editing state (status update is handled in usePOSTransaction)
      if (editingOrderId) {
        console.log('🔧 [PAYMENT] Clearing editing state:', { editingOrderId, editingOrderType });
        setEditingOrderId(null);
        setEditingOrderType(null);
      }
      
      // Custom prices are handled by the confirmation dialog before payment
      // No automatic saving here to respect user's choice
      
      // Clear cart discount after successful transaction
      setCartDiscountItem(null);
      setDiscount(0);
      
      // Reset wholesale mode after transaction
      setIsWholesaleMode(false);
      setOriginalRetailPrices(new Map());
      
      // Reset customer selection to walk-in customer
      setSelectedCustomer(null);
      setCustomerPrices({});
      
      // Add transaction number to the prepared data and recalculate balance after transaction
      const transactionId = 'id' in result ? result.id : 'offline-' + Date.now();
      const transactionNumber = 'transaction_number' in result ? result.transaction_number : transactionId;
      
      // Only fetch balance if payment was on credit
      const hasCreditPayment = payments.some(p => p.method === 'credit');
      if (hasCreditPayment && selectedCustomer?.customer_ledger_account_id) {
        const isUnifiedBalance = selectedCustomer.is_supplier && selectedCustomer.is_customer;
        
        // Parallel fetch for dual-role customers
        if (isUnifiedBalance && selectedCustomer.supplier_ledger_account_id) {
          const [customerResult, supplierResult] = await Promise.all([
            supabase
              .from('accounts')
              .select('current_balance')
              .eq('id', selectedCustomer.customer_ledger_account_id)
              .single(),
            supabase
              .from('accounts')
              .select('current_balance')
              .eq('id', selectedCustomer.supplier_ledger_account_id)
              .single()
          ]);
          
          if (customerResult.data && supplierResult.data) {
            transactionDataPrep.customerBalance = customerResult.data.current_balance - supplierResult.data.current_balance;
            transactionDataPrep.isUnifiedBalance = true;
          }
        } else {
          // Single account fetch
          const { data: customerAccount } = await supabase
            .from('accounts')
            .select('current_balance')
            .eq('id', selectedCustomer.customer_ledger_account_id)
            .single();
          
          if (customerAccount) {
            transactionDataPrep.customerBalance = customerAccount.current_balance;
          }
        }
      }
      
      const completeTransactionData = {
        ...transactionDataPrep,
        transactionNumber,
        date: new Date(),
      };
      
      setLastTransactionData(completeTransactionData);

      // Optimized printing - no canvas generation, direct to browser print
      kioskPrintService.printReceipt({
        storeName: completeTransactionData.storeName,
        transactionNumber: completeTransactionData.transactionNumber,
        date: completeTransactionData.date,
        items: completeTransactionData.items.map(item => ({
          name: item.name,
          displayName: item.displayName,
          quantity: item.quantity,
          price: item.price,
          customPrice: item.customPrice,
          itemDiscount: item.itemDiscount,
        })),
        subtotal: completeTransactionData.subtotal,
        discount: completeTransactionData.discount,
        tax: completeTransactionData.tax,
        total: completeTransactionData.total,
        paymentMethod: completeTransactionData.paymentMethod,
        cashierName: completeTransactionData.cashierName,
        customerName: completeTransactionData.customerName,
        customerBalance: completeTransactionData.customerBalance,
        supportPhone: completeTransactionData.supportPhone,
        isUnifiedBalance: completeTransactionData.isUnifiedBalance,
      })
        .then(() => {
          console.log('✅ Receipt printed successfully');
        })
        .catch((error: any) => {
          console.error('❌ Print error:', error);
          console.error('Error message:', error?.message);
        });
      
      const displayNumber = 'transaction_number' in result ? result.transaction_number : transactionId.slice(0, 8);
      console.log(`Transaction ${displayNumber} processed successfully`);
      
      // Refetch journal entries to show the new transaction immediately
      queryClient.invalidateQueries({ queryKey: ['session-display-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['session-cash-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['session-mobile-money-journal-entries-v2'] });
      
      return completeTransactionData; // Return the transaction data
    }
    
    return null;
  };

  const handleQuickPayment = async (shouldPrint: boolean) => {
    if (!selectedStoreId) return;
    if (cart.length === 0) return;

    const payment = {
      id: '1',
      method: quickPaymentMethod,
      amount: total
    };

    const transactionData = await handlePaymentConfirm([payment], total);
    setShowQuickPayment(false);
    
    // If user wants to print and we have transaction data, print the receipt
    if (shouldPrint && transactionData) {
      // Wait a moment for the receipt to be ready
      setTimeout(() => {
        handlePrintLastReceipt();
      }, 300);
    }
  };

  // Toggle wholesale prices for all cart items
  const handleToggleWholesale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (isWholesaleMode) {
      // Revert to retail prices
      const updatedCart = cart.map(item => {
        const originalPrice = originalRetailPrices.get(item.id);
        if (originalPrice !== undefined) {
          return { ...item, customPrice: undefined, price: originalPrice };
        }
        return item;
      });
      
      // Use loadCart to update all items at once
      loadCart(updatedCart);
      setIsWholesaleMode(false);
      setOriginalRetailPrices(new Map());
      toast.success('Reverted to retail prices');
    } else {
      // Apply wholesale prices
      const productIds = cart
        .filter(item => !item.isCombo && !item.isBogo && item.id !== 'cart-discount')
        .map(item => item.productId);
      
      if (productIds.length === 0) {
        toast.info('No products to apply wholesale prices');
        return;
      }

      try {
        // Fetch wholesale prices for products
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, wholesale_price, price')
          .in('id', productIds);

        // Also fetch variant wholesale prices
        const variantIds = cart
          .filter(item => item.id !== item.productId && !item.isCombo && !item.isBogo)
          .map(item => item.id);

        let variants: any[] = [];
        if (variantIds.length > 0) {
          const { data: variantData } = await supabase
            .from('product_variants')
            .select('id, wholesale_price, price')
            .in('id', variantIds);
          variants = variantData || [];
        }

        if (productsError) {
          console.error('Error fetching wholesale prices:', productsError);
          toast.error('Failed to fetch wholesale prices');
          return;
        }

        // Create a map of wholesale prices
        const wholesalePriceMap = new Map<string, number>();
        products?.forEach(p => {
          if (p.wholesale_price && p.wholesale_price > 0) {
            wholesalePriceMap.set(p.id, p.wholesale_price);
          }
        });
        variants?.forEach(v => {
          if (v.wholesale_price && v.wholesale_price > 0) {
            wholesalePriceMap.set(v.id, v.wholesale_price);
          }
        });

        // Store original retail prices and update cart
        const newOriginalPrices = new Map<string, number>();
        let appliedCount = 0;

        const updatedCart = cart.map(item => {
          if (item.isCombo || item.isBogo || item.id === 'cart-discount') {
            return item;
          }

          // Store original price
          newOriginalPrices.set(item.id, item.customPrice ?? item.price);

          // Check for wholesale price (variant first, then product)
          const wholesalePrice = wholesalePriceMap.get(item.id) || wholesalePriceMap.get(item.productId);
          
          if (wholesalePrice && wholesalePrice > 0) {
            appliedCount++;
            return { ...item, customPrice: wholesalePrice };
          }
          
          return item;
        });

        // Use loadCart to update all items at once
        loadCart(updatedCart);
        setOriginalRetailPrices(newOriginalPrices);
        setIsWholesaleMode(true);
        
        if (appliedCount > 0) {
          toast.success(`Wholesale prices applied to ${appliedCount} item(s)`);
        } else {
          toast.info('No wholesale prices available for cart items');
        }
      } catch (error) {
        console.error('Error applying wholesale prices:', error);
        toast.error('Failed to apply wholesale prices');
      }
    }
  };

  const handlePrintLastReceipt = useReactToPrint({
    contentRef: lastReceiptRef,
  });

  const handleLastReceiptClick = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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
        return;
      }

      // Fetch customer name and balance if customer_id exists (unified if both customer and supplier)
      let customerName = undefined;
      let customerBalance = undefined;
      let isUnifiedBalance = false;
      
      console.log('📄 [LAST RECEIPT] Fetching receipt data for transaction:', transaction.transaction_number);
      console.log('📄 [LAST RECEIPT] Customer ID:', transaction.customer_id);
      
      if (transaction.customer_id) {
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('name, customer_ledger_account_id, supplier_ledger_account_id, is_customer, is_supplier')
          .eq('id', transaction.customer_id)
          .maybeSingle();

        console.log('📄 [LAST RECEIPT] Contact data:', contact, 'Error:', contactError);

        if (contact) {
          customerName = contact.name;
          isUnifiedBalance = contact.is_customer && contact.is_supplier;
          
          console.log('📄 [LAST RECEIPT] Contact name:', customerName);
          console.log('📄 [LAST RECEIPT] Is unified?', isUnifiedBalance);
          
          // Fetch current balance directly from accounts table instead of calculating from journal entries
          if (contact.is_customer && contact.customer_ledger_account_id) {
            console.log('📄 [LAST RECEIPT] Fetching balance from account:', contact.customer_ledger_account_id);
            
            const { data: customerAccount, error: accountError } = await supabase
              .from('accounts')
              .select('current_balance, account_name')
              .eq('id', contact.customer_ledger_account_id)
              .single();

            console.log('📄 [LAST RECEIPT] Account data:', customerAccount, 'Error:', accountError);

            if (customerAccount) {
              customerBalance = customerAccount.current_balance;
              console.log('📄 [LAST RECEIPT] Customer balance from account:', customerBalance);
              
              // If dual-role (customer & supplier), calculate unified balance
              if (contact.is_supplier && contact.supplier_ledger_account_id) {
                console.log('📄 [LAST RECEIPT] Contact is dual-role, fetching supplier balance from:', contact.supplier_ledger_account_id);
                
                const { data: supplierAccount, error: supplierError } = await supabase
                  .from('accounts')
                  .select('current_balance, account_name')
                  .eq('id', contact.supplier_ledger_account_id)
                  .single();

                console.log('📄 [LAST RECEIPT] Supplier account data:', supplierAccount, 'Error:', supplierError);

                if (supplierAccount) {
                  const originalBalance = customerBalance;
                  // Unified balance: customer receivable minus supplier payable
                  customerBalance = customerBalance - supplierAccount.current_balance;
                  console.log('📄 [LAST RECEIPT] Unified balance calculated:', originalBalance, '-', supplierAccount.current_balance, '=', customerBalance);
                }
              }
            }
          }
        }
      }
      
      console.log('📄 [LAST RECEIPT] Final balance to show:', customerBalance);

      // Parse transaction items
      const items = Array.isArray(transaction.items) ? transaction.items : [];
      
      // Prepare transaction data - properly preserve item structure including custom prices and discounts
      const transactionData = {
        transactionNumber: transaction.transaction_number,
        items: items.map((item: any) => ({
          id: item.id || 'unknown',
          name: item.name || 'Unknown Item',
          displayName: item.display_name, // Map snake_case from DB to camelCase
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
          isUnifiedBalance,
          storeName: stores?.find(s => s.id === transaction.store_id)?.name || settings?.company_name || 'Global Market',
        logoUrl: settings?.logo_url,
        supportPhone: settings?.company_phone,
      };

      setLastTransactionData(transactionData);
      setShowLastReceiptOptions(true);
    } catch (error) {
      console.error('Error fetching last receipt:', error);
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
      console.log('Receipt saved as PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleSendLastReceiptWhatsApp = async () => {
    if (!lastTransactionData) return;
    
    try {
      console.log('Generating receipt image...');
      
      // Create a temporary container for the receipt
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);
      
      // Render the receipt component
      const root = ReactDOM.createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(
          <Receipt
            transactionNumber={lastTransactionData.transactionNumber}
            items={lastTransactionData.items}
            subtotal={lastTransactionData.subtotal}
            tax={lastTransactionData.tax}
            discount={lastTransactionData.discount}
            total={lastTransactionData.total}
            paymentMethod={lastTransactionData.paymentMethod}
            date={lastTransactionData.date}
            cashierName={lastTransactionData.cashierName}
            customerName={lastTransactionData.customerName}
            storeName={lastTransactionData.storeName}
            logoUrl={lastTransactionData.logoUrl}
            supportPhone={lastTransactionData.supportPhone}
            customerBalance={lastTransactionData.customerBalance}
            isUnifiedBalance={lastTransactionData.isUnifiedBalance}
          />
        );
        setTimeout(resolve, 200);
      });
      
      // Convert to canvas
      const receiptElement = container.querySelector('.receipt-container') as HTMLElement;
      if (!receiptElement) throw new Error('Receipt element not found');
      
      const canvas = await html2canvas(receiptElement, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png', 1.0);
      });
      
      // Clean up
      root.unmount();
      document.body.removeChild(container);
      
      // Create file for sharing
      const file = new File([blob], `receipt-${lastTransactionData.transactionNumber}.png`, { type: 'image/png' });
      
      // Check if the browser supports sharing files
      const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: `Receipt ${lastTransactionData.transactionNumber}`,
            text: `Receipt for transaction ${lastTransactionData.transactionNumber}`,
          });
          console.log('Receipt shared successfully!');
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.log('Share cancelled');
          } else {
            console.error('Share error:', err);
            // Fallback to download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-${lastTransactionData.transactionNumber}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Downloaded receipt. Open WhatsApp and attach the image to share.');
          }
        }
      } else {
        // File sharing not supported, download the file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${lastTransactionData.transactionNumber}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('Downloaded receipt. Open WhatsApp and attach the image to share.');
      }
    } catch (error) {
      console.error('Error generating receipt image:', error);
    }
  };

  const handleDirectPrintLastReceipt = async () => {
    if (!lastTransactionData) return;
    
    console.log('Preparing receipt for printing...');
    
    try {
      console.log('🖨️ Calling kiosk print service...');
      
      await kioskPrintService.printReceipt({
        storeName: lastTransactionData.storeName || 'Global Market',
        transactionNumber: lastTransactionData.transactionNumber,
        date: new Date(),
        items: lastTransactionData.items.map((item: any) => ({
          name: item.name,
          displayName: item.displayName,
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
      
      console.log('✅ Print dialog opened! Check your printer.');
      setShowLastReceiptOptions(false);
    } catch (error: any) {
      console.error('❌ Print error:', error);
    }
  };

  const menuSections = {
    sales: [
      { icon: ShoppingCart, label: 'Manage Orders', path: '/admin/orders' },
      { icon: FileText, label: 'Quotations', path: '/admin/quotations' },
      { icon: DollarSign, label: 'Pricing Management', path: '/admin/pricing' },
      { icon: Tag, label: 'Manage Offers', path: '/admin/offers' },
      { icon: Megaphone, label: 'Announcements', path: '/admin/announcements' },
    ],
    inventory: [
      { icon: Package, label: 'Manage Products', path: '/admin/products' },
      { icon: Tags, label: 'Manage Categories', path: '/admin/categories' },
      { icon: BarcodeIcon, label: 'Barcode Management', path: '/admin/barcode' },
      { icon: Edit, label: 'Stock Adjustment', path: '/admin/stock-adjustment' },
      { icon: Factory, label: 'Production', path: '/admin/production' },
      { icon: FileText, label: 'Purchase Orders', path: '/admin/purchase-orders' },
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
      { icon: ReceiptIcon, label: 'Tax Collection Report', path: '/admin/tax-collection-report' },
    ],
    reports: [
      { icon: BarChart3, label: 'Analytics Dashboard', path: '/admin/analytics' },
      { icon: FileText, label: 'Reports', path: '/admin/close-day-report' },
      { icon: Package, label: 'Inventory Reports', path: '/admin/inventory-reports' },
      { icon: TrendingUp, label: 'Sales Report', path: '/admin/trading-account' },
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
      icon: FileText, 
      label: 'End Of Day', 
      color: 'bg-[#5DADE2]', 
      action: () => {
        if (!currentCashSession) {
          return;
        }
        setShowCashOut(true);
      },
      shortcut: null
    },
    { 
      icon: ShoppingCart, 
      label: 'Recent sales', 
      color: 'bg-[#5DADE2]', 
      action: () => navigate('/admin/orders'),
      shortcut: null
    },
    { 
      icon: Clock, 
      label: 'Pending sales', 
      color: 'bg-[#5DADE2]', 
      action: () => navigate('/admin/orders?status=pending'),
      shortcut: null
    },
    { 
      icon: Clock, 
      label: 'Hold / Fire', 
      color: 'bg-[#F97316]', 
      action: () => setShowHoldTicket(true),
      shortcut: null
    },
    { 
      icon: DollarSign, 
      label: 'Cash Payment', 
      color: 'bg-[#22C55E]', 
      action: () => {
        if (cart.length === 0) {
          toast.error('Cart is empty');
          return;
        }
        setQuickPaymentMethod('cash');
        setShowQuickPayment(true);
      },
      shortcut: 'F2'
    },
    { 
      icon: CreditCard, 
      label: 'Credit Sales', 
      color: 'bg-[#3B82F6]', 
      action: () => {
        if (cart.length === 0) {
          toast.error('Cart is empty');
          return;
        }
        if (!selectedCustomer) {
          toast.error('Please select a customer for credit sales');
          setShowCustomerDialog(true);
          return;
        }
        setQuickPaymentMethod('credit');
        setShowQuickPayment(true);
      },
      shortcut: 'F3'
    },
    { 
      icon: Smartphone, 
      label: 'Mobile Money', 
      color: 'bg-[#F59E0B]', 
      action: () => {
        if (cart.length === 0) {
          toast.error('Cart is empty');
          return;
        }
        setQuickPaymentMethod('mobile_money');
        setShowQuickPayment(true);
      },
      shortcut: 'F4'
    },
    { 
      icon: Banknote, 
      label: 'Refund', 
      color: 'bg-[#EF4444]', 
      action: () => {
        if (cart.length === 0) {
          return;
        }
        setShowRefund(true);
      },
      shortcut: null
    },
    { 
      icon: Package, 
      label: 'Stock & Price', 
      color: 'bg-[#5DADE2]', 
      action: () => navigate('/admin/stock-and-price'),
      shortcut: null
    },
    { 
      icon: Gift,
      label: 'Notes', 
      color: 'bg-[#5DADE2]', 
      action: () => setShowNotesDialog(true),
      shortcut: null
    },
    { 
      icon: Tag, 
      label: isWholesaleMode ? 'Remove Wholesale' : 'Apply Wholesale', 
      color: isWholesaleMode ? 'bg-[#F97316]' : 'bg-[#8B5CF6]', 
      action: handleToggleWholesale,
      shortcut: null
    },
    { 
      icon: LogOut,
      label: 'Logout', 
      color: 'bg-[#EF4444]', 
      action: async () => {
        await supabase.auth.signOut();
        navigate('/auth/pos-login');
      },
      shortcut: null
    },
  ];

  // POS-specific keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: quickActions
      .filter(action => action.shortcut)
      .map(action => ({
        key: action.shortcut!,
        description: action.label,
        action: () => {
          // Only trigger if not focused on input and cart has items
          const activeElement = document.activeElement as HTMLElement;
          const isInputFocused = activeElement?.tagName === 'INPUT' || 
                                activeElement?.tagName === 'TEXTAREA' || 
                                activeElement?.tagName === 'SELECT';
          
          if (!isInputFocused && cart.length > 0) {
            action.action();
          }
        },
        preventDefault: true,
      })),
    enabled: !showPayment && !showQuickPayment && !showHoldTicket && !showCashIn && !showCashOut && !variantSelectorOpen,
  });

  const handleHoldTicket = (ticketName: string) => {
    if (cart.length === 0) {
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
    setDiscount(0);
    
    console.log(`Ticket "${ticketName}" held successfully`);
  };

  const handleRecallTicket = (ticket: any) => {
    // Set flag to prevent price re-application
    setIsLoadingTransaction(true);
    
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
        console.log('Current cart auto-held');
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
          displayName: item.display_name || item.displayName, // Map from stored or existing
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
      
      console.log(`Ticket "${ticket.name}" recalled`);
      
      // Clear loading flag after items are loaded
      setTimeout(() => setIsLoadingTransaction(false), 300);
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
    console.log('Ticket deleted');
  };

  const handleLogout = async () => {
    try {
      // Clear cart before logout
      clearCart();
      setDiscount(0);
      setCartDiscountItem(null);
      localStorage.removeItem('pos_cart_state');
      localStorage.removeItem('pos_discount_state');
      
      await supabase.auth.signOut();
      console.log('Logged out successfully');
      navigate('/pos-login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Numeric Keypad Handlers
  const handleSelectCartItem = (itemId: string) => {
    // Don't allow selecting cart discount item
    if (itemId === 'cart-discount') return;
    
    // Don't clear input when in any keypad input mode
    if (keypadMode === 'cartDiscount' || keypadMode === 'qty' || keypadMode === 'discount' || keypadMode === 'price') {
      console.log('🎯 Cart item selected in input mode, keeping input');
      setSelectedCartItemId(itemId);
      return;
    }
    
    console.log('🎯 Cart item selected, clearing keypad input');
    setSelectedCartItemId(itemId);
    keypadInputRef.current = '';
    setKeypadRenderKey(prev => prev + 1);
  };

  const handleKeypadNumber = (value: string) => {
    console.log('🔢 Number pressed:', value, { keypadMode, currentInput: keypadInputRef.current });
    
    const newValue = keypadInputRef.current + value;
    keypadInputRef.current = newValue;
    setKeypadRenderKey(prev => prev + 1); // Force re-render to show new value
    console.log('📝 Input updated to:', newValue);
    
    if (keypadMode !== 'cartDiscount' && !selectedCartItemId) {
      return;
    }
  };

  const handleKeypadQty = () => {
    if (!selectedCartItemId) {
      return;
    }
    console.log('🔢 QTY mode activated, clearing input');
    setKeypadMode('qty');
    keypadInputRef.current = '';
    setKeypadRenderKey(prev => prev + 1);
  };

  const handleKeypadDiscount = () => {
    if (!selectedCartItemId) {
      return;
    }
    setKeypadMode('discount');
    keypadInputRef.current = '';
    setKeypadRenderKey(prev => prev + 1);
    setIsPercentMode(false);
  };

  const handleKeypadCartDiscount = () => {
    console.log('🔢 Cart Discount clicked:', { currentMode: keypadMode, currentInput: keypadInputRef.current });
    
    // Only clear input if not already in cartDiscount mode
    if (keypadMode !== 'cartDiscount') {
      setKeypadMode('cartDiscount');
      keypadInputRef.current = '';
      setIsPercentMode(false);
      setSelectedCartItemId(null);
      setKeypadRenderKey(prev => prev + 1);
      console.log('✅ Cart Discount mode activated');
    } else {
      console.log('ℹ️ Already in Cart Discount mode, keeping input:', keypadInputRef.current);
    }
  };

  const handleKeypadPercent = () => {
    if (keypadMode === 'cartDiscount') {
      setIsPercentMode(!isPercentMode);
      return;
    }
    if (!selectedCartItemId) {
      return;
    }
    if (keypadMode !== 'discount') {
      return;
    }
    setIsPercentMode(!isPercentMode);
  };

  const handleKeypadPrice = () => {
    if (!selectedCartItemId) {
      return;
    }
    setKeypadMode('price');
    keypadInputRef.current = '';
    setKeypadRenderKey(prev => prev + 1);
  };

  const handleKeypadClear = () => {
    console.log('🧹 CLEAR button pressed');
    keypadInputRef.current = '';
    setKeypadRenderKey(prev => prev + 1);
    setIsPercentMode(false);
    if (keypadMode === 'cartDiscount') {
      setKeypadMode(null);
    }
  };

  // Handle cart resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= 400 && newWidth <= 1000) {
        setCartWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('pos-cart-width', cartWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, cartWidth]);

  // Handle cart drag
  useEffect(() => {
    if (!isDragging || !dragStartPos.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartPos.current) return;
      
      const newPosition = {
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      };
      
      setCartPosition(newPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (cartPosition) {
        localStorage.setItem('pos-cart-position', JSON.stringify(cartPosition));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, cartPosition]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    // If cart is in default position, calculate current position
    const cartElement = (e.currentTarget as HTMLElement).closest('.cart-container') as HTMLElement;
    const rect = cartElement?.getBoundingClientRect();
    
    dragStartPos.current = {
      x: e.clientX - (cartPosition?.x || rect?.left || 0),
      y: e.clientY - (cartPosition?.y || rect?.top || 0),
    };
  };

  const resetCartPosition = () => {
    setCartPosition(null);
    setCartWidth(700);
    localStorage.removeItem('pos-cart-position');
    localStorage.removeItem('pos-cart-width');
    toast.success('Cart position reset');
  };

  const handleKeypadEnter = () => {
    console.log('🔢 Enter pressed:', { keypadMode, keypadInput: keypadInputRef.current, isPercentMode });
    
    if (!keypadMode || !keypadInputRef.current) {
      console.log('❌ Missing mode or input:', { keypadMode, keypadInput: keypadInputRef.current });
      return;
    }

    const value = parseFloat(keypadInputRef.current);
    if (isNaN(value) || value < 0) {
      return;
    }

    switch (keypadMode) {
      case 'qty':
        if (!selectedCartItemId) return;
        if (value === 0) {
          return;
        }
        updateQuantity(selectedCartItemId, Math.floor(value));
        console.log(`Quantity updated to ${Math.floor(value)}`);
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
            console.log(`Discount updated to ${value}% (${formatCurrency(discountAmount)})`);
          }
        } else {
          console.log(`Discount updated to ${formatCurrency(value)}`);
        }
        updateItemDiscount(selectedCartItemId, discountAmount);
        break;
      case 'price':
        if (!selectedCartItemId) return;
        if (value === 0) {
          return;
        }
        updateItemPrice(selectedCartItemId, value);
        console.log(`Price updated to ${formatCurrency(value)}`);
        break;
      case 'cartDiscount':
        // Calculate cart discount
        let cartDiscountAmount = value;
        if (isPercentMode) {
          const cartSubtotal = calculateSubtotal();
          cartDiscountAmount = (cartSubtotal * value) / 100;
          console.log(`Cart discount applied: ${value}% (${formatCurrency(cartDiscountAmount)})`);
        } else {
          console.log(`Cart discount applied: ${formatCurrency(value)}`);
        }
        // Update the discount state for transaction processing
        setDiscount(cartDiscountAmount);
        // Add or update cart discount as a special item for display
        setCartDiscountItem({
          id: 'cart-discount',
          name: 'Cart Discount',
          price: -cartDiscountAmount,
          quantity: 1,
          itemDiscount: 0,
        });
      break;
    }

    console.log('✅ Enter completed, clearing keypad input');
    keypadInputRef.current = '';
    setKeypadRenderKey(prev => prev + 1);
    setKeypadMode(null);
    setIsPercentMode(false);
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar - Cart */}
      <div 
        className={cn(
          "cart-container border-r flex flex-col bg-card shadow-lg transition-shadow relative",
          cartPosition && "absolute z-50 shadow-2xl",
          isDragging && "cursor-move select-none"
        )}
        style={{
          width: `${cartWidth}px`,
          ...(cartPosition && {
            left: `${cartPosition.x}px`,
            top: `${cartPosition.y}px`,
            height: 'calc(100vh - 40px)',
            maxHeight: '95vh',
          })
        }}
      >
        {/* Header */}
        <div className="p-2 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div 
              className="drag-handle flex items-center gap-2 cursor-move hover:bg-accent/50 px-2 py-1 rounded transition-colors select-none"
              onMouseDown={handleDragStart}
              title="Drag to move cart"
            >
              <div className="flex flex-col gap-0.5 pointer-events-none">
                <div className="h-0.5 w-4 bg-muted-foreground/50 rounded"></div>
                <div className="h-0.5 w-4 bg-muted-foreground/50 rounded"></div>
                <div className="h-0.5 w-4 bg-muted-foreground/50 rounded"></div>
              </div>
              <h1 className="text-sm font-bold pointer-events-none">POS</h1>
            </div>
            <div className="flex items-center gap-1">
              {cartPosition && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={resetCartPosition}
                  title="Reset cart position"
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
              <div className="text-[10px] text-muted-foreground px-2 py-1 border rounded bg-muted/30" title="F2: Cash Payment | F3: Credit Sales | F4: Mobile Money | F5-F12: Quick Actions | Arrow keys: Navigate | Enter: Edit | Delete: Remove | Esc: Cancel | Ctrl+Enter: Pay | Ctrl+N: New sale | Ctrl+C: Customer">
                Keyboard: F2-F12 + ↑↓←→
              </div>
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
              ref={productSearchRef}
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
                  // Price reset is handled by useEffect
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Total Display - Below customer selection */}
        <div className="border-b p-3 space-y-2">
          {timbreTax > 0 && (
            <div className="flex justify-between items-center text-xs px-3">
              <span className="text-muted-foreground">Timbre</span>
              <span className="font-medium text-orange-600 dark:text-orange-400">+{formatCurrency(timbreTax)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 px-3 bg-primary/5 rounded-lg border border-primary/20">
            <span className="text-lg font-bold">TOTAL</span>
            <span className="text-3xl font-bold text-primary">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 min-h-0 overflow-hidden p-1 flex flex-col">
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
            onUpdateDisplayName={updateItemDisplayName}
            onRemove={(id) => {
              if (id === 'cart-discount') {
                setCartDiscountItem(null);
                setDiscount(0);
                console.log('Cart discount removed');
              } else {
                removeFromCart(id);
              }
            }}
            onClear={() => {
              clearCart();
              setCartDiscountItem(null);
              setDiscount(0);
            }}
            selectedItemId={selectedCartItemId || undefined}
            onSelectItem={handleSelectCartItem}
          />
        </div>
        
        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-primary/50 cursor-col-resize transition-all group"
          onMouseDown={() => setIsResizing(true)}
          title="Drag to resize cart"
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary/30 group-hover:bg-primary rounded-l opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
              <DropdownMenuContent align="start" className="w-56 bg-background z-50">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground flex items-center gap-2 py-2">
                  <Award className="h-3 w-3" />
                  Global Market POS v{APP_VERSION}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                <DropdownMenuSeparator />
                <div className="px-2 py-1">
                  <UpdateButton compact />
                </div>
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

        {/* Recent Journal Entries or Products Grid - Flexible scrollable container */}
        <div className="flex-1 overflow-y-auto p-2 pb-0 min-h-0">
          {!selectedCategory && !searchTerm ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Recent Journal Entries</h3>
              </div>
              
              {displayJournalLoading ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Loading journal entries...</div>
              ) : displayJournalEntries && displayJournalEntries.length > 0 ? (
                <div className="space-y-1.5">
                  {displayJournalEntries.slice(0, 10).map((entry: any, index: number) => {
                    const amount = parseFloat(entry.total_debit?.toString() || '0');
                    
                    return (
                      <Card 
                        key={index} 
                        className="p-2 hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedJournalEntry(entry);
                          setJournalEntryDialogOpen(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                Transaction
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), 'MMM dd, HH:mm')}
                              </span>
                            </div>
                            <p className="text-xs font-medium truncate">{entry.reference}</p>
                            {entry.description && (
                              <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(amount)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-4 text-center">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">No journal entries for this session</p>
                </Card>
              )}
            </div>
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
                    className="h-7 w-20 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 w-20 text-xs"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Keypad, Actions & Dashboard Section - Always Visible */}
        <div className="flex-shrink-0 p-2 pt-0">
          <div className="flex gap-4">
            {/* Numeric Keypad - left side */}
            <div className="flex-1">
              {/* Keypad Input Display */}
              <div key={keypadRenderKey} className="mb-2 p-3 bg-card border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-muted-foreground">
                    {keypadMode === 'qty' && 'QUANTITY'}
                    {keypadMode === 'discount' && 'DISCOUNT'}
                    {keypadMode === 'price' && 'CUSTOM PRICE'}
                    {keypadMode === 'cartDiscount' && 'CART DISCOUNT'}
                    {!keypadMode && 'SELECT MODE'}
                    {isPercentMode && keypadMode && ' (%)'}
                  </div>
                  <div className="text-2xl font-bold text-primary min-w-[100px] text-right">
                    {keypadInputRef.current || '0'}
                  </div>
                </div>
              </div>
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

            {/* Quick Actions Grid - middle */}
            <div className="grid grid-cols-2 gap-1.5 flex-shrink-0">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className={cn(
                    "h-16 w-28 flex flex-col items-center justify-center p-1.5 text-white border-none transition-colors relative",
                    action.color,
                    "hover:opacity-90"
                  )}
                  onClick={action.action}
                >
                  {action.shortcut && (
                    <div className="absolute top-0.5 right-0.5">
                      <KeyboardBadge keys={action.shortcut} className="scale-[0.65] opacity-80" />
                    </div>
                  )}
                  {action.label === 'Pending sales' && pendingOrdersCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                      {pendingOrdersCount}
                    </div>
                  )}
                  <action.icon className="h-4 w-4 mb-0.5" />
                  <span className="text-[10px] text-center leading-tight">{action.label}</span>
                </Button>
              ))}
            </div>

            {/* Dashboard Analytics - right side */}
            {!selectedCategory && !searchTerm && (
              <div className="flex-shrink-0 w-[420px] space-y-2">
                {/* Date Range Selector */}
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

                {/* Analytics Cards - Vertical Stack */}
                <div className="space-y-2">
                  {/* Sales Overview Card */}
                  {(() => {
                    const totalSales = (analyticsData?.cashSales || 0) + (analyticsData?.creditSales || 0) + (analyticsData?.mobileMoneySales || 0);
                    const isNegative = totalSales < 0;
                    const textColor = isNegative ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
                    
                    return (
                      <Card 
                        className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setExpandedMetric('sales')}
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-emerald-500/20">
                            <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 block mb-1">Sales</span>
                            <p className={`text-xl font-bold ${textColor}`}>
                              {formatCurrency(totalSales)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })()}

                  {/* Top Product Card */}
                  <Card 
                    className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setExpandedMetric('products')}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-blue-500/20">
                        <Award className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-blue-900 dark:text-blue-100 block mb-1">Top Product</span>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100 truncate">
                          {analyticsData?.topProducts?.[0]?.name || 'N/A'}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {analyticsData?.topProducts?.[0]?.quantity || 0} sold
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Top Customer Card */}
                  {(() => {
                    const customerTotal = analyticsData?.topCustomers?.[0]?.total || 0;
                    const isNegative = customerTotal < 0;
                    const amountColor = isNegative ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
                    
                    return (
                      <Card 
                        className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setExpandedMetric('customers')}
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-purple-500/20">
                            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-purple-900 dark:text-purple-100 block mb-1">Top Customer</span>
                            <p className="text-sm font-bold text-purple-900 dark:text-purple-100 truncate">
                              {analyticsData?.topCustomers?.[0]?.name || 'N/A'}
                            </p>
                            <p className={`text-xs font-semibold ${amountColor}`}>
                              {formatCurrency(customerTotal)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })()}
                </div>
                
                {/* Top Credit Customers Section */}
                <div className="border-t pt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold">Top Credit Customers</h3>
                  </div>
                  
                  {creditCustomersLoading ? (
                    <div className="text-center py-3 text-muted-foreground text-xs">Loading...</div>
                  ) : topCreditCustomers && topCreditCustomers.length > 0 ? (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                      {topCreditCustomers.map((customer: any) => (
                        <Card 
                          key={customer.id} 
                          className="p-2 cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => {
                            // For dual-role customers (both customer AND supplier), use unified view
                            const isDualRole = customer.is_customer && customer.is_supplier;
                            const accountId = isDualRole 
                              ? `unified-${customer.id}` 
                              : customer.customer_ledger_account_id;
                            navigate(`/admin/general-ledger?accountId=${accountId}`);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{customer.name}</p>
                              {customer.phone && (
                                <p className="text-[10px] text-muted-foreground truncate">{customer.phone}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[10px] text-muted-foreground">Balance</p>
                              <p className={cn(
                                "text-sm font-bold",
                                customer.balance >= 0 
                                  ? "text-emerald-600 dark:text-emerald-400" 
                                  : "text-red-600 dark:text-red-400"
                              )}>
                                {formatCurrency(customer.balance)}
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-muted-foreground text-xs">No credit customers</div>
                  )}
                </div>
              </div>
            )}
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

      <QuickPaymentDialog
        isOpen={showQuickPayment}
        onClose={() => setShowQuickPayment(false)}
        onConfirm={handleQuickPayment}
        paymentMethod={quickPaymentMethod}
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
          console.log('Starting POS without cash session. You can open a cash session later.');
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
          supplierPayments={supplierPayments || []}
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
          setDiscount(0);
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
                    navigate('/admin/contacts', { state: { openAddDialog: true, fromPOS: true } });
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
                        navigate('/admin/contacts', { state: { openAddDialog: true, fromPOS: true } });
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
      <CustomPriceDialog
        open={showCustomPriceConfirm}
        onClose={() => setShowCustomPriceConfirm(false)}
        customerName={selectedCustomer?.name || ''}
        cartItems={cart}
        onSave={handleSaveCustomerPrices}
        onSkip={handleSkipCustomerPrices}
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
              customerName={lastTransactionData.customerName}
              customerBalance={lastTransactionData.customerBalance}
              isUnifiedBalance={lastTransactionData.isUnifiedBalance}
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
      
      {/* Journal Entry View Dialog */}
      <JournalEntryViewDialog
        isOpen={journalEntryDialogOpen}
        onClose={() => {
          setJournalEntryDialogOpen(false);
          setSelectedJournalEntry(null);
        }}
        entry={selectedJournalEntry}
      />
      
      {/* Offline Status Indicator */}
      <OfflineIndicator />
      
      {/* Floating Chat Button */}
      <FloatingChatButton />
    </div>
  );
}
