import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { TopicCard } from './TopicCard';
import { getPlayerToken } from '../utils/device';
import type { Topic, Round } from '../types/game';

interface RoleRevealProps {
  onAdvancePhase: () => void;
}

export function RoleReveal({ onAdvancePhase }: RoleRevealProps) {
  const { room, currentPlayer, currentRound, topic, setCurrentRound, setTopic } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!room || !currentPlayer) return;
    
    fetchRoundData();
  }, [room?.id, currentPlayer?.id]);

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

  const fetchRoundData = async () => {
    if (!room || !currentPlayer) return;

    try {
      setLoading(true);
      
      // Get the current round
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select(`
          *,
          topics (*)
        `)
        .eq('room_id', room.id)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();

      if (roundError) throw roundError;

      setCurrentRound(roundData);
      setTopic(roundData.topics as Topic);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch round data');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
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
          <p className="text-xl">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !currentRound || !topic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error || 'Failed to load game data'}</p>
          <button
            onClick={fetchRoundData}
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
            🕵️ Round {currentRound.round_number}
          </h1>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 inline-block">
            <div className="text-white text-lg">
              {countdown > 0 ? (
                <>Role reveal ends in: <span className="font-bold">{countdown}s</span></>
              ) : (
                'Waiting for next phase...'
              )}
            </div>
          </div>
        </div>

        <TopicCard
          topic={topic}
          secretWordIndex={currentRound.secret_word_index}
          isImposter={isImposter}
          playerRole={isImposter ? 'imposter' : 'crew'}
        />

        {currentPlayer?.is_host && (
          <div className="text-center">
            <button
              onClick={handleContinue}
              className="px-8 py-4 bg-white hover:bg-gray-100 text-purple-600 rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Continue to Clue Phase
            </button>
          </div>
        )}

        {!currentPlayer?.is_host && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur rounded-xl text-white">
              <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
              <span>Waiting for host to continue...</span>
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