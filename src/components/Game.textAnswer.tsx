import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getThemePacks, getRandomPromptsFromTheme, ThemePack } from '../textPrompts';
import { RevealGrid } from './round/RevealGrid';
import { ScoreboardScreen } from './ScoreboardScreen';

// Decoy prompts for imposters - generic questions that could apply to any topic
const decoyPrompts = [
  "What's your favorite thing about this topic?",
  "Describe something related to this topic in one word.",
  "What would you do if you were an expert in this topic?",
  "What is the most interesting aspect of this topic?",
  "What's your personal connection to this topic?",
  "How would you explain this topic to a child?",
  "What's the most challenging part of this topic?",
  "What's your favorite memory related to this topic?",
  "What's your first thought when you hear about this topic?",
  "What's the most surprising thing about this topic?",
  "How does this topic make you feel?",
  "What's your go-to fact about this topic?",
  "What's the most important thing to know about this topic?",
  "What's your favorite way to experience this topic?",
  "What's the most fun part of this topic?",
  "What's your least favorite thing about this topic?",
  "What's the most creative aspect of this topic?",
  "What's your favorite story about this topic?",
  "What's the most practical use of this topic?",
  "What's your favorite detail about this topic?"
];

// Function to get a decoy prompt for imposters
const getDecoyPrompt = (originalPrompt: string): string => {
  const randomIndex = Math.floor(Math.random() * decoyPrompts.length);
  return decoyPrompts[randomIndex];
};

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

interface Prompt {
  id: number;
  text: string;
  order: number;
}

interface Answer {
  id: number;
  player_id: string;
  prompt_id: number;
  answer_text: string;
}

