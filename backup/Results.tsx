import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { getPlayerToken } from '../utils/device';
import { Vote, Player, Topic } from '../types/game';

interface ResultsProps {
  onNextRound: () => void;
  onBackToLobby: () => void;
}

export function Results({ onNextRound, onBackToLobby }: ResultsProps) {
  const { room, currentPlayer, currentRound, votes, setVotes, players, topic } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imposterGuess, setImposterGuess] = useState<number | null>(null);
  const [submittingGuess, setSubmittingGuess] = useState(false);
  const [roundResults, setRoundResults] = useState<any>(null);

  useEffect(() => {
    if (!currentRound) return;
    
    fetchVotes();
    fetchRoundResults();
  }, [currentRound?.id]);

  const fetchVotes = async () => {
    if (!currentRound) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select(`
          *,
          voters:players!votes_voter_id_fkey (
            id,
            name,
            avatar
          ),
          targets:players!votes_target_id_fkey (
            id,
            name,
            avatar
          )
        `)
        .eq('round_id', currentRound.id);

      if (error) throw error;
      setVotes(data || []);
    } catch (err: any) {
      console.error('Failed to fetch votes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundResults = async () => {
    if (!currentRound) return;

    try {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', currentRound.id)
        .single();

      if (error) throw error;
      setRoundResults(data);
    } catch (err: any) {
      console.error('Failed to fetch round results:', err);
    }
  };

  const handleImposterGuess = async (wordIndex: number) => {
    if (!room || !currentPlayer || !currentRound) return;

    setSubmittingGuess(true);
    setError('');

    try {
      const token = getPlayerToken(room.code);
      if (!token) throw new Error('Authentication token not found');

      const { error } = await supabase.rpc('end_round', {
        p_round_id: currentRound.id,
        p_imposter_guess_index: wordIndex,
        p_write_token: token,
      });

      if (error) throw error;
      
      setImposterGuess(wordIndex);
      fetchRoundResults(); // Refresh results
    } catch (err: any) {
      setError(err.message || 'Failed to submit guess');
    } finally {
      setSubmittingGuess(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !currentRound || !topic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error || 'Failed to load results'}</p>
          <button
            onClick={fetchVotes}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isImposter = currentPlayer?.id === currentRound.imposter_id;
  const imposterPlayer = players.find(p => p.id === currentRound.imposter_id);
  const mostVotedPlayer = getMostVotedPlayer();
  const imposterCaught = mostVotedPlayer?.id === currentRound.imposter_id;

  function getMostVotedPlayer() {
    if (votes.length === 0) return null;
    
    const voteCounts = votes.reduce((acc, vote) => {
      acc[vote.target_id] = (acc[vote.target_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostVotedId = Object.entries(voteCounts).reduce((a, b) => 
      voteCounts[a[0]] > voteCounts[b[0]] ? a : b
    )[0];

    return players.find(p => p.id === mostVotedId);
  }

  const words = [
    topic.word1, topic.word2, topic.word3, topic.word4,
    topic.word5, topic.word6, topic.word7, topic.word8,
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            🕵️ Round {currentRound.round_number} - Results
          </h1>
        </div>

        {/* Voting Results */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Voting Results
          </h2>
          
          <div className="space-y-3">
            {players.map((player) => {
              const votesForPlayer = votes.filter(v => v.target_id === player.id);
              const isMostVoted = mostVotedPlayer?.id === player.id;
              const isImposterPlayer = player.id === currentRound.imposter_id;
              
              return (
                <div
                  key={player.id}
                  className={`
                    p-4 rounded-xl border-2 transition-all
                    ${isMostVoted 
                      ? 'bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-400' 
                      : 'bg-gray-50 border-gray-200'
                    }
                    ${isImposterPlayer ? 'ring-2 ring-red-400' : ''}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{player.avatar}</div>
                      <div>
                        <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                          {player.name}
                          {isImposterPlayer && (
                            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                              IMPOSTER
                            </span>
                          )}
                          {isMostVoted && (
                            <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full">
                              MOST VOTED
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {votesForPlayer.length} vote{votesForPlayer.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-600">
                      {votesForPlayer.length}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-gray-100 rounded-xl">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                {imposterCaught ? '🎉 Imposter Caught!' : '😈 Imposter Escaped!'}
              </h3>
              <p className="text-gray-600">
                {imposterCaught 
                  ? `The crew successfully identified ${imposterPlayer?.name} as the imposter!`
                  : `The imposter ${imposterPlayer?.name} managed to blend in and escape detection!`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Imposter Guess Section */}
        {isImposter && !imposterGuess && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
              🕵️ Imposter Bonus Guess
            </h2>
            <p className="text-gray-600 text-center mb-6">
              You get one chance to guess the secret word for bonus points!
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              {words.map((word, index) => (
                <button
                  key={index}
                  onClick={() => handleImposterGuess(index + 1)}
                  disabled={submittingGuess}
                  className="p-4 bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-purple-300 rounded-xl transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium text-gray-800">{word}</div>
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 rounded-xl text-red-700 text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Secret Word Reveal */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Secret Word Revealed
          </h2>
          
          <div className="text-center">
            <div className="inline-block p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl">
              <div className="text-3xl font-bold mb-2">
                {words[currentRound.secret_word_index - 1]}
              </div>
              <div className="text-sm opacity-90">The secret word was #{currentRound.secret_word_index}</div>
            </div>
          </div>

          {isImposter && imposterGuess && (
            <div className="mt-6 p-4 bg-gray-100 rounded-xl">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Your Guess: {words[imposterGuess - 1]}
                </h3>
                <p className="text-gray-600">
                  {imposterGuess === currentRound.secret_word_index 
                    ? '🎉 Correct! You earned bonus points!' 
                    : '❌ Incorrect. Better luck next time!'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Score Summary */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Round Summary
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-100 rounded-xl">
              <div className="text-2xl font-bold text-blue-800">
                {imposterCaught ? '1' : '0'}
              </div>
              <div className="text-sm text-blue-600">Crew Points</div>
            </div>
            <div className="text-center p-4 bg-red-100 rounded-xl">
              <div className="text-2xl font-bold text-red-800">
                {imposterCaught ? '0' : '1'}
              </div>
              <div className="text-sm text-red-600">Imposter Points</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          {currentPlayer?.is_host && (
            <button
              onClick={onNextRound}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg"
            >
              Next Round
            </button>
          )}
          
          <button
            onClick={onBackToLobby}
            className="px-8 py-4 bg-white hover:bg-gray-100 text-purple-600 rounded-xl font-bold text-lg transition-colors shadow-lg"
          >
            Back to Lobby
          </button>
        </div>

        {!currentPlayer?.is_host && (
          <div className="text-center mt-4">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur rounded-xl text-white">
              <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
              <span>Waiting for host to start next round...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
