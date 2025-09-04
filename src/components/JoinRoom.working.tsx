import { useState } from 'react';
import { supabase } from '../lib/supabase';

const EMOJI_OPTIONS = [
  '🦀', '🐸', '🦊', '🐻', '🐵', '🦁', '🐯', '🐮',
  '🐷', '🐶', '🐱', '🐭', '🐹', '🐰', '🦝', '🐨'
];

interface JoinRoomProps {
  onJoin: (playerData: any) => void;
}

export function JoinRoom({ onJoin }: JoinRoomProps) {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦀');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate device ID for persistence
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

      // Save token for future requests
      localStorage.setItem(`imposter_token_${roomCode}`, data.write_token);
      
      console.log('Successfully joined room:', data);
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
      console.error('Join room error:', err);
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

      console.log('Created room:', data);
      setRoomCode(data.code);
    } catch (err: any) {
      console.error('Create room error:', err);
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          🕵️ Imposter
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-center text-2xl font-mono uppercase"
                placeholder="ABCD12"
              />
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={loading}
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading ? '...' : 'New Room'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-lg"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Avatar
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none text-4xl flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                {avatar}
              </button>
              
              {showEmojiPicker && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-white border-2 border-gray-200 rounded-xl p-3 grid grid-cols-8 gap-2 shadow-lg z-10">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setAvatar(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !roomCode || !name}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
}