import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency, cn } from '@/lib/utils';
import { 
  Plus, 
  Trash2, 
  Search, 
  FileText, 
  Printer, 
  Download, 
  Send, 
  ShoppingCart,
  Calendar,
  User,
  Phone,
  Mail,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

interface QuotationItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

interface Quotation {
  id: string;
  quotation_number: string;
  contact_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';
  valid_until: string | null;
  created_at: string;
}

export default function Quotations() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [showNewQuotation, setShowNewQuotation] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [searchProduct, setSearchProduct] = useState('');
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [deleteQuotationId, setDeleteQuotationId] = useState<string | null>(null);

  // Auto-select newly created customer from Contacts page
  useEffect(() => {
    const newCustomerId = location.state?.newCustomerId;
    if (newCustomerId) {
      setSelectedContactId(newCustomerId);
      setShowNewQuotation(true); // Reopen the dialog

      // Fetch the customer details to show success message
      const fetchNewCustomer = async () => {
        const { data: customer } = await supabase
          .from('contacts')
          .select('id, name')
          .eq('id', newCustomerId)
          .single();

        if (customer) {
          toast.success(`Customer "${customer.name}" selected`);
        }
      };

      fetchNewCustomer();
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.newCustomerId]);

  // Fetch quotations with contact details
  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, contacts!quotations_contact_id_fkey(phone, email)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(q => {
        const contact = (q as any).contacts;
        return {
          ...q,
          items: (q.items as any) as QuotationItem[],
          // Update phone/email from contact if missing in quotation
          customer_phone: q.customer_phone || contact?.phone || null,
          customer_email: q.customer_email || contact?.email || null,
        };
      }) as Quotation[];
    }
  });

  // Fetch contacts (customers)
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_customer', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch company settings
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('company_name, company_email, company_phone, company_address, logo_url')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch products for search
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-quotation', searchProduct],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('is_available', true);
      
      if (searchProduct) {
        query = query.or(`name.ilike.%${searchProduct}%,barcode.ilike.%${searchProduct}%`);
      }
      
      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    },
    enabled: searchProduct.length > 0
  });

  // Create quotation mutation
  const createQuotationMutation = useMutation({
    mutationFn: async (quotationData: any) => {
      const { data, error } = await supabase
        .from('quotations')
        .insert([quotationData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation created successfully');
      resetForm();
      setShowNewQuotation(false);
    },
    onError: (error: any) => {
      toast.error('Failed to create quotation: ' + error.message);
    }
  });

  // Update quotation mutation
  const updateQuotationMutation = useMutation({
    mutationFn: async ({ id, quotationData }: { id: string; quotationData: any }) => {
      const { data, error } = await supabase
        .from('quotations')
        .update(quotationData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation updated successfully');
      resetForm();
      setShowNewQuotation(false);
      setEditingQuotation(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update quotation: ' + error.message);
    }
  });

  // Delete quotation mutation
  const deleteQuotationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation deleted successfully');
      setDeleteQuotationId(null);
    },
    onError: (error: any) => {
      toast.error('Failed to delete quotation: ' + error.message);
    }
  });

  const addProductToQuotation = (product: any, variant?: any) => {
    const price = variant?.price || product.price;
    const name = variant ? `${product.name} - ${variant.name}` : product.name;
    
    const newItem: QuotationItem = {
      productId: product.id,
      productName: name,
      variantId: variant?.id,
      variantName: variant?.name,
      quantity: 1,
      price: price,
      discount: 0,
      total: price
    };

    setQuotationItems([...quotationItems, newItem]);
    setSearchProduct('');
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const updated = [...quotationItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate total
    const item = updated[index];
    updated[index].total = (item.price * item.quantity) - item.discount;
    
    setQuotationItems(updated);
  };

  const removeItem = (index: number) => {
    setQuotationItems(quotationItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = quotationItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = quotationItems.reduce((sum, item) => sum + item.discount, 0);
    const total = subtotal - discount;
    
    return { subtotal, discount, total };
  };

  const handleSaveQuotation = async (status: 'draft' | 'sent' = 'draft') => {
    if (!selectedContactId || quotationItems.length === 0) {
      toast.error('Please select a customer and add items');
      return;
    }

    const selectedContact = contacts.find(c => c.id === selectedContactId);
    if (!selectedContact) {
      toast.error('Customer not found');
      return;
    }

    const { subtotal, discount, total } = calculateTotals();

    const quotationData: any = {
      contact_id: selectedContactId,
      customer_name: selectedContact.name,
      customer_email: selectedContact.email,
      customer_phone: selectedContact.phone,
      items: quotationItems,
      subtotal,
      discount,
      tax: 0, // Tax removed, keeping field for backward compatibility
      total,
      notes,
      status,
      valid_until: validUntil || null
    };

    if (editingQuotation) {
      // Update existing quotation
      updateQuotationMutation.mutate({ id: editingQuotation.id, quotationData });
    } else {
      // Create new quotation - generate quotation number
      const { data: quotationNumber } = await supabase.rpc('generate_quotation_number');
      quotationData.quotation_number = quotationNumber;
      createQuotationMutation.mutate(quotationData);
    }
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setEditingQuotation(quotation);
    setSelectedContactId(quotation.contact_id || '');
    setQuotationItems(quotation.items);
    setNotes(quotation.notes || '');
    setValidUntil(quotation.valid_until || '');
    setShowNewQuotation(true);
  };

  const resetForm = () => {
    setSelectedContactId('');
    setQuotationItems([]);
    setNotes('');
    setValidUntil('');
    setSearchProduct('');
    setEditingQuotation(null);
  };

  const handleLoadToCart = async (quotation: Quotation) => {
    const loadingToast = toast.loading('Loading quotation to cart...');
    try {
      // Clear existing cart first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.dismiss(loadingToast);
        toast.error('Please login to continue');
        return;
      }

      // Delete existing cart items
      await supabase.from('cart_items').delete().eq('user_id', user.id);

      // Add quotation items to cart
      const cartItems = quotation.items.map(item => ({
        user_id: user.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity
      }));

      const { error } = await supabase.from('cart_items').insert(cartItems);
      
      if (error) throw error;

      // Update quotation status
      await supabase
        .from('quotations')
        .update({ status: 'converted' })
        .eq('id', quotation.id);

      // Invalidate cart queries to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ['cart-items'] });
      await queryClient.invalidateQueries({ queryKey: ['quotations'] });

      toast.dismiss(loadingToast);
      toast.success('Quotation loaded to cart successfully');
      
      // Navigate to POS after a small delay to ensure data is ready
      setTimeout(() => {
        navigate('/admin/pos');
      }, 300);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error('Failed to load to cart: ' + error.message);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleDownloadPDF = () => {
    if (!selectedQuotation) return;

    try {
      // PDF-specific currency formatter to avoid line breaks
      const formatCurrencyPDF = (amount: number | null | undefined): string => {
        const value = amount ?? 0;
        // Use comma separator instead of space to avoid line breaks
        const hasDecimals = value % 1 !== 0;
        const formatted = value.toLocaleString('en-US', {
          minimumFractionDigits: hasDecimals ? 2 : 0,
          maximumFractionDigits: 2
        });
        return `${formatted} FCFA`;
      };

      // Create A4 PDF with proper margins
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPos = 10;
      
      // Company Header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      if (companySettings?.company_name) {
        doc.text(companySettings.company_name, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      }
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      if (companySettings?.company_address) {
        const address = doc.splitTextToSize(companySettings.company_address, contentWidth);
        doc.text(address, pageWidth / 2, yPos, { align: 'center' });
        yPos += address.length * 4;
      }
      
      if (companySettings?.company_phone) {
        doc.text(`Tel: ${companySettings.company_phone}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }
      
      if (companySettings?.company_email) {
        doc.text(companySettings.company_email, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }
      
      yPos += 4;
      
      // Quotation Header
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('QUOTATION', pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`#${selectedQuotation.quotation_number}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 2;
      
      // Separator line
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      
      // Customer details
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To:', margin, yPos);
      yPos += 4;
      
      doc.setFont('helvetica', 'normal');
      const customerName = doc.splitTextToSize(selectedQuotation.customer_name, contentWidth);
      doc.text(customerName, margin, yPos);
      yPos += customerName.length * 4;
      
      if (selectedQuotation.customer_phone) {
        doc.text(`Tel: ${selectedQuotation.customer_phone}`, margin, yPos);
        yPos += 4;
      }
      
      if (selectedQuotation.customer_email) {
        const email = doc.splitTextToSize(selectedQuotation.customer_email, contentWidth);
        doc.text(email, margin, yPos);
        yPos += email.length * 4;
      }
      
      yPos += 2;
      
      // Date info
      doc.text(`Date: ${format(new Date(selectedQuotation.created_at), 'dd/MM/yyyy')}`, margin, yPos);
      yPos += 4;
      
      if (selectedQuotation.valid_until) {
        doc.text(`Valid Until: ${format(new Date(selectedQuotation.valid_until), 'dd/MM/yyyy')}`, margin, yPos);
        yPos += 4;
      }
      
      yPos += 2;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      
      // Items table using autoTable
      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Unit Price', 'Discount', 'Qty', 'Total']],
        body: selectedQuotation.items.map((item: any) => [
          item.productName,
          formatCurrencyPDF(item.price),
          item.discount > 0 ? `-${formatCurrencyPDF(item.discount)}` : '0',
          item.quantity.toString(),
          formatCurrencyPDF(item.total)
        ]),
        theme: 'striped',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fontStyle: 'bold',
          fontSize: 9,
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' }, // Item name
          1: { cellWidth: 25, halign: 'right' }, // Unit Price
          2: { cellWidth: 25, halign: 'right' }, // Discount
          3: { cellWidth: 15, halign: 'center' }, // Quantity
          4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, // Total
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        margin: { left: margin, right: margin }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 8;
      
      // Check if we need a new page for totals
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }
      
      // Totals section with better spacing
      const totalsX = pageWidth - margin - 50;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrencyPDF(selectedQuotation.subtotal), pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;
      
      if (selectedQuotation.discount > 0) {
        doc.setFont('helvetica', 'normal');
        doc.text('Total Discount:', totalsX, yPos);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 53, 69); // Red color for discount
        doc.text(`-${formatCurrencyPDF(selectedQuotation.discount)}`, pageWidth - margin, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0); // Reset to black
        yPos += 6;
      }
      
      // Total line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(totalsX - 5, yPos, pageWidth - margin, yPos);
      yPos += 7;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL:', totalsX, yPos);
      doc.text(formatCurrencyPDF(selectedQuotation.total), pageWidth - margin, yPos, { align: 'right' });
      yPos += 10;
      
      // Notes
      if (selectedQuotation.notes) {
        // Check if we need a new page for notes
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', margin, yPos);
        yPos += 5;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const notes = doc.splitTextToSize(selectedQuotation.notes, contentWidth);
        doc.text(notes, margin, yPos);
        yPos += notes.length * 5 + 6;
      }
      
      // Footer
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });
      
      doc.save(`quotation-${selectedQuotation.quotation_number}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF: ' + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: 'secondary',
      sent: 'default',
      accepted: 'default',
      rejected: 'destructive',
      converted: 'default'
    };
    
    return <Badge variant={variants[status] || 'default'}>{status.toUpperCase()}</Badge>;
  };

  const { subtotal, discount, total } = calculateTotals();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quotations</h1>
            <p className="text-muted-foreground">Create and manage customer quotations</p>
          </div>
          <div className="flex items-center gap-2">
            <ReturnToPOSButton />
            <Dialog open={showNewQuotation} onOpenChange={setShowNewQuotation}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Quotation
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuotation ? 'Edit Quotation' : 'Create New Quotation'}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Customer Selection */}
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name} {contact.phone && `- ${contact.phone}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/admin/contacts?returnTo=quotations')}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add New Customer
                  </Button>
                </div>

                {/* Valid Until */}
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>

                {/* Product Search */}
                <div className="space-y-2">
                  <Label>Add Products</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products by name or barcode..."
                      value={searchProduct}
                      onChange={(e) => setSearchProduct(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchProduct && products.length > 0 && (
                    <Card className="absolute z-10 mt-1 max-h-60 overflow-auto">
                      <div className="p-2 space-y-1">
                        {products.map(product => (
                          <div key={product.id} className="space-y-1">
                            {product.product_variants && product.product_variants.length > 0 ? (
                              product.product_variants.map((variant: any) => (
                                <Button
                                  key={variant.id}
                                  variant="ghost"
                                  className="w-full justify-start"
                                  onClick={() => addProductToQuotation(product, variant)}
                                >
                                  {product.name} - {variant.name} - {formatCurrency(variant.price)}
                                </Button>
                              ))
                            ) : (
                              <Button
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => addProductToQuotation(product)}
                              >
                                {product.name} - {formatCurrency(product.price)}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>

                {/* Items Table */}
                {quotationItems.length > 0 && (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-24">Qty</TableHead>
                          <TableHead className="w-32">Price</TableHead>
                          <TableHead className="w-32">Discount</TableHead>
                          <TableHead className="w-32">Total</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotationItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value))}
                                className="w-28"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.discount}
                                onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value))}
                                className="w-28"
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(item.total)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    <div className="p-4 border-t space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount:</span>
                          <span className="font-medium">-{formatCurrency(discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Add any notes or terms..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowNewQuotation(false)}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={() => handleSaveQuotation('draft')}>
                    Save as Draft
                  </Button>
                  <Button onClick={() => handleSaveQuotation('sent')}>
                    Save & Send
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Quotations List */}
        <Card>
          <Table fixedScroll>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotationsLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No quotations yet. Create your first quotation!
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((quotation) => (
                  <TableRow key={quotation.id}>
                    <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                    <TableCell>{quotation.customer_name}</TableCell>
                    <TableCell>{quotation.customer_phone || '-'}</TableCell>
                    <TableCell className="text-sm">{quotation.customer_email || '-'}</TableCell>
                    <TableCell>{format(new Date(quotation.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {quotation.valid_until ? format(new Date(quotation.valid_until), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(quotation.total)}</TableCell>
                    <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedQuotation(quotation);
                            setViewMode(true);
                          }}
                          title="View Details"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditQuotation(quotation)}
                          title="Edit Quotation"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleLoadToCart(quotation)}
                          title="Load to Cart"
                          disabled={quotation.status === 'converted'}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={quotation.customer_phone?.trim() ? "Share via WhatsApp" : "No phone number available"}
                          disabled={!quotation.customer_phone?.trim()}
                          onClick={(e) => {
                            e.preventDefault();
                            const phone = quotation.customer_phone?.replace(/[^0-9]/g, '').trim();
                            if (!phone) {
                              toast.error('No phone number available for this customer');
                              return;
                            }
                            
                            // Use wa.me (official WhatsApp link)
                            const whatsappUrl = `https://wa.me/${phone}`;
                            console.log('Opening WhatsApp URL:', whatsappUrl);
                            
                            try {
                              // Try to open in parent/top window to escape iframe restrictions
                              if (window.top && window.top !== window.self) {
                                // We're in an iframe, open in parent
                                window.top.open(whatsappUrl, '_blank');
                              } else {
                                // Normal window, use regular open
                                window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                              }
                            } catch (error) {
                              console.error('Error opening WhatsApp:', error);
                              // Final fallback: navigate in current window
                              window.location.href = whatsappUrl;
                            }
                          }}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteQuotationId(quotation.id)}
                          title="Delete Quotation"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* View Quotation Dialog */}
        <Dialog open={viewMode} onOpenChange={setViewMode}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Quotation Details</DialogTitle>
            </DialogHeader>
            
            {selectedQuotation && (
              <>
                <div className="overflow-y-auto flex-1">
                  <div ref={printRef} className="mx-auto bg-white text-black print:bg-white print:text-black" style={{ width: '80mm', maxWidth: '302px', fontSize: '12px', padding: '10mm' }}>
                    <style>{`
                      @media print {
                        * {
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                          color-adjust: exact !important;
                        }
                        body {
                          background: white !important;
                          color: black !important;
                        }
                        .text-gray-600, .text-gray-300 {
                          color: #000 !important;
                        }
                        table, th, td {
                          color: black !important;
                        }
                      }
                    `}</style>
                  {/* Company Header */}
                  <div className="text-center mb-4 pb-3">
                    {companySettings?.logo_url && (
                      <div className="flex justify-center mb-3">
                        <img src={companySettings.logo_url} alt="Company Logo" className="h-24 w-auto object-contain" />
                      </div>
                    )}
                    {companySettings?.company_name && (
                      <p className="font-bold text-lg print:text-black">{companySettings.company_name}</p>
                    )}
                    {companySettings?.company_address && (
                      <p className="text-sm mt-1 print:text-black">{companySettings.company_address}</p>
                    )}
                    <div className="text-sm space-y-0.5 mt-1">
                      {companySettings?.company_phone && <p className="print:text-black">Tel: {companySettings.company_phone}</p>}
                      {companySettings?.company_email && <p className="break-all print:text-black">{companySettings.company_email}</p>}
                    </div>
                  </div>

                  <div className="text-center mb-4 border-t-2 border-b-2 border-black py-2">
                    <h2 className="text-xl font-bold print:text-black">QUOTATION</h2>
                    <p className="text-xs mt-1 print:text-black">#{selectedQuotation.quotation_number}</p>
                  </div>

                  <div className="mb-4 text-xs space-y-1">
                    <div className="border-b border-black pb-2 mb-2">
                      <p className="font-bold print:text-black">Bill To:</p>
                      <p className="print:text-black">{selectedQuotation.customer_name}</p>
                      {selectedQuotation.customer_phone && <p className="print:text-black">Tel: {selectedQuotation.customer_phone}</p>}
                      {selectedQuotation.customer_email && <p className="break-all print:text-black">{selectedQuotation.customer_email}</p>}
                    </div>
                    <div className="flex justify-between print:text-black">
                      <span>Date:</span>
                      <span>{format(new Date(selectedQuotation.created_at), 'dd/MM/yyyy')}</span>
                    </div>
                    {selectedQuotation.valid_until && (
                      <div className="flex justify-between print:text-black">
                        <span>Valid Until:</span>
                        <span>{format(new Date(selectedQuotation.valid_until), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-black">
                          <th className="text-left py-1 print:text-black">Item</th>
                          <th className="text-center py-1 w-12 print:text-black">Qty</th>
                          <th className="text-right py-1 w-16 print:text-black">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedQuotation.items.map((item, index) => (
                          <tr key={index} className="border-b border-black">
                            <td className="py-2">
                              <div className="font-medium print:text-black">{item.productName}</div>
                              <div className="text-[10px] print:text-black">
                                {formatCurrency(item.price)} x {item.quantity}
                                {item.discount > 0 && ` (-${formatCurrency(item.discount)})`}
                              </div>
                            </td>
                            <td className="text-center py-2 print:text-black">{item.quantity}</td>
                            <td className="text-right py-2 font-bold print:text-black">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t-2 border-black pt-2 space-y-1 text-xs">
                    <div className="flex justify-between print:text-black">
                      <span>Subtotal:</span>
                      <span className="font-medium">{formatCurrency(selectedQuotation.subtotal)}</span>
                    </div>
                    {selectedQuotation.discount > 0 && (
                      <div className="flex justify-between print:text-black">
                        <span>Discount:</span>
                        <span className="font-medium">-{formatCurrency(selectedQuotation.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1 print:text-black">
                      <span>TOTAL:</span>
                      <span>{formatCurrency(selectedQuotation.total)}</span>
                    </div>
                  </div>

                  {selectedQuotation.notes && (
                    <div className="mt-4 pt-2 border-t border-black text-xs">
                      <p className="font-bold mb-1 print:text-black">Notes:</p>
                      <p className="text-[10px] print:text-black">{selectedQuotation.notes}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-2 border-t-2 border-black text-center text-xs">
                    <p className="print:text-black">Thank you for your business!</p>
                  </div>
                </div>
                </div>

                <div className="flex gap-2 justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => setViewMode(false)}>
                    Return to Quotations
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePrint}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </Button>
                    <Button variant="outline" onClick={handleDownloadPDF}>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button
                      disabled={!selectedQuotation.customer_phone?.trim()}
                      onClick={() => {
                        const phone = selectedQuotation.customer_phone?.replace(/[^0-9]/g, '').trim();
                        if (!phone) {
                          toast.error('No phone number available for this customer');
                          return;
                        }
                        
                        // Use wa.me (official WhatsApp link)
                        const whatsappUrl = `https://wa.me/${phone}`;
                        console.log('Opening WhatsApp URL:', whatsappUrl);
                        
                        try {
                          // Try to open in parent/top window to escape iframe restrictions
                          if (window.top && window.top !== window.self) {
                            // We're in an iframe, open in parent
                            window.top.open(whatsappUrl, '_blank');
                          } else {
                            // Normal window, use regular open
                            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                          }
                        } catch (error) {
                          console.error('Error opening WhatsApp:', error);
                          // Final fallback: navigate in current window
                          window.location.href = whatsappUrl;
                        }
                      }}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteQuotationId} onOpenChange={() => setDeleteQuotationId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this quotation? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteQuotationId) {
                    deleteQuotationMutation.mutate(deleteQuotationId);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
