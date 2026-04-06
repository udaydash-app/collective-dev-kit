import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Trash2, Package, Search, Eye, Edit, X, Upload, Download, FileSpreadsheet, FileText, CalendarIcon, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format as formatDateFns } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PurchasePaymentDialog } from '@/components/admin/PurchasePaymentDialog';
import { PurchaseUploadDialog } from '@/components/admin/PurchaseUploadDialog';

interface PurchaseItem {
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_cost: number;
  local_charges: number;
  total_cost: number;
  product_name?: string;
  variant_label?: string;
}

// State preservation helpers for navigating to add new product
const PURCHASE_FORM_STATE_KEY = 'purchaseFormState';
const STATE_EXPIRY_HOURS = 1;

interface SavedPurchaseFormState {
  items: PurchaseItem[];
  selectedSupplier: string;
  selectedStore: string;
  paymentStatus: string;
  paymentMethod: string;
  notes: string;
  editingPurchaseId?: string; // Track if we're editing an existing purchase
  timestamp: number;
}

const savePurchaseFormState = (state: Omit<SavedPurchaseFormState, 'timestamp'>) => {
  const stateWithTimestamp: SavedPurchaseFormState = {
    ...state,
    timestamp: Date.now(),
  };
  sessionStorage.setItem(PURCHASE_FORM_STATE_KEY, JSON.stringify(stateWithTimestamp));
};

const restorePurchaseFormState = (): SavedPurchaseFormState | null => {
  const saved = sessionStorage.getItem(PURCHASE_FORM_STATE_KEY);
  if (!saved) return null;
  
  try {
    const state: SavedPurchaseFormState = JSON.parse(saved);
    // Check if state is expired (older than 1 hour)
    const isExpired = Date.now() - state.timestamp > STATE_EXPIRY_HOURS * 60 * 60 * 1000;
    if (isExpired) {
      clearPurchaseFormState();
      return null;
    }
    return state;
  } catch (error) {
    console.error('Error restoring purchase form state:', error);
    return null;
  }
};

const clearPurchaseFormState = () => {
  sessionStorage.removeItem(PURCHASE_FORM_STATE_KEY);
};

