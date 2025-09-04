-- Complete fix for game_states table issues

-- Step 1: Drop the table completely and recreate it
DROP TABLE IF EXISTS game_states CASCADE;

-- Step 2: Recreate the table with proper structure
CREATE TABLE game_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  current_phase TEXT NOT NULL DEFAULT 'role',
  topic JSONB,
  players JSONB DEFAULT '[]'::jsonb,
  clues JSONB DEFAULT '{}'::jsonb,
  votes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create index for faster queries
CREATE INDEX idx_game_states_room_id ON game_states(room_id);

-- Step 4: Enable RLS
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Step 5: Create very permissive policies (for testing)
CREATE POLICY "Allow all operations" ON game_states
  FOR ALL USING (true) WITH CHECK (true);

-- Step 6: Grant all permissions
GRANT ALL ON game_states TO authenticated;
GRANT ALL ON game_states TO anon;
GRANT ALL ON game_states TO service_role;

-- Step 7: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 8: Create trigger to automatically update updated_at
CREATE TRIGGER update_game_states_updated_at 
  BEFORE UPDATE ON game_states 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Test insert (this should work now)
INSERT INTO game_states (room_id, current_phase, topic, players) 
VALUES (
  gen_random_uuid(),
  'role',
  '{"category": "Test", "words": ["Test"], "secret_word": "Test"}'::jsonb,
  '[{"id": "test", "name": "Test Player", "role": "detective"}]'::jsonb
);

-- Step 10: Verify the insert worked
SELECT * FROM game_states LIMIT 1;
