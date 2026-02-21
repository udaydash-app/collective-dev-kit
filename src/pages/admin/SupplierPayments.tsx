import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
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

interface SupplierPayment {
  id: string;
  payment_number: string;
  contact_id: string;
  purchase_id: string | null;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  paid_by: string;
  store_id: string;
  created_at: string;
  contacts: {
    name: string;
  };
  profiles: {
    full_name: string;
  };
  purchases?: {
    purchase_number: string;
    total_amount: number;
  };
}

export default function SupplierPayments() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    contact_id: '',
    purchase_id: '',
    amount: '',
    payment_method: 'cash',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    reference: '',
    notes: '',
    store_id: ''
  });

  const queryClient = useQueryClient();

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_supplier', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch outstanding purchases for selected supplier
  const { data: outstandingPurchases } = useQuery({
    queryKey: ['outstanding-purchases', formData.contact_id],
    queryFn: async () => {
      if (!formData.contact_id) return [];
      
      const supplier = suppliers?.find(s => s.id === formData.contact_id);
      if (!supplier) return [];

      const { data, error } = await supabase
        .from('purchases')
        .select('id, purchase_number, total_amount, amount_paid, payment_status, purchased_at')
        .eq('supplier_name', supplier.name)
        .in('payment_status', ['pending', 'partial'])
        .order('purchased_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.contact_id && open
  });

  // Fetch supplier payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ['supplier-payments', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('supplier_payments')
        .select(`
          *,
          contacts(name),
          purchases(purchase_number, total_amount)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`payment_number.ilike.%${searchTerm}%,reference.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user profiles separately
      const paymentsWithProfiles = await Promise.all(
        (data || []).map(async (payment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', payment.paid_by)
            .single();
          
          return {
            ...payment,
            profiles: profile || { full_name: '' }
          };
        })
      );

      return paymentsWithProfiles as SupplierPayment[];
    }
  });

  // Create/Update supplier payment mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const paymentData = {
        contact_id: data.contact_id,
        purchase_id: data.purchase_id || null,
        amount: parseFloat(data.amount),
        payment_method: data.payment_method,
        payment_date: data.payment_date,
        reference: data.reference,
        notes: data.notes,
        store_id: data.store_id
      };

      if (editingPayment) {
        // Update existing payment
        const { error } = await supabase
          .from('supplier_payments')
          .update(paymentData)
          .eq('id', editingPayment.id);

        if (error) throw error;
      } else {
        // Insert new payment
        const { error: insertError } = await supabase
          .from('supplier_payments')
          .insert({
            ...paymentData,
            paid_by: user.id
          });

        if (insertError) throw insertError;
        // Journal entries are automatically created by database trigger (create_supplier_payment_journal_entry)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-purchases'] });
      toast.success(editingPayment ? 'Supplier payment updated successfully' : 'Supplier payment recorded and posted to general ledger');
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || `Failed to ${editingPayment ? 'update' : 'record'} supplier payment`);
    }
  });

  // Delete supplier payment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Supplier payment deleted successfully');
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete supplier payment');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_id || !formData.amount || !formData.store_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingPayment(null);
    setFormData({
      contact_id: '',
      purchase_id: '',
      amount: '',
      payment_method: 'cash',
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      reference: '',
      notes: '',
      store_id: ''
    });
  };

  const handleEdit = (payment: SupplierPayment) => {
    setEditingPayment(payment);
    setFormData({
      contact_id: payment.contact_id,
      purchase_id: payment.purchase_id || '',
      amount: payment.amount.toString(),
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      reference: payment.reference || '',
      notes: payment.notes || '',
      store_id: payment.store_id
    });
    setOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setPaymentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (paymentToDelete) {
      deleteMutation.mutate(paymentToDelete);
    }
  };

  const paymentMethodColors: Record<string, string> = {
    cash: 'bg-green-500',
    mobile_money: 'bg-purple-500',
    bank_transfer: 'bg-blue-500',
    cheque: 'bg-yellow-500'
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Supplier Payments</h1>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Payment
        </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by payment number or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table fixedScroll>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Purchase #</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Paid By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : payments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">No supplier payments found</TableCell>
                </TableRow>
              ) : (
                payments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.payment_number}</TableCell>
                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                    <TableCell>{payment.contacts.name}</TableCell>
                    <TableCell>
                      {payment.purchases?.purchase_number ? (
                        <span className="text-xs font-mono">{payment.purchases.purchase_number}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      <Badge className={paymentMethodColors[payment.payment_method]}>
                        {payment.payment_method.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.reference || '-'}</TableCell>
                    <TableCell>{payment.profiles?.full_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(payment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(payment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'Edit Supplier Payment' : 'New Supplier Payment'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store_id">Store *</Label>
                <Select
                  value={formData.store_id}
                  onValueChange={(value) => setFormData({ ...formData, store_id: value })}
                >
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

              <div className="space-y-2">
                <Label htmlFor="contact_id">Supplier *</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(value) => setFormData({ ...formData, contact_id: value, purchase_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.contact_id && outstandingPurchases && outstandingPurchases.length > 0 && (
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="purchase_id">Purchase (Optional)</Label>
                  <Select
                    value={formData.purchase_id}
                    onValueChange={(value) => {
                      const purchase = outstandingPurchases.find(p => p.id === value);
                      setFormData({ 
                        ...formData, 
                        purchase_id: value,
                        amount: purchase ? (purchase.total_amount - (purchase.amount_paid || 0)).toString() : formData.amount
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select purchase to pay (or leave blank for general payment)" />
                    </SelectTrigger>
                    <SelectContent>
                      {outstandingPurchases.map((purchase) => (
                        <SelectItem key={purchase.id} value={purchase.id}>
                          {purchase.purchase_number} - {formatCurrency(purchase.total_amount)} 
                          {purchase.amount_paid > 0 && ` (Paid: ${formatCurrency(purchase.amount_paid)})`}
                          {' '}
                          <Badge variant={purchase.payment_status === 'partial' ? 'secondary' : 'destructive'} className="ml-2">
                            {purchase.payment_status}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Link this payment to a specific purchase, or leave blank for a general payment
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method *</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Transaction ref, cheque #, etc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (editingPayment ? 'Updating...' : 'Recording...') : (editingPayment ? 'Update Payment' : 'Record Payment')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
