import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price?: number;
  wholesale_price?: number;
  vip_price?: number;
  unit: string;
  image_url: string | null;
  category_id: string | null;
  store_id: string;
  supplier_id?: string | null;
  is_available: boolean;
  is_featured?: boolean;
  stock_quantity: number;
  barcode?: string | null;
  categories?: { name: string };
  stores?: { name: string };
  contacts?: { name: string };
  product_variants?: any[];
}

interface ExportField {
  key: string;
  label: string;
  getValue: (product: Product) => any;
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'id', label: 'Product ID', getValue: (p) => p.id },
  { key: 'name', label: 'Product Name', getValue: (p) => p.name },
  { key: 'barcode', label: 'Barcode', getValue: (p) => p.barcode || '' },
  { key: 'description', label: 'Description', getValue: (p) => p.description || '' },
  { key: 'category', label: 'Category', getValue: (p) => p.categories?.name || '' },
  { key: 'store', label: 'Store', getValue: (p) => p.stores?.name || '' },
  { key: 'supplier', label: 'Supplier', getValue: (p) => p.contacts?.name || '' },
  { key: 'unit', label: 'Unit', getValue: (p) => p.unit },
  { key: 'price', label: 'Retail Price', getValue: (p) => p.price },
  { key: 'cost_price', label: 'Cost Price', getValue: (p) => p.cost_price || '' },
  { key: 'wholesale_price', label: 'Wholesale Price', getValue: (p) => p.wholesale_price || '' },
  { key: 'vip_price', label: 'VIP Price', getValue: (p) => p.vip_price || '' },
  { key: 'stock_quantity', label: 'Stock Quantity', getValue: (p) => p.stock_quantity },
  { key: 'is_available', label: 'Available', getValue: (p) => p.is_available ? 'Yes' : 'No' },
  { key: 'is_featured', label: 'Featured', getValue: (p) => p.is_featured ? 'Yes' : 'No' },
  { key: 'image_url', label: 'Image URL', getValue: (p) => p.image_url || '' },
];

interface ExportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

export function ExportProductsDialog({ open, onOpenChange, products }: ExportProductsDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(['id', 'name', 'barcode', 'price', 'wholesale_price', 'stock_quantity'])
  );

  const toggleField = (key: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(key)) {
      // Don't allow deselecting 'id' or 'name' as they're essential for import
      if (key !== 'id' && key !== 'name') {
        newSelected.delete(key);
      }
    } else {
      newSelected.add(key);
    }
    setSelectedFields(newSelected);
  };

  const selectAll = () => {
    setSelectedFields(new Set(EXPORT_FIELDS.map(f => f.key)));
  };

  const selectMinimal = () => {
    setSelectedFields(new Set(['id', 'name']));
  };

  const handleExport = () => {
    if (selectedFields.size === 0) {
      toast.error('Please select at least one field to export');
      return;
    }

    const selectedFieldConfigs = EXPORT_FIELDS.filter(f => selectedFields.has(f.key));
    
    // Create data rows
    const data = products.map(product => {
      const row: Record<string, any> = {};
      selectedFieldConfigs.forEach(field => {
        row[field.label] = field.getValue(product);
      });
      return row;
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    // Auto-size columns
    const colWidths = selectedFieldConfigs.map(field => ({
      wch: Math.max(field.label.length, 15)
    }));
    ws['!cols'] = colWidths;

    // Generate filename with date
    const date = new Date().toISOString().split('T')[0];
    const filename = `products_export_${date}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
    
    toast.success(`Exported ${products.length} products`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Products
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select fields to export ({products.length} products)
          </p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={selectMinimal}>
              Minimal
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2 border rounded-lg">
            {EXPORT_FIELDS.map(field => (
              <div key={field.key} className="flex items-center gap-2">
                <Checkbox
                  id={`export-${field.key}`}
                  checked={selectedFields.has(field.key)}
                  onCheckedChange={() => toggleField(field.key)}
                  disabled={field.key === 'id' || field.key === 'name'}
                />
                <Label 
                  htmlFor={`export-${field.key}`} 
                  className="text-sm cursor-pointer"
                >
                  {field.label}
                  {(field.key === 'id' || field.key === 'name') && (
                    <span className="text-xs text-muted-foreground ml-1">(required)</span>
                  )}
                </Label>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Export with Product ID to easily update products via import
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
