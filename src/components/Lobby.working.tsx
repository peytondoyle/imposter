import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Player {
  id: string;
  name: string;
  avatar: string;
  is_host: boolean;
  total_score: number;
  last_seen: string;
}

interface LobbyProps {
  playerData: {
    playerId: string;
    roomId: string;
    isHost: boolean;
    writeToken: string;
    roomCode: string;
    name: string;
    avatar: string;
  };
  onGameStart: () => void;
  onLeave: () => void;
}

export function Lobby({ playerData, onGameStart, onLeave }: LobbyProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlayers();
    const channel = subscribeToRoom();
    
    return () => {
      channel?.unsubscribe();
    };
  }, []);

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', playerData.roomId)
        .order('joined_at');

      if (error) throw error;
      console.log('Fetched players:', data);
      setPlayers(data || []);
    } catch (err: any) {
      console.error('Failed to fetch players:', err);
      setError('Failed to load players');
    }
  };

  const subscribeToRoom = () => {
    const channel = supabase
      .channel(`room:${playerData.roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${playerData.roomId}`,
        },
        (payload) => {
          console.log('Player joined:', payload.new);
          setPlayers(prev => [...prev, payload.new as Player]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${playerData.roomId}`,
        },
        (payload) => {
          console.log('Player left:', payload.old);
          setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${playerData.roomId}`,
        },
        (payload) => {
          console.log('Room updated:', payload.new);
          if (payload.new.status === 'playing') {
            onGameStart();
          }
        }
      )
      .subscribe();

    return channel;
  };

  const handleStartGame = async () => {
    if (!playerData.isHost) return;

    setLoading(true);
    setError('');

    try {
      const { error: startError } = await supabase.rpc('start_round', {
        p_room_id: playerData.roomId,
        p_write_token: playerData.writeToken,
      });

      if (startError) throw startError;
      console.log('Game started successfully');
    } catch (err: any) {
      console.error('Failed to start game:', err);
      setError(err.message || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(playerData.roomCode);
  };

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
              {playerData.roomCode}
            </button>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Players ({players.length}/12)</span>
              {playerData.isHost && <span className="text-purple-600 font-medium">You are the host</span>}
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`relative p-3 rounded-xl transition-all ${
                      player.id === playerData.playerId
                        ? 'bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-400'
                        : 'bg-white hover:shadow-md border-2 border-gray-200'
                    }`}
                  >
                    <div className="text-3xl mb-1">{player.avatar}</div>
                    <div className="text-sm font-medium truncate">{player.name}</div>
                    {player.is_host && (
                      <div className="absolute -top-1 -right-1 bg-yellow-400 text-xs px-1.5 py-0.5 rounded-full">
                        👑
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Score: {player.total_score || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-100 border border-red-400 rounded-xl text-red-700">
              {error}
            </div>
          )}

          {playerData.isHost && (
            <div className="flex flex-col gap-3 mb-4">
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

          {!playerData.isHost && (
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-xl">
                <div className="animate-pulse w-2 h-2 bg-purple-600 rounded-full"></div>
                <span className="text-gray-700">Waiting for host to start game...</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onLeave}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur rounded-xl p-4 text-white text-center">
          <p className="text-sm">
            Share the room code <span className="font-bold">{playerData.roomCode}</span> with your friends!
          </p>
          <p className="text-xs mt-1 opacity-75">
            Players will join automatically • Host can start when 3+ players
          </p>
        </div>
      </div>
    </div>
  );
}