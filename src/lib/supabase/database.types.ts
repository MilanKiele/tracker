/**
 * Supabase schema type boundary. Keep this in sync with supabase/migrations/.
 * Run `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`
 * after applying migrations to generate exact column types for a live project.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
// Supabase generates exact row fields from the migrations for each project.
/* eslint-disable @typescript-eslint/no-explicit-any */
type TableShape = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: Record<string, TableShape>;
    Views: Record<string, never>;
    Functions: {
      activate_training_plan: {
        Args: { p_plan_id: string };
        Returns: undefined;
      };
      finish_training_session: {
        Args: { p_session_id: string; p_duration: number };
        Returns: undefined;
      };
      claim_ai_request: { Args: Record<string, never>; Returns: boolean };
      import_plan_draft: {
        Args: { p_mutation_id: string; p_plan: Json };
        Returns: Json;
      };
      import_food_draft: {
        Args: {
          p_mutation_id: string;
          p_foods: Json;
          p_date: string;
          p_slot: string;
          p_destination: string;
        };
        Returns: Json;
      };
      begin_plan_workout: { Args: { p_day_id: string }; Returns: string };
      record_training_set: {
        Args: {
          p_exercise_id: string;
          p_number: number;
          p_weight: number;
          p_reps: number;
          p_duration: number;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
