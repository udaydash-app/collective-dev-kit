export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_lines: {
        Row: {
          amount: number
          bill_id: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          item_id: string | null
          quantity: number
          rate: number
          user_id: string
        }
        Insert: {
          amount?: number
          bill_id: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          item_id?: string | null
          quantity?: number
          rate?: number
          user_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          item_id?: string | null
          quantity?: number
          rate?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_date: string
          bill_number: string
          company_id: string
          contact_id: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          paid_amount: number
          po_id: string | null
          status: Database["public"]["Enums"]["doc_status"]
          subtotal: number
          tax_amount: number
          tax_percent: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_date?: string
          bill_number: string
          company_id: string
          contact_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          po_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_date?: string
          bill_number?: string
          company_id?: string
          contact_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          po_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          base_currency: string
          bill_next_number: number
          bill_pad_width: number
          bill_prefix: string
          created_at: string
          currency_position: string
          currency_symbol: string
          email: string | null
          id: string
          invoice_footer: string | null
          invoice_next_number: number
          invoice_pad_width: number
          invoice_prefix: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          po_next_number: number
          po_pad_width: number
          po_prefix: string
          tax_number: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          base_currency?: string
          bill_next_number?: number
          bill_pad_width?: number
          bill_prefix?: string
          created_at?: string
          currency_position?: string
          currency_symbol?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_next_number?: number
          invoice_pad_width?: number
          invoice_prefix?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          po_next_number?: number
          po_pad_width?: number
          po_prefix?: string
          tax_number?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          base_currency?: string
          bill_next_number?: number
          bill_pad_width?: number
          bill_prefix?: string
          created_at?: string
          currency_position?: string
          currency_symbol?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_next_number?: number
          invoice_pad_width?: number
          invoice_prefix?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          po_next_number?: number
          po_pad_width?: number
          po_prefix?: string
          tax_number?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_account_id: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          expense_date: string
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          notes: string | null
          paid_from_account_id: string | null
          reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_account_id?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          notes?: string | null
          paid_from_account_id?: string | null
          reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_account_id?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          notes?: string | null
          paid_from_account_id?: string | null
          reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_account_id_fkey"
            columns: ["category_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          item_id: string | null
          quantity: number
          rate: number
          user_id: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          item_id?: string | null
          quantity?: number
          rate?: number
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          item_id?: string | null
          quantity?: number
          rate?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_amount: number
          status: Database["public"]["Enums"]["doc_status"]
          subtotal: number
          tax_amount: number
          tax_percent: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["doc_status"]
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          avg_cost: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          purchase_rate: number
          selling_rate: number
          sku: string | null
          stock_qty: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          purchase_rate?: number
          selling_rate?: number
          sku?: string | null
          stock_qty?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          purchase_rate?: number
          selling_rate?: number
          sku?: string | null
          stock_qty?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          entry_date: string
          id: string
          narration: string | null
          reference: string | null
          source_id: string | null
          source_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entry_date?: string
          id?: string
          narration?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entry_date?: string
          id?: string
          narration?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          company_id: string
          contact_id: string | null
          created_at: string
          credit: number
          debit: number
          description: string | null
          entry_id: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          bill_id: string | null
          company_id: string
          created_at: string
          id: string
          invoice_id: string | null
          payment_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          bill_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id: string
          user_id: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          bill_id: string | null
          company_id: string
          contact_id: string
          created_at: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id: string
          invoice_id: string | null
          mode: Database["public"]["Enums"]["payment_mode"]
          notes: string | null
          payment_date: string
          reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          bill_id?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id?: string
          invoice_id?: string | null
          mode?: Database["public"]["Enums"]["payment_mode"]
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bill_id?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          id?: string
          invoice_id?: string | null
          mode?: Database["public"]["Enums"]["payment_mode"]
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          base_currency: string
          bill_next_number: number
          bill_pad_width: number
          bill_prefix: string
          business_name: string
          created_at: string
          currency_position: string
          currency_symbol: string
          date_format: string
          decimal_places: number
          email: string | null
          id: string
          invoice_footer: string | null
          invoice_next_number: number
          invoice_pad_width: number
          invoice_prefix: string
          logo_url: string | null
          number_format: string
          phone: string | null
          po_next_number: number
          po_pad_width: number
          po_prefix: string
          tax_number: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          base_currency?: string
          bill_next_number?: number
          bill_pad_width?: number
          bill_prefix?: string
          business_name?: string
          created_at?: string
          currency_position?: string
          currency_symbol?: string
          date_format?: string
          decimal_places?: number
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_next_number?: number
          invoice_pad_width?: number
          invoice_prefix?: string
          logo_url?: string | null
          number_format?: string
          phone?: string | null
          po_next_number?: number
          po_pad_width?: number
          po_prefix?: string
          tax_number?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          base_currency?: string
          bill_next_number?: number
          bill_pad_width?: number
          bill_prefix?: string
          business_name?: string
          created_at?: string
          currency_position?: string
          currency_symbol?: string
          date_format?: string
          decimal_places?: number
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_next_number?: number
          invoice_pad_width?: number
          invoice_prefix?: string
          logo_url?: string | null
          number_format?: string
          phone?: string | null
          po_next_number?: number
          po_pad_width?: number
          po_prefix?: string
          tax_number?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          item_id: string | null
          po_id: string
          quantity: number
          rate: number
          user_id: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          item_id?: string | null
          po_id: string
          quantity?: number
          rate?: number
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          item_id?: string | null
          po_id?: string
          quantity?: number
          rate?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string
          expected_date: string | null
          id: string
          notes: string | null
          po_date: string
          po_number: string
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number
          tax_amount: number
          tax_percent: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number?: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          tax_amount?: number
          tax_percent?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_or_create_contact_account: {
        Args: { p_company_id: string; p_contact_id: string; p_kind: string }
        Returns: string
      }
      next_doc_number: {
        Args: { doc_kind: string; p_company_id: string }
        Returns: string
      }
      seed_company_accounts: {
        Args: { p_company_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      contact_type: "customer" | "supplier" | "both"
      doc_status: "draft" | "open" | "partial" | "paid" | "void"
      payment_direction: "in" | "out"
      payment_mode: "cash" | "bank" | "other"
      po_status: "draft" | "sent" | "partial" | "billed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "income", "expense"],
      contact_type: ["customer", "supplier", "both"],
      doc_status: ["draft", "open", "partial", "paid", "void"],
      payment_direction: ["in", "out"],
      payment_mode: ["cash", "bank", "other"],
      po_status: ["draft", "sent", "partial", "billed", "cancelled"],
    },
  },
} as const
