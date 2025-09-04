import { useState, useEffect } from 'react';

interface GameProps {
  onBackToLobby: () => void;
  playerData: any;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  role?: 'detective' | 'imposter';
}

// Sample topics for localStorage fallback
const SAMPLE_TOPICS = [
  {
    id: 1,
    category: 'Animals',
    topic: 'Animals',
    word1: 'Lion',
    word2: 'Tiger', 
    word3: 'Elephant',
    word4: 'Giraffe',
    word5: 'Monkey',
    word6: 'Zebra',
    word7: 'Hippo',
    word8: 'Rhino',
    family_safe: true
  },
  {
    id: 2,
    category: 'Food',
    topic: 'Food',
    word1: 'Pizza',
    word2: 'Burger',
    word3: 'Pasta',
    word4: 'Sushi',
    word5: 'Tacos',
    word6: 'Salad',
    word7: 'Soup',
    word8: 'Sandwich',
    family_safe: true
  },
  {
    id: 3,
    category: 'Countries',
    topic: 'Countries',
    word1: 'France',
    word2: 'Japan',
    word3: 'Brazil',
    word4: 'Egypt',
    word5: 'Canada',
    word6: 'Australia',
    word7: 'India',
    word8: 'Mexico',
    family_safe: true
  }
];

export function Game({ onBackToLobby, playerData }: GameProps) {
  const [gameState, setGameState] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<'role' | 'clue' | 'voting' | 'results'>('role');
  const [clue, setClue] = useState('');
  const [selectedVote, setSelectedVote] = useState<string>('');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  useEffect(() => {
    console.log('Using localStorage fallback game system');
    initializeLocalStorageGame();
    
    // Poll for game state updates from localStorage
    const pollInterval = setInterval(() => {
      const storedGame = localStorage.getItem(`game_${playerData.roomId}`);
      if (storedGame) {
        const parsedGame = JSON.parse(storedGame);
        if (JSON.stringify(parsedGame) !== JSON.stringify(gameState)) {
          console.log('Game state updated from localStorage:', parsedGame);
          setGameState(parsedGame);
          setCurrentPhase(parsedGame.current_phase || 'role');
          
          const player = parsedGame.players?.find((p: any) => p.id === playerData.playerId);
          setCurrentPlayer(player || null);
        }
      }
    }, 500); // Check every 500ms for fast updates

    return () => clearInterval(pollInterval);
  }, [playerData.roomId]);

  const initializeLocalStorageGame = () => {
    const storedGame = localStorage.getItem(`game_${playerData.roomId}`);
    
    if (storedGame) {
      const parsedGame = JSON.parse(storedGame);
      setGameState(parsedGame);
      setCurrentPhase(parsedGame.current_phase || 'role');
      
      const player = parsedGame.players?.find((p: any) => p.id === playerData.playerId);
      setCurrentPlayer(player || null);
    } else if (playerData.isHost) {
      // Host creates the game
      createNewLocalGame();
    }
  };

  const createNewLocalGame = () => {
    // Mock players for demo - in real app, get from players table
    const mockPlayers = [
      { id: playerData.playerId, name: playerData.name, avatar: playerData.avatar || '🎭' },
      { id: 'player2', name: 'Player 2', avatar: '🦊' },
      { id: 'player3', name: 'Player 3', avatar: '🐸' }
    ];

    const topic = SAMPLE_TOPICS[Math.floor(Math.random() * SAMPLE_TOPICS.length)];
    const secretWordIndex = Math.floor(Math.random() * 8) + 1;
    const secretWord = topic[`word${secretWordIndex}`];
    const imposterIndex = Math.floor(Math.random() * mockPlayers.length);
    
    const gamePlayers = mockPlayers.map((p, index) => ({
      ...p,
      role: index === imposterIndex ? 'imposter' : 'detective' as 'detective' | 'imposter'
    }));

    const newGameState = {
      room_id: playerData.roomId,
      current_phase: 'role',
      topic: {
        ...topic,
        secret_word_index: secretWordIndex,
        secret_word: secretWord
      },
      players: gamePlayers,
      clues: {},
      votes: {},
      imposter_id: gamePlayers[imposterIndex].id
    };

    localStorage.setItem(`game_${playerData.roomId}`, JSON.stringify(newGameState));
    setGameState(newGameState);
    
    const player = newGameState.players.find((p: any) => p.id === playerData.playerId);
    setCurrentPlayer(player || null);
  };

  const updateGamePhase = async (newPhase: string) => {
    if (!gameState) return;
    
    const updatedGame = {
      ...gameState,
      current_phase: newPhase
    };
    
    localStorage.setItem(`game_${playerData.roomId}`, JSON.stringify(updatedGame));
    setGameState(updatedGame);
    setCurrentPhase(newPhase as any);
  };

  const handleClueSubmit = async () => {
    if (!clue.trim() || !gameState) return;

    const updatedClues = { ...gameState.clues, [playerData.playerId]: clue };
    const updatedGame = {
      ...gameState,
      clues: updatedClues
    };

    // Check if all players submitted clues
    const allSubmitted = gameState.players?.every((p: Player) => updatedClues[p.id]);
    if (allSubmitted) {
      updatedGame.current_phase = 'voting';
    }

    localStorage.setItem(`game_${playerData.roomId}`, JSON.stringify(updatedGame));
    setGameState(updatedGame);
  };

  const handleVote = async (targetId: string) => {
    if (!gameState) return;
    
    setSelectedVote(targetId);
    
    const updatedVotes = { ...gameState.votes, [playerData.playerId]: targetId };
    const updatedGame = {
      ...gameState,
      votes: updatedVotes
    };

    // Check if all players voted
    const allVoted = gameState.players?.every((p: Player) => updatedVotes[p.id]);
    if (allVoted) {
      updatedGame.current_phase = 'results';
    }

    localStorage.setItem(`game_${playerData.roomId}`, JSON.stringify(updatedGame));
    setGameState(updatedGame);
  };

  const resetGame = () => {
    localStorage.removeItem(`game_${playerData.roomId}`);
    if (playerData.isHost) {
      createNewLocalGame();
    }
  };

  if (!gameState || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-4">Setting Up Game...</h2>
          <p className="text-white/80 mb-6">Using offline mode</p>
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

  if (currentPhase === 'role') {
    const isImposter = currentPlayer.role === 'imposter';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full text-center">
          <div className="text-6xl mb-6">🎭</div>
          <h1 className="text-4xl font-bold text-white mb-4">Role Reveal</h1>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Your Role</h2>
            <div className="text-6xl mb-4">{isImposter ? '🦹' : '🕵️'}</div>
            <p className="text-xl text-white font-semibold">
              {isImposter ? 'Chameleon' : 'Crew'}
            </p>
            <p className="text-white/70 mt-2">
              {isImposter 
                ? 'Blend in by giving vague clues that could apply to any word!'
                : 'Find the Chameleon by asking questions!'}
            </p>
          </div>

          {/* Topic Card with 8 words */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{gameState.topic?.category || 'Mystery'}</h2>
              <div className="text-sm text-gray-500 mb-4">
                {isImposter ? (
                  <span className="text-red-600 font-medium">🦹 You are the CHAMELEON</span>
                ) : (
                  <span className="text-blue-600 font-medium">👥 You are CREW</span>
                )}
              </div>
              {!isImposter && (
                <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-3 mb-4">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Secret Word:</span> <span className="font-bold text-blue-700">{gameState.topic?.secret_word || '???'}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Give clues about this word without being too obvious!
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4,5,6,7,8].map((index) => {
                const word = gameState.topic?.[`word${index}`];
                const isSecret = index === gameState.topic?.secret_word_index;
                const shouldHighlight = !isImposter && isSecret;
                
                return (
                  <div
                    key={index}
                    className={`
                      p-4 rounded-xl text-center font-medium text-lg border-2 transition-all
                      ${shouldHighlight 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-blue-400 shadow-lg transform scale-105' 
                        : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                      }
                    `}
                  >
                    {word || '???'}
                    {shouldHighlight && (
                      <div className="text-xs mt-1 opacity-90">SECRET</div>
                    )}
                  </div>
                );
              })}
            </div>

            {isImposter && (
              <div className="mt-6 bg-gradient-to-r from-red-100 to-orange-100 rounded-xl p-4">
                <p className="text-sm text-gray-700 text-center">
                  <span className="font-semibold">Your Mission:</span> Blend in by giving a vague clue that could apply to any of these words.
                  <br />
                  <span className="text-xs text-gray-600">The crew knows the secret word, but you don't!</span>
                </p>
              </div>
            )}
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

          <button
            onClick={() => updateGamePhase('clue')}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
          >
            Continue to Clue Phase
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'clue') {
    const hasSubmitted = gameState.clues?.[playerData.playerId] !== undefined;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🎯 Clue Phase</h1>
            <p className="text-white/80">Give a clue about the secret word!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Topic: {gameState.topic?.category || 'Mystery'}
            </h2>
            {currentPlayer?.role !== 'imposter' && (
              <p className="text-white/70">Secret word: {gameState.topic?.secret_word || '???'}</p>
            )}
            {currentPlayer?.role === 'imposter' && (
              <p className="text-orange-300">You're the imposter! Give a convincing clue.</p>
            )}
          </div>

          {!hasSubmitted ? (
            <>
              <div className="mb-8">
                <label className="block text-white font-medium mb-3">Your Clue:</label>
                <input
                  type="text"
                  value={clue}
                  onChange={(e) => setClue(e.target.value)}
                  placeholder="Enter your clue..."
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <button
                onClick={handleClueSubmit}
                disabled={!clue.trim()}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
              >
                Submit Clue
              </button>
            </>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-white text-xl mb-4">Clue submitted!</p>
              <p className="text-white/70">Your clue: "{gameState.clues?.[playerData.playerId]}"</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentPhase === 'voting') {
    const hasVoted = gameState.votes?.[playerData.playerId] !== undefined;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🗳️ Voting Phase</h1>
            <p className="text-white/80">Who do you think is the imposter?</p>
          </div>

          <div className="space-y-4 mb-8">
            {gameState.players?.map((player: Player) => (
              <button
                key={player.id}
                onClick={() => handleVote(player.id)}
                disabled={player.id === playerData.playerId || hasVoted}
                className={`w-full bg-white/10 backdrop-blur-sm border rounded-xl p-4 flex items-center space-x-4 transition-all ${
                  player.id === playerData.playerId 
                    ? 'opacity-50 cursor-not-allowed border-gray-500' 
                    : hasVoted
                    ? 'opacity-50 cursor-not-allowed border-white/20'
                    : selectedVote === player.id
                    ? 'border-yellow-400 bg-yellow-400/20'
                    : 'border-white/20 hover:bg-white/20'
                }`}
              >
                <div className="text-3xl">{player.avatar}</div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">
                    {player.name} {player.id === playerData.playerId && '(You)'}
                  </p>
                  <p className="text-white/70 text-sm">
                    Clue: "{gameState.clues?.[player.id] || 'No clue given'}"
                  </p>
                </div>
              </button>
            ))}
          </div>

          {hasVoted && (
            <div className="text-center">
              <p className="text-white">You voted for: {gameState.players?.find((p: Player) => p.id === gameState.votes?.[playerData.playerId])?.name}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentPhase === 'results') {
    const imposter = gameState.players?.find((p: Player) => p.id === gameState.imposter_id);
    const voteCounts: { [key: string]: number } = {};
    
    Object.values(gameState.votes || {}).forEach((targetId: any) => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    
    const mostVoted = Object.entries(voteCounts).reduce((a, b) => 
      voteCounts[a[0]] > voteCounts[b[0]] ? a : b, ['', 0]
    )[0];
    
    const detectivesWin = mostVoted === gameState.imposter_id;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center">
          <div className="text-6xl mb-6">{detectivesWin ? '🎉' : '😈'}</div>
          <h1 className="text-4xl font-bold text-white mb-4">Game Results</h1>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">The Imposter Was...</h2>
            <div className="text-6xl mb-4">{imposter?.avatar}</div>
            <p className="text-xl text-white font-semibold">{imposter?.name}</p>
            <p className="text-white/70 mt-2">
              {detectivesWin ? 'The detectives won! 🕵️' : 'The imposter fooled everyone! 🦹'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Vote Results:</h3>
            {gameState.players?.map((player: Player) => (
              <div key={player.id} className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{player.avatar}</span>
                  <span className="text-white">{player.name}</span>
                  {player.id === gameState.imposter_id && (
                    <span className="text-red-400 text-sm">(Imposter)</span>
                  )}
                </div>
                <span className="text-white/70">{voteCounts[player.id] || 0} votes</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              onClick={resetGame}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              Play Again
            </button>
            <button
              onClick={onBackToLobby}
              className="w-full py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all"
            >
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}