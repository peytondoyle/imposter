import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import type { Player } from '../types/game';
import { getPlayerToken } from '../utils/device';
import { RealtimeChannel } from '@supabase/supabase-js';

interface LobbyProps {
  onGameStart: () => void;
}

export function Lobby({ onGameStart }: LobbyProps) {
  const { room, players, setPlayers, currentPlayer, updatePlayer, removePlayer } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;

    fetchPlayers();
    const chan = subscribeToRoom();
    setChannel(chan);

    return () => {
      chan?.unsubscribe();
    };
  }, [room?.id]);

  const fetchPlayers = async () => {
    if (!room) return;

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .order('joined_at');

      if (error) throw error;
      setPlayers(data || []);
    } catch (err: any) {
      console.error('Failed to fetch players:', err);
    }
  };

  const subscribeToRoom = () => {
    if (!room) return null;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const newPlayer = payload.new as Player;
          setPlayers([...players, newPlayer]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updatedPlayer = payload.new as Player;
          updatePlayer(updatedPlayer.id, updatedPlayer);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const deletedPlayer = payload.old as { id: string };
          removePlayer(deletedPlayer.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.new.status === 'playing') {
            onGameStart();
          }
        }
      )
      .subscribe();

    return channel;
  };

  const handleStartGame = async () => {
    if (!room || !currentPlayer?.is_host) return;

    setLoading(true);
    setError('');

    try {
      const token = getPlayerToken(room.code);
      if (!token) throw new Error('Authentication token not found');

      const { error: startError } = await supabase.rpc('start_round', {
        p_room_id: room.id,
        p_write_token: token,
      });

      if (startError) throw startError;
    } catch (err: any) {
      setError(err.message || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const handleKickPlayer = async (playerId: string) => {
    if (!room || !currentPlayer?.is_host || playerId === currentPlayer.id) return;

    try {
      const token = getPlayerToken(room.code);
      if (!token) throw new Error('Authentication token not found');

      const { error } = await supabase.rpc('kick_player', {
        p_room_id: room.id,
        p_player_id: playerId,
        p_write_token: token,
      });

      if (error) throw error;
      setSelectedPlayerId(null);
    } catch (err: any) {
      console.error('Failed to kick player:', err);
    }
  };

  const handleTransferHost = async (playerId: string) => {
    if (!room || !currentPlayer?.is_host || playerId === currentPlayer.id) return;

    try {
      const token = getPlayerToken(room.code);
      if (!token) throw new Error('Authentication token not found');

      const { error } = await supabase.rpc('transfer_host', {
        p_room_id: room.id,
        p_new_host_id: playerId,
        p_write_token: token,
      });

      if (error) throw error;
      setSelectedPlayerId(null);
    } catch (err: any) {
      console.error('Failed to transfer host:', err);
    }
  };

  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
  };

  if (!room || !currentPlayer) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🕵️ Imposter Lobby
            </h1>
            <button
              onClick={copyRoomCode}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-mono text-xl transition-colors"
              title="Click to copy"
            >
              {room.code}
            </button>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Players ({players.length}/{room.max_players})</span>
              {currentPlayer.is_host && <span className="text-purple-600 font-medium">You are the host</span>}
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {players.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => currentPlayer.is_host && player.id !== currentPlayer.id ? setSelectedPlayerId(player.id) : null}
                    className={`relative p-3 rounded-xl transition-all ${
                      player.id === currentPlayer.id
                        ? 'bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-400'
                        : 'bg-white hover:shadow-md border-2 border-gray-200'
                    } ${currentPlayer.is_host && player.id !== currentPlayer.id ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="text-3xl mb-1">{player.avatar}</div>
                    <div className="text-sm font-medium truncate">{player.name}</div>
                    {player.is_host && (
                      <div className="absolute -top-1 -right-1 bg-yellow-400 text-xs px-1.5 py-0.5 rounded-full">
                        👑
                      </div>
                    )}
                    {player.total_score > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Score: {player.total_score}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedPlayerId && currentPlayer.is_host && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex gap-2">
                <button
                  onClick={() => handleKickPlayer(selectedPlayerId)}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Kick Player
                </button>
                <button
                  onClick={() => handleTransferHost(selectedPlayerId)}
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                >
                  Make Host
                </button>
                <button
                  onClick={() => setSelectedPlayerId(null)}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-100 border border-red-400 rounded-xl text-red-700">
              {error}
            </div>
          )}

          {currentPlayer.is_host && (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleStartGame}
                disabled={loading || players.length < 3}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {loading ? 'Starting...' : players.length < 3 ? `Need ${3 - players.length} more players` : 'Start Game'}
              </button>
              
              <div className="text-center text-sm text-gray-500">
                Minimum 3 players required to start
              </div>
            </div>
          )}

          {!currentPlayer.is_host && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-xl">
                <div className="animate-pulse w-2 h-2 bg-purple-600 rounded-full"></div>
                <span className="text-gray-700">Waiting for host to start game...</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/20 backdrop-blur rounded-xl p-4 text-white text-center">
          <p className="text-sm">
            Share the room code <span className="font-bold">{room.code}</span> with your friends!
          </p>
        </div>
      </div>
    </div>
  );
}