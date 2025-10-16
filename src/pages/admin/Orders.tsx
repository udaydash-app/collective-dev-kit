import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ArrowLeft, Package, Eye, ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const toggleOrderExpanded = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const { data: orders, isLoading, error: queryError } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          stores(name),
          addresses(address_line1, city)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }
      
      // Fetch user names and order items separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(order => order.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        // Fetch order items with product details
        const orderIds = data.map(order => order.id);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select(`
            *,
            products(id, name, image_url, price, unit)
          `)
          .in('order_id', orderIds);
        
        // Map profiles and items to orders
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        const itemsByOrder = new Map<string, any[]>();
        orderItems?.forEach(item => {
          if (!itemsByOrder.has(item.order_id)) {
            itemsByOrder.set(item.order_id, []);
          }
          itemsByOrder.get(item.order_id)?.push(item);
        });
        
        return data.map(order => ({
          ...order,
          customer_name: profileMap.get(order.user_id) || 'Unknown',
          items: itemsByOrder.get(order.id) || []
        }));
      }
      
      return data || [];
    }
  });

  if (queryError) {
    console.error('Query error:', queryError);
  }

  const updateOrderItem = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order item updated');
    },
    onError: () => toast.error('Failed to update item')
  });

  const deleteOrderItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Item removed from order');
    },
    onError: () => toast.error('Failed to remove item')
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order status updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update order status');
      console.error(error);
    }
  });

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

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrderStatus.mutate({ orderId, status: newStatus });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground">View and fulfill customer orders</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              All Orders
            </CardTitle>
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
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
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
                      <>
                        <TableRow key={order.id}>
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
                            {order.customer_name || 'Unknown'}
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
                            {getStatusBadge(order.status)}
                          </TableCell>
                          <TableCell>
                            {new Date(order.created_at).toLocaleDateString()}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleTimeString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/order/${order.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                <Select
                                  value={order.status}
                                  onValueChange={(value) => handleStatusChange(order.id, value)}
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
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedOrders.has(order.id) && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/50">
                              <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-semibold">Order Products</h4>
                                  <span className="text-sm text-muted-foreground">
                                    Delivery: {order.addresses?.address_line1}, {order.addresses?.city}
                                  </span>
                                </div>
                                {order.items && order.items.length > 0 ? (
                                  <div className="space-y-3">
                                    {order.items.map((item: any) => (
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
                                              quantity: item.quantity - 1 
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
                                              quantity: item.quantity + 1 
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
                                              deleteOrderItem.mutate(item.id);
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground text-center py-4">
                                    No items in this order
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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
    </div>
  );
}
