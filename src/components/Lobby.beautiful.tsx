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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

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
      setPlayers(data || []);
      setConnectionStatus('connected');
    } catch (err: any) {
      console.error('Failed to fetch players:', err);
      setError('Failed to load players');
      setConnectionStatus('error');
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
    } catch (err: any) {
      setError(err.message || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(playerData.roomCode);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy room code');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/10 via-transparent to-pink-600/10"></div>
        
        {/* Animated Particles */}
        <div className="absolute top-10 left-10 w-2 h-2 bg-white/20 rounded-full animate-ping"></div>
        <div className="absolute top-32 right-20 w-1 h-1 bg-blue-400/30 rounded-full animate-ping delay-1000"></div>
        <div className="absolute bottom-20 left-32 w-3 h-3 bg-purple-400/20 rounded-full animate-ping delay-2000"></div>
        <div className="absolute top-64 left-1/2 w-1 h-1 bg-pink-400/30 rounded-full animate-ping delay-500"></div>
        
        {/* Floating Orbs */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-4 mb-4">
              <div className="text-4xl animate-bounce">🕵️</div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
                IMPOSTER LOBBY
              </h1>
              <div className="text-4xl animate-bounce delay-200">🎭</div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
                connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                'bg-red-400'
              }`}></div>
              <span className="text-white/70">
                {connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 'Connection Error'}
              </span>
            </div>
          </div>

          {/* Main Game Card */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden mb-6">
            <div className="p-8">
              {/* Room Info Header */}
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👥</span>
                    <span className="text-white text-lg font-semibold">
                      Players ({players.length}/12)
                    </span>
                  </div>
                  {playerData.isHost && (
                    <div className="px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full">
                      <span className="text-yellow-300 text-sm font-semibold">👑 HOST</span>
                    </div>
                  )}
                </div>
                
                {/* Room Code */}
                <button
                  onClick={copyRoomCode}
                  className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 rounded-2xl hover:from-indigo-500/30 hover:to-purple-500/30 transition-all duration-300 hover:scale-105"
                >
                  <span className="text-white/70 text-sm font-medium">ROOM</span>
                  <span className="text-white text-2xl font-mono font-bold tracking-wider">
                    {playerData.roomCode}
                  </span>
                  <span className="text-white/50 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    📋
                  </span>
                </button>
              </div>

              {/* Players Grid */}
              <div className="mb-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {players.map((player, index) => (
                    <div
                      key={player.id}
                      className={`group relative p-4 rounded-2xl border transition-all duration-300 hover:scale-105 animate-in slide-in-from-bottom-5 ${
                        player.id === playerData.playerId
                          ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-blue-400/40 shadow-lg shadow-blue-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Host Crown */}
                      {player.is_host && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-sm animate-bounce">
                          👑
                        </div>
                      )}
                      
                      {/* Avatar */}
                      <div className="text-center mb-3">
                        <div className="text-4xl mb-2 group-hover:animate-bounce">
                          {player.avatar}
                        </div>
                        <div className="text-white font-semibold text-sm truncate">
                          {player.name}
                        </div>
                        {player.id === playerData.playerId && (
                          <div className="text-blue-300 text-xs mt-1 font-medium">
                            (You)
                          </div>
                        )}
                      </div>
                      
                      {/* Score */}
                      <div className="text-center">
                        <div className="inline-block px-2 py-1 bg-white/10 rounded-full">
                          <span className="text-white/80 text-xs">
                            🏆 {player.total_score || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty Slots */}
                  {Array.from({ length: Math.max(0, Math.min(6 - players.length, 6)) }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="p-4 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 hover:border-white/30 transition-colors"
                    >
                      <div className="text-3xl mb-2">👤</div>
                      <div className="text-xs">Waiting...</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl animate-in slide-in-from-top-3">
                  <div className="flex items-center gap-2 text-red-200">
                    <span className="text-lg">⚠️</span>
                    {error}
                  </div>
                </div>
              )}

              {/* Game Controls */}
              <div className="space-y-4">
                {playerData.isHost ? (
                  <div className="text-center space-y-3">
                    <button
                      onClick={handleStartGame}
                      disabled={loading || players.length < 3}
                      className="w-full max-w-md mx-auto block py-4 px-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold text-lg rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 disabled:scale-100 disabled:opacity-50 relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <span className="relative z-10 flex items-center justify-center gap-3">
                        {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Starting Game...
                          </>
                        ) : players.length < 3 ? (
                          <>
                            <span className="text-xl">⏳</span>
                            Need {3 - players.length} More Players
                          </>
                        ) : (
                          <>
                            <span className="text-xl">🚀</span>
                            Start the Game
                          </>
                        )}
                      </span>
                    </button>
                    
                    <p className="text-white/60 text-sm">
                      Minimum 3 players • Maximum 12 players
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/20 rounded-2xl">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce delay-150"></div>
                      </div>
                      <span className="text-white/80">Waiting for host to start...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions Card */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <h3 className="text-white font-semibold mb-3 flex items-center justify-center gap-2">
              <span className="text-xl">💡</span>
              How to Play
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Share room code <span className="font-mono font-bold text-white">{playerData.roomCode}</span> with friends • 
              One player will be the secret <span className="font-bold text-red-300">Imposter</span> • 
              Give clues without being too obvious • 
              Vote to find the imposter!
            </p>
          </div>

          {/* Leave Button */}
          <div className="text-center mt-6">
            <button
              onClick={onLeave}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white/70 hover:text-white rounded-xl transition-all duration-300 text-sm"
            >
              🚪 Leave Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}