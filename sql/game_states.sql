-- Create game_states table for real-time multiplayer synchronization
CREATE TABLE IF NOT EXISTS game_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  current_phase TEXT NOT NULL DEFAULT 'role',
  topic JSONB,
  players JSONB DEFAULT '[]'::jsonb,
  clues JSONB DEFAULT '{}'::jsonb,
  votes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_states_room_id ON game_states(room_id);

-- Enable Row Level Security
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Create policy to allow players in the room to read game state
CREATE POLICY "Players can read game state" ON game_states
  FOR SELECT USING (
    room_id IN (
      SELECT id FROM rooms WHERE id = room_id
    )
  );

-- Create policy to allow players in the room to update game state
CREATE POLICY "Players can update game state" ON game_states
  FOR UPDATE USING (
    room_id IN (
      SELECT id FROM rooms WHERE id = room_id
    )
  );

-- Create policy to allow players in the room to insert game state
CREATE POLICY "Players can insert game state" ON game_states
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT id FROM rooms WHERE id = room_id
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_game_states_updated_at 
  BEFORE UPDATE ON game_states 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
