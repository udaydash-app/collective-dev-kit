import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Pencil, Trash2, Users, Building2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { usePageView } from '@/hooks/useAnalytics';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  tax_id?: string;
  is_customer: boolean;
  is_supplier: boolean;
  price_tier?: 'retail' | 'wholesale' | 'vip';
  custom_price_tier_id?: string;
  credit_limit?: number;
  opening_balance?: number;
  notes?: string;
  created_at: string;
}

export default function Contacts() {
  usePageView('Admin - Contacts');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Open add dialog if navigated from POS
  useEffect(() => {
    if (location.state?.openAddDialog) {
      setOpen(true);
      // Clear the state to prevent reopening on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    contact_person: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    tax_id: '',
    is_customer: false,
    is_supplier: false,
    price_tier: 'retail' as 'retail' | 'wholesale' | 'vip',
    custom_price_tier_id: '' as string,
    credit_limit: '',
    opening_balance: '',
    notes: '',
  });

  // Fetch custom price tiers
  const { data: customTiers } = useQuery({
    queryKey: ['custom-price-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_price_tiers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Contact[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return newContact;
    },
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created successfully');
      handleClose();
      
      // If came from POS, navigate back with new customer ID
      if (location.state?.openAddDialog && location.state?.fromPOS) {
        navigate('/admin/pos', { 
          state: { newCustomerId: newContact.id },
          replace: true 
        });
      }
    },
    onError: (error) => {
      toast.error('Failed to create contact: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('contacts')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact updated successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error('Failed to update contact: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete contact: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!formData.is_customer && !formData.is_supplier) {
      toast.error('Contact must be a customer, supplier, or both');
      return;
    }

    const submitData = {
      ...formData,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
      opening_balance: formData.opening_balance ? parseFloat(formData.opening_balance) : 0,
      custom_price_tier_id: formData.custom_price_tier_id || null,
    };

    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      contact_person: contact.contact_person || '',
      address_line1: contact.address_line1 || '',
      address_line2: contact.address_line2 || '',
      city: contact.city || '',
      state: contact.state || '',
      zip_code: contact.zip_code || '',
      country: contact.country || '',
      tax_id: contact.tax_id || '',
      is_customer: contact.is_customer,
      is_supplier: contact.is_supplier,
      price_tier: contact.price_tier || 'retail',
      custom_price_tier_id: contact.custom_price_tier_id || '',
      credit_limit: contact.credit_limit?.toString() || '',
      opening_balance: contact.opening_balance?.toString() || '',
      notes: contact.notes || '',
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingContact(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      contact_person: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      tax_id: '',
      is_customer: false,
      is_supplier: false,
      price_tier: 'retail',
      custom_price_tier_id: '',
      credit_limit: '',
      opening_balance: '',
      notes: '',
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const filteredContacts = contacts?.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.includes(searchTerm);

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'customers' && contact.is_customer) ||
      (activeTab === 'suppliers' && contact.is_supplier);

    return matchesSearch && matchesTab;
  });

  const stats = {
    total: contacts?.length || 0,
    customers: contacts?.filter((c) => c.is_customer).length || 0,
    suppliers: contacts?.filter((c) => c.is_supplier).length || 0,
    both: contacts?.filter((c) => c.is_customer && c.is_supplier).length || 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts Management</h1>
          <p className="text-muted-foreground">Manage customers and suppliers</p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Button onClick={() => navigate('/admin/import-contacts')} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Contacts
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleClose}>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_person: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Type *</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_customer"
                        checked={formData.is_customer}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_customer: !!checked })
                        }
                      />
                      <label htmlFor="is_customer" className="text-sm cursor-pointer">
                        Customer
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_supplier"
                        checked={formData.is_supplier}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, is_supplier: !!checked })
                        }
                      />
                      <label htmlFor="is_supplier" className="text-sm cursor-pointer">
                        Supplier
                      </label>
                    </div>
                  </div>
                </div>

                {formData.is_customer && (
                  <div className="col-span-2">
                    <Label htmlFor="price_tier">Price Tier</Label>
                    <Select
                      value={formData.price_tier}
                      onValueChange={(value: 'retail' | 'wholesale' | 'vip') =>
                        setFormData({ ...formData, price_tier: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select price tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Retail (Standard Price)</SelectItem>
                        <SelectItem value="wholesale">Wholesale (Discounted Price)</SelectItem>
                        <SelectItem value="vip">VIP (Special Price)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Price tier determines which product price will be applied for this customer
                    </p>
                  </div>
                )}

                {formData.is_customer && customTiers && customTiers.length > 0 && (
                  <div className="col-span-2">
                    <Label htmlFor="custom_tier">Custom Price Tier (Optional)</Label>
                    <Select
                      value={formData.custom_price_tier_id || 'none'}
                      onValueChange={(value) =>
                        setFormData({ ...formData, custom_price_tier_id: value === 'none' ? '' : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No custom tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No custom tier</SelectItem>
                        {customTiers.map((tier: any) => (
                          <SelectItem key={tier.id} value={tier.id}>
                            {tier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Custom tiers override standard pricing with specific product prices
                    </p>
                  </div>
                )}

                <div className="col-span-2">
                  <Label htmlFor="address_line1">Address Line 1</Label>
                  <Input
                    id="address_line1"
                    value={formData.address_line1}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line1: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    value={formData.address_line2}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line2: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) =>
                      setFormData({ ...formData, zip_code: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="tax_id">Tax ID / Business Registration</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_id: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="credit_limit">Credit Limit</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, credit_limit: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="opening_balance">Opening Balance</Label>
                  <Input
                    id="opening_balance"
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) =>
                      setFormData({ ...formData, opening_balance: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingContact ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.customers}</p>
              <p className="text-sm text-muted-foreground">Customers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{stats.suppliers}</p>
              <p className="text-sm text-muted-foreground">Suppliers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats.both}</p>
              <p className="text-sm text-muted-foreground">Both</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Card>

      {/* Tabs and Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="customers">Customers ({stats.customers})</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers ({stats.suppliers})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price Tier</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Tax ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredContacts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts?.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          {contact.contact_person && (
                            <p className="text-sm text-muted-foreground">
                              {contact.contact_person}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {contact.email && <p>{contact.email}</p>}
                          {contact.phone && <p>{contact.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {contact.is_customer && (
                            <Badge variant="default">Customer</Badge>
                          )}
                          {contact.is_supplier && (
                            <Badge variant="secondary">Supplier</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.is_customer ? (
                          <Badge 
                            variant="outline"
                            className={
                              contact.price_tier === 'vip' 
                                ? 'bg-purple-100 text-purple-700 border-purple-300'
                                : contact.price_tier === 'wholesale'
                                ? 'bg-blue-100 text-blue-700 border-blue-300'
                                : 'bg-gray-100 text-gray-700 border-gray-300'
                            }
                          >
                            {contact.price_tier === 'vip' 
                              ? 'VIP' 
                              : contact.price_tier === 'wholesale' 
                              ? 'Wholesale' 
                              : 'Retail'}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {contact.city && contact.state
                            ? `${contact.city}, ${contact.state}`
                            : contact.city || contact.state || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{contact.tax_id || '-'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(contact)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(contact.id, contact.name)}
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
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
