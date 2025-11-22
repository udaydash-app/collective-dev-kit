import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Categories from "./pages/Categories";
import SearchPage from "./pages/SearchPage";
import Cart from "./pages/Cart";
import Profile from "./pages/Profile";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import POSLogin from "./pages/auth/POSLogin";
import CategoryProducts from "./pages/CategoryProducts";
import ProductDetails from "./pages/ProductDetails";
import ProductImport from "./pages/admin/ProductImport";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminOrders from "./pages/admin/Orders";
import Analytics from "./pages/admin/Analytics";
import Products from "./pages/admin/Products";
import AdminSettings from "./pages/admin/Settings";
import AdminCategories from "./pages/admin/Categories";
import AdminOffers from "./pages/admin/Offers";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminPOS from "./pages/admin/POS";
import AdminPurchases from "./pages/admin/Purchases";
import AdminContacts from "./pages/admin/Contacts";
import AdminContactImport from "./pages/admin/ContactImport";
import AdminChartOfAccounts from "./pages/admin/ChartOfAccounts";
import AdminJournalEntries from "./pages/admin/JournalEntries";
import AdminGeneralLedger from "./pages/admin/GeneralLedger";
import AdminPaymentReceipts from "./pages/admin/PaymentReceipts";
import AdminSupplierPayments from "./pages/admin/SupplierPayments";
import AdminTrialBalance from "./pages/admin/TrialBalance";
import AdminProfitLoss from "./pages/admin/ProfitLoss";
import AdminBalanceSheet from "./pages/admin/BalanceSheet";
import AdminCashFlow from "./pages/admin/CashFlow";
import AdminPOSUsers from "./pages/admin/POSUsers";
import AdminExpenses from "./pages/admin/Expenses";
import AdminOpenCashRegister from "./pages/admin/OpenCashRegister";
import AdminPricing from "./pages/admin/Pricing";
import AdminCloseDayReport from "./pages/admin/CloseDayReport";
import AdminInventoryReports from "./pages/admin/InventoryReports";
import AdminStockAdjustment from "./pages/admin/StockAdjustment";
import AdminStockAndPrice from "./pages/admin/StockAndPrice";
import InventoryLayers from "./pages/admin/InventoryLayers";
import StockReconciliation from "./pages/admin/StockReconciliation";
import COGSAnalysis from "./pages/admin/COGSAnalysis";
import InventoryValuation from "./pages/admin/InventoryValuation";
import Production from "./pages/admin/Production";
import StockAging from "./pages/admin/StockAging";
import ProfitMarginAnalysis from "./pages/admin/ProfitMarginAnalysis";
import AdminComboOffers from "./pages/admin/ComboOffers";
import AdminBOGOOffers from "./pages/admin/BOGOOffers";
import AdminMultiProductBOGO from "./pages/admin/MultiProductBOGO";
import AdminAccountsReceivable from "./pages/admin/AccountsReceivable";
import AdminAccountsPayable from "./pages/admin/AccountsPayable";
import AdminOfflineSync from "./pages/admin/OfflineSync";
import AdminQuotations from "./pages/admin/Quotations";
import AdminBarcode from "./pages/admin/Barcode";
import Wishlist from "./pages/Wishlist";
import Orders from "./pages/Orders";
import Notifications from "./pages/Notifications";
import Stores from "./pages/Stores";
import Support from "./pages/Support";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import OrderConfirmation from "./pages/OrderConfirmation";
import GuestCheckout from "./pages/GuestCheckout";
import OrderDetails from "./pages/OrderDetails";
import Addresses from "./pages/profile/Addresses";
import PaymentMethods from "./pages/profile/PaymentMethods";
import NotFound from "./pages/NotFound";
import { AdminRoute } from "./components/auth/AdminRoute";
import { OrderStatusNotifications } from "./components/OrderStatusNotifications";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { KeyboardShortcutsDialog } from "./components/layout/KeyboardShortcutsDialog";
import { useGlobalShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAdminShortcuts } from "./hooks/useAdminShortcuts";
import PWAInstall from "./pages/PWAInstall";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

// Component that uses router hooks - must be inside Router
const RouterContent = () => {
  useGlobalShortcuts();
  useAdminShortcuts();
  return null;
};

