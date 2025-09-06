-- RPC Functions for prompts and answers system

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
