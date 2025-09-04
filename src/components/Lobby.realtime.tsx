import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { testDatabaseConnection } from '../utils/testDb';

interface Player {
  id: string;
  name: string;
  avatar: string;
  is_host: boolean;
  total_score: number;
  last_seen: string;
  joined_at?: string;
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
  const [copiedCode, setCopiedCode] = useState(false);
  const [newPlayerIds, setNewPlayerIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Test database connection first
    testDatabaseConnection();
    fetchPlayers();
    setupRealtimeSubscription();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [playerData.roomId]);

  const fetchPlayers = async () => {
    try {
      console.log('Fetching players for room:', playerData.roomId);
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', playerData.roomId)
        .order('joined_at');

      if (error) throw error;
      
      console.log('Fetched players:', data?.length || 0, data);
      setPlayers(data || []);
      setConnectionStatus('connected');
      
      // Mark existing players as not new
      const existingIds = new Set((data || []).map(p => p.id));
      setNewPlayerIds(new Set());
    } catch (err: any) {
      console.error('Failed to fetch players:', err);
      setError('Failed to load players');
      setConnectionStatus('error');
    }
  };

  const setupRealtimeSubscription = () => {
    channelRef.current = supabase
      .channel(`lobby-${playerData.roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${playerData.roomId}`,
        },
        (payload) => {
          console.log('New player joined:', payload.new);
          const newPlayer = payload.new as Player;
          
          // Add with animation
          setPlayers(prev => {
            console.log('Current players:', prev.length, 'Adding:', newPlayer.name);
            const exists = prev.some(p => p.id === newPlayer.id);
            if (!exists) {
              // Mark as new for animation
              setNewPlayerIds(prev => new Set([...prev, newPlayer.id]));
              
              // Remove new marker after animation
              setTimeout(() => {
                setNewPlayerIds(prev => {
                  const updated = new Set(prev);
                  updated.delete(newPlayer.id);
                  return updated;
                });
              }, 1000);
              
              const updatedPlayers = [...prev, newPlayer].sort((a, b) => 
                (a.joined_at || '').localeCompare(b.joined_at || '')
              );
              console.log('Updated players count:', updatedPlayers.length);
              return updatedPlayers;
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${playerData.roomId}`,
        },
        (payload) => {
          setPlayers(prev => prev.map(p => 
            p.id === payload.new.id ? payload.new as Player : p
          ));
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
          console.log('Room status changed:', payload.new);
          if (payload.new.status === 'playing') {
            console.log('Room status is now playing, starting game...');
            setLoading(false);
            onGameStart();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        }
      });
  };

  const handleStartGame = async () => {
    if (!playerData.isHost) return;
    
    console.log('Starting game with', players.length, 'players');
    
    if (players.length < 3) {
      setError('Need at least 3 players to start');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Updating room status to playing...');
      // Update room status to playing
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', playerData.roomId);

      if (updateError) {
        console.error('Error updating room status:', updateError);
        throw updateError;
      }
      
      console.log('Room status updated successfully');
      
      // Reset loading state after a short delay
      setTimeout(() => {
        setLoading(false);
        // Manually trigger game start if subscription doesn't work
        onGameStart();
      }, 1000);
      
    } catch (err: any) {
      console.error('Failed to start game:', err);
      setError(err.message || 'Failed to start game');
      setLoading(false);
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(playerData.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy room code');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/10 via-transparent to-pink-600/10 animate-gradient"></div>
        
        {/* Animated particles */}
        <div className="absolute top-10 left-10 w-2 h-2 bg-white/20 rounded-full animate-float"></div>
        <div className="absolute top-32 right-20 w-1 h-1 bg-blue-400/30 rounded-full animate-float-delayed"></div>
        <div className="absolute bottom-20 left-32 w-3 h-3 bg-purple-400/20 rounded-full animate-float-slow"></div>
        <div className="absolute top-64 left-1/2 w-1 h-1 bg-pink-400/30 rounded-full animate-float"></div>
        
        {/* Floating orbs */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-4 mb-4">
              <div className="text-4xl">🕵️</div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
                IMPOSTER LOBBY
              </h1>
              <div className="text-4xl">🎭</div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full transition-colors ${
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
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden mb-6"
               style={{
                 boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
               }}>
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
                    <div className="px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full animate-shimmer">
                      <span className="text-yellow-300 text-sm font-semibold">👑 HOST</span>
                    </div>
                  )}
                </div>
                
                {/* Room Code */}
                <button
                  onClick={copyRoomCode}
                  className="group relative px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-sm">Room Code:</span>
                    <span className="text-white font-mono font-bold text-lg">{playerData.roomCode}</span>
                    <span className="text-white/50 group-hover:text-white transition-colors">
                      {copiedCode ? '✓' : '📋'}
                    </span>
                  </div>
                  {copiedCode && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-500/90 text-white text-xs rounded animate-fade-in">
                      Copied!
                    </div>
                  )}
                </button>
              </div>

              {/* Players Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {players.map((player) => {
                  const isNew = newPlayerIds.has(player.id);
                  const isCurrentPlayer = player.id === playerData.playerId;
                  
                  return (
                    <div
                      key={player.id}
                      className={`
                        relative bg-white/5 backdrop-blur-sm border rounded-2xl p-4
                        transition-all duration-500 transform
                        ${isNew ? 'animate-slide-in scale-105 border-green-400/50' : 'border-white/20'}
                        ${isCurrentPlayer ? 'ring-2 ring-blue-400/50' : ''}
                        hover:bg-white/10 hover:scale-105
                      `}
                    >
                      {isNew && (
                        <div className="absolute -top-2 -right-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                          NEW
                        </div>
                      )}
                      
                      <div className="text-center">
                        <div className="text-4xl mb-2">{player.avatar || '🎭'}</div>
                        <p className="text-white font-medium truncate">
                          {player.name}
                          {isCurrentPlayer && <span className="text-blue-400 ml-1">(You)</span>}
                        </p>
                        {player.is_host && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-full">
                            <span className="text-xs">👑</span>
                            <span className="text-yellow-300 text-xs">Host</span>
                          </div>
                        )}
                        <div className="mt-2 text-white/50 text-xs">
                          Score: {player.total_score || 0}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Empty slots */}
                {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 border-dashed rounded-2xl p-4 flex items-center justify-center min-h-[140px]"
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2 opacity-30">➕</div>
                      <p className="text-white/30 text-sm">Waiting...</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl animate-shake">
                  <p className="text-red-200 text-center">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {playerData.isHost ? (
                  <>
                    <button
                      onClick={handleStartGame}
                      disabled={loading}
                      className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-blue-400/30 disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⚡</span>
                          Starting Game...
                        </span>
                      ) : (
                        '🚀 Start Game'
                      )}
                    </button>
                    <div className="text-center text-white/70 text-sm">
                      Current players: {players.length} (minimum 3 required)
                    </div>
                  </>
                ) : (
                  <div className="w-full py-4 bg-gradient-to-r from-gray-500/50 to-gray-600/50 rounded-xl">
                    <p className="text-white/70 text-center">
                      ⏳ Waiting for host to start the game...
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={fetchPlayers}
                    className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-300"
                  >
                    🔄 Refresh Players
                  </button>
                  
                  {!playerData.isHost && (
                    <button
                      onClick={async () => {
                        console.log('Manual game check triggered');
                        const { data } = await supabase
                          .from('rooms')
                          .select('status')
                          .eq('id', playerData.roomId)
                          .single();
                        
                        console.log('Manual check - room status:', data?.status);
                        if (data?.status === 'playing') {
                          console.log('Game is active, joining...');
                          onGameStart();
                        }
                      }}
                      className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300"
                    >
                      🎮 Check if Game Started
                    </button>
                  )}
                </div>

                <button
                  onClick={onLeave}
                  className="w-full py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300"
                >
                  Leave Room
                </button>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="text-center text-white/50 text-sm">
            <p>Share the room code with friends to let them join!</p>
            <p className="mt-1">Minimum 3 players required to start</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.1; }
        }
        
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        .animate-gradient {
          animation: gradient 4s ease infinite;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 3s ease-in-out infinite;
          animation-delay: 1s;
        }
        
        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
          animation-delay: 2s;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
          animation-delay: 1s;
        }
        
        .animate-slide-in {
          animation: slide-in 0.5s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
        }
      `}</style>
    </div>
  );
}