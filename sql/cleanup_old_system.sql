-- Clean up old game_states system and ensure only rounds-based system is used

-- Step 1: Delete all old game_states records
DELETE FROM game_states;

-- Step 2: Verify the rounds table has the correct structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'rounds'
ORDER BY ordinal_position;

-- Step 3: Check if there are any active rounds
SELECT 
  r.id,
  r.room_id,
  r.round_number,
  r.phase,
  r.secret_word_index,
  t.category,
  t.topic
FROM rounds r
LEFT JOIN topics t ON r.topic_id = t.id
ORDER BY r.started_at DESC
LIMIT 5;

-- Step 4: Check if clues table is working
SELECT 
  c.id,
  c.round_id,
  c.player_id,
  c.word,
  c.submitted_at
FROM clues c
ORDER BY c.submitted_at DESC
LIMIT 5;

-- Step 5: Check if votes table is working
SELECT 
  v.id,
  v.round_id,
  v.voter_id,
  v.target_id,
  v.created_at
FROM votes v
ORDER BY v.created_at DESC
LIMIT 5;

-- Step 6: Verify RPC functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('start_round', 'submit_clue', 'cast_vote', 'advance_phase')
ORDER BY routine_name;
