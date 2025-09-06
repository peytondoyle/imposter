// import React from 'react';

interface Player {
  id: string;
  name: string;
  avatar: string;
  total_score: number;
  is_host?: boolean;
  role?: 'detective' | 'imposter';
}

interface ScoreboardProps {
  players: Player[];
  currentPlayerId: string;
  imposterId?: string;
  roundNumber?: number;
  maxRounds?: number;
  winTarget?: number;
  showRoundProgress?: boolean;
  className?: string;
}

export function Scoreboard({ 
  players, 
  currentPlayerId, 
  imposterId, 
  roundNumber = 1, 
  maxRounds = 10, 
  winTarget = 5,
  showRoundProgress = true,
  className = ""
}: ScoreboardProps) {
  // Sort players by score (descending)
  const sortedPlayers = [...players].sort((a, b) => b.total_score - a.total_score);
  
  // Check for game winner
  const gameWinner = sortedPlayers.find(p => p.total_score >= winTarget);
  
  // Calculate round progress
  const roundProgress = showRoundProgress ? (roundNumber / maxRounds) * 100 : 0;

  return (
    <div className={`bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <h2 className="text-2xl font-bold text-white">Scoreboard</h2>
        </div>
        
        {showRoundProgress && (
          <div className="text-right">
            <div className="text-white/70 text-sm">Round {roundNumber} of {maxRounds}</div>
            <div className="w-24 bg-white/20 rounded-full h-2 mt-1">
              <div 
                className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(roundProgress, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Game Winner Banner */}
      {gameWinner && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl">👑</span>
            <div className="text-center">
              <div className="text-yellow-300 font-bold text-xl">GAME WINNER!</div>
              <div className="text-white text-lg">{gameWinner.name}</div>
              <div className="text-yellow-200 text-sm">{gameWinner.total_score} points</div>
            </div>
            <span className="text-4xl">🏆</span>
          </div>
        </div>
      )}

      {/* Players List */}
      <div className="space-y-3">
        {sortedPlayers.map((player, index) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          const isImposter = player.id === imposterId;
          const isWinner = index === 0;
          const isGameWinner = gameWinner?.id === player.id;
          
          return (
            <div 
              key={player.id}
              className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                isGameWinner
                  ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 ring-2 ring-yellow-400/20'
                  : isWinner
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30'
                  : isImposter
                  ? 'bg-red-500/10 border border-red-400/30'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  isGameWinner
                    ? 'bg-yellow-500 text-yellow-900'
                    : isWinner
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/20 text-white'
                }`}>
                  {isGameWinner ? '👑' : index + 1}
                </div>
                
                {/* Avatar */}
                <div className="text-3xl">{player.avatar}</div>
                
                {/* Name and Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-lg ${
                      isGameWinner ? 'text-yellow-300' : 
                      isWinner ? 'text-blue-300' : 
                      isImposter ? 'text-red-300' : 'text-white'
                    }`}>
                      {player.name}
                    </span>
                    
                    {/* Badges */}
                    <div className="flex gap-1">
                      {isCurrentPlayer && (
                        <span className="text-blue-400 text-xs bg-blue-500/20 px-2 py-1 rounded-full">
                          You
                        </span>
                      )}
                      {player.is_host && (
                        <span className="text-purple-400 text-xs bg-purple-500/20 px-2 py-1 rounded-full">
                          Host
                        </span>
                      )}
                      {isImposter && (
                        <span className="text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded-full">
                          🦹 Imposter
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Score Progress Bar */}
                  <div className="mt-2 w-32 bg-white/20 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isGameWinner
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                          : isWinner
                          ? 'bg-gradient-to-r from-blue-400 to-purple-400'
                          : 'bg-gradient-to-r from-green-400 to-emerald-400'
                      }`}
                      style={{ 
                        width: `${Math.min((player.total_score / winTarget) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Score */}
              <div className="text-right">
                <div className={`text-2xl font-bold ${
                  isGameWinner ? 'text-yellow-300' : 
                  isWinner ? 'text-blue-300' : 
                  isImposter ? 'text-red-300' : 'text-yellow-400'
                }`}>
                  {player.total_score}
                </div>
                <div className="text-white/60 text-xs">
                  {player.total_score >= winTarget ? 'Winner!' : `${winTarget - player.total_score} to win`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Win Target Info */}
      <div className="mt-4 p-3 bg-white/5 rounded-xl">
        <p className="text-white/70 text-sm text-center">
          First to reach <span className="text-yellow-400 font-semibold">{winTarget} points</span> wins the game!
        </p>
      </div>
    </div>
  );
}
