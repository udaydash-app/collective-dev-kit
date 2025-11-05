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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Plus, Receipt, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import PendingBillsDialog from '@/components/admin/PendingBillsDialog';

interface PaymentReceipt {
  id: string;
  receipt_number: string;
  contact_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  received_by: string;
  store_id: string;
  created_at: string;
  contacts: {
    name: string;
  };
  profiles: {
    full_name: string;
  };
}

export default function PaymentReceipts() {
  const [open, setOpen] = useState(false);
  const [pendingBillsOpen, setPendingBillsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentType, setPaymentType] = useState<'on_account' | 'against_bill'>('on_account');
  const [selectedBillId, setSelectedBillId] = useState('');
  const [selectedBillType, setSelectedBillType] = useState<'pos_transaction' | 'order'>('pos_transaction');
  const [formData, setFormData] = useState({
    contact_id: '',
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

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ['customers'],
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

  // Fetch payment receipts
  const { data: receipts, isLoading } = useQuery({
    queryKey: ['payment-receipts', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('payment_receipts')
        .select(`
          *,
          contacts(name)
        `)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`receipt_number.ilike.%${searchTerm}%,reference.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user profiles separately
      const receiptsWithProfiles = await Promise.all(
        (data || []).map(async (receipt) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', receipt.received_by)
            .single();
          
          return {
            ...receipt,
            profiles: profile || { full_name: '' }
          };
        })
      );

      return receiptsWithProfiles as PaymentReceipt[];
    }
  });

  // Create payment receipt mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const amount = parseFloat(data.amount);

      // Insert payment receipt
      const { error } = await supabase
        .from('payment_receipts')
        .insert({
          ...data,
          amount,
          received_by: user.id
        });

      if (error) throw error;

      // Handle payment application
      if (paymentType === 'against_bill' && selectedBillId) {
        // Update specific bill
        if (selectedBillType === 'pos_transaction') {
          const { data: transaction } = await supabase
            .from('pos_transactions')
            .select('total, amount_paid')
            .eq('id', selectedBillId)
            .single();

          if (transaction) {
            const newAmountPaid = (transaction.amount_paid || 0) + amount;
            const paymentStatus = newAmountPaid >= transaction.total ? 'paid' : 
                                 newAmountPaid > 0 ? 'partial' : 'pending';

            await supabase
              .from('pos_transactions')
              .update({ 
                amount_paid: newAmountPaid,
                payment_status: paymentStatus 
              })
              .eq('id', selectedBillId);
          }
        } else {
          const { data: order } = await supabase
            .from('orders')
            .select('total')
            .eq('id', selectedBillId)
            .single();

          if (order && amount >= order.total) {
            await supabase
              .from('orders')
              .update({ payment_status: 'paid' })
              .eq('id', selectedBillId);
          }
        }
      } else {
        // On account - adjust oldest bills first
        let remainingAmount = amount;

        // Get pending POS transactions - cast supabase to avoid deep type inference
        const posResult = await ((supabase as any)
          .from('pos_transactions')
          .select('id, total, amount_paid')
          .eq('customer_id', data.contact_id)
          .eq('payment_method', 'credit')
          .neq('payment_status', 'paid')
          .order('created_at', { ascending: true })) as { 
            data: Array<{ id: string; total: number; amount_paid: number | null }> | null; 
            error: any 
          };

        if (posResult.data) {
          for (const transaction of posResult.data) {
            if (remainingAmount <= 0) break;

            const outstanding = Number(transaction.total) - (Number(transaction.amount_paid) || 0);
            const paymentToApply = Math.min(remainingAmount, outstanding);
            const newAmountPaid = (Number(transaction.amount_paid) || 0) + paymentToApply;
            const paymentStatus = newAmountPaid >= Number(transaction.total) ? 'paid' : 
                                 newAmountPaid > 0 ? 'partial' : 'pending';

            await supabase
              .from('pos_transactions')
              .update({ 
                amount_paid: newAmountPaid,
                payment_status: paymentStatus 
              } as any)
              .eq('id', transaction.id);

            remainingAmount -= paymentToApply;
          }
        }

        // If still remaining, apply to oldest orders
        if (remainingAmount > 0) {
          const ordersResult = await ((supabase as any)
            .from('orders')
            .select('id, total')
            .eq('user_id', data.contact_id)
            .eq('payment_status', 'pending')
            .order('created_at', { ascending: true })) as {
              data: Array<{ id: string; total: number }> | null;
              error: any
            };

          if (ordersResult.data) {
            for (const order of ordersResult.data) {
              if (remainingAmount <= 0) break;

              if (remainingAmount >= Number(order.total)) {
                await supabase
                  .from('orders')
                  .update({ payment_status: 'paid' })
                  .eq('id', order.id);

                remainingAmount -= Number(order.total);
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Payment receipt created successfully');
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create payment receipt');
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
    setPaymentType('on_account');
    setSelectedBillId('');
    setSelectedCustomer(null);
    setPendingBillsOpen(false);
    setFormData({
      contact_id: '',
      amount: '',
      payment_method: 'cash',
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      reference: '',
      notes: '',
      store_id: ''
    });
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
        <h1 className="text-3xl font-bold">Payment Receipts</h1>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Receipt
        </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by receipt number or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Received By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : receipts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">No payment receipts found</TableCell>
                </TableRow>
              ) : (
                receipts?.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">{receipt.receipt_number}</TableCell>
                    <TableCell>{format(new Date(receipt.payment_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{receipt.contacts.name}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(receipt.amount)}</TableCell>
                    <TableCell>
                      <Badge className={paymentMethodColors[receipt.payment_method]}>
                        {receipt.payment_method.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{receipt.reference || '-'}</TableCell>
                    <TableCell>{receipt.profiles?.full_name || '-'}</TableCell>
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
            <DialogTitle>New Payment Receipt</DialogTitle>
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
                <Label htmlFor="contact_id">Customer *</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, contact_id: value, amount: '' });
                    const customer = customers?.find(c => c.id === value);
                    if (customer) {
                      setSelectedCustomer({ id: customer.id, name: customer.name });
                    }
                    setPaymentType('on_account');
                    setSelectedBillId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.contact_id && (
                <div className="col-span-2 space-y-3 p-4 border rounded-lg bg-muted/30">
                  <Label>Payment Type *</Label>
                  <RadioGroup 
                    value={paymentType} 
                    onValueChange={(value: 'on_account' | 'against_bill') => {
                      setPaymentType(value);
                      if (value === 'on_account') {
                        setSelectedBillId('');
                        setFormData(prev => ({ ...prev, amount: '' }));
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="on_account" id="on_account" />
                      <Label htmlFor="on_account" className="font-normal cursor-pointer">
                        On Account (Auto-adjust from oldest bills)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="against_bill" id="against_bill" />
                      <Label htmlFor="against_bill" className="font-normal cursor-pointer">
                        Against Specific Bill
                      </Label>
                    </div>
                  </RadioGroup>

                  {paymentType === 'against_bill' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPendingBillsOpen(true)}
                      className="w-full"
                    >
                      {selectedBillId ? '✓ Bill Selected - Click to Change' : 'Select Bill to Pay'}
                    </Button>
                  )}
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
                  disabled={paymentType === 'against_bill' && !selectedBillId}
                />
                {paymentType === 'against_bill' && !selectedBillId && (
                  <p className="text-sm text-muted-foreground">Select a bill first</p>
                )}
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
                {createMutation.isPending ? 'Creating...' : 'Create Receipt'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {selectedCustomer && (
        <PendingBillsDialog
          open={pendingBillsOpen}
          onOpenChange={setPendingBillsOpen}
          contactId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          onAmountSelect={(amount, billId, billType) => {
            setFormData({ ...formData, amount: amount.toString() });
            setSelectedBillId(billId);
            setSelectedBillType(billType);
            setPendingBillsOpen(false);
          }}
        />
      )}
    </div>
  );
}
