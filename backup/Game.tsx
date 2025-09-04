import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { Lobby } from './Lobby';
import { RoleReveal } from './RoleReveal';
import { ClueInput } from './ClueInput';
import { ClueReveal } from './ClueReveal';
import { Voting } from './Voting';
import { Results } from './Results';
import { Scoreboard } from './Scoreboard';
import { RealtimeChannel } from '@supabase/supabase-js';

interface GameProps {
  playerData: any;
  onBackToJoin: () => void;
}

type GamePhase = 'lobby' | 'role_reveal' | 'clue' | 'reveal_clues' | 'vote' | 'reveal' | 'done';

export function Game({ playerData, onBackToJoin }: GameProps) {
  const { 
    room, 
    players, 
    currentPlayer, 
    currentRound, 
    setRoom, 
    setPlayers, 
    setCurrentPlayer,
    setCurrentRound,
    setTopic,
    setClues,
    setVotes,
    reset
  } = useGameStore();
  
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    initializeGame();
    return () => {
      channel?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (currentRound?.phase) {
      setGamePhase(currentRound.phase as GamePhase);
    }
  }, [currentRound?.phase]);

  const initializeGame = async () => {
    try {
      setLoading(true);
      
      // Set current player data
      setCurrentPlayer({
        id: playerData.playerId,
        room_id: playerData.roomId,
        name: playerData.name,
        avatar: playerData.avatar,
        is_host: playerData.isHost,
        total_score: 0,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        device_id: playerData.deviceId,
        write_token: playerData.writeToken
      });

      // Fetch room and players data
      await fetchRoomData();
      
      // Set up real-time subscriptions
      const chan = subscribeToGameUpdates();
      setChannel(chan);
      
    } catch (err: any) {
      setError(err.message || 'Failed to initialize game');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_room_state', {
        p_room_id: playerData.roomId
      });

      if (error) throw error;

      if (data) {
        setRoom(data.room);
        setPlayers(data.players || []);
        
        if (data.current_round) {
          setCurrentRound(data.current_round);
          setTopic(data.current_round.topic);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch room data:', err);
    }
  };

  const subscribeToGameUpdates = () => {
    const channel = supabase
      .channel(`game:${playerData.roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${playerData.roomId}`,
        },
        () => {
          fetchRoomData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `room_id=eq.${playerData.roomId}`,
        },
        () => {
          fetchRoomData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clues',
          filter: `round_id=eq.${currentRound?.id || ''}`,
        },
        () => {
          if (currentRound) {
            fetchClues();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `round_id=eq.${currentRound?.id || ''}`,
        },
        () => {
          if (currentRound) {
            fetchVotes();
          }
        }
      )
      .subscribe();

    return channel;
  };

  const fetchClues = async () => {
    if (!currentRound) return;

    try {
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('round_id', currentRound.id);

      if (error) throw error;
      setClues(data || []);
    } catch (err: any) {
      console.error('Failed to fetch clues:', err);
    }
  };

  const fetchVotes = async () => {
    if (!currentRound) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('round_id', currentRound.id);

      if (error) throw error;
      setVotes(data || []);
    } catch (err: any) {
      console.error('Failed to fetch votes:', err);
    }
  };

  const handleGameStart = () => {
    setGamePhase('role_reveal');
  };

  const handleAdvancePhase = () => {
    // The phase will be updated automatically via real-time subscriptions
    // This function is called by child components to trigger the next phase
  };

  const handleNextRound = async () => {
    if (!room || !currentPlayer?.is_host) return;

    try {
      const { error } = await supabase.rpc('start_round', {
        p_room_id: room.id,
        p_write_token: playerData.writeToken,
      });

      if (error) throw error;
      setGamePhase('role_reveal');
    } catch (err: any) {
      setError(err.message || 'Failed to start next round');
    }
  };

  const handleBackToLobby = () => {
    setGamePhase('lobby');
    setCurrentRound(undefined);
    setTopic(undefined);
    setClues([]);
    setVotes([]);
  };

  const handleLeaveGame = () => {
    reset();
    onBackToJoin();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={initializeGame}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleLeaveGame}
              className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Leave Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600">
      {/* Scoreboard - Always visible at top */}
      {room && players.length > 0 && (
        <div className="p-4">
          <div className="max-w-4xl mx-auto">
            <Scoreboard />
          </div>
        </div>
      )}

      {/* Game Phase Components */}
      <div className="pb-4">
        {gamePhase === 'lobby' && (
          <Lobby onGameStart={handleGameStart} />
        )}
        
        {gamePhase === 'role_reveal' && (
          <RoleReveal onAdvancePhase={handleAdvancePhase} />
        )}
        
        {gamePhase === 'clue' && (
          <ClueInput onAdvancePhase={handleAdvancePhase} />
        )}
        
        {gamePhase === 'reveal_clues' && (
          <ClueReveal onAdvancePhase={handleAdvancePhase} />
        )}
        
        {gamePhase === 'vote' && (
          <Voting onAdvancePhase={handleAdvancePhase} />
        )}
        
        {(gamePhase === 'reveal' || gamePhase === 'done') && (
          <Results 
            onNextRound={handleNextRound} 
            onBackToLobby={handleBackToLobby} 
          />
        )}
      </div>

      {/* Leave Game Button - Always visible at bottom */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={handleLeaveGame}
          className="px-4 py-2 bg-white/20 backdrop-blur text-white rounded-xl hover:bg-white/30 transition-colors text-sm"
        >
          Leave Game
        </button>
      </div>
    </div>
  );
}
