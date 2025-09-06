import { supabase } from './supabase';

/**
 * Game State Integration Functions
 * These functions provide the specific interface mentioned in Phase 2 requirements
 * and wire Supabase helpers into the existing game state machine.
 */

export interface GamePhase {
  phase: 'role_reveal' | 'clue' | 'reveal_clues' | 'vote' | 'imposter_guess' | 'reveal' | 'done';
  roundId: string;
  roomId: string;
}

export interface Prompt {
  id: number;
  prompt: string;
  category: string;
  is_secret?: boolean;
}

export interface Answer {
  player_id: string;
  player_name: string;
  player_avatar: string;
  prompt_id: number;
  prompt_text: string;
  prompt_order: number;
  answer_text: string;
  submitted_at: string;
}

export interface Vote {
  voter_id: string;
  voter_name: string;
  target_id: string;
  target_name: string;
  created_at: string;
}

export interface ScoreUpdate {
  imposter_caught: boolean;
  imposter_score: number;
  crew_score: number;
  game_winner_id?: string;
}

/**
 * StartRound - Get random prompts (3-5) and assign imposter
 * Replaces local/mock data with real Supabase calls
 */
export async function startRound(
  roomId: string, 
  writeToken: string, 
  promptCount: number = 4
): Promise<{ prompts: Prompt[]; selectedPromptId: number; imposterId: string; roundId: string }> {
  try {
    const { data, error } = await supabase.rpc('start_round_text_prompts', {
      p_room_id: roomId,
      p_write_token: writeToken,
      p_prompt_count: promptCount
    });

    if (error) {
      console.error('Error starting round:', error);
      throw new Error(`Failed to start round: ${error.message}`);
    }

    return {
      prompts: data.prompts || [],
      selectedPromptId: data.selected_prompt_id,
      imposterId: data.imposter_id,
      roundId: data.round_id
    };
  } catch (error) {
    console.error('Exception in startRound:', error);
    throw error;
  }
}

/**
 * AnswerPhase - Save answers for all prompts
 * Replaces local/mock data with real Supabase calls
 */
export async function saveAnswers(
  roundId: string,
  playerId: string,
  answers: Array<{ prompt_order: number; answer_text: string }>,
  writeToken: string
): Promise<{ success: boolean; submitted_count: number }> {
  try {
    const { data, error } = await supabase.rpc('saveAnswers', {
      p_round_id: roundId,
      p_player_id: playerId,
      p_answers: JSON.stringify(answers),
      p_write_token: writeToken
    });

    if (error) {
      console.error('Error saving answers:', error);
      throw new Error(`Failed to save answers: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Exception in saveAnswers:', error);
    throw error;
  }
}

/**
 * RevealPhase - Get answers and display grid
 * Replaces local/mock data with real Supabase calls
 */
export async function getAnswers(roundId: string): Promise<Answer[]> {
  try {
    const { data, error } = await supabase.rpc('getAnswers', {
      p_round_id: roundId
    });

    if (error) {
      console.error('Error getting answers:', error);
      throw new Error(`Failed to get answers: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getAnswers:', error);
    throw error;
  }
}

/**
 * VotePhase - Submit a vote
 * Replaces local/mock data with real Supabase calls
 */
export async function submitVote(
  roundId: string,
  voterId: string,
  targetId: string,
  writeToken: string
): Promise<{ success: boolean }> {
  try {
    const { data, error } = await supabase.rpc('submitVote', {
      p_round_id: roundId,
      p_voter_id: voterId,
      p_target_id: targetId,
      p_write_token: writeToken
    });

    if (error) {
      console.error('Error submitting vote:', error);
      throw new Error(`Failed to submit vote: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Exception in submitVote:', error);
    throw error;
  }
}

/**
 * Results - Get votes and update scores
 * Replaces local/mock data with real Supabase calls
 */
export async function getVotes(roundId: string): Promise<Vote[]> {
  try {
    const { data, error } = await supabase.rpc('getVotes', {
      p_round_id: roundId
    });

    if (error) {
      console.error('Error getting votes:', error);
      throw new Error(`Failed to get votes: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getVotes:', error);
    throw error;
  }
}

/**
 * Results - Update scores after round completion
 * Replaces local/mock data with real Supabase calls
 */
export async function updateScores(
  roundId: string,
  imposterGuessIndex: number,
  writeToken: string
): Promise<ScoreUpdate> {
  try {
    const { data, error } = await supabase.rpc('updateScores', {
      p_round_id: roundId,
      p_imposter_guess_index: imposterGuessIndex,
      p_write_token: writeToken
    });

    if (error) {
      console.error('Error updating scores:', error);
      throw new Error(`Failed to update scores: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Exception in updateScores:', error);
    throw error;
  }
}

/**
 * Get random prompts (3-5) for a round
 * This is a helper function that can be used independently
 */
export async function getRandomPrompts(
  roomId: string,
  count: number = 4
): Promise<{ prompts: Prompt[]; selectedPromptId: number }> {
  try {
    const { data, error } = await supabase.rpc('getRandomPrompts', {
      p_room_id: roomId,
      p_count: count
    });

    if (error) {
      console.error('Error getting random prompts:', error);
      throw new Error(`Failed to get random prompts: ${error.message}`);
    }

    return {
      prompts: data.prompts || [],
      selectedPromptId: data.selected_prompt_id
    };
  } catch (error) {
    console.error('Exception in getRandomPrompts:', error);
    throw error;
  }
}