export function Game({ onBackToLobby, playerData }: GameProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<'role_reveal' | 'answer' | 'reveal_answers' | 'vote' | 'imposter_guess' | 'reveal' | 'scoreboard' | 'done'>('role_reveal');
  const [answers, setAnswers] = useState<{ [promptId: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [imposterGuess, setImposterGuess] = useState<number>(1);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string>('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [allAnswers, setAllAnswers] = useState<Answer[]>([]);
  const [themePacks, setThemePacks] = useState<ThemePack[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>('random');
  const [promptCount, setPromptCount] = useState<number>(3);

  useEffect(() => {
    console.log('Text Answer Game component mounted, initializing...');
    setThemePacks(getThemePacks());
    initializeGame();
    setupRealtimeSubscription();
    
    const refreshInterval = setInterval(() => {
      console.log('Periodic refresh of game state');
      refreshGameState();
    }, 5000);
    
    return () => {
      cleanupSubscriptions();
      clearInterval(refreshInterval);
    };
  }, [playerData.roomId]);

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
      console.log('Imposter has made their guess, auto-advancing to scoreboard phase...');
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

  // Auto-advance from scoreboard after showing it for a bit
  useEffect(() => {
    if (currentPhase === 'scoreboard' && playerData.isHost) {
      console.log('Scoreboard phase, auto-advancing after delay...');
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
      
      // Show scoreboard for 10 seconds before auto-advancing
      const timer = setTimeout(advancePhase, 10000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, playerData.isHost, playerData.roomId, playerData.writeToken]);

  const cleanupSubscriptions = () => {
    supabase.removeAllChannels();
  };

  const refreshGameState = async () => {
    try {
      console.log('Refreshing game state for room:', playerData.roomId);
      
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select(`
          *,
          topics (
            id, category, topic, word1, word2, word3, word4, word5, word6, word7, word8, family_safe
          )
        `)
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
        console.log('No active round found');
        setGameState(null);
        setCurrentPlayer(null);
        setLoading(false);
        return;
      }

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

      const { data: answersData, error: answersError } = await supabase
        .from('answers')
        .select('*')
        .eq('round_id', roundData.id);

      if (answersError) {
        console.error('Error fetching answers:', answersError);
        setError('Failed to load answers');
        return;
      }

      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('round_id', roundData.id);

      if (votesError) {
        console.error('Error fetching votes:', votesError);
        setError('Failed to load votes');
        return;
      }

      const votes: { [key: string]: string } = {};
      votesData?.forEach(vote => {
        votes[vote.voter_id] = vote.target_id;
      });

      const playersWithRoles = (playersData || []).map((player: any) => ({
        ...player,
        role: player.id === roundData.imposter_id ? 'imposter' : 'detective'
      }));

      const gameStateData = {
        id: roundData.id,
        room_id: playerData.roomId,
        current_phase: roundData.phase,
        imposter_id: roundData.imposter_id,
        players: playersWithRoles,
        votes: votes,
        is_active: true
      };

      console.log('Game state refreshed:', gameStateData);
      setGameState(gameStateData);
      setCurrentPhase(roundData.phase as any);
      setPrompts(promptsData || []);
      setAllAnswers(answersData || []);
      setError('');
      
      const player = playersWithRoles?.find((p: any) => p.id === playerData.playerId);
      setCurrentPlayer(player || null);
      
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
          refreshGameState();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'prompts', 
          filter: `round_id=eq.${playerData.roomId}` 
        },
        (payload) => {
          console.log('Prompts changed via realtime:', payload);
          refreshGameState();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'answers', 
          filter: `round_id=eq.${playerData.roomId}` 
        },
        (payload) => {
          console.log('Answers changed via realtime:', payload);
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
          console.log('Votes changed via realtime:', payload);
          refreshGameState();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return channel;
  };

  const initializeGame = async () => {
    try {
      console.log('Fetching players for room:', playerData.roomId);
      
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', playerData.roomId)
        .order('joined_at');

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

      await refreshGameState();
      
    } catch (error) {
      console.error('Error initializing game:', error);
      setError('Failed to initialize game');
      setLoading(false);
    }
  };

  const startTextAnswerRound = async () => {
    if (!playerData.isHost) return;

    try {
      const selectedPrompts = getRandomPromptsFromTheme(selectedTheme, promptCount);
      
      const { data: roundData, error: roundError } = await supabase.rpc('start_round', {
        p_room_id: playerData.roomId,
        p_write_token: playerData.writeToken || ''
      });

      if (roundError) {
        console.error('Error starting round:', roundError);
        setError('Failed to start round');
        return;
      }

      // Create prompts for crew members (normal prompts)
      const { error: promptsError } = await supabase
        .from('prompts')
        .insert(
          selectedPrompts.map((promptText, index) => ({
            round_id: roundData.round_id,
            prompt_text: promptText,
            prompt_order: index + 1
          }))
        );

      if (promptsError) {
        console.error('Error creating prompts:', promptsError);
        setError('Failed to create prompts');
        return;
      }

      // Create decoy prompts for the imposter (blanks or misleading prompts)
      const decoyPrompts = generateDecoyPrompts(selectedPrompts);
      const { error: decoyPromptsError } = await supabase
        .from('prompts')
        .insert(
          decoyPrompts.map((promptText, index) => ({
            round_id: roundData.round_id,
            prompt_text: promptText,
            prompt_order: index + 1,
            is_imposter_prompt: true
          }))
        );

      if (decoyPromptsError) {
        console.error('Error creating decoy prompts:', decoyPromptsError);
        setError('Failed to create decoy prompts');
        return;
      }

      await refreshGameState();
    } catch (error) {
      console.error('Error starting text answer round:', error);
      setError('Failed to start round');
    }
  };

  const generateDecoyPrompts = (originalPrompts: string[]): string[] => {
    // Generate decoy prompts for the imposter
    // Mix of blanks and misleading prompts
    return originalPrompts.map((prompt, index) => {
      const decoyType = Math.random();
      if (decoyType < 0.3) {
        // 30% chance of blank
        return '';
      } else if (decoyType < 0.6) {
        // 30% chance of generic prompt
        return 'What do you think about this?';
      } else {
        // 40% chance of slightly modified prompt
        return prompt.replace(/\?$/, '? (Be creative!)');
      }
    });
  };

  const handleAnswerSubmit = async (promptId: number, answerText: string) => {
    if (!answerText.trim() || !gameState) return;

    try {
      const { error } = await supabase
        .from('answers')
        .upsert({
          round_id: gameState.id,
          player_id: playerData.playerId,
          prompt_id: promptId,
          answer_text: answerText.trim()
        });

      if (error) {
        console.error('Error submitting answer:', error);
        setError('Failed to submit answer');
        return;
      }

      setAnswers(prev => ({ ...prev, [promptId]: answerText.trim() }));
      await refreshGameState();
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('Network error while submitting answer');
    }
  };

  const handleVote = async (targetId: string) => {
    if (!gameState) return;
    
    setSelectedVote(targetId);
    
    try {
      const { error } = await supabase
        .from('votes')
        .upsert({
          round_id: gameState.id,
          voter_id: playerData.playerId,
          target_id: targetId
        });

      if (error) {
        console.error('Error submitting vote:', error);
        setError('Failed to submit vote');
        return;
      }

      await refreshGameState();
    } catch (error) {
      console.error('Error voting:', error);
      setError('Network error while voting');
    }
  };

  const handleEndRound = async (imposterGuessIndex: number) => {
    if (!playerData.isHost || !gameState) return;

    try {
      const { data: endRoundData, error } = await supabase.rpc('end_round', {
        p_round_id: gameState.id,
        p_imposter_guess_index: imposterGuessIndex,
        p_write_token: playerData.writeToken || ''
      });
      
      if (error) {
        console.error('Error ending round:', error);
        setError('Failed to end round');
        return;
      }
      
      await refreshGameState();
    } catch (error) {
      console.error('Error ending round:', error);
      setError('Failed to end round');
    }
  };

  const advancePhase = async () => {
    if (!playerData.isHost || !gameState) return;

    try {
      await supabase.rpc('advance_phase', {
        p_round_id: gameState.id,
        p_write_token: playerData.writeToken || ''
      });
      await refreshGameState();
    } catch (error) {
      console.error('Error advancing phase:', error);
      setError('Failed to advance phase');
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
  if (currentPhase === 'role_reveal') {
    const isImposter = currentPlayer?.role === 'imposter';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full text-center">
          <div className="text-6xl mb-6">🎭</div>
          <h1 className="text-4xl font-bold text-white mb-4">Role Reveal</h1>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Your Role</h2>
            <div className="text-6xl mb-4">{isImposter ? '🦹' : '🕵️'}</div>
            <p className="text-xl text-white font-semibold">
              {isImposter ? 'Imposter' : 'Detective'}
            </p>
            <p className="text-white/70 mt-2">
              {isImposter 
                ? 'Blend in by giving answers that could apply to any question!'
                : 'Find the Imposter by analyzing everyone\'s answers!'}
            </p>
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
            <div className="space-y-4">
              {/* Theme and Settings Selection */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Game Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-white font-medium mb-2">Theme Pack:</label>
                    <select
                      value={selectedTheme}
                      onChange={(e) => setSelectedTheme(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {themePacks.map(theme => (
                        <option key={theme.id} value={theme.id} className="bg-gray-800">
                          {theme.icon} {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Number of Questions:</label>
                    <select
                      value={promptCount}
                      onChange={(e) => setPromptCount(parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {[3, 4, 5].map(count => (
                        <option key={count} value={count} className="bg-gray-800">
                          {count} Questions
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={startTextAnswerRound}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
              >
                Start Text Answer Round
              </button>
            </div>
          )}
          
          {!playerData.isHost && (
            <div className="text-center">
              <p className="text-white/70">Waiting for host to start the game...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Answer phase
  if (currentPhase === 'answer') {
    const isImposter = currentPlayer?.role === 'imposter';
    const hasSubmittedAllAnswers = prompts.every(prompt => 
      allAnswers.some(answer => 
        answer.player_id === playerData.playerId && answer.prompt_id === prompt.id
      )
    );
    
    // Get prompts for the current player (different for imposter)
    const playerPrompts = isImposter 
      ? prompts.filter(p => p.is_imposter_prompt) 
      : prompts.filter(p => !p.is_imposter_prompt);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4 animate-phase-transition">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full">
          <div className="text-center mb-8 animate-slideInDown">
            <h1 className="text-4xl font-bold text-white mb-2">📝 Answer Phase</h1>
            <p className="text-white/80">
              {isImposter 
                ? "Blend in by giving answers that could apply to any question!" 
                : "Answer each question honestly!"}
            </p>
            {isImposter && (
              <div className="mt-4 bg-red-500/20 border border-red-400/30 rounded-xl p-4">
                <p className="text-red-200 text-sm">
                  🦹 You're the Imposter! The questions you see are different from everyone else. 
                  Try to blend in with your answers!
                </p>
              </div>
            )}
          </div>

          {!hasSubmittedAllAnswers ? (
            <div className="space-y-6">
              {playerPrompts.map((prompt, index) => {
                const existingAnswer = allAnswers.find(answer => 
                  answer.player_id === playerData.playerId && answer.prompt_id === prompt.id
                );
                const answerText = existingAnswer?.answer_text || answers[prompt.id] || '';
                
                return (
                  <div key={prompt.id} className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 animate-slideInUp ${isImposter ? 'ring-2 ring-red-400/30' : ''}`} style={{ animationDelay: `${index * 0.1}s` }}>
                    <h3 className="text-xl font-bold text-white mb-4">
                      Question {index + 1}
                      {isImposter && <span className="text-red-400 text-sm ml-2">(Imposter View)</span>}
                    </h3>
                    <p className="text-white/90 text-lg mb-4">
                      {prompt.text || 'Answer this question creatively...'}
                    </p>
                    
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={answerText}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                        placeholder={isImposter ? "Give a vague answer..." : "Your answer..."}
                        className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-300"
                        disabled={!!existingAnswer}
                      />
                      <button
                        onClick={() => handleAnswerSubmit(prompt.id, answerText)}
                        disabled={!answerText.trim() || !!existingAnswer}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-green-400/30 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                      >
                        {existingAnswer ? '✓ Submitted' : 'Submit'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-white text-xl mb-4">All answers submitted!</p>
              <p className="text-white/70">Waiting for other players...</p>
              
              <div className="mt-8 space-y-2">
                <p className="text-white/70 text-sm">Players who have submitted:</p>
                {gameState.players?.map((p: Player) => {
                  const submitted = prompts.every(prompt => 
                    allAnswers.some(answer => 
                      answer.player_id === p.id && answer.prompt_id === prompt.id
                    )
                  );
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
            </div>
          )}
        </div>
      </div>
    );
  }

  // Reveal answers phase
  if (currentPhase === 'reveal_answers') {
    // For reveal phase, we need to get all prompts (both regular and imposter)
    // This should be handled by fetching all prompts for the round
    const allPrompts = prompts.filter(p => !p.is_imposter_prompt); // Show only regular prompts in reveal
    
    return (
      <RevealGrid
        players={gameState.players || []}
        prompts={allPrompts}
        answers={allAnswers}
        currentPlayerId={playerData.playerId}
        onDiscussAndVote={advancePhase}
        onVote={handleVote}
        votes={gameState.votes || {}}
        hasVoted={gameState.votes?.[playerData.playerId] !== undefined}
        isImposter={currentPlayer?.role === 'imposter'}
        imposterId={gameState.imposter_id}
      />
    );
  }

  // Voting phase
  if (currentPhase === 'vote') {
    const hasVoted = gameState.votes?.[playerData.playerId] !== undefined;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center p-4 animate-phase-transition">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8 animate-slideInDown">
            <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              🗳️ Voting Phase
            </h1>
            <p className="text-white/80 text-lg">Who do you think is the imposter?</p>
          </div>

          {!hasVoted ? (
            <div className="space-y-4 mb-8">
              {gameState.players?.map((player: Player, index) => (
                <button
                  key={player.id}
                  onClick={() => handleVote(player.id)}
                  disabled={player.id === playerData.playerId}
                  className={`w-full bg-white/10 backdrop-blur-sm border rounded-xl p-6 flex items-center space-x-4 transition-all duration-300 transform hover:scale-105 active:scale-95 animate-slideInUp ${
                    player.id === playerData.playerId 
                      ? 'opacity-50 cursor-not-allowed border-gray-500' 
                      : selectedVote === player.id
                      ? 'border-yellow-400 bg-yellow-400/20 shadow-yellow-400/30 shadow-lg'
                      : 'border-white/20 hover:bg-white/20 hover:shadow-lg'
                  }`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="text-4xl animate-bounce" style={{ animationDelay: `${index * 0.2}s` }}>
                    {player.avatar}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-bold text-lg">
                      {player.name} {player.id === playerData.playerId && (
                        <span className="text-blue-400 text-sm ml-2 bg-blue-500/20 px-2 py-1 rounded-full">(You)</span>
                      )}
                    </p>
                    <p className="text-white/70 text-sm">
                      {allAnswers.filter(a => a.player_id === player.id).length} answers submitted
                    </p>
                    {player.role === 'imposter' && (
                      <div className="text-red-400 text-sm font-medium bg-red-500/20 px-2 py-1 rounded-full mt-1 inline-block">
                        🦹 Imposter
                      </div>
                    )}
                  </div>
                  {selectedVote === player.id && (
                    <div className="text-yellow-400 text-3xl animate-bounce">✓</div>
                  )}
                </button>
              ))}
            </div>
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
            </div>
          )}
        </div>
      </div>
    );
  }

  // Imposter guess phase
  if (currentPhase === 'imposter_guess') {
    const isImposter = currentPlayer?.id === gameState?.imposter_id;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">🎯</div>
          <h1 className="text-4xl font-bold text-white mb-4">Imposter Guess</h1>
          
          {isImposter ? (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Guess the Secret Word!</h2>
              <p className="text-white/70 mb-6">
                You get a bonus point if you guess correctly!
              </p>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                  <button
                    key={index}
                    onClick={() => setImposterGuess(index)}
                    className={`py-3 px-4 rounded-xl font-bold transition-all ${
                      imposterGuess === index
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    Word {index}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => handleEndRound(imposterGuess)}
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

  // Scoreboard phase
  if (currentPhase === 'scoreboard') {
    const gameWinner = gameState.players?.find((p: Player) => 
      (p.total_score ?? 0) >= (gameState.room?.win_target || 5)
    );

    return (
      <ScoreboardScreen
        players={gameState.players || []}
        currentPlayerId={playerData.playerId}
        imposterId={gameState.imposter_id}
        roundNumber={gameState.current_round || 1}
        maxRounds={10}
        winTarget={gameState.room?.win_target || 5}
        gameWinner={gameWinner}
        onNextRound={startTextAnswerRound}
        onNewGame={startTextAnswerRound}
        onBackToLobby={onBackToLobby}
        isHost={playerData.isHost}
        showActions={true}
      />
    );
  }

  // Results phase (legacy - now redirects to scoreboard)
  if (currentPhase === 'reveal' || currentPhase === 'done') {
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
    
    // Check for game winner
    const gameWinner = gameState.players?.find((p: Player) => 
      (p.total_score ?? 0) >= (gameState.room?.win_target || 5)
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4 animate-phase-transition">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full text-center">
          <div className="text-8xl mb-6 animate-bounceIn">{detectivesWin ? '🎉' : '😈'}</div>
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent animate-slideInDown">
            Round Results
          </h1>
          
          {gameWinner && (
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm border border-yellow-400/30 rounded-2xl p-6 mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-bold text-yellow-400 mb-2">GAME WINNER!</h2>
              <div className="text-2xl text-white font-semibold mb-2">{gameWinner.name}</div>
              <p className="text-yellow-200">Reached {gameWinner.total_score ?? 0} points!</p>
            </div>
          )}
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Round Summary</h2>
            <div className={`p-4 rounded-xl mb-4 ${
              detectivesWin 
                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30' 
                : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30'
            }`}>
              <p className={`text-xl font-semibold mb-2 ${
                detectivesWin ? 'text-green-300' : 'text-red-300'
              }`}>
                {detectivesWin ? '🕵️ The detectives caught the imposter!' : '🦹 The imposter fooled everyone!'}
              </p>
              <p className={`text-sm ${
                detectivesWin ? 'text-green-200/80' : 'text-red-200/80'
              }`}>
                {detectivesWin ? 'Crew members each earned 1 point!' : 'The imposter earned 2 points!'}
              </p>
            </div>
            
            {/* Highlight the imposter */}
            <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-3xl">{imposter?.avatar}</span>
                <div>
                  <p className="text-red-300 font-bold text-xl">{imposter?.name}</p>
                  <p className="text-red-400 text-sm font-medium">🦹 THE IMPOSTER</p>
                </div>
              </div>
              <p className="text-red-200/80 text-sm text-center">
                {detectivesWin ? 'Was caught by the crew!' : 'Successfully fooled everyone!'}
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Vote Results:</h3>
            <div className="space-y-2">
              {gameState.players?.map((player: Player) => {
                const isImposter = player.id === gameState.imposter_id;
                const voteCount = voteCounts[player.id] || 0;
                const wasVotedFor = voteCount > 0;
                
                return (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${
                      isImposter 
                        ? 'bg-red-500/10 border border-red-400/30 ring-2 ring-red-400/20' 
                        : wasVotedFor 
                        ? 'bg-yellow-500/10 border border-yellow-400/30' 
                        : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{player.avatar}</span>
                      <div>
                        <span className={`font-semibold ${
                          isImposter ? 'text-red-300' : 'text-white'
                        }`}>
                          {player.name}
                        </span>
                        {isImposter && (
                          <span className="text-red-400 text-sm ml-2 bg-red-500/20 px-2 py-1 rounded-full">
                            🦹 IMPOSTER
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${
                        isImposter ? 'text-red-300' : 'text-yellow-400'
                      }`}>
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </span>
                      {wasVotedFor && (
                        <span className="text-yellow-400 text-xl">🗳️</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Scoreboard:</h3>
            <div className="space-y-3">
              {gameState.players?.map((player: Player) => {
                const isImposter = player.id === gameState.imposter_id;
                const earnedPoints = isImposter 
                  ? (detectivesWin ? 0 : 2) 
                  : (detectivesWin ? 1 : 0);
                const previousScore = (player.total_score ?? 0) - earnedPoints;
                
                return (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                      isImposter 
                        ? 'bg-red-500/10 border border-red-400/30' 
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{player.avatar}</span>
                      <div>
                        <span className={`font-semibold text-lg ${
                          isImposter ? 'text-red-300' : 'text-white'
                        }`}>
                          {player.name}
                        </span>
                        {isImposter && (
                          <span className="text-red-400 text-sm ml-2 bg-red-500/20 px-2 py-1 rounded-full">
                            🦹 IMPOSTER
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {earnedPoints > 0 && (
                        <div className="text-center">
                          <div className="text-green-400 text-sm font-semibold">+{earnedPoints}</div>
                          <div className="text-green-300/70 text-xs">this round</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          isImposter ? 'text-red-300' : 'text-yellow-400'
                        }`}>
                          {player.total_score ?? 0}
                        </div>
                        <div className="text-white/60 text-xs">total points</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Score explanation */}
            <div className="mt-4 p-3 bg-white/5 rounded-xl">
              <p className="text-white/70 text-sm text-center">
                {detectivesWin 
                  ? '🕵️ Crew members earned 1 point each for catching the imposter!' 
                  : '🦹 The imposter earned 2 points for fooling everyone!'
                }
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {playerData.isHost && !gameWinner && (
              <button
                onClick={startTextAnswerRound}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
              >
                Next Round
              </button>
            )}
            {gameWinner && (
              <button
                onClick={startTextAnswerRound}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-yellow-400/30 text-lg"
              >
                New Game
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

  // Fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-6">🚧</div>
        <h2 className="text-2xl font-bold text-white mb-4">Unknown Phase</h2>
        <p className="text-white/80 mb-6">Current phase: {currentPhase}</p>
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
