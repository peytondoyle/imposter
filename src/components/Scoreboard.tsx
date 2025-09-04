import { useGameStore } from '../stores/gameStore';
import { Player } from '../types/game';

interface ScoreboardProps {
  className?: string;
}

export function Scoreboard({ className = '' }: ScoreboardProps) {
  const { room, players } = useGameStore();

  if (!room || players.length === 0) {
    return null;
  }

  // Sort players by score (descending)
  const sortedPlayers = [...players].sort((a, b) => b.total_score - a.total_score);
  const maxScore = Math.max(...players.map(p => p.total_score));
  const winTarget = room.win_target;
  const gameWinner = maxScore >= winTarget ? sortedPlayers[0] : null;

  return (
    <div className={`bg-white rounded-2xl shadow-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          🏆 Scoreboard
        </h2>
        <div className="text-sm text-gray-500">
          First to {winTarget} wins
        </div>
      </div>

      {gameWinner && (
        <div className="mb-4 p-4 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl border-2 border-yellow-400">
          <div className="text-center">
            <div className="text-2xl mb-2">🎉</div>
            <h3 className="text-xl font-bold text-yellow-800">
              {gameWinner.name} Wins!
            </h3>
            <p className="text-yellow-700">
              {gameWinner.name} reached {gameWinner.total_score} points and won the game!
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sortedPlayers.map((player, index) => {
          const isWinner = gameWinner?.id === player.id;
          const isLeading = index === 0 && !gameWinner;
          const progress = (player.total_score / winTarget) * 100;
          
          return (
            <div
              key={player.id}
              className={`
                p-4 rounded-xl border-2 transition-all
                ${isWinner 
                  ? 'bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-400' 
                  : isLeading
                  ? 'bg-gradient-to-r from-blue-100 to-purple-100 border-blue-300'
                  : 'bg-gray-50 border-gray-200'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-300 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="text-2xl">{player.avatar}</div>
                  <div>
                    <div className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      {player.name}
                      {isWinner && (
                        <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full">
                          WINNER
                        </span>
                      )}
                      {isLeading && !gameWinner && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                          LEADING
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {player.total_score} point{player.total_score !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-600">
                    {player.total_score}
                  </div>
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        isWinner 
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500'
                          : isLeading
                          ? 'bg-gradient-to-r from-blue-400 to-purple-500'
                          : 'bg-gradient-to-r from-gray-400 to-gray-500'
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!gameWinner && (
        <div className="mt-4 text-center">
          <div className="text-sm text-gray-500">
            {winTarget - maxScore} more point{winTarget - maxScore !== 1 ? 's' : ''} needed to win
          </div>
        </div>
      )}
    </div>
  );
}
