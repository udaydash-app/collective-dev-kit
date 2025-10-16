import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function ProductImport() {
  const [url, setUrl] = useState("");
  const [storeId, setStoreId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number } | null>(null);
  const { toast } = useToast();

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    }
  });

  const handleImport = async () => {
    if (!url || !storeId) {
      toast({
        title: "Missing Information",
        description: "Please provide both URL and store selection",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-products', {
        body: { url, storeId }
      });

      if (error) throw error;

      setImportResult({ success: true, count: data.count });
      toast({
        title: "Import Successful!",
        description: `Successfully imported ${data.count} products`,
      });
      
      setUrl("");
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Please check the URL and try again",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-6 w-6" />
              Product Import Tool
            </CardTitle>
            <CardDescription>
              Import products from any grocery website using AI-powered extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example-grocery-store.com/products"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isImporting}
              />
              <p className="text-sm text-muted-foreground">
                Enter the URL of a grocery store's product page
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store">Select Store</Label>
              <Select value={storeId} onValueChange={setStoreId} disabled={isImporting}>
                <SelectTrigger id="store">
                  <SelectValue placeholder="Choose a store" />
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

            <Button 
              onClick={handleImport} 
              disabled={isImporting || !url || !storeId}
              className="w-full"
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Importing Products...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Import Products
                </>
              )}
            </Button>

            {importResult && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900">Import Complete!</p>
                      <p className="text-sm text-green-700">
                        Successfully imported {importResult.count} products
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">How it works:</h3>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Paste the URL of a grocery store's product listing page</li>
                <li>Select which store these products belong to</li>
                <li>AI extracts product names, prices, descriptions, and images</li>
                <li>Products are automatically categorized and added to database</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
