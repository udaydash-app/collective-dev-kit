import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, 
  ShoppingCart, 
  Users, 
  DollarSign,
  TrendingUp,
  Store,
  BarChart3,
  Settings,
  Tags
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['admin-stats', timeRange],
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date();
      
      if (timeRange === 'day') startDate.setDate(now.getDate() - 1);
      else if (timeRange === 'week') startDate.setDate(now.getDate() - 7);
      else startDate.setMonth(now.getMonth() - 1);

      // Get orders
      const { data: orders } = await supabase
        .from('orders')
        .select('total, status, created_at')
        .gte('created_at', startDate.toISOString());

      // Get products
      const { data: products, count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact' });

      // Get users (profiles)
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      // Calculate revenue
      const revenue = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

      return {
        revenue,
        orders: orders?.length || 0,
        pendingOrders,
        totalProducts: totalProducts || 0,
        totalUsers: totalUsers || 0,
        recentOrders: orders?.slice(0, 5) || []
      };
    }
  });

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name, city, is_active')
        .order('name');
      return data;
    }
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage your Global Market operations</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={timeRange === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('day')}
            >
              24h
            </Button>
            <Button
              variant={timeRange === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('week')}
            >
              7d
            </Button>
            <Button
              variant={timeRange === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('month')}
            >
              30d
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.revenue || 0)}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 text-green-500" /> +12% from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.orders || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.pendingOrders || 0} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
              <div className="flex flex-col gap-1 mt-2">
                <Link to="/admin/products">
                  <p className="text-xs text-primary hover:underline">Manage products</p>
                </Link>
                <Link to="/admin/categories">
                  <p className="text-xs text-primary hover:underline">Manage categories</p>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">Registered customers</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="stores" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stores">
              <Store className="h-4 w-4 mr-2" />
              Stores
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Recent Orders
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Partner Stores</CardTitle>
                <CardDescription>Manage grocery store partnerships</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stores?.map((store) => (
                    <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Store className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-semibold">{store.name}</p>
                          <p className="text-sm text-muted-foreground">{store.city}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          store.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {store.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <Button variant="outline" size="sm">Manage</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest customer orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.recentOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-semibold">Order #{order.order_number || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(Number(order.total))}</p>
                        <p className="text-sm text-muted-foreground capitalize">{order.status}</p>
                      </div>
                    </div>
                  ))}
                  <Link to="/admin/orders">
                    <Button className="w-full mt-4">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      View All Orders
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Overview</CardTitle>
                <CardDescription>Performance metrics and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  View detailed analytics including user behavior, event tracking, and import logs.
                </p>
                <Link to="/admin/analytics">
                  <Button className="w-full">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Open Analytics Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure app settings and company information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link to="/admin/settings">
                  <Button className="w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    Company Settings
                  </Button>
                </Link>
                <Link to="/admin/orders">
                  <Button variant="outline" className="w-full">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Manage Orders
                  </Button>
                </Link>
                <Link to="/admin/products">
                  <Button variant="outline" className="w-full">
                    <Package className="mr-2 h-4 w-4" />
                    Manage Products
                  </Button>
                </Link>
                <Link to="/admin/import-products">
                  <Button variant="outline" className="w-full">
                    <Package className="mr-2 h-4 w-4" />
                    Import Products
                  </Button>
                </Link>
                <Link to="/admin/categories">
                  <Button variant="outline" className="w-full">
                    <Tags className="mr-2 h-4 w-4" />
                    Manage Categories
                  </Button>
                </Link>
                <Button variant="outline" className="w-full">
                  <Users className="mr-2 h-4 w-4" />
                  User Management
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
}
