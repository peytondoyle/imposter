import { createClient } from '@supabase/supabase-js';
import type { Prompt, Answer, Vote } from '../types/game';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetches N random prompts from the database
 * @param count - Number of prompts to fetch
 * @returns Array of prompts
 */
export async function getRandomPrompts(count: number): Promise<Prompt[]> {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('random()')
      .limit(count);

    if (error) {
      console.error('Error fetching random prompts:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch random prompts:', error);
    throw error;
  }
}

/**
 * Saves answers for a round in batch
 * @param roundId - ID of the round
 * @param playerId - ID of the player
 * @param answers - Array of answers with prompt_id and answer_text
 * @returns Success status
 */
export async function saveAnswers(
  roundId: string, 
  playerId: string, 
  answers: Array<{ prompt_id: number; answer_text: string }>
): Promise<boolean> {
  try {
    // Prepare answers for batch insert
    const answersToInsert = answers.map(answer => ({
      round_id: roundId,
      player_id: playerId,
      prompt_id: answer.prompt_id,
      answer: answer.answer_text
    }));

    const { error } = await supabase
      .from('answers')
      .insert(answersToInsert);

    if (error) {
      console.error('Error saving answers:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to save answers:', error);
    throw error;
  }
}

/**
 * Fetches all answers for a round (for reveal phase)
 * @param roundId - ID of the round
 * @returns Array of answers with player and prompt information
 */
export async function getAnswers(roundId: string): Promise<Answer[]> {
  try {
    const { data, error } = await supabase
      .from('answers')
      .select(`
        id,
        round_id,
        player_id,
        prompt_id,
        answer_text: answer,
        submitted_at: created_at,
        players!inner(name, avatar)
      `)
      .eq('round_id', roundId)
      .order('created_at');

    if (error) {
      console.error('Error fetching answers:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch answers:', error);
    throw error;
  }
}

/**
 * Submits a vote for a suspect
 * @param roundId - ID of the round
 * @param voterId - ID of the voter
 * @param suspectId - ID of the suspected player
 * @returns Success status
 */
export async function submitVote(
  roundId: string, 
  voterId: string, 
  suspectId: string
): Promise<boolean> {
  try {
    // First, check if this voter has already voted in this round
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('round_id', roundId)
      .eq('voter_id', voterId)
      .single();

    if (existingVote) {
      // Update existing vote
      const { error } = await supabase
        .from('votes')
        .update({ suspect_id: suspectId })
        .eq('id', existingVote.id);

      if (error) {
        console.error('Error updating vote:', error);
        throw error;
      }
    } else {
      // Insert new vote
      const { error } = await supabase
        .from('votes')
        .insert({
          round_id: roundId,
          voter_id: voterId,
          suspect_id: suspectId
        });

      if (error) {
        console.error('Error submitting vote:', error);
        throw error;
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to submit vote:', error);
    throw error;
  }
}

/**
 * Fetches all votes for a round
 * @param roundId - ID of the round
 * @returns Array of votes with voter and suspect information
 */
export async function getVotes(roundId: string): Promise<Vote[]> {
  try {
    const { data, error } = await supabase
      .from('votes')
      .select(`
        id,
        round_id,
        voter_id,
        target_id: suspect_id,
        created_at,
        voters:players!votes_voter_id_fkey(name, avatar),
        suspects:players!votes_suspect_id_fkey(name, avatar)
      `)
      .eq('round_id', roundId)
      .order('created_at');

    if (error) {
      console.error('Error fetching votes:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch votes:', error);
    throw error;
  }
}

/**
 * Updates scores based on voting results
 * @param roundId - ID of the round
 * @returns Success status
 */
export async function updateScores(roundId: string): Promise<boolean> {
  try {
    // Get round information including imposter
    const { data: roundData, error: roundError } = await supabase
      .from('rounds')
      .select('imposter_id')
      .eq('id', roundId)
      .single();

    if (roundError) {
      console.error('Error fetching round data:', roundError);
      throw roundError;
    }

    if (!roundData) {
      throw new Error('Round not found');
    }

    // Get all votes for this round
    const votes = await getVotes(roundId);
    
    // Get all players in the round
    const { data: answersData, error: answersError } = await supabase
      .from('answers')
      .select('player_id')
      .eq('round_id', roundId);

    if (answersError) {
      console.error('Error fetching players from answers:', answersError);
      throw answersError;
    }

    const playerIds = [...new Set(answersData?.map(a => a.player_id) || [])];
    const imposterId = roundData.imposter_id;

    // Calculate scores
    const scoreUpdates: Array<{ player_id: string; points: number }> = [];

    for (const playerId of playerIds) {
      let points = 0;

      // Count votes against this player
      const votesAgainst = votes.filter(v => v.target_id === playerId).length;
      
      if (playerId === imposterId) {
        // Imposter gets points for each vote against them (they want to be caught)
        points = votesAgainst;
      } else {
        // Detectives get points for NOT being voted against
        // And lose points if they voted for the wrong person
        const playerVote = votes.find(v => v.voter_id === playerId);
        if (playerVote && playerVote.target_id !== imposterId) {
          points = -1; // Penalty for voting wrong
        } else if (votesAgainst === 0) {
          points = 1; // Bonus for not being suspected
        }
      }

      if (points !== 0) {
        scoreUpdates.push({ player_id: playerId, points });
      }
    }

    // Update scores in the database
    if (scoreUpdates.length > 0) {
      for (const update of scoreUpdates) {
        // Check if player already has a score record
        const { data: existingScore } = await supabase
          .from('scores')
          .select('id, points')
          .eq('player_id', update.player_id)
          .single();

        if (existingScore) {
          // Update existing score
          const { error } = await supabase
            .from('scores')
            .update({ points: existingScore.points + update.points })
            .eq('id', existingScore.id);

          if (error) {
            console.error('Error updating existing score:', error);
            throw error;
          }
        } else {
          // Insert new score
          const { error } = await supabase
            .from('scores')
            .insert({
              player_id: update.player_id,
              points: update.points
            });

          if (error) {
            console.error('Error inserting new score:', error);
            throw error;
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to update scores:', error);
    throw error;
  }
}

/**
 * Gets a player's total score
 * @param playerId - ID of the player
 * @returns Total score
 */
export async function getPlayerScore(playerId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('points')
      .eq('player_id', playerId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching player score:', error);
      throw error;
    }

    return data?.points || 0;
  } catch (error) {
    console.error('Failed to fetch player score:', error);
    throw error;
  }
}

/**
 * Creates a new round
 * @param roomId - ID of the room
 * @param imposterId - ID of the imposter player
 * @returns Round ID
 */
export async function createRound(roomId: string, imposterId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .insert({
        game_id: roomId,
        imposter_id: imposterId
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating round:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Failed to create round:', error);
    throw error;
  }
}

/**
 * Gets the current round for a room
 * @param roomId - ID of the room
 * @returns Round data or null
 */
export async function getCurrentRound(roomId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('game_id', roomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching current round:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch current round:', error);
    throw error;
  }
}
