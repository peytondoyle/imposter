import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface GameProps {
  onBackToLobby: () => void;
  playerData: any;
}

export function Game({ onBackToLobby, playerData }: GameProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<'role' | 'clue' | 'voting' | 'results'>('role');
  const [clue, setClue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to game state changes
    const channel = supabase
      .channel('game-state')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'game_states',
          filter: `room_id=eq.${playerData.roomId}`
        }, 
        (payload) => {
          console.log('Game state update:', payload);
          if (payload.new) {
            setGameState(payload.new);
            setCurrentPhase((payload.new as any).current_phase || 'role');
          }
        }
      )
      .subscribe();

    // Also subscribe to room changes to detect when game starts
    supabase
      .channel('room-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'rooms',
          filter: `id=eq.${playerData.roomId}`
        }, 
        (payload) => {
          console.log('Room update:', payload);
          // Room updates are handled in App.tsx
        }
      )
      .subscribe();

    // Get initial game state
    const getGameState = async () => {
      try {
        const { data } = await supabase
          .from('game_states')
          .select('*')
          .eq('room_id', playerData.roomId)
          .single();

        if (data) {
          setGameState(data);
          setCurrentPhase(data.current_phase || 'role');
        } else {
          // Create initial game state if it doesn't exist
          const newGameState = {
            room_id: playerData.roomId,
            current_phase: 'role',
            topic: {
              category: 'Animals',
              words: ['Lion', 'Tiger', 'Elephant', 'Giraffe', 'Monkey', 'Zebra', 'Hippo', 'Rhino'],
              secret_word: 'Lion'
            },
            players: [
              { id: playerData.playerId, name: playerData.name, avatar: '🦀', role: 'detective' }
            ]
          };

          const { data: inserted } = await supabase
            .from('game_states')
            .insert([newGameState])
            .select()
            .single();

          if (inserted) {
            setGameState(inserted);
          }
        }
      } catch (error) {
        console.error('Error getting game state:', error);
      } finally {
        setLoading(false);
      }
    };

    getGameState();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerData.roomId, playerData.playerId, playerData.name]);

  const updateGamePhase = async (newPhase: string) => {
    try {
      const { error } = await supabase
        .from('game_states')
        .update({ current_phase: newPhase })
        .eq('room_id', playerData.roomId);

      if (error) {
        console.error('Error updating game phase:', error);
      }
    } catch (error) {
      console.error('Error updating game phase:', error);
    }
  };

  const handleClueSubmit = async () => {
    // Update game state with clue
    try {
      const { error } = await supabase
        .from('game_states')
        .update({ 
          current_phase: 'voting',
          clues: { [playerData.playerId]: clue }
        })
        .eq('room_id', playerData.roomId);

      if (error) {
        console.error('Error submitting clue:', error);
      }
    } catch (error) {
      console.error('Error submitting clue:', error);
    }
  };

  const handleVotingComplete = async () => {
    try {
      const { error } = await supabase
        .from('game_states')
        .update({ current_phase: 'results' })
        .eq('room_id', playerData.roomId);

      if (error) {
        console.error('Error completing voting:', error);
      }
    } catch (error) {
      console.error('Error completing voting:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-6xl mb-6 animate-spin">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-4">Loading Game...</h2>
          <p className="text-white/80">Synchronizing with other players</p>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold text-white mb-4">Game Not Found</h2>
          <p className="text-white/80 mb-6">Unable to load game state</p>
          <button
            onClick={onBackToLobby}
            className="w-full py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-6xl mb-6">🎭</div>
          <h1 className="text-4xl font-bold text-white mb-4">Role Reveal</h1>
          <p className="text-white/80 mb-8">Your secret role has been assigned!</p>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Your Role</h2>
            <div className="text-6xl mb-4">🕵️</div>
            <p className="text-xl text-white font-semibold">Detective</p>
            <p className="text-white/70 mt-2">Find the imposter by asking questions!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Topic</h2>
            <p className="text-xl text-white font-semibold">{gameState.topic?.category || 'Animals'}</p>
            <p className="text-white/70 mt-2">Secret word: {gameState.topic?.secret_word || 'Lion'}</p>
          </div>

          <button
            onClick={() => updateGamePhase('clue')}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
          >
            Continue to Game
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'clue') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🎯 Clue Phase</h1>
            <p className="text-white/80">Give a clue about the secret word!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Topic: {gameState.topic?.category || 'Animals'}</h2>
            <p className="text-white/70">Secret word: {gameState.topic?.secret_word || 'Lion'}</p>
          </div>

          <div className="mb-8">
            <label className="block text-white font-medium mb-3">Your Clue:</label>
            <input
              type="text"
              value={clue}
              onChange={(e) => setClue(e.target.value)}
              placeholder="Enter your clue..."
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleClueSubmit}
            disabled={!clue.trim()}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-green-400/30 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Clue
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'voting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🗳️ Voting Phase</h1>
            <p className="text-white/80">Who do you think is the imposter?</p>
          </div>

          <div className="space-y-4 mb-8">
            {gameState.players?.map((player: any) => (
              <button
                key={player.id}
                onClick={() => console.log(`Vote: ${playerData.playerId} -> ${player.id}`)}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center space-x-4 hover:bg-white/20 transition-all"
              >
                <div className="text-3xl">{player.avatar}</div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{player.name}</p>
                  <p className="text-white/70 text-sm">Clue: {gameState.clues?.[player.id] || 'No clue given'}</p>
                </div>
                <div className="text-white/60">→</div>
              </button>
            ))}
          </div>

          <button
            onClick={handleVotingComplete}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-red-400/30 text-lg"
          >
            Submit Vote
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold text-white mb-4">Game Results</h1>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">The Imposter Was...</h2>
            <div className="text-6xl mb-4">🦀</div>
            <p className="text-xl text-white font-semibold">Louis</p>
            <p className="text-white/70 mt-2">The detectives won!</p>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-xl font-bold text-white">Final Scores:</h3>
            {gameState.players?.map((player: any) => (
              <div key={player.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{player.avatar}</div>
                  <span className="text-white font-medium">{player.name}</span>
                </div>
                <span className="text-white/70">+10 points</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => updateGamePhase('role')}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
            >
              Play Again
            </button>
            <button
              onClick={onBackToLobby}
              className="w-full py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
