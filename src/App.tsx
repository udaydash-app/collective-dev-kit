import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
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
import AdminChartOfAccounts from "./pages/admin/ChartOfAccounts";
import AdminJournalEntries from "./pages/admin/JournalEntries";
import AdminGeneralLedger from "./pages/admin/GeneralLedger";
import AdminTrialBalance from "./pages/admin/TrialBalance";
import AdminProfitLoss from "./pages/admin/ProfitLoss";
import AdminBalanceSheet from "./pages/admin/BalanceSheet";
import AdminCashFlow from "./pages/admin/CashFlow";
import AdminPOSUsers from "./pages/admin/POSUsers";
import AdminExpenses from "./pages/admin/Expenses";
import AdminCloseDayReport from "./pages/admin/CloseDayReport";
import AdminInventoryReports from "./pages/admin/InventoryReports";
import AdminStockAdjustment from "./pages/admin/StockAdjustment";
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
import { ReturnToPOSButton } from "./components/layout/ReturnToPOSButton";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

const AppContent = () => {
  // Enable realtime sync across the app
  useRealtimeSync();

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OrderStatusNotifications />
      <BrowserRouter>
        <ReturnToPOSButton />
        <Routes>
          {/* Customer-facing home */}
          <Route path="/" element={<Index />} />
          
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
          <Route path="/admin/announcements" element={<AdminRoute><AdminAnnouncements /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
          <Route path="/admin/pos" element={<AdminRoute><AdminPOS /></AdminRoute>} />
          <Route path="/admin/purchases" element={<AdminRoute><AdminPurchases /></AdminRoute>} />
          <Route path="/admin/contacts" element={<AdminRoute><AdminContacts /></AdminRoute>} />
          <Route path="/admin/pos-users" element={<AdminRoute><AdminPOSUsers /></AdminRoute>} />
          <Route path="/admin/expenses" element={<AdminRoute><AdminExpenses /></AdminRoute>} />
          <Route path="/admin/close-day-report" element={<AdminRoute><AdminCloseDayReport /></AdminRoute>} />
          <Route path="/admin/inventory-reports" element={<AdminRoute><AdminInventoryReports /></AdminRoute>} />
          <Route path="/admin/stock-adjustment" element={<AdminRoute><AdminStockAdjustment /></AdminRoute>} />
          <Route path="/admin/chart-of-accounts" element={<AdminRoute><AdminChartOfAccounts /></AdminRoute>} />
          <Route path="/admin/journal-entries" element={<AdminRoute><AdminJournalEntries /></AdminRoute>} />
          <Route path="/admin/general-ledger" element={<AdminRoute><AdminGeneralLedger /></AdminRoute>} />
          <Route path="/admin/trial-balance" element={<AdminRoute><AdminTrialBalance /></AdminRoute>} />
          <Route path="/admin/profit-loss" element={<AdminRoute><AdminProfitLoss /></AdminRoute>} />
          <Route path="/admin/balance-sheet" element={<AdminRoute><AdminBalanceSheet /></AdminRoute>} />
          <Route path="/admin/cash-flow" element={<AdminRoute><AdminCashFlow /></AdminRoute>} />
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
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
