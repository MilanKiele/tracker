export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: { Tables: {
    profiles: { Row: { id: string; full_name: string | null; sex: string | null; birth_date: string | null; height_cm: number | null; weight_kg: number | null; activity_level: string; goal: string; unit_system: string; created_at: string; updated_at: string }; Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string }; Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]> };
    exercises: { Row: { id: string; user_id: string; name: string; muscle_group: string; equipment: string; notes: string | null; archived_at: string | null; created_at: string }; Insert: Partial<Database["public"]["Tables"]["exercises"]["Row"]> & { user_id: string; name: string; muscle_group: string; equipment: string }; Update: Partial<Database["public"]["Tables"]["exercises"]["Row"]> };
  }; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> };
};
