/**
 * IndexedDB wrapper for offline storage
 * Stores POS transactions, orders, and data for offline operation
 */

const DB_NAME = 'GlobalMarketPOS';
const DB_VERSION = 1;

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
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result);
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
    const storeNames = ['transactions', 'products', 'stores', 'categories', 'customers'];
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeNames, 'readwrite');
      
      storeNames.forEach(storeName => {
        tx.objectStore(storeName).clear();
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineDB = new OfflineDB();
