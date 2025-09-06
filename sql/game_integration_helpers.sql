-- Game State Integration Helper Functions
-- These functions provide the specific interface mentioned in Phase 2 requirements

-- Get random prompts (3-5) for a round
CREATE OR REPLACE FUNCTION getRandomPrompts(
  p_room_id uuid,
  p_count int DEFAULT 4
)
RETURNS json AS $$
DECLARE
  v_prompts jsonb;
  v_prompt_ids bigint[];
  v_selected_prompt_id bigint;
BEGIN
  -- Select random prompts (3-5 prompts)
  SELECT array_agg(id ORDER BY random()) INTO v_prompt_ids
  FROM text_prompts
  ORDER BY random()
  LIMIT LEAST(p_count, 5);
  
  -- Select one prompt as the "secret" prompt
  v_selected_prompt_id := v_prompt_ids[floor(random() * array_length(v_prompt_ids, 1) + 1)::int];
  
  -- Get the selected prompts as JSON
  SELECT json_agg(
    json_build_object(
      'id', id,
      'prompt', prompt,
      'category', category,
      'is_secret', id = v_selected_prompt_id
    )
  ) INTO v_prompts
  FROM text_prompts
  WHERE id = ANY(v_prompt_ids);
  
  RETURN json_build_object(
    'prompts', v_prompts,
    'selected_prompt_id', v_selected_prompt_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Save answers for a player
CREATE OR REPLACE FUNCTION saveAnswers(
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

-- Get answers for a round (for reveal phase)
CREATE OR REPLACE FUNCTION getAnswers(
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

-- Submit a vote
CREATE OR REPLACE FUNCTION submitVote(
  p_round_id uuid,
  p_voter_id uuid,
  p_target_id uuid,
  p_write_token text
)
RETURNS json AS $$
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
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get votes for a round
CREATE OR REPLACE FUNCTION getVotes(
  p_round_id uuid
)
RETURNS json AS $$
DECLARE
  v_votes json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'voter_id', v.voter_id,
      'voter_name', pv.name,
      'target_id', v.target_id,
      'target_name', pt.name,
      'created_at', v.created_at
    ) ORDER BY v.created_at
  ) INTO v_votes
  FROM votes v
  JOIN players pv ON pv.id = v.voter_id
  JOIN players pt ON pt.id = v.target_id
  WHERE v.round_id = p_round_id;
  
  RETURN COALESCE(v_votes, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update scores after a round
CREATE OR REPLACE FUNCTION updateScores(
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