const AppContent = () => {
  // Enable realtime sync across the app
  useRealtimeSync();

  // Cache essential data on app startup for offline support
  React.useEffect(() => {
    const initOfflineData = async () => {
      if (!navigator.onLine) {
        console.log('App started offline, using cached data');
        return;
      }

      try {
        const { cacheEssentialData, getLastCacheTime, isCacheStale } = await import('@/lib/cacheData');
        const lastCache = getLastCacheTime();
        
        if (!lastCache) {
          // First time setup - cache all data
          console.log('First time setup: Caching all data for offline use...');
          await cacheEssentialData(false);
          console.log('Initial data cache completed');
        } else if (isCacheStale(24)) {
          // Refresh stale cache (older than 24 hours)
          console.log('Cache is stale, refreshing data...');
          await cacheEssentialData(false);
          console.log('Cache refreshed successfully');
        } else {
          console.log('Cache is fresh, no update needed');
        }
      } catch (error) {
        console.error('Failed to cache data:', error);
      }
    };

    // Run initialization after a short delay to let app mount
    const timer = setTimeout(initOfflineData, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Use HashRouter for Electron, BrowserRouter for web
  const isElectron = React.useMemo(() => 
    typeof window !== 'undefined' && (window as any).electron?.isElectron === true, 
    []
  );
  const Router = isElectron ? HashRouter : BrowserRouter;

  console.log('isElectron:', isElectron);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OrderStatusNotifications />
      <OfflineIndicator />
      <KeyboardShortcutsDialog />
      <Router>
        <RouterContent />
        <Routes>
          {/* Customer-facing home */}
          <Route path="/" element={<Navigate to="/pos-login" replace />} />
          
          {/* PWA Installation page */}
          <Route path="/install" element={<PWAInstall />} />
          
          {/* POS Login for staff */}
          <Route path="/pos-login" element={<POSLogin />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/category/:id" element={<CategoryProducts />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
          <Route path="/admin/import-products" element={<AdminRoute><ProductImport /></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
          <Route path="/admin/products" element={<AdminRoute><Products /></AdminRoute>} />
          <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
          <Route path="/admin/offers" element={<AdminRoute><AdminOffers /></AdminRoute>} />
          <Route path="/admin/combo-offers" element={<AdminRoute><AdminComboOffers /></AdminRoute>} />
          <Route path="/admin/bogo-offers" element={<AdminRoute><AdminBOGOOffers /></AdminRoute>} />
          <Route path="/admin/multi-product-bogo" element={<AdminRoute><AdminMultiProductBOGO /></AdminRoute>} />
          <Route path="/admin/announcements" element={<AdminRoute><AdminAnnouncements /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
          <Route path="/admin/pos" element={<AdminRoute><AdminPOS /></AdminRoute>} />
          <Route path="/admin/purchases" element={<AdminRoute><AdminPurchases /></AdminRoute>} />
          <Route path="/admin/contacts" element={<AdminRoute><AdminContacts /></AdminRoute>} />
          <Route path="/admin/import-contacts" element={<AdminRoute><AdminContactImport /></AdminRoute>} />
          <Route path="/admin/pos-users" element={<AdminRoute><AdminPOSUsers /></AdminRoute>} />
          <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
          <Route path="/admin/pricing" element={<AdminRoute><AdminPricing /></AdminRoute>} />
          <Route path="/admin/stock-and-price" element={<AdminRoute><AdminStockAndPrice /></AdminRoute>} />
          <Route path="/admin/close-day-report" element={<AdminRoute><AdminCloseDayReport /></AdminRoute>} />
          <Route path="/admin/inventory-reports" element={<AdminRoute><AdminInventoryReports /></AdminRoute>} />
          <Route path="/admin/stock-adjustment" element={<AdminRoute><AdminStockAdjustment /></AdminRoute>} />
          <Route path="/admin/chart-of-accounts" element={<AdminRoute><AdminChartOfAccounts /></AdminRoute>} />
          <Route path="/admin/journal-entries" element={<AdminRoute><AdminJournalEntries /></AdminRoute>} />
          <Route path="/admin/general-ledger" element={<AdminRoute><AdminGeneralLedger /></AdminRoute>} />
          <Route path="/admin/inventory-layers" element={<AdminRoute><InventoryLayers /></AdminRoute>} />
          <Route path="/admin/stock-reconciliation" element={<AdminRoute><StockReconciliation /></AdminRoute>} />
          <Route path="/admin/cogs-analysis" element={<AdminRoute><COGSAnalysis /></AdminRoute>} />
          <Route path="/admin/inventory-valuation" element={<AdminRoute><InventoryValuation /></AdminRoute>} />
          <Route path="/admin/production" element={<AdminRoute><Production /></AdminRoute>} />
          <Route path="/admin/stock-aging" element={<AdminRoute><StockAging /></AdminRoute>} />
          <Route path="/admin/profit-margin-analysis" element={<AdminRoute><ProfitMarginAnalysis /></AdminRoute>} />
          <Route path="/admin/payment-receipts" element={<AdminRoute><AdminPaymentReceipts /></AdminRoute>} />
          <Route path="/admin/supplier-payments" element={<AdminRoute><AdminSupplierPayments /></AdminRoute>} />
          <Route path="/admin/trial-balance" element={<AdminRoute><AdminTrialBalance /></AdminRoute>} />
          <Route path="/admin/profit-loss" element={<AdminRoute><AdminProfitLoss /></AdminRoute>} />
          <Route path="/admin/balance-sheet" element={<AdminRoute><AdminBalanceSheet /></AdminRoute>} />
          <Route path="/admin/cash-flow" element={<AdminRoute><AdminCashFlow /></AdminRoute>} />
          <Route path="/admin/open-cash-register" element={<AdminRoute><AdminOpenCashRegister /></AdminRoute>} />
          <Route path="/admin/accounts-receivable" element={<AdminRoute><AdminAccountsReceivable /></AdminRoute>} />
          <Route path="/admin/accounts-payable" element={<AdminRoute><AdminAccountsPayable /></AdminRoute>} />
          <Route path="/admin/offline-sync" element={<AdminRoute><AdminOfflineSync /></AdminRoute>} />
          <Route path="/admin/quotations" element={<AdminRoute><AdminQuotations /></AdminRoute>} />
          <Route path="/admin/barcode" element={<AdminRoute><AdminBarcode /></AdminRoute>} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/guest-checkout" element={<GuestCheckout />} />
          <Route path="/checkout/payment" element={<Payment />} />
          <Route path="/order/confirmation/:orderId" element={<OrderConfirmation />} />
          <Route path="/order/:id" element={<OrderDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/addresses" element={<Addresses />} />
          <Route path="/profile/payment-methods" element={<PaymentMethods />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/support" element={<Support />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </TooltipProvider>
  );
};

export default App;
