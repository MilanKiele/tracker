/**
 * Supabase schema type boundary. Keep this in sync with supabase/migrations/.
 * Run `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`
 * after applying migrations to generate exact column types for a live project.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
// Supabase generates exact row fields from the migrations for each project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TableShape = { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any>; Relationships: [] };
export type Database = {
  public: { Tables: Record<string, TableShape>; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> };
};
