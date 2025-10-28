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
import { Loader2, Upload, CheckCircle2, FileSpreadsheet, Globe, ArrowLeft, Package, Download, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

export default function ProductImport() {
  // Set up PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [storeId, setStoreId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'create' | 'update'>('create');
  const [importResult, setImportResult] = useState<{ 
    success: boolean; 
    count: number; 
    method: string;
    notFoundCount?: number;
    notFoundProducts?: string[];
  } | null>(null);
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

      // Determine which function to call based on mode
      const functionName = importMode === 'update' ? 'update-products-excel' : 'import-products-excel';
      
      // Send to edge function for processing
      const { data: result, error } = await supabase.functions.invoke(functionName, {
        body: { products: jsonData, storeId }
      });

      if (error) throw error;

      if (importMode === 'update') {
        setImportResult({ 
          success: true, 
          count: result.updatedCount, 
          method: 'Excel Update',
          notFoundCount: result.notFoundCount,
          notFoundProducts: result.notFoundProducts
        });
        toast({
          title: "Update Successful!",
          description: `Updated ${result.updatedCount} products${result.notFoundCount > 0 ? `, ${result.notFoundCount} not found` : ''}`,
        });
      } else {
        setImportResult({ success: true, count: result.count, method: 'Excel' });
        toast({
          title: "Import Successful!",
          description: `Successfully imported ${result.count} products from Excel`,
        });
      }
      
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Excel import error:', error);
      toast({
        title: importMode === 'update' ? "Update Failed" : "Import Failed",
        description: error instanceof Error ? error.message : "Please check your Excel file format",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension !== 'pdf') {
        toast({
          title: "Invalid File",
          description: 'Please select a PDF file (.pdf)',
          variant: "destructive",
        });
        return;
      }
      
      setPdfFile(selectedFile);
    }
  };

  const handlePdfImport = async () => {
    if (!pdfFile || !storeId) {
      toast({
        title: "Missing Information",
        description: "Please select a PDF file and store",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // Extract text from PDF using pdf.js
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let pdfText = '';
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        pdfText += pageText + '\n';
      }
      
      console.log('Extracted PDF text length:', pdfText.length);
      console.log('Extracted PDF text preview:', pdfText.substring(0, 500));
      
      // Send to edge function for AI processing
      const { data: result, error } = await supabase.functions.invoke('update-products-pdf', {
        body: { pdfText, storeId }
      });

      if (error) throw error;

      setImportResult({ 
        success: true, 
        count: result.updated, 
        method: 'PDF Update',
        notFoundCount: result.notFound,
        notFoundProducts: result.notFoundProducts
      });
      
      toast({
        title: "Update Successful!",
        description: `Updated ${result.updated} products${result.notFound > 0 ? `, ${result.notFound} not found` : ''}`,
      });
      
      setPdfFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('PDF import error:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Please check your PDF file",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    let template;
    let filename;
    
    if (importMode === 'update') {
      template = [
        ['name', 'barcode', 'stock_quantity', 'cost_price'],
        ['Fresh Bananas', '1234567890123', '150', '350'],
        ['Whole Milk', '9876543210987', '75', '600'],
        ['Brown Rice', '5555555555555', '200', '1200']
      ];
      filename = 'products_update_template.csv';
    } else {
      template = [
        ['name', 'description', 'price', 'cost_price', 'unit', 'category', 'stock_quantity', 'barcode', 'is_available'],
        ['Fresh Bananas', 'Organic bananas from local farms', '500', '350', 'kg', 'Fruits', '100', '1234567890123', 'TRUE'],
        ['Whole Milk', 'Fresh whole milk 1L', '800', '600', 'liter', 'Dairy', '50', '9876543210987', 'TRUE'],
        ['Brown Rice', 'Premium quality brown rice', '1500', '1200', 'kg', 'Grains', '200', '5555555555555', 'TRUE']
      ];
      filename = 'products_import_template.csv';
    }

    const csvContent = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
                <div className="flex-1">
                  <p className="font-semibold text-green-900">
                    {importMode === 'update' ? 'Update Complete!' : 'Import Complete!'}
                  </p>
                  <p className="text-sm text-green-700">
                    {importMode === 'update' 
                      ? `Successfully updated ${importResult.count} products`
                      : `Successfully imported ${importResult.count} products`
                    } using {importResult.method} method
                  </p>
                  {importResult.notFoundCount !== undefined && importResult.notFoundCount > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm font-medium text-yellow-900 mb-1">
                        ⚠️ {importResult.notFoundCount} product{importResult.notFoundCount > 1 ? 's' : ''} not found:
                      </p>
                      <ul className="text-xs text-yellow-800 list-disc list-inside max-h-32 overflow-y-auto">
                        {importResult.notFoundProducts?.slice(0, 10).map((name, idx) => (
                          <li key={idx}>{name}</li>
                        ))}
                        {(importResult.notFoundProducts?.length || 0) > 10 && (
                          <li className="font-medium">...and {importResult.notFoundProducts!.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-6">
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
                  <Label htmlFor="import-mode">Import Mode *</Label>
                  <Select value={importMode} onValueChange={(value: 'create' | 'update') => setImportMode(value)} disabled={isImporting}>
                    <SelectTrigger id="import-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create">Create New Products</SelectItem>
                      <SelectItem value="update">Update Existing Products</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {importMode === 'create' 
                      ? 'Add new products to your inventory' 
                      : 'Update barcode, stock & cost price by matching product names'
                    }
                  </p>
                </div>

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
                        {importMode === 'update' ? 'Updating...' : 'Importing...'}
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        {importMode === 'update' ? 'Update Products' : 'Import Excel'}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={downloadTemplate}
                    variant="outline"
                    title={importMode === 'update' ? 'Download update template' : 'Download import template'}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* PDF Import Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Update from PDF
                </CardTitle>
                <CardDescription>
                  Upload any PDF with product information (AI will extract it)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf-upload">PDF File *</Label>
                  <Input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfFileChange}
                    disabled={isImporting}
                  />
                  {pdfFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    AI will extract product names, barcodes, stock, and cost prices
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store-pdf">Select Store *</Label>
                  <Select value={storeId} onValueChange={setStoreId} disabled={isImporting}>
                    <SelectTrigger id="store-pdf">
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
                  onClick={handlePdfImport} 
                  disabled={isImporting || !pdfFile || !storeId}
                  className="w-full"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Update from PDF
                    </>
                  )}
                </Button>
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
                <CardTitle className="text-lg">
                  {importMode === 'update' ? 'Update Mode Instructions' : 'Excel Import Instructions'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    {importMode === 'update' ? (
                      <>
                        <strong>Update Mode - Match by Product Name:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                          <li><strong>Required column:</strong> name (must match existing products)</li>
                          <li><strong>Update columns:</strong> barcode, stock_quantity, cost_price</li>
                          <li>Products are matched by name (case-insensitive)</li>
                          <li>Only specified fields will be updated</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <strong>File Format Requirements:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                          <li><strong>Required column:</strong> name</li>
                          <li><strong>Optional columns:</strong> description, price, cost_price, unit, category, stock_quantity, barcode, is_available (TRUE/FALSE)</li>
                          <li>Download the template for the correct format</li>
                        </ul>
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-semibold mb-2">
                    {importMode === 'update' ? 'Updateable Fields:' : 'Column Descriptions:'}
                  </h4>
                  {importMode === 'update' ? (
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><strong>name</strong> - Product name for matching (required)</li>
                      <li><strong>barcode</strong> - Update product barcode</li>
                      <li><strong>stock_quantity</strong> - Update available stock</li>
                      <li><strong>cost_price</strong> - Update purchase/cost price</li>
                    </ul>
                  ) : (
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><strong>name</strong> - Product name (required)</li>
                      <li><strong>price</strong> - Selling price in your currency</li>
                      <li><strong>cost_price</strong> - Purchase/cost price</li>
                      <li><strong>unit</strong> - Unit of measure (kg, liter, piece, etc.)</li>
                      <li><strong>stock_quantity</strong> - Available stock</li>
                      <li><strong>barcode</strong> - Product barcode for scanning</li>
                    </ul>
                  )}
                </div>

                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium mb-1">💡 Tip:</p>
                  <p className="text-muted-foreground">
                    {importMode === 'update' 
                      ? 'Product names must exactly match (case-insensitive). Products not found will be listed in the results.'
                      : 'Use TRUE/FALSE or 1/0 for the is_available column. Leave blank for default (available).'
                    }
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
