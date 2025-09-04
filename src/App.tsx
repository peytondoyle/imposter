import { useState, useEffect } from 'react';
import { JoinRoom } from './components/JoinRoom.beautiful';
import { Lobby } from './components/Lobby.simple';
import { Game } from './components/Game.simple';
import { supabase } from './lib/supabase';

function App() {
  const [playerData, setPlayerData] = useState<any>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [inGame, setInGame] = useState(false);

  const handleJoin = (data: any) => {
    setPlayerData(data);
  };

  // Check if game has started for this room
  useEffect(() => {
    if (playerData && !gameStarted) {
      const checkGameState = async () => {
        try {
          const { data } = await supabase
            .from('game_states')
            .select('*')
            .eq('room_id', playerData.roomId)
            .single();

          if (data) {
            // Game has started, enter it automatically
            setGameStarted(true);
            setInGame(true);
          }
        } catch (error) {
          console.log('No game state found yet');
        }
      };

      checkGameState();
    }
  }, [playerData, gameStarted]);

  const handleGameStart = () => {
    setGameStarted(true);
    // For hosts, also start the actual game immediately
    if (playerData.isHost) {
      setInGame(true);
    }
  };

  const handleStartActualGame = () => {
    setInGame(true);
  };

  const handleBackToLobby = () => {
    setInGame(false);
  };

  if (playerData && !gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
          <div className="text-6xl mb-6 animate-bounce">🎉</div>
          <h2 className="text-3xl font-bold mb-4 text-white">
            Welcome {playerData.name}!
          </h2>
          <p className="text-white/80 mb-6">
            You successfully joined room {playerData.roomCode}
          </p>
          <div className="text-white/60 text-sm space-y-2">
            <p>Player ID: {playerData.playerId}</p>
            <p>Room ID: {playerData.roomId}</p>
            <p>Host: {playerData.isHost ? 'Yes' : 'No'}</p>
          </div>
          <div className="mt-6 space-y-3">
            {playerData.isHost && (
              <button
                onClick={handleGameStart}
                className="w-full py-3 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 text-gray-800 font-bold rounded-xl hover:from-blue-300 hover:via-purple-300 hover:to-pink-300 transition-all duration-300 shadow-lg hover:shadow-blue-400/30 relative overflow-hidden"
              >
                <span className="relative z-10">🚀 Start Game</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
              </button>
            )}
            <button
              onClick={() => setPlayerData(null)}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all"
            >
              Back to Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameStarted && !inGame) {
    return <Lobby onGameStart={handleStartActualGame} />;
  }

  if (inGame) {
    return <Game onBackToLobby={handleBackToLobby} />;
  }

  return <JoinRoom onJoin={handleJoin} />;
}

export default App;