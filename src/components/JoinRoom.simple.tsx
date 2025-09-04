import { useState } from 'react';

const EMOJI_OPTIONS = [
  '🦀', '🐸', '🦊', '🐻', '🐵', '🦁', '🐯', '🐮',
  '🐷', '🐶', '🐱', '🐭', '🐹', '🐰', '🦝', '🐨'
];

interface JoinRoomProps {
  onJoin: () => void;
}

export function JoinRoom({ onJoin }: JoinRoomProps) {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦀');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !name) return;
    
    console.log('Joining room:', { roomCode, name, avatar });
    onJoin();
  };

  const handleCreateRoom = () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(newCode);
    console.log('Created room:', newCode);
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
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
              >
                New Room
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

          <button
            type="submit"
            disabled={!roomCode || !name}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}