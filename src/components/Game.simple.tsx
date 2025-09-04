import { useState } from 'react';

interface GameProps {
  onBackToLobby: () => void;
}

export function Game({ onBackToLobby }: GameProps) {
  const [currentPhase, setCurrentPhase] = useState<'role' | 'clue' | 'voting' | 'results'>('role');
  const [clue, setClue] = useState('');
  // const [votes, setVotes] = useState<{[key: string]: string}>({});

  const players = [
    { id: '1', name: 'Louis', avatar: '🦀', isHost: true, role: 'imposter' },
    { id: '2', name: 'Player 2', avatar: '🐙', isHost: false, role: 'detective' },
  ];

  const topic = {
    category: 'Animals',
    words: ['Lion', 'Tiger', 'Elephant', 'Giraffe', 'Monkey', 'Zebra', 'Hippo', 'Rhino']
  };

  const secretWord = 'Lion';
  // const secretWordIndex = 0;

  const handleClueSubmit = () => {
    setCurrentPhase('voting');
  };

  const handleVote = (voterId: string, targetId: string) => {
    // setVotes(prev => ({ ...prev, [voterId]: targetId }));
    console.log(`Vote: ${voterId} -> ${targetId}`);
  };

  const handleVotingComplete = () => {
    setCurrentPhase('results');
  };

  if (currentPhase === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-6xl mb-6">🎭</div>
          <h1 className="text-4xl font-bold text-white mb-4">Role Reveal</h1>
          <p className="text-white/80 mb-8">Your secret role has been assigned!</p>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Your Role</h2>
            <div className="text-6xl mb-4">🕵️</div>
            <p className="text-xl text-white font-semibold">Detective</p>
            <p className="text-white/70 mt-2">Find the imposter by asking questions!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Topic</h2>
            <p className="text-xl text-white font-semibold">{topic.category}</p>
            <p className="text-white/70 mt-2">Secret word: {secretWord}</p>
          </div>

          <button
            onClick={() => setCurrentPhase('clue')}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
          >
            Continue to Game
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'clue') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🎯 Clue Phase</h1>
            <p className="text-white/80">Give a clue about the secret word!</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Topic: {topic.category}</h2>
            <p className="text-white/70">Secret word: {secretWord}</p>
          </div>

          <div className="mb-8">
            <label className="block text-white font-medium mb-3">Your Clue:</label>
            <input
              type="text"
              value={clue}
              onChange={(e) => setClue(e.target.value)}
              placeholder="Enter your clue..."
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleClueSubmit}
            disabled={!clue.trim()}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-green-400/30 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Clue
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'voting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🗳️ Voting Phase</h1>
            <p className="text-white/80">Who do you think is the imposter?</p>
          </div>

          <div className="space-y-4 mb-8">
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => handleVote('current-player', player.id)}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center space-x-4 hover:bg-white/20 transition-all"
              >
                <div className="text-3xl">{player.avatar}</div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{player.name}</p>
                  <p className="text-white/70 text-sm">Clue: {clue || 'No clue given'}</p>
                </div>
                <div className="text-white/60">→</div>
              </button>
            ))}
          </div>

          <button
            onClick={handleVotingComplete}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-red-400/30 text-lg"
          >
            Submit Vote
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === 'results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full text-center" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold text-white mb-4">Game Results</h1>
          
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">The Imposter Was...</h2>
            <div className="text-6xl mb-4">🦀</div>
            <p className="text-xl text-white font-semibold">Louis</p>
            <p className="text-white/70 mt-2">The detectives won!</p>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="text-xl font-bold text-white">Final Scores:</h3>
            {players.map((player) => (
              <div key={player.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{player.avatar}</div>
                  <span className="text-white font-medium">{player.name}</span>
                </div>
                <span className="text-white/70">+10 points</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setCurrentPhase('role')}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
            >
              Play Again
            </button>
            <button
              onClick={onBackToLobby}
              className="w-full py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg"
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
