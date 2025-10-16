import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageView } from "@/hooks/useAnalytics";

interface Address {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

export default function Addresses() {
  usePageView("Addresses");
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
  });

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth/login");
      return;
    }
    fetchAddresses();
  };

  const fetchAddresses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      toast.error("Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        label: address.label,
        address_line1: address.address_line1,
        address_line2: address.address_line2 || "",
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
      });
    } else {
      setEditingAddress(null);
      setFormData({
        label: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        zip_code: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSaveAddress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!formData.label || !formData.address_line1 || !formData.city) {
        toast.error("Please fill in all required fields");
        return;
      }

      const addressData: any = {
        user_id: user.id,
        label: formData.label,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2 || null,
        city: formData.city,
        state: formData.state || "",
        zip_code: formData.zip_code || "",
        is_default: addresses.length === 0,
      };

      if (editingAddress) {
        const { error } = await supabase
          .from("addresses")
          .update(addressData)
          .eq("id", editingAddress.id);

        if (error) throw error;
        toast.success("Address updated successfully");
      } else {
        const { error } = await supabase
          .from("addresses")
          .insert(addressData);

        if (error) throw error;
        toast.success("Address added successfully");
      }

      setDialogOpen(false);
      fetchAddresses();
    } catch (error) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    try {
      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Address deleted successfully");
      fetchAddresses();
    } catch (error) {
      console.error("Error deleting address:", error);
      toast.error("Failed to delete address");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, unset all as non-default
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);

      // Then set the selected one as default
      const { error } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;

      toast.success("Default address updated");
      fetchAddresses();
    } catch (error) {
      console.error("Error setting default address:", error);
      toast.error("Failed to update default address");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/profile">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Delivery Addresses</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-5 h-5 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No addresses added yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <Card key={addr.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{addr.label}</h3>
                        {addr.is_default && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {addr.city}, {addr.state} {addr.zip_code}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!addr.is_default && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleSetDefault(addr.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenDialog(addr)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive"
                        onClick={() => handleDeleteAddress(addr.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => handleOpenDialog()}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Address
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingAddress ? "Edit Address" : "Add New Address"}</DialogTitle>
              <DialogDescription>
                {editingAddress ? "Update your delivery address" : "Add a new delivery address to your account"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  placeholder="e.g., Home, Work, etc."
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line1">Address Line 1 *</Label>
                <Input
                  id="address_line1"
                  placeholder="Street address"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  placeholder="Apartment, suite, etc. (optional)"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Region</Label>
                  <Input
                    id="state"
                    placeholder="State"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip/Postal Code</Label>
                <Input
                  id="zip_code"
                  placeholder="Zip code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAddress}>
                {editingAddress ? "Update Address" : "Add Address"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <BottomNav />
    </div>
  );
}
