import { supabase } from './supabase';

export interface GameState {
  id: string;
  room_id: string;
  current_phase: 'role' | 'clue' | 'voting' | 'results';
  is_active: boolean;
  topic: {
    category: string;
    words: string[];
    secret_word: string;
    impostor_hint: string;
  };
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    role: 'detective' | 'imposter';
  }>;
  clues: { [playerId: string]: string };
  votes: { [playerId: string]: string };
  imposter_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Safely fetch the current active game state for a room
 * Uses .maybeSingle() to avoid throwing on no results
 * Returns null if no active game state exists
 */
export async function getActiveGameState(roomId: string): Promise<GameState | null> {
  try {
    const { data, error } = await supabase
      .from('game_states')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - this is expected when no game exists
        return null;
      }
      console.error('Error fetching game state:', error);
      throw new Error(`Failed to fetch game state: ${error.message}`);
    }

    return data as GameState | null;
  } catch (error) {
    console.error('Exception in getActiveGameState:', error);
    throw error;
  }
}

/**
 * Create a new game state, automatically deactivating any existing ones
 * Uses the database function for atomic upsert behavior
 */
export async function createGameState(
  roomId: string,
  gameData: {
    current_phase: string;
    topic: any;
    players: any[];
    imposter_id: string;
  }
): Promise<GameState> {
  try {
    const { data, error } = await supabase.rpc('upsert_game_state', {
      p_room_id: roomId,
      p_current_phase: gameData.current_phase,
      p_topic: gameData.topic,
      p_players: gameData.players,
      p_clues: {},
      p_votes: {},
      p_imposter_id: gameData.imposter_id
    });

    if (error) {
      console.error('Error creating game state:', error);
      throw new Error(`Failed to create game state: ${error.message}`);
    }

    return data as GameState;
  } catch (error) {
    console.error('Exception in createGameState:', error);
    throw error;
  }
}

/**
 * Update an existing active game state
 * Only updates if the game is still active
 */
export async function updateGameState(
  roomId: string,
  updates: Partial<Omit<GameState, 'id' | 'room_id' | 'created_at' | 'updated_at'>>
): Promise<GameState | null> {
  try {
    const { data, error } = await supabase
      .from('game_states')
      .update(updates)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .select()
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error updating game state:', error);
      throw new Error(`Failed to update game state: ${error.message}`);
    }

    return data as GameState | null;
  } catch (error) {
    console.error('Exception in updateGameState:', error);
    throw error;
  }
}

/**
 * Deactivate the current game state for a room
 * Used when ending a game or starting a new one
 */
export async function deactivateGameState(roomId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('game_states')
      .update({ is_active: false })
      .eq('room_id', roomId)
      .eq('is_active', true);

    if (error) {
      console.error('Error deactivating game state:', error);
      throw new Error(`Failed to deactivate game state: ${error.message}`);
    }
  } catch (error) {
    console.error('Exception in deactivateGameState:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes for a room's game state
 * Returns a cleanup function to unsubscribe
 */
export function subscribeToGameStateChanges(
  roomId: string,
  callback: (gameState: GameState | null) => void
): () => void {
  console.log('Setting up game state subscription for room:', roomId);

  const channel = supabase
    .channel(`game-state-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_states',
        filter: `room_id=eq.${roomId}`
      },
      async (payload) => {
        console.log('Game state change detected:', payload);
        
        // Fetch the latest active game state
        try {
          const gameState = await getActiveGameState(roomId);
          callback(gameState);
        } catch (error) {
          console.error('Error fetching updated game state:', error);
        }
      }
    )
    .subscribe((status) => {
      console.log('Game state subscription status:', status);
    });

  // Return cleanup function
  return () => {
    console.log('Cleaning up game state subscription for room:', roomId);
    supabase.removeChannel(channel);
  };
}

/**
 * Validate that a 406 error is just "no game state yet"
 * Returns true if it's a safe 406, false if it's a real error
 */
export function is406NoGameState(error: any): boolean {
  if (!error) return false;
  
  // Check for Supabase "no rows" error
  if (error.code === 'PGRST116') return true;
  
  // Check for HTTP 406 in the error message or status
  if (error.status === 406 || error.statusCode === 406) return true;
  if (error.message && error.message.includes('406')) return true;
  
  return false;
}

/**
 * Get all players in a room (helper for game initialization)
 */
export async function getRoomPlayers(roomId: string) {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at');

    if (error) {
      console.error('Error fetching room players:', error);
      throw new Error(`Failed to fetch players: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getRoomPlayers:', error);
    throw error;
  }
}