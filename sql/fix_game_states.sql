-- Fix Row Level Security policies for game_states table

-- First, let's drop existing policies if they exist
DROP POLICY IF EXISTS "Players can read game state" ON game_states;
DROP POLICY IF EXISTS "Players can update game state" ON game_states;
DROP POLICY IF EXISTS "Players can insert game state" ON game_states;

-- Disable RLS temporarily to test
ALTER TABLE game_states DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Create simpler, more permissive policies
CREATE POLICY "Allow all operations on game_states" ON game_states
  FOR ALL USING (true) WITH CHECK (true);

-- Alternative: If you want to be more restrictive, use this instead:
-- CREATE POLICY "Allow read access to game_states" ON game_states
--   FOR SELECT USING (true);
-- 
-- CREATE POLICY "Allow insert access to game_states" ON game_states
--   FOR INSERT WITH CHECK (true);
-- 
-- CREATE POLICY "Allow update access to game_states" ON game_states
--   FOR UPDATE USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON game_states TO authenticated;
GRANT ALL ON game_states TO anon;
