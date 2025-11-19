import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PurchaseUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: any[];
  suppliers: any[];
  onSuccess: () => void;
}

interface ExcelRow {
  "Product Name"?: string;
  "Buy Price"?: number;
  "Sell Price"?: number;
  "Quantity"?: number;
}

export function PurchaseUploadDialog({
  open,
  onOpenChange,
  stores,
  suppliers,
  onSuccess,
}: PurchaseUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ExcelRow[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Preview the file
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
      setPreview(jsonData.slice(0, 5)); // Show first 5 rows
    } catch (error) {
      console.error("Error reading Excel file:", error);
      toast.error("Failed to read Excel file");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedStore || !selectedSupplier) {
      toast.error("Please select file, store, and supplier");
      return;
    }

    setUploading(true);

    try {
      // Read Excel file
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

      if (jsonData.length === 0) {
        toast.error("Excel file is empty");
        return;
      }

      // Get supplier details
      const supplier = suppliers.find((s) => s.id === selectedSupplier);
      if (!supplier) {
        toast.error("Supplier not found");
        return;
      }

      // Get default category for new products
      const { data: defaultCategory } = await supabase
        .from("categories")
        .select("id")
        .limit(1)
        .single();

      const purchaseItems = [];
      let createdProducts = 0;
      let existingProducts = 0;

      // Process each row
      for (const row of jsonData) {
        const productName = row["Product Name"]?.toString().trim();
        const buyPrice = parseFloat(row["Buy Price"]?.toString() || "0");
        const sellPrice = parseFloat(row["Sell Price"]?.toString() || "0");
        const quantity = parseFloat(row["Quantity"]?.toString() || "0");

        if (!productName || quantity <= 0) {
          console.log("Skipping invalid row:", row);
          continue;
        }

        // Check if product exists
        let { data: existingProduct } = await supabase
          .from("products")
          .select("id, name")
          .eq("store_id", selectedStore)
          .ilike("name", productName)
          .maybeSingle();

        let productId = existingProduct?.id;

        // Create product if it doesn't exist
        if (!existingProduct) {
          const { data: newProduct, error: createError } = await supabase
            .from("products")
            .insert({
              name: productName,
              price: sellPrice,
              cost_price: buyPrice,
              unit: "unit",
              store_id: selectedStore,
              category_id: defaultCategory?.id,
              stock_quantity: 0,
              is_available: true,
            })
            .select("id")
            .single();

          if (createError) {
            console.error("Error creating product:", createError);
            continue;
          }

          productId = newProduct.id;
          createdProducts++;
        } else {
          existingProducts++;
        }

        // Add to purchase items
        purchaseItems.push({
          product_id: productId,
          quantity,
          unit_cost: buyPrice,
          total_cost: buyPrice * quantity,
        });
      }

      if (purchaseItems.length === 0) {
        toast.error("No valid products found in Excel file");
        return;
      }

      // Create purchase
      const totalAmount = purchaseItems.reduce((sum, item) => sum + item.total_cost, 0);

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          supplier_name: supplier.name,
          supplier_contact: supplier.phone,
          store_id: selectedStore,
          payment_status: "pending",
          total_amount: totalAmount,
          purchased_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(
          purchaseItems.map((item) => ({
            ...item,
            purchase_id: purchase.id,
          }))
        );

      if (itemsError) throw itemsError;

      toast.success(
        `Purchase created successfully! ${createdProducts} new products created, ${existingProducts} existing products found.`
      );

      onSuccess();
      onOpenChange(false);
      setSelectedFile(null);
      setPreview([]);
      setSelectedStore("");
      setSelectedSupplier("");
    } catch (error) {
      console.error("Error uploading purchase:", error);
      toast.error("Failed to upload purchase");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload Purchase from Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Excel file should have columns: <strong>Product Name</strong>, <strong>Buy Price</strong>,{" "}
              <strong>Sell Price</strong>, <strong>Quantity</strong>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <div>
              <Label htmlFor="store">Store</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="file">Excel File</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>

            {preview.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Preview (first 5 rows):</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Product Name</th>
                        <th className="text-right p-2">Buy Price</th>
                        <th className="text-right p-2">Sell Price</th>
                        <th className="text-right p-2">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{row["Product Name"]}</td>
                          <td className="text-right p-2">{row["Buy Price"]}</td>
                          <td className="text-right p-2">{row["Sell Price"]}</td>
                          <td className="text-right p-2">{row["Quantity"]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile || !selectedStore || !selectedSupplier}>
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Purchase
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
