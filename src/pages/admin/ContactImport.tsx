import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, ArrowLeft, FileSpreadsheet, Users, LogOut } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ContactImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
        toast.error('Please select an Excel (.xlsx, .xls) or CSV file');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Uploading file...');

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];

          setUploadProgress('Processing contacts...');

          const { data, error } = await supabase.functions.invoke('import-contacts', {
            body: { 
              fileData: base64Data,
              fileName: file.name 
            }
          });

          if (error) throw error;

          if (data.success) {
            toast.success(`Successfully imported ${data.imported} contacts!`);
            setFile(null);
            if (data.skipped > 0) {
              toast.info(`Skipped ${data.skipped} contacts (duplicates or errors)`);
            }
          } else {
            toast.error(data.message || 'Failed to import contacts');
          }
        } catch (error: any) {
          console.error('Import error:', error);
          toast.error(error.message || 'Failed to import contacts');
        } finally {
          setIsUploading(false);
          setUploadProgress('');
        }
      };

      reader.onerror = () => {
        toast.error('Failed to read file');
        setIsUploading(false);
        setUploadProgress('');
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['name', 'email', 'phone', 'contact_person', 'is_customer', 'is_supplier', 'opening_balance', 'address_line1', 'address_line2', 'city', 'state', 'zip_code', 'country', 'tax_id', 'credit_limit', 'notes'],
      ['John Doe', 'john@example.com', '+1234567890', 'John Smith', 'TRUE', 'FALSE', '1000', '123 Main St', 'Apt 4', 'New York', 'NY', '10001', 'USA', 'TAX123', '5000', 'VIP customer'],
      ['ABC Suppliers', 'contact@abcsuppliers.com', '+0987654321', 'Jane Doe', 'FALSE', 'TRUE', '-500', '456 Supply Ave', '', 'Chicago', 'IL', '60601', 'USA', 'SUP456', '10000', 'Main supplier']
    ];

    const csvContent = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_import_template.csv';
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
              <Users className="h-8 w-8" />
              Import Contacts
            </h1>
            <p className="text-muted-foreground mt-2">
              Upload an Excel or CSV file to import contacts (customers/suppliers)
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
              onClick={() => navigate("/admin/contacts")}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Contacts
            </Button>
          </div>
        </div>

        <div className="grid gap-6 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                File Upload
              </CardTitle>
              <CardDescription>
                Upload your contacts file in Excel (.xlsx, .xls) or CSV format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>File Format Guidelines:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Required columns:</strong> name</li>
                    <li><strong>Optional columns:</strong> email, phone, contact_person, is_customer (TRUE/FALSE), is_supplier (TRUE/FALSE), opening_balance (number), address_line1, address_line2, city, state, zip_code, country, tax_id, credit_limit, notes</li>
                    <li><strong>Opening Balance:</strong> Positive for amounts owed to you (customer), negative for amounts you owe (supplier)</li>
                    <li><strong>Boolean fields:</strong> Use TRUE/FALSE or 1/0</li>
                    <li>Download the template below for the correct format</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                {file && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? uploadProgress : 'Upload and Import'}
                </Button>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Step 1: Prepare Your File</h3>
                <p className="text-sm text-muted-foreground">
                  Download the template file and fill in your contact information. Make sure to include at least the name for each contact.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Step 2: Contact Types</h3>
                <p className="text-sm text-muted-foreground">
                  - Set <strong>is_customer</strong> to TRUE for customers (people/companies who buy from you)<br />
                  - Set <strong>is_supplier</strong> to TRUE for suppliers (people/companies you buy from)<br />
                  - A contact can be both customer and supplier
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Step 3: Opening Balance</h3>
                <p className="text-sm text-muted-foreground">
                  - Use positive numbers for amounts customers owe you (e.g., 1000)<br />
                  - Use negative numbers for amounts you owe suppliers (e.g., -500)<br />
                  - Leave blank or use 0 if there's no opening balance
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Step 4: Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Select your completed file and click "Upload and Import". The system will process all contacts and notify you of the results.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
