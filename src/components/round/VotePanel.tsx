import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface Vote {
  id: string;
  round_id: string;
  voter_id: string;
  target_id: string;
}

interface VotePanelProps {
  roundId: string;
  players: Player[];
  currentPlayerId: string;
  imposterId: string;
  onVotingComplete: () => void;
  writeToken: string;
  allowSelfVote?: boolean;
}

export function VotePanel({ 
  roundId, 
  players, 
  currentPlayerId,
  imposterId,
  onVotingComplete,
  writeToken,
  allowSelfVote = false
}: VotePanelProps) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [selectedSuspect, setSelectedSuspect] = useState<string>('');
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tieResult, setTieResult] = useState<{
    isTie: boolean;
    tiedPlayers: string[];
    imposterEscaped: boolean;
  } | null>(null);

  // Load existing votes
  const loadVotes = async () => {
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('round_id', roundId);

      if (error) throw error;
      setVotes(data || []);
    } catch (err: any) {
      console.error('Error loading votes:', err);
      setError(err.message || 'Failed to load votes');
    }
  };

  // Set up real-time subscription for votes
  useEffect(() => {
    loadVotes();

    const channel = supabase
      .channel(`votes-${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `round_id=eq.${roundId}`
        },
        () => {
          loadVotes();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roundId]);

  // Check if current player has already voted
  useEffect(() => {
    const currentPlayerVote = votes.find(v => v.voter_id === currentPlayerId);
    if (currentPlayerVote) {
      setHasVoted(true);
      setSelectedSuspect(currentPlayerVote.target_id);
    }
  }, [votes, currentPlayerId]);

  // Auto-advance when all players have voted
  useEffect(() => {
    if (votes.length === players.length && players.length > 0) {
      // Small delay to let players see the completion
      const timer = setTimeout(() => {
        checkVoteResults();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [votes.length, players.length]);

  // Check for ties and determine result
  const checkVoteResults = () => {
    // Count votes for each player
    const voteCounts: { [playerId: string]: number } = {};
    votes.forEach(vote => {
      voteCounts[vote.target_id] = (voteCounts[vote.target_id] || 0) + 1;
    });

    // Find the maximum vote count
    const maxVotes = Math.max(...Object.values(voteCounts));
    
    // Find all players with the maximum vote count
    const tiedPlayers = Object.entries(voteCounts)
      .filter(([_, count]) => count === maxVotes)
      .map(([playerId, _]) => playerId);

    // Check if there's a tie (more than one player with max votes)
    const isTie = tiedPlayers.length > 1;
    
    // Check if imposter is among the tied players
    const imposterEscaped = isTie && tiedPlayers.includes(imposterId);

    if (isTie) {
      setTieResult({
        isTie: true,
        tiedPlayers,
        imposterEscaped
      });
    }

    // Auto-advance to results
    onVotingComplete();
  };

  const handleVote = async (targetId: string) => {
    if (hasVoted || submitting) return;

    setSelectedSuspect(targetId);
    setSubmitting(true);
    setError('');

    try {
      const { error } = await supabase.rpc('submit_vote', {
        p_round_id: roundId,
        p_voter_id: currentPlayerId,
        p_target_id: targetId,
        p_write_token: writeToken
      });

      if (error) throw error;
      
      setHasVoted(true);
      // Refresh votes to show updated state
      await loadVotes();
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      setError(err.message || 'Failed to submit vote');
      setSelectedSuspect('');
    } finally {
      setSubmitting(false);
    }
  };

  // Get vote count for a player
  const getVoteCount = (playerId: string): number => {
    return votes.filter(v => v.target_id === playerId).length;
  };

  // Get who voted for whom
  const getVotersForPlayer = (playerId: string): string[] => {
    return votes
      .filter(v => v.target_id === playerId)
      .map(v => v.voter_id);
  };

  // Filter players (exclude self if self-vote disabled)
  const votablePlayers = allowSelfVote 
    ? players 
    : players.filter(p => p.id !== currentPlayerId);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">🗳️ Voting Phase</h2>
        <p className="text-white/80">
          Who do you think is the imposter? Choose carefully!
        </p>
      </div>

      {/* Tie Result Banner */}
      {tieResult && (
        <div className={`rounded-xl p-6 text-center ${
          tieResult.imposterEscaped
            ? 'bg-red-500/20 border border-red-400/30'
            : 'bg-yellow-500/20 border border-yellow-400/30'
        }`}>
          <div className="text-4xl mb-3">
            {tieResult.imposterEscaped ? '😈' : '🤝'}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            {tieResult.imposterEscaped ? 'Imposter Escapes!' : 'Tie Vote!'}
          </h3>
          <p className="text-white/80">
            {tieResult.imposterEscaped
              ? 'The imposter tied for most votes and escapes detection!'
              : 'Multiple players tied for most votes. The imposter gets away!'
            }
          </p>
          <div className="mt-3 text-sm text-white/70">
            Tied players: {tieResult.tiedPlayers.map(playerId => {
              const player = players.find(p => p.id === playerId);
              return player ? `${player.avatar} ${player.name}` : 'Unknown';
            }).join(', ')}
          </div>
        </div>
      )}

      {/* Player Cards */}
      {!hasVoted ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {votablePlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => handleVote(player.id)}
              disabled={submitting}
              className={`p-6 rounded-xl border-2 transition-all ${
                selectedSuspect === player.id
                  ? 'border-yellow-400 bg-yellow-400/20 scale-105'
                  : 'border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/30'
              } ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="text-center">
                <div className="text-4xl mb-3">{player.avatar}</div>
                <h3 className="text-xl font-bold text-white mb-2">{player.name}</h3>
                <p className="text-white/70 text-sm">
                  {selectedSuspect === player.id ? 'Selected' : 'Click to vote'}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <div className="text-6xl mb-4">🗳️</div>
          <p className="text-white text-xl mb-4">Vote submitted!</p>
          <p className="text-white/70 mb-6">Waiting for other players...</p>
          
          {/* Show who you voted for */}
          <div className="bg-white/10 rounded-xl p-4 mb-6">
            <p className="text-white/80 text-sm mb-2">You voted for:</p>
            {(() => {
              const votedPlayer = players.find(p => p.id === selectedSuspect);
              return votedPlayer ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl">{votedPlayer.avatar}</span>
                  <span className="text-white font-medium">{votedPlayer.name}</span>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Voting Progress */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
        <h3 className="text-lg font-bold text-white mb-3 text-center">Voting Progress</h3>
        <div className="space-y-2">
          {players.map((player) => {
            const voteCount = getVoteCount(player.id);
            const voters = getVotersForPlayer(player.id);
            const hasVotedForThisPlayer = voters.includes(currentPlayerId);
            
            return (
              <div key={player.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{player.avatar}</span>
                  <span className="text-white">{player.name}</span>
                  {hasVotedForThisPlayer && (
                    <span className="text-yellow-400 text-sm">(Your vote)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/70">{voteCount} votes</span>
                  <div className="flex gap-1">
                    {voters.map((voterId, index) => {
                      const voter = players.find(p => p.id === voterId);
                      return (
                        <span key={index} className="text-xs">
                          {voter?.avatar || '?'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center text-white/70">
          {votes.length} of {players.length} players have voted
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 text-red-200 text-center">
          {error}
        </div>
      )}

      {/* Submit Button (if vote selected but not submitted) */}
      {selectedSuspect && !hasVoted && !submitting && (
        <div className="text-center">
          <button
            onClick={() => handleVote(selectedSuspect)}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-purple-400/30 text-lg"
          >
            Submit Vote
          </button>
        </div>
      )}
    </div>
  );
}
