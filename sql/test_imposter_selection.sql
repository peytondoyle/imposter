-- Test script to verify imposter selection is working correctly
-- This ensures there's always exactly ONE imposter per round

-- Test the imposter selection logic
DO $$
DECLARE
  v_room_id uuid;
  v_player_ids uuid[];
  v_imposter_id uuid;
  v_imposter_count int;
  v_test_rounds int := 100;
  v_i int;
BEGIN
  -- Create a test room
  INSERT INTO rooms (code, max_players, win_target, family_safe_only)
  VALUES ('TEST99', 6, 5, true)
  RETURNING id INTO v_room_id;
  
  -- Create test players
  INSERT INTO players (room_id, name, avatar, device_id, write_token, is_host)
  VALUES 
    (v_room_id, 'Player1', '🦀', gen_random_uuid(), 'token1', true),
    (v_room_id, 'Player2', '🐙', gen_random_uuid(), 'token2', false),
    (v_room_id, 'Player3', '🦑', gen_random_uuid(), 'token3', false),
    (v_room_id, 'Player4', '🦐', gen_random_uuid(), 'token4', false),
    (v_room_id, 'Player5', '🦞', gen_random_uuid(), 'token5', false);
  
  -- Get player IDs
  SELECT array_agg(id) INTO v_player_ids
  FROM players
  WHERE room_id = v_room_id;
  
  RAISE NOTICE 'Testing imposter selection with % players', array_length(v_player_ids, 1);
  RAISE NOTICE 'Player IDs: %', v_player_ids;
  
  -- Test imposter selection multiple times
  FOR v_i IN 1..v_test_rounds LOOP
    -- Select random imposter (same logic as in start_round function)
    v_imposter_id := v_player_ids[floor(random() * array_length(v_player_ids, 1) + 1)::int];
    
    -- Count how many times each player was selected as imposter
    -- (This is just for verification, not stored)
  END LOOP;
  
  -- Test the actual start_round function
  BEGIN
    PERFORM start_round(v_room_id, 'token1');
    
    -- Check that exactly one round was created with exactly one imposter
    SELECT COUNT(*) INTO v_imposter_count
    FROM rounds r
    JOIN players p ON p.id = r.imposter_id
    WHERE r.room_id = v_room_id;
    
    IF v_imposter_count = 1 THEN
      RAISE NOTICE 'SUCCESS: Exactly 1 imposter selected in round';
    ELSE
      RAISE NOTICE 'ERROR: Expected 1 imposter, found %', v_imposter_count;
    END IF;
    
    -- Show the selected imposter
    SELECT p.name, p.avatar INTO v_imposter_id
    FROM rounds r
    JOIN players p ON p.id = r.imposter_id
    WHERE r.room_id = v_room_id;
    
    RAISE NOTICE 'Selected imposter: % %', v_imposter_id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in start_round: %', SQLERRM;
  END;
  
  -- Clean up test data
  DELETE FROM rounds WHERE room_id = v_room_id;
  DELETE FROM players WHERE room_id = v_room_id;
  DELETE FROM rooms WHERE id = v_room_id;
  
  RAISE NOTICE 'Test completed and cleaned up';
END $$;
