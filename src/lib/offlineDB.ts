/**
 * IndexedDB wrapper for offline storage
 * Stores POS transactions, orders, and data for offline operation
 */

const DB_NAME = 'GlobalMarketPOS';
const DB_VERSION = 5; // Bumped to add all offline stores

export interface OfflineTransaction {
  id: string;
  storeId: string;
  cashierId: string;
  items: any[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  customerId?: string;
  notes?: string;
  timestamp: string;
  synced: boolean;
  syncError?: string;
  syncAttempts?: number;
  lastSyncAttempt?: string;
}

export interface OfflineProduct {
  id: string;
  name: string;
  price: number;
  barcode?: string;
  image_url?: string;
  category_id?: string;
  is_available: boolean;
  product_variants?: any[];
  lastUpdated: string;
}

export interface OfflineStore {
  id: string;
  name: string;
  lastUpdated: string;
}

export interface OfflinePOSUser {
  id: string;
  user_id: string;
  full_name: string;
  pin_hash: string;
  is_active: boolean;
  lastUpdated: string;
}

class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('synced', 'synced', { unique: false });
          txStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Products store (for offline browsing)
        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id' });
          prodStore.createIndex('category_id', 'category_id', { unique: false });
          prodStore.createIndex('barcode', 'barcode', { unique: false });
        }

        // Stores cache
        if (!db.objectStoreNames.contains('stores')) {
          db.createObjectStore('stores', { keyPath: 'id' });
        }

        // Categories cache
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

      // Customers cache
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore('customers', { keyPath: 'id' });
        custStore.createIndex('name', 'name', { unique: false });
        custStore.createIndex('phone', 'phone', { unique: false });
      }

      // POS users cache
      if (!db.objectStoreNames.contains('pos_users')) {
        const posUserStore = db.createObjectStore('pos_users', { keyPath: 'id' });
        posUserStore.createIndex('pin_hash', 'pin_hash', { unique: false });
      }

      // Combo offers cache
      if (!db.objectStoreNames.contains('combo_offers')) {
        db.createObjectStore('combo_offers', { keyPath: 'id' });
      }

      // Combo offer items cache
      if (!db.objectStoreNames.contains('combo_offer_items')) {
        const comboItemsStore = db.createObjectStore('combo_offer_items', { keyPath: 'id' });
        comboItemsStore.createIndex('combo_offer_id', 'combo_offer_id', { unique: false });
      }

      // Accounts cache
      if (!db.objectStoreNames.contains('accounts')) {
        const accountsStore = db.createObjectStore('accounts', { keyPath: 'id' });
        accountsStore.createIndex('account_type', 'account_type', { unique: false });
      }

      // BOGO offers cache
      if (!db.objectStoreNames.contains('bogo_offers')) {
        db.createObjectStore('bogo_offers', { keyPath: 'id' });
      }

      // Multi-product BOGO offers cache
      if (!db.objectStoreNames.contains('multi_product_bogo_offers')) {
        db.createObjectStore('multi_product_bogo_offers', { keyPath: 'id' });
      }

      // Multi-product BOGO items cache
      if (!db.objectStoreNames.contains('multi_product_bogo_items')) {
        const multiBogoItemsStore = db.createObjectStore('multi_product_bogo_items', { keyPath: 'id' });
        multiBogoItemsStore.createIndex('offer_id', 'offer_id', { unique: false });
      }

      // Announcements cache
      if (!db.objectStoreNames.contains('announcements')) {
        db.createObjectStore('announcements', { keyPath: 'id' });
      }

      // Custom price tiers cache
      if (!db.objectStoreNames.contains('custom_price_tiers')) {
        db.createObjectStore('custom_price_tiers', { keyPath: 'id' });
      }

      // Custom tier prices cache
      if (!db.objectStoreNames.contains('custom_tier_prices')) {
        const customTierPricesStore = db.createObjectStore('custom_tier_prices', { keyPath: 'id' });
        customTierPricesStore.createIndex('tier_id', 'tier_id', { unique: false });
        customTierPricesStore.createIndex('product_id', 'product_id', { unique: false });
      }

      // Customer product prices cache
      if (!db.objectStoreNames.contains('customer_product_prices')) {
        const customerPricesStore = db.createObjectStore('customer_product_prices', { keyPath: 'id' });
        customerPricesStore.createIndex('customer_id', 'customer_id', { unique: false });
        customerPricesStore.createIndex('product_id', 'product_id', { unique: false });
      }
    };
  });
}

  // Transaction methods
  async addTransaction(transaction: OfflineTransaction): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      const request = store.add(transaction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedTransactions(): Promise<OfflineTransaction[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('transactions', 'readonly');
      const store = tx.objectStore('transactions');
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Filter for unsynced transactions
        const unsynced = request.result.filter((tx: OfflineTransaction) => !tx.synced);
        resolve(unsynced);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markTransactionSynced(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const transaction = getRequest.result;
        if (transaction) {
          transaction.synced = true;
          transaction.syncError = undefined;
          transaction.syncAttempts = 0;
          const updateRequest = store.put(transaction);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async updateTransactionError(id: string, error: string, attempts: number): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const transaction = getRequest.result;
        if (transaction) {
          transaction.syncError = error;
          transaction.syncAttempts = attempts;
          transaction.lastSyncAttempt = new Date().toISOString();
          const updateRequest = store.put(transaction);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Product methods
  async saveProducts(products: OfflineProduct[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      
      products.forEach(product => {
        store.put({ ...product, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getProducts(): Promise<OfflineProduct[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getProductByBarcode(barcode: string): Promise<OfflineProduct | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const index = store.index('barcode');
      const request = index.get(barcode);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Store methods
  async saveStores(stores: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('stores', 'readwrite');
      const store = tx.objectStore('stores');
      
      stores.forEach(storeData => {
        store.put({ ...storeData, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getStores(): Promise<OfflineStore[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('stores', 'readonly');
      const store = tx.objectStore('stores');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Category methods
  async saveCategories(categories: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      
      categories.forEach(category => {
        store.put({ ...category, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCategories(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('categories', 'readonly');
      const store = tx.objectStore('categories');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Customer methods
  async saveCustomers(customers: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      
      customers.forEach(customer => {
        store.put({ ...customer, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCustomers(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('customers', 'readonly');
      const store = tx.objectStore('customers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data
  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    const storeNames = [
      'transactions', 'products', 'stores', 'categories', 'customers', 'pos_users', 
      'combo_offers', 'combo_offer_items', 'accounts', 'bogo_offers', 
      'multi_product_bogo_offers', 'multi_product_bogo_items', 'announcements',
      'custom_price_tiers', 'custom_tier_prices', 'customer_product_prices'
    ];
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeNames, 'readwrite');
      
      storeNames.forEach(storeName => {
        tx.objectStore(storeName).clear();
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // POS User methods
  async savePOSUsers(users: OfflinePOSUser[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pos_users', 'readwrite');
      const store = tx.objectStore('pos_users');
      
      users.forEach(user => {
        store.put({ ...user, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPOSUserByPin(pinHash: string): Promise<OfflinePOSUser | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pos_users', 'readonly');
      const store = tx.objectStore('pos_users');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const users = request.result as OfflinePOSUser[];
        const user = users.find(u => u.pin_hash === pinHash && u.is_active);
        resolve(user || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPOSUsers(): Promise<OfflinePOSUser[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('pos_users', 'readonly');
      const store = tx.objectStore('pos_users');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Combo Offers methods
  async saveComboOffers(combos: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('combo_offers', 'readwrite');
      const store = tx.objectStore('combo_offers');
      
      combos.forEach(combo => {
        store.put({ ...combo, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getComboOffers(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('combo_offers', 'readonly');
      const store = tx.objectStore('combo_offers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveComboOfferItems(items: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('combo_offer_items', 'readwrite');
      const store = tx.objectStore('combo_offer_items');
      
      items.forEach(item => {
        store.put({ ...item, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getComboOfferItems(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('combo_offer_items', 'readonly');
      const store = tx.objectStore('combo_offer_items');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Accounts methods
  async saveAccounts(accounts: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('accounts', 'readwrite');
      const store = tx.objectStore('accounts');
      
      accounts.forEach(account => {
        store.put({ ...account, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAccounts(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('accounts', 'readonly');
      const store = tx.objectStore('accounts');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // BOGO Offers methods
  async saveBogoOffers(offers: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('bogo_offers', 'readwrite');
      const store = tx.objectStore('bogo_offers');
      
      offers.forEach(offer => {
        store.put({ ...offer, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getBogoOffers(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('bogo_offers', 'readonly');
      const store = tx.objectStore('bogo_offers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Multi-product BOGO Offers methods
  async saveMultiProductBogoOffers(offers: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('multi_product_bogo_offers', 'readwrite');
      const store = tx.objectStore('multi_product_bogo_offers');
      
      offers.forEach(offer => {
        store.put({ ...offer, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMultiProductBogoOffers(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('multi_product_bogo_offers', 'readonly');
      const store = tx.objectStore('multi_product_bogo_offers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Multi-product BOGO Items methods
  async saveMultiProductBogoItems(items: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('multi_product_bogo_items', 'readwrite');
      const store = tx.objectStore('multi_product_bogo_items');
      
      items.forEach(item => {
        store.put({ ...item, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMultiProductBogoItems(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('multi_product_bogo_items', 'readonly');
      const store = tx.objectStore('multi_product_bogo_items');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Announcements methods
  async saveAnnouncements(announcements: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('announcements', 'readwrite');
      const store = tx.objectStore('announcements');
      
      announcements.forEach(announcement => {
        store.put({ ...announcement, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAnnouncements(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('announcements', 'readonly');
      const store = tx.objectStore('announcements');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Custom Price Tiers methods
  async saveCustomPriceTiers(tiers: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('custom_price_tiers', 'readwrite');
      const store = tx.objectStore('custom_price_tiers');
      
      tiers.forEach(tier => {
        store.put({ ...tier, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCustomPriceTiers(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('custom_price_tiers', 'readonly');
      const store = tx.objectStore('custom_price_tiers');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Custom Tier Prices methods
  async saveCustomTierPrices(prices: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('custom_tier_prices', 'readwrite');
      const store = tx.objectStore('custom_tier_prices');
      
      prices.forEach(price => {
        store.put({ ...price, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCustomTierPrices(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('custom_tier_prices', 'readonly');
      const store = tx.objectStore('custom_tier_prices');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Customer Product Prices methods
  async saveCustomerProductPrices(prices: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('customer_product_prices', 'readwrite');
      const store = tx.objectStore('customer_product_prices');
      
      prices.forEach(price => {
        store.put({ ...price, lastUpdated: new Date().toISOString() });
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCustomerProductPrices(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('customer_product_prices', 'readonly');
      const store = tx.objectStore('customer_product_prices');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineDB = new OfflineDB();
