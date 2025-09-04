import { useState } from 'react';

interface LobbyProps {
  onGameStart: () => void;
}

export function Lobby({ onGameStart }: LobbyProps) {
  const [players] = useState([
    { id: '1', name: 'Louis', avatar: '🦀', isHost: true },
    { id: '2', name: 'Player 2', avatar: '🐙', isHost: false },
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🕵️ Game Lobby</h1>
          <p className="text-white/80">Waiting for players to join...</p>
        </div>

        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Players ({players.length})</h2>
          <div className="grid gap-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 flex items-center space-x-4"
              >
                <div className="text-3xl">{player.avatar}</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{player.name}</span>
                    {player.isHost && (
                      <span className="text-yellow-400 text-sm">👑 Host</span>
                    )}
                  </div>
                </div>
                <div className="text-green-400 text-sm">✓ Ready</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onGameStart}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-green-400/30 text-lg"
          >
            🚀 Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
