export interface Player {
  id: string;
  room_id: string;
  name: string;
  avatar: string;
  is_host: boolean;
  total_score: number;
  joined_at: string;
  last_seen: string;
  device_id?: string;
  write_token?: string;
}

export interface Room {
  id: string;
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  max_players: number;
  win_target: number;
  current_round: number;
  family_safe_only: boolean;
  created_at: string;
}

export interface Topic {
  id: number;
  category: string;
  topic: string;
  word1: string;
  word2: string;
  word3: string;
  word4: string;
  word5: string;
  word6: string;
  word7: string;
  word8: string;
  family_safe: boolean;
}

export interface Round {
  id: string;
  room_id: string;
  round_number: number;
  topic_id: number;
  secret_word_index: number;
  phase: 'role_reveal' | 'clue' | 'reveal_clues' | 'vote' | 'reveal' | 'done';
  imposter_id: string;
  imposter_guess_index?: number;
  imposter_caught?: boolean;
  started_at: string;
  phase_deadline?: string;
}

export interface Clue {
  id: number;
  round_id: string;
  player_id: string;
  word: string;
  submitted_at: string;
}

export interface Vote {
  id: number;
  round_id: string;
  voter_id: string;
  target_id: string;
  created_at: string;
}

export interface GameState {
  room?: Room;
  players: Player[];
  currentPlayer?: Player;
  currentRound?: Round;
  topic?: Topic;
  clues: Clue[];
  votes: Vote[];
}