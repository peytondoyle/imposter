import { create } from 'zustand';
import type { GameState, Player, Room, Round, Topic, Clue, Vote } from '../types/game';

interface GameStore extends GameState {
  setRoom: (room: Room) => void;
  setPlayers: (players: Player[]) => void;
  setCurrentPlayer: (player: Player) => void;
  setCurrentRound: (round: Round) => void;
  setTopic: (topic: Topic) => void;
  setClues: (clues: Clue[]) => void;
  setVotes: (votes: Vote[]) => void;
  updatePlayer: (playerId: string, update: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  reset: () => void;
}

const initialState: GameState = {
  room: undefined,
  players: [],
  currentPlayer: undefined,
  currentRound: undefined,
  topic: undefined,
  clues: [],
  votes: [],
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
}));