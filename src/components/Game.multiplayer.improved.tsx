import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { AnswerForm } from './round/AnswerForm';
import { AnswerProgress } from './round/AnswerProgress';
import { RevealGrid } from './round/RevealGrid';
import { VotePanel } from './round/VotePanel';
import { ResultsPanel } from './round/ResultsPanel';

interface GameProps {
  onBackToLobby: () => void;
  playerData: any;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  role?: 'detective' | 'imposter';
  total_score?: number;
}

interface TextPrompt {
  id: number;
  prompt: string;
  category: string;
  is_secret?: boolean;
}


// Topics are now loaded from Supabase database

export function Game({ onBackToLobby, playerData }: GameProps) {
  // Game store for state management
  const gameStore = useGameStore();
  
  const [gameState, setGameState] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<'role_reveal' | 'answer_entry' | 'reveal_clues' | 'vote' | 'imposter_guess' | 'reveal' | 'done'>('role_reveal');
  const [loading, setLoading] = useState(true);
  const [imposterGuess, setImposterGuess] = useState<number>(1);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string>('');
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // New state for prompts and answers
  const [prompts] = useState<any[]>([]);

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

  // Auto-advance phase when all players have submitted answers
  useEffect(() => {
    if (currentPhase === 'answer_entry' && gameState?.players && playerData.isHost) {
      const allSubmitted = gameState.players.every((p: Player) => {
        const playerAnswers = gameState.answers?.filter((answer: any) => answer.player_id === p.id) || [];
        return playerAnswers.length === (prompts.length || 0);
      });
      
      if (allSubmitted) {
        console.log('All players have submitted answers, auto-advancing phase...');
        const advancePhase = async () => {
          try {
            // Get current round ID
            const { data: roundData } = await supabase
              .from('rounds')
              .select('id')
              .eq('room_id', playerData.roomId)
              .order('round_number', { ascending: false })
              .limit(1)
              .single();
            
            if (roundData) {
              await supabase.rpc('advance_phase', {
                p_round_id: roundData.id,
                p_write_token: playerData.writeToken || ''
              });
              await refreshGameState();
            }
          } catch (error) {
            console.error('Error auto-advancing phase:', error);
            setError('Failed to advance phase');
          }
        };
        
        // Add a small delay to let players see their answers were recorded
        const timer = setTimeout(advancePhase, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentPhase, gameState?.answers, gameState?.players, playerData.isHost, playerData.roomId, playerData.writeToken, prompts]);

  // Load answers when entering reveal phase
  useEffect(() => {
    if (currentPhase === 'reveal_clues' && gameState?.id) {
      console.log('Reveal clues phase, loading answers...');
      const loadAnswers = async () => {
        try {
          // Answers are loaded via real-time subscription
        } catch (error) {
          console.error('Error loading answers:', error);
          setError('Failed to load answers');
        }
      };
      
      loadAnswers();
    }
  }, [currentPhase, gameState?.id]);

  // Auto-advance phase after a short delay to let players read the clues
  useEffect(() => {
    if (currentPhase === 'reveal_clues' && playerData.isHost) {
      console.log('Reveal clues phase, auto-advancing after delay...');
      const advancePhase = async () => {
        try {
          // Get current round ID
          const { data: roundData } = await supabase
            .from('rounds')
            .select('id')
            .eq('room_id', playerData.roomId)
            .order('round_number', { ascending: false })
            .limit(1)
            .single();
          
          if (roundData) {
            await supabase.rpc('advance_phase', {
              p_round_id: roundData.id,
              p_write_token: playerData.writeToken || ''
            });
            await refreshGameState();
          }
        } catch (error) {
          console.error('Error auto-advancing phase:', error);
          setError('Failed to advance phase');
        }
      };
      
      // Give players 5 seconds to read the clues
      const timer = setTimeout(advancePhase, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, playerData.isHost, playerData.roomId, playerData.writeToken]);

  // Load votes when entering vote phase
  useEffect(() => {
    if (currentPhase === 'vote' && gameState?.id) {
      console.log('Vote phase, loading votes...');
      const loadVotes = async () => {
        try {
          await gameStore.getVotes(gameState.id);
        } catch (error) {
          console.error('Error loading votes:', error);
          setError('Failed to load votes');
        }
      };
      
      loadVotes();
    }
  }, [currentPhase, gameState?.id]);

  // Auto-advance phase when all players have voted
  useEffect(() => {
    if (currentPhase === 'vote' && gameState?.players && playerData.isHost) {
      const allVoted = gameState.players.every((p: Player) => 
        gameState.votes?.[p.id] !== undefined
      );
      
      if (allVoted) {
        console.log('All players have voted, auto-advancing phase...');
        const advancePhase = async () => {
          try {
            // Get current round ID
            const { data: roundData } = await supabase
              .from('rounds')
              .select('id')
              .eq('room_id', playerData.roomId)
              .order('round_number', { ascending: false })
              .limit(1)
              .single();
            
            if (roundData) {
              await supabase.rpc('advance_phase', {
                p_round_id: roundData.id,
                p_write_token: playerData.writeToken || ''
              });
              await refreshGameState();
            }
          } catch (error) {
            console.error('Error auto-advancing phase:', error);
            setError('Failed to advance phase');
          }
        };
        
        // Add a small delay to let players see their vote was recorded
        const timer = setTimeout(advancePhase, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentPhase, gameState?.votes, gameState?.players, playerData.isHost, playerData.roomId, playerData.writeToken]);

  // Auto-advance phase when imposter has made their guess
  useEffect(() => {
    if (currentPhase === 'imposter_guess' && gameState?.imposter_guess_index !== undefined && playerData.isHost) {
      console.log('Imposter has made their guess, auto-advancing to reveal phase...');
      const advancePhase = async () => {
        try {
          // Get current round ID
          const { data: roundData } = await supabase
            .from('rounds')
            .select('id')
            .eq('room_id', playerData.roomId)
            .order('round_number', { ascending: false })
            .limit(1)
            .single();
          
          if (roundData) {
            await supabase.rpc('advance_phase', {
              p_round_id: roundData.id,
              p_write_token: playerData.writeToken || ''
            });
            await refreshGameState();
          }
        } catch (error) {
          console.error('Error auto-advancing phase:', error);
          setError('Failed to advance phase');
        }
      };
      
      // Add a small delay to let players see the guess was made
      const timer = setTimeout(advancePhase, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, gameState?.imposter_guess_index, playerData.isHost, playerData.roomId, playerData.writeToken]);

  const cleanupSubscriptions = () => {
    supabase.removeAllChannels();
  };

  const refreshGameState = async () => {
    try {
      console.log('Refreshing game state for room:', playerData.roomId);
      
      // Get current round data
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', playerData.roomId)
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roundError && roundError.code !== 'PGRST116') {
        console.error('Error fetching round data:', roundError);
        setError('Failed to load round data');
        return;
      }

      if (!roundData) {
        console.log('No active round found - checking if we need to start one');
        // If no round exists and user is host, they should start a round from the lobby
        setGameState(null);
        setCurrentPlayer(null);
        setLoading(false);
        return;
      }

      // Get players in the room
      console.log('Fetching players for room:', playerData.roomId);
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', playerData.roomId)
        .order('joined_at');

      if (playersError) {
        console.error('Error fetching players:', playersError);
        setError('Failed to load players');
        return;
      }
      console.log('Players fetched successfully:', playersData?.length, 'players');

      // Get prompts for this round (filtered by player role)
      const { data: promptsData, error: promptsError } = await supabase
        .rpc('get_player_prompts', {
          p_round_id: roundData.id,
          p_player_id: playerData.playerId
        });

      if (promptsError) {
        console.error('Error fetching prompts:', promptsError);
        setError('Failed to load prompts');
        return;
      }
      console.log('Prompts fetched successfully:', promptsData?.length, 'prompts');

      // Get answers for this round
      console.log('Fetching answers for round:', roundData.id);
      const { data: answersData, error: answersError } = await supabase
        .from('answers')
        .select('*')
        .eq('round_id', roundData.id);

      if (answersError) {
        console.error('Error fetching answers:', answersError);
        setError('Failed to load answers');
        return;
      }
      console.log('Answers fetched successfully:', answersData?.length, 'answers');

      // Get votes for this round
      console.log('Fetching votes for round:', roundData.id);
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('round_id', roundData.id);

      if (votesError) {
        console.error('Error fetching votes:', votesError);
        setError('Failed to load votes');
        return;
      }
      console.log('Votes fetched successfully:', votesData?.length, 'votes');

      // Convert answers and votes to the format expected by the UI
      const answers: { [key: string]: { [key: string]: string } } = {};
      const votes: { [key: string]: string } = {};
      
      answersData?.forEach(answer => {
        if (!answers[answer.player_id]) {
          answers[answer.player_id] = {};
        }
        answers[answer.player_id][answer.prompt_id] = answer.answer_text;
      });
      
      votesData?.forEach(vote => {
        votes[vote.voter_id] = vote.target_id;
      });


      // Assign roles to players based on imposter_id
      const playersWithRoles = (playersData || []).map((player: any) => ({
        ...player,
        role: player.id === roundData.imposter_id ? 'imposter' : 'detective'
      }));

      // Validate that there's exactly one imposter
      const imposterCount = playersWithRoles.filter(p => p.role === 'imposter').length;
      if (imposterCount !== 1) {
        console.error('ERROR: Expected exactly 1 imposter, but found', imposterCount);
        console.error('Players with roles:', playersWithRoles.map(p => ({ id: p.id, name: p.name, role: p.role })));
        console.error('Imposter ID from round:', roundData.imposter_id);
      }

      // Create game state object in the expected format
      const gameStateData = {
        id: roundData.id,
        room_id: playerData.roomId,
        current_phase: roundData.phase,
        prompts: promptsData || [],
        answers: answers,
        imposter_id: roundData.imposter_id,
        players: playersWithRoles,
        votes: votes,
        is_active: true
      };

      console.log('Game state refreshed from ROUNDS table:', gameStateData);
      console.log('Round ID:', roundData.id, 'Phase:', roundData.phase);
      console.log('Setting current phase to:', roundData.phase);
      
      setGameState(gameStateData);
      setCurrentPhase(roundData.phase as any);
      setError('');
      
      // Find current player
      console.log('Looking for player with ID:', playerData.playerId);
      console.log('Available players:', playersWithRoles?.map(p => ({ id: p.id, name: p.name, role: p.role })));
      
      const player = playersWithRoles?.find((p: any) => p.id === playerData.playerId);
      setCurrentPlayer(player || null);
      
      if (!player) {
        console.warn('Current player not found in players list');
        console.warn('Player ID mismatch - looking for:', playerData.playerId);
        console.warn('Available player IDs:', playersWithRoles?.map(p => p.id));
      } else {
        console.log('Found current player:', player);
        console.log('Player role:', player.role);
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
          table: 'rounds', 
          filter: `room_id=eq.${playerData.roomId}` 
        },
        (payload) => {
          console.log('Round changed via realtime:', payload);
          console.log('New phase from realtime:', (payload.new as any)?.phase);
          refreshGameState();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'clues', 
          filter: `round_id=eq.${playerData.roomId}` 
        },
        (payload) => {
          console.log('Clue changed via realtime:', payload);
          refreshGameState();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'votes', 
          filter: `round_id=eq.${playerData.roomId}` 
        },
        (payload) => {
          console.log('Vote changed via realtime:', payload);
          refreshGameState();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to game state changes');
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error, retrying...');
          setRealtimeStatus('disconnected');
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          console.warn('Realtime subscription timed out, retrying...');
          setRealtimeStatus('disconnected');
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 2000);
        } else if (status === 'CLOSED') {
          console.warn('Realtime subscription closed, reconnecting...');
          setRealtimeStatus('disconnected');
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

      // Refresh game state to get current round data
      await refreshGameState();
      
    } catch (error) {
      console.error('Error initializing game:', error);
      setError('Failed to initialize game');
      setLoading(false);
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

  // Real-time status indicator component
  const RealtimeStatusIndicator = () => (
    <div className="fixed top-4 right-4 z-50">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
        realtimeStatus === 'connected' 
          ? 'bg-green-500/20 text-green-400 border border-green-400/30' 
          : realtimeStatus === 'connecting'
          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/30'
          : 'bg-red-500/20 text-red-400 border border-red-400/30'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          realtimeStatus === 'connected' 
            ? 'bg-green-400 animate-pulse' 
            : realtimeStatus === 'connecting'
            ? 'bg-yellow-400 animate-pulse'
            : 'bg-red-400'
        }`}></div>
        <span className="text-xs">
          {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </span>
      </div>
    </div>
  );

  // Role reveal phase
  if (currentPhase === 'role_reveal') {
    console.log('Rendering RoleReveal phase');
    console.log('gameState:', gameState);
    console.log('currentPlayer:', currentPlayer);
    console.log('topic:', gameState?.topic);
    console.log('secret_word_index:', gameState?.secret_word_index);
    console.log('imposter_id from gameState:', gameState?.imposter_id);
    console.log('currentPlayer.id:', currentPlayer?.id);
    console.log('currentPlayer.role:', currentPlayer?.role);
    
    const isImposter = currentPlayer?.role === 'imposter';
    console.log('isImposter calculated as:', isImposter);
    
    // Debug: Show all players and their roles
    console.log('All players with roles:');
    gameState?.players?.forEach((player: any, index: number) => {
      console.log(`Player ${index + 1}:`, {
        id: player.id,
        name: player.name,
        role: player.role,
        isImposter: player.id === gameState?.imposter_id
      });
    });
    
    // Get the selected prompt
    const selectedPrompt = gameState?.text_prompts?.find((p: TextPrompt) => p.id === gameState?.selected_prompt_id);
    const secretPrompt = selectedPrompt?.prompt || '???';
    
    console.log('Selected prompt:', secretPrompt);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <RealtimeStatusIndicator />
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
            
            {/* Debug info - remove in production */}
            <div className="mt-4 p-3 bg-black/20 rounded-lg text-xs text-white/60">
              <div>Debug Info:</div>
              <div>Your ID: {currentPlayer?.id}</div>
              <div>Imposter ID: {gameState?.imposter_id}</div>
              <div>Your Role: {currentPlayer?.role}</div>
              <div>Is Imposter: {isImposter ? 'YES' : 'NO'}</div>
            </div>
          </div>

          {/* Text Prompts Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Text Prompts</h2>
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
                    <span className="font-semibold">Secret Prompt:</span> <span className="font-bold text-blue-700">"{secretPrompt}"</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Answer this prompt without being too obvious!
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {gameState.text_prompts?.map((prompt: TextPrompt) => {
                const isSecret = prompt.id === gameState?.selected_prompt_id;
                const shouldHighlight = !isImposter && isSecret;
                
                return (
                  <div
                    key={prompt.id}
                    className={`
                      p-4 rounded-xl text-left font-medium text-lg border-2 transition-all
                      ${shouldHighlight 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-blue-400 shadow-lg transform scale-105' 
                        : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>{prompt.prompt}</span>
                      {shouldHighlight && (
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">SECRET</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{prompt.category}</div>
                  </div>
                );
              })}
            </div>

            {isImposter && (
              <div className="mt-6 bg-gradient-to-r from-red-100 to-orange-100 rounded-xl p-4">
                <p className="text-sm text-gray-700 text-center">
                  <span className="font-semibold">Your Mission:</span> Blend in by giving a vague answer that could apply to any of these prompts.
                  <br />
                  <span className="text-xs text-gray-600">The crew knows the secret prompt, but you don't!</span>
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
                onClick={async () => {
                  try {
                    // Get current round ID
                    const { data: roundData } = await supabase
                      .from('rounds')
                      .select('id')
                      .eq('room_id', playerData.roomId)
                      .order('round_number', { ascending: false })
                      .limit(1)
                      .single();
                    
                    if (roundData) {
                      await supabase.rpc('advance_phase', {
                        p_round_id: roundData.id,
                        p_write_token: playerData.writeToken || ''
                      });
                      await refreshGameState();
                    }
                  } catch (error) {
                    console.error('Error advancing phase:', error);
                    setError('Failed to advance phase');
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
              >
                Start Answer Phase
              </button>
            </div>
          )}
          
          {!playerData.isHost && (
            <div className="text-center">
              <p className="text-white/70">Waiting for host to start answer phase...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Answer Entry phase
  if (currentPhase === 'answer_entry') {
    const isImposter = currentPlayer?.role === 'imposter';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <RealtimeStatusIndicator />
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🎯 Answer Phase</h1>
            <p className="text-white/80">Answer all the prompts below!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Topic: {gameState.topic?.category || 'Mystery'}
            </h2>
            {!isImposter && (
              <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 mb-4">
                <p className="text-blue-200 font-semibold">You know the secret word!</p>
                <p className="text-blue-200/80 text-sm">Answer the prompts as if you know this word!</p>
              </div>
            )}
            {isImposter && (
              <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg p-3 mb-4">
                <p className="text-orange-200 font-semibold">You're the imposter!</p>
                <p className="text-orange-200/80 text-sm">Give vague answers that could apply to any prompt!</p>
              </div>
            )}
          </div>

          {/* Answer Form for non-host players */}
          {!playerData.isHost && (
            <AnswerForm
              roundId={gameState.id}
              playerId={playerData.playerId}
              prompts={prompts}
              isImposter={isImposter}
              onAnswersSubmitted={() => {}}
              writeToken={playerData.writeToken || ''}
            />
          )}

          {/* Answer Progress for host */}
          {playerData.isHost && (
            <AnswerProgress
              roundId={gameState.id}
              players={gameState.players || []}
              prompts={prompts}
              onForceReveal={async () => {
                try {
                  const { data: roundData } = await supabase
                    .from('rounds')
                    .select('id')
                    .eq('room_id', playerData.roomId)
                    .order('round_number', { ascending: false })
                    .limit(1)
                    .single();
                  
                  if (roundData) {
                    await supabase.rpc('advance_phase', {
                      p_round_id: roundData.id,
                      p_write_token: playerData.writeToken || ''
                    });
                    await refreshGameState();
                  }
                } catch (error) {
                  console.error('Error advancing phase:', error);
                  setError('Failed to advance phase');
                }
              }}
              writeToken={playerData.writeToken || ''}
            />
          )}
        </div>
      </div>
    );
  }

  // Reveal clues phase - now shows answers in a grid
  if (currentPhase === 'reveal_clues') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <RealtimeStatusIndicator />
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-7xl w-full">
          <RevealGrid
            roundId={gameState.id}
            players={gameState.players || []}
            prompts={prompts}
            onStartVoting={async () => {
              try {
                const { data: roundData } = await supabase
                  .from('rounds')
                  .select('id')
                  .eq('room_id', playerData.roomId)
                  .order('round_number', { ascending: false })
                  .limit(1)
                  .single();
                
                if (roundData) {
                  await supabase.rpc('advance_phase', {
                    p_round_id: roundData.id,
                    p_write_token: playerData.writeToken || ''
                  });
                  await refreshGameState();
                }
              } catch (error) {
                console.error('Error advancing phase:', error);
                setError('Failed to advance phase');
              }
            }}
            writeToken={playerData.writeToken || ''}
            isHost={playerData.isHost}
          />
        </div>
      </div>
    );
  }

  // Voting phase
  if (currentPhase === 'vote') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center p-4">
        <RealtimeStatusIndicator />
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full">
          <VotePanel
            roundId={gameState.id}
            players={gameState.players || []}
            currentPlayerId={playerData.playerId}
            imposterId={gameState.imposter_id}
            onVotingComplete={async () => {
              try {
                const { data: roundData } = await supabase
                  .from('rounds')
                  .select('id')
                  .eq('room_id', playerData.roomId)
                  .order('round_number', { ascending: false })
                  .limit(1)
                  .single();
                
                if (roundData) {
                  await supabase.rpc('advance_phase', {
                    p_round_id: roundData.id,
                    p_write_token: playerData.writeToken || ''
                  });
                  await refreshGameState();
                }
              } catch (error) {
                console.error('Error advancing phase:', error);
                setError('Failed to advance phase');
              }
            }}
            writeToken={playerData.writeToken || ''}
            allowSelfVote={false}
          />
        </div>
      </div>
    );
  }

  // Imposter guess phase
  if (currentPhase === 'imposter_guess') {
    const isImposter = currentPlayer?.id === gameState?.imposter_id;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <RealtimeStatusIndicator />
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">🎯</div>
          <h1 className="text-4xl font-bold text-white mb-4">Imposter Guess</h1>
          
          {isImposter ? (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Guess the Secret Prompt!</h2>
              <p className="text-white/70 mb-6">
                You get a bonus point if you guess correctly!
              </p>
              
              <div className="space-y-3 mb-6">
                {gameState.text_prompts?.map((prompt: TextPrompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => setImposterGuess(prompt.id)}
                    className={`w-full py-3 px-4 rounded-xl font-bold transition-all text-left ${
                      imposterGuess === prompt.id
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    <div className="text-sm">{prompt.prompt}</div>
                    <div className="text-xs opacity-70 mt-1">({prompt.category})</div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={async () => {
                  try {
                    // Get current round ID
                    const { data: roundData } = await supabase
                      .from('rounds')
                      .select('id')
                      .eq('room_id', playerData.roomId)
                      .order('round_number', { ascending: false })
                      .limit(1)
                      .single();
                    
                    if (!roundData) {
                      setError('No active round found');
                      return;
                    }
                    
                    // Use the integrated updateScores function
                    await gameStore.updateScores(
                      roundData.id,
                      imposterGuess,
                      playerData.writeToken || ''
                    );
                    
                    console.log('Round ended successfully, scores updated');
                    
                    // Refresh game state to get updated scores
                    await refreshGameState();
                  } catch (error) {
                    console.error('Error ending round:', error);
                    setError('Failed to end round');
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-yellow-400/30 text-lg"
              >
                Submit Guess & End Round
              </button>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Waiting for Imposter</h2>
              <p className="text-white/70">
                The imposter is making their final guess...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Results phase
  if (currentPhase === 'reveal' || currentPhase === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <RealtimeStatusIndicator />
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-6xl w-full">
          <ResultsPanel
            roundId={gameState.id}
            players={gameState.players || []}
            imposterId={gameState.imposter_id}
            onNextRound={async () => {
              try {
                // Use the integrated startRound function
                await gameStore.startRound(
                  playerData.roomId,
                  playerData.writeToken || '',
                  4
                );
                // Refresh game state to get the new round data
                await refreshGameState();
              } catch (error) {
                console.error('Error starting next round:', error);
                setError('Failed to start next round');
              }
            }}
            onEndGame={onBackToLobby}
            writeToken={playerData.writeToken || ''}
            isHost={playerData.isHost}
          />
        </div>
      </div>
    );
  }

  return null;
}