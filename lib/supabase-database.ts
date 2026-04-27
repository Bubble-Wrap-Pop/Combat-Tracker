export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          game_master_id: string;
          campaign_id: string | null;
          name: string;
          combat_status: string;
          current_round: number;
          current_turn_index: number;
          is_active: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_master_id: string;
          campaign_id?: string | null;
          name: string;
          combat_status?: string;
          current_round?: number;
          current_turn_index?: number;
          is_active?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_master_id?: string;
          campaign_id?: string | null;
          name?: string;
          combat_status?: string;
          current_round?: number;
          current_turn_index?: number;
          is_active?: boolean | null;
          created_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          game_master_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_master_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_master_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      combatants: {
        Row: {
          id: string;
          session_id: string;
          name: string;
          initiative: number | null;
          hp_current: number;
          hp_max: number;
          temp_hp: number;
          armor_class: number;
          ac_visible_to_players: boolean;
          is_player: boolean | null;
          owner_player_id: string | null;
          auto_delete_exempt: boolean;
          resources: Json | null;
          conditions: Json | null;
          revealed_traits: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          name: string;
          initiative?: number | null;
          hp_current: number;
          hp_max: number;
          temp_hp?: number;
          armor_class: number;
          ac_visible_to_players?: boolean;
          is_player?: boolean | null;
          owner_player_id?: string | null;
          auto_delete_exempt?: boolean;
          resources?: Json | null;
          conditions?: Json | null;
          revealed_traits?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          name?: string;
          initiative?: number | null;
          hp_current?: number;
          hp_max?: number;
          temp_hp?: number;
          armor_class?: number;
          ac_visible_to_players?: boolean;
          is_player?: boolean | null;
          owner_player_id?: string | null;
          auto_delete_exempt?: boolean;
          resources?: Json | null;
          conditions?: Json | null;
          revealed_traits?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      session_players: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
