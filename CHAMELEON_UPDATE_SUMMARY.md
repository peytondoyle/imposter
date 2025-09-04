# Chameleon-Style Topic Card Format Update

This document summarizes the complete update to implement the new Chameleon-style topic card format with 8 words per card.

## ✅ Completed Changes

### 1. Supabase Schema Updates

**File: `sql/schema.sql`** ✅ Already Correct
- The `topics` table already has the correct structure:
  - `id bigserial primary key`
  - `category text not null`
  - `topic text not null`
  - `word1` through `word8` text not null
  - `family_safe boolean default true`
- The `rounds` table already has:
  - `secret_word_index int not null check (secret_word_index between 1 and 8)`
  - `imposter_guess_index int check (imposter_guess_index between 1 and 8)`

**File: `sql/migration_chameleon_format.sql`** ✅ New
- Migration script to ensure schema compatibility
- Drops old columns if they exist (`crew_topic`, `imposter_category`)
- Adds missing columns if needed
- Verifies schema integrity

### 2. Seeding Logic Updates

**File: `sql/seed.sql`** ✅ Updated
- Updated CSV import instructions for `topics_cards_500.csv`
- Sample data already in correct format with 8 words per topic
- 91 sample topics included for testing

### 3. Game Logic Updates

**File: `src/components/Game.multiplayer.improved.tsx`** ✅ Updated
- Removed hardcoded `TOPICS` array
- Updated `createNewGame()` to fetch topics from Supabase
- Picks random `secret_word_index` (1-8) instead of random word
- Updated topic structure to include all 8 words and `secret_word_index`
- Updated RoleReveal UI to show 8-word topic card with highlighting

**File: `src/components/Game.localStorage.tsx`** ✅ Updated
- Updated `SAMPLE_TOPICS` to new format with 8 words
- Updated `createNewLocalGame()` to use `secret_word_index`
- Updated RoleReveal UI to show 8-word topic card

**File: `src/components/Game.multiplayer.tsx`** ✅ Updated
- Updated initial game state to use new topic format
- Updated RoleReveal UI to show 8-word topic card

**File: `src/components/Game.simple.tsx`** ✅ Updated
- Updated RoleReveal UI to show 8-word topic card

### 4. Frontend Component Updates

**File: `src/components/TopicCard.tsx`** ✅ New
- Reusable component for displaying topic cards
- Shows all 8 words in a 2x4 grid
- Highlights secret word for crew members
- Shows different UI for Chameleon vs Crew
- Includes mission instructions

**File: `src/types/game.ts`** ✅ Already Correct
- `Topic` interface already has `word1` through `word8` fields
- `Round` interface already has `secret_word_index` field

### 5. RPC Functions

**File: `sql/rpc_functions.sql`** ✅ Already Correct
- `start_round()` function already picks random `secret_word_index` (1-8)
- `get_room_state()` function already handles new topic format
- `end_round()` function already handles `imposter_guess_index` for bonus guess

## 🎮 How It Works Now

### Game Flow:
1. **Round Start**: Host calls `start_round()` RPC function
2. **Topic Selection**: Random topic selected from Supabase `topics` table
3. **Secret Word**: Random `secret_word_index` (1-8) selected
4. **Role Assignment**: Random player becomes Chameleon
5. **Role Reveal**: 
   - **Crew members** see topic card with highlighted secret word
   - **Chameleon** sees topic card with all 8 words but no highlight
6. **Clue Phase**: Players give clues about their word
7. **Voting**: Players vote for who they think is the Chameleon
8. **Reveal**: If Chameleon is caught, they get bonus guess at secret word

### Topic Card Display:
- **Category** at the top (e.g., "Animals", "Food")
- **8 words** in a 2x4 grid layout
- **Secret word highlighted** for crew members only
- **Mission instructions** for each role

### Database Structure:
```sql
-- Topics table
topics (
  id, category, topic, word1, word2, word3, word4, word5, word6, word7, word8, family_safe
)

-- Rounds table  
rounds (
  id, room_id, round_number, topic_id, secret_word_index, imposter_id, imposter_guess_index, ...
)
```

## 📁 Files Modified/Created

### New Files:
- `src/components/TopicCard.tsx` - Reusable topic card component
- `sql/migration_chameleon_format.sql` - Schema migration
- `CHAMELEON_UPDATE_SUMMARY.md` - This summary

### Modified Files:
- `src/components/Game.multiplayer.improved.tsx` - Main game logic
- `src/components/Game.localStorage.tsx` - LocalStorage fallback
- `src/components/Game.multiplayer.tsx` - Multiplayer component
- `src/components/Game.simple.tsx` - Simple game component
- `sql/seed.sql` - Updated CSV import instructions

### Already Correct:
- `sql/schema.sql` - Schema was already correct
- `sql/rpc_functions.sql` - RPC functions were already correct
- `src/types/game.ts` - Types were already correct

## 🚀 Deployment Steps

1. **Run Migration**: Execute `sql/migration_chameleon_format.sql` in Supabase
2. **Import Topics**: Use `sql/seed.sql` to import your `topics_cards_500.csv`
3. **Deploy Frontend**: Deploy updated React components
4. **Test**: Verify topic cards display correctly with 8 words

## 🎯 Key Features Implemented

✅ **8 words per topic card**  
✅ **Random secret word index (1-8)**  
✅ **Crew sees highlighted secret word**  
✅ **Chameleon sees all words without highlight**  
✅ **Bonus guess phase for caught Chameleon**  
✅ **Family-safe filtering**  
✅ **Proper database schema**  
✅ **Reusable TopicCard component**  
✅ **Updated all game variants**  

The project is now fully updated to use the Chameleon-style topic card format!
