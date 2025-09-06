import { create } from 'zustand';
import type { GameState, Player, Room, Round, Topic, Clue, Vote, Prompt, Answer } from '../types/game';
import * as gameIntegration from '../lib/gameIntegration';

interface GameStore extends GameState {
  setRoom: (room: Room) => void;
  setPlayers: (players: Player[]) => void;
  setCurrentPlayer: (player: Player) => void;
  setCurrentRound: (round: Round) => void;
  setTopic: (topic: Topic) => void;
  setClues: (clues: Clue[]) => void;
  setVotes: (votes: Vote[]) => void;
  setPrompts: (prompts: Prompt[]) => void;
  setAnswers: (answers: Answer[]) => void;
  updatePlayer: (playerId: string, update: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  reset: () => void;
  
  // Game phase management functions
  startRound: (roomId: string, writeToken: string, promptCount?: number) => Promise<void>;
  saveAnswers: (roundId: string, playerId: string, answers: Array<{ prompt_order: number; answer_text: string }>, writeToken: string) => Promise<void>;
  getAnswers: (roundId: string) => Promise<void>;
  submitVote: (roundId: string, voterId: string, targetId: string, writeToken: string) => Promise<void>;
  getVotes: (roundId: string) => Promise<void>;
  updateScores: (roundId: string, imposterGuessIndex: number, writeToken: string) => Promise<void>;
}

const initialState: GameState = {
  room: undefined,
  players: [],
  currentPlayer: undefined,
  currentRound: undefined,
  topic: undefined,
  clues: [],
  votes: [],
  prompts: [],
  answers: [],
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  
  setRoom: (room) => set({ room }),
  
  setPlayers: (players) => set({ players }),
  
  setCurrentPlayer: (currentPlayer) => set({ currentPlayer }),
  
  setCurrentRound: (currentRound) => set({ currentRound }),
  
  setTopic: (topic) => set({ topic }),
  
  setClues: (clues) => set({ clues }),
  
  setVotes: (votes) => set({ votes }),
  
  setPrompts: (prompts) => set({ prompts }),
  
  setAnswers: (answers) => set({ answers }),
  
  updatePlayer: (playerId, update) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, ...update } : p
      ),
    })),
  
  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.filter((p) => p.id !== playerId),
    })),
  
  reset: () => set(initialState),
  
  // Game phase management functions
  startRound: async (roomId: string, writeToken: string, promptCount: number = 4) => {
    try {
      const result = await gameIntegration.startRound(roomId, writeToken, promptCount);
      
      // Update the store with the new round data
      set(() => ({
        prompts: result.prompts.map((p, index) => ({
          id: p.id,
          round_id: '', // Will be set by the round
          prompt_text: p.prompt,
          prompt_order: index + 1,
          created_at: new Date().toISOString()
        })),
        currentRound: {
          id: result.roundId,
          room_id: roomId,
          round_number: 1, // Will be updated by the actual round data
          topic_id: 0, // Not used in text prompt system
          secret_word_index: 0, // Not used in text prompt system
          phase: 'role_reveal',
          imposter_id: result.imposterId,
          started_at: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error('Error starting round:', error);
      throw error;
    }
  },
  
  saveAnswers: async (roundId: string, playerId: string, answers: Array<{ prompt_order: number; answer_text: string }>, writeToken: string) => {
    try {
      const result = await gameIntegration.saveAnswers(roundId, playerId, answers, writeToken);
      console.log('Answers saved successfully:', result);
    } catch (error) {
      console.error('Error saving answers:', error);
      throw error;
    }
  },
  
  getAnswers: async (roundId: string) => {
    try {
      const answers = await gameIntegration.getAnswers(roundId);
      set({ answers: answers as any });
    } catch (error) {
      console.error('Error getting answers:', error);
      throw error;
    }
  },
  
  submitVote: async (roundId: string, voterId: string, targetId: string, writeToken: string) => {
    try {
      const result = await gameIntegration.submitVote(roundId, voterId, targetId, writeToken);
      console.log('Vote submitted successfully:', result);
    } catch (error) {
      console.error('Error submitting vote:', error);
      throw error;
    }
  },
  
  getVotes: async (roundId: string) => {
    try {
      const votes = await gameIntegration.getVotes(roundId);
      set({ votes: votes as any });
    } catch (error) {
      console.error('Error getting votes:', error);
      throw error;
    }
  },
  
  updateScores: async (roundId: string, imposterGuessIndex: number, writeToken: string) => {
    try {
      await gameIntegration.updateScores(roundId, imposterGuessIndex, writeToken);
      console.log('Scores updated successfully');
    } catch (error) {
      console.error('Error updating scores:', error);
      throw error;
    }
  },
}));