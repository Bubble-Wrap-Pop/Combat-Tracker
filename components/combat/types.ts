export type CombatSession = {
  id: string;
  game_master_id: string;
  name: string;
  current_round: number;
  current_turn_index: number;
  combat_status: string;
  is_active: boolean | null;
  created_at: string;
};

export type Combatant = {
  id: string;
  session_id: string;
  name: string;
  initiative: number | null;
  hp_current: number;
  hp_max: number;
  temp_hp: number;
  armor_class: number;
  is_player: boolean | null;
  auto_delete_exempt: boolean;
  resources: unknown;
  conditions: unknown;
  revealed_traits: unknown;
  created_at: string;
};
