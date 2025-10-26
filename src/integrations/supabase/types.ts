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
      pos_transactions: {
        Row: {
          cashier_id: string
          created_at: string
          discount: number
          id: string
          items: Json
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
          cashier_id: string
          created_at?: string
          discount?: number
          id?: string
          items?: Json
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
          cashier_id?: string
          created_at?: string
          discount?: number
          id?: string
          items?: Json
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
            foreignKeyName: "pos_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
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
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
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
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
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
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_admin_access: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "cashier"
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
      app_role: ["admin", "moderator", "user", "cashier"],
    },
  },
} as const
