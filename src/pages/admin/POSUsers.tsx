import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Users, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, UserCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface POSUser {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  role?: 'admin' | 'cashier' | 'user';
}

export default function POSUsers() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<POSUser | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    pin: '',
    confirmPin: '',
    role: 'cashier' as 'admin' | 'cashier' | 'user',
  });

  const { data: posUsers, isLoading } = useQuery({
    queryKey: ['pos-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_users')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      
      // Fetch roles separately for users that have user_id
      const usersWithRoles = await Promise.all(
        data.map(async (user: any) => {
          if (user.user_id) {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.user_id)
              .maybeSingle();
            
            return {
              ...user,
              role: roleData?.role || 'cashier'
            };
          }
          return {
            ...user,
            role: 'cashier'
          };
        })
      );
      
      return usersWithRoles as POSUser[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase.functions.invoke('manage-pos-user', {
        body: {
          action: 'create',
          full_name: data.full_name,
          pin: data.pin,
          role: data.role,
        }
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error || 'Failed to create user');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-users'] });
      toast.success('POS user created successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error('Failed to create user: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: result, error } = await supabase.functions.invoke('manage-pos-user', {
        body: {
          action: 'update',
          user_id: id,
          full_name: data.full_name,
          pin: data.pin || null,
          is_active: data.is_active ?? true,
          role: data.role,
        }
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error || 'Failed to update user');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-users'] });
      toast.success('POS user updated successfully');
      handleClose();
    },
    onError: (error) => {
      toast.error('Failed to update user: ' + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('pos_users')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-users'] });
      toast.success('User status updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pos_users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-users'] });
      toast.success('User deleted successfully');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!editingUser && !formData.pin) {
      toast.error('PIN is required');
      return;
    }

    if (formData.pin && formData.pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    if (formData.pin && formData.pin !== formData.confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (user: POSUser) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      pin: '',
      confirmPin: '',
      role: user.role || 'cashier',
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingUser(null);
    setFormData({
      full_name: '',
      pin: '',
      confirmPin: '',
      role: 'cashier',
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">POS Users Management</h1>
          <p className="text-muted-foreground">Manage PIN-based access for POS system</p>
        </div>
        <div className="flex gap-2">
          <ReturnToPOSButton inline />
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleClose}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="pin">
                  PIN {editingUser ? '(leave empty to keep current)' : '*'}
                </Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                  maxLength={6}
                  placeholder="4-6 digits"
                  required={!editingUser}
                />
              </div>

              <div>
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  value={formData.confirmPin}
                  onChange={(e) => setFormData({ ...formData, confirmPin: e.target.value.replace(/\D/g, '') })}
                  maxLength={6}
                  placeholder="Re-enter PIN"
                  required={!editingUser && !!formData.pin}
                />
              </div>

              <div>
                <Label htmlFor="role">Role & Access Level *</Label>
                <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        <div>
                          <div className="font-medium">Admin</div>
                          <div className="text-xs text-muted-foreground">Full access to all features</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="cashier">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-blue-500" />
                        <div>
                          <div className="font-medium">Cashier</div>
                          <div className="text-xs text-muted-foreground">POS access only</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="font-medium">User</div>
                          <div className="text-xs text-muted-foreground">Limited access</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUser ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <p>Loading users...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {user.full_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.role === 'admin' ? 'destructive' : user.role === 'cashier' ? 'default' : 'secondary'}
                        className="gap-1"
                      >
                        {user.role === 'admin' && <Shield className="h-3 w-3" />}
                        {user.role === 'cashier' && <UserCircle className="h-3 w-3" />}
                        {user.role === 'user' && <UserCircle className="h-3 w-3" />}
                        {user.role?.charAt(0).toUpperCase() + user.role?.slice(1) || 'Cashier'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: user.id, is_active: checked })
                          }
                        />
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Delete ${user.full_name}?`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {posUsers?.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No POS users yet. Create one to get started!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Hash className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Security Note</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                PINs are securely hashed using bcrypt. Users will use their PIN to log into the POS system.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
