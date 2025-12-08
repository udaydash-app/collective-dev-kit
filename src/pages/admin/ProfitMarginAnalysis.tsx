import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, TrendingDown, DollarSign, Package, Percent } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ReturnToPOSButton } from "@/components/layout/ReturnToPOSButton";
import { formatCurrency } from "@/lib/utils";

interface ProfitMarginData {
  product_id: string;
  product_name: string;
  category_name: string;
  units_sold: number;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  profit_margin: number;
  avg_selling_price: number;
  avg_cost: number;
}

interface CategorySummary {
  category_name: string;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  profit_margin: number;
  units_sold: number;
  product_count: number;
}

export default function ProfitMarginAnalysis() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"product" | "category">("product");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["categories-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch profit margin data
  const { data: profitData, isLoading } = useQuery({
    queryKey: ["profit-margin", startDate, endDate, selectedCategory],
    queryFn: async () => {
      // Fetch POS transactions within date range
      const { data: transactions, error: txError } = await supabase
        .from("pos_transactions")
        .select("id, items, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59");

      if (txError) throw txError;

      // Get all products with cost_price for margin calculation
      let productsQuery = supabase
        .from("products")
        .select("id, name, cost_price, price, category:categories(id, name)");
      
      if (selectedCategory !== "all") {
        productsQuery = productsQuery.eq("category_id", selectedCategory);
      }

      const { data: products, error: prodError } = await productsQuery;
      if (prodError) throw prodError;

      const productMap = new Map(products?.map(p => [p.id, p]) || []);

      // Process transactions to calculate profit margins using simple cost_price
      const profitMap = new Map<string, ProfitMarginData>();

      transactions?.forEach((tx: any) => {
        const items = tx.items as any[];
        items?.forEach((item: any) => {
          const productId = item.productId;
          const product = productMap.get(productId);
          if (!product) return;

          const quantity = Math.abs(item.quantity || 0);
          const revenue = (item.price || 0) * quantity;
          // Use simple cost_price for COGS calculation (no FIFO)
          const cogs = (product.cost_price || 0) * quantity;

          if (profitMap.has(productId)) {
            const existing = profitMap.get(productId)!;
            existing.units_sold += quantity;
            existing.total_revenue += revenue;
            existing.total_cogs += cogs;
          } else {
            profitMap.set(productId, {
              product_id: productId,
              product_name: product.name,
              category_name: product.category?.name || "Uncategorized",
              units_sold: quantity,
              total_revenue: revenue,
              total_cogs: cogs,
              gross_profit: 0,
              profit_margin: 0,
              avg_selling_price: 0,
              avg_cost: 0,
            });
          }
        });
      });

      // Calculate margins and averages
      const results: ProfitMarginData[] = [];
      profitMap.forEach((item) => {
        item.gross_profit = item.total_revenue - item.total_cogs;
        item.profit_margin = item.total_revenue > 0 ? (item.gross_profit / item.total_revenue) * 100 : 0;
        item.avg_selling_price = item.units_sold > 0 ? item.total_revenue / item.units_sold : 0;
        item.avg_cost = item.units_sold > 0 ? item.total_cogs / item.units_sold : 0;
        results.push(item);
      });

      return results.sort((a, b) => b.total_revenue - a.total_revenue);
    },
  });

  // Calculate category summaries
  const categorySummaries: CategorySummary[] = profitData
    ? Object.values(
        profitData.reduce((acc: Record<string, CategorySummary>, item) => {
          const cat = item.category_name;
          if (!acc[cat]) {
            acc[cat] = {
              category_name: cat,
              total_revenue: 0,
              total_cogs: 0,
              gross_profit: 0,
              profit_margin: 0,
              units_sold: 0,
              product_count: 0,
            };
          }
          acc[cat].total_revenue += item.total_revenue;
          acc[cat].total_cogs += item.total_cogs;
          acc[cat].units_sold += item.units_sold;
          acc[cat].product_count += 1;
          return acc;
        }, {})
      ).map((cat) => ({
        ...cat,
        gross_profit: cat.total_revenue - cat.total_cogs,
        profit_margin: cat.total_revenue > 0 ? ((cat.total_revenue - cat.total_cogs) / cat.total_revenue) * 100 : 0,
      }))
    : [];

  // Calculate overall summary
  const overallSummary = {
    total_revenue: profitData?.reduce((sum, item) => sum + item.total_revenue, 0) || 0,
    total_cogs: profitData?.reduce((sum, item) => sum + item.total_cogs, 0) || 0,
    total_units: profitData?.reduce((sum, item) => sum + item.units_sold, 0) || 0,
    gross_profit: 0,
    profit_margin: 0,
  };
  overallSummary.gross_profit = overallSummary.total_revenue - overallSummary.total_cogs;
  overallSummary.profit_margin =
    overallSummary.total_revenue > 0 ? (overallSummary.gross_profit / overallSummary.total_revenue) * 100 : 0;

  // Filter data based on search
  const filteredData = profitData?.filter((item) =>
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleQuickDate = (months: number) => {
    const end = new Date();
    const start = subMonths(end, months);
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Profit Margin Analysis</h1>
            <p className="text-muted-foreground">
              Analyze gross profit margins using product cost prices
            </p>
          </div>
          <ReturnToPOSButton />
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(overallSummary.total_revenue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-500" />
                Total COGS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(overallSummary.total_cogs)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Gross Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(overallSummary.gross_profit)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Percent className="h-4 w-4 text-blue-500" />
                Profit Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overallSummary.profit_margin.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Group By</label>
                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleQuickDate(1)}>
                Last Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickDate(3)}>
                Last 3 Months
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickDate(6)}>
                Last 6 Months
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickDate(12)}>
                Last Year
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {groupBy === "product" ? "Product Profit Analysis" : "Category Profit Analysis"}
            </CardTitle>
            <CardDescription>
              Showing profit margins from {format(new Date(startDate), "MMM d, yyyy")} to{" "}
              {format(new Date(endDate), "MMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : groupBy === "product" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No sales data found for the selected period
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData?.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category_name}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.units_sold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_cogs)}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              item.gross_profit >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"
                            }
                          >
                            {formatCurrency(item.gross_profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.profit_margin >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span
                              className={item.profit_margin >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}
                            >
                              {item.profit_margin.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.avg_selling_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.avg_cost)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorySummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No sales data found for the selected period
                      </TableCell>
                    </TableRow>
                  ) : (
                    categorySummaries.map((cat) => (
                      <TableRow key={cat.category_name}>
                        <TableCell className="font-medium">{cat.category_name}</TableCell>
                        <TableCell className="text-right">{cat.product_count}</TableCell>
                        <TableCell className="text-right">{cat.units_sold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cat.total_revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cat.total_cogs)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cat.gross_profit >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {formatCurrency(cat.gross_profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {cat.profit_margin >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span className={cat.profit_margin >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                              {cat.profit_margin.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
