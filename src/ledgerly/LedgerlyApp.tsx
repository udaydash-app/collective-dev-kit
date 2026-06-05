import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/ledgerly/contexts/AuthContext";
import { CompanyProvider } from "@/ledgerly/contexts/CompanyContext";
import { ProtectedRoute } from "@/ledgerly/components/ProtectedRoute";
import { AppLayout } from "@/ledgerly/components/AppLayout";
import { ComingSoon } from "@/ledgerly/components/ComingSoon";
import Auth from "@/ledgerly/pages/Auth";
import ResetPassword from "@/ledgerly/pages/ResetPassword";
import Dashboard from "@/ledgerly/pages/Dashboard";
import ChartOfAccounts from "@/ledgerly/pages/ChartOfAccounts";
import Contacts from "@/ledgerly/pages/Contacts";
import Items from "@/ledgerly/pages/Items";
import Bills from "@/ledgerly/pages/Bills";
import BillForm from "@/ledgerly/pages/BillForm";
import PurchaseOrders from "@/ledgerly/pages/PurchaseOrders";
import PurchaseOrderForm from "@/ledgerly/pages/PurchaseOrderForm";
import PurchaseOrderPrint from "@/ledgerly/pages/PurchaseOrderPrint";
import Invoices from "@/ledgerly/pages/Invoices";
import InvoiceForm from "@/ledgerly/pages/InvoiceForm";
import InvoicePrint from "@/ledgerly/pages/InvoicePrint";
import BillPrint from "@/ledgerly/pages/BillPrint";
import Payments from "@/ledgerly/pages/Payments";
import PaymentForm from "@/ledgerly/pages/PaymentForm";
import GeneralLedger from "@/ledgerly/pages/GeneralLedger";
import TrialBalance from "@/ledgerly/pages/TrialBalance";
import ProfitAndLoss from "@/ledgerly/pages/ProfitAndLoss";
import BalanceSheet from "@/ledgerly/pages/BalanceSheet";
import CashFlow from "@/ledgerly/pages/CashFlow";
import ContactStatement from "@/ledgerly/pages/ContactStatement";
import ContactStatementPrint from "@/ledgerly/pages/ContactStatementPrint";
import Journal from "@/ledgerly/pages/Journal";
import JournalForm from "@/ledgerly/pages/JournalForm";
import Expenses from "@/ledgerly/pages/Expenses";
import ExpenseForm from "@/ledgerly/pages/ExpenseForm";
import Aging from "@/ledgerly/pages/Aging";
import AgingPrint from "@/ledgerly/pages/AgingPrint";
import StockMovement from "@/ledgerly/pages/StockMovement";
import Settings from "@/ledgerly/pages/Settings";
import TradeRecords from "@/ledgerly/pages/TradeRecords";
import NotFound from "@/ledgerly/pages/NotFound";

/**
 * Ledgerly accounting sub-app mounted under /ledgerly/*.
 * Routes inside this <Routes> are RELATIVE to /ledgerly,
 * while navigate("/ledgerly/...") absolute links work app-wide.
 */
const LedgerlyApp = () => (
  <AuthProvider>
    <CompanyProvider>
      <Routes>
        <Route path="auth" element={<Auth />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="invoices/:id/print" element={<ProtectedRoute><InvoicePrint /></ProtectedRoute>} />
        <Route path="bills/:id/print" element={<ProtectedRoute><BillPrint /></ProtectedRoute>} />
        <Route path="purchase-orders/:id/print" element={<ProtectedRoute><PurchaseOrderPrint /></ProtectedRoute>} />
        <Route path="reports/statements/print" element={<ProtectedRoute><ContactStatementPrint /></ProtectedRoute>} />
        <Route path="reports/aging/print" element={<ProtectedRoute><AgingPrint /></ProtectedRoute>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<ChartOfAccounts />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="ledger" element={<GeneralLedger />} />
          <Route path="items" element={<Items />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/new" element={<JournalForm />} />
          <Route path="journal/:id" element={<JournalForm />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<InvoiceForm />} />
          <Route path="invoices/:id" element={<InvoiceForm />} />
          <Route path="bills" element={<Bills />} />
          <Route path="bills/new" element={<BillForm />} />
          <Route path="bills/:id" element={<BillForm />} />
          <Route path="purchase-orders" element={<PurchaseOrders />} />
          <Route path="purchase-orders/new" element={<PurchaseOrderForm />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderForm />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="expenses/new" element={<ExpenseForm />} />
          <Route path="trade-records" element={<TradeRecords />} />
          <Route path="payments" element={<Payments />} />
          <Route path="payments/new" element={<PaymentForm />} />
          <Route path="payments/:id/edit" element={<PaymentForm />} />
          <Route path="reports/trial-balance" element={<TrialBalance />} />
          <Route path="reports/profit-loss" element={<ProfitAndLoss />} />
          <Route path="reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="reports/cash-flow" element={<CashFlow />} />
          <Route path="reports/ar-aging" element={<Aging kind="ar" />} />
          <Route path="reports/ap-aging" element={<Aging kind="ap" />} />
          <Route path="reports/statements" element={<ContactStatement />} />
          <Route path="reports/stock-movement" element={<StockMovement />} />
          <Route path="settings" element={<Settings />} />
          <Route path="reports" element={<ComingSoon title="Reports" description="Trial balance, P&L, balance sheet, aging" />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </CompanyProvider>
  </AuthProvider>
);

export default LedgerlyApp;