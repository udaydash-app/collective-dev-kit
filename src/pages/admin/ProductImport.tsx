import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle2, FileSpreadsheet, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from 'xlsx';

export default function ProductImport() {
  const [url, setUrl] = useState("");
  const [storeId, setStoreId] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

  const handleUrlImport = async () => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleExcelImport = async () => {
    if (!file || !storeId) {
      toast({
        title: "Missing Information",
        description: "Please select an Excel file and store",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // Read the Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Send to edge function for processing
      const { data: result, error } = await supabase.functions.invoke('import-products-excel', {
        body: { products: jsonData, storeId }
      });

      if (error) throw error;

      setImportResult({ success: true, count: result.count });
      toast({
        title: "Import Successful!",
        description: `Successfully imported ${result.count} products from Excel`,
      });
      
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Excel import error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Please check your Excel file format",
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
              Import products from a website URL or upload an Excel file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  From URL
                </TabsTrigger>
                <TabsTrigger value="excel" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  From Excel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-6">
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
                  onClick={handleUrlImport} 
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
                      Import from URL
                    </>
                  )}
                </Button>

                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">How URL import works:</h3>
                  <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>Paste the URL of a grocery store's product page</li>
                    <li>Select which store these products belong to</li>
                    <li>AI extracts product information automatically</li>
                    <li>Products are categorized and added to database</li>
                  </ol>
                </div>
              </TabsContent>

              <TabsContent value="excel" className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Excel File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={isImporting}
                  />
                  <p className="text-sm text-muted-foreground">
                    Upload an Excel file (.xlsx or .xls)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store-excel">Select Store</Label>
                  <Select value={storeId} onValueChange={setStoreId} disabled={isImporting}>
                    <SelectTrigger id="store-excel">
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
                  onClick={handleExcelImport} 
                  disabled={isImporting || !file || !storeId}
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
                      <FileSpreadsheet className="mr-2 h-5 w-5" />
                      Import from Excel
                    </>
                  )}
                </Button>

                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Excel file format:</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Your Excel file should have these columns:
                  </p>
                  <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                    <li><strong>name</strong> - Product name (required)</li>
                    <li><strong>description</strong> - Product description (optional)</li>
                    <li><strong>price</strong> - Price in FCFA (optional, defaults to 0)</li>
                    <li><strong>unit</strong> - Unit of measure (optional, defaults to "each")</li>
                    <li><strong>category</strong> - Category name (optional)</li>
                    <li><strong>stock_quantity</strong> - Stock amount (optional, defaults to 0)</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>

            {importResult && (
              <Card className="bg-green-50 border-green-200 mt-6">
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
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}