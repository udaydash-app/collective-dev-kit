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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          created_by: string | null
          current_balance: number
          description: string | null
          id: string
          is_active: boolean
          parent_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at?: string
          created_by?: string | null
          current_balance?: number
          description?: string | null
          id?: string
          is_active?: boolean
          parent_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          created_by?: string | null
          current_balance?: number
          description?: string | null
          id?: string
          is_active?: boolean
          parent_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          created_at: string
          id: string
          is_default: boolean | null
          label: string
          latitude: number | null
          longitude: number | null
          phone: string | null
          state: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          state: string
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          state?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          page_url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          background_color: string | null
          background_image_url: string | null
          created_at: string | null
          display_order: number | null
          end_date: string
          id: string
          is_active: boolean | null
          message: string
          message_font_size: string | null
          message_font_weight: string | null
          start_date: string
          text_color: string | null
          title: string
          title_font_size: string | null
          title_font_weight: string | null
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          background_image_url?: string | null
          created_at?: string | null
          display_order?: number | null
          end_date: string
          id?: string
          is_active?: boolean | null
          message: string
          message_font_size?: string | null
          message_font_weight?: string | null
          start_date?: string
          text_color?: string | null
          title: string
          title_font_size?: string | null
          title_font_weight?: string | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          background_image_url?: string | null
          created_at?: string | null
          display_order?: number | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          message?: string
          message_font_size?: string | null
          message_font_weight?: string | null
          start_date?: string
          text_color?: string | null
          title?: string
          title_font_size?: string | null
          title_font_weight?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bogo_offers: {
        Row: {
          buy_product_id: string | null
          buy_quantity: number
          buy_variant_id: string | null
          created_at: string | null
          current_uses: number | null
          description: string | null
          display_order: number | null
          end_date: string
          get_discount_percentage: number
          get_product_id: string | null
          get_quantity: number
          get_variant_id: string | null
          id: string
          is_active: boolean | null
          max_total_uses: number | null
          max_uses_per_transaction: number | null
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          buy_product_id?: string | null
          buy_quantity?: number
          buy_variant_id?: string | null
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          display_order?: number | null
          end_date: string
          get_discount_percentage?: number
          get_product_id?: string | null
          get_quantity?: number
          get_variant_id?: string | null
          id?: string
          is_active?: boolean | null
          max_total_uses?: number | null
          max_uses_per_transaction?: number | null
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          buy_product_id?: string | null
          buy_quantity?: number
          buy_variant_id?: string | null
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          display_order?: number | null
          end_date?: string
          get_discount_percentage?: number
          get_product_id?: string | null
          get_quantity?: number
          get_variant_id?: string | null
          id?: string
          is_active?: boolean | null
          max_total_uses?: number | null
          max_uses_per_transaction?: number | null
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bogo_offers_buy_product_id_fkey"
            columns: ["buy_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bogo_offers_buy_variant_id_fkey"
            columns: ["buy_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bogo_offers_get_product_id_fkey"
            columns: ["get_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bogo_offers_get_variant_id_fkey"
            columns: ["get_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          cash_difference: number | null
          cashier_id: string
          closed_at: string | null
          closing_cash: number | null
          created_at: string
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_cash: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          cash_difference?: number | null
          cashier_id: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          cash_difference?: number | null
          cashier_id?: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_offer_items: {
        Row: {
          combo_offer_id: string
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          combo_offer_id: string
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          variant_id?: string | null
        }
        Update: {
          combo_offer_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combo_offer_items_combo_offer_id_fkey"
            columns: ["combo_offer_id"]
            isOneToOne: false
            referencedRelation: "combo_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_offer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_offer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_offers: {
        Row: {
          combo_price: number
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          combo_price: number
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          combo_price?: number
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          custom_price_tier_id: string | null
          customer_ledger_account_id: string | null
          discount_percentage: number | null
          email: string | null
          id: string
          is_customer: boolean
          is_supplier: boolean
          name: string
          notes: string | null
          opening_balance: number | null
          phone: string | null
          price_tier: Database["public"]["Enums"]["price_tier"] | null
          state: string | null
          supplier_ledger_account_id: string | null
          tax_id: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          custom_price_tier_id?: string | null
          customer_ledger_account_id?: string | null
          discount_percentage?: number | null
          email?: string | null
          id?: string
          is_customer?: boolean
          is_supplier?: boolean
          name: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          price_tier?: Database["public"]["Enums"]["price_tier"] | null
          state?: string | null
          supplier_ledger_account_id?: string | null
          tax_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          custom_price_tier_id?: string | null
          customer_ledger_account_id?: string | null
          discount_percentage?: number | null
          email?: string | null
          id?: string
          is_customer?: boolean
          is_supplier?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number | null
          phone?: string | null
          price_tier?: Database["public"]["Enums"]["price_tier"] | null
          state?: string | null
          supplier_ledger_account_id?: string | null
          tax_id?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_custom_price_tier_id_fkey"
            columns: ["custom_price_tier_id"]
            isOneToOne: false
            referencedRelation: "custom_price_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_customer_ledger_account_id_fkey"
            columns: ["customer_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_supplier_ledger_account_id_fkey"
            columns: ["supplier_ledger_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_price_tiers: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_tier_prices: {
        Row: {
          created_at: string | null
          id: string
          price: number
          product_id: string
          tier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          price: number
          product_id: string
          tier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          product_id?: string
          tier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_tier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_tier_prices_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "custom_price_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_prices: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          price: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string
          receipt_url: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method: string
          receipt_url?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          receipt_url?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          products_imported: number | null
          status: string
          store_id: string | null
          url: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          products_imported?: number | null
          status: string
          store_id?: string | null
          url: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          products_imported?: number | null
          status?: string
          store_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_layers: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string | null
          purchase_item_id: string | null
          purchased_at: string
          quantity_purchased: number
          quantity_remaining: number
          unit_cost: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id?: string | null
          purchase_item_id?: string | null
          purchased_at?: string
          quantity_purchased: number
          quantity_remaining: number
          unit_cost: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string | null
          purchase_item_id?: string | null
          purchased_at?: string
          quantity_purchased?: number
          quantity_remaining?: number
          unit_cost?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_layers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_layers_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_layers_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_layers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: string
          id: string
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: string
          total_credit: number
          total_debit: number
          transaction_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          entry_number?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          transaction_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          transaction_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      multi_product_bogo_items: {
        Row: {
          created_at: string | null
          id: string
          offer_id: string | null
          product_id: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          offer_id?: string | null
          product_id?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          offer_id?: string | null
          product_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "multi_product_bogo_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "multi_product_bogo_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multi_product_bogo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multi_product_bogo_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      multi_product_bogo_offers: {
        Row: {
          created_at: string | null
          current_uses: number | null
          description: string | null
          discount_percentage: number
          display_order: number | null
          end_date: string
          id: string
          is_active: boolean | null
          max_total_uses: number | null
          max_uses_per_transaction: number | null
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percentage?: number
          display_order?: number | null
          end_date: string
          id?: string
          is_active?: boolean | null
          max_total_uses?: number | null
          max_uses_per_transaction?: number | null
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percentage?: number
          display_order?: number | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          max_total_uses?: number | null
          max_uses_per_transaction?: number | null
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percentage: number | null
          display_order: number | null
          end_date: string
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          start_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          end_date: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          start_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          end_date?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          start_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_date: string | null
          delivery_fee: number
          delivery_instructions: string | null
          delivery_time_slot: string | null
          id: string
          order_number: string
          payment_method_id: string | null
          payment_status: string | null
          status: string
          store_id: string
          stripe_payment_intent_id: string | null
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_time_slot?: string | null
          id?: string
          order_number: string
          payment_method_id?: string | null
          payment_status?: string | null
          status?: string
          store_id: string
          stripe_payment_intent_id?: string | null
          subtotal: number
          tax?: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_time_slot?: string | null
          id?: string
          order_number?: string
          payment_method_id?: string | null
          payment_status?: string | null
          status?: string
          store_id?: string
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_default: boolean | null
          label: string
          last_four: string | null
          stripe_payment_method_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          label: string
          last_four?: string | null
          stripe_payment_method_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean | null
          label?: string
          last_four?: string | null
          stripe_payment_method_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          receipt_number: string
          received_by: string | null
          reference: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          receipt_number?: string
          received_by?: string | null
          reference?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_number?: string
          received_by?: string | null
          reference?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          amount_paid: number | null
          cashier_id: string
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          items: Json
          metadata: Json | null
          notes: string | null
          payment_details: Json | null
          payment_method: string
          store_id: string
          subtotal: number
          tax: number
          total: number
          transaction_number: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          cashier_id: string
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          items?: Json
          metadata?: Json | null
          notes?: string | null
          payment_details?: Json | null
          payment_method: string
          store_id: string
          subtotal: number
          tax?: number
          total: number
          transaction_number?: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          cashier_id?: string
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          items?: Json
          metadata?: Json | null
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string
          store_id?: string
          subtotal?: number
          tax?: number
          total?: number
          transaction_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_users: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          pin_hash: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          pin_hash: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          pin_hash?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          barcode: string | null
          cost_price: number | null
          created_at: string
          id: string
          is_available: boolean | null
          is_default: boolean | null
          label: string | null
          price: number
          product_id: string
          quantity: number | null
          stock_quantity: number | null
          unit: string
          updated_at: string
          vip_price: number | null
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_available?: boolean | null
          is_default?: boolean | null
          label?: string | null
          price: number
          product_id: string
          quantity?: number | null
          stock_quantity?: number | null
          unit: string
          updated_at?: string
          vip_price?: number | null
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_available?: boolean | null
          is_default?: boolean | null
          label?: string | null
          price?: number
          product_id?: string
          quantity?: number | null
          stock_quantity?: number | null
          unit?: string
          updated_at?: string
          vip_price?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_outputs: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          production_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          production_id: string
          quantity: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          production_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_outputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_outputs_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_outputs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          production_date: string
          production_number: string
          source_product_id: string | null
          source_quantity: number
          source_variant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          production_date?: string
          production_number?: string
          source_product_id?: string | null
          source_quantity: number
          source_variant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          production_date?: string
          production_number?: string
          source_product_id?: string | null
          source_quantity?: number
          source_variant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productions_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productions_source_variant_id_fkey"
            columns: ["source_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_available: boolean | null
          is_featured: boolean | null
          name: string
          nutritional_info: Json | null
          original_price: number | null
          price: number | null
          stock_quantity: number | null
          store_id: string
          tags: string[] | null
          unit: string
          updated_at: string
          vip_price: number | null
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name: string
          nutritional_info?: Json | null
          original_price?: number | null
          price?: number | null
          stock_quantity?: number | null
          store_id: string
          tags?: string[] | null
          unit: string
          updated_at?: string
          vip_price?: number | null
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name?: string
          nutritional_info?: Json | null
          original_price?: number | null
          price?: number | null
          stock_quantity?: number | null
          store_id?: string
          tags?: string[] | null
          unit?: string
          updated_at?: string
          vip_price?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string | null
          full_name: string | null
          id: string
          language: string | null
          phone: string | null
          region: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          phone?: string | null
          region?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          phone?: string | null
          region?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          total_cost: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          total_cost: number
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_paid: number | null
          created_at: string
          id: string
          notes: string | null
          payment_details: Json | null
          payment_method: string | null
          payment_status: string
          purchase_number: string
          purchased_at: string
          purchased_by: string
          store_id: string
          supplier_contact: string | null
          supplier_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          payment_status?: string
          purchase_number?: string
          purchased_at?: string
          purchased_by: string
          store_id: string
          supplier_contact?: string | null
          supplier_name: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          payment_status?: string
          purchase_number?: string
          purchased_at?: string
          purchased_by?: string
          store_id?: string
          supplier_contact?: string | null
          supplier_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount: number
          id: string
          items: Json
          notes: string | null
          quotation_number: string
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          quotation_number: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          id?: string
          items?: Json
          notes?: string | null
          quotation_number?: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          created_at: string
          currency: string | null
          favicon_url: string | null
          id: string
          language: string | null
          logo_url: string | null
          primary_color: string | null
          region: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          currency?: string | null
          favicon_url?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          primary_color?: string | null
          region?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          currency?: string | null
          favicon_url?: string | null
          id?: string
          language?: string | null
          logo_url?: string | null
          primary_color?: string | null
          region?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          adjusted_by: string | null
          adjustment_type: string
          cogs_amount: number | null
          cost_source: string | null
          created_at: string
          id: string
          inventory_layer_id: string | null
          journal_entry_id: string | null
          product_id: string
          quantity_change: number
          reason: string | null
          store_id: string
          total_value: number | null
          unit_cost: number | null
          variant_id: string | null
        }
        Insert: {
          adjusted_by?: string | null
          adjustment_type: string
          cogs_amount?: number | null
          cost_source?: string | null
          created_at?: string
          id?: string
          inventory_layer_id?: string | null
          journal_entry_id?: string | null
          product_id: string
          quantity_change: number
          reason?: string | null
          store_id: string
          total_value?: number | null
          unit_cost?: number | null
          variant_id?: string | null
        }
        Update: {
          adjusted_by?: string | null
          adjustment_type?: string
          cogs_amount?: number | null
          cost_source?: string | null
          created_at?: string
          id?: string
          inventory_layer_id?: string | null
          journal_entry_id?: string | null
          product_id?: string
          quantity_change?: number
          reason?: string | null
          store_id?: string
          total_value?: number | null
          unit_cost?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_inventory_layer_id_fkey"
            columns: ["inventory_layer_id"]
            isOneToOne: false
            referencedRelation: "inventory_layers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          city: string
          created_at: string
          description: string | null
          hours: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          description?: string | null
          hours?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          description?: string | null
          hours?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          paid_by: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          purchase_id: string | null
          reference: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_method: string
          payment_number?: string
          purchase_id?: string | null
          reference?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_by?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: string
          purchase_id?: string | null
          reference?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_order_total: {
        Args: {
          p_delivery_fee?: number
          p_tax_rate?: number
          p_user_id: string
        }
        Returns: {
          delivery_fee: number
          subtotal: number
          tax: number
          total: number
        }[]
      }
      create_adjustment_layer: {
        Args: {
          p_adjustment_id?: string
          p_product_id: string
          p_quantity: number
          p_unit_cost: number
          p_variant_id: string
        }
        Returns: string
      }
      crypt_pin: { Args: { input_pin: string }; Returns: string }
      decrement_product_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      decrement_variant_stock: {
        Args: { p_quantity: number; p_variant_id: string }
        Returns: undefined
      }
      deduct_stock_fifo: {
        Args: { p_product_id: string; p_quantity: number; p_variant_id: string }
        Returns: {
          layer_id: string
          quantity_used: number
          total_cogs: number
          unit_cost: number
        }[]
      }
      find_similar_products: {
        Args: {
          p_search_name: string
          p_similarity_threshold?: number
          p_store_id: string
        }
        Returns: {
          id: string
          name: string
          similarity: number
        }[]
      }
      generate_order_number: { Args: never; Returns: string }
      generate_quotation_number: { Args: never; Returns: string }
      get_suggested_adjustment_cost: {
        Args: { p_product_id: string; p_variant_id?: string }
        Returns: {
          last_purchase_cost: number
          next_fifo_cost: number
          weighted_avg_cost: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reverse_transaction_journal_entries: {
        Args: { p_reference: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      verify_admin_access: { Args: { p_user_id: string }; Returns: boolean }
      verify_pin: {
        Args: { input_pin: string }
        Returns: {
          full_name: string
          pos_user_id: string
          user_id: string
        }[]
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role: "admin" | "moderator" | "user" | "cashier"
      price_tier: "retail" | "wholesale" | "vip"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: ["admin", "moderator", "user", "cashier"],
      price_tier: ["retail", "wholesale", "vip"],
    },
  },
} as const
