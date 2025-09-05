import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface GameProps {
  onBackToLobby: () => void;
  playerData: any;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  role?: 'detective' | 'imposter';
}

// Topics are now loaded from Supabase database

export function Game({ onBackToLobby, playerData }: GameProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<'role' | 'clue' | 'voting' | 'results'>('role');
  const [clue, setClue] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('Game component mounted, initializing...');
    initializeGame();
    setupRealtimeSubscription();
    
    // Set up periodic refresh as fallback for realtime updates
    const refreshInterval = setInterval(() => {
      console.log('Periodic refresh of game state');
      refreshGameState();
    }, 5000); // Refresh every 5 seconds
    
    return () => {
      cleanupSubscriptions();
      clearInterval(refreshInterval);
    };
  }, [playerData.roomId]);

  const cleanupSubscriptions = () => {
    supabase.removeAllChannels();
  };

  const refreshGameState = async () => {
    try {
      console.log('Refreshing game state for room:', playerData.roomId);
      
      const { data, error } = await supabase
        .from('game_states')
        .select('*')
        .eq('room_id', playerData.roomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is ok
        console.error('Error fetching game state:', error);
        setError('Failed to load game state');
        return;
      }

      console.log('Game state refreshed:', data);
      
      if (data) {
        console.log('Setting game state:', data);
        console.log('Setting current phase to:', data.current_phase || 'role');
        setGameState(data);
        setCurrentPhase(data.current_phase || 'role');
        setError('');
        
        // Find current player in game state
        const player = data.players?.find((p: any) => p.id === playerData.playerId);
        setCurrentPlayer(player || null);
        
        if (!player) {
          console.warn('Current player not found in game state');
        }
      } else {
        // No active game state found
        setGameState(null);
        setCurrentPlayer(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in refreshGameState:', error);
      setError('Network error while loading game');
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    console.log('Setting up realtime subscription for room:', playerData.roomId);
    
    const channel = supabase
      .channel(`game-room-${playerData.roomId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'game_states', 
          filter: `room_id=eq.${playerData.roomId}` 
        },
        (payload) => {
          console.log('Game state changed via realtime:', payload);
          console.log('New phase from realtime:', (payload.new as any)?.current_phase);
          refreshGameState();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to game state changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error, retrying...');
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 1000);
        } else if (status === 'TIMED_OUT') {
          console.warn('Realtime subscription timed out, retrying...');
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 1000);
        }
      });

    return channel;
  };

  const initializeGame = async () => {
    try {
      console.log('Fetching players for room:', playerData.roomId);
      
      // First, get all players in the room
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', playerData.roomId)
        .order('joined_at');

      console.log('Players data:', playersData);
      
      if (playersError) {
        console.error('Error fetching players:', playersError);
        setError('Failed to load players');
        setLoading(false);
        return;
      }

      if (!playersData || playersData.length === 0) {
        console.error('No players found in room');
        setError('No players found in room');
        setLoading(false);
        return;
      }

      // Check if game state exists using safe query
      await refreshGameState();
      
      // If no game state exists and user is host, create one
      if (!gameState && playerData.isHost) {
        console.log('Host creating new game state...');
        await createNewGame(playersData);
      }
      
    } catch (error) {
      console.error('Error initializing game:', error);
      setError('Failed to initialize game');
      setLoading(false);
    }
  };

  const createNewGame = async (playersData: any[]) => {
    try {
      console.log('Creating new game with players:', playersData);
      
      // Get random topic from Supabase (fallback approach)
      const { data: allTopics, error: topicsError } = await supabase
        .from('topics')
        .select('*')
        .eq('family_safe', true);
      
      if (topicsError || !allTopics || allTopics.length === 0) {
        console.error('Error fetching topics:', topicsError);
        setError('Failed to load game topic');
        return;
      }
      
      // Pick random topic from the results
      const topicData = allTopics[Math.floor(Math.random() * allTopics.length)];

      if (!topicData) {
        console.error('No topic data available');
        setError('Failed to load game topic');
        return;
      }

      // Pick random secret word index (1-8)
      const secretWordIndex = Math.floor(Math.random() * 8) + 1;
      const secretWord = topicData[`word${secretWordIndex}` as keyof typeof topicData] as string;
      
      // Randomly assign one imposter
      const imposterIndex = Math.floor(Math.random() * playersData.length);
      
      // Create player objects with roles
      const gamePlayers = playersData.map((p, index) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar || '🎭',
        role: index === imposterIndex ? 'imposter' : 'detective' as 'detective' | 'imposter'
      }));

      console.log('Game players:', gamePlayers);

      // Create the game state with UPSERT logic
      const newGameState = {
        room_id: playerData.roomId,
        current_phase: 'role',
        is_active: true,
        topic: {
          id: topicData.id,
          category: topicData.category,
          topic: topicData.topic,
          word1: topicData.word1,
          word2: topicData.word2,
          word3: topicData.word3,
          word4: topicData.word4,
          word5: topicData.word5,
          word6: topicData.word6,
          word7: topicData.word7,
          word8: topicData.word8,
          family_safe: topicData.family_safe,
          secret_word_index: secretWordIndex,
          secret_word: secretWord
        },
        players: gamePlayers,
        clues: {},
        votes: {},
        imposter_id: gamePlayers[imposterIndex].id
      };

      console.log('Creating game state:', newGameState);

      // First, mark any existing active game as inactive
      await supabase
        .from('game_states')
        .update({ is_active: false })
        .eq('room_id', playerData.roomId)
        .eq('is_active', true);

      // Then insert the new game state
      const { data: inserted, error } = await supabase
        .from('game_states')
        .insert(newGameState)
        .select()
        .single();

      if (error) {
        console.error('Error creating game state:', error);
        setError('Failed to create game');
        return;
      }

      console.log('Game state created:', inserted);

      if (inserted) {
        // Refresh game state to get the latest data
        await refreshGameState();
      }
      
    } catch (error) {
      console.error('Error in createNewGame:', error);
      setError('Failed to create new game');
    }
  };

  const updateGamePhase = async (newPhase: string) => {
    if (!gameState) return;
    
    try {
      console.log('Updating game phase to:', newPhase, 'for room:', playerData.roomId);
      
      const { data, error } = await supabase
        .from('game_states')
        .update({ 
          current_phase: newPhase
        })
        .eq('room_id', playerData.roomId)
        .eq('is_active', true)
        .select()
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error updating game phase:', error);
        setError('Failed to update game phase');
      } else {
        console.log('Game phase updated successfully:', data);
        // The realtime subscription will handle the state update
        // But let's also manually refresh to ensure UI updates
        setTimeout(() => {
          console.log('Manually refreshing game state after phase update');
          refreshGameState();
        }, 100);
        
        // Also trigger a refresh after a longer delay to catch any missed updates
        setTimeout(() => {
          console.log('Secondary refresh after phase update');
          refreshGameState();
        }, 1000);
      }
    } catch (error) {
      console.error('Error updating game phase:', error);
      setError('Network error during phase update');
    }
  };

  const handleClueSubmit = async () => {
    if (!clue.trim() || !gameState) return;

    try {
      // Get current clues and add new one
      const currentClues = gameState.clues || {};
      currentClues[playerData.playerId] = clue;

      const { error } = await supabase
        .from('game_states')
        .update({ 
          clues: currentClues
        })
        .eq('room_id', playerData.roomId)
        .eq('is_active', true);

      if (error) {
        console.error('Error submitting clue:', error);
        setError('Failed to submit clue');
        return;
      }

      // Check if all players have submitted clues
      const allPlayersSubmitted = gameState.players?.every((p: Player) => 
        currentClues[p.id] !== undefined
      );

      if (allPlayersSubmitted && playerData.isHost) {
        await updateGamePhase('voting');
      }
    } catch (error) {
      console.error('Error submitting clue:', error);
      setError('Network error while submitting clue');
    }
  };

  const handleVote = async (targetId: string) => {
    if (!gameState) return;
    
    setSelectedVote(targetId);
    
    try {
      const currentVotes = gameState.votes || {};
      currentVotes[playerData.playerId] = targetId;

      const { error } = await supabase
        .from('game_states')
        .update({ 
          votes: currentVotes
        })
        .eq('room_id', playerData.roomId)
        .eq('is_active', true);

      if (error) {
        console.error('Error submitting vote:', error);
        setError('Failed to submit vote');
        return;
      }

      // Check if all players have voted
      const allPlayersVoted = gameState.players?.every((p: Player) => 
        currentVotes[p.id] !== undefined
      );

      if (allPlayersVoted && playerData.isHost) {
        await updateGamePhase('results');
      }
    } catch (error) {
      console.error('Error voting:', error);
      setError('Network error while voting');
    }
  };

  const resetGame = async () => {
    if (!playerData.isHost || !gameState) return;

    try {
      // Mark current game as inactive
      await supabase
        .from('game_states')
        .update({ is_active: false })
        .eq('room_id', playerData.roomId)
        .eq('is_active', true);

      // Get all players and create new game
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', playerData.roomId)
        .order('joined_at');

      if (playersData && playersData.length > 0) {
        await createNewGame(playersData);
      }
    } catch (error) {
      console.error('Error resetting game:', error);
      setError('Failed to reset game');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6 animate-spin">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-4">Loading Game...</h2>
          <p className="text-white/80">Connecting to multiplayer session...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Game Error</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setError('');
                setLoading(true);
                initializeGame();
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              Retry
            </button>
            <button
              onClick={onBackToLobby}
              className="w-full py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for game state
  if (!gameState || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-4">Waiting for Host</h2>
          <p className="text-white/80 mb-6">The host is starting the game...</p>
          
          <div className="space-y-3">
            <button
              onClick={refreshGameState}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              🔄 Check for Game
            </button>
            <button
              onClick={onBackToLobby}
              className="w-full py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Role reveal phase
  if (currentPhase === 'role') {
    const isImposter = currentPlayer.role === 'imposter';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full text-center">
          <div className="text-6xl mb-6">🎭</div>
          <h1 className="text-4xl font-bold text-white mb-4">Role Reveal</h1>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Your Role</h2>
            <div className="text-6xl mb-4">{isImposter ? '🦹' : '🕵️'}</div>
            <p className="text-xl text-white font-semibold">
              {isImposter ? 'Chameleon' : 'Crew'}
            </p>
            <p className="text-white/70 mt-2">
              {isImposter 
                ? 'Blend in by giving vague clues that could apply to any word!'
                : 'Find the Chameleon by asking questions!'}
            </p>
          </div>

          {/* Topic Card with 8 words */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{gameState.topic?.category || 'Mystery'}</h2>
              <div className="text-sm text-gray-500 mb-4">
                {isImposter ? (
                  <span className="text-red-600 font-medium">🦹 You are the CHAMELEON</span>
                ) : (
                  <span className="text-blue-600 font-medium">👥 You are CREW</span>
                )}
              </div>
              {!isImposter && (
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-3 mb-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Secret Word:</span> <span className="font-bold text-blue-700">{gameState.topic?.secret_word || '???'}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Give clues about this word without being too obvious!
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4,5,6,7,8].map((index) => {
                const word = gameState.topic?.[`word${index}`];
                const isSecret = index === gameState.topic?.secret_word_index;
                const shouldHighlight = !isImposter && isSecret;
                
                return (
                  <div
                    key={index}
                    className={`
                      p-4 rounded-xl text-center font-medium text-lg border-2 transition-all
                      ${shouldHighlight 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-blue-400 shadow-lg transform scale-105' 
                        : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                      }
                    `}
                  >
                    {word || '???'}
                    {shouldHighlight && (
                      <div className="text-xs mt-1 opacity-90">SECRET</div>
                    )}
                  </div>
                );
              })}
            </div>

            {isImposter && (
              <div className="mt-6 bg-gradient-to-r from-red-100 to-orange-100 rounded-xl p-4">
                <p className="text-sm text-gray-700 text-center">
                  <span className="font-semibold">Your Mission:</span> Blend in by giving a vague clue that could apply to any of these words.
                  <br />
                  <span className="text-xs text-gray-600">The crew knows the secret word, but you don't!</span>
                </p>
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mb-8">
            <p className="text-white/70">Players in this round:</p>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              {gameState.players?.map((p: Player) => (
                <div key={p.id} className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full">
                  <span className="text-lg">{p.avatar}</span>
                  <span className="text-white text-sm">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          {playerData.isHost && (
            <div className="space-y-3">
              <button
                onClick={() => updateGamePhase('clue')}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
              >
                Start Clue Phase
              </button>
            </div>
          )}
          
          {!playerData.isHost && (
            <div className="text-center">
              <p className="text-white/70">Waiting for host to start clue phase...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Clue phase
  if (currentPhase === 'clue') {
    const hasSubmittedClue = gameState.clues?.[playerData.playerId] !== undefined;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🎯 Clue Phase</h1>
            <p className="text-white/80">Give a clue about the secret word!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Topic: {gameState.topic?.category || 'Mystery'}
            </h2>
            {currentPlayer?.role !== 'imposter' && (
              <p className="text-white/70">Secret word: {gameState.topic?.secret_word || '???'}</p>
            )}
            {currentPlayer?.role === 'imposter' && (
              <p className="text-orange-300">You're the imposter! Give a convincing clue.</p>
            )}
          </div>

          {!hasSubmittedClue ? (
            <>
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
            </>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-white text-xl mb-4">Clue submitted!</p>
              <p className="text-white/70">Waiting for other players...</p>
              
              <div className="mt-8 space-y-2">
                <p className="text-white/70 text-sm">Players who have submitted:</p>
                {gameState.players?.map((p: Player) => {
                  const submitted = gameState.clues?.[p.id] !== undefined;
                  return (
                    <div key={p.id} className="flex items-center justify-center gap-2">
                      <span className="text-lg">{p.avatar}</span>
                      <span className="text-white text-sm">{p.name}</span>
                      <span className={submitted ? 'text-green-400' : 'text-gray-400'}>
                        {submitted ? '✓' : '○'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Manual continue button for host when all players have submitted */}
              {playerData.isHost && (() => {
                const allSubmitted = gameState.players?.every((p: Player) => 
                  gameState.clues?.[p.id] !== undefined
                );
                return allSubmitted ? (
                  <div className="mt-8">
                    <button
                      onClick={() => updateGamePhase('voting')}
                      className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-purple-400/30 text-lg"
                    >
                      Continue to Voting Phase
                    </button>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Voting phase
  if (currentPhase === 'voting') {
    const hasVoted = gameState.votes?.[playerData.playerId] !== undefined;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🗳️ Voting Phase</h1>
            <p className="text-white/80">Who do you think is the imposter?</p>
          </div>

          {!hasVoted ? (
            <>
              <div className="space-y-4 mb-8">
                {gameState.players?.map((player: Player) => (
                  <button
                    key={player.id}
                    onClick={() => handleVote(player.id)}
                    disabled={player.id === playerData.playerId}
                    className={`w-full bg-white/10 backdrop-blur-sm border rounded-xl p-4 flex items-center space-x-4 transition-all ${
                      player.id === playerData.playerId 
                        ? 'opacity-50 cursor-not-allowed border-gray-500' 
                        : selectedVote === player.id
                        ? 'border-yellow-400 bg-yellow-400/20'
                        : 'border-white/20 hover:bg-white/20'
                    }`}
                  >
                    <div className="text-3xl">{player.avatar}</div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">
                        {player.name} {player.id === playerData.playerId && '(You)'}
                      </p>
                      <p className="text-white/70 text-sm">
                        Clue: "{gameState.clues?.[player.id] || 'No clue given'}"
                      </p>
                    </div>
                    {selectedVote === player.id && (
                      <div className="text-yellow-400 text-2xl">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">🗳️</div>
              <p className="text-white text-xl mb-4">Vote submitted!</p>
              <p className="text-white/70">Waiting for other players...</p>
              
              <div className="mt-8 space-y-2">
                <p className="text-white/70 text-sm">Voting status:</p>
                {gameState.players?.map((p: Player) => {
                  const voted = gameState.votes?.[p.id] !== undefined;
                  return (
                    <div key={p.id} className="flex items-center justify-center gap-2">
                      <span className="text-lg">{p.avatar}</span>
                      <span className="text-white text-sm">{p.name}</span>
                      <span className={voted ? 'text-green-400' : 'text-gray-400'}>
                        {voted ? '✓' : '○'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Manual continue button for host when all players have voted */}
              {playerData.isHost && (() => {
                const allVoted = gameState.players?.every((p: Player) => 
                  gameState.votes?.[p.id] !== undefined
                );
                return allVoted ? (
                  <div className="mt-8">
                    <button
                      onClick={() => updateGamePhase('results')}
                      className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-green-400/30 text-lg"
                    >
                      Show Results
                    </button>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Results phase
  if (currentPhase === 'results') {
    const imposter = gameState.players?.find((p: Player) => p.id === gameState.imposter_id);
    const voteCounts: { [key: string]: number } = {};
    
    // Count votes
    Object.values(gameState.votes || {}).forEach((targetId: any) => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    
    // Find most voted player
    const mostVoted = Object.entries(voteCounts).reduce((a, b) => 
      voteCounts[a[0]] > voteCounts[b[0]] ? a : b, ['', 0]
    )[0];
    
    const detectivesWin = mostVoted === gameState.imposter_id;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">{detectivesWin ? '🎉' : '😈'}</div>
          <h1 className="text-4xl font-bold text-white mb-4">Game Results</h1>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">The Imposter Was...</h2>
            <div className="text-6xl mb-4">{imposter?.avatar}</div>
            <p className="text-xl text-white font-semibold">{imposter?.name}</p>
            <p className="text-white/70 mt-2">
              {detectivesWin ? 'The detectives won! 🕵️' : 'The imposter fooled everyone! 🦹'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Vote Results:</h3>
            {gameState.players?.map((player: Player) => (
              <div key={player.id} className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{player.avatar}</span>
                  <span className="text-white">{player.name}</span>
                  {player.id === gameState.imposter_id && (
                    <span className="text-red-400 text-sm">(Imposter)</span>
                  )}
                </div>
                <span className="text-white/70">{voteCounts[player.id] || 0} votes</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {playerData.isHost && (
              <button
                onClick={resetGame}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
              >
                Play Again
              </button>
            )}
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