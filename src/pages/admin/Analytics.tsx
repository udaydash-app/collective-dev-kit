import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { usePageView } from "@/hooks/useAnalytics";
import { formatCurrency } from "@/lib/utils";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";

interface AnalyticsSummary {
  totalEvents: number;
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
}

interface EventData {
  event_type: string;
  count: number;
}

interface ImportLog {
  id: string;
  url: string;
  status: string;
  products_imported: number;
  error_message: string | null;
  execution_time_ms: number;
  created_at: string;
}

export default function Analytics() {
  usePageView("Admin Analytics");
  const [summary, setSummary] = useState<AnalyticsSummary>({
    totalEvents: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeUsers: 0,
  });
  const [eventData, setEventData] = useState<EventData[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch events summary
      const { count: eventsCount } = await supabase
        .from("analytics_events")
        .select("*", { count: "exact", head: true });

      // Fetch orders summary
      const { data: orders } = await supabase
        .from("orders")
        .select("total");

      const totalRevenue = orders?.reduce((sum, order) => sum + order.total, 0) || 0;

      // Fetch active users (users with events in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: activeUsersData } = await supabase
        .from("analytics_events")
        .select("user_id")
        .gte("created_at", thirtyDaysAgo.toISOString());

      const uniqueUsers = new Set(activeUsersData?.map(e => e.user_id).filter(Boolean));

      // Fetch event breakdown
      const { data: events } = await supabase
        .from("analytics_events")
        .select("event_type");

      const eventCounts = events?.reduce((acc: Record<string, number>, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {});

      const eventChartData = Object.entries(eventCounts || {}).map(([event_type, count]) => ({
        event_type,
        count,
      }));

      // Fetch import logs
      const { data: logs } = await supabase
        .from("import_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      setSummary({
        totalEvents: eventsCount || 0,
        totalOrders: orders?.length || 0,
        totalRevenue,
        activeUsers: uniqueUsers.size,
      });
      setEventData(eventChartData);
      setImportLogs(logs || []);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <ReturnToPOSButton inline />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalEvents.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Logs */}
        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events">Event Breakdown</TabsTrigger>
            <TabsTrigger value="imports">Import Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={eventData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="event_type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Product Imports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {importLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between border-b pb-4 last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium truncate">{log.url}</p>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Status: {log.status}</span>
                          <span>Products: {log.products_imported}</span>
                          <span>Time: {log.execution_time_ms}ms</span>
                        </div>
                        {log.error_message && (
                          <p className="text-sm text-destructive mt-1">{log.error_message}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {importLogs.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No import logs available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
