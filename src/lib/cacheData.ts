// @ts-nocheck
/**
 * Comprehensive data caching utility for offline operation
 * Caches all essential data needed for POS to work completely offline
 */

import { supabase } from '@/integrations/supabase/client';
import { offlineDB } from './offlineDB';
import { toast } from 'sonner';

export async function cacheEssentialData(showProgress = false) {
  try {
    if (showProgress) toast.info('Starting data cache...');
    
    // Fetch and cache products with variants
    if (showProgress) toast.loading('Caching products...');
    const productsQuery = supabase
      .from('products')
      .select(`
        *,
        product_variants (
          id,
          label,
          quantity,
          unit,
          price,
          is_available,
          is_default
        )
      `)
      .eq('is_available', true);
    
    const productsResult: any = await productsQuery;
    const products = productsResult.data;

    if (products && Array.isArray(products)) {
      const offlineProducts = products.map((p: any) => ({
        ...p,
        lastUpdated: new Date().toISOString()
      }));
      await offlineDB.saveProducts(offlineProducts);
      console.log(`Cached ${products.length} products`);
    }

    // Fetch and cache stores
    if (showProgress) toast.loading('Caching stores...');
    const storesQuery = supabase
      .from('stores')
      .select('*')
      .eq('is_active', true);
    
    const storesResult: any = await storesQuery;
    const stores = storesResult.data;

    if (stores && Array.isArray(stores)) {
      await offlineDB.saveStores(stores);
      console.log(`Cached ${stores.length} stores`);
    }

    // Fetch and cache categories
    if (showProgress) toast.loading('Caching categories...');
    const categoriesQuery = supabase
      .from('categories')
      .select('*')
      .eq('is_active', true);
    
    const categoriesResult: any = await categoriesQuery;
    const categories = categoriesResult.data;

    if (categories && Array.isArray(categories)) {
      await offlineDB.saveCategories(categories);
      console.log(`Cached ${categories.length} categories`);
    }

    // Fetch and cache customers
    if (showProgress) toast.loading('Caching customers...');
    const customersQuery = supabase
      .from('contacts')
      .select('id, name, email, phone, type, credit_limit, outstanding_balance')
      .eq('type', 'customer');
    
    const customersResult: any = await customersQuery;
    const customers = customersResult.data;

    if (customers && Array.isArray(customers)) {
      await offlineDB.saveCustomers(customers);
      console.log(`Cached ${customers.length} customers`);
    }

    // Fetch and cache POS users
    if (showProgress) toast.loading('Caching POS users...');
    const posUsersQuery = supabase
      .from('pos_users')
      .select('id, name, pin, role, is_active')
      .eq('is_active', true);
    
    const posUsersResult: any = await posUsersQuery;
    const posUsers = posUsersResult.data;

    if (posUsers && Array.isArray(posUsers)) {
      await offlineDB.savePOSUsers(posUsers);
      console.log(`Cached ${posUsers.length} POS users`);
    }

    // Fetch and cache combo offers
    if (showProgress) toast.loading('Caching combo offers...');
    const comboOffersQuery = supabase
      .from('combo_offers')
      .select('*')
      .eq('is_active', true);
    
    const comboOffersResult: any = await comboOffersQuery;
    const comboOffers = comboOffersResult.data;

    if (comboOffers && Array.isArray(comboOffers)) {
      await offlineDB.saveComboOffers(comboOffers);
      console.log(`Cached ${comboOffers.length} combo offers`);
      
      // Cache combo offer items for each offer
      for (const offer of comboOffers) {
        const itemsQuery = supabase
          .from('combo_offer_items')
          .select('*')
          .eq('combo_offer_id', offer.id);
        
        const itemsResult: any = await itemsQuery;
        const items = itemsResult.data;
        
        if (items && Array.isArray(items)) {
          await offlineDB.saveComboOfferItems(offer.id, items);
        }
      }
    }

    // Fetch and cache accounts
    if (showProgress) toast.loading('Caching accounts...');
    const accountsQuery = supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true);
    
    const accountsResult: any = await accountsQuery;
    const accounts = accountsResult.data;

    if (accounts && Array.isArray(accounts)) {
      await offlineDB.saveAccounts(accounts);
      console.log(`Cached ${accounts.length} accounts`);
    }

    // Fetch and cache BOGO offers
    if (showProgress) toast.loading('Caching BOGO offers...');
    const bogoOffersQuery = supabase
      .from('bogo_offers')
      .select('*')
      .eq('is_active', true);
    
    const bogoOffersResult: any = await bogoOffersQuery;
    const bogoOffers = bogoOffersResult.data;

    if (bogoOffers && Array.isArray(bogoOffers)) {
      await offlineDB.saveBogoOffers(bogoOffers);
      console.log(`Cached ${bogoOffers.length} BOGO offers`);
    }

    // Fetch and cache multi-product BOGO offers
    if (showProgress) toast.loading('Caching multi-product BOGO offers...');
    const multiBogoOffersQuery = supabase
      .from('multi_product_bogo_offers')
      .select('*')
      .eq('is_active', true);
    
    const multiBogoOffersResult: any = await multiBogoOffersQuery;
    const multiBogoOffers = multiBogoOffersResult.data;

    if (multiBogoOffers && Array.isArray(multiBogoOffers)) {
      await offlineDB.saveMultiProductBogoOffers(multiBogoOffers);
      console.log(`Cached ${multiBogoOffers.length} multi-product BOGO offers`);

      // Fetch and cache multi-product BOGO items
      const multiBogoItemsQuery = supabase
        .from('multi_product_bogo_items')
        .select('*');
      
      const multiBogoItemsResult: any = await multiBogoItemsQuery;
      const multiBogoItems = multiBogoItemsResult.data;

      if (multiBogoItems && Array.isArray(multiBogoItems)) {
        await offlineDB.saveMultiProductBogoItems(multiBogoItems);
        console.log(`Cached ${multiBogoItems.length} multi-product BOGO items`);
      }
    }

    // Fetch and cache announcements
    if (showProgress) toast.loading('Caching announcements...');
    const announcementsQuery = supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true);
    
    const announcementsResult: any = await announcementsQuery;
    const announcements = announcementsResult.data;

    if (announcements && Array.isArray(announcements)) {
      await offlineDB.saveAnnouncements(announcements);
      console.log(`Cached ${announcements.length} announcements`);
    }

    // Fetch and cache custom price tiers
    if (showProgress) toast.loading('Caching custom price tiers...');
    const customTiersQuery = supabase
      .from('custom_price_tiers')
      .select('*')
      .eq('is_active', true);
    
    const customTiersResult: any = await customTiersQuery;
    const customTiers = customTiersResult.data;

    if (customTiers && Array.isArray(customTiers)) {
      await offlineDB.saveCustomPriceTiers(customTiers);
      console.log(`Cached ${customTiers.length} custom price tiers`);
    }

    // Fetch and cache custom tier prices
    if (showProgress) toast.loading('Caching custom tier prices...');
    const customTierPricesQuery = supabase
      .from('custom_tier_prices')
      .select('*');
    
    const customTierPricesResult: any = await customTierPricesQuery;
    const customTierPrices = customTierPricesResult.data;

    if (customTierPrices && Array.isArray(customTierPrices)) {
      await offlineDB.saveCustomTierPrices(customTierPrices);
      console.log(`Cached ${customTierPrices.length} custom tier prices`);
    }

    // Fetch and cache customer product prices
    if (showProgress) toast.loading('Caching customer product prices...');
    const customerPricesQuery = supabase
      .from('customer_product_prices')
      .select('*');
    
    const customerPricesResult: any = await customerPricesQuery;
    const customerPrices = customerPricesResult.data;

    if (customerPrices && Array.isArray(customerPrices)) {
      await offlineDB.saveCustomerProductPrices(customerPrices);
      console.log(`Cached ${customerPrices.length} customer product prices`);
    }

    // Fetch and cache full contacts (customers + suppliers)
    if (showProgress) toast.loading('Caching contacts...');
    const contactsQuery = supabase
      .from('contacts')
      .select('*');
    
    const contactsResult: any = await contactsQuery;
    const contacts = contactsResult.data;

    if (contacts && Array.isArray(contacts)) {
      await offlineDB.saveContacts(contacts);
      console.log(`Cached ${contacts.length} contacts`);
    }

    // Fetch and cache journal entries
    if (showProgress) toast.loading('Caching journal entries...');
    const journalEntriesQuery = supabase
      .from('journal_entries')
      .select('*');
    
    const journalEntriesResult: any = await journalEntriesQuery;
    const journalEntries = journalEntriesResult.data;

    if (journalEntries && Array.isArray(journalEntries)) {
      await offlineDB.saveJournalEntries(journalEntries);
      console.log(`Cached ${journalEntries.length} journal entries`);
    }

    // Fetch and cache journal entry lines
    if (showProgress) toast.loading('Caching journal entry lines...');
    const journalLinesQuery = supabase
      .from('journal_entry_lines')
      .select('*');
    
    const journalLinesResult: any = await journalLinesQuery;
    const journalLines = journalLinesResult.data;

    if (journalLines && Array.isArray(journalLines)) {
      await offlineDB.saveJournalEntryLines(journalLines);
      console.log(`Cached ${journalLines.length} journal entry lines`);
    }

    // Fetch and cache expenses
    if (showProgress) toast.loading('Caching expenses...');
    const expensesQuery = supabase
      .from('expenses')
      .select('*');
    
    const expensesResult: any = await expensesQuery;
    const expenses = expensesResult.data;

    if (expenses && Array.isArray(expenses)) {
      await offlineDB.saveExpenses(expenses);
      console.log(`Cached ${expenses.length} expenses`);
    }

    // Fetch and cache payment receipts
    if (showProgress) toast.loading('Caching payment receipts...');
    const paymentReceiptsQuery = supabase
      .from('payment_receipts')
      .select('*');
    
    const paymentReceiptsResult: any = await paymentReceiptsQuery;
    const paymentReceipts = paymentReceiptsResult.data;

    if (paymentReceipts && Array.isArray(paymentReceipts)) {
      await offlineDB.savePaymentReceipts(paymentReceipts);
      console.log(`Cached ${paymentReceipts.length} payment receipts`);
    }

    // Fetch and cache supplier payments
    if (showProgress) toast.loading('Caching supplier payments...');
    const supplierPaymentsQuery = supabase
      .from('supplier_payments')
      .select('*');
    
    const supplierPaymentsResult: any = await supplierPaymentsQuery;
    const supplierPayments = supplierPaymentsResult.data;

    if (supplierPayments && Array.isArray(supplierPayments)) {
      await offlineDB.saveSupplierPayments(supplierPayments);
      console.log(`Cached ${supplierPayments.length} supplier payments`);
    }

    // Fetch and cache purchases
    if (showProgress) toast.loading('Caching purchases...');
    const purchasesQuery = supabase
      .from('purchases')
      .select('*');
    
    const purchasesResult: any = await purchasesQuery;
    const purchases = purchasesResult.data;

    if (purchases && Array.isArray(purchases)) {
      await offlineDB.savePurchases(purchases);
      console.log(`Cached ${purchases.length} purchases`);
    }

    // Fetch and cache purchase items
    if (showProgress) toast.loading('Caching purchase items...');
    const purchaseItemsQuery = supabase
      .from('purchase_items')
      .select('*');
    
    const purchaseItemsResult: any = await purchaseItemsQuery;
    const purchaseItems = purchaseItemsResult.data;

    if (purchaseItems && Array.isArray(purchaseItems)) {
      await offlineDB.savePurchaseItems(purchaseItems);
      console.log(`Cached ${purchaseItems.length} purchase items`);
    }

    // Fetch and cache inventory layers
    if (showProgress) toast.loading('Caching inventory layers...');
    const inventoryLayersQuery = supabase
      .from('inventory_layers')
      .select('*');
    
    const inventoryLayersResult: any = await inventoryLayersQuery;
    const inventoryLayers = inventoryLayersResult.data;

    if (inventoryLayers && Array.isArray(inventoryLayers)) {
      await offlineDB.saveInventoryLayers(inventoryLayers);
      console.log(`Cached ${inventoryLayers.length} inventory layers`);
    }

    // Fetch and cache productions
    if (showProgress) toast.loading('Caching productions...');
    const productionsQuery = supabase
      .from('productions')
      .select('*');
    
    const productionsResult: any = await productionsQuery;
    const productions = productionsResult.data;

    if (productions && Array.isArray(productions)) {
      await offlineDB.saveProductions(productions);
      console.log(`Cached ${productions.length} productions`);
    }

    // Fetch and cache production outputs
    if (showProgress) toast.loading('Caching production outputs...');
    const productionOutputsQuery = supabase
      .from('production_outputs')
      .select('*');
    
    const productionOutputsResult: any = await productionOutputsQuery;
    const productionOutputs = productionOutputsResult.data;

    if (productionOutputs && Array.isArray(productionOutputs)) {
      await offlineDB.saveProductionOutputs(productionOutputs);
      console.log(`Cached ${productionOutputs.length} production outputs`);
    }

    // Fetch and cache orders
    if (showProgress) toast.loading('Caching orders...');
    const ordersQuery = supabase.from('orders').select('*');
    const ordersResult: any = await ordersQuery;
    if (ordersResult.data && Array.isArray(ordersResult.data)) {
      await offlineDB.saveOrders(ordersResult.data);
      console.log(`Cached ${ordersResult.data.length} orders`);
    }

    // Fetch and cache order items
    if (showProgress) toast.loading('Caching order items...');
    const orderItemsQuery = supabase.from('order_items').select('*');
    const orderItemsResult: any = await orderItemsQuery;
    if (orderItemsResult.data && Array.isArray(orderItemsResult.data)) {
      await offlineDB.saveOrderItems(orderItemsResult.data);
      console.log(`Cached ${orderItemsResult.data.length} order items`);
    }

    // Fetch and cache POS transactions
    if (showProgress) toast.loading('Caching POS transactions...');
    const posTransactionsQuery = supabase.from('pos_transactions').select('*');
    const posTransactionsResult: any = await posTransactionsQuery;
    if (posTransactionsResult.data && Array.isArray(posTransactionsResult.data)) {
      await offlineDB.savePOSTransactions(posTransactionsResult.data);
      console.log(`Cached ${posTransactionsResult.data.length} POS transactions`);
    }

    // Fetch and cache product variants
    if (showProgress) toast.loading('Caching product variants...');
    const variantsQuery = supabase.from('product_variants').select('*');
    const variantsResult: any = await variantsQuery;
    if (variantsResult.data && Array.isArray(variantsResult.data)) {
      await offlineDB.saveProductVariants(variantsResult.data);
      console.log(`Cached ${variantsResult.data.length} product variants`);
    }

    // Fetch and cache purchase orders
    if (showProgress) toast.loading('Caching purchase orders...');
    const purchaseOrdersQuery = supabase.from('purchase_orders').select('*');
    const purchaseOrdersResult: any = await purchaseOrdersQuery;
    if (purchaseOrdersResult.data && Array.isArray(purchaseOrdersResult.data)) {
      await offlineDB.savePurchaseOrders(purchaseOrdersResult.data);
      console.log(`Cached ${purchaseOrdersResult.data.length} purchase orders`);
    }

    // Fetch and cache purchase order items
    if (showProgress) toast.loading('Caching purchase order items...');
    const poItemsQuery = supabase.from('purchase_order_items').select('*');
    const poItemsResult: any = await poItemsQuery;
    if (poItemsResult.data && Array.isArray(poItemsResult.data)) {
      await offlineDB.savePurchaseOrderItems(poItemsResult.data);
      console.log(`Cached ${poItemsResult.data.length} purchase order items`);
    }

    // Fetch and cache purchase order responses
    if (showProgress) toast.loading('Caching purchase order responses...');
    const poResponsesQuery = supabase.from('purchase_order_responses').select('*');
    const poResponsesResult: any = await poResponsesQuery;
    if (poResponsesResult.data && Array.isArray(poResponsesResult.data)) {
      await offlineDB.savePurchaseOrderResponses(poResponsesResult.data);
      console.log(`Cached ${poResponsesResult.data.length} purchase order responses`);
    }

    // Fetch and cache purchase order charges
    if (showProgress) toast.loading('Caching purchase order charges...');
    const poChargesQuery = supabase.from('purchase_order_charges').select('*');
    const poChargesResult: any = await poChargesQuery;
    if (poChargesResult.data && Array.isArray(poChargesResult.data)) {
      await offlineDB.savePurchaseOrderCharges(poChargesResult.data);
      console.log(`Cached ${poChargesResult.data.length} purchase order charges`);
    }

    // Fetch and cache quotations
    if (showProgress) toast.loading('Caching quotations...');
    const quotationsQuery = supabase.from('quotations').select('*');
    const quotationsResult: any = await quotationsQuery;
    if (quotationsResult.data && Array.isArray(quotationsResult.data)) {
      await offlineDB.saveQuotations(quotationsResult.data);
      console.log(`Cached ${quotationsResult.data.length} quotations`);
    }

    // Fetch and cache quotation items
    if (showProgress) toast.loading('Caching quotation items...');
    const quotationItemsQuery = supabase.from('quotation_items').select('*');
    const quotationItemsResult: any = await quotationItemsQuery;
    if (quotationItemsResult.data && Array.isArray(quotationItemsResult.data)) {
      await offlineDB.saveQuotationItems(quotationItemsResult.data);
      console.log(`Cached ${quotationItemsResult.data.length} quotation items`);
    }

    // Fetch and cache cash sessions
    if (showProgress) toast.loading('Caching cash sessions...');
    const cashSessionsQuery = supabase.from('cash_sessions').select('*');
    const cashSessionsResult: any = await cashSessionsQuery;
    if (cashSessionsResult.data && Array.isArray(cashSessionsResult.data)) {
      await offlineDB.saveCashSessions(cashSessionsResult.data);
      console.log(`Cached ${cashSessionsResult.data.length} cash sessions`);
    }

    // Store last cache timestamp
    localStorage.setItem('lastCacheTime', new Date().toISOString());
    
    if (showProgress) toast.success('All data cached successfully for offline use');
    console.log('Full data cache completed successfully');
    
    return true;
  } catch (error) {
    console.error('Error caching data:', error);
    if (showProgress) toast.error('Failed to cache data');
    throw error;
  }
}

export function getLastCacheTime(): Date | null {
  const lastCache = localStorage.getItem('lastCacheTime');
  return lastCache ? new Date(lastCache) : null;
}

export function isCacheStale(hours = 24): boolean {
  const lastCache = getLastCacheTime();
  if (!lastCache) return true;
  
  const hoursSinceCache = (Date.now() - lastCache.getTime()) / (1000 * 60 * 60);
  return hoursSinceCache > hours;
}
