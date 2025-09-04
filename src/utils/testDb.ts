import { supabase } from '../lib/supabase';

export async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test 1: Check rooms table
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('count')
      .limit(1);
    
    if (roomsError) {
      console.error('Rooms table error:', roomsError);
    } else {
      console.log('Rooms table accessible:', !!rooms);
    }
    
    // Test 2: Check players table
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('count')
      .limit(1);
    
    if (playersError) {
      console.error('Players table error:', playersError);
    } else {
      console.log('Players table accessible:', !!players);
    }
    
    // Test 3: Check game_states table
    const { data: gameStates, error: gameStatesError } = await supabase
      .from('game_states')
      .select('count')
      .limit(1);
    
    if (gameStatesError) {
      console.error('Game states table error:', gameStatesError);
    } else {
      console.log('Game states table accessible:', !!gameStates);
    }
    
    return {
      rooms: !roomsError,
      players: !playersError,
      gameStates: !gameStatesError
    };
    
  } catch (error) {
    console.error('Database test failed:', error);
    return {
      rooms: false,
      players: false,
      gameStates: false
    };
  }
}