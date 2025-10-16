import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Coins, Banknote, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageView } from "@/hooks/useAnalytics";

interface PaymentMethod {
  id: string;
  type: string;
  label: string;
  is_default: boolean;
  last_four: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
}

const getPaymentIcon = (type: string) => {
  switch (type) {
    case "store_credit":
      return Coins;
    case "cash_on_delivery":
      return Banknote;
    case "wave_money":
      return Smartphone;
    case "orange_money":
      return Smartphone;
    default:
      return Coins;
  }
};

export default function PaymentMethods() {
  usePageView("Payment Methods");
  const navigate = useNavigate();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMethod, setNewMethod] = useState({
    type: "store_credit",
    label: "",
    last_four: "",
    expiry_month: "",
    expiry_year: "",
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
    fetchPaymentMethods();
  };

  const fetchPaymentMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast.error("Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  };

  const addPaymentMethod = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!newMethod.label) {
        toast.error("Please enter a label for this payment method");
        return;
      }

      const methodData: any = {
        user_id: user.id,
        type: newMethod.type,
        label: newMethod.label,
        is_default: paymentMethods.length === 0,
      };

      const { error } = await supabase
        .from("payment_methods")
        .insert(methodData);

      if (error) throw error;

      toast.success("Payment method added");
      setDialogOpen(false);
      setNewMethod({
        type: "store_credit",
        label: "",
        last_four: "",
        expiry_month: "",
        expiry_year: "",
      });
      fetchPaymentMethods();
    } catch (error) {
      console.error("Error adding payment method:", error);
      toast.error("Failed to add payment method");
    }
  };

  const removePaymentMethod = async (id: string) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Payment method removed");
      fetchPaymentMethods();
    } catch (error) {
      console.error("Error removing payment method:", error);
      toast.error("Failed to remove payment method");
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, unset all as non-default
      await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", user.id);

      // Then set the selected one as default
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;

      toast.success("Default payment method updated");
      fetchPaymentMethods();
    } catch (error) {
      console.error("Error setting default payment method:", error);
      toast.error("Failed to update default payment method");
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
          <h1 className="text-2xl font-bold">Payment Methods</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : paymentMethods.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No payment methods added yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const Icon = getPaymentIcon(method.type);
              return (
                <Card key={method.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{method.label}</h3>
                          {method.is_default && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        {(method.type === "wave_money" || method.type === "orange_money") && (
                          <p className="text-sm text-muted-foreground">
                            Pay To: <span className="font-mono">+225 07 79 78 47 83</span>
                          </p>
                        )}
                        {method.expiry_month && method.expiry_year && (
                          <p className="text-sm text-muted-foreground">
                            Expires {method.expiry_month}/{method.expiry_year}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!method.is_default && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setAsDefault(method.id)}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive"
                          onClick={() => removePaymentMethod(method.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Add Payment Method
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
              <DialogDescription>
                Add a new payment method to your account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select
                  value={newMethod.type}
                  onValueChange={(value) => setNewMethod({ ...newMethod, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store_credit">Store Credit</SelectItem>
                    <SelectItem value="cash_on_delivery">Cash on Delivery</SelectItem>
                    <SelectItem value="wave_money">Wave Money</SelectItem>
                    <SelectItem value="orange_money">Orange Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  placeholder={
                    newMethod.type === "wave_money" ? "e.g., Wave Money Account" :
                    newMethod.type === "orange_money" ? "e.g., Orange Money Account" :
                    newMethod.type === "store_credit" ? "e.g., My Store Credit" :
                    "e.g., Cash on Delivery"
                  }
                  value={newMethod.label}
                  onChange={(e) => setNewMethod({ ...newMethod, label: e.target.value })}
                />
              </div>

              {(newMethod.type === "wave_money" || newMethod.type === "orange_money") && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-1">Payment Instructions</p>
                    <p className="text-sm text-muted-foreground">
                      Pay To: <span className="font-mono font-semibold text-foreground">+225 07 79 78 47 83</span>
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addPaymentMethod}>Add Method</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="bg-muted/50">
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            🔒 Your payment information is encrypted and secure
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
