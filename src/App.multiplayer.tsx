import { useState, useEffect } from 'react';
import { JoinRoom } from './components/JoinRoom.beautiful';
import { Lobby } from './components/Lobby.beautiful';
import { Game } from './components/Game.multiplayer';
import { supabase } from './lib/supabase';

function App() {
  const [playerData, setPlayerData] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<'join' | 'lobby' | 'game'>('join');

  const handleJoin = (data: any) => {
    setPlayerData(data);
    setCurrentScreen('lobby');
  };

  useEffect(() => {
    if (!playerData) return;

    // Subscribe to room status changes
    const channel = supabase
      .channel(`room-status-${playerData.roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${playerData.roomId}`
      }, (payload) => {
        console.log('Room status update:', payload);
        if (payload.new.status === 'playing') {
          setCurrentScreen('game');
        } else if (payload.new.status === 'lobby') {
          setCurrentScreen('lobby');
        }
      })
      .subscribe();

    // Check initial room status
    const checkRoomStatus = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('status')
        .eq('id', playerData.roomId)
        .single();

      if (data?.status === 'playing') {
        setCurrentScreen('game');
      }
    };

    checkRoomStatus();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerData]);

  const handleGameStart = () => {
    setCurrentScreen('game');
  };

  const handleBackToLobby = async () => {
    // Reset room status to lobby
    if (playerData?.isHost) {
      await supabase
        .from('rooms')
        .update({ status: 'lobby' })
        .eq('id', playerData.roomId);
    }
    setCurrentScreen('lobby');
  };

  const handleLeaveRoom = async () => {
    if (playerData) {
      // Remove player from room
      await supabase
        .from('players')
        .delete()
        .eq('id', playerData.playerId);
    }
    setPlayerData(null);
    setCurrentScreen('join');
  };

  if (currentScreen === 'join') {
    return <JoinRoom onJoin={handleJoin} />;
  }

  if (currentScreen === 'lobby') {
    return (
      <Lobby
        playerData={playerData}
        onGameStart={handleGameStart}
        onLeave={handleLeaveRoom}
      />
    );
  }

  if (currentScreen === 'game') {
    return (
      <Game
        onBackToLobby={handleBackToLobby}
        playerData={playerData}
      />
    );
  }

  return null;
}

export default App;