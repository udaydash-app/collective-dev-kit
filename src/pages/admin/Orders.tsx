import { Fragment, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Package, Eye, ShoppingCart, Plus, Minus, Trash2, Printer, FileText, MessageCircle, Edit, Calendar, Database } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Receipt } from "@/components/pos/Receipt";
import { useReactToPrint } from "react-to-print";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { qzTrayService } from "@/lib/qzTray";
import { kioskPrintService } from "@/lib/kioskPrint";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("today");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [confirmOrderDialogOpen, setConfirmOrderDialogOpen] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showReceiptOptions, setShowReceiptOptions] = useState(false);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<any>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Enable real-time sync for automatic updates
  useRealtimeSync();

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  // Search available products
  const { data: availableProducts } = useQuery({
    queryKey: ['available-products', productSearch],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, price, unit, image_url, store_id')
        .eq('is_available', true)
        .limit(10);

      if (productSearch) {
        query = query.ilike('name', `%${productSearch}%`);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: addProductDialogOpen
  });

  // Get date range based on period filter
  const getDateRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'this_week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return null;
    }
  };

  const { data: orders, isLoading, error: queryError } = useQuery({
    queryKey: ['admin-orders', statusFilter, periodFilter],
    queryFn: async () => {
      const dateRange = getDateRange();
      
      // Fetch online orders
      let ordersQuery = supabase
        .from('orders')
        .select(`
          *,
          stores(name),
          addresses(address_line1, city)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        ordersQuery = ordersQuery.eq('status', statusFilter);
      }

      if (dateRange) {
        ordersQuery = ordersQuery
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString());
      }

      const { data: onlineOrders, error: ordersError } = await ordersQuery;
      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }
      
      // Fetch POS transactions
      let posQuery = supabase
        .from('pos_transactions')
        .select(`
          *,
          stores(name)
        `)
        .order('created_at', { ascending: false });

      if (dateRange) {
        posQuery = posQuery
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString());
      }

      const { data: posTransactions, error: posError } = await posQuery;

      if (posError) {
        console.error('Error fetching POS transactions:', posError);
      }

      const allOrders = [];

      // Process online orders
      if (onlineOrders && onlineOrders.length > 0) {
        const userIds = [...new Set(onlineOrders.map(order => order.user_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        const orderIds = onlineOrders.map(order => order.id);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select(`
            *,
            products(id, name, image_url, price, unit)
          `)
          .in('order_id', orderIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        const itemsByOrder = new Map<string, any[]>();
        orderItems?.forEach(item => {
          if (!itemsByOrder.has(item.order_id)) {
            itemsByOrder.set(item.order_id, []);
          }
          itemsByOrder.get(item.order_id)?.push(item);
        });
        
        const filteredOnlineOrders = onlineOrders.filter(order => {
          if (statusFilter === 'all') return true;
          return order.status === statusFilter;
        });
        
        allOrders.push(...filteredOnlineOrders.map(order => ({
          ...order,
          order_number: order.order_number,
          customer_name: profileMap.get(order.user_id) || 'Guest',
          items: itemsByOrder.get(order.id) || [],
          type: 'online',
          status: order.status
        })));
      }

      // Process POS transactions
      if (posTransactions && posTransactions.length > 0) {
        const cashierIds = [...new Set(posTransactions.map(t => t.cashier_id))];
        const { data: cashierProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', cashierIds);
        
        // Fetch customer names for POS transactions with customer_id
        const customerIds = [...new Set(posTransactions.map(t => t.customer_id).filter(Boolean))];
        const { data: customers } = await supabase
          .from('contacts')
          .select('id, name')
          .in('id', customerIds);
        
        const cashierMap = new Map(cashierProfiles?.map(p => [p.id, p.full_name]) || []);
        const customerMap = new Map(customers?.map(c => [c.id, c.name]) || []);
        
        const filteredPOSTransactions = posTransactions.filter(transaction => {
          if (statusFilter === 'all') return true;
          return statusFilter === 'completed';
        });
        
        allOrders.push(...filteredPOSTransactions.map(transaction => ({
          id: transaction.id,
          order_number: transaction.transaction_number,
          customer_name: transaction.customer_id ? customerMap.get(transaction.customer_id) || 'Walk-in Customer' : 'Walk-in Customer',
          customer_id: transaction.customer_id,
          stores: transaction.stores,
          store_id: transaction.store_id,
          total: transaction.total,
          subtotal: transaction.subtotal,
          tax: transaction.tax,
          discount: transaction.discount || 0,
          delivery_fee: 0,
          created_at: transaction.created_at,
          items: transaction.items || [],
          type: 'pos',
          status: 'completed',
          payment_method: transaction.payment_method,
          cashier_name: cashierMap.get(transaction.cashier_id) || 'Unknown',
          addresses: null
        })));
      }

      // Sort by date
      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return allOrders;
    }
  });

  // Fetch company settings for receipts
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('settings')
        .select('logo_url, company_phone, company_name')
        .single();
      return data;
    },
  });

  // Function to fetch customer ledger balance
  const fetchCustomerBalance = async (customerName: string): Promise<number | undefined> => {
    if (!customerName || customerName === 'Walk-in Customer') return undefined;

    try {
      // Find the contact by name - check if they're both customer and supplier
      const { data: contact } = await supabase
        .from('contacts')
        .select('customer_ledger_account_id, supplier_ledger_account_id, is_customer, is_supplier')
        .eq('name', customerName)
        .maybeSingle();

      if (!contact) return undefined;

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
          const customerBalance = customerLines.reduce((sum, line) => {
            return sum + (line.debit_amount - line.credit_amount);
          }, 0);
          totalBalance += customerBalance;
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
          const supplierBalance = supplierLines.reduce((sum, line) => {
            return sum + (line.debit_amount - line.credit_amount);
          }, 0);
          // Add supplier balance (already negative if we owe them) for unified view
          totalBalance += supplierBalance;
        }
      }

      return totalBalance;
    } catch (error) {
      console.error('Error fetching customer balance:', error);
      return undefined;
    }
  };

  if (queryError) {
    console.error('Query error:', queryError);
  }

  const printOrderReceipt = async (orderId: string) => {
    // Refetch settings to get latest logo
    await refetchSettings();
    const latestSettings = queryClient.getQueryData(['company-settings']) as any;
    
    const order = orders?.find(o => o.id === orderId);
    if (!order) {
      toast.error('Order not found');
      return;
    }

    // Fetch customer balance
    const customerBalance = await fetchCustomerBalance(order.customer_name);

    // Create a temporary container for the receipt
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print receipt');
      return;
    }

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${order.order_number}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: monospace;
              font-size: 12px;
            }
            .receipt {
              width: 80mm;
              margin: 0 auto;
              background: white;
              color: black;
            }
            .text-center { text-align: center; }
            .text-xs { font-size: 10px; }
            .text-sm { font-size: 11px; }
            .text-lg { font-size: 14px; }
            .text-xl { font-size: 16px; }
            .font-bold { font-weight: bold; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-4 { margin-bottom: 16px; }
            .mt-2 { margin-top: 8px; }
            .py-2 { padding-top: 8px; padding-bottom: 8px; }
            .pt-1 { padding-top: 4px; }
            .pt-2 { padding-top: 8px; }
            .border-t { border-top: 1px solid black; }
            .border-b { border-bottom: 1px solid black; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .items-center { align-items: center; }
            .flex-1 { flex: 1; }
            .space-y-1 > * + * { margin-top: 4px; }
            img { max-width: 100%; height: auto; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="text-center mb-4">
              ${latestSettings?.logo_url ? `
                <div class="flex justify-center mb-2">
                  <img src="${latestSettings.logo_url}" alt="Company Logo" style="height: 120px; width: auto; object-fit: contain;" id="companyLogo" crossorigin="anonymous" />
                </div>
              ` : ''}
              <h1 class="text-xl font-bold">${order.stores?.name || latestSettings?.company_name || 'Global Market'}</h1>
              <p class="text-xs">Fresh groceries delivered to your doorstep</p>
              <p class="text-xs mt-2">Transaction: ${order.order_number}</p>
              <p class="text-xs">${formatDateTime(order.created_at)}</p>
              ${order.type === 'pos' ? `<p class="text-xs">Cashier: ${order.cashier_name}</p>` : ''}
              ${order.customer_name && order.customer_name !== 'Walk-in Customer' ? `<p class="text-xs">Customer: ${order.customer_name}</p>` : ''}
              ${customerBalance !== undefined && order.customer_name && order.customer_name !== 'Walk-in Customer' ? `<p class="text-xs font-bold mt-2">Customer Balance: ${customerBalance.toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</p>` : ''}
            </div>

            <div class="border-t border-b py-2 mb-2">
              ${order.items.map((item: any) => {
                const effectivePrice = item.customPrice ?? item.products?.price ?? item.unit_price ?? item.price;
                const itemDiscount = (item.itemDiscount || item.item_discount || 0) * item.quantity;
                return `
                <div class="mb-2">
                  <div class="flex justify-between">
                    <span class="flex-1">${item.products?.name || item.name}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span>${item.quantity} x ${effectivePrice.toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</span>
                    <span>${(effectivePrice * item.quantity).toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</span>
                  </div>
                  ${itemDiscount > 0 ? `
                  <div class="flex justify-between text-xs" style="margin-left: 8px;">
                    <span>Item Discount:</span>
                    <span>-${itemDiscount.toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</span>
                  </div>
                  ` : ''}
                </div>
              `}).join('')}
            </div>

            <div class="space-y-1 mb-2">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>${Number(order.subtotal).toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</span>
              </div>
              <div class="flex justify-between">
                <span>Tax (15%):</span>
                <span>${Number(order.tax || 0).toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</span>
              </div>
              ${order.type === 'pos' && order.discount > 0 ? `
                <div class="flex justify-between">
                  <span>Discount:</span>
                  <span>-${Number(order.discount).toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</span>
                </div>
              ` : ''}
              <div class="flex justify-between font-bold text-lg border-t pt-1">
                <span>TOTAL:</span>
                <span>${Number(order.total).toLocaleString('fr-CI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} FCFA</span>
              </div>
            </div>

            <div class="border-t pt-2 mb-4">
              <p class="text-xs">Payment Method: ${(order.payment_method || 'Online').toUpperCase()}</p>
            </div>

            <div class="text-center text-xs">
              <p>Thank you for shopping with us!</p>
              ${latestSettings?.company_phone ? `<p class="mt-2">For support: ${latestSettings.company_phone}</p>` : ''}
            </div>
          </div>
          <script>
            window.onload = function() {
              ${latestSettings?.logo_url ? `
                // Wait for logo to load before printing
                var logo = document.getElementById('companyLogo');
                if (logo) {
                  if (logo.complete) {
                    window.print();
                    setTimeout(() => window.close(), 100);
                  } else {
                    logo.onload = function() {
                      window.print();
                      setTimeout(() => window.close(), 100);
                    };
                    logo.onerror = function() {
                      // Print anyway if logo fails to load
                      window.print();
                      setTimeout(() => window.close(), 100);
                    };
                  }
                } else {
                  window.print();
                  setTimeout(() => window.close(), 100);
                }
              ` : `
                window.print();
                setTimeout(() => window.close(), 100);
              `}
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  const handleReceiptClick = async (orderId: string) => {
    const order = orders?.find(o => o.id === orderId);
    if (!order) {
      toast.error('Order not found');
      return;
    }
    
    // Fetch customer balance
    const customerBalance = await fetchCustomerBalance(order.customer_name);
    setSelectedReceiptOrder({ ...order, customerBalance });
    setShowReceiptOptions(true);
  };

  const handleDirectPrint = async () => {
    if (!selectedReceiptOrder) return;
    
    const order = selectedReceiptOrder;
    
    toast.loading('Printing...', { id: 'direct-print' });
    
    try {
      await kioskPrintService.printReceipt({
        storeName: order.stores?.name || settings?.company_name || 'Global Market',
        transactionNumber: order.order_number,
        date: new Date(order.created_at),
        items: order.items.map((item: any) => ({
          name: item.products?.name || item.name,
          quantity: item.quantity,
          price: item.customPrice ?? item.products?.price ?? item.unit_price ?? item.price,
          itemDiscount: item.itemDiscount || item.item_discount || 0
        })),
        subtotal: Number(order.subtotal),
        tax: Number(order.tax || 0),
        discount: order.type === 'pos' ? Number(order.discount || 0) : undefined,
        total: Number(order.total),
        paymentMethod: order.payment_method || 'Online',
        cashierName: order.type === 'pos' ? order.cashier_name : undefined,
        customerName: order.customer_name && order.customer_name !== 'Walk-in Customer' ? order.customer_name : undefined,
        logoUrl: settings?.logo_url || undefined,
        supportPhone: settings?.company_phone || undefined,
        customerBalance: order.customerBalance
      });
      
      toast.success('Print sent to printer', { id: 'direct-print' });
      setShowReceiptOptions(false);
    } catch (error: any) {
      console.error('Print error:', error);
      toast.error(error.message || 'Failed to print receipt', { id: 'direct-print' });
    }
  };

  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
  });

  const handleSaveReceiptPDF = async () => {
    if (!receiptRef.current) return;
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, canvas.height * 80 / canvas.width]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 80, canvas.height * 80 / canvas.width);
      pdf.save(`receipt-${selectedReceiptOrder?.order_number || 'order'}.pdf`);
      toast.success('Receipt saved as PDF');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleEditOrder = (order: any) => {
    console.log('🔧 handleEditOrder called with order:', order);
    
    // Store the order data in localStorage so POS can load it
    const orderData = {
      id: order.id,
      type: order.type,
      items: order.items.map((item: any) => {
        // For POS items: item.id IS the product ID
        // For online orders: item.products.id is the product ID
        const productId = item.id || item.products?.id || item.productId || item.product_id;
        console.log('🔧 Mapping item:', {
          itemId: item.id,
          productsId: item.products?.id,
          productId: item.productId,
          finalId: productId,
          name: item.name || item.products?.name
        });
        
        return {
          id: productId,
          productId: productId,
          name: item.name || item.products?.name,
          price: item.price || item.unit_price || item.products?.price || 0,
          customPrice: item.customPrice,
          quantity: item.quantity || 1,
          itemDiscount: item.itemDiscount || 0,
          barcode: item.barcode || item.products?.barcode
        };
      }),
      discount: order.type === 'pos' ? (order.discount || 0) : 0,
      customer: order.customer_name,
      customerId: order.type === 'pos' ? order.customer_id : null,
      storeId: order.store_id
    };
    
    console.log('🔧 Order data being saved:', orderData);
    localStorage.setItem('pos-edit-order', JSON.stringify(orderData));
    
    // Navigate to POS with edit flag
    navigate(`/admin/pos?editOrder=${order.id}`);
  };

  const handleSendReceiptWhatsApp = () => {
    if (!selectedReceiptOrder) return;

    const order = selectedReceiptOrder;
    const itemsList = order.items.map((item: any) => {
      const effectivePrice = item.customPrice ?? item.products?.price ?? item.unit_price ?? item.price;
      const itemDiscount = (item.itemDiscount || item.item_discount || 0) * item.quantity;
      const itemText = `${item.products?.name || item.name} - ${item.quantity} x ${formatCurrency(effectivePrice)} = ${formatCurrency(effectivePrice * item.quantity)}`;
      return itemDiscount > 0 ? `${itemText}\n  Item Discount: -${formatCurrency(itemDiscount)}` : itemText;
    }).join('\n');

    const customerBalanceText = order.customerBalance !== undefined && order.customer_name && order.customer_name !== 'Walk-in Customer' 
      ? `\n*Customer Balance:* ${formatCurrency(order.customerBalance)}\n` 
      : '';

    const message = `
*${order.stores?.name || settings?.company_name || 'Global Market'}*
Fresh groceries delivered to your doorstep

*Transaction:* ${order.order_number}
*Date:* ${formatDateTime(order.created_at)}
${order.type === 'pos' ? `*Cashier:* ${order.cashier_name}\n` : ''}${order.customer_name && order.customer_name !== 'Walk-in Customer' ? `*Customer:* ${order.customer_name}\n` : ''}${customerBalanceText}----------------------------
*ITEMS:*
${itemsList}
----------------------------
*Subtotal:* ${formatCurrency(order.subtotal)}
*Tax:* ${formatCurrency(order.tax || 0)}
${order.type === 'pos' && order.discount > 0 ? `*Discount:* -${formatCurrency(order.discount)}\n` : ''}*TOTAL:* ${formatCurrency(order.total)}
----------------------------
*Payment Method:* ${(order.payment_method || 'Online').toUpperCase()}

Thank you for shopping with us!
${settings?.company_phone ? `For support: ${settings.company_phone}` : ''}
    `.trim();

    window.location.href = `whatsapp://send?text=${encodeURIComponent(message)}`;
  };

  const updateOrderItem = useMutation({
    mutationFn: async ({ itemId, quantity, orderId, orderType }: { 
      itemId: string; 
      quantity: number;
      orderId: string;
      orderType: 'online' | 'pos';
    }) => {
      if (orderType === 'pos') {
        // For POS transactions, update the items JSON array
        const { data: transaction } = await supabase
          .from('pos_transactions')
          .select('items, subtotal, tax, discount')
          .eq('id', orderId)
          .single();

        if (!transaction) throw new Error('Transaction not found');

        const items = transaction.items as any[];
        const updatedItems = items.map((item: any) => 
          item.id === itemId ? { ...item, quantity } : item
        );

        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => {
          const effectivePrice = item.customPrice ?? item.price;
          const itemTotal = effectivePrice * item.quantity;
          const itemDiscountAmount = (item.itemDiscount ?? 0) * item.quantity;
          return sum + itemTotal - itemDiscountAmount;
        }, 0);

        const total = subtotal - (transaction.discount || 0);

        const { error } = await supabase
          .from('pos_transactions')
          .update({ 
            items: updatedItems,
            subtotal,
            total
          })
          .eq('id', orderId);

        if (error) throw error;
      } else {
        // Original online order logic
        const { data: item } = await supabase
          .from('order_items')
          .select('unit_price')
          .eq('id', itemId)
          .single();

        const { error } = await supabase
          .from('order_items')
          .update({ 
            quantity,
            subtotal: Number(item?.unit_price || 0) * quantity
          })
          .eq('id', itemId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order item updated');
    },
    onError: () => toast.error('Failed to update item')
  });

  const deleteOrderItem = useMutation({
    mutationFn: async ({ itemId, orderId, orderType }: { 
      itemId: string;
      orderId: string;
      orderType: 'online' | 'pos';
    }) => {
      if (orderType === 'pos') {
        // For POS transactions, remove from items JSON array
        const { data: transaction } = await supabase
          .from('pos_transactions')
          .select('items, subtotal, tax, discount')
          .eq('id', orderId)
          .single();

        if (!transaction) throw new Error('Transaction not found');

        const items = transaction.items as any[];
        const updatedItems = items.filter((item: any) => item.id !== itemId);

        // Recalculate totals
        const subtotal = updatedItems.reduce((sum, item) => {
          const effectivePrice = item.customPrice ?? item.price;
          const itemTotal = effectivePrice * item.quantity;
          const itemDiscountAmount = (item.itemDiscount ?? 0) * item.quantity;
          return sum + itemTotal - itemDiscountAmount;
        }, 0);

        const total = subtotal - (transaction.discount || 0);

        const { error } = await supabase
          .from('pos_transactions')
          .update({ 
            items: updatedItems,
            subtotal,
            total
          })
          .eq('id', orderId);

        if (error) throw error;
      } else {
        // Original online order logic
        const { error } = await supabase
          .from('order_items')
          .delete()
          .eq('id', itemId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Item removed from order');
    },
    onError: () => toast.error('Failed to remove item')
  });

  const updatePOSItemPrice = useMutation({
    mutationFn: async ({ itemId, orderId, price, discount }: { 
      itemId: string;
      orderId: string;
      price?: number;
      discount?: number;
    }) => {
      const { data: transaction } = await supabase
        .from('pos_transactions')
        .select('items, discount')
        .eq('id', orderId)
        .single();

      if (!transaction) throw new Error('Transaction not found');

      const items = transaction.items as any[];
      const updatedItems = items.map((item: any) => {
        if (item.id === itemId) {
          return {
            ...item,
            ...(price !== undefined && { customPrice: price }),
            ...(discount !== undefined && { itemDiscount: discount })
          };
        }
        return item;
      });

      // Recalculate totals
      const subtotal = updatedItems.reduce((sum, item) => {
        const effectivePrice = item.customPrice ?? item.price;
        const itemTotal = effectivePrice * item.quantity;
        const itemDiscountAmount = (item.itemDiscount ?? 0) * item.quantity;
        return sum + itemTotal - itemDiscountAmount;
      }, 0);

      const total = subtotal - (transaction.discount || 0);

      const { error } = await supabase
        .from('pos_transactions')
        .update({ 
          items: updatedItems,
          subtotal,
          total
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Item updated');
    },
    onError: () => toast.error('Failed to update item')
  });

  const addProductToOrder = useMutation({
    mutationFn: async ({ orderId, productId }: { orderId: string; productId: string }) => {
      // Get product details
      const { data: product } = await supabase
        .from('products')
        .select('price')
        .eq('id', productId)
        .single();

      if (!product) throw new Error('Product not found');

      // Check if product already in order
      const { data: existingItem } = await supabase
        .from('order_items')
        .select('id, quantity')
        .eq('order_id', orderId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingItem) {
        // Update quantity if already exists
        const { error } = await supabase
          .from('order_items')
          .update({ 
            quantity: existingItem.quantity + 1,
            subtotal: Number(product.price) * (existingItem.quantity + 1)
          })
          .eq('id', existingItem.id);
        
        if (error) throw error;
      } else {
        // Insert new item
        const { error } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            product_id: productId,
            quantity: 1,
            unit_price: product.price,
            subtotal: product.price
          });

        if (error) throw error;
      }

      // Recalculate order total
      const { data: items } = await supabase
        .from('order_items')
        .select('subtotal')
        .eq('order_id', orderId);

      const subtotal = items?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0;
      const deliveryFee = 500; // Fixed delivery fee
      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + deliveryFee + tax;

      await supabase
        .from('orders')
        .update({ subtotal, tax, total })
        .eq('id', orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setAddProductDialogOpen(false);
      setProductSearch("");
      toast.success('Product added to order');
    },
    onError: () => toast.error('Failed to add product')
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status, deliveryFee, taxRate }: { 
      orderId: string; 
      status: string;
      deliveryFee?: number;
      taxRate?: number;
    }) => {
      // If confirming order with fees/tax, recalculate total
      if (status === 'confirmed' && (deliveryFee !== undefined || taxRate !== undefined)) {
        // Get order items to calculate subtotal
        const { data: items } = await supabase
          .from('order_items')
          .select('subtotal')
          .eq('order_id', orderId);

        const subtotal = items?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0;
        const delivery = deliveryFee || 0;
        const tax = subtotal * (taxRate || 0);
        const total = subtotal + delivery + tax;

        const { error } = await supabase
          .from('orders')
          .update({ 
            status,
            subtotal,
            delivery_fee: delivery,
            tax,
            total
          })
          .eq('id', orderId);

        if (error) throw error;
      } else {
        // Simple status update
        const { error } = await supabase
          .from('orders')
          .update({ status })
          .eq('id', orderId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order status updated successfully');
      setConfirmOrderDialogOpen(false);
      setOrderToConfirm(null);
      setDeliveryFee("0");
      setTaxRate("0");
    },
    onError: (error) => {
      toast.error('Failed to update order status');
      console.error(error);
    }
  });

  const deleteSelectedOrders = useMutation({
    mutationFn: async () => {
      const orderIds = Array.from(selectedOrders);
      const ordersToDelete = orders?.filter((o: any) => orderIds.includes(o.id)) || [];
      
      // Separate online orders and POS transactions
      const onlineOrderIds = ordersToDelete.filter((o: any) => o.type === 'online').map((o: any) => o.id);
      const posTransactionIds = ordersToDelete.filter((o: any) => o.type === 'pos').map((o: any) => o.id);
      
      // Delete online order items first
      if (onlineOrderIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', onlineOrderIds);

        if (itemsError) throw itemsError;

        // Then delete online orders
        const { error: ordersError } = await supabase
          .from('orders')
          .delete()
          .in('id', onlineOrderIds);

        if (ordersError) throw ordersError;
      }

      // Delete POS transactions
      if (posTransactionIds.length > 0) {
        const { error: posError } = await supabase
          .from('pos_transactions')
          .delete()
          .in('id', posTransactionIds);

        if (posError) throw posError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success(`${selectedOrders.size} orders deleted successfully`);
      setSelectedOrders(new Set());
      setDeleteSelectedDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to delete orders');
      console.error(error);
    }
  });

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (!orders) return;
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o: any) => o.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      processing: "default",
      out_for_delivery: "default",
      delivered: "outline",
      cancelled: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const handleStatusChange = (orderId: string, newStatus: string, order: any) => {
    // If changing to confirmed from pending, show dialog to set delivery fee and tax
    if (newStatus === 'confirmed' && order.status === 'pending') {
      setOrderToConfirm(order);
      setConfirmOrderDialogOpen(true);
    } else {
      updateOrderStatus.mutate({ orderId, status: newStatus });
    }
  };

  const handleConfirmOrder = () => {
    if (!orderToConfirm) return;
    
    updateOrderStatus.mutate({ 
      orderId: orderToConfirm.id, 
      status: 'confirmed',
      deliveryFee: Number(deliveryFee),
      taxRate: Number(taxRate) / 100 // Convert percentage to decimal
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/pos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground">View and fulfill customer orders</p>
          </div>
          <Link to="/admin/offline-sync">
            <Button variant="outline">
              <Database className="h-4 w-4 mr-2" />
              Offline Sync
            </Button>
          </Link>
          <ReturnToPOSButton inline />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              All Orders
            </CardTitle>
            <div className="flex gap-2">
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="completed">Completed (POS)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {selectedOrders.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteSelectedDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedOrders.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading orders...
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={orders && selectedOrders.size === orders.length && orders.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => (
                      <Fragment key={order.id}>
                        <TableRow>
                          <TableCell>
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleOrderExpanded(order.id)}
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">
                            {order.order_number}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {order.type === 'pos' ? (
                                <>
                                  <div className="font-medium">
                                    {order.customer_name && order.customer_name !== 'Walk-in Customer' 
                                      ? order.customer_name 
                                      : 'Walk-in'}
                                  </div>
                                  {order.cashier_name && (
                                    <div className="text-xs text-muted-foreground">
                                      Cashier: {order.cashier_name}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="font-medium">{order.customer_name || 'Guest'}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.stores?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.items?.length || 0} items
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Number(order.total))}
                          </TableCell>
                          <TableCell>
                            {order.type === 'pos' ? (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                POS Sale
                              </Badge>
                            ) : (
                              getStatusBadge(order.status)
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString()}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleTimeString()}
                            </span>
                            {order.type === 'pos' && order.cashier_name && (
                              <>
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  By: {order.cashier_name}
                                </span>
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleOrderExpanded(order.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {expandedOrders.has(order.id) ? 'Hide' : 'View'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditOrder(order)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReceiptClick(order.id)}
                              >
                                <Printer className="h-4 w-4 mr-1" />
                                Print
                              </Button>
                              {order.type !== 'pos' && order.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => navigate(`/admin/pos?orderId=${order.id}`)}
                                  >
                                    <ShoppingCart className="h-4 w-4 mr-1" />
                                    Load to POS
                                  </Button>
                                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                    <Select
                                      value={order.status}
                                      onValueChange={(value) => handleStatusChange(order.id, value, order)}
                                    >
                                      <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="confirmed">Confirmed</SelectItem>
                                        <SelectItem value="processing">Processing</SelectItem>
                                        <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedOrders.has(order.id) && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/50">
                              <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-semibold">
                                    {order.type === 'pos' ? 'Sale Items' : 'Order Products'}
                                  </h4>
                                  <div className="flex items-center gap-3">
                                    {order.type !== 'pos' && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSelectedOrderId(order.id);
                                          setAddProductDialogOpen(true);
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Product
                                      </Button>
                                    )}
                                    {order.addresses && (
                                      <span className="text-sm text-muted-foreground">
                                        Delivery: {order.addresses?.address_line1}, {order.addresses?.city}
                                      </span>
                                    )}
                                    {order.type === 'pos' && (
                                      <span className="text-sm text-muted-foreground">
                                        Payment: {order.payment_method}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {order.items && order.items.length > 0 ? (
                                  <div className="space-y-3">
                                    {order.type === 'pos' ? (
                                      // POS items display (now editable with price and discount)
                                      order.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex flex-col gap-3 p-4 bg-background rounded-lg border">
                                          <div className="flex items-center gap-4">
                                            {item.image_url && (
                                              <img 
                                                src={item.image_url} 
                                                alt={item.name}
                                                className="w-16 h-16 object-cover rounded"
                                              />
                                            )}
                                            <div className="flex-1">
                                              <p className="font-medium">{item.name}</p>
                                              <p className="text-sm text-muted-foreground">
                                                Original: {formatCurrency(Number(item.price))} each
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                size="icon"
                                                variant="outline"
                                                disabled={item.quantity <= 1}
                                                onClick={() => updateOrderItem.mutate({ 
                                                  itemId: item.id, 
                                                  quantity: item.quantity - 1,
                                                  orderId: order.id,
                                                  orderType: 'pos'
                                                })}
                                              >
                                                <Minus className="h-4 w-4" />
                                              </Button>
                                              <span className="w-12 text-center font-medium">
                                                {item.quantity}
                                              </span>
                                              <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => updateOrderItem.mutate({ 
                                                  itemId: item.id, 
                                                  quantity: item.quantity + 1,
                                                  orderId: order.id,
                                                  orderType: 'pos'
                                                })}
                                              >
                                                <Plus className="h-4 w-4" />
                                              </Button>
                                            </div>
                                            <div className="w-32 text-right">
                                              <p className="font-semibold">
                                                {formatCurrency((Number(item.customPrice ?? item.price) * item.quantity) - (Number(item.itemDiscount ?? 0)))}
                                              </p>
                                            </div>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="text-destructive"
                                              onClick={() => {
                                                if (confirm('Remove this item from the sale?')) {
                                                  deleteOrderItem.mutate({
                                                    itemId: item.id,
                                                    orderId: order.id,
                                                    orderType: 'pos'
                                                  });
                                                }
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="flex items-center gap-4 pl-20">
                                            <div className="flex items-center gap-2">
                                              <label className="text-sm text-muted-foreground w-20">Unit Price:</label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                className="w-32"
                                                defaultValue={Number(item.customPrice ?? item.price).toFixed(2)}
                                                onBlur={(e) => {
                                                  const newPrice = parseFloat(e.target.value);
                                                  if (!isNaN(newPrice) && newPrice !== (item.customPrice ?? item.price)) {
                                                    updatePOSItemPrice.mutate({
                                                      itemId: item.id,
                                                      orderId: order.id,
                                                      price: newPrice
                                                    });
                                                  }
                                                }}
                                              />
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <label className="text-sm text-muted-foreground w-20">Discount:</label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                className="w-32"
                                                defaultValue={Number(item.itemDiscount ?? 0).toFixed(2)}
                                                onBlur={(e) => {
                                                  const newDiscount = parseFloat(e.target.value);
                                                  if (!isNaN(newDiscount) && newDiscount !== (item.itemDiscount ?? 0)) {
                                                    updatePOSItemPrice.mutate({
                                                      itemId: item.id,
                                                      orderId: order.id,
                                                      discount: newDiscount
                                                    });
                                                  }
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      // Online order items display (editable)
                                      order.items.map((item: any) => (
                                        <div key={item.id} className="flex items-center gap-4 p-3 bg-background rounded-lg border">
                                          {item.products?.image_url && (
                                            <img 
                                              src={item.products.image_url} 
                                              alt={item.products?.name}
                                              className="w-16 h-16 object-cover rounded"
                                            />
                                          )}
                                          <div className="flex-1">
                                            <p className="font-medium">{item.products?.name || 'Unknown Product'}</p>
                                            <p className="text-sm text-muted-foreground">
                                              {formatCurrency(Number(item.unit_price))} / {item.products?.unit}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              disabled={item.quantity <= 1}
                                              onClick={() => updateOrderItem.mutate({ 
                                                itemId: item.id, 
                                                quantity: item.quantity - 1,
                                                orderId: order.id,
                                                orderType: 'online'
                                              })}
                                            >
                                              <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="w-12 text-center font-medium">
                                              {item.quantity}
                                            </span>
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              onClick={() => updateOrderItem.mutate({ 
                                                itemId: item.id, 
                                                quantity: item.quantity + 1,
                                                orderId: order.id,
                                                orderType: 'online'
                                              })}
                                            >
                                              <Plus className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <div className="w-32 text-right">
                                            <p className="font-semibold">
                                              {formatCurrency(Number(item.subtotal))}
                                            </p>
                                          </div>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-destructive"
                                            onClick={() => {
                                              if (confirm('Remove this item from the order?')) {
                                                deleteOrderItem.mutate({
                                                  itemId: item.id,
                                                  orderId: order.id,
                                                  orderType: 'online'
                                                });
                                              }
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground text-center py-4">
                                    No items in this {order.type === 'pos' ? 'sale' : 'order'}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No orders found
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />

      {/* Confirm Order Dialog */}
      <Dialog open={confirmOrderDialogOpen} onOpenChange={setConfirmOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order #{orderToConfirm?.order_number}</DialogTitle>
            <DialogDescription>
              Set delivery fees and tax for this order before confirming
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer</label>
              <p className="text-sm text-muted-foreground">{orderToConfirm?.customer_name}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Order Subtotal</label>
              <p className="text-lg font-semibold">{formatCurrency(Number(orderToConfirm?.subtotal || 0))}</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="delivery-fee" className="text-sm font-medium">
                Delivery Fee (FCFA)
              </label>
              <Input
                id="delivery-fee"
                type="number"
                min="0"
                step="100"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tax-rate" className="text-sm font-medium">
                Tax Rate (%)
              </label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(Number(orderToConfirm?.subtotal || 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee:</span>
                <span>{formatCurrency(Number(deliveryFee || 0))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                <span>{formatCurrency(Number(orderToConfirm?.subtotal || 0) * (Number(taxRate || 0) / 100))}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-primary">
                  {formatCurrency(
                    Number(orderToConfirm?.subtotal || 0) + 
                    Number(deliveryFee || 0) + 
                    (Number(orderToConfirm?.subtotal || 0) * (Number(taxRate || 0) / 100))
                  )}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setConfirmOrderDialogOpen(false);
                  setOrderToConfirm(null);
                  setDeliveryFee("0");
                  setTaxRate("0");
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleConfirmOrder}
                disabled={updateOrderStatus.isPending}
              >
                {updateOrderStatus.isPending ? "Confirming..." : "Confirm Order"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product to Order</DialogTitle>
            <DialogDescription>
              Search and select a product to add to this order
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Input
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {availableProducts?.map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    if (selectedOrderId) {
                      addProductToOrder.mutate({
                        orderId: selectedOrderId,
                        productId: product.id
                      });
                    }
                  }}
                >
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(Number(product.price))} / {product.unit}
                    </p>
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
              {availableProducts?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No products found
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Selected Orders Confirmation Dialog */}
      <AlertDialog open={deleteSelectedDialogOpen} onOpenChange={setDeleteSelectedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedOrders.size} selected order{selectedOrders.size > 1 ? 's' : ''} and their items from the database. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSelectedOrders.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSelectedOrders.isPending ? "Deleting..." : `Delete ${selectedOrders.size} Order${selectedOrders.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Options Dialog */}
      <Dialog open={showReceiptOptions} onOpenChange={setShowReceiptOptions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receipt Options</DialogTitle>
            <DialogDescription>
              Choose how you want to handle this receipt
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleDirectPrint}
              className="w-full bg-primary"
            >
              <Printer className="h-4 w-4 mr-2" />
              Direct Print (Kiosk Mode)
            </Button>
            <Button
              onClick={() => {
                handlePrintReceipt();
                setShowReceiptOptions(false);
              }}
              variant="secondary"
              className="w-full"
            >
              <Printer className="h-4 w-4 mr-2" />
              Browser Print
            </Button>
            <Button
              onClick={() => {
                handleSaveReceiptPDF();
                setShowReceiptOptions(false);
              }}
              variant="secondary"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
            <Button
              onClick={() => {
                handleSendReceiptWhatsApp();
                setShowReceiptOptions(false);
              }}
              variant="outline"
              className="w-full"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Send via WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Receipt for Printing and PDF */}
      {selectedReceiptOrder && (
        <div className="fixed -left-[9999px] top-0 bg-white">
          <Receipt
            ref={receiptRef}
            transactionNumber={selectedReceiptOrder.order_number}
            date={new Date(selectedReceiptOrder.created_at)}
            items={selectedReceiptOrder.items.map((item: any) => ({
              name: item.products?.name || item.name,
              quantity: item.quantity,
              price: item.customPrice ?? item.products?.price ?? item.unit_price ?? item.price,
              customPrice: item.customPrice,
              itemDiscount: item.itemDiscount || 0,
            }))}
            subtotal={Number(selectedReceiptOrder.subtotal)}
            discount={Number(selectedReceiptOrder.discount || 0)}
            customerName={selectedReceiptOrder.customer_name && selectedReceiptOrder.customer_name !== 'Walk-in Customer' ? selectedReceiptOrder.customer_name : undefined}
            tax={Number(selectedReceiptOrder.tax || 0)}
            total={Number(selectedReceiptOrder.total)}
            paymentMethod={(selectedReceiptOrder.payment_method || 'Online').toUpperCase()}
            cashierName={selectedReceiptOrder.type === 'pos' ? selectedReceiptOrder.cashier_name : undefined}
            storeName={selectedReceiptOrder.stores?.name || settings?.company_name || 'Global Market'}
            logoUrl={settings?.logo_url}
            supportPhone={settings?.company_phone}
            customerBalance={selectedReceiptOrder.customerBalance}
          />
        </div>
      )}
    </div>
  );
}
