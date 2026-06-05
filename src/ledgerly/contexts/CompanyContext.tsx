import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  base_currency: string;
  currency_symbol: string;
  currency_position: string;
  invoice_footer: string | null;
  invoice_prefix: string;
  invoice_next_number: number;
  invoice_pad_width: number;
  bill_prefix: string;
  bill_next_number: number;
  bill_pad_width: number;
  po_prefix: string;
  po_next_number: number;
  po_pad_width: number;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tax_number: string | null;
}

interface Ctx {
  companies: Company[];
  activeCompany: Company | null;
  companyId: string | null;
  loading: boolean;
  setActiveCompany: (id: string) => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "activeCompanyId";

const CompanyCtx = createContext<Ctx>({
  companies: [], activeCompany: null, companyId: null, loading: true,
  setActiveCompany: () => {}, refresh: async () => {},
});

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setCompanies([]); setActiveId(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("companies").select("*")
      .order("created_at", { ascending: true });
    if (error) { setLoading(false); return; }
    let list = (data ?? []) as Company[];
    if (list.length === 0) {
      // Auto-create a default company
      const { data: created } = await supabase
        .from("companies").insert({ user_id: user.id, name: "My Company" })
        .select("*").single();
      if (created) list = [created as Company];
    }
    setCompanies(list);
    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && list.find((c) => c.id === stored);
    const next = valid ? stored! : list[0]?.id ?? null;
    setActiveId(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const setActiveCompany = (id: string) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeCompany = companies.find((c) => c.id === activeId) ?? null;

  return (
    <CompanyCtx.Provider value={{
      companies, activeCompany, companyId: activeId, loading,
      setActiveCompany, refresh: load,
    }}>
      {children}
    </CompanyCtx.Provider>
  );
};

export const useCompany = () => useContext(CompanyCtx);