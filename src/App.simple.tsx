import { useState } from 'react';
import { JoinRoom } from './components/JoinRoom.beautiful';

function App() {
  const [playerData, setPlayerData] = useState<any>(null);

  const handleJoin = (data: any) => {
    setPlayerData(data);
  };

  if (playerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-4xl font-bold mb-4">🎉 Welcome {playerData.name}!</h1>
          <p className="text-xl">You joined room {playerData.roomCode}</p>
          <p className="text-lg mt-4">Player ID: {playerData.playerId}</p>
        </div>
      </div>
    );
  }

  return <JoinRoom onJoin={handleJoin} />;
}

export default App;