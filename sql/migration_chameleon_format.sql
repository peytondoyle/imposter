-- Migration to ensure Chameleon-style topic card format is properly set up
-- This migration ensures the schema matches the new 8-word format

-- First, check if we need to drop any old columns (if they exist)
-- Note: These columns might not exist in newer schemas, so we use IF EXISTS
DO $$ 
BEGIN
    -- Drop old columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'crew_topic') THEN
        ALTER TABLE topics DROP COLUMN crew_topic;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'imposter_category') THEN
        ALTER TABLE topics DROP COLUMN imposter_category;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'words') THEN
        ALTER TABLE topics DROP COLUMN words;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'secret_word') THEN
        ALTER TABLE topics DROP COLUMN secret_word;
    END IF;
END $$;

-- Ensure the topics table has the correct structure
-- Add columns if they don't exist
DO $$ 
BEGIN
    -- Add word columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word1') THEN
        ALTER TABLE topics ADD COLUMN word1 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word2') THEN
        ALTER TABLE topics ADD COLUMN word2 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word3') THEN
        ALTER TABLE topics ADD COLUMN word3 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word4') THEN
        ALTER TABLE topics ADD COLUMN word4 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word5') THEN
        ALTER TABLE topics ADD COLUMN word5 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word6') THEN
        ALTER TABLE topics ADD COLUMN word6 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word7') THEN
        ALTER TABLE topics ADD COLUMN word7 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'word8') THEN
        ALTER TABLE topics ADD COLUMN word8 text;
    END IF;
    
    -- Add family_safe column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'family_safe') THEN
        ALTER TABLE topics ADD COLUMN family_safe boolean DEFAULT true;
    END IF;
    
    -- Add topic column if it doesn't exist (for the topic name)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'topic') THEN
        ALTER TABLE topics ADD COLUMN topic text;
    END IF;
END $$;

-- Make word columns NOT NULL if they aren't already
ALTER TABLE topics ALTER COLUMN word1 SET NOT NULL;
ALTER TABLE topics ALTER COLUMN word2 SET NOT NULL;
ALTER TABLE topics ALTER COLUMN word3 SET NOT NULL;
ALTER TABLE topics ALTER COLUMN word4 SET NOT NULL;
ALTER TABLE topics ALTER COLUMN word5 SET NOT NULL;
ALTER TABLE topics ALTER COLUMN word6 SET NOT NULL;
ALTER TABLE topics ALTER COLUMN word7 SET NOT NULL;
ALTER TABLE topics ALTER COLUMN word8 SET NOT NULL;

-- Ensure rounds table has secret_word_index column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rounds' AND column_name = 'secret_word_index') THEN
        ALTER TABLE rounds ADD COLUMN secret_word_index int CHECK (secret_word_index BETWEEN 1 AND 8);
    END IF;
END $$;

-- Add imposter_guess_index column if it doesn't exist (for bonus guess phase)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rounds' AND column_name = 'imposter_guess_index') THEN
        ALTER TABLE rounds ADD COLUMN imposter_guess_index int CHECK (imposter_guess_index BETWEEN 1 AND 8);
    END IF;
END $$;

-- Update any existing data to have proper topic names (if topic column is empty)
UPDATE topics SET topic = category WHERE topic IS NULL OR topic = '';

-- Create index for better performance on family_safe filtering
CREATE INDEX IF NOT EXISTS idx_topics_family_safe ON topics(family_safe);

-- Verify the schema is correct
SELECT 
    'Schema verification:' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'topics' 
            AND column_name IN ('word1', 'word2', 'word3', 'word4', 'word5', 'word6', 'word7', 'word8')
        ) THEN 'Topics table has 8 word columns ✓'
        ELSE 'Topics table missing word columns ✗'
    END as topics_check,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'rounds' 
            AND column_name = 'secret_word_index'
        ) THEN 'Rounds table has secret_word_index ✓'
        ELSE 'Rounds table missing secret_word_index ✗'
    END as rounds_check;
