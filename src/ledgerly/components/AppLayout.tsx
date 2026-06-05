import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, Users, Package, FileText, ShoppingCart,
  Receipt, Wallet, BookMarked, BarChart3, LogOut, Building2, Settings as SettingsIcon, ClipboardList,
  ChevronDown, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/ledgerly/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFormatProfile } from "@/ledgerly/hooks/useFormatProfile";

type LeafItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; soon?: boolean };
type GroupItem = { label: string; icon: typeof LayoutDashboard; children: { to: string; label: string }[] };
type NavItem = { section: string } | LeafItem | GroupItem;

const reportsChildren = [
  { to: "/ledgerly/reports/trial-balance", label: "Trial Balance" },
  { to: "/ledgerly/reports/profit-loss", label: "Profit & Loss" },
  { to: "/ledgerly/reports/balance-sheet", label: "Balance Sheet" },
  { to: "/ledgerly/reports/cash-flow", label: "Cash Flow" },
  { to: "/ledgerly/reports/ar-aging", label: "AR Aging" },
  { to: "/ledgerly/reports/ap-aging", label: "AP Aging" },
  { to: "/ledgerly/reports/statements", label: "Statements" },
  { to: "/ledgerly/reports/stock-movement", label: "Stock Movement" },
];

const nav: NavItem[] = [
  { to: "/ledgerly", label: "Dashboard", icon: LayoutDashboard, end: true },
  { section: "Accounting" },
  { to: "/ledgerly/accounts", label: "Chart of Accounts", icon: BookOpen },
  { to: "/ledgerly/journal", label: "Journal Entries", icon: BookMarked },
  { to: "/ledgerly/ledger", label: "General Ledger", icon: BarChart3 },
  { section: "Sales" },
  { to: "/ledgerly/contacts", label: "Contacts", icon: Users },
  { to: "/ledgerly/invoices", label: "Sales Invoices", icon: FileText },
  { section: "Purchases" },
  { to: "/ledgerly/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { to: "/ledgerly/bills", label: "Purchase Bills", icon: ShoppingCart },
  { to: "/ledgerly/expenses", label: "Expenses", icon: Receipt },
  { section: "Trading" },
  { to: "/ledgerly/trade-records", label: "Trade Records", icon: TrendingUp },
  { section: "Inventory" },
  { to: "/ledgerly/items", label: "Items", icon: Package },
  { section: "Money" },
  { to: "/ledgerly/payments", label: "Payments & Receipts", icon: Wallet },
  { section: "Reports" },
  { label: "Reports", icon: BarChart3, children: reportsChildren },
  { section: "Settings" },
  { to: "/ledgerly/settings", label: "Business Settings", icon: SettingsIcon },
];

export const AppLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [reportsOpen, setReportsOpen] = useState(location.pathname.startsWith("/ledgerly/reports"));
  useFormatProfile();

  const handleSignOut = async () => { await signOut(); navigate("/ledgerly/auth"); };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-accent-foreground">Ledgerly</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {nav.map((item, i) => {
            if ("section" in item) {
              return (
                <div key={i} className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
                  {item.section}
                </div>
              );
            }
            if ("children" in item) {
              const Icon = item.icon;
              const anyActive = item.children.some((c) => location.pathname.startsWith(c.to));
              return (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => setReportsOpen((v) => !v)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      anyActive
                        ? "bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={reportsOpen}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", reportsOpen && "rotate-180")} />
                  </button>
                  {reportsOpen && (
                    <div className="mt-0.5 ml-4 pl-3 border-l border-sidebar-border space-y-0.5">
                      {item.children.map((c) => (
                        <NavLink
                          key={c.to}
                          to={c.to}
                          className={({ isActive }) => cn(
                            "block rounded-md px-3 py-1.5 text-sm transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {c.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.soon && <span className="text-[10px] uppercase text-sidebar-foreground/50">soon</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
          <Button onClick={handleSignOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="h-4 w-4 mr-2" />Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>
    </div>
  );
};
