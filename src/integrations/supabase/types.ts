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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      countries: {
        Row: {
          code: string
          created_at: string
          flag_emoji: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          flag_emoji?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          flag_emoji?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      coupon_usages: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_amount: number
          discount_type: string
          expiration_date: string | null
          id: string
          is_active: boolean
          per_user_limit: number
          times_used: number
          total_usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_amount?: number
          discount_type?: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          per_user_limit?: number
          times_used?: number
          total_usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_amount?: number
          discount_type?: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          per_user_limit?: number
          times_used?: number
          total_usage_limit?: number | null
        }
        Relationships: []
      }
      credit_grants: {
        Row: {
          created_at: string
          credits: number
          expires_at: string | null
          granted_by: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          expires_at?: string | null
          granted_by: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          expires_at?: string | null
          granted_by?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      interview_reports: {
        Row: {
          confidence_score: number | null
          created_at: string
          detailed_feedback: Json | null
          english_score: number | null
          financial_clarity_score: number | null
          grammar_mistakes: Json | null
          id: string
          immigration_intent_score: number | null
          improvement_plan: Json | null
          interview_id: string
          overall_score: number | null
          pronunciation_score: number | null
          red_flags: Json | null
          response_relevance_score: number | null
          summary: string | null
          vocabulary_score: number | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          detailed_feedback?: Json | null
          english_score?: number | null
          financial_clarity_score?: number | null
          grammar_mistakes?: Json | null
          id?: string
          immigration_intent_score?: number | null
          improvement_plan?: Json | null
          interview_id: string
          overall_score?: number | null
          pronunciation_score?: number | null
          red_flags?: Json | null
          response_relevance_score?: number | null
          summary?: string | null
          vocabulary_score?: number | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          detailed_feedback?: Json | null
          english_score?: number | null
          financial_clarity_score?: number | null
          grammar_mistakes?: Json | null
          id?: string
          immigration_intent_score?: number | null
          improvement_plan?: Json | null
          interview_id?: string
          overall_score?: number | null
          pronunciation_score?: number | null
          red_flags?: Json | null
          response_relevance_score?: number | null
          summary?: string | null
          vocabulary_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_reports_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: true
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          cost: number | null
          country_id: string
          created_at: string
          duration: number | null
          ended_at: string | null
          id: string
          is_public: boolean
          messages: Json | null
          name: string | null
          recording_url: string | null
          status: string
          transcript: string | null
          user_id: string
          vapi_call_id: string | null
          visa_type_id: string
        }
        Insert: {
          cost?: number | null
          country_id: string
          created_at?: string
          duration?: number | null
          ended_at?: string | null
          id?: string
          is_public?: boolean
          messages?: Json | null
          name?: string | null
          recording_url?: string | null
          status?: string
          transcript?: string | null
          user_id: string
          vapi_call_id?: string | null
          visa_type_id: string
        }
        Update: {
          cost?: number | null
          country_id?: string
          created_at?: string
          duration?: number | null
          ended_at?: string | null
          id?: string
          is_public?: boolean
          messages?: Json | null
          name?: string | null
          recording_url?: string | null
          status?: string
          transcript?: string | null
          user_id?: string
          vapi_call_id?: string | null
          visa_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "interviews_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          credits: number
          currency: string
          id: string
          plan_name: string
          session_key: string | null
          status: string
          tran_id: string
          user_id: string
          val_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          credits: number
          currency?: string
          id?: string
          plan_name: string
          session_key?: string | null
          status?: string
          tran_id: string
          user_id: string
          val_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          plan_name?: string
          session_key?: string | null
          status?: string
          tran_id?: string
          user_id?: string
          val_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits: number
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          credits_awarded: boolean
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          referred_user_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          credits_awarded?: boolean
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          referred_user_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          credits_awarded?: boolean
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          referred_user_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      visa_types: {
        Row: {
          country_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          vapi_assistant_id: string | null
          vapi_private_key: string | null
          vapi_public_key: string | null
        }
        Insert: {
          country_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          vapi_assistant_id?: string | null
          vapi_private_key?: string | null
          vapi_public_key?: string | null
        }
        Update: {
          country_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          vapi_assistant_id?: string | null
          vapi_private_key?: string | null
          vapi_public_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_types_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
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
      process_referral: {
        Args: {
          _device_fingerprint: string
          _ip_address: string
          _referral_code: string
          _referred_user_id: string
        }
        Returns: Json
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
      app_role: ["admin", "user"],
    },
  },
} as const
