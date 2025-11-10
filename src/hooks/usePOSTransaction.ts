import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { offlineDB } from '@/lib/offlineDB';
import { v4 as uuidv4 } from 'uuid';

export interface CartItem {
  id: string;
  productId: string; // Base product ID (for looking up custom prices)
  name: string;
  displayName?: string; // Custom name for this order only (doesn't modify product in DB)
  price: number;
  quantity: number;
  barcode?: string;
  image_url?: string;
  itemDiscount?: number;
  customPrice?: number;
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

export const usePOSTransaction = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Cache offers to avoid repeated database queries
  const [cachedCombos, setCachedCombos] = useState<any[]>([]);
  const [cachedBOGOs, setCachedBOGOs] = useState<any[]>([]);
  const [cachedMultiBOGOs, setCachedMultiBOGOs] = useState<any[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  
  // Debounce timer for offer detection
  const offerDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cartUpdateQueueRef = useRef<CartItem[]>([]);

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
      console.log('🎁 detectAndApplyMultiProductBOGO START - Cart:', currentCart.map(i => ({ name: i.name, qty: i.quantity })));
      const offers = useCache ? cachedMultiBOGOs : await fetchActiveMultiProductBOGOOffers();
      console.log('🎉 Fetched multi-product BOGO offers:', offers);
      
      if (!offers || offers.length === 0) {
        console.log('❌ No active multi-product BOGO offers found');
        return currentCart;
      }

      // Filter out existing BOGO/combo items
      let regularItems = currentCart.filter(item => !item.isBogo && !item.isCombo && item.id !== 'cart-discount');
      const appliedBOGOs: CartItem[] = [];

      // Try to apply each multi-product BOGO offer
      for (const offer of offers) {
        console.log('🎁 Processing multi-product BOGO:', offer.name);
        
        if (!offer.multi_product_bogo_items || offer.multi_product_bogo_items.length < 2) {
          console.log('⚠️ Offer needs at least 2 products');
          continue;
        }

        // Get eligible product/variant IDs from the offer
        const eligibleItems = offer.multi_product_bogo_items;
        
        // Find cart items that match any of the eligible products
        const matchingCartItems: CartItem[] = [];
        for (const item of regularItems) {
          const matches = eligibleItems.some((eligible: any) => {
            if (eligible.variant_id) {
              // Match by variant ID
              return item.id === eligible.variant_id;
            } else {
              // Match by product ID
              return item.productId === eligible.product_id;
            }
          });
          
          if (matches) {
            matchingCartItems.push(item);
          }
        }

        console.log('🔍 Found matching items:', matchingCartItems.length, matchingCartItems.map(i => i.name));
        
        // Calculate total quantity of eligible items
        const totalQty = matchingCartItems.reduce((sum, item) => sum + item.quantity, 0);
        
        if (totalQty < 2) {
          console.log('⚠️ Need at least 2 items total from offer group (found:', totalQty, ')');
          continue;
        }
        let pairsToForm = Math.floor(totalQty / 2);

        // Apply limits
        if (offer.max_uses_per_transaction) {
          pairsToForm = Math.min(pairsToForm, offer.max_uses_per_transaction);
        }
        if (offer.max_total_uses && offer.current_uses >= offer.max_total_uses) {
          console.log('⚠️ Multi-product BOGO offer limit reached:', offer.name);
          continue;
        }
        if (offer.max_total_uses) {
          pairsToForm = Math.min(pairsToForm, offer.max_total_uses - offer.current_uses);
        }

        console.log(`✅ Can form ${pairsToForm} pair(s)`);

        if (pairsToForm === 0) continue;

        // Form pairs and create combo items
        const itemsPool = [...matchingCartItems];
        for (let pairIndex = 0; pairIndex < pairsToForm; pairIndex++) {
          // Select 2 items from the pool (can be same or different products)
          const pair: CartItem[] = [];
          let remainingQty = 2;

          for (let i = 0; i < itemsPool.length && remainingQty > 0; i++) {
            if (itemsPool[i].quantity > 0) {
              const qtyToTake = Math.min(itemsPool[i].quantity, remainingQty);
              pair.push({ ...itemsPool[i], quantity: qtyToTake });
              itemsPool[i].quantity -= qtyToTake;
              remainingQty -= qtyToTake;
            }
          }

          if (pair.length === 0 || remainingQty > 0) {
            console.log('⚠️ Could not form complete pair');
            break;
          }

          // Calculate combined price and discount
          const combinedPrice = pair.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const discountedPrice = combinedPrice * (1 - offer.discount_percentage / 100);

          // Create a descriptive name
          const pairNames = pair.map(item => `${item.name} x${item.quantity}`).join(' + ');
          
          // Add BOGO combo to cart
          const bogoCartItem: CartItem = {
            id: `multi-bogo-${offer.id}-${Date.now()}-${Math.random()}`,
            productId: offer.id,
            name: `${offer.name}: ${pairNames} (${offer.discount_percentage}% off)`,
            price: discountedPrice,
            quantity: 1,
            itemDiscount: 0,
            isBogo: true,
            bogoOfferId: offer.id,
          };
          
          appliedBOGOs.push(bogoCartItem);
        }

        // Update regular items by removing consumed quantities
        regularItems = regularItems.map(item => {
          const poolItem = itemsPool.find(p => p.id === item.id);
          if (poolItem) {
            return { ...item, quantity: poolItem.quantity };
          }
          return item;
        }).filter(item => item.quantity > 0);

        // Increment usage count
        if (pairsToForm > 0) {
          await supabase
            .from('multi_product_bogo_offers')
            .update({ current_uses: offer.current_uses + pairsToForm })
            .eq('id', offer.id);
        }
      }

      // Show toast if multi-product BOGOs were applied
      if (appliedBOGOs.length > 0) {
        toast.success(`🎉 ${appliedBOGOs.length} multi-product BOGO combo${appliedBOGOs.length > 1 ? 's' : ''} applied!`);
      }

      // Return combined cart: regular items + applied multi-product BOGOs
      return [...regularItems, ...appliedBOGOs];
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
        toast.success(`🎉 BOGO applied! ${totalGetQty} item${totalGetQty > 1 ? 's' : ''} added with discount`);
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

      // Filter out existing combo items and cart-discount items
      let regularItems = currentCart.filter(item => !item.isCombo && item.id !== 'cart-discount');
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
        toast.success(`${comboCount} combo${comboCount > 1 ? 's' : ''} applied: ${comboNames}`);
      }

