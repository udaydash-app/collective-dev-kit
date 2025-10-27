import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, CheckCircle2, FileSpreadsheet, Globe, ArrowLeft, Package, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from 'xlsx';

export default function ProductImport() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [storeId, setStoreId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number; method: string } | null>(null);
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

      setImportResult({ success: true, count: data.count, method: 'URL' });
      toast({
        title: "Import Successful!",
        description: `Successfully imported ${data.count} products from URL`,
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
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (!['xlsx', 'xls'].includes(fileExtension || '')) {
        toast({
          title: "Invalid File",
          description: 'Please select an Excel file (.xlsx or .xls)',
          variant: "destructive",
        });
        return;
      }
      
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

      setImportResult({ success: true, count: result.count, method: 'Excel' });
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

  const downloadTemplate = () => {
    const template = [
      ['name', 'description', 'price', 'cost_price', 'unit', 'category', 'stock_quantity', 'barcode', 'is_available'],
      ['Fresh Bananas', 'Organic bananas from local farms', '500', '350', 'kg', 'Fruits', '100', '1234567890123', 'TRUE'],
      ['Whole Milk', 'Fresh whole milk 1L', '800', '600', 'liter', 'Dairy', '50', '9876543210987', 'TRUE'],
      ['Brown Rice', 'Premium quality brown rice', '1500', '1200', 'kg', 'Grains', '200', '5555555555555', 'TRUE']
    ];

    const csvContent = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              Import Products
            </h1>
            <p className="text-muted-foreground mt-2">
              Import products from a website URL or upload an Excel file
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => navigate("/admin/pos")}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to POS
            </Button>
            <Button 
              onClick={() => navigate("/admin/products")}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Products
            </Button>
          </div>
        </div>

        {importResult && (
          <Card className="bg-green-50 border-green-200 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Import Complete!</p>
                  <p className="text-sm text-green-700">
                    Successfully imported {importResult.count} products using {importResult.method} method
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-6">
            {/* URL Import Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Import from URL
                </CardTitle>
                <CardDescription>
                  Extract product information automatically from a website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example-grocery-store.com/products"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isImporting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the URL of a grocery store's product listing page
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store-url">Select Store *</Label>
                  <Select value={storeId} onValueChange={setStoreId} disabled={isImporting}>
                    <SelectTrigger id="store-url">
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
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import from URL
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Excel Import Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Import from Excel
                </CardTitle>
                <CardDescription>
                  Upload an Excel file with product information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Excel File *</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={isImporting}
                  />
                  {file && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store-excel">Select Store *</Label>
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

                <div className="flex gap-2">
                  <Button 
                    onClick={handleExcelImport} 
                    disabled={isImporting || !file || !storeId}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Excel
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={downloadTemplate}
                    variant="outline"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Instructions Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* URL Import Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">URL Import Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <strong>How URL Import Works:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                      <li>Paste the URL of a grocery store's product page</li>
                      <li>Select which store these products belong to</li>
                      <li>AI extracts product information automatically</li>
                      <li>Products are categorized and added to database</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-semibold mb-2">Supported Information:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Product names and descriptions</li>
                    <li>✓ Prices and units</li>
                    <li>✓ Product images</li>
                    <li>✓ Categories (auto-detected)</li>
                    <li>✓ Availability status</li>
                  </ul>
                </div>

                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium mb-1">💡 Tip:</p>
                  <p className="text-muted-foreground">
                    For best results, use URLs that contain a list of products with clear pricing and descriptions.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Excel Import Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Excel Import Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <strong>File Format Requirements:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li><strong>Required column:</strong> name</li>
                      <li><strong>Optional columns:</strong> description, price, cost_price, unit, category, stock_quantity, barcode, is_available (TRUE/FALSE)</li>
                      <li>Download the template for the correct format</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-semibold mb-2">Column Descriptions:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li><strong>name</strong> - Product name (required)</li>
                    <li><strong>price</strong> - Selling price in your currency</li>
                    <li><strong>cost_price</strong> - Purchase/cost price</li>
                    <li><strong>unit</strong> - Unit of measure (kg, liter, piece, etc.)</li>
                    <li><strong>stock_quantity</strong> - Available stock</li>
                    <li><strong>barcode</strong> - Product barcode for scanning</li>
                  </ul>
                </div>

                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium mb-1">💡 Tip:</p>
                  <p className="text-muted-foreground">
                    Use TRUE/FALSE or 1/0 for the is_available column. Leave blank for default (available).
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
