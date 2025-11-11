import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Upload, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UpdateButton } from "@/components/UpdateButton";
import { APP_VERSION } from "@/config/version";

interface Settings {
  id: string;
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  region: string;
  language: string;
  currency: string;
}

export default function AdminSettings() {
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#22C55E");
  const [secondaryColor, setSecondaryColor] = useState("#1E293B");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [region, setRegion] = useState("Côte d'Ivoire");
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("XOF");

  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Settings | null;
    }
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setCompanyEmail(settings.company_email || "");
      setCompanyPhone(settings.company_phone || "");
      setCompanyAddress(settings.company_address || "");
      setLogoUrl(settings.logo_url || "");
      setPrimaryColor(settings.primary_color);
      setSecondaryColor(settings.secondary_color);
      setRegion(settings.region);
      setLanguage(settings.language);
      setCurrency(settings.currency);
      if (settings.logo_url) {
        setLogoPreview(settings.logo_url);
      }
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return logoUrl;

    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
      return null;
    }
  };

  const updateSettings = useMutation({
    mutationFn: async () => {
      let finalLogoUrl = logoUrl;
      
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          finalLogoUrl = uploadedUrl;
        }
      }

      const settingsData = {
        company_name: companyName,
        company_email: companyEmail || null,
        company_phone: companyPhone || null,
        company_address: companyAddress || null,
        logo_url: finalLogoUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        region: region,
        language: language,
        currency: currency,
      };

      if (settings?.id) {
        // Update existing settings
        const { error } = await supabase
          .from('settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await supabase
          .from('settings')
          .insert([settingsData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Settings updated successfully');
      setLogoFile(null);
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Company Settings</h1>
            <p className="text-muted-foreground">Manage your company information and branding</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Basic information about your company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter company name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-email">Company Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-phone">Company Phone</Label>
                <Input
                  id="company-phone"
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="+225 XX XX XX XX XX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-address">Company Address</Label>
                <Textarea
                  id="company-address"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Enter company address"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Customize your company logo and colors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview && (
                    <div className="w-32 h-32 border rounded-lg flex items-center justify-center bg-muted p-2">
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-muted-foreground">
                      Upload a new logo (PNG, JPG, SVG)
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#22C55E"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#1E293B"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
              <CardDescription>
                Configure region, language and currency preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Enter region"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="e.g., en, fr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="e.g., XOF, USD, EUR"
                />
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full"
            disabled={updateSettings.isPending || isLoading}
          >
            {updateSettings.isPending ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </form>

        {/* Version and Update Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>App Version</CardTitle>
            <CardDescription>
              Current version and update management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Current Version</p>
                <p className="text-2xl font-bold text-primary">v{APP_VERSION}</p>
              </div>
              <UpdateButton />
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
