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
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          target: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          domain: string | null
          fb_ad_account_id: string | null
          google_ads_id: string | null
          id: string
          is_active: boolean
          meta_pixel_id: string | null
          name: string
          tiktok_pixel_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          fb_ad_account_id?: string | null
          google_ads_id?: string | null
          id?: string
          is_active?: boolean
          meta_pixel_id?: string | null
          name: string
          tiktok_pixel_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          fb_ad_account_id?: string | null
          google_ads_id?: string | null
          id?: string
          is_active?: boolean
          meta_pixel_id?: string | null
          name?: string
          tiktok_pixel_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      capi_events_log: {
        Row: {
          campaign_id: string | null
          created_at: string
          event_id: string
          event_name: string
          id: string
          payload: Json | null
          response: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          event_id: string
          event_name: string
          id?: string
          payload?: Json | null
          response?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          event_id?: string
          event_name?: string
          id?: string
          payload?: Json | null
          response?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capi_events_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_clicks: {
        Row: {
          button_id: string | null
          button_text: string | null
          campaign_id: string | null
          converted: boolean | null
          created_at: string
          id: string
          lead_id: string | null
          page_id: string | null
          page_url: string | null
        }
        Insert: {
          button_id?: string | null
          button_text?: string | null
          campaign_id?: string | null
          converted?: boolean | null
          created_at?: string
          id?: string
          lead_id?: string | null
          page_id?: string | null
          page_url?: string | null
        }
        Update: {
          button_id?: string | null
          button_text?: string | null
          campaign_id?: string | null
          converted?: boolean | null
          created_at?: string
          id?: string
          lead_id?: string | null
          page_id?: string | null
          page_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cta_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cta_clicks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_clicks"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_flags: {
        Row: {
          created_at: string
          id: string
          is_hot: boolean
          lead_id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hot?: boolean
          lead_id: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hot?: boolean
          lead_id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads_clicks: {
        Row: {
          campaign_id: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          fbc: string | null
          fbp: string | null
          fingerprint: string | null
          id: string
          ip_address: string | null
          lead_score: number | null
          name: string | null
          page_id: string | null
          page_url: string | null
          phone: string | null
          referrer: string | null
          state: string | null
          time_on_page: number | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zip_code: string | null
        }
        Insert: {
          campaign_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          fbc?: string | null
          fbp?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          lead_score?: number | null
          name?: string | null
          page_id?: string | null
          page_url?: string | null
          phone?: string | null
          referrer?: string | null
          state?: string | null
          time_on_page?: number | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zip_code?: string | null
        }
        Update: {
          campaign_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          fbc?: string | null
          fbp?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          lead_score?: number | null
          name?: string | null
          page_id?: string | null
          page_url?: string | null
          phone?: string | null
          referrer?: string | null
          state?: string | null
          time_on_page?: number | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          created_at: string
          daily_summary: boolean
          id: string
          push_milestones: boolean
          push_refunds: boolean
          push_sales: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_summary?: boolean
          id?: string
          push_milestones?: boolean
          push_refunds?: boolean
          push_sales?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_summary?: boolean
          id?: string
          push_milestones?: boolean
          push_refunds?: boolean
          push_sales?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          body: string
          id: string
          sale_id: string | null
          sent_at: string
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          id?: string
          sale_id?: string | null
          sent_at?: string
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          id?: string
          sale_id?: string | null
          sent_at?: string
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          name: string
          url: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          name: string
          url: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          name?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          fb_ad_account_id: string | null
          full_name: string | null
          id: string
          meta_pixel_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          fb_ad_account_id?: string | null
          full_name?: string | null
          id?: string
          meta_pixel_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          fb_ad_account_id?: string | null
          full_name?: string | null
          id?: string
          meta_pixel_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount_mzn: number | null
          approved_at: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          campaign_id: string | null
          created_at: string
          exchange_rate: number | null
          first_seen_at: string | null
          hotmart_event: string | null
          hotmart_payload: Json | null
          id: string
          last_webhook_at: string | null
          lead_id: string | null
          original_amount: number
          original_currency: string
          platform: string
          product_name: string | null
          sale_date: string | null
          status: string
          status_updated_at: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_mzn?: number | null
          approved_at?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          campaign_id?: string | null
          created_at?: string
          exchange_rate?: number | null
          first_seen_at?: string | null
          hotmart_event?: string | null
          hotmart_payload?: Json | null
          id?: string
          last_webhook_at?: string | null
          lead_id?: string | null
          original_amount: number
          original_currency?: string
          platform?: string
          product_name?: string | null
          sale_date?: string | null
          status?: string
          status_updated_at?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_mzn?: number | null
          approved_at?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          campaign_id?: string | null
          created_at?: string
          exchange_rate?: number | null
          first_seen_at?: string | null
          hotmart_event?: string | null
          hotmart_payload?: Json | null
          id?: string
          last_webhook_at?: string | null
          lead_id?: string | null
          original_amount?: number
          original_currency?: string
          platform?: string
          product_name?: string | null
          sale_date?: string | null
          status?: string
          status_updated_at?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_clicks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_secrets: {
        Row: {
          created_at: string
          id: string
          kind: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_secret: { Args: { _kind: string }; Returns: boolean }
      hotmart_to_timestamptz: { Args: { value: string }; Returns: string }
      list_my_secret_kinds: {
        Args: never
        Returns: {
          is_set: boolean
          kind: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
