import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface Prompt {
  id: number;
  prompt_text: string;
  category: string;
}

interface Answer {
  id: string;
  player_id: string;
  prompt_id: number;
  answer_text: string;
}

interface RevealGridProps {
  roundId: string;
  players: Player[];
  prompts: Prompt[];
  onStartVoting: () => void;
  writeToken: string;
  isHost: boolean;
}

export function RevealGrid({ 
  roundId, 
  players, 
  prompts, 
  onStartVoting,
  writeToken,
  isHost 
}: RevealGridProps) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discussionStarted, setDiscussionStarted] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [discussionComplete, setDiscussionComplete] = useState(false);

  // Load answers for this round
  const loadAnswers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('answers')
        .select('*')
        .eq('round_id', roundId);

      if (error) throw error;
      setAnswers(data || []);
    } catch (err: any) {
      console.error('Error loading answers:', err);
      setError(err.message || 'Failed to load answers');
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription for answers
  useEffect(() => {
    loadAnswers();

    const channel = supabase
      .channel(`answers-${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
          filter: `round_id=eq.${roundId}`
        },
        () => {
          loadAnswers();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roundId]);

  // Countdown timer for discussion phase
  useEffect(() => {
    if (!discussionStarted || discussionComplete) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setDiscussionComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [discussionStarted, discussionComplete]);

  const handleStartDiscussion = () => {
    setDiscussionStarted(true);
  };

  const handleGoToVote = async () => {
    try {
      const { error } = await supabase.rpc('advance_phase', {
        p_round_id: roundId,
        p_write_token: writeToken
      });

      if (error) throw error;
      onStartVoting();
    } catch (err: any) {
      console.error('Error advancing to vote phase:', err);
      setError(err.message || 'Failed to start voting');
    }
  };

  // Helper function to get answer for a specific player and prompt
  const getAnswer = (playerId: string, promptId: number): string => {
    const answer = answers.find(a => a.player_id === playerId && a.prompt_id === promptId);
    return answer?.answer_text || '-';
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4 animate-spin">🔄</div>
        <p className="text-white text-xl">Loading answers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-white text-xl mb-4">Error loading answers</p>
        <p className="text-white/70 mb-6">{error}</p>
        <button
          onClick={loadAnswers}
          className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">All Answers Revealed</h2>
        <p className="text-white/80">
          Study everyone's answers carefully. Who seems suspicious?
        </p>
      </div>

      {/* Discussion Timer */}
      {discussionStarted && !discussionComplete && (
        <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-200 mb-2">
            Discussion Time: {countdown}s
          </div>
          <p className="text-yellow-200/80">
            Talk about the answers and decide who you think is the imposter!
          </p>
        </div>
      )}

      {/* Answers Table */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/20">
                <th className="px-4 py-3 text-left text-white font-semibold min-w-[120px]">
                  Player
                </th>
                {prompts.map((prompt, index) => (
                  <th key={prompt.id} className="px-4 py-3 text-center text-white font-semibold min-w-[150px]">
                    <div className="text-sm font-medium">{index + 1}</div>
                    <div className="text-xs text-white/70 mt-1 line-clamp-2">
                      {prompt.prompt_text}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player, playerIndex) => (
                <tr 
                  key={player.id} 
                  className={`border-t border-white/10 ${
                    playerIndex % 2 === 0 ? 'bg-white/5' : 'bg-white/10'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{player.avatar}</span>
                      <div>
                        <div className="text-white font-medium">{player.name}</div>
                        <div className="text-white/60 text-sm">Player {playerIndex + 1}</div>
                      </div>
                    </div>
                  </td>
                  {prompts.map((prompt) => (
                    <td key={prompt.id} className="px-4 py-3 text-center">
                      <div className="bg-white/10 rounded-lg p-3 min-h-[60px] flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {getAnswer(player.id, prompt.id)}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="text-center space-y-4">
        {!discussionStarted && isHost && (
          <button
            onClick={handleStartDiscussion}
            className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-yellow-400/30 text-lg"
          >
            Start Discussion (60s)
          </button>
        )}

        {discussionStarted && !discussionComplete && (
          <div className="text-white/70">
            <p>Discussion in progress... {countdown}s remaining</p>
          </div>
        )}

        {(discussionComplete || (!discussionStarted && isHost)) && (
          <button
            onClick={handleGoToVote}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-purple-400/30 text-lg"
          >
            Go to Vote
          </button>
        )}

        {!isHost && !discussionStarted && (
          <div className="text-white/70">
            <p>Waiting for host to start discussion...</p>
          </div>
        )}

        {!isHost && discussionStarted && !discussionComplete && (
          <div className="text-white/70">
            <p>Discussion in progress... {countdown}s remaining</p>
          </div>
        )}

        {!isHost && discussionComplete && (
          <div className="text-white/70">
            <p>Discussion complete. Waiting for host to start voting...</p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 text-red-200 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
