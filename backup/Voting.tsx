import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { getPlayerToken } from '../utils/device';
import { Vote, Player } from '../types/game';

interface VotingProps {
  onAdvancePhase: () => void;
}

export function Voting({ onAdvancePhase }: VotingProps) {
  const { room, currentPlayer, currentRound, votes, setVotes, players } = useGameStore();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(45);
  const [voted, setVoted] = useState(false);

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
    if (!currentRound || !currentPlayer) return;
    
    fetchVotes();
    checkIfVoted();
  }, [currentRound?.id, currentPlayer?.id]);

  const fetchVotes = async () => {
    if (!currentRound) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('round_id', currentRound.id);

      if (error) throw error;
      setVotes(data || []);
    } catch (err: any) {
      console.error('Failed to fetch votes:', err);
    }
  };

  const checkIfVoted = async () => {
    if (!currentRound || !currentPlayer) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('round_id', currentRound.id)
        .eq('voter_id', currentPlayer.id)
        .single();

      if (data) {
        setVoted(true);
        setSelectedPlayerId(data.target_id);
      }
    } catch (err) {
      // No vote submitted yet
    }
  };

  const handleVote = async (targetPlayerId: string) => {
    if (!room || !currentPlayer || !currentRound || targetPlayerId === currentPlayer.id) return;

    setLoading(true);
    setError('');

    try {
      const token = getPlayerToken(room.code);
      if (!token) throw new Error('Authentication token not found');

      const { error } = await supabase.rpc('cast_vote', {
        p_round_id: currentRound.id,
        p_voter_id: currentPlayer.id,
        p_target_id: targetPlayerId,
        p_write_token: token,
      });

      if (error) throw error;
      
      setVoted(true);
      setSelectedPlayerId(targetPlayerId);
      fetchVotes(); // Refresh votes list
    } catch (err: any) {
      setError(err.message || 'Failed to cast vote');
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

  if (!currentRound || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading game...</p>
        </div>
      </div>
    );
  }

  const isImposter = currentPlayer.id === currentRound.imposter_id;
  const votedCount = votes.length;
  const totalPlayers = players.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            🕵️ Round {currentRound.round_number} - Voting
          </h1>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 inline-block">
            <div className="text-white text-lg">
              {countdown > 0 ? (
                <>Voting time: <span className="font-bold">{countdown}s</span></>
              ) : (
                'Time\'s up!'
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Secret Ballot Voting
            </h2>
            <p className="text-gray-600">
              {isImposter 
                ? "Vote for who you think is most suspicious. Try to blend in!"
                : "Vote for who you think is the imposter. Look for the odd clue!"
              }
            </p>
          </div>

          {!voted ? (
            <div className="space-y-3">
              {players
                .filter(player => player.id !== currentPlayer.id)
                .map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleVote(player.id)}
                    disabled={loading}
                    className="w-full p-4 bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-purple-300 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{player.avatar}</div>
                      <div>
                        <div className="font-bold text-gray-800 text-lg">{player.name}</div>
                        <div className="text-sm text-gray-500">Click to vote for this player</div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-100 text-green-800 rounded-xl mb-4">
                <span className="text-2xl">✅</span>
                <span className="font-medium">
                  Vote cast for {players.find(p => p.id === selectedPlayerId)?.name}
                </span>
              </div>
              <p className="text-gray-600">
                Waiting for other players to vote...
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 rounded-xl text-red-700 text-center">
              {error}
            </div>
          )}

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-xl text-white">
              <span className="text-sm">Votes cast: {votedCount}/{totalPlayers}</span>
            </div>
          </div>
        </div>

        {isImposter && (
          <div className="bg-gradient-to-r from-red-100 to-orange-100 rounded-2xl p-6 mb-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-red-800 mb-2">
                🕵️ Imposter Strategy
              </h3>
              <p className="text-red-700">
                Try to vote for someone else to deflect suspicion. Don't make it obvious!
              </p>
            </div>
          </div>
        )}

        {currentPlayer.is_host && (
          <div className="text-center">
            <button
              onClick={handleAdvancePhase}
              className="px-8 py-4 bg-white hover:bg-gray-100 text-purple-600 rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Reveal Results
            </button>
          </div>
        )}

        {!currentPlayer.is_host && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur rounded-xl text-white">
              <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
              <span>Waiting for host to reveal results...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
