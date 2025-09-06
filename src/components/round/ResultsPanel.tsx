import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Player {
  id: string;
  name: string;
  avatar: string;
  total_score?: number;
}

interface Vote {
  id: string;
  round_id: string;
  voter_id: string;
  target_id: string;
}

interface ScoreUpdate {
  player_id: string;
  score_delta: number;
  reason: string;
}

interface ResultsPanelProps {
  roundId: string;
  players: Player[];
  imposterId: string;
  onNextRound: () => void;
  onEndGame: () => void;
  writeToken: string;
  isHost: boolean;
}

export function ResultsPanel({ 
  roundId, 
  players, 
  imposterId,
  onNextRound,
  onEndGame,
  writeToken,
  isHost 
}: ResultsPanelProps) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoresCalculated, setScoresCalculated] = useState(false);
  const [scoreUpdates, setScoreUpdates] = useState<ScoreUpdate[]>([]);
  const [majoritySuspect, setMajoritySuspect] = useState<string>('');
  const [imposterCaught, setImposterCaught] = useState(false);
  const [tieOccurred, setTieOccurred] = useState(false);

  // Load votes for this round
  const loadVotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('round_id', roundId);

      if (error) throw error;
      setVotes(data || []);
    } catch (err: any) {
      console.error('Error loading votes:', err);
      setError(err.message || 'Failed to load votes');
    } finally {
      setLoading(false);
    }
  };

  // Calculate majority suspect and determine result
  const calculateResults = () => {
    if (votes.length === 0) return null;

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

    // Check if there's a tie
    const isTie = tiedPlayers.length > 1;
    setTieOccurred(isTie);

    // Determine majority suspect (first in case of tie, or the only one with max votes)
    const suspect = tiedPlayers[0];
    setMajoritySuspect(suspect);

    // Check if imposter was caught
    const caught = !isTie && suspect === imposterId;
    setImposterCaught(caught);

    return { suspect, caught, isTie, tiedPlayers };
  };

  // Calculate and update scores
  const calculateScores = async () => {
    if (scoresCalculated) return;

    try {
      const result = calculateResults();
      if (!result) return;
      
      const { caught, isTie } = result;
      const updates: ScoreUpdate[] = [];

      if (isTie) {
        // Tie: imposter escapes, gets +2 points
        updates.push({
          player_id: imposterId,
          score_delta: 2,
          reason: 'Imposter escaped on tie vote'
        });
      } else if (caught) {
        // Imposter caught: all non-imposters get +1 point
        players.forEach(player => {
          if (player.id !== imposterId) {
            updates.push({
              player_id: player.id,
              score_delta: 1,
              reason: 'Imposter caught'
            });
          }
        });
      } else {
        // Imposter escaped: imposter gets +2 points
        updates.push({
          player_id: imposterId,
          score_delta: 2,
          reason: 'Imposter escaped'
        });
      }

      setScoreUpdates(updates);

      // Update scores in database
      for (const update of updates) {
        const { error } = await supabase.rpc('update_player_score', {
          p_player_id: update.player_id,
          p_score_delta: update.score_delta,
          p_write_token: writeToken
        });

        if (error) {
          console.error('Error updating score for player', update.player_id, error);
        }
      }

      setScoresCalculated(true);
    } catch (err: any) {
      console.error('Error calculating scores:', err);
      setError(err.message || 'Failed to calculate scores');
    }
  };

  // Load votes and calculate results
  useEffect(() => {
    loadVotes();
  }, [roundId]);

  // Calculate scores when votes are loaded
  useEffect(() => {
    if (votes.length > 0 && !scoresCalculated) {
      calculateScores();
    }
  }, [votes, scoresCalculated]);

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

  if (loading) {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4 animate-spin">🔄</div>
        <p className="text-white text-xl">Loading results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-white text-xl mb-4">Error loading results</p>
        <p className="text-white/70 mb-6">{error}</p>
        <button
          onClick={loadVotes}
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
        <h2 className="text-3xl font-bold text-white mb-2">🎯 Round Results</h2>
        <p className="text-white/80">The votes are in! Here's what happened...</p>
      </div>

      {/* Result Banner */}
      <div className={`rounded-xl p-6 text-center ${
        imposterCaught
          ? 'bg-green-500/20 border border-green-400/30'
          : tieOccurred
          ? 'bg-yellow-500/20 border border-yellow-400/30'
          : 'bg-red-500/20 border border-red-400/30'
      }`}>
        <div className="text-4xl mb-3">
          {imposterCaught ? '🎉' : tieOccurred ? '🤝' : '😈'}
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">
          {imposterCaught 
            ? 'Imposter Caught!' 
            : tieOccurred 
            ? 'Tie Vote - Imposter Escapes!' 
            : 'Imposter Escapes!'
          }
        </h3>
        <p className="text-white/80">
          {imposterCaught
            ? 'The crew successfully identified the imposter!'
            : tieOccurred
            ? 'Multiple players tied for most votes. The imposter gets away!'
            : 'The imposter fooled everyone and escaped detection!'
          }
        </p>
        {majoritySuspect && (
          <div className="mt-3 text-sm text-white/70">
            Most voted: {(() => {
              const player = players.find(p => p.id === majoritySuspect);
              return player ? `${player.avatar} ${player.name}` : 'Unknown';
            })()}
          </div>
        )}
      </div>

      {/* Vote Results */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 text-center">Vote Breakdown</h3>
        <div className="space-y-3">
          {players.map((player) => {
            const voteCount = getVoteCount(player.id);
            const voters = getVotersForPlayer(player.id);
            const isImposter = player.id === imposterId;
            const isMostVoted = player.id === majoritySuspect;
            
            return (
              <div 
                key={player.id} 
                className={`p-4 rounded-lg border transition-all ${
                  isMostVoted
                    ? 'border-yellow-400 bg-yellow-400/20'
                    : 'border-white/20 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{player.avatar}</span>
                    <div>
                      <span className="text-white font-medium">{player.name}</span>
                      {isImposter && (
                        <span className="text-red-400 text-sm ml-2">(Imposter)</span>
                      )}
                      {isMostVoted && (
                        <span className="text-yellow-400 text-sm ml-2">(Most Voted)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/70">{voteCount} votes</span>
                    <div className="flex gap-1">
                      {voters.map((voterId, index) => {
                        const voter = players.find(p => p.id === voterId);
                        return (
                          <span key={index} className="text-sm">
                            {voter?.avatar || '?'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Updates */}
      {scoreUpdates.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 text-center">Score Updates</h3>
          <div className="space-y-2">
            {scoreUpdates.map((update, index) => {
              const player = players.find(p => p.id === update.player_id);
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{player?.avatar || '?'}</span>
                    <span className="text-white">{player?.name || 'Unknown'}</span>
                    <span className="text-white/60 text-sm">{update.reason}</span>
                  </div>
                  <span className={`font-bold ${
                    update.score_delta > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {update.score_delta > 0 ? '+' : ''}{update.score_delta}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Scoreboard */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 text-center">Current Scores</h3>
        <div className="space-y-3">
          {players
            .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
            .map((player, index) => {
              const isImposter = player.id === imposterId;
              const rank = index + 1;
              
              return (
                <div key={player.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-yellow-400">#{rank}</span>
                    <span className="text-xl">{player.avatar}</span>
                    <span className="text-white font-medium">{player.name}</span>
                    {isImposter && (
                      <span className="text-red-400 text-sm">(Imposter)</span>
                    )}
                  </div>
                  <span className="text-yellow-400 font-bold text-lg">
                    {player.total_score || 0} pts
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Action Buttons */}
      {isHost && (
        <div className="flex gap-4 justify-center">
          <button
            onClick={onNextRound}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
          >
            Next Round
          </button>
          <button
            onClick={onEndGame}
            className="px-8 py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg text-lg"
          >
            End Game
          </button>
        </div>
      )}

      {!isHost && (
        <div className="text-center text-white/70">
          <p>Waiting for host to start next round or end game...</p>
        </div>
      )}
    </div>
  );
}
