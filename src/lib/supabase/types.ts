// Hand-written to match supabase/migrations/0001_init.sql and 0002_storage.sql.
// Once the Supabase project is live, regenerate the source of truth with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
// and reconcile any drift against this file.

export type Role = "owner" | "employee";
export type MachineType = "washer" | "dryer";
export type PhotoKind =
  | "deposit_slip"
  | "coin_collection_sheet"
  | "coin_balance_sheet"
  | "other";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Role;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: Role;
          active?: boolean;
        };
        Update: Partial<{
          full_name: string;
          role: Role;
          active: boolean;
        }>;
        Relationships: [];
      };
      locations: {
        Row: { id: string; name: string; created_at: string };
        Insert: { name: string };
        Update: Partial<{ name: string }>;
        Relationships: [];
      };
      machine_groups: {
        Row: {
          id: string;
          location_id: string;
          name: string;
          type: MachineType;
          qty: number;
          price: number;
          store_numbers: string | null;
          display_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          location_id: string;
          name: string;
          type: MachineType;
          qty: number;
          price: number;
          store_numbers?: string | null;
          display_order?: number;
          active?: boolean;
        };
        Update: Partial<{
          name: string;
          qty: number;
          price: number;
          store_numbers: string | null;
          display_order: number;
          active: boolean;
        }>;
        Relationships: [];
      };
      collection_entries: {
        Row: {
          id: string;
          location_id: string;
          employee_id: string;
          date: string;
          days_since_last: number;
          total_income: number | null;
          avg_turns: number | null;
          income_per_day: number | null;
          created_at: string;
          edited_at: string | null;
        };
        Insert: {
          location_id: string;
          employee_id: string;
          date: string;
          days_since_last: number;
        };
        Update: Partial<{
          date: string;
          days_since_last: number;
          edited_at: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "collection_entries_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      entry_group_snapshots: {
        Row: {
          id: string;
          entry_id: string;
          machine_group_id: string;
          qty_at_time: number;
          price_at_time: number;
          quarters_collected: number;
          dollars: number | null;
          turns: number | null;
        };
        Insert: {
          entry_id: string;
          machine_group_id: string;
          qty_at_time: number;
          price_at_time: number;
          quarters_collected?: number;
        };
        Update: Partial<{ quarters_collected: number }>;
        Relationships: [
          {
            foreignKeyName: "entry_group_snapshots_machine_group_id_fkey";
            columns: ["machine_group_id"];
            isOneToOne: false;
            referencedRelation: "machine_groups";
            referencedColumns: ["id"];
          }
        ];
      };
      vending_machines: {
        Row: {
          id: string;
          location_id: string;
          name: string;
          display_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          location_id: string;
          name: string;
          display_order?: number;
          active?: boolean;
        };
        Update: Partial<{ name: string; display_order: number; active: boolean }>;
        Relationships: [];
      };
      vending_totals: {
        Row: {
          id: string;
          entry_id: string;
          vending_machine_id: string;
          cash_collected: number;
          coins_collected: number;
        };
        Insert: {
          entry_id: string;
          vending_machine_id: string;
          cash_collected?: number;
          coins_collected?: number;
        };
        Update: Partial<{ cash_collected: number; coins_collected: number }>;
        Relationships: [
          {
            foreignKeyName: "vending_totals_vending_machine_id_fkey";
            columns: ["vending_machine_id"];
            isOneToOne: false;
            referencedRelation: "vending_machines";
            referencedColumns: ["id"];
          }
        ];
      };
      deposits: {
        Row: {
          entry_id: string;
          deposit_amount: number;
          deposit_slip_photo_path: string | null;
        };
        Insert: {
          entry_id: string;
          deposit_amount: number;
          deposit_slip_photo_path?: string | null;
        };
        Update: Partial<{
          deposit_amount: number;
          deposit_slip_photo_path: string | null;
        }>;
        Relationships: [];
      };
      checklist_completions: {
        Row: {
          entry_id: string;
          checked_items: string[];
          signed_by: string;
          signed_date: string;
        };
        Insert: {
          entry_id: string;
          checked_items: string[];
          signed_by: string;
          signed_date: string;
        };
        Update: Partial<{
          checked_items: string[];
          signed_by: string;
          signed_date: string;
        }>;
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          entry_id: string;
          storage_path: string;
          kind: PhotoKind;
          uploaded_at: string;
        };
        Insert: {
          entry_id: string;
          storage_path: string;
          kind: PhotoKind;
        };
        Update: Partial<{ kind: PhotoKind }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_owner: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      entries_pending_deposit: {
        Args: Record<string, never>;
        Returns: { id: string; date: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
