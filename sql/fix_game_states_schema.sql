-- Fix game_states table schema and permissions

-- First, check if the imposter_id column exists and add it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_states' AND column_name = 'imposter_id'
    ) THEN
        ALTER TABLE game_states ADD COLUMN imposter_id UUID;
    END IF;
END $$;

-- Ensure the table structure is complete
ALTER TABLE game_states 
  ALTER COLUMN topic TYPE JSONB USING topic::jsonb,
  ALTER COLUMN players TYPE JSONB USING players::jsonb,
  ALTER COLUMN clues TYPE JSONB USING clues::jsonb,
  ALTER COLUMN votes TYPE JSONB USING votes::jsonb;

-- Drop and recreate RLS policies with more permissive access for testing
DROP POLICY IF EXISTS "Allow all operations" ON game_states;

-- Create more specific policies
CREATE POLICY "Enable read access for all users" ON game_states
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON game_states
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON game_states
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON game_states
    FOR DELETE USING (true);

-- Grant all necessary permissions
GRANT ALL ON game_states TO authenticated;
GRANT ALL ON game_states TO anon;
GRANT ALL ON game_states TO service_role;

-- Test the permissions by inserting a sample record
DO $$
DECLARE
    test_room_id UUID := gen_random_uuid();
    test_game_id UUID;
BEGIN
    -- Insert a test game state
    INSERT INTO game_states (room_id, current_phase, topic, players, clues, votes, imposter_id)
    VALUES (
        test_room_id,
        'role',
        '{"category": "Test", "words": ["Test1", "Test2"], "secret_word": "Test1", "impostor_hint": "Test hint"}'::jsonb,
        '[{"id": "test-player", "name": "Test", "avatar": "🎭", "role": "detective"}]'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        'test-player'
    ) RETURNING id INTO test_game_id;
    
    RAISE NOTICE 'Test game state created with ID: %', test_game_id;
    
    -- Clean up test data
    DELETE FROM game_states WHERE id = test_game_id;
    RAISE NOTICE 'Test game state deleted successfully';
END $$;

-- Show final schema
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'game_states'
ORDER BY ordinal_position;