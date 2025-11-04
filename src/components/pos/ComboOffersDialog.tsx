import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Package } from 'lucide-react';
import { useState } from 'react';

interface ComboOffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCombo: (combo: any) => void;
}

export function ComboOffersDialog({ open, onOpenChange, onSelectCombo }: ComboOffersDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: combos, isLoading } = useQuery({
    queryKey: ['active-combo-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combo_offers')
        .select(`
          *,
          combo_offer_items (
            id,
            quantity,
            product_id,
            variant_id,
            products (
              id,
              name,
              price,
              image_url
            ),
            product_variants (
              id,
              label,
              price
            )
          )
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const filteredCombos = combos?.filter(combo =>
    combo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateRegularPrice = (items: any[]) => {
    return items.reduce((sum, item) => {
      const price = item.variant_id 
        ? item.product_variants?.price || 0
        : item.products?.price || 0;
      return sum + (price * item.quantity);
    }, 0);
  };

  const handleSelectCombo = (combo: any) => {
    onSelectCombo(combo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Combo Offers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search combos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {isLoading ? (
            <div className="text-center py-8">Loading combos...</div>
          ) : filteredCombos && filteredCombos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
              {filteredCombos.map((combo) => {
                const regularPrice = calculateRegularPrice(combo.combo_offer_items || []);
                const savings = regularPrice - combo.combo_price;
                
                return (
                  <Card key={combo.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{combo.name}</h3>
                            {combo.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {combo.description}
                              </p>
                            )}
                          </div>
                          <Badge className="bg-green-100 text-green-800">
                            COMBO
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium">Includes:</p>
                          <ul className="text-sm text-muted-foreground space-y-0.5">
                            {combo.combo_offer_items?.map((item: any) => (
                              <li key={item.id}>
                                • {item.quantity}x {item.products?.name}
                                {item.variant_id && ` (${item.product_variants?.label})`}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="border-t pt-3 space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Regular Price:</span>
                            <span className="line-through">₹{regularPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">Combo Price:</span>
                            <span className="text-xl font-bold text-green-600">
                              ₹{combo.combo_price.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>You Save:</span>
                            <Badge variant="secondary" className="bg-green-50 text-green-700">
                              ₹{savings.toFixed(2)}
                            </Badge>
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          onClick={() => handleSelectCombo(combo)}
                        >
                          Add to Cart
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No combos match your search' : 'No combo offers available'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