export default function Purchases() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [pendingPaymentPurchase, setPendingPaymentPurchase] = useState<any>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedPurchases, setSelectedPurchases] = useState<Set<string>>(new Set());
  const [viewDialogSearch, setViewDialogSearch] = useState('');

  // Filter states for purchase history
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  
  const lastItemRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Auto-focus on newly added product - with delay to ensure dialog is rendered
  useEffect(() => {
    if (items.length > 0 && (showNewPurchase || showEditDialog) && lastItemRef.current) {
      // Small delay to ensure the dialog and inputs are rendered
      setTimeout(() => {
        if (lastItemRef.current) {
          lastItemRef.current.focus();
          lastItemRef.current.select();
        }
      }, 100);
    }
  }, [items.length, showNewPurchase, showEditDialog]);

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

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('is_supplier', true)
        .order('name');
      return data || [];
    },
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select(`
          *,
          stores (name),
          purchase_items (
            id,
            product_id,
            variant_id,
            quantity,
            unit_cost,
            local_charges,
            total_cost,
            created_at,
            products (id, name),
            product_variants (id, label, quantity, unit)
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-purchase', searchTerm],
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
            cost_price,
            is_available
          )
        `)
        .eq('is_available', true);

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data } = await query.limit(20);
      return data || [];
    },
    enabled: showProductSearch && searchTerm.length > 0,
  });

  // Auto-select newly created product from Products page and restore form state
  useEffect(() => {
    const newProductId = location.state?.newProductId;
    if (newProductId) {
      // Fetch the specific product
      const fetchNewProduct = async () => {
        const { data: product } = await supabase
          .from('products')
          .select(`
            *,
            product_variants (
              id,
              label,
              quantity,
              unit,
              price,
              cost_price,
              is_available
            )
          `)
          .eq('id', newProductId)
          .single();
        
        if (product) {
          // Restore saved form state if available
          const savedState = restorePurchaseFormState();
          
          if (savedState) {
            // Restore all form fields
            setSelectedSupplier(savedState.selectedSupplier);
            setSelectedStore(savedState.selectedStore);
            setPaymentStatus(savedState.paymentStatus);
            setPaymentMethod(savedState.paymentMethod);
            setNotes(savedState.notes);
            
            // Add the newly created product to the restored items
            const unitCost = product.cost_price || product.price;
            const newItem: PurchaseItem = {
              product_id: product.id,
              quantity: 1,
              unit_cost: Number(unitCost),
              local_charges: 0,
              total_cost: Number(unitCost),
              product_name: product.name,
            };
            
            // Check if product already exists in saved items
            const existingIndex = savedState.items.findIndex(
              item => item.product_id === product.id && !item.variant_id
            );
            
            let updatedItems: PurchaseItem[];
            if (existingIndex >= 0) {
              // Increment quantity if product exists
              updatedItems = [...savedState.items];
              updatedItems[existingIndex].quantity += 1;
              updatedItems[existingIndex].total_cost = 
                updatedItems[existingIndex].quantity * (updatedItems[existingIndex].unit_cost + updatedItems[existingIndex].local_charges);
            } else {
              // Add new item
              updatedItems = [...savedState.items, newItem];
            }
            
            setItems(updatedItems);
            
            // Check if we were editing an existing purchase
            if (savedState.editingPurchaseId) {
              // Wait for purchases to load before trying to restore
              if (!purchases || purchasesLoading) {
                // Purchases not loaded yet, will retry when they load
                return;
              }
              
              // Restore the purchase being edited
              const editPurchase = purchases.find(p => p.id === savedState.editingPurchaseId);
              if (editPurchase) {
                setSelectedPurchase(editPurchase);
                setShowEditDialog(true);
              } else {
                // Fallback to new purchase if the edited purchase is no longer found
                setShowNewPurchase(true);
              }
            } else {
              // Open new purchase dialog
              setShowNewPurchase(true);
            }
            
            // Clear the saved state after restoration
            clearPurchaseFormState();
            
            toast.success(`"${product.name}" added to purchase`);
          } else {
            // No saved state, just add the product normally
            addProductToItems(product);
            toast.success(`"${product.name}" added to purchase`);
          }
        }
      };
      
      fetchNewProduct();
      // Clear the navigation state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.newProductId, purchases, purchasesLoading]);

  // Auto-select newly created supplier from Contacts page
  useEffect(() => {
    const newSupplierId = location.state?.newSupplierId;
    if (newSupplierId) {
      setSelectedSupplier(newSupplierId);
      setShowNewPurchase(true); // Reopen the dialog
      
      // Fetch the supplier details to show success message
      const fetchNewSupplier = async () => {
        const { data: supplier } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('id', newSupplierId)
          .single();
        
        if (supplier) {
          toast.success(`Supplier "${supplier.name}" selected`);
        }
      };
      
      fetchNewSupplier();
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.newSupplierId]);

  const createPurchaseMutation = useMutation({
    mutationFn: async (paymentDetails?: Array<{method: string; amount: number}>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get supplier details
      const supplier = suppliers?.find(s => s.id === selectedSupplier);
      if (!supplier) throw new Error('Supplier not found');

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      // Determine payment method display
      const displayMethod = paymentDetails && paymentDetails.length > 1 
        ? 'Multiple' 
        : paymentDetails?.[0]?.method || paymentMethod || 'cash';

      // Create purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          store_id: selectedStore,
          supplier_name: supplier.name,
          supplier_contact: supplier.phone || supplier.email || '',
          total_amount: totalAmount,
          payment_status: paymentStatus,
          payment_method: displayMethod,
          payment_details: paymentDetails || [],
          notes: notes,
          purchased_by: user.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items and inventory layers
      const purchaseItems = items.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        local_charges: item.local_charges,
        total_cost: item.total_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Journal entries are automatically created by database trigger (create_purchase_journal_entry)

      return purchase;
    },
    onSuccess: () => {
      toast.success('Purchase created and stock updated!');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetForm();
      setShowNewPurchase(false);
    },
    onError: (error) => {
      toast.error(`Failed to create purchase: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedSupplier('');
    setSelectedStore('');
    setPaymentStatus('pending');
    setPaymentMethod('');
    setNotes('');
    setItems([]);
    // Clear any saved form state
    clearPurchaseFormState();
  };

  const addProductToItems = (product: any, variant?: any) => {
    const existingIndex = items.findIndex(
      item => item.product_id === product.id && item.variant_id === variant?.id
    );

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total_cost = updated[existingIndex].quantity * (updated[existingIndex].unit_cost + updated[existingIndex].local_charges);
      setItems(updated);
    } else {
      const unitCost = variant ? (variant.cost_price || variant.price) : (product.cost_price || product.price);
      setItems([
        ...items,
        {
          product_id: product.id,
          variant_id: variant?.id,
          quantity: 1,
          unit_cost: Number(unitCost),
          local_charges: 0,
          total_cost: Number(unitCost),
          product_name: product.name,
          variant_label: variant ? (variant.label || `${variant.quantity}${variant.unit}`) : undefined,
        },
      ]);
    }
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Handle create purchase click
  const handleCreatePurchase = () => {
    if (!selectedSupplier || !selectedStore || items.length === 0) {
      return;
    }

    // If payment status is paid or partial, show payment dialog
    if (paymentStatus === 'paid' || paymentStatus === 'partial') {
      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);
      setPendingPaymentPurchase({ totalAmount, isNew: true });
      setShowPaymentDialog(true);
    } else {
      // For pending, create directly
      createPurchaseMutation.mutate(undefined);
    }
  };

  // Handle payment confirmation for new or updated purchase
  const handlePaymentConfirm = async (payments: Array<{id: string; method: string; amount: number}>) => {
    const paymentDetails = payments.map(p => ({ method: p.method, amount: p.amount }));
    
    // Check if we're updating an existing purchase (selectedPurchase is set)
    if (selectedPurchase) {
      await updatePurchaseMutation.mutateAsync({ paymentDetails });
    } else if (pendingPaymentPurchase?.isNew) {
      // Only create new if we don't have a selectedPurchase
      await createPurchaseMutation.mutateAsync(paymentDetails);
    }
    
    setShowPaymentDialog(false);
    setPendingPaymentPurchase(null);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }
    const updated = [...items];
    updated[index].quantity = quantity;
    updated[index].total_cost = quantity * (updated[index].unit_cost + updated[index].local_charges);
    setItems(updated);
  };

  const updateItemCost = (index: number, cost: number) => {
    const updated = [...items];
    updated[index].unit_cost = cost;
    updated[index].total_cost = (cost + updated[index].local_charges) * updated[index].quantity;
    setItems(updated);
  };

  const updateItemLocalCharges = (index: number, charges: number) => {
    const updated = [...items];
    updated[index].local_charges = charges;
    updated[index].total_cost = (updated[index].unit_cost + charges) * updated[index].quantity;
    setItems(updated);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      // Delete purchase items first
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', purchaseId);

      if (itemsError) throw itemsError;

      // Delete purchase
      const { error: purchaseError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);

      if (purchaseError) throw purchaseError;
    },
    onSuccess: () => {
      toast.success('Purchase deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete purchase: ${error.message}`);
    },
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: async ({ paymentDetails }: { paymentDetails?: Array<{method: string; amount: number}> }) => {
      if (!selectedPurchase) throw new Error('No purchase selected');

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);

      // Get supplier details
      const supplier = suppliers?.find(s => s.id === selectedSupplier);
      if (!supplier) throw new Error('Supplier not found');

      // Determine payment method display
      const displayMethod = paymentDetails && paymentDetails.length > 1 
        ? 'Multiple' 
        : paymentDetails?.[0]?.method || paymentMethod || selectedPurchase.payment_method;

      // Delete existing purchase items first
      await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', selectedPurchase.id);

      // Create new purchase items before updating purchase (so trigger can read them)
      const purchaseItems = items.map(item => ({
        purchase_id: selectedPurchase.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        local_charges: item.local_charges,
        total_cost: item.total_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Update purchase AFTER items are saved so the trigger can read local_charges
      const { error: purchaseError } = await supabase
        .from('purchases')
        .update({
          supplier_name: supplier.name,
          supplier_contact: supplier.phone || supplier.email || null,
          store_id: selectedStore,
          payment_status: paymentStatus,
          payment_method: displayMethod,
          payment_details: paymentDetails || selectedPurchase.payment_details || [],
          notes: notes,
          total_amount: totalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPurchase.id);

      if (purchaseError) throw purchaseError;
      // Journal entries are automatically created/updated by database trigger
    },
    onSuccess: () => {
      toast.success('Purchase updated successfully');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetForm();
      setShowEditDialog(false);
      setSelectedPurchase(null);
    },
    onError: (error) => {
      toast.error(`Failed to update purchase: ${error.message}`);
    },
  });

  const handleViewPurchase = (purchase: any) => {
    setSelectedPurchase(purchase);
    setViewDialogSearch(''); // Reset search when opening dialog
    setShowViewDialog(true);
  };

  // Handle update purchase click
  const handleUpdatePurchase = () => {
    if (items.length === 0) {
      return;
    }

    // If payment status changed to paid or partial, and it wasn't before
    const wasNotPaid = selectedPurchase?.payment_status === 'pending';
    const isNowPaid = paymentStatus === 'paid' || paymentStatus === 'partial';
    
    if (wasNotPaid && isNowPaid) {
      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);
      setPendingPaymentPurchase({ totalAmount, isNew: false });
      setShowPaymentDialog(true);
    } else {
      // No payment change or already paid
      updatePurchaseMutation.mutate({ paymentDetails: undefined });
    }
  };

  const handleEditPurchase = (purchase: any) => {
    setSelectedPurchase(purchase);
    
    // Find supplier ID by name
    const supplier = suppliers?.find(s => s.name === purchase.supplier_name);
    setSelectedSupplier(supplier?.id || '');
    setSelectedStore(purchase.store_id);
    setPaymentStatus(purchase.payment_status);
    setPaymentMethod(purchase.payment_method || '');
    setNotes(purchase.notes || '');
    
    // Load items
    const purchaseItems = purchase.purchase_items.map((item: any) => ({
      product_id: item.product_id,
      variant_id: item.variant_id || undefined,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      local_charges: item.local_charges || 0,
      total_cost: item.total_cost,
      product_name: item.products?.name || '',
      variant_label: item.product_variants ? 
        (item.product_variants.label || `${item.product_variants.quantity}${item.product_variants.unit}`) : 
        undefined,
    }));
    
    setItems(purchaseItems);
    setShowEditDialog(true);
  };

  const handleDeletePurchase = (purchaseId: string) => {
    if (confirm('Are you sure you want to delete this purchase?')) {
      deletePurchaseMutation.mutate(purchaseId);
    }
  };

  const togglePurchaseSelection = (purchaseId: string) => {
    setSelectedPurchases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(purchaseId)) {
        newSet.delete(purchaseId);
      } else {
        newSet.add(purchaseId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPurchases.size === purchases?.length) {
      setSelectedPurchases(new Set());
    } else {
      setSelectedPurchases(new Set(purchases?.map((p: any) => p.id) || []));
    }
  };

  const exportToExcel = () => {
    if (selectedPurchases.size === 0) {
      toast.error('Please select at least one purchase to export');
      return;
    }

    const selectedData = purchases?.filter((p: any) => selectedPurchases.has(p.id)) || [];
    
    const exportData = selectedData.flatMap((purchase: any) => 
      purchase.purchase_items.map((item: any) => ({
        'Purchase Number': purchase.purchase_number,
        'Date': formatDate(purchase.purchased_at),
        'Supplier': purchase.supplier_name,
        'Store': purchase.stores.name,
        'Product': item.products?.name || '',
        'Variant': item.product_variants ? 
          (item.product_variants.label || `${item.product_variants.quantity}${item.product_variants.unit}`) : 
          '-',
        'Quantity': item.quantity,
        'Unit Cost': item.unit_cost,
        'Total Cost': item.total_cost,
        'Payment Status': purchase.payment_status,
        'Payment Method': purchase.payment_method || '-',
        'Notes': purchase.notes || '-'
      }))
    );

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    
    // Auto-size columns
    const maxWidth = exportData.reduce((w: any, r: any) => {
      return Object.keys(r).reduce((acc: any, key: string) => {
        const value = r[key]?.toString() || '';
        acc[key] = Math.max(acc[key] || 10, value.length);
        return acc;
      }, w);
    }, {});
    
    ws['!cols'] = Object.keys(maxWidth).map(key => ({ wch: maxWidth[key] + 2 }));
    
    XLSX.writeFile(wb, `purchases_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Purchases exported to Excel successfully');
  };

  const exportToPDF = () => {
    if (selectedPurchases.size === 0) {
      toast.error('Please select at least one purchase to export');
      return;
    }

    const selectedData = purchases?.filter((p: any) => selectedPurchases.has(p.id)) || [];
    
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Purchase Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${formatDate(new Date())}`, 14, 30);
    
    let yPos = 40;
    
    selectedData.forEach((purchase: any, index: number) => {
      if (index > 0) {
        yPos += 10;
      }
      
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Purchase: ${purchase.purchase_number}`, 14, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${formatDate(purchase.purchased_at)}`, 14, yPos);
      doc.text(`Supplier: ${purchase.supplier_name}`, 80, yPos);
      yPos += 5;
      doc.text(`Store: ${purchase.stores.name}`, 14, yPos);
      doc.text(`Status: ${purchase.payment_status}`, 80, yPos);
      doc.text(`Method: ${purchase.payment_method || '-'}`, 130, yPos);
      yPos += 8;
      
      const tableData = purchase.purchase_items.map((item: any) => [
        item.products?.name || '',
        item.product_variants ? 
          (item.product_variants.label || `${item.product_variants.quantity}${item.product_variants.unit}`) : 
          '-',
        item.quantity,
        formatCurrency(item.unit_cost),
        formatCurrency(item.total_cost)
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Product', 'Variant', 'Qty', 'Unit Cost', 'Total']],
        body: tableData,
        foot: [[{ content: 'Total:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, 
                { content: formatCurrency(purchase.total_amount), styles: { fontStyle: 'bold' } }]],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        footStyles: { fillColor: [240, 240, 240] },
        margin: { left: 14 },
        tableWidth: 180,
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 5;
      
      if (purchase.notes) {
        doc.setFontSize(9);
        doc.text(`Notes: ${purchase.notes}`, 14, yPos);
        yPos += 5;
      }
    });
    
    doc.save(`purchases_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Purchases exported to PDF successfully');
  };

  // Filtered purchases based on search/filter state
  const filteredPurchases = (purchases || []).filter((purchase: any) => {
    if (filterProduct) {
      const term = filterProduct.toLowerCase();
      const matchesPurchaseNumber = purchase.purchase_number?.toLowerCase().includes(term);
      const matchesProduct = purchase.purchase_items?.some((item: any) =>
        item.products?.name?.toLowerCase().includes(term)
      );
      if (!matchesPurchaseNumber && !matchesProduct) return false;
    }
    if (filterSupplier && filterSupplier !== 'all') {
      if (purchase.supplier_name !== filterSupplier) return false;
    }
    if (filterPaymentStatus && filterPaymentStatus !== 'all') {
      if (purchase.payment_status !== filterPaymentStatus) return false;
    }
    if (filterDateFrom) {
      const purchaseDate = new Date(purchase.purchased_at);
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      if (purchaseDate < from) return false;
    }
    if (filterDateTo) {
      const purchaseDate = new Date(purchase.purchased_at);
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (purchaseDate > to) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Purchase Management</h1>
            <p className="text-muted-foreground">Track inventory purchases and update stock</p>
          </div>
          <div className="flex gap-2">
            <ReturnToPOSButton inline />
            {selectedPurchases.size > 0 && (
              <>
                <Button onClick={exportToExcel} variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel ({selectedPurchases.size})
                </Button>
                <Button onClick={exportToPDF} variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF ({selectedPurchases.size})
                </Button>
              </>
            )}
            <Button onClick={() => setShowUploadDialog(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Excel
            </Button>
            <Button onClick={() => setShowNewPurchase(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Purchase
            </Button>
          </div>
        </div>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle>Purchase History</CardTitle>
                {purchases && purchases.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    {selectedPurchases.size === filteredPurchases.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>

              {/* Search & Filter Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Purchase # / Product search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Purchase # or product..."
                    value={filterProduct}
                    onChange={(e) => setFilterProduct(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Supplier filter */}
                <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                  <SelectTrigger>
                    <SelectValue placeholder="All suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Payment status filter */}
                <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date From */}
                <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateFrom ? formatDateFns(filterDateFrom, 'dd/MM/yyyy') : 'From date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDateFrom}
                      onSelect={(d) => { setFilterDateFrom(d); setDateFromOpen(false); }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {/* Date To */}
                <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDateTo ? formatDateFns(filterDateTo, 'dd/MM/yyyy') : 'To date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDateTo}
                      onSelect={(d) => { setFilterDateTo(d); setDateToOpen(false); }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Active filters summary + clear */}
              {(filterProduct || (filterSupplier && filterSupplier !== 'all') || (filterPaymentStatus && filterPaymentStatus !== 'all') || filterDateFrom || filterDateTo) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    <Filter className="inline h-3 w-3 mr-1" />
                    {filteredPurchases.length} of {purchases?.length || 0} results
                  </span>
                  {filterProduct && <Badge variant="secondary">{filterProduct} <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilterProduct('')} /></Badge>}
                  {filterSupplier && filterSupplier !== 'all' && <Badge variant="secondary">{filterSupplier} <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilterSupplier('')} /></Badge>}
                  {filterPaymentStatus && filterPaymentStatus !== 'all' && <Badge variant="secondary">{filterPaymentStatus} <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilterPaymentStatus('')} /></Badge>}
                  {filterDateFrom && <Badge variant="secondary">From: {formatDateFns(filterDateFrom, 'dd/MM/yy')} <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilterDateFrom(undefined)} /></Badge>}
                  {filterDateTo && <Badge variant="secondary">To: {formatDateFns(filterDateTo, 'dd/MM/yy')} <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilterDateTo(undefined)} /></Badge>}
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setFilterProduct(''); setFilterSupplier(''); setFilterPaymentStatus(''); setFilterDateFrom(undefined); setFilterDateTo(undefined); }}>
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchasesLoading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : filteredPurchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No purchases found matching your filters.</p>
              ) : (
                filteredPurchases.map((purchase: any) => (
                  <div key={purchase.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedPurchases.has(purchase.id)}
                        onChange={() => togglePurchaseSelection(purchase.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <div className="flex-1">
                        <p className="font-semibold">{purchase.purchase_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {purchase.supplier_name} • {purchase.stores?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(purchase.total_amount)}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {purchase.payment_status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {purchase.purchase_items.length} items • {formatDate(purchase.purchased_at)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPurchase(purchase)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPurchase(purchase)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePurchase(purchase.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* New Purchase Dialog */}
      <Dialog 
        open={showNewPurchase} 
        onOpenChange={(open) => {
          setShowNewPurchase(open);
          // Clear saved state if dialog is being closed
          if (!open) {
            clearPurchaseFormState();
          }
        }}
      >
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create New Purchase</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Header Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="supplier" className="text-sm font-semibold">Supplier *</Label>
                    <div className="flex gap-2">
                      <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                        <SelectTrigger id="supplier" className="mt-1 flex-1">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers?.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                              {(supplier.phone || supplier.email) && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {supplier.phone || supplier.email}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mt-1"
                        onClick={() => navigate('/admin/contacts', { 
                          state: { openAddDialog: true, fromPurchases: true } 
                        })}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="store" className="text-sm font-semibold">Store *</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger id="store" className="mt-1">
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

                  <div>
                    <Label htmlFor="payment-status" className="text-sm font-semibold">Payment Status</Label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger id="payment-status" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="payment-method" className="text-sm font-semibold">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method" className="mt-1">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="wave_money">Wave Money</SelectItem>
                      <SelectItem value="orange_money">Orange Money</SelectItem>
                      <SelectItem value="store_credit">Store Credit</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Products Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Purchase Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No items added yet. Click "Add Product" to begin.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[30%]">Product</TableHead>
                          <TableHead className="w-[12%] text-center">Quantity</TableHead>
                          <TableHead className="w-[15%] text-right">Unit Cost CIF</TableHead>
                          <TableHead className="w-[15%] text-right">Local Charges</TableHead>
                          <TableHead className="w-[18%] text-right">Total</TableHead>
                          <TableHead className="w-[10%] text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.variant_label && (
                                  <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                ref={index === items.length - 1 ? lastItemRef : null}
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                                min="1"
                                className="w-20 mx-auto text-center"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                                className="w-28 ml-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.local_charges}
                                onChange={(e) => updateItemLocalCharges(index, parseFloat(e.target.value) || 0)}
                                className="w-28 ml-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">{formatCurrency(item.total_cost)}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
                    </Table>
                  </div>
                )}

                {/* Add Product Button at Bottom */}
                <Button
                  onClick={() => setShowProductSearch(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="notes" className="text-sm font-semibold">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or remarks..."
                  rows={3}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="border-t pt-4 mt-4 bg-background space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-lg font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  clearPurchaseFormState();
                  setShowNewPurchase(false);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePurchase}
                disabled={!selectedSupplier || !selectedStore || items.length === 0 || createPurchaseMutation.isPending}
                className="flex-1"
              >
                {createPurchaseMutation.isPending ? 'Creating...' : 'Create Purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          resetForm();
          setSelectedPurchase(null);
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Purchase</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Header Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-supplier" className="text-sm font-semibold">Supplier *</Label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger id="edit-supplier" className="mt-1">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                            {(supplier.phone || supplier.email) && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {supplier.phone || supplier.email}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-store" className="text-sm font-semibold">Store *</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger id="edit-store" className="mt-1">
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

                  <div>
                    <Label htmlFor="edit-payment-status" className="text-sm font-semibold">Payment Status</Label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger id="edit-payment-status" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-payment-method" className="text-sm font-semibold">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger id="edit-payment-method" className="mt-1">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="wave_money">Wave Money</SelectItem>
                        <SelectItem value="orange_money">Orange Money</SelectItem>
                        <SelectItem value="store_credit">Store Credit</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Purchase Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No items added yet. Click "Add Product" to begin.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[30%]">Product</TableHead>
                          <TableHead className="w-[12%] text-center">Quantity</TableHead>
                          <TableHead className="w-[15%] text-right">Unit Cost CIF</TableHead>
                          <TableHead className="w-[15%] text-right">Local Charges</TableHead>
                          <TableHead className="w-[18%] text-right">Total</TableHead>
                          <TableHead className="w-[10%] text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.variant_label && (
                                  <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                ref={index === items.length - 1 ? lastItemRef : null}
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                                min="1"
                                className="w-20 mx-auto text-center"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unit_cost}
                                onChange={(e) => updateItemCost(index, parseFloat(e.target.value) || 0)}
                                className="w-28 ml-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.local_charges}
                                onChange={(e) => updateItemLocalCharges(index, parseFloat(e.target.value) || 0)}
                                className="w-28 ml-auto text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold">{formatCurrency(item.total_cost)}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Add Product Button at Bottom */}
                <Button
                  onClick={() => setShowProductSearch(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="pt-6">
                <Label htmlFor="edit-notes" className="text-sm font-semibold">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or remarks..."
                  rows={3}
                  className="mt-1"
                />
              </CardContent>
            </Card>
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="border-t pt-4 mt-4 bg-background space-y-4">
            <div className="flex justify-between items-center px-2">
              <span className="text-lg font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  resetForm();
                  setSelectedPurchase(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdatePurchase}
                disabled={!selectedSupplier || !selectedStore || items.length === 0 || updatePurchaseMutation.isPending}
                className="flex-1"
              >
                {updatePurchaseMutation.isPending ? 'Updating...' : 'Update Purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Search Dialog */}
      <Dialog open={showProductSearch} onOpenChange={setShowProductSearch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Button
                variant="default"
                onClick={() => {
                  // Save current form state before navigating
                  savePurchaseFormState({
                    items,
                    selectedSupplier,
                    selectedStore,
                    paymentStatus,
                    paymentMethod,
                    notes,
                    editingPurchaseId: showEditDialog ? selectedPurchase?.id : undefined,
                  });
                  
                  setShowProductSearch(false);
                  navigate('/admin/products', { state: { openAddDialog: true, fromPurchases: true } });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Product
              </Button>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {products?.map((product) => {
                const variants = product.product_variants?.filter((v: any) => v.is_available) || [];
                
                return (
                  <div key={product.id} className="border rounded p-3">
                    <p className="font-medium">{product.name}</p>
                    {variants.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {variants.map((variant: any) => (
                          <Button
                            key={variant.id}
                            variant="outline"
                            size="sm"
                            className="w-full justify-between"
                            onClick={() => addProductToItems(product, variant)}
                          >
                            <span>{variant.label || `${variant.quantity}${variant.unit}`}</span>
                            <span>{formatCurrency(variant.cost_price || variant.price)}</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => addProductToItems(product)}
                      >
                        Add - {formatCurrency(product.cost_price || product.price)}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Purchase Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="mb-4">
                <Input
                  placeholder="Search items..."
                  value={viewDialogSearch}
                  onChange={(e) => setViewDialogSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Purchase Number</Label>
                  <p className="font-semibold">{selectedPurchase.purchase_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p>{formatDate(selectedPurchase.purchased_at)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Supplier</Label>
                  <p>{selectedPurchase.supplier_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Store</Label>
                  <p>{selectedPurchase.stores.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Status</Label>
                  <p className="capitalize">{selectedPurchase.payment_status}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <p>{selectedPurchase.payment_method || 'N/A'}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Items</Label>
                <div className="border rounded-lg divide-y mt-2">
                  {selectedPurchase.purchase_items
                    .filter((item: any) => 
                      item.products?.name?.toLowerCase().includes(viewDialogSearch.toLowerCase()) ||
                      item.product_variants?.label?.toLowerCase().includes(viewDialogSearch.toLowerCase())
                    )
                    .map((item: any) => (
                    <div key={item.id} className="p-3 flex justify-between">
                      <div>
                        <p className="font-medium">{item.products?.name || 'Unknown Product'}</p>
                        {item.product_variants && (
                          <p className="text-sm text-muted-foreground">
                            {item.product_variants.label || `${item.product_variants.quantity}${item.product_variants.unit}`}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × {formatCurrency(item.unit_cost)}{item.local_charges > 0 ? ` + ${formatCurrency(item.local_charges)} local` : ''}
                        </p>
                      </div>
                      <p className="font-semibold">{formatCurrency(item.total_cost)}</p>
                    </div>
                  ))}
                  {selectedPurchase.purchase_items
                    .filter((item: any) => 
                      item.products?.name?.toLowerCase().includes(viewDialogSearch.toLowerCase()) ||
                      item.product_variants?.label?.toLowerCase().includes(viewDialogSearch.toLowerCase())
                    ).length === 0 && (
                    <div className="p-3 text-center text-muted-foreground">
                      No items found
                    </div>
                  )}
                </div>
              </div>

              {selectedPurchase.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{selectedPurchase.notes}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>{formatCurrency(selectedPurchase.total_amount)}</span>
                </div>
              </div>

              <Button onClick={() => setShowViewDialog(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <PurchasePaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => {
          setShowPaymentDialog(false);
          setPendingPaymentPurchase(null);
        }}
        totalAmount={pendingPaymentPurchase?.totalAmount || 0}
        onConfirm={handlePaymentConfirm}
        currentPaymentStatus={paymentStatus}
      />

      {/* Upload Dialog */}
      <PurchaseUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        stores={stores || []}
        suppliers={suppliers || []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          toast.success('Purchase uploaded successfully');
        }}
      />

      <BottomNav />
    </div>
  );
}
