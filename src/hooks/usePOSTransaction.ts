import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { offlineDB } from '@/lib/offlineDB';
import { v4 as uuidv4 } from 'uuid';
import { calculateTimbreTax } from '@/lib/timbreTax';

export interface CartItem {
  id: string;
  productId: string; // Base product ID (for looking up custom prices)
  name: string;
  displayName?: string; // Custom name for this order only (doesn't modify product in DB)
  price: number;
  originalPrice?: number; // Store original price before discount
  quantity: number;
  barcode?: string;
  image_url?: string;
  itemDiscount?: number;
  customPrice?: number;
  manualPriceChange?: boolean; // Flag to track if price was manually changed by cashier
  isCombo?: boolean;
  comboId?: string;
  comboItems?: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    product_name: string;
  }>;
  isBogo?: boolean; // Added for BOGO offers
  bogoOfferId?: string; // Added for BOGO offers
}

export interface PaymentDetail {
  method: string;
  amount: number;
}

const POS_CART_KEY = 'pos_cart_state';
const POS_DISCOUNT_KEY = 'pos_discount_state';

export const usePOSTransaction = () => {
  // Load cart from localStorage on mount
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(POS_CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      return [];
    }
  });
  
  const [discount, setDiscount] = useState(() => {
    try {
      const saved = localStorage.getItem(POS_DISCOUNT_KEY);
      return saved ? parseFloat(saved) : 0;
    } catch (error) {
      console.error('Error loading discount from localStorage:', error);
      return 0;
    }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Cache offers to avoid repeated database queries
  const [cachedCombos, setCachedCombos] = useState<any[]>([]);
  const [cachedBOGOs, setCachedBOGOs] = useState<any[]>([]);
  const [cachedMultiBOGOs, setCachedMultiBOGOs] = useState<any[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  
  // Cache authenticated user to avoid repeated auth calls
  const cachedUserRef = useRef<{ id: string } | null>(null);
  
  // Debounce timer for offer detection
  const offerDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cartUpdateQueueRef = useRef<CartItem[]>([]);
  
  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(POS_CART_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cart]);
  
  // Persist discount to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(POS_DISCOUNT_KEY, discount.toString());
    } catch (error) {
      console.error('Error saving discount to localStorage:', error);
    }
  }, [discount]);

  // Load and cache all offers on mount
  useEffect(() => {
    const loadAllOffers = async () => {
      try {
        // Fetch all offers in parallel
        const [combos, bogos, multiBogos] = await Promise.all([
          fetchActiveCombos(),
          fetchActiveBOGOOffers(),
          fetchActiveMultiProductBOGOOffers()
        ]);
        
        setCachedCombos(combos);
        setCachedBOGOs(bogos);
        setCachedMultiBOGOs(multiBogos);
        setOffersLoaded(true);
      } catch (error) {
        console.error('Error loading offers:', error);
        setOffersLoaded(true); // Continue even if offers fail to load
      }
    };
    
    loadAllOffers();
  }, []);
  
  // Helper function to fetch active combos
  const fetchActiveCombos = async () => {
    try {
      const { data, error } = await supabase
        .from('combo_offers')
        .select(`
          id,
          name,
          combo_price,
          combo_offer_items (
            product_id,
            variant_id,
            quantity,
            products (
              id,
              name,
              price
            ),
            product_variants (
              id,
              label,
              price
            )
          )
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching combos:', error);
      // Fallback to offline DB
      try {
        return await offlineDB.getComboOffers();
      } catch (offlineError) {
        console.error('Error fetching offline combos:', offlineError);
        return [];
      }
    }
  };

  // Helper function to fetch active BOGO offers
  const fetchActiveBOGOOffers = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('bogo_offers')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching BOGO offers:', error);
      return [];
    }
  };

  // Helper function to fetch active multi-product BOGO offers
  const fetchActiveMultiProductBOGOOffers = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('multi_product_bogo_offers')
        .select(`
          *,
          multi_product_bogo_items(
            product_id,
            variant_id,
            products(name, price),
            product_variants(label, price)
          )
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching multi-product BOGO offers:', error);
      return [];
    }
  };

  // Automatic multi-product BOGO detection and application
  const detectAndApplyMultiProductBOGO = async (currentCart: CartItem[], useCache = true): Promise<CartItem[]> => {
    try {
      const offers = useCache ? cachedMultiBOGOs : await fetchActiveMultiProductBOGOOffers();
      
      if (!offers || offers.length === 0) {
        return currentCart;
      }

      let updatedCart = [...currentCart];

      for (const offer of offers) {
        if (!offer.multi_product_bogo_items || offer.multi_product_bogo_items.length === 0) {
          continue;
        }

        const eligibleItems = offer.multi_product_bogo_items;
        
        // Find matching cart items and count total quantity
        let totalCount = 0;
        const matchingIndices: number[] = [];
        
        updatedCart.forEach((item, index) => {
          // Skip combo items and cart discount
          if (item.isCombo || item.id === 'cart-discount') return;
          
          const matches = eligibleItems.some((eligible: any) => {
            if (eligible.variant_id) {
              return item.id === eligible.variant_id;
            } else {
              return item.productId === eligible.product_id;
            }
          });
          
          if (matches) {
            totalCount += item.quantity;
            matchingIndices.push(index);
          }
        });

        // Apply or remove 50% discount based on count
        matchingIndices.forEach(index => {
          const item = updatedCart[index];
          
          if (totalCount > 1) {
            // Apply discount
            const basePrice = item.originalPrice || item.price;
            updatedCart[index] = {
              ...item,
              originalPrice: basePrice,
              price: basePrice * 0.5,
              isBogo: true,
              bogoOfferId: offer.id,
            };
          } else {
            // Remove discount if count drops to 1 or less
            if (item.originalPrice) {
              updatedCart[index] = {
                ...item,
                price: item.originalPrice,
                originalPrice: undefined,
                isBogo: false,
                bogoOfferId: undefined,
              };
            }
          }
        });
      }

      return updatedCart;
    } catch (error) {
      console.error('Error in detectAndApplyMultiProductBOGO:', error);
      return currentCart;
    }
  };

  // Automatic BOGO offer detection and application
  const detectAndApplyBOGOOffers = async (currentCart: CartItem[], useCache = true): Promise<CartItem[]> => {
    try {
      console.log('🎁 detectAndApplyBOGOOffers START - Cart:', currentCart.map(i => ({ name: i.name, qty: i.quantity })));
      const bogoOffers = useCache ? cachedBOGOs : await fetchActiveBOGOOffers();
      console.log('🎉 Fetched BOGO offers:', bogoOffers);
      
      if (!bogoOffers || bogoOffers.length === 0) {
        console.log('❌ No active BOGO offers found');
        return currentCart;
      }

      // Filter out existing BOGO items
      let regularItems = currentCart.filter(item => !item.isBogo && !item.isCombo && item.id !== 'cart-discount');
      const appliedBOGOs: CartItem[] = [];

      // Try to apply each BOGO offer
      for (const bogo of bogoOffers) {
        console.log('🎁 Processing BOGO:', bogo.name);
        
        // Find matching buy items in cart
        const matchingBuyItems = regularItems.filter(item => {
          const matchesProduct = bogo.buy_product_id === item.productId;
          const matchesVariant = bogo.buy_variant_id ? bogo.buy_variant_id === item.id : true;
          return matchesProduct && matchesVariant;
        });

        if (matchingBuyItems.length === 0) {
          console.log('⚠️ No matching buy items for BOGO:', bogo.name);
          continue;
        }

        // Calculate how many times we can apply this BOGO
        const totalBuyQuantity = matchingBuyItems.reduce((sum, item) => sum + item.quantity, 0);
        let timesApplicable = Math.floor(totalBuyQuantity / bogo.buy_quantity);

        // Apply limits
        if (bogo.max_uses_per_transaction) {
          timesApplicable = Math.min(timesApplicable, bogo.max_uses_per_transaction);
        }
        if (bogo.max_total_uses && bogo.current_uses >= bogo.max_total_uses) {
          console.log('⚠️ BOGO offer limit reached:', bogo.name);
          continue;
        }
        if (bogo.max_total_uses) {
          timesApplicable = Math.min(timesApplicable, bogo.max_total_uses - bogo.current_uses);
        }

        console.log(`✅ Can apply BOGO ${timesApplicable} time(s)`);

        if (timesApplicable === 0) continue;

        // Get the get product details
        let getProduct: any;
        let getProductName: string;
        let originalPrice: number;
        
        if (bogo.get_variant_id) {
          // Fetch variant and parent product
          const { data: variant } = await supabase
            .from('product_variants')
            .select('*, products(name)')
            .eq('id', bogo.get_variant_id)
            .single();
          
          if (!variant) {
            console.log('⚠️ Variant not found for BOGO:', bogo.name);
            continue;
          }
          
          getProduct = variant;
          getProductName = `${(variant as any).products?.name || 'Product'} (${variant.label})`;
          originalPrice = Number(variant.price);
        } else {
          // Fetch product
          const { data: product } = await supabase
            .from('products')
            .select('*')
            .eq('id', bogo.get_product_id)
            .single();
          
          if (!product) {
            console.log('⚠️ Product not found for BOGO:', bogo.name);
            continue;
          }
          
          getProduct = product;
          getProductName = product.name;
          originalPrice = Number(product.price);
        }

        // Calculate discounted price
        const discountedPrice = originalPrice * (1 - bogo.get_discount_percentage / 100);

        // Add BOGO items to cart
        for (let i = 0; i < timesApplicable; i++) {
          const bogoCartItem: CartItem = {
            id: `bogo-${bogo.id}-${Date.now()}-${Math.random()}`,
            productId: bogo.get_product_id || '',
            name: `${getProductName} (BOGO ${bogo.get_discount_percentage}% off)`,
            price: discountedPrice,
            quantity: bogo.get_quantity,
            itemDiscount: 0,
            isBogo: true,
            bogoOfferId: bogo.id,
          };
          
          appliedBOGOs.push(bogoCartItem);
        }

        // Increment usage count
        await supabase
          .from('bogo_offers')
          .update({ current_uses: bogo.current_uses + timesApplicable })
          .eq('id', bogo.id);
      }

      // Show toast if BOGOs were applied
      if (appliedBOGOs.length > 0) {
        const bogoCount = appliedBOGOs.length;
        const totalGetQty = appliedBOGOs.reduce((sum, item) => sum + item.quantity, 0);
        console.log(`🎉 BOGO applied! ${totalGetQty} item${totalGetQty > 1 ? 's' : ''} added with discount`);
      }

      // Return combined cart: regular items + applied BOGOs
      return [...regularItems, ...appliedBOGOs];
    } catch (error) {
      console.error('Error in detectAndApplyBOGOOffers:', error);
      return currentCart;
    }
  };

  // Automatic combo detection and application
  const detectAndApplyCombos = async (currentCart: CartItem[], useCache = true): Promise<CartItem[]> => {
    try {
      console.log('🔍 detectAndApplyCombos START - Cart:', currentCart.map(i => ({ name: i.name, qty: i.quantity })));
      const combos = useCache ? cachedCombos : await fetchActiveCombos();
      console.log('📦 Fetched combos:', combos);
      if (!combos || combos.length === 0) {
        console.log('❌ No active combos found');
        return currentCart;
      }

      // Preserve existing combo items, only process regular items for new combos
      const existingCombos = currentCart.filter(item => item.isCombo);
      let regularItems = currentCart.filter(item => !item.isCombo && !item.isBogo && item.id !== 'cart-discount');
      const appliedCombos: CartItem[] = [];

      // Try to apply each combo
      for (const combo of combos) {
        console.log('🎁 Processing combo:', combo.name);
        if (!combo.combo_offer_items || combo.combo_offer_items.length === 0) {
          console.log('⚠️ Combo has no items defined');
          continue;
        }

        // Extract unique product names from combo definition
        const comboProducts: string[] = combo.combo_offer_items.map((item: any) => {
          const productName = item.products?.name || '';
          return productName.toUpperCase();
        });
        console.log('📋 Combo products from DB:', comboProducts);

        // Generate all possible 3-item patterns from combo products
        const uniqueProducts: string[] = [...new Set(comboProducts)];
        console.log('🎯 Unique products:', uniqueProducts);
        const patterns: Record<string, number>[] = [];

        // Generate patterns: all combinations that sum to 3 items
        if (uniqueProducts.length === 1) {
          // Only one product type: 3 of same
          patterns.push({ [uniqueProducts[0]]: 3 });
        } else if (uniqueProducts.length === 2) {
          // Two product types: 1+2, 2+1, 3+0, 0+3
          patterns.push({ [uniqueProducts[0]]: 3 });
          patterns.push({ [uniqueProducts[1]]: 3 });
          patterns.push({ [uniqueProducts[0]]: 2, [uniqueProducts[1]]: 1 });
          patterns.push({ [uniqueProducts[0]]: 1, [uniqueProducts[1]]: 2 });
        } else if (uniqueProducts.length >= 3) {
          // Three or more product types
          // All same (3 of each type)
          for (const prod of uniqueProducts) {
            patterns.push({ [prod]: 3 });
          }
          // Mix of two types (2+1 combinations)
          for (let i = 0; i < uniqueProducts.length; i++) {
            for (let j = 0; j < uniqueProducts.length; j++) {
              if (i !== j) {
                patterns.push({ [uniqueProducts[i]]: 2, [uniqueProducts[j]]: 1 });
              }
            }
          }
          // Mix of three types (1+1+1)
          if (uniqueProducts.length >= 3) {
            for (let i = 0; i < uniqueProducts.length; i++) {
              for (let j = i + 1; j < uniqueProducts.length; j++) {
                for (let k = j + 1; k < uniqueProducts.length; k++) {
                  patterns.push({ 
                    [uniqueProducts[i]]: 1, 
                    [uniqueProducts[j]]: 1, 
                    [uniqueProducts[k]]: 1 
                  });
                }
              }
            }
          }
        }
        
        console.log('🔢 Generated patterns:', patterns);
        
        // Keep trying to form combos while possible
        while (true) {
          let patternMatched = false;
          let matchedPattern: Record<string, number> | null = null;
          
          // Try each pattern to see if we can form it
          for (const pattern of patterns) {
            let canFormPattern = true;
            console.log('🧩 Trying pattern:', pattern);
            
            // Check if we have enough items for this pattern
            for (const [productName, requiredQty] of Object.entries(pattern)) {
              const cartItem = regularItems.find(item => {
                const itemNameUpper = item.name.toUpperCase();
                const matches = itemNameUpper.includes(productName);
                console.log(`  Checking ${productName} (need ${requiredQty}): ${item.name} - ${matches ? 'MATCH' : 'NO MATCH'} (qty: ${item.quantity})`);
                return matches;
              });
              
              if (!cartItem || cartItem.quantity < requiredQty) {
                console.log(`  ❌ Cannot form pattern - ${productName}: ${!cartItem ? 'not found' : `only ${cartItem.quantity} available`}`);
                canFormPattern = false;
                break;
              }
            }
            
            if (canFormPattern) {
              console.log('✅ Pattern matched!', pattern);
              patternMatched = true;
              matchedPattern = pattern;
              break;
            }
          }
          
          if (!patternMatched) {
            console.log('❌ No patterns matched, stopping combo formation');
            break; // No patterns match, try next combo
          }

          // Form the combo - reduce quantities based on matched pattern
          const updatedRegularItems: CartItem[] = [];
          const comboItemsDetails: any[] = [];
          
          for (const item of regularItems) {
            let quantityToReduce = 0;
            
            // Check if this item matches any product in the pattern
            for (const [productName, requiredQty] of Object.entries(matchedPattern!)) {
              if (item.name.toUpperCase().includes(productName)) {
                quantityToReduce = requiredQty;
                comboItemsDetails.push({
                  product_id: item.productId,
                  quantity: quantityToReduce,
                  product_name: item.name,
                });
                break;
              }
            }
            
            if (quantityToReduce > 0) {
              const newQuantity = item.quantity - quantityToReduce;
              if (newQuantity > 0) {
                updatedRegularItems.push({
                  ...item,
                  quantity: newQuantity,
                });
              }
            } else {
              updatedRegularItems.push(item);
            }
          }
          regularItems = updatedRegularItems;

          // Add combo to cart
          const comboCartItem: CartItem = {
            id: `combo-${combo.id}-${Date.now()}-${Math.random()}`,
            productId: combo.id,
            comboId: combo.id,
            name: combo.name,
            price: combo.combo_price,
            quantity: 1,
            itemDiscount: 0,
            isCombo: true,
            comboItems: comboItemsDetails,
          };
          
          appliedCombos.push(comboCartItem);
        }
      }

      // Show toast if combos were applied
      if (appliedCombos.length > 0) {
        const comboCount = appliedCombos.length;
        const comboNames = [...new Set(appliedCombos.map(c => c.name))].join(', ');
        console.log(`${comboCount} combo${comboCount > 1 ? 's' : ''} applied: ${comboNames}`);
      }

      // Return combined cart: existing combos + regular items + newly applied combos
      return [...existingCombos, ...regularItems, ...appliedCombos];
    } catch (error) {
      console.error('Error in detectAndApplyCombos:', error);
      return currentCart;
    }
  };

  const addToCart = async (product: any) => {
    console.log('addToCart called with:', product);
    
    // Create updated cart with new product
    const cartItemId = product.selectedVariant?.id || product.id;
    const baseProductId = product.id;
    const displayName = product.selectedVariant?.label 
      ? `${product.name} (${product.selectedVariant.label})`
      : product.name;
    
    let updatedCart: CartItem[];
    const existing = cart.find(item => item.id === cartItemId);
    
    if (existing) {
      updatedCart = cart.map(item =>
        item.id === cartItemId
          ? { 
              ...item, 
              quantity: item.quantity + 1,
              // Preserve or update discount if passed in
              itemDiscount: product.itemDiscount !== undefined ? product.itemDiscount : item.itemDiscount,
              customPrice: product.customPrice !== undefined ? product.customPrice : item.customPrice,
            }
          : item
      );
    } else {
      const newItem: CartItem = {
        id: cartItemId,
        productId: baseProductId,
        name: displayName,
        price: Number(product.price),
        quantity: 1,
        barcode: product.barcode,
        image_url: product.image_url,
        itemDiscount: product.itemDiscount || 0,
        customPrice: product.customPrice,
      };
      updatedCart = [...cart, newItem];
    }
    
    // Update cart immediately for fast UI response
    setCart(updatedCart);
    
    // Debounce offer detection for performance during rapid scanning
    cartUpdateQueueRef.current = updatedCart;
    
    if (offerDetectionTimerRef.current) {
      clearTimeout(offerDetectionTimerRef.current);
    }
    
    offerDetectionTimerRef.current = setTimeout(async () => {
      const cartToProcess = cartUpdateQueueRef.current;
      
      // Store current discounts and custom prices before offer detection
      const existingDiscounts = new Map<string, { itemDiscount?: number; customPrice?: number }>();
      cartToProcess.forEach(item => {
        if (item.itemDiscount || item.customPrice) {
          existingDiscounts.set(item.id, {
            itemDiscount: item.itemDiscount,
            customPrice: item.customPrice
          });
        }
      });
      
      // Run all offer detections in parallel for speed
      const [cartWithBOGOs, cartWithMultiBOGOs, cartWithCombos] = await Promise.all([
        detectAndApplyBOGOOffers(cartToProcess, true),
        detectAndApplyMultiProductBOGO(cartToProcess, true),
        detectAndApplyCombos(cartToProcess, true)
      ]);
      
      // Multi-BOGO modifies items in place with isBogo flag
      // Extract only regular and multi-BOGO items (not single BOGO or combos)
      const regularAndMultiBogoItems = cartWithMultiBOGOs.filter(item => !item.isCombo && item.id !== 'cart-discount');
      
      // Get single-product BOGO items (these are separate items added to cart)
      const singleBogoItems = cartWithBOGOs.filter(item => item.isBogo && item.id.startsWith('bogo-'));
      
      // Get combo items
      const comboItems = cartWithCombos.filter(item => item.isCombo);
      
      // Restore custom prices and discounts to regular items
      const itemsWithDiscounts = regularAndMultiBogoItems.map(item => {
        const savedDiscount = existingDiscounts.get(item.id);
        if (savedDiscount) {
          return { ...item, ...savedDiscount };
        }
        return item;
      });
      
      const finalCart = [...itemsWithDiscounts, ...singleBogoItems, ...comboItems];
      setCart(finalCart);
    }, 300); // Wait 300ms after last scan before applying offers
  };

  const removeFromCart = async (productId: string) => {
    const updatedCart = cart.filter(item => item.id !== productId);
    
    // Update immediately
    setCart(updatedCart);
    
    // Debounce offer recalculation
    cartUpdateQueueRef.current = updatedCart;
    
    if (offerDetectionTimerRef.current) {
      clearTimeout(offerDetectionTimerRef.current);
    }
    
    offerDetectionTimerRef.current = setTimeout(async () => {
      const cartToProcess = cartUpdateQueueRef.current;
      
      // Store discounts and custom prices
      const existingDiscounts = new Map<string, { itemDiscount?: number; customPrice?: number }>();
      cartToProcess.forEach(item => {
        if (item.itemDiscount || item.customPrice) {
          existingDiscounts.set(item.id, {
            itemDiscount: item.itemDiscount,
            customPrice: item.customPrice
          });
        }
      });
      
      const [cartWithBOGOs, cartWithMultiBOGOs, cartWithCombos] = await Promise.all([
        detectAndApplyBOGOOffers(cartToProcess, true),
        detectAndApplyMultiProductBOGO(cartToProcess, true),
        detectAndApplyCombos(cartToProcess, true)
      ]);
      
      // Multi-BOGO modifies items in place with isBogo flag
      // Extract only regular and multi-BOGO items (not single BOGO or combos)
      const regularAndMultiBogoItems = cartWithMultiBOGOs.filter(item => !item.isCombo && item.id !== 'cart-discount');
      
      // Get single-product BOGO items (these are separate items added to cart)
      const singleBogoItems = cartWithBOGOs.filter(item => item.isBogo && item.id.startsWith('bogo-'));
      
      // Get combo items
      const comboItems = cartWithCombos.filter(item => item.isCombo);
      
      const regularItemsWithDiscounts = regularAndMultiBogoItems.map(item => {
        const savedDiscount = existingDiscounts.get(item.id);
        return savedDiscount ? { ...item, ...savedDiscount } : item;
      });
      
      setCart([...regularItemsWithDiscounts, ...singleBogoItems, ...comboItems]);
    }, 150);
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }
    
    const updatedCart = cart.map(item =>
      item.id === productId ? { ...item, quantity } : item
    );
    
    // Update immediately
    setCart(updatedCart);
    
    // Debounce offer recalculation
    cartUpdateQueueRef.current = updatedCart;
    
    if (offerDetectionTimerRef.current) {
      clearTimeout(offerDetectionTimerRef.current);
    }
    
    offerDetectionTimerRef.current = setTimeout(async () => {
      const cartToProcess = cartUpdateQueueRef.current;
      
      // Store discounts and custom prices
      const existingDiscounts = new Map<string, { itemDiscount?: number; customPrice?: number }>();
      cartToProcess.forEach(item => {
        if (item.itemDiscount || item.customPrice) {
          existingDiscounts.set(item.id, {
            itemDiscount: item.itemDiscount,
            customPrice: item.customPrice
          });
        }
      });
      
      const [cartWithBOGOs, cartWithMultiBOGOs, cartWithCombos] = await Promise.all([
        detectAndApplyBOGOOffers(cartToProcess, true),
        detectAndApplyMultiProductBOGO(cartToProcess, true),
        detectAndApplyCombos(cartToProcess, true)
      ]);
      
      // Multi-BOGO modifies items in place with isBogo flag
      const regularAndMultiBogoItems = cartWithMultiBOGOs.filter(item => !item.isCombo && item.id !== 'cart-discount');
      const singleBogoItems = cartWithBOGOs.filter(item => item.isBogo && item.id.startsWith('bogo-'));
      const comboItems = cartWithCombos.filter(item => item.isCombo);
      
      const regularItemsWithDiscounts = regularAndMultiBogoItems.map(item => {
        const savedDiscount = existingDiscounts.get(item.id);
        return savedDiscount ? { ...item, ...savedDiscount } : item;
      });
      
      setCart([...regularItemsWithDiscounts, ...singleBogoItems, ...comboItems]);
    }, 150);
  };

  const updateItemPrice = (productId: string, price: number, isManual: boolean = true) => {
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, customPrice: price, manualPriceChange: isManual } : item
      )
    );
  };

  const updateItemDiscount = (productId: string, discount: number, isManual: boolean = true) => {
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, itemDiscount: discount, manualPriceChange: isManual } : item
      )
    );
  };

  const updateItemDisplayName = useCallback((productId: string, displayName: string) => {
    setCart(prevCart => 
      prevCart.map(item => 
        item.id === productId 
          ? { ...item, displayName: displayName.trim() || undefined }
          : item
      )
    );
  }, []);

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    localStorage.removeItem(POS_CART_KEY);
    localStorage.removeItem(POS_DISCOUNT_KEY);
  };
  
  // Load multiple items directly into cart (for edit mode)
  const loadCart = (items: CartItem[]) => {
    console.log('🔧 loadCart: Setting cart with', items.length, 'items');
    setCart(items);
  };

  const addComboToCart = (combo: any) => {
    const comboCartItem: CartItem = {
      id: `combo-${combo.id}-${Date.now()}`,
      productId: combo.id,
      comboId: combo.id,
      name: `🎁 ${combo.name}`,
      price: combo.combo_price,
      quantity: 1,
      itemDiscount: 0,
      isCombo: true,
      comboItems: combo.combo_offer_items?.map((item: any) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        product_name: item.variant_id 
          ? `${item.products?.name} (${item.product_variants?.label})`
          : item.products?.name,
      })) || [],
    };
    
    setCart(prev => [...prev, comboCartItem]);
    console.log(`Added ${combo.name} to cart`);
  };

  const calculateSubtotal = () => {
    let sum = 0;
    for (const item of cart) {
      const effectivePrice = item.customPrice ?? item.price;
      sum += (effectivePrice * item.quantity) - ((item.itemDiscount ?? 0) * item.quantity);
    }
    return sum;
  };

  const calculateTimbre = () => {
    const subtotal = calculateSubtotal() - discount;
    return calculateTimbreTax(subtotal).taxAmount;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const timbre = calculateTimbreTax(subtotal - discount).taxAmount;
    return subtotal - discount + timbre;
  };

  const processTransaction = async (
    payments: Array<{ id: string; method: string; amount: number }>,
    storeId: string,
    customerId?: string,
    notes?: string,
    additionalItems?: CartItem[],
    discountOverride?: number,
    editingTransactionId?: string,
    editingTransactionType?: 'pos' | 'online'
  ) => {
    if (cart.length === 0) {
      console.error('Cart is empty');
      return null;
    }

    if (!storeId) {
      console.error('Please select a store');
      return null;
    }

    setIsProcessing(true);
    try {
      // Use cached user for faster processing
      let user = cachedUserRef.current;
      if (!user) {
        const { data: { user: freshUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !freshUser) {
          console.error('Authentication error. Please log in again.', userError);
          setIsProcessing(false);
          return null;
        }
        user = freshUser;
        cachedUserRef.current = freshUser;
      }

      const subtotal = calculateSubtotal();
      const finalDiscount = discountOverride !== undefined ? discountOverride : discount;
      const subtotalAfterDiscount = subtotal - finalDiscount;
      
      // Calculate Timbre tax based on bill amount
      const timbreTax = calculateTimbreTax(subtotalAfterDiscount);
      const tax = timbreTax.taxAmount;
      const total = subtotalAfterDiscount + tax;

      // Determine primary payment method (highest amount)
      const primaryPayment = payments.reduce((prev, current) => 
        (current.amount > prev.amount) ? current : prev
      );

      // Pre-generate transaction ID
      const transactionId = editingTransactionId || uuidv4();

      // Map items - simplified structure
      const allItems = additionalItems ? [...cart, ...additionalItems] : cart;
      const itemsToSave = allItems.map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        display_name: item.displayName,
        quantity: item.quantity,
        price: item.price,
        customPrice: item.customPrice,
        itemDiscount: item.itemDiscount || 0,
        barcode: item.barcode,
        isCombo: item.isCombo,
        comboItems: item.comboItems,
      }));

      const transactionData = {
        id: transactionId,
        cashier_id: user.id,
        store_id: storeId,
        customer_id: customerId || null,
        items: itemsToSave as any,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        discount: Math.round(finalDiscount * 100) / 100,
        total: Math.round(total * 100) / 100,
        payment_method: primaryPayment.method,
        payment_details: payments.map(p => ({
          method: p.method,
          amount: Math.round(p.amount * 100) / 100,
        })),
        notes: timbreTax.isApplicable ? `${notes || ''}${notes ? ' | ' : ''}Timbre: ${tax}` : notes,
        metadata: editingTransactionId 
          ? { edited_at: new Date().toISOString(), timbre_tax: timbreTax.isApplicable ? tax : 0 } 
          : { timbre_tax: timbreTax.isApplicable ? tax : 0 }
      };

      // Check if online
      if (navigator.onLine) {
        // EDIT MODE: Update existing POS transaction
        if (editingTransactionId && editingTransactionType === 'pos') {
          const { data, error } = await supabase
            .from('pos_transactions')
            .update({
              store_id: transactionData.store_id,
              customer_id: transactionData.customer_id,
              items: transactionData.items,
              subtotal: transactionData.subtotal,
              tax: transactionData.tax,
              discount: transactionData.discount,
              total: transactionData.total,
              payment_method: transactionData.payment_method,
              payment_details: transactionData.payment_details,
              notes: transactionData.notes,
              metadata: transactionData.metadata,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingTransactionId)
            .select()
            .single();

          if (error) {
            console.error('Database update error:', error);
            setIsProcessing(false);
            return null;
          }

          clearCart();
          setIsProcessing(false);
          toast.success(`Sale ${data.transaction_number} updated successfully`);
          return data;
        }
        
        // CONVERT MODE: Update existing online order
        if (editingTransactionId && editingTransactionType === 'online') {
          // 1. Update the order header
          const { data, error } = await supabase
            .from('orders')
            .update({
              status: 'out_for_delivery',
              payment_status: 'paid',
              payment_method: payments.length > 1 ? 'multiple' : primaryPayment.method,
              subtotal: transactionData.subtotal,
              total: transactionData.total,
              tax: transactionData.tax,
              updated_at: new Date().toISOString(),
              customer_id: transactionData.customer_id || null
            })
            .eq('id', editingTransactionId)
            .select()
            .single();

          if (error) {
            console.error('Database error updating online order:', error);
            toast.error(`Failed to update online order: ${error.message}`);
            setIsProcessing(false);
            return null;
          }

          // 2. Sync order_items: delete old items and insert current cart items
          try {
            // Delete existing order items
            await supabase
              .from('order_items')
              .delete()
              .eq('order_id', editingTransactionId);

            // Insert updated items from cart (skip cart-discount pseudo-items)
            const orderItems = allItems
              .filter(item => item.id !== 'cart-discount')
              .map(item => {
                const effectivePrice = item.customPrice ?? item.price;
                const discountPerUnit = item.itemDiscount || 0;
                const unitPrice = effectivePrice - discountPerUnit;
                return {
                  order_id: editingTransactionId,
                  product_id: item.productId || item.id,
                  quantity: item.quantity,
                  unit_price: Math.round(unitPrice * 100) / 100,
                  subtotal: Math.round(unitPrice * item.quantity * 100) / 100,
                };
              });

            if (orderItems.length > 0) {
              const { error: insertError } = await supabase
                .from('order_items')
                .insert(orderItems);

              if (insertError) {
                console.error('Error syncing order items:', insertError);
              }
            }
          } catch (syncError) {
            console.error('Error syncing order_items for online order:', syncError);
          }

          clearCart();
          setIsProcessing(false);
          return { ...data, transaction_number: data.order_number, isOnlineOrder: true };
        }
        
        // NEW TRANSACTION MODE: Create new POS transaction
        const { data, error } = await supabase
          .from('pos_transactions')
          .insert(transactionData)
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          // Save offline as backup
          await offlineDB.addTransaction({
            id: transactionData.id,
            storeId: transactionData.store_id,
            cashierId: transactionData.cashier_id,
            customerId: transactionData.customer_id,
            items: transactionData.items,
            subtotal: transactionData.subtotal,
            discount: transactionData.discount,
            total: transactionData.total,
            paymentMethod: transactionData.payment_method,
            notes: transactionData.notes,
            timestamp: new Date().toISOString(),
            synced: false,
          });
          clearCart();
          setIsProcessing(false);
          return { ...transactionData, offline: true };
        }
        
        // Stock deduction handled by database trigger - no additional processing needed
        clearCart();
        setIsProcessing(false);
        return data;
      } else {
        // Save offline
        await offlineDB.addTransaction({
          id: transactionData.id,
          storeId: transactionData.store_id,
          cashierId: transactionData.cashier_id,
          customerId: transactionData.customer_id,
          items: transactionData.items,
          subtotal: transactionData.subtotal,
          discount: transactionData.discount,
          total: transactionData.total,
          paymentMethod: transactionData.payment_method,
          notes: transactionData.notes,
          timestamp: new Date().toISOString(),
          synced: false,
        });
        
        console.log('Transaction saved offline - will sync automatically');
        clearCart();
        return { ...transactionData, offline: true };
      }
    } catch (error: any) {
      console.error('Transaction error:', error);
      
      // Last resort: save offline
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const subtotal = calculateSubtotal();
          const total = calculateTotal();
          const primaryPayment = payments.reduce((prev, current) => 
            (current.amount > prev.amount) ? current : prev
          );
          
          // Combine cart items with any additional items (like cart discount)
          const allItemsForOffline = additionalItems ? [...cart, ...additionalItems] : cart;
          const itemsForOffline = allItemsForOffline.map(item => ({
            id: item.id,
            productId: item.productId, // Base product ID for custom pricing
            name: item.name,
            quantity: item.quantity,
            price: item.price, // Original price (can be negative for cart-discount)
            customPrice: item.customPrice, // Custom/modified price if any
            itemDiscount: item.itemDiscount || 0,
            barcode: item.barcode,
            isCombo: item.isCombo,
            comboItems: item.comboItems,
          }));
          
          const finalDiscountOffline = discountOverride !== undefined ? discountOverride : discount;
          
          await offlineDB.addTransaction({
            id: uuidv4(),
            storeId,
            cashierId: user.id,
            customerId,
            items: itemsForOffline as any,
            subtotal: parseFloat(subtotal.toFixed(2)),
            discount: parseFloat(finalDiscountOffline.toFixed(2)),
            total: parseFloat((subtotal - finalDiscountOffline).toFixed(2)),
            paymentMethod: primaryPayment.method,
            notes,
            timestamp: new Date().toISOString(),
            synced: false,
          });
          
          console.log('Saved offline due to error - will retry sync automatically');
          clearCart();
          return { offline: true };
        }
      } catch (offlineError) {
        console.error('Failed to save offline:', offlineError);
      }
      
      console.error('Failed to process transaction:', error?.message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    cart,
    discount,
    setDiscount,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemPrice,
    updateItemDiscount,
    updateItemDisplayName,
    clearCart,
    loadCart,
    calculateSubtotal,
    calculateTimbre,
    calculateTotal,
    processTransaction,
    isProcessing,
  };
};
