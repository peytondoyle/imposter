import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { getPlayerToken } from '../utils/device';
import { TopicCard } from './TopicCard';

interface ClueInputProps {
  onAdvancePhase: () => void;
}

export function ClueInput({ onAdvancePhase }: ClueInputProps) {
  const { room, currentPlayer, currentRound, topic, clues, setClues } = useGameStore();
  const [clue, setClue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [submitted, setSubmitted] = useState(false);

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
    if (!room || !currentPlayer || !currentRound) return;
    
    fetchClues();
    checkIfSubmitted();
  }, [room?.id, currentPlayer?.id, currentRound?.id]);

  const fetchClues = async () => {
    if (!currentRound) return;

    try {
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('round_id', currentRound.id);

      if (error) throw error;
      setClues(data || []);
    } catch (err: any) {
      console.error('Failed to fetch clues:', err);
    }
  };

  const checkIfSubmitted = async () => {
    if (!currentRound || !currentPlayer) return;

    try {
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('round_id', currentRound.id)
        .eq('player_id', currentPlayer.id)
        .single();

      if (data) {
        setSubmitted(true);
        setClue(data.word);
      }
    } catch (err) {
      // No clue submitted yet
    }
  };

  const handleSubmitClue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clue.trim() || !room || !currentPlayer || !currentRound) return;

    setLoading(true);
    setError('');

    try {
      const token = getPlayerToken(room.code);
      if (!token) throw new Error('Authentication token not found');

      const { error } = await supabase.rpc('submit_clue', {
        p_round_id: currentRound.id,
        p_player_id: currentPlayer.id,
        p_word: clue.trim(),
        p_write_token: token,
      });

      if (error) throw error;
      
      setSubmitted(true);
      fetchClues(); // Refresh clues list
    } catch (err: any) {
      setError(err.message || 'Failed to submit clue');
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

  if (!currentRound || !topic || !currentPlayer) {
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
  const submittedCount = clues.length;
  const totalPlayers = room ? 1 : 0; // We'll get this from the store

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            🕵️ Round {currentRound.round_number} - Clue Phase
          </h1>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 inline-block">
            <div className="text-white text-lg">
              {countdown > 0 ? (
                <>Time remaining: <span className="font-bold">{countdown}s</span></>
              ) : (
                'Time\'s up!'
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

        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Submit Your Clue
            </h2>
            <p className="text-gray-600">
              {isImposter 
                ? "Give a vague clue that could apply to any word. Don't be too obvious!"
                : "Give a clue about the secret word. Help your crewmates identify it!"
              }
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmitClue} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={clue}
                  onChange={(e) => setClue(e.target.value)}
                  maxLength={25}
                  className="w-full px-6 py-4 text-xl text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter your one-word clue..."
                  disabled={loading}
                />
                <div className="text-sm text-gray-500 text-center mt-2">
                  {clue.length}/25 characters
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-100 border border-red-400 rounded-xl text-red-700 text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !clue.trim()}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Clue'}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-100 text-green-800 rounded-xl mb-4">
                <span className="text-2xl">✅</span>
                <span className="font-medium">Clue submitted: "{clue}"</span>
              </div>
              <p className="text-gray-600">
                Waiting for other players to submit their clues...
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-xl text-white">
              <span className="text-sm">Clues submitted: {submittedCount}</span>
            </div>
          </div>
        </div>

        {currentPlayer.is_host && (
          <div className="text-center">
            <button
              onClick={handleAdvancePhase}
              className="px-8 py-4 bg-white hover:bg-gray-100 text-purple-600 rounded-xl font-bold text-lg transition-colors shadow-lg"
            >
              Reveal All Clues
            </button>
          </div>
        )}

        {!currentPlayer.is_host && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur rounded-xl text-white">
              <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
              <span>Waiting for host to reveal clues...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
