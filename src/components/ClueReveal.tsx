import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { getPlayerToken } from '../utils/device';
import { Clue, Player } from '../types/game';

interface ClueRevealProps {
  onAdvancePhase: () => void;
}

export function ClueReveal({ onAdvancePhase }: ClueRevealProps) {
  const { room, currentPlayer, currentRound, clues, setClues, players } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!currentRound?.phase_deadline) return;

    const deadline = new Date(currentRound.phase_deadline);
    const now = new Date();
    const timeLeft = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
    
    setCountdown(timeLeft);

    const timer = setInterval(() => {
      const newTimeLeft = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
      setCountdown(newTimeLeft);
      
      if (newTimeLeft === 0) {
        clearInterval(timer);
        onAdvancePhase();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentRound?.phase_deadline, onAdvancePhase]);

  useEffect(() => {
    if (!currentRound) return;
    
    fetchClues();
    
    // Auto-reveal after a short delay
    const timer = setTimeout(() => {
      setRevealed(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentRound?.id]);

  const fetchClues = async () => {
    if (!currentRound) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clues')
        .select(`
          *,
          players!inner (
            id,
            name,
            avatar
          )
        `)
        .eq('round_id', currentRound.id)
        .order('submitted_at');

      if (error) throw error;
      setClues(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch clues');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancePhase = async () => {
    if (!room || !currentPlayer?.is_host || !currentRound) return;

    try {
      const token = getPlayerToken(room.code);
      if (!token) throw new Error('Authentication token not found');

      const { error } = await supabase.rpc('advance_phase', {
        p_round_id: currentRound.id,
        p_write_token: token,
      });

      if (error) throw error;
      onAdvancePhase();
    } catch (err: any) {
      setError(err.message || 'Failed to advance phase');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading clues...</p>
        </div>
      </div>
    );
  }

  if (error || !currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error || 'Failed to load clues'}</p>
          <button
            onClick={fetchClues}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isImposter = currentPlayer?.id === currentRound.imposter_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            🕵️ Round {currentRound.round_number} - Clue Reveal
          </h1>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 inline-block">
            <div className="text-white text-lg">
              {countdown > 0 ? (
                <>Discussion time: <span className="font-bold">{countdown}s</span></>
              ) : (
                'Time to vote!'
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              All Clues Revealed
            </h2>
            <p className="text-gray-600">
              {isImposter 
                ? "Study these clues carefully. Which word do you think is the secret word?"
                : "Look for the clue that doesn't quite fit. Who might be the imposter?"
              }
            </p>
          </div>

          <div className="space-y-4">
            {clues.map((clue, index) => {
              const player = clue.players as Player;
              const isCurrentPlayer = currentPlayer?.id === clue.player_id;
              
              return (
                <div
                  key={clue.id}
                  className={`
                    p-4 rounded-xl border-2 transition-all duration-500 transform
                    ${revealed 
                      ? 'translate-y-0 opacity-100' 
                      : 'translate-y-4 opacity-0'
                    }
                    ${isCurrentPlayer 
                      ? 'bg-gradient-to-r from-blue-100 to-purple-100 border-blue-300' 
                      : 'bg-gray-50 border-gray-200'
                    }
                  `}
                  style={{ transitionDelay: `${index * 200}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{player.avatar}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{player.name}</span>
                        {isCurrentPlayer && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        "{clue.word}"
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {clues.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No clues submitted yet...</p>
            </div>
          )}
        </div>

        {isImposter && (
          <div className="bg-gradient-to-r from-red-100 to-orange-100 rounded-2xl p-6 mb-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-red-800 mb-2">
                🕵️ Imposter Mission
              </h3>
              <p className="text-red-700">
                You need to guess which word is the secret word! Look at the clues and try to figure out what the crew members are hinting at.
              </p>
            </div>
          </div>
        )}

        {currentPlayer?.is_host && (
          <div className="text-center">
            <button
              onClick={handleAdvancePhase}
              className="px-8 py-4 bg-white hover:bg-gray-100 text-purple-600 rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Start Voting Phase
            </button>
          </div>
        )}

        {!currentPlayer?.is_host && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur rounded-xl text-white">
              <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
              <span>Waiting for host to start voting...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 rounded-xl text-red-700 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
