-- Add unique constraint for active game states per room
-- This allows the upsert operation to work properly with onConflict: 'room_id'

-- First, ensure we only have one active game per room
WITH ranked_games AS (
  SELECT 
    id,
    room_id,
    ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at DESC) as rn
  FROM game_states
  WHERE is_active = true
)
UPDATE game_states 
SET is_active = false
FROM ranked_games 
WHERE game_states.id = ranked_games.id 
  AND ranked_games.rn > 1;

-- Create unique partial index to enforce only one active game per room
-- This will allow upsert with onConflict to work
DROP INDEX IF EXISTS one_active_state_per_room;
CREATE UNIQUE INDEX one_active_state_per_room
  ON game_states(room_id) WHERE is_active = true;

-- Test the constraint works
DO $$
DECLARE
  test_room_id UUID;
  room_count INTEGER;
BEGIN
  -- Check if we have any existing rooms to test with
  SELECT COUNT(*) INTO room_count FROM rooms;
  
  IF room_count > 0 THEN
    SELECT id INTO test_room_id FROM rooms LIMIT 1;
    
    -- This should work
    INSERT INTO game_states (room_id, current_phase, is_active, topic, players)
    VALUES (
      test_room_id, 
      'role', 
      true, 
      '{"category": "Test"}'::jsonb, 
      '[]'::jsonb
    );
    
    -- This should fail due to unique constraint
    BEGIN
      INSERT INTO game_states (room_id, current_phase, is_active, topic, players)
      VALUES (
        test_room_id, 
        'role', 
        true, 
        '{"category": "Test2"}'::jsonb, 
        '[]'::jsonb
      );
      
      RAISE EXCEPTION 'Unique constraint test failed - second insert should have been rejected';
    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE 'Unique constraint working correctly - only one active game per room allowed';
    END;
    
    -- Clean up test data
    DELETE FROM game_states WHERE room_id = test_room_id;
  ELSE
    RAISE NOTICE 'No existing rooms found - skipping constraint test';
  END IF;
  
  RAISE NOTICE 'Unique constraint migration completed successfully';
END $$;
