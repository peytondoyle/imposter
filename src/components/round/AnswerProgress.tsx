import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface AnswerProgressProps {
  roundId: string;
  players: Player[];
  prompts: any[];
  onForceReveal: () => void;
  writeToken: string;
}

interface PlayerSubmission {
  playerId: string;
  submittedCount: number;
  totalPrompts: number;
  isComplete: boolean;
}

export function AnswerProgress({ 
  roundId, 
  players, 
  prompts, 
  onForceReveal,
  writeToken 
}: AnswerProgressProps) {
  const [submissions, setSubmissions] = useState<PlayerSubmission[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [forceRevealCountdown, setForceRevealCountdown] = useState(10);
  const [loading, setLoading] = useState(false);

  const totalPrompts = prompts.length;
  const completedPlayers = submissions.filter(s => s.isComplete).length;
  const totalPlayers = players.length;
  const completionPercentage = totalPlayers > 0 ? (completedPlayers / totalPlayers) * 100 : 0;
  const canForceReveal = completionPercentage >= 50;

  // Load current submissions
  const loadSubmissions = async () => {
    try {
      const { data: answers, error } = await supabase
        .from('answers')
        .select('player_id, prompt_id')
        .eq('round_id', roundId);

      if (error) throw error;

      // Count submissions per player
      const playerSubmissions: { [playerId: string]: number } = {};
      answers?.forEach(answer => {
        playerSubmissions[answer.player_id] = (playerSubmissions[answer.player_id] || 0) + 1;
      });

      // Create submission status for each player
      const submissionStatus: PlayerSubmission[] = players.map(player => ({
        playerId: player.id,
        submittedCount: playerSubmissions[player.id] || 0,
        totalPrompts: totalPrompts,
        isComplete: (playerSubmissions[player.id] || 0) >= totalPrompts
      }));

      setSubmissions(submissionStatus);
    } catch (error) {
      console.error('Error loading submissions:', error);
    }
  };

  // Set up real-time subscription for answers
  useEffect(() => {
    loadSubmissions();

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
          loadSubmissions();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roundId, players, totalPrompts]);

  // Auto-advance when all players have submitted
  useEffect(() => {
    if (completedPlayers === totalPlayers && totalPlayers > 0) {
      // Small delay to let players see the completion
      const timer = setTimeout(() => {
        onForceReveal();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [completedPlayers, totalPlayers, onForceReveal]);

  const handleForceReveal = () => {
    if (!canForceReveal) return;
    setShowConfirmModal(true);
    setForceRevealCountdown(10);
  };

  const confirmForceReveal = async () => {
    setLoading(true);
    try {
      // Advance phase to reveal
      const { error } = await supabase.rpc('advance_phase', {
        p_round_id: roundId,
        p_write_token: writeToken
      });

      if (error) throw error;
      
      onForceReveal();
    } catch (error) {
      console.error('Error forcing reveal:', error);
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
    }
  };

  // Countdown for force reveal confirmation
  useEffect(() => {
    if (!showConfirmModal) return;

    const timer = setInterval(() => {
      setForceRevealCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showConfirmModal]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Answer Progress</h2>
        <p className="text-white/80">
          {completedPlayers} of {totalPlayers} players have completed their answers
        </p>
        
        {/* Progress bar */}
        <div className="mt-4 bg-white/20 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        
        <p className="text-white/60 text-sm mt-2">
          {completionPercentage.toFixed(0)}% complete
        </p>
      </div>

      {/* Player status grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {submissions.map((submission) => {
          const player = players.find(p => p.id === submission.playerId);
          if (!player) return null;

          return (
            <div
              key={player.id}
              className={`p-4 rounded-xl border transition-all ${
                submission.isComplete
                  ? 'bg-green-500/20 border-green-400/30'
                  : 'bg-white/10 border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{player.avatar}</span>
                  <div>
                    <p className="text-white font-medium">{player.name}</p>
                    <p className="text-white/60 text-sm">
                      {submission.submittedCount}/{submission.totalPrompts} answers
                    </p>
                  </div>
                </div>
                <div className="text-2xl">
                  {submission.isComplete ? '✅' : '⏳'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Force reveal button */}
      <div className="text-center">
        <button
          onClick={handleForceReveal}
          disabled={!canForceReveal}
          className={`px-8 py-4 font-bold rounded-xl transition-all duration-300 ${
            canForceReveal
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-orange-400/30'
              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
          }`}
        >
          {canForceReveal 
            ? `Force Reveal (${completedPlayers}/${totalPlayers} complete)` 
            : `Need ${Math.ceil(totalPlayers * 0.5)} players to force reveal`
          }
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-bold text-white mb-4">Force Reveal?</h3>
            <p className="text-white/80 mb-6">
              Only {completedPlayers} of {totalPlayers} players have completed their answers. 
              Are you sure you want to proceed?
            </p>
            
            <div className="space-y-3">
              <button
                onClick={confirmForceReveal}
                disabled={loading || forceRevealCountdown > 0}
                className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl hover:from-red-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading 
                  ? 'Processing...' 
                  : forceRevealCountdown > 0 
                    ? `Confirm in ${forceRevealCountdown}s` 
                    : 'Yes, Force Reveal'
                }
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-3 bg-gray-500 text-white font-bold rounded-xl hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
