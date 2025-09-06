import React from 'react';
import { Scoreboard } from './Scoreboard';

interface Player {
  id: string;
  name: string;
  avatar: string;
  total_score: number;
  is_host?: boolean;
  role?: 'detective' | 'imposter';
}

interface ScoreboardScreenProps {
  players: Player[];
  currentPlayerId: string;
  imposterId?: string;
  roundNumber: number;
  maxRounds?: number;
  winTarget?: number;
  gameWinner?: Player;
  onNextRound?: () => void;
  onNewGame?: () => void;
  onBackToLobby?: () => void;
  isHost?: boolean;
  showActions?: boolean;
}

export function ScoreboardScreen({
  players,
  currentPlayerId,
  imposterId,
  roundNumber,
  maxRounds = 10,
  winTarget = 5,
  gameWinner,
  onNextRound,
  onNewGame,
  onBackToLobby,
  isHost = false,
  showActions = true
}: ScoreboardScreenProps) {
  const isGameOver = !!gameWinner;
  const isLastRound = roundNumber >= maxRounds;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {isGameOver ? 'Game Complete!' : 'Round Complete!'}
          </h1>
          <p className="text-white/80 text-xl">
            {isGameOver 
              ? 'Congratulations to our winner!' 
              : `Round ${roundNumber} of ${maxRounds} finished`
            }
          </p>
        </div>

        {/* Game Winner Banner */}
        {gameWinner && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-2xl p-6 mb-8">
            <div className="text-center">
              <div className="text-6xl mb-4">👑</div>
              <h2 className="text-3xl font-bold text-yellow-400 mb-2">CHAMPION!</h2>
              <div className="text-2xl text-white font-semibold mb-2">{gameWinner.name}</div>
              <p className="text-yellow-200 text-lg">
                Won with {gameWinner.total_score} points!
              </p>
            </div>
          </div>
        )}

        {/* Scoreboard */}
        <Scoreboard
          players={players}
          currentPlayerId={currentPlayerId}
          imposterId={imposterId}
          roundNumber={roundNumber}
          maxRounds={maxRounds}
          winTarget={winTarget}
          showRoundProgress={!isGameOver}
          className="mb-8"
        />

        {/* Round Statistics */}
        {!isGameOver && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Round Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{roundNumber}</div>
                <div className="text-white/70 text-sm">Current Round</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{players.length}</div>
                <div className="text-white/70 text-sm">Players</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">{winTarget}</div>
                <div className="text-white/70 text-sm">Points to Win</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className="space-y-3">
            {isHost && !isGameOver && !isLastRound && onNextRound && (
              <button
                onClick={onNextRound}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 text-lg"
              >
                🎮 Next Round
              </button>
            )}
            
            {isHost && (isGameOver || isLastRound) && onNewGame && (
              <button
                onClick={onNewGame}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-yellow-400/30 text-lg"
              >
                🆕 New Game
              </button>
            )}
            
            {onBackToLobby && (
              <button
                onClick={onBackToLobby}
                className="w-full py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg"
              >
                🏠 Back to Lobby
              </button>
            )}
            
            {!isHost && !isGameOver && (
              <div className="text-center">
                <p className="text-white/70 text-sm">
                  Waiting for host to start the next round...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
