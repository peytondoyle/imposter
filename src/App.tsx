import { useState } from 'react';
import { JoinRoom } from './components/JoinRoom.beautiful';

function App() {
  const [playerData, setPlayerData] = useState<any>(null);

  const handleJoin = (data: any) => {
    setPlayerData(data);
  };

  if (playerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center">
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
          <button
            onClick={() => setPlayerData(null)}
            className="mt-6 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all"
          >
            Back to Join Room
          </button>
        </div>
      </div>
    );
  }

  return <JoinRoom onJoin={handleJoin} />;
}

export default App;