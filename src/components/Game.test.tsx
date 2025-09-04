import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface GameTestProps {
  onBackToLobby: () => void;
  playerData: any;
}

export function Game({ onBackToLobby, playerData }: GameTestProps) {
  const [testResult, setTestResult] = useState<string>('Testing...');
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    const testSupabaseConnection = async () => {
      try {
        // Test 1: Basic connection
        setTestResult('Testing Supabase connection...');
        
        // Test 2: Try to read from game_states table
        const { data, error } = await supabase
          .from('game_states')
          .select('*')
          .eq('room_id', playerData.roomId);

        if (error) {
          setTestResult(`Error: ${error.message}`);
          console.error('Supabase error:', error);
        } else {
          setTestResult(`Success! Found ${data?.length || 0} game states`);
          if (data && data.length > 0) {
            setGameState(data[0]);
          }
        }
      } catch (err) {
        setTestResult(`Connection error: ${err}`);
        console.error('Connection error:', err);
      }
    };

    testSupabaseConnection();
  }, [playerData.roomId]);

  const createTestGameState = async () => {
    try {
      setTestResult('Creating test game state...');
      
      const testGameState = {
        room_id: playerData.roomId,
        current_phase: 'role',
        topic: {
          category: 'Animals',
          words: ['Lion', 'Tiger', 'Elephant'],
          secret_word: 'Lion'
        },
        players: [
          { id: playerData.playerId, name: playerData.name, avatar: '🦀', role: 'detective' }
        ]
      };

      const { data, error } = await supabase
        .from('game_states')
        .insert([testGameState])
        .select()
        .single();

      if (error) {
        setTestResult(`Insert error: ${error.message}`);
        console.error('Insert error:', error);
      } else {
        setTestResult('Successfully created game state!');
        setGameState(data);
      }
    } catch (err) {
      setTestResult(`Insert error: ${err}`);
      console.error('Insert error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'}}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔧 Supabase Test</h1>
          <p className="text-white/80">Testing database connection and permissions</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Test Results:</h2>
          <p className="text-white/80 mb-4">{testResult}</p>
          
          {gameState && (
            <div className="mt-4">
              <h3 className="text-lg font-bold text-white mb-2">Game State:</h3>
              <pre className="text-white/70 text-sm bg-black/20 p-3 rounded overflow-auto">
                {JSON.stringify(gameState, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <button
            onClick={createTestGameState}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all"
          >
            Create Test Game State
          </button>
          
          <button
            onClick={onBackToLobby}
            className="w-full py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
