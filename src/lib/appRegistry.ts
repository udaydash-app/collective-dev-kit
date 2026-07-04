import {
  LayoutDashboard, ShoppingCart, ClipboardList, FileText, Wallet,
  PiggyBank, Package, Boxes, Layers, BarChart3, Tags, Megaphone,
  Users, Receipt, BookOpen, Scale, TrendingUp, ScrollText,
  Calculator, FileSpreadsheet, Truck, ShoppingBag, Settings as SettingsIcon,
  UserCog, MessageSquare, Percent, Gift, Repeat, Barcode as BarcodeIcon,
  ClipboardCheck, Factory, Banknote, Database, FileBarChart, Coins,
  CreditCard, Upload, UtensilsCrossed, ChefHat, Armchair, BookOpenCheck,
  Carrot, Truck as TruckIcon, type LucideIcon,
} from 'lucide-react';
import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

export type AppGroup =
  | 'POS & Sales'
  | 'Inventory'
  | 'Purchasing'
  | 'Accounting'
  | 'Analytics'
  | 'Marketing'
  | 'Admin'
  | 'Restaurant'
  | 'External';

export interface AppDef {
  id: string;
  path: string;
  title: string;
  icon: LucideIcon;
  group: AppGroup;
  component: LazyExoticComponent<ComponentType<any>>;
  color?: string;
}

// Lazy-load every admin page so the desktop shell stays light.
const L = <T,>(loader: () => Promise<{ default: ComponentType<T> }>) => lazy(loader);

export const APPS: AppDef[] = [
  // POS & Sales
  { id: 'pos', path: '/admin/pos', title: 'POS', icon: ShoppingCart, group: 'POS & Sales', color: 'from-emerald-500 to-green-600',
    component: L(() => import('@/pages/admin/POS')) },
  { id: 'orders', path: '/admin/orders', title: 'Orders', icon: ClipboardList, group: 'POS & Sales', color: 'from-blue-500 to-indigo-600',
    component: L(() => import('@/pages/admin/Orders')) },
  { id: 'quotations', path: '/admin/quotations', title: 'Quotations', icon: FileText, group: 'POS & Sales', color: 'from-cyan-500 to-blue-600',
    component: L(() => import('@/pages/admin/Quotations')) },
  { id: 'open-cash-register', path: '/admin/open-cash-register', title: 'Open Cash Register', icon: Wallet, group: 'POS & Sales', color: 'from-amber-500 to-orange-600',
    component: L(() => import('@/pages/admin/OpenCashRegister')) },
  { id: 'close-day-report', path: '/admin/close-day-report', title: 'Close-Day Report', icon: ScrollText, group: 'POS & Sales', color: 'from-rose-500 to-red-600',
    component: L(() => import('@/pages/admin/CloseDayReport')) },

  // Inventory
  { id: 'products', path: '/admin/products', title: 'Products', icon: Package, group: 'Inventory', color: 'from-violet-500 to-purple-600',
    component: L(() => import('@/pages/admin/Products')) },
  { id: 'categories', path: '/admin/categories', title: 'Categories', icon: Tags, group: 'Inventory', color: 'from-fuchsia-500 to-pink-600',
    component: L(() => import('@/pages/admin/Categories')) },
  { id: 'stock-and-price', path: '/admin/stock-and-price', title: 'Stock & Price', icon: Boxes, group: 'Inventory', color: 'from-teal-500 to-cyan-600',
    component: L(() => import('@/pages/admin/StockAndPrice')) },
  { id: 'stock-adjustment', path: '/admin/stock-adjustment', title: 'Stock Adjustment', icon: ClipboardCheck, group: 'Inventory', color: 'from-lime-500 to-green-600',
    component: L(() => import('@/pages/admin/StockAdjustment')) },
  { id: 'inventory-reports', path: '/admin/inventory-reports', title: 'Inventory Reports', icon: FileBarChart, group: 'Inventory', color: 'from-sky-500 to-blue-600',
    component: L(() => import('@/pages/admin/InventoryReports')) },
  { id: 'barcode', path: '/admin/barcode', title: 'Barcode', icon: BarcodeIcon, group: 'Inventory', color: 'from-slate-500 to-gray-700',
    component: L(() => import('@/pages/admin/Barcode')) },
  { id: 'production', path: '/admin/production', title: 'Production', icon: Factory, group: 'Inventory', color: 'from-orange-500 to-red-600',
    component: L(() => import('@/pages/admin/Production')) },
  { id: 'import-products', path: '/admin/import-products', title: 'Import Products', icon: Upload, group: 'Inventory', color: 'from-indigo-500 to-blue-700',
    component: L(() => import('@/pages/admin/ProductImport')) },

  // Purchasing
  { id: 'purchases', path: '/admin/purchases', title: 'Purchases', icon: ShoppingBag, group: 'Purchasing', color: 'from-pink-500 to-rose-600',
    component: L(() => import('@/pages/admin/Purchases')) },
  { id: 'purchase-orders', path: '/admin/purchase-orders', title: 'Purchase Orders', icon: Truck, group: 'Purchasing', color: 'from-amber-500 to-yellow-600',
    component: L(() => import('@/pages/admin/PurchaseOrders')) },
  { id: 'supplier-payments', path: '/admin/supplier-payments', title: 'Supplier Payments', icon: Banknote, group: 'Purchasing', color: 'from-emerald-500 to-teal-600',
    component: L(() => import('@/pages/admin/SupplierPayments')) },
  { id: 'accounts-payable', path: '/admin/accounts-payable', title: 'Accounts Payable', icon: CreditCard, group: 'Purchasing', color: 'from-red-500 to-pink-600',
    component: L(() => import('@/pages/admin/AccountsPayable')) },

  // Accounting
  { id: 'chart-of-accounts', path: '/admin/chart-of-accounts', title: 'Chart of Accounts', icon: BookOpen, group: 'Accounting', color: 'from-blue-600 to-indigo-700',
    component: L(() => import('@/pages/admin/ChartOfAccounts')) },
  { id: 'journal-entries', path: '/admin/journal-entries', title: 'Journal Entries', icon: ScrollText, group: 'Accounting', color: 'from-cyan-600 to-blue-700',
    component: L(() => import('@/pages/admin/JournalEntries')) },
  { id: 'general-ledger', path: '/admin/general-ledger', title: 'General Ledger', icon: BookOpen, group: 'Accounting', color: 'from-violet-600 to-purple-700',
    component: L(() => import('@/pages/admin/GeneralLedger')) },
  { id: 'trial-balance', path: '/admin/trial-balance', title: 'Trial Balance', icon: Scale, group: 'Accounting', color: 'from-teal-600 to-emerald-700',
    component: L(() => import('@/pages/admin/TrialBalance')) },
  { id: 'profit-loss', path: '/admin/profit-loss', title: 'Profit & Loss', icon: TrendingUp, group: 'Accounting', color: 'from-green-600 to-lime-700',
    component: L(() => import('@/pages/admin/ProfitLoss')) },
  { id: 'balance-sheet', path: '/admin/balance-sheet', title: 'Balance Sheet', icon: Scale, group: 'Accounting', color: 'from-indigo-600 to-violet-700',
    component: L(() => import('@/pages/admin/BalanceSheet')) },
  { id: 'cash-flow', path: '/admin/cash-flow', title: 'Cash Flow', icon: Coins, group: 'Accounting', color: 'from-amber-600 to-orange-700',
    component: L(() => import('@/pages/admin/CashFlow')) },
  { id: 'trading-account', path: '/admin/trading-account', title: 'Trading Account', icon: Calculator, group: 'Accounting', color: 'from-emerald-600 to-green-700',
    component: L(() => import('@/pages/admin/TradingAccount')) },
  { id: 'tax-collection-report', path: '/admin/tax-collection-report', title: 'Tax Collection', icon: FileSpreadsheet, group: 'Accounting', color: 'from-rose-600 to-red-700',
    component: L(() => import('@/pages/admin/TaxCollectionReport')) },
  { id: 'expenses', path: '/admin/expenses', title: 'Expenses', icon: Receipt, group: 'Accounting', color: 'from-pink-600 to-rose-700',
    component: L(() => import('@/pages/admin/Expenses')) },
  { id: 'payment-receipts', path: '/admin/payment-receipts', title: 'Payment Receipts', icon: Receipt, group: 'Accounting', color: 'from-cyan-600 to-teal-700',
    component: L(() => import('@/pages/admin/PaymentReceipts')) },
  { id: 'accounts-receivable', path: '/admin/accounts-receivable', title: 'Accounts Receivable', icon: PiggyBank, group: 'Accounting', color: 'from-lime-600 to-green-700',
    component: L(() => import('@/pages/admin/AccountsReceivable')) },

  // Analytics
  { id: 'dashboard-modern', path: '/admin/dashboard-modern', title: 'Dashboard', icon: LayoutDashboard, group: 'Analytics', color: 'from-blue-500 to-cyan-600',
    component: L(() => import('@/pages/admin/DashboardModern')) },
  { id: 'dashboard', path: '/admin/dashboard', title: 'Classic Dashboard', icon: LayoutDashboard, group: 'Analytics', color: 'from-slate-500 to-gray-700',
    component: L(() => import('@/pages/admin/Dashboard')) },
  { id: 'analytics', path: '/admin/analytics', title: 'Analytics', icon: BarChart3, group: 'Analytics', color: 'from-purple-500 to-pink-600',
    component: L(() => import('@/pages/admin/Analytics')) },
  { id: 'cogs-analysis', path: '/admin/cogs-analysis', title: 'COGS Analysis', icon: BarChart3, group: 'Analytics', color: 'from-amber-500 to-orange-600',
    component: L(() => import('@/pages/admin/COGSAnalysis')) },
  { id: 'profit-margin-analysis', path: '/admin/profit-margin-analysis', title: 'Profit Margin', icon: TrendingUp, group: 'Analytics', color: 'from-emerald-500 to-teal-600',
    component: L(() => import('@/pages/admin/ProfitMarginAnalysis')) },
  { id: 'profit-loss-analysis', path: '/admin/profit-loss-analysis', title: 'P&L Analysis', icon: TrendingUp, group: 'Analytics', color: 'from-rose-500 to-red-600',
    component: L(() => import('@/pages/admin/ProfitLossAnalysis')) },
  { id: 'margin-simulator', path: '/admin/margin-simulator', title: 'Margin Simulator', icon: Percent, group: 'Analytics', color: 'from-fuchsia-500 to-pink-600',
    component: L(() => import('@/pages/admin/MarginSimulator')) },
  { id: 'sales-target', path: '/admin/sales-target', title: 'Sales Target', icon: TrendingUp, group: 'Analytics', color: 'from-emerald-500 to-teal-600',
    component: L(() => import('@/pages/admin/SalesTarget')) },

  // Marketing
  { id: 'offers', path: '/admin/offers', title: 'Offers', icon: Percent, group: 'Marketing', color: 'from-orange-500 to-red-600',
    component: L(() => import('@/pages/admin/Offers')) },
  { id: 'combo-offers', path: '/admin/combo-offers', title: 'Combo Offers', icon: Gift, group: 'Marketing', color: 'from-pink-500 to-fuchsia-600',
    component: L(() => import('@/pages/admin/ComboOffers')) },
  { id: 'bogo-offers', path: '/admin/bogo-offers', title: 'BOGO', icon: Repeat, group: 'Marketing', color: 'from-violet-500 to-purple-600',
    component: L(() => import('@/pages/admin/BOGOOffers')) },
  { id: 'multi-product-bogo', path: '/admin/multi-product-bogo', title: 'Multi-Product BOGO', icon: Layers, group: 'Marketing', color: 'from-indigo-500 to-blue-600',
    component: L(() => import('@/pages/admin/MultiProductBOGO')) },
  { id: 'announcements', path: '/admin/announcements', title: 'Announcements', icon: Megaphone, group: 'Marketing', color: 'from-yellow-500 to-amber-600',
    component: L(() => import('@/pages/admin/Announcements')) },
  { id: 'pricing', path: '/admin/pricing', title: 'Pricing', icon: Tags, group: 'Marketing', color: 'from-emerald-500 to-cyan-600',
    component: L(() => import('@/pages/admin/Pricing')) },

  // Admin
  { id: 'contacts', path: '/admin/contacts', title: 'Contacts', icon: Users, group: 'Admin', color: 'from-blue-500 to-indigo-600',
    component: L(() => import('@/pages/admin/Contacts')) },
  { id: 'import-contacts', path: '/admin/import-contacts', title: 'Import Contacts', icon: Upload, group: 'Admin', color: 'from-slate-500 to-blue-700',
    component: L(() => import('@/pages/admin/ContactImport')) },
  { id: 'pos-users', path: '/admin/pos-users', title: 'POS Users', icon: UserCog, group: 'Admin', color: 'from-purple-500 to-violet-700',
    component: L(() => import('@/pages/admin/POSUsers')) },
  { id: 'live-chat', path: '/admin/live-chat', title: 'Live Chat', icon: MessageSquare, group: 'Admin', color: 'from-green-500 to-emerald-600',
    component: L(() => import('@/pages/admin/LiveChat')) },
  { id: 'settings', path: '/admin/settings', title: 'Settings', icon: SettingsIcon, group: 'Admin', color: 'from-gray-500 to-slate-700',
    component: L(() => import('@/pages/admin/Settings')) },
  { id: 'calculator', path: '/admin/calculator', title: 'Calculator', icon: Calculator, group: 'Admin', color: 'from-zinc-500 to-slate-700',
    component: L(() => import('@/pages/admin/Calculator')) },

  // Restaurant
  { id: 'restaurant', path: '/admin/restaurant', title: 'Restaurant', icon: UtensilsCrossed, group: 'Restaurant', color: 'from-orange-500 to-red-600',
    component: L(() => import('@/pages/admin/restaurant/RestaurantDashboard')) },
  { id: 'restaurant-menu', path: '/admin/restaurant/menu', title: 'Menu', icon: ChefHat, group: 'Restaurant', color: 'from-amber-500 to-orange-600',
    component: L(() => import('@/pages/admin/restaurant/RestaurantMenu')) },
  { id: 'restaurant-tables', path: '/admin/restaurant/tables', title: 'Tables', icon: Armchair, group: 'Restaurant', color: 'from-rose-500 to-pink-600',
    component: L(() => import('@/pages/admin/restaurant/RestaurantTables')) },
  { id: 'restaurant-recipes', path: '/admin/restaurant/recipes', title: 'Recipes', icon: BookOpenCheck, group: 'Restaurant', color: 'from-red-500 to-orange-700',
    component: L(() => import('@/pages/admin/restaurant/RestaurantRecipes')) },
  { id: 'restaurant-ingredients', path: '/admin/restaurant/ingredients', title: 'Ingredients', icon: Carrot, group: 'Restaurant', color: 'from-green-500 to-emerald-700',
    component: L(() => import('@/pages/admin/restaurant/RestaurantIngredients')) },
  { id: 'restaurant-purchases', path: '/admin/restaurant/purchases', title: 'Ingredient Purchases', icon: TruckIcon, group: 'Restaurant', color: 'from-blue-500 to-indigo-700',
    component: L(() => import('@/pages/admin/restaurant/RestaurantPurchases')) },
  { id: 'restaurant-settings', path: '/admin/restaurant/settings', title: 'Restaurant Settings', icon: SettingsIcon, group: 'Restaurant', color: 'from-slate-500 to-slate-700',
    component: L(() => import('@/pages/admin/restaurant/RestaurantSettings')) },

  // External
  { id: 'ledgerly', path: '/admin/ledgerly', title: 'Ledgerly', icon: BookOpen, group: 'External', color: 'from-emerald-600 to-teal-700',
    component: L(() => import('@/pages/admin/Ledgerly')) },
  { id: 'trading-quote', path: '/admin/trading-quote', title: 'Trading Quote', icon: FileText, group: 'External', color: 'from-blue-600 to-cyan-700',
    component: L(() => import('@/pages/admin/TradingQuote')) },
  { id: 'trade-records', path: '/admin/trade-records', title: 'Trade Records', icon: FileText, group: 'External', color: 'from-indigo-600 to-blue-700',
    component: L(() => import('@/pages/admin/TradeRecords')) },
  { id: 'cash-register', path: '/admin/cash-register', title: 'Cash Register', icon: Wallet, group: 'External', color: 'from-amber-600 to-orange-700',
    component: L(() => import('@/pages/admin/CashRegister')) },
];

export const findAppByPath = (path: string): AppDef | undefined =>
  APPS.find((a) => a.path === path || path.startsWith(a.path + '/'));

export const findAppById = (id: string): AppDef | undefined => APPS.find((a) => a.id === id);

export const APP_GROUPS: AppGroup[] = [
  'POS & Sales', 'Inventory', 'Purchasing', 'Accounting', 'Analytics', 'Marketing', 'Admin', 'Restaurant', 'External',
];