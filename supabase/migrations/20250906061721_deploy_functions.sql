-- Deploy RPC Functions for game operations
-- This migration adds all the necessary RPC functions to the database

-- Join or create player in room
CREATE OR REPLACE FUNCTION join_room(
  p_room_code text,
  p_name text,
  p_avatar text,
  p_device_id uuid
)
RETURNS json AS $$
DECLARE
  v_room_id uuid;
  v_player_id uuid;
  v_write_token text;
  v_is_host boolean := false;
  v_player_count int;
BEGIN
  -- Find room by code
  SELECT id INTO v_room_id 
  FROM rooms 
  WHERE code = p_room_code 
  AND status != 'ended';
  
  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Room not found or has ended';
  END IF;
  
  -- Check if room is full
  SELECT COUNT(*) INTO v_player_count
  FROM players
  WHERE room_id = v_room_id;
  
  IF v_player_count >= (SELECT max_players FROM rooms WHERE id = v_room_id) THEN
    RAISE EXCEPTION 'Room is full';
  END IF;
  
  -- Generate write token
  v_write_token := encode(gen_random_bytes(32), 'hex');
  
  -- Check if player already exists
  SELECT id INTO v_player_id
  FROM players
  WHERE room_id = v_room_id AND device_id = p_device_id;
  
  IF v_player_id IS NOT NULL THEN
    -- Update existing player
    UPDATE players 
    SET name = p_name,
        avatar = p_avatar,
        write_token = v_write_token,
        last_seen = now()
    WHERE id = v_player_id
    RETURNING is_host INTO v_is_host;
  ELSE
    -- Determine if this player should be host
    v_is_host := v_player_count = 0;
    
    -- Create new player
    INSERT INTO players (room_id, name, avatar, device_id, write_token, is_host)
    VALUES (v_room_id, p_name, p_avatar, p_device_id, v_write_token, v_is_host)
    RETURNING id INTO v_player_id;
  END IF;
  
  RETURN json_build_object(
    'player_id', v_player_id,
    'room_id', v_room_id,
    'write_token', v_write_token,
    'is_host', v_is_host
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new room
CREATE OR REPLACE FUNCTION create_room(
  p_max_players int DEFAULT 12,
  p_win_target int DEFAULT 5,
  p_family_safe_only boolean DEFAULT true
)
RETURNS json AS $$
DECLARE
  v_room_id uuid;
  v_room_code text;
  v_attempts int := 0;
BEGIN
  -- Generate unique room code (max 10 attempts)
  LOOP
    v_room_code := generate_room_code();
    v_attempts := v_attempts + 1;
    
    BEGIN
      INSERT INTO rooms (code, max_players, win_target, family_safe_only)
      VALUES (v_room_code, p_max_players, p_win_target, p_family_safe_only)
      RETURNING id INTO v_room_id;
      
      EXIT; -- Success, exit loop
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 10 THEN
        RAISE EXCEPTION 'Could not generate unique room code';
      END IF;
    END;
  END LOOP;
  
  RETURN json_build_object(
    'room_id', v_room_id,
    'code', v_room_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start a new round
CREATE OR REPLACE FUNCTION start_round(
  p_room_id uuid,
  p_write_token text
)
RETURNS json AS $$
DECLARE
  v_round_id uuid;
  v_topic_id bigint;
  v_secret_word_index int;
  v_imposter_id uuid;
  v_round_number int;
  v_family_safe_only boolean;
  v_player_ids uuid[];
BEGIN
  -- Verify host
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE room_id = p_room_id 
    AND write_token = p_write_token 
    AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Update room status
  UPDATE rooms 
  SET status = 'playing',
      current_round = current_round + 1
  WHERE id = p_room_id
  RETURNING current_round, family_safe_only 
  INTO v_round_number, v_family_safe_only;
  
  -- Get all active players
  SELECT array_agg(id) INTO v_player_ids
  FROM players
  WHERE room_id = p_room_id
  AND last_seen > now() - interval '5 minutes';
  
  IF array_length(v_player_ids, 1) < 3 THEN
    RAISE EXCEPTION 'Need at least 3 players to start';
  END IF;
  
  -- Select random topic
  SELECT id INTO v_topic_id
  FROM topics
  WHERE (NOT v_family_safe_only OR family_safe = true)
  ORDER BY random()
  LIMIT 1;
  
  -- Select random secret word (1-8)
  v_secret_word_index := floor(random() * 8 + 1)::int;
  
  -- Select random imposter
  v_imposter_id := v_player_ids[floor(random() * array_length(v_player_ids, 1) + 1)::int];
  
  -- Create round
  INSERT INTO rounds (
    room_id, 
    round_number, 
    topic_id, 
    secret_word_index, 
    imposter_id,
    phase,
    phase_deadline
  )
  VALUES (
    p_room_id, 
    v_round_number, 
    v_topic_id, 
    v_secret_word_index, 
    v_imposter_id,
    'role_reveal',
    now() + interval '10 seconds'
  )
  RETURNING id INTO v_round_id;
  
  -- Generate prompts for this round
  PERFORM generate_prompts(v_round_id, p_write_token);
  
  RETURN json_build_object(
    'round_id', v_round_id,
    'round_number', v_round_number,
    'topic_id', v_topic_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit a clue
CREATE OR REPLACE FUNCTION submit_clue(
  p_round_id uuid,
  p_player_id uuid,
  p_word text,
  p_write_token text
)
RETURNS void AS $$
BEGIN
  -- Verify player and token
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE id = p_player_id 
    AND write_token = p_write_token
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Verify round is in clue phase
  IF NOT EXISTS (
    SELECT 1 FROM rounds 
    WHERE id = p_round_id 
    AND phase = 'clue'
  ) THEN
    RAISE EXCEPTION 'Not in clue phase';
  END IF;
  
  -- Validate word
  IF length(p_word) > 25 OR length(p_word) = 0 THEN
    RAISE EXCEPTION 'Invalid clue length';
  END IF;
  
  -- Set the write token context for RLS
  PERFORM set_config('app.write_token', p_write_token, true);
  
  -- Insert clue (upsert)
  INSERT INTO clues (round_id, player_id, word)
  VALUES (p_round_id, p_player_id, p_word)
  ON CONFLICT (round_id, player_id) 
  DO UPDATE SET word = p_word, submitted_at = now();
  
  -- Update player last_seen
  UPDATE players 
  SET last_seen = now() 
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cast a vote
CREATE OR REPLACE FUNCTION cast_vote(
  p_round_id uuid,
  p_voter_id uuid,
  p_target_id uuid,
  p_write_token text
)
RETURNS void AS $$
BEGIN
  -- Verify voter and token
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE id = p_voter_id 
    AND write_token = p_write_token
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Verify round is in vote phase
  IF NOT EXISTS (
    SELECT 1 FROM rounds 
    WHERE id = p_round_id 
    AND phase = 'vote'
  ) THEN
    RAISE EXCEPTION 'Not in vote phase';
  END IF;
  
  -- Can't vote for yourself
  IF p_voter_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot vote for yourself';
  END IF;

  -- Set the write token context for RLS
  PERFORM set_config('app.write_token', p_write_token, true);

  -- Insert vote (upsert)
  INSERT INTO votes (round_id, voter_id, target_id)
  VALUES (p_round_id, p_voter_id, p_target_id)
  ON CONFLICT (round_id, voter_id) 
  DO UPDATE SET target_id = p_target_id, created_at = now();
  
  -- Update player last_seen
  UPDATE players 
  SET last_seen = now() 
  WHERE id = p_voter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advance round phase
CREATE OR REPLACE FUNCTION advance_phase(
  p_round_id uuid,
  p_write_token text
)
RETURNS json AS $$
DECLARE
  v_current_phase text;
  v_new_phase text;
  v_room_id uuid;
  v_deadline timestamptz;
BEGIN
  -- Get current phase and verify host
  SELECT r.phase, r.room_id INTO v_current_phase, v_room_id
  FROM rounds r
  WHERE r.id = p_round_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE room_id = v_room_id 
    AND write_token = p_write_token 
    AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Determine next phase
  CASE v_current_phase
    WHEN 'role_reveal' THEN 
      v_new_phase := 'clue';
      v_deadline := now() + interval '60 seconds';
    WHEN 'clue' THEN 
      v_new_phase := 'reveal_clues';
      v_deadline := now() + interval '30 seconds';
    WHEN 'reveal_clues' THEN 
      v_new_phase := 'vote';
      v_deadline := now() + interval '45 seconds';
    WHEN 'vote' THEN 
      v_new_phase := 'imposter_guess';
      v_deadline := now() + interval '30 seconds';
    WHEN 'imposter_guess' THEN 
      v_new_phase := 'reveal';
      v_deadline := NULL;
    WHEN 'reveal' THEN 
      v_new_phase := 'done';
      v_deadline := NULL;
    ELSE
      RAISE EXCEPTION 'Invalid phase transition';
  END CASE;
  
  -- Update phase
  UPDATE rounds 
  SET phase = v_new_phase,
      phase_deadline = v_deadline
  WHERE id = p_round_id;
  
  RETURN json_build_object(
    'new_phase', v_new_phase,
    'deadline', v_deadline
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- End round and calculate scores
CREATE OR REPLACE FUNCTION end_round(
  p_round_id uuid,
  p_imposter_guess_index int,
  p_write_token text
)
RETURNS json AS $$
DECLARE
  v_room_id uuid;
  v_imposter_id uuid;
  v_secret_word_index int;
  v_most_voted_id uuid;
  v_imposter_caught boolean;
  v_imposter_score int := 0;
  v_crew_score int := 0;
  v_winner_id uuid;
BEGIN
  -- Get round info and verify host
  SELECT r.room_id, r.imposter_id, r.secret_word_index 
  INTO v_room_id, v_imposter_id, v_secret_word_index
  FROM rounds r
  WHERE r.id = p_round_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE room_id = v_room_id 
    AND write_token = p_write_token 
    AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Get most voted player
  SELECT target_id INTO v_most_voted_id
  FROM votes
  WHERE round_id = p_round_id
  GROUP BY target_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- Check if imposter was caught
  v_imposter_caught := (v_most_voted_id = v_imposter_id);
  
  -- Calculate scores based on new rules
  IF v_imposter_caught THEN
    -- Majority catches Imposter → all non-Imposters get +1 point
    v_crew_score := 1;
  ELSE
    -- Imposter survives → Imposter gets +2 points
    v_imposter_score := 2;
  END IF;
  
  -- Update round
  UPDATE rounds 
  SET phase = 'done',
      imposter_caught = v_imposter_caught,
      imposter_guess_index = p_imposter_guess_index
  WHERE id = p_round_id;
  
  -- Update scores
  IF v_imposter_caught THEN
    -- Crew wins
    UPDATE players 
    SET total_score = total_score + v_crew_score
    WHERE room_id = v_room_id 
    AND id != v_imposter_id;
  ELSE
    -- Imposter wins
    UPDATE players 
    SET total_score = total_score + v_imposter_score
    WHERE id = v_imposter_id;
  END IF;
  
  -- Check for game winner
  SELECT id INTO v_winner_id
  FROM players
  WHERE room_id = v_room_id
  AND total_score >= (SELECT win_target FROM rooms WHERE id = v_room_id)
  ORDER BY total_score DESC
  LIMIT 1;
  
  -- Update room status if game is won
  IF v_winner_id IS NOT NULL THEN
    UPDATE rooms 
    SET status = 'ended'
    WHERE id = v_room_id;
  END IF;
  
  RETURN json_build_object(
    'imposter_caught', v_imposter_caught,
    'imposter_score', v_imposter_score,
    'crew_score', v_crew_score,
    'game_winner_id', v_winner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transfer host to another player
CREATE OR REPLACE FUNCTION transfer_host(
  p_room_id uuid,
  p_new_host_id uuid,
  p_write_token text
)
RETURNS void AS $$
BEGIN
  -- Verify current host
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE room_id = p_room_id 
    AND write_token = p_write_token 
    AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Remove host from current
  UPDATE players 
  SET is_host = false
  WHERE room_id = p_room_id 
  AND is_host = true;
  
  -- Set new host
  UPDATE players 
  SET is_host = true
  WHERE id = p_new_host_id 
  AND room_id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kick a player from the room
CREATE OR REPLACE FUNCTION kick_player(
  p_room_id uuid,
  p_player_id uuid,
  p_write_token text
)
RETURNS void AS $$
BEGIN
  -- Verify host
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE room_id = p_room_id 
    AND write_token = p_write_token 
    AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Can't kick yourself
  IF EXISTS (
    SELECT 1 FROM players 
    WHERE id = p_player_id 
    AND write_token = p_write_token
  ) THEN
    RAISE EXCEPTION 'Cannot kick yourself';
  END IF;
  
  -- Delete player
  DELETE FROM players 
  WHERE id = p_player_id 
  AND room_id = p_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get room state (for polling)
CREATE OR REPLACE FUNCTION get_room_state(
  p_room_id uuid
)
RETURNS json AS $$
DECLARE
  v_room json;
  v_players json;
  v_current_round json;
BEGIN
  -- Get room info
  SELECT json_build_object(
    'id', id,
    'code', code,
    'status', status,
    'max_players', max_players,
    'win_target', win_target,
    'current_round', current_round,
    'family_safe_only', family_safe_only
  ) INTO v_room
  FROM rooms
  WHERE id = p_room_id;
  
  -- Get players
  SELECT json_agg(
    json_build_object(
      'id', id,
      'name', name,
      'avatar', avatar,
      'is_host', is_host,
      'total_score', total_score,
      'last_seen', last_seen
    ) ORDER BY joined_at
  ) INTO v_players
  FROM players
  WHERE room_id = p_room_id;
  
  -- Get current round info
  SELECT json_build_object(
    'id', r.id,
    'round_number', r.round_number,
    'phase', r.phase,
    'phase_deadline', r.phase_deadline,
    'topic', t.*,
    'secret_word_index', CASE 
      WHEN r.phase IN ('reveal', 'done') THEN r.secret_word_index 
      ELSE NULL 
    END,
    'imposter_id', CASE 
      WHEN r.phase IN ('reveal', 'done') THEN r.imposter_id 
      ELSE NULL 
    END,
    'imposter_caught', r.imposter_caught,
    'clues_count', (SELECT COUNT(*) FROM clues WHERE round_id = r.id),
    'votes_count', (SELECT COUNT(*) FROM votes WHERE round_id = r.id)
  ) INTO v_current_round
  FROM rounds r
  JOIN topics t ON t.id = r.topic_id
  WHERE r.room_id = p_room_id
  ORDER BY r.round_number DESC
  LIMIT 1;
  
  RETURN json_build_object(
    'room', v_room,
    'players', v_players,
    'current_round', v_current_round
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Generate prompts for a round (called when round starts)
CREATE OR REPLACE FUNCTION generate_prompts(
  p_round_id uuid,
  p_write_token text
)
RETURNS json AS $$
DECLARE
  v_topic_id bigint;
  v_secret_word_index int;
  v_prompts text[];
  v_prompt_count int := 4; -- Generate 4 prompts by default
  v_prompt_id bigint;
  v_prompt_order int;
BEGIN
  -- Verify host
  IF NOT EXISTS (
    SELECT 1 FROM rounds r
    JOIN players p ON p.room_id = r.room_id
    WHERE r.id = p_round_id 
    AND p.write_token = p_write_token 
    AND p.is_host = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Get topic and secret word info
  SELECT topic_id, secret_word_index 
  INTO v_topic_id, v_secret_word_index
  FROM rounds 
  WHERE id = p_round_id;
  
  -- Generate prompts based on the topic
  -- For now, we'll create generic prompts that work with any topic
  v_prompts := ARRAY[
    'What is your favorite thing about this topic?',
    'Describe something related to this topic in one word.',
    'What would you do if you were an expert in this topic?',
    'What is the most interesting aspect of this topic?'
  ];
  
  -- Insert prompts into database
  FOR v_prompt_order IN 1..v_prompt_count LOOP
    INSERT INTO prompts (round_id, prompt_text, prompt_order)
    VALUES (p_round_id, v_prompts[v_prompt_order], v_prompt_order)
    RETURNING id INTO v_prompt_id;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'prompt_count', v_prompt_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit answers for all prompts
CREATE OR REPLACE FUNCTION submit_answers(
  p_round_id uuid,
  p_player_id uuid,
  p_answers json,
  p_write_token text
)
RETURNS json AS $$
DECLARE
  v_answer_record json;
  v_prompt_id bigint;
  v_answer_text text;
  v_prompt_order int;
  v_submitted_count int := 0;
BEGIN
  -- Verify player and token
  IF NOT EXISTS (
    SELECT 1 FROM players 
    WHERE id = p_player_id 
    AND write_token = p_write_token
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Verify round is in clue phase
  IF NOT EXISTS (
    SELECT 1 FROM rounds 
    WHERE id = p_round_id 
    AND phase = 'clue'
  ) THEN
    RAISE EXCEPTION 'Not in clue phase';
  END IF;
  
  -- Set the write token context for RLS
  PERFORM set_config('app.write_token', p_write_token, true);
  
  -- Process each answer
  FOR v_answer_record IN SELECT * FROM json_array_elements(p_answers) LOOP
    v_prompt_order := (v_answer_record->>'prompt_order')::int;
    v_answer_text := v_answer_record->>'answer_text';
    
    -- Validate answer
    IF length(v_answer_text) > 100 OR length(v_answer_text) = 0 THEN
      RAISE EXCEPTION 'Invalid answer length for prompt %', v_prompt_order;
    END IF;
    
    -- Get prompt ID
    SELECT id INTO v_prompt_id
    FROM prompts
    WHERE round_id = p_round_id AND prompt_order = v_prompt_order;
    
    IF v_prompt_id IS NULL THEN
      RAISE EXCEPTION 'Prompt not found for order %', v_prompt_order;
    END IF;
    
    -- Insert or update answer
    INSERT INTO answers (round_id, player_id, prompt_id, answer_text)
    VALUES (p_round_id, p_player_id, v_prompt_id, v_answer_text)
    ON CONFLICT (round_id, player_id, prompt_id) 
    DO UPDATE SET answer_text = v_answer_text, submitted_at = now();
    
    v_submitted_count := v_submitted_count + 1;
  END LOOP;
  
  -- Update player last_seen
  UPDATE players 
  SET last_seen = now() 
  WHERE id = p_player_id;
  
  RETURN json_build_object(
    'success', true,
    'submitted_count', v_submitted_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get prompts for a round
CREATE OR REPLACE FUNCTION get_prompts(
  p_round_id uuid
)
RETURNS json AS $$
DECLARE
  v_prompts json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', id,
      'prompt_text', prompt_text,
      'prompt_order', prompt_order
    ) ORDER BY prompt_order
  ) INTO v_prompts
  FROM prompts
  WHERE round_id = p_round_id;
  
  RETURN COALESCE(v_prompts, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get answers for a round (only after reveal phase)
CREATE OR REPLACE FUNCTION get_answers(
  p_round_id uuid
)
RETURNS json AS $$
DECLARE
  v_answers json;
BEGIN
  -- Only allow access after reveal phase
  IF NOT EXISTS (
    SELECT 1 FROM rounds 
    WHERE id = p_round_id 
    AND phase IN ('reveal_clues', 'vote', 'imposter_guess', 'reveal', 'done')
  ) THEN
    RAISE EXCEPTION 'Answers not available yet';
  END IF;
  
  SELECT json_agg(
    json_build_object(
      'player_id', a.player_id,
      'player_name', p.name,
      'player_avatar', p.avatar,
      'prompt_id', a.prompt_id,
      'prompt_text', pr.prompt_text,
      'prompt_order', pr.prompt_order,
      'answer_text', a.answer_text,
      'submitted_at', a.submitted_at
    ) ORDER BY pr.prompt_order, p.name
  ) INTO v_answers
  FROM answers a
  JOIN players p ON p.id = a.player_id
  JOIN prompts pr ON pr.id = a.prompt_id
  WHERE a.round_id = p_round_id;
  
  RETURN COALESCE(v_answers, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if all players have submitted answers
CREATE OR REPLACE FUNCTION check_answers_submitted(
  p_round_id uuid
)
RETURNS json AS $$
DECLARE
  v_player_count int;
  v_answered_count int;
  v_prompt_count int;
  v_all_submitted boolean;
BEGIN
  -- Get total players in the round
  SELECT COUNT(*) INTO v_player_count
  FROM rounds r
  JOIN players p ON p.room_id = r.room_id
  WHERE r.id = p_round_id;
  
  -- Get number of prompts
  SELECT COUNT(*) INTO v_prompt_count
  FROM prompts
  WHERE round_id = p_round_id;
  
  -- Get players who have answered all prompts
  SELECT COUNT(DISTINCT player_id) INTO v_answered_count
  FROM answers
  WHERE round_id = p_round_id
  GROUP BY player_id
  HAVING COUNT(*) = v_prompt_count;
  
  v_all_submitted := (v_answered_count = v_player_count);
  
  RETURN json_build_object(
    'all_submitted', v_all_submitted,
    'answered_count', v_answered_count,
    'total_players', v_player_count,
    'prompt_count', v_prompt_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION join_room TO authenticated;
GRANT EXECUTE ON FUNCTION join_room TO anon;
GRANT EXECUTE ON FUNCTION create_room TO authenticated;
GRANT EXECUTE ON FUNCTION create_room TO anon;
GRANT EXECUTE ON FUNCTION start_round TO authenticated;
GRANT EXECUTE ON FUNCTION start_round TO anon;
GRANT EXECUTE ON FUNCTION submit_clue TO authenticated;
GRANT EXECUTE ON FUNCTION submit_clue TO anon;
GRANT EXECUTE ON FUNCTION cast_vote TO authenticated;
GRANT EXECUTE ON FUNCTION cast_vote TO anon;
GRANT EXECUTE ON FUNCTION advance_phase TO authenticated;
GRANT EXECUTE ON FUNCTION advance_phase TO anon;
GRANT EXECUTE ON FUNCTION end_round TO authenticated;
GRANT EXECUTE ON FUNCTION end_round TO anon;
GRANT EXECUTE ON FUNCTION transfer_host TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_host TO anon;
GRANT EXECUTE ON FUNCTION kick_player TO authenticated;
GRANT EXECUTE ON FUNCTION kick_player TO anon;
GRANT EXECUTE ON FUNCTION get_room_state TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_state TO anon;
GRANT EXECUTE ON FUNCTION generate_prompts TO authenticated;
GRANT EXECUTE ON FUNCTION generate_prompts TO anon;
GRANT EXECUTE ON FUNCTION submit_answers TO authenticated;
GRANT EXECUTE ON FUNCTION submit_answers TO anon;
GRANT EXECUTE ON FUNCTION get_prompts TO authenticated;
GRANT EXECUTE ON FUNCTION get_prompts TO anon;
GRANT EXECUTE ON FUNCTION get_answers TO authenticated;
GRANT EXECUTE ON FUNCTION get_answers TO anon;
GRANT EXECUTE ON FUNCTION check_answers_submitted TO authenticated;
GRANT EXECUTE ON FUNCTION check_answers_submitted TO anon;
