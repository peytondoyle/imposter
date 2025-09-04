import { useState } from 'react';
import { supabase } from '../lib/supabase';

const EMOJI_OPTIONS = [
  '🦀', '🐸', '🦊', '🐻', '🐵', '🦁', '🐯', '🐮',
  '🐷', '🐶', '🐱', '🐭', '🐹', '🐰', '🦝', '🐨',
  '🐼', '🦆', '🦅', '🦉', '🦇', '🐺', '🦋', '🐝',
  '🐢', '🦂', '🦑', '🦐', '🦞', '🦗', '🕷️', '🦟'
];

interface JoinRoomProps {
  onJoin: (playerData: any) => void;
}

export function JoinRoom({ onJoin }: JoinRoomProps) {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦀');
  // const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('imposter_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('imposter_device_id', deviceId);
    }
    return deviceId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !name) return;
    
    setLoading(true);
    setError('');

    try {
      const deviceId = getDeviceId();
      
      const { data, error: joinError } = await supabase.rpc('join_room', {
        p_room_code: roomCode.toUpperCase(),
        p_name: name,
        p_avatar: avatar,
        p_device_id: deviceId
      });

      if (joinError) throw joinError;

      localStorage.setItem(`imposter_token_${roomCode}`, data.write_token);
      
      onJoin({
        playerId: data.player_id,
        roomId: data.room_id,
        isHost: data.is_host,
        writeToken: data.write_token,
        roomCode: roomCode.toUpperCase(),
        name,
        avatar
      });

    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: createError } = await supabase.rpc('create_room', {
        p_max_players: 12,
        p_win_target: 5,
        p_family_safe_only: true
      });

      if (createError) throw createError;
      setRoomCode(data.code);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dynamic Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-blue-600 to-coral-500 animate-gradient-shift">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/30 via-transparent to-purple-400/30"></div>
        
        {/* Flowing Organic Gradient Blobs */}
        <div className="absolute top-20 left-20 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-3xl animate-blob-float"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-gradient-to-br from-blue-400/15 to-coral-400/15 rounded-full blur-3xl animate-blob-float-delayed"></div>
        <div className="absolute bottom-20 left-40 w-72 h-72 bg-gradient-to-br from-coral-400/20 to-purple-400/20 rounded-full blur-3xl animate-blob-float-slow"></div>
        <div className="absolute top-60 left-1/2 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-blob-float"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Liquid Glass Card with Multiple Layers */}
          <div className="relative">
            {/* Outer Glow Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-blue-200/10 to-purple-200/10 rounded-3xl blur-xl"></div>
            
            {/* Main Glass Card */}
            <div className="relative backdrop-blur-3xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8 overflow-hidden" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'}}>
              {/* Inner Glow Layer */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent rounded-3xl"></div>
              
              {/* Edge Highlight */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent rounded-3xl border border-white/10"></div>
            
            <div className="relative z-10">
              {/* Playful Header */}
              <div className="text-center mb-8">
                <div className="inline-block mb-4">
                  <div className="w-20 h-20 bg-white/15 backdrop-blur-sm rounded-full border border-white/30 flex items-center justify-center shadow-lg relative" style={{boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent rounded-full"></div>
                    <span className="text-4xl relative z-10">🕵️</span>
                  </div>
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-200 via-blue-200 to-purple-200 bg-clip-text text-transparent mb-2 tracking-tight drop-shadow-lg">
                  IMPOSTER
                </h1>
                <p className="text-white/90 text-lg font-medium">
                  Bluff with one word • Catch the Chameleon
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Room Code Section */}
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60 text-lg">
                      🔑
                    </div>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="w-full pl-12 pr-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-center text-xl font-mono uppercase placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all duration-300 shadow-lg focus:shadow-xl focus:shadow-blue-400/25 focus:bg-white/15"
                      placeholder="ABCD12"
                    />
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleCreateRoom}
                      disabled={loading}
                      className="px-4 py-2 bg-white/5 backdrop-blur-md hover:bg-white/10 text-white/80 text-sm font-medium rounded-full border border-white/20 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:scale-100 shadow-sm hover:shadow-md hover:shadow-blue-400/25 hover:border-blue-400/40"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span>New Room</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Name Section */}
                <div className="space-y-2">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/60 text-lg">
                      🙂
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={20}
                      className="w-full pl-12 pr-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-lg placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all duration-300 shadow-lg focus:shadow-xl focus:shadow-purple-400/25 focus:bg-white/15"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>

                {/* Avatar Section */}
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-white/80 text-sm mb-4">Choose your avatar</p>
                    <div className="flex gap-3 overflow-x-auto py-6 scrollbar-hide px-8 w-full max-w-4xl mx-auto">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAvatar(emoji)}
                          className={`flex-shrink-0 w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full border-2 flex items-center justify-center text-xl transition-all duration-300 hover:scale-110 hover:bg-white/20 hover:animate-jiggle shadow-lg hover:shadow-xl hover:shadow-blue-400/20 ${
                            avatar === emoji 
                              ? 'border-white/90 bg-white/30 scale-125 shadow-2xl ring-4 ring-blue-400/60 ring-opacity-50 animate-bounce' 
                              : 'border-white/20 hover:border-white/50'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-500/20 backdrop-blur-md border border-red-400/30 rounded-2xl text-red-200 text-sm animate-in slide-in-from-top-3 duration-300">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      {error}
                    </div>
                  </div>
                )}

                {/* Join Button - The Star */}
                <button
                  type="submit"
                  disabled={loading || !roomCode || !name}
                  className="w-full py-6 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 hover:from-blue-100 hover:via-purple-100 hover:to-pink-100 text-white font-bold text-xl rounded-full shadow-2xl hover:shadow-3xl hover:shadow-blue-400/30 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none relative overflow-hidden group"
                >
                  {/* Pressed Glass Effect */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent rounded-full"></div>
                  
                  {/* Inner Shadow for Depth */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 rounded-full"></div>
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-white/50 to-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  
                  {/* Light Reflection Sweep */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 delay-100"></div>
                  
                  <span className="relative z-10">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Joining...
                      </div>
                    ) : (
                      'Join the Game'
                    )}
                  </span>
                </button>
              </form>
            </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-white/50 text-sm font-medium tracking-wide">
            <p>Play together • Spot the fake • Be the best deceiver</p>
          </div>
        </div>
      </div>
    </div>
  );
}