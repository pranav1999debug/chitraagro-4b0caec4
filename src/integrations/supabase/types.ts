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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          advance_amount: number
          created_at: string
          date_key: string
          farm_id: string
          id: string
          present: boolean
          staff_id: string
        }
        Insert: {
          advance_amount?: number
          created_at?: string
          date_key: string
          farm_id: string
          id?: string
          present?: boolean
          staff_id: string
        }
        Update: {
          advance_amount?: number
          created_at?: string
          date_key?: string
          farm_id?: string
          id?: string
          present?: boolean
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          default_qty_evening: number
          default_qty_morning: number
          farm_id: string
          id: string
          is_active: boolean
          milk_type: string
          name: string
          opening_balance: number
          phone: string | null
          purchase_rate: number
          time_group: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          default_qty_evening?: number
          default_qty_morning?: number
          farm_id: string
          id?: string
          is_active?: boolean
          milk_type?: string
          name: string
          opening_balance?: number
          phone?: string | null
          purchase_rate?: number
          time_group?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          default_qty_evening?: number
          default_qty_morning?: number
          farm_id?: string
          id?: string
          is_active?: boolean
          milk_type?: string
          name?: string
          opening_balance?: number
          phone?: string | null
          purchase_rate?: number
          time_group?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date_key: string
          farm_id: string
          id: string
          notes: string | null
          sub_category: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          date_key: string
          farm_id: string
          id?: string
          notes?: string | null
          sub_category?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date_key?: string
          farm_id?: string
          id?: string
          notes?: string | null
          sub_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          farm_id: string
          id: string
          invite_code: string
          max_uses: number | null
          role: Database["public"]["Enums"]["app_role"]
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          farm_id: string
          id?: string
          invite_code?: string
          max_uses?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          farm_id?: string
          id?: string
          invite_code?: string
          max_uses?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "farm_invites_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_members: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_members_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          date_key: string
          farm_id: string
          id: string
          notes: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id: string
          date_key: string
          farm_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          date_key?: string
          farm_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      procurement: {
        Row: {
          created_at: string
          date_key: string
          farm_id: string
          id: string
          quantity: number
          rate: number
          supplier_id: string | null
          supplier_name: string
          total: number
        }
        Insert: {
          created_at?: string
          date_key: string
          farm_id: string
          id?: string
          quantity?: number
          rate?: number
          supplier_id?: string | null
          supplier_name: string
          total?: number
        }
        Update: {
          created_at?: string
          date_key?: string
          farm_id?: string
          id?: string
          quantity?: number
          rate?: number
          supplier_id?: string | null
          supplier_name?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "procurement_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procurement_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_farm_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_farm_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_farm_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_farm_id_fkey"
            columns: ["active_farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          advance: number
          created_at: string
          email: string | null
          farm_id: string
          id: string
          join_date: string | null
          name: string
          phone: string | null
          position: string | null
          salary: number
          updated_at: string
        }
        Insert: {
          advance?: number
          created_at?: string
          email?: string | null
          farm_id: string
          id?: string
          join_date?: string | null
          name: string
          phone?: string | null
          position?: string | null
          salary?: number
          updated_at?: string
        }
        Update: {
          advance?: number
          created_at?: string
          email?: string | null
          farm_id?: string
          id?: string
          join_date?: string | null
          name?: string
          phone?: string | null
          position?: string | null
          salary?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          default_qty: number
          default_rate: number
          farm_id: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_qty?: number
          default_rate?: number
          farm_id: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_qty?: number
          default_rate?: number
          farm_id?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          customer_id: string
          date_key: string
          farm_id: string
          id: string
          mila: number
          price: number
          quantity: number
          time_group: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          date_key: string
          farm_id: string
          id?: string
          mila?: number
          price?: number
          quantity?: number
          time_group: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          date_key?: string
          farm_id?: string
          id?: string
          mila?: number
          price?: number
          quantity?: number
          time_group?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_farm_role: {
        Args: { _farm_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_farm_role: {
        Args: {
          _farm_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_farm_member: {
        Args: { _farm_id: string; _user_id: string }
        Returns: boolean
      }
      join_farm_by_invite: { Args: { _invite_code: string }; Returns: Json }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff"
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
      app_role: ["owner", "manager", "staff"],
    },
  },
} as const