      // Return combined cart: regular items + applied combos
      return [...regularItems, ...appliedCombos];
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
          ? { ...item, quantity: item.quantity + 1 }
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
      };
      updatedCart = [newItem, ...cart];
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
      
      // Merge all offers (prioritize combos, then multi-BOGOs, then BOGOs)
      const regularItems = cartToProcess.filter(item => !item.isBogo && !item.isCombo && item.id !== 'cart-discount');
      const bogoItems = cartWithBOGOs.filter(item => item.isBogo);
      const multiBogoItems = cartWithMultiBOGOs.filter(item => item.isBogo);
      const comboItems = cartWithCombos.filter(item => item.isCombo);
      
      // Restore custom prices and discounts to regular items
      const regularItemsWithDiscounts = regularItems.map(item => {
        const savedDiscount = existingDiscounts.get(item.id);
        if (savedDiscount) {
          return { ...item, ...savedDiscount };
        }
        return item;
      });
      
      const finalCart = [...regularItemsWithDiscounts, ...bogoItems, ...multiBogoItems, ...comboItems];
      setCart(finalCart);
    }, 300); // Wait 300ms after last scan before applying offers
    
    toast.success(`${product.name} added to cart`);
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
      
      const [cartWithBOGOs, cartWithMultiBOGOs, cartWithCombos] = await Promise.all([
        detectAndApplyBOGOOffers(cartToProcess, true),
        detectAndApplyMultiProductBOGO(cartToProcess, true),
        detectAndApplyCombos(cartToProcess, true)
      ]);
      
      const regularItems = cartToProcess.filter(item => !item.isBogo && !item.isCombo && item.id !== 'cart-discount');
      const bogoItems = cartWithBOGOs.filter(item => item.isBogo);
      const multiBogoItems = cartWithMultiBOGOs.filter(item => item.isBogo);
      const comboItems = cartWithCombos.filter(item => item.isCombo);
      
      // Restore custom prices and discounts to regular items
      const regularItemsWithDiscounts = regularItems.map(item => {
        const savedDiscount = existingDiscounts.get(item.id);
        if (savedDiscount) {
          return { ...item, ...savedDiscount };
        }
        return item;
      });
      
      const finalCart = [...regularItemsWithDiscounts, ...bogoItems, ...multiBogoItems, ...comboItems];
      setCart(finalCart);
    }, 300);
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
      
      const [cartWithBOGOs, cartWithMultiBOGOs, cartWithCombos] = await Promise.all([
        detectAndApplyBOGOOffers(cartToProcess, true),
        detectAndApplyMultiProductBOGO(cartToProcess, true),
        detectAndApplyCombos(cartToProcess, true)
      ]);
      
      const regularItems = cartToProcess.filter(item => !item.isBogo && !item.isCombo && item.id !== 'cart-discount');
      const bogoItems = cartWithBOGOs.filter(item => item.isBogo);
      const multiBogoItems = cartWithMultiBOGOs.filter(item => item.isBogo);
      const comboItems = cartWithCombos.filter(item => item.isCombo);
      
      // Restore custom prices and discounts to regular items
      const regularItemsWithDiscounts = regularItems.map(item => {
        const savedDiscount = existingDiscounts.get(item.id);
        if (savedDiscount) {
          return { ...item, ...savedDiscount };
        }
        return item;
      });
      
      const finalCart = [...regularItemsWithDiscounts, ...bogoItems, ...multiBogoItems, ...comboItems];
      setCart(finalCart);
    }, 300);
  };

  const updateItemPrice = (productId: string, price: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, customPrice: price } : item
      )
    );
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, itemDiscount: discount } : item
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
    toast.success(`Added ${combo.name} to cart`);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const effectivePrice = item.customPrice ?? item.price;
      const itemTotal = effectivePrice * item.quantity;
      const itemDiscountAmount = (item.itemDiscount ?? 0) * item.quantity;
      return sum + itemTotal - itemDiscountAmount;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - discount;
  };

  const processTransaction = async (
    payments: Array<{ id: string; method: string; amount: number }>,
    storeId: string,
    customerId?: string,
    notes?: string,
    additionalItems?: CartItem[],
    discountOverride?: number
  ) => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return null;
    }

    if (!storeId) {
      toast.error('Please select a store');
      return null;
    }

    setIsProcessing(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('Authentication error. Please log in again.');
        console.error('User error:', userError);
        return null;
      }

      const subtotal = calculateSubtotal();
      const total = calculateTotal();
      
      // Use discount override if provided (for cart-level discounts), otherwise use item-level discount
      const finalDiscount = discountOverride !== undefined ? discountOverride : discount;

      // Determine primary payment method (highest amount)
      const primaryPayment = payments.reduce((prev, current) => 
        (current.amount > prev.amount) ? current : prev
      );

      // Calculate COGS using FIFO method before saving transaction
      let totalCOGS = 0;
      const cogsDetails: any[] = [];

      // Check if online for FIFO calculation
      if (navigator.onLine) {
        for (const item of cart) {
          if (item.id === 'cart-discount') continue;
          
          // Handle combo items
          if (item.isCombo && item.comboItems) {
            for (const comboProduct of item.comboItems) {
              const stockToDeduct = comboProduct.quantity * item.quantity;
              
              try {
                const { data: fifoData, error: fifoError } = await supabase.rpc('deduct_stock_fifo', {
                  p_product_id: comboProduct.product_id,
                  p_variant_id: comboProduct.variant_id || null,
                  p_quantity: stockToDeduct
                });

                if (fifoError) {
                  console.error('FIFO deduction error:', fifoError);
                  throw new Error(`Insufficient stock for ${comboProduct.product_name}`);
                }

                if (fifoData && Array.isArray(fifoData)) {
                  const itemCOGS = fifoData.reduce((sum: number, layer: any) => sum + Number(layer.total_cogs), 0);
                  totalCOGS += itemCOGS;
                  cogsDetails.push({
                    product_id: comboProduct.product_id,
                    variant_id: comboProduct.variant_id,
                    name: comboProduct.product_name,
                    quantity: stockToDeduct,
                    cogs: itemCOGS,
                    layers: fifoData
                  });
                }
              } catch (error) {
                console.error('Error processing FIFO for combo item:', error);
              }
            }
          } else {
            // Regular product
            const isVariant = item.id !== item.productId;
            
            try {
              const { data: fifoData, error: fifoError } = await supabase.rpc('deduct_stock_fifo', {
                p_product_id: item.productId,
                p_variant_id: isVariant ? item.id : null,
                p_quantity: item.quantity
              });

              if (fifoError) {
                console.error('FIFO deduction error:', fifoError);
                throw new Error(`Insufficient stock for ${item.name}`);
              }

              if (fifoData && Array.isArray(fifoData)) {
                const itemCOGS = fifoData.reduce((sum: number, layer: any) => sum + Number(layer.total_cogs), 0);
                totalCOGS += itemCOGS;
                cogsDetails.push({
                  product_id: item.productId,
                  variant_id: isVariant ? item.id : null,
                  name: item.name,
                  quantity: item.quantity,
                  cogs: itemCOGS,
                  layers: fifoData
                });
              }
            } catch (error) {
              console.error('Error processing FIFO for item:', error);
            }
          }
        }
      }

      // Combine cart items with any additional items (like cart discount)
      // Map items to include all necessary fields
      const allItems = additionalItems ? [...cart, ...additionalItems] : cart;
      const itemsToSave = allItems.map(item => ({
        id: item.id,
        productId: item.productId, // Base product ID for custom pricing
        name: item.name,
        display_name: item.displayName, // Custom name for this order only
        quantity: item.quantity,
        price: item.price, // Original price (can be negative for cart-discount)
        customPrice: item.customPrice, // Custom/modified price if any
        itemDiscount: item.itemDiscount || 0,
        barcode: item.barcode,
        isCombo: item.isCombo,
        comboItems: item.comboItems,
      }));

      const transactionData = {
        id: uuidv4(),
        cashier_id: user.id,
        store_id: storeId,
        customer_id: customerId,
        items: itemsToSave as any,
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: 0,
        discount: parseFloat(finalDiscount.toFixed(2)),
        total: parseFloat((subtotal - finalDiscount).toFixed(2)),
        payment_method: primaryPayment.method,
        payment_details: payments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount.toFixed(2)),
        })),
        notes,
        metadata: {
          total_cogs: totalCOGS,
          cogs_details: cogsDetails,
          gross_profit: (subtotal - finalDiscount) - totalCOGS
        }
      };

      console.log('Processing transaction with COGS:', transactionData);

      // Check if online
      if (navigator.onLine) {
        // Try to save online
        const { data, error } = await supabase
          .from('pos_transactions')
          .insert(transactionData)
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          // If online but failed, save offline as backup
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
          toast.warning('Saved offline - will sync when connection is stable');
          clearCart();
          return { ...transactionData, offline: true };
        }

        // Update stock quantities for sold items
        for (const item of cart) {
          if (item.id === 'cart-discount') continue; // Skip cart discount items
          
          // Handle combo items - deduct stock from each product in the combo
          if (item.isCombo && item.comboItems) {
            for (const comboProduct of item.comboItems) {
              const stockToDeduct = comboProduct.quantity * item.quantity;
              
              if (comboProduct.variant_id) {
                const { error: variantError } = await supabase.rpc('decrement_variant_stock', {
                  p_variant_id: comboProduct.variant_id,
                  p_quantity: stockToDeduct
                });
                
                if (variantError) {
                  console.error('Error updating combo variant stock:', variantError);
                }
              } else {
                const { error: stockError } = await supabase.rpc('decrement_product_stock', {
                  p_product_id: comboProduct.product_id,
                  p_quantity: stockToDeduct
                });
                
                if (stockError) {
                  console.error('Error updating combo product stock:', stockError);
                }
              }
            }
          } else {
            // Regular product stock deduction
            // Check if this is a variant or base product
            const isVariant = item.id !== item.productId;
            
            if (isVariant) {
              // Update variant stock
              const { error: variantError } = await supabase.rpc('decrement_variant_stock', {
                p_variant_id: item.id,
                p_quantity: item.quantity
              });
              
              if (variantError) {
                console.error('Error updating variant stock:', variantError);
              }
            } else {
              // Update base product stock
              const { error: stockError } = await supabase.rpc('decrement_product_stock', {
                p_product_id: item.id,
                p_quantity: item.quantity
              });
              
              if (stockError) {
                console.error('Error updating product stock:', stockError);
              }
            }
          }
        }

        toast.success('Transaction completed successfully!');
        clearCart();
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
        
        toast.success('Transaction saved offline - will sync automatically');
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
          
          toast.warning('Saved offline due to error - will retry sync automatically');
          clearCart();
          return { offline: true };
        }
      } catch (offlineError) {
        console.error('Failed to save offline:', offlineError);
      }
      
      toast.error(error?.message || 'Failed to process transaction');
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
    calculateTotal,
    processTransaction,
    isProcessing,
  };
};
