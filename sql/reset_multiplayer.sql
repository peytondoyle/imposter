-- Reset multiplayer game state for testing

-- Delete all existing game states
DELETE FROM game_states;

-- Delete all existing players
DELETE FROM players;

-- Delete all existing rooms
DELETE FROM rooms;

-- Verify clean state
SELECT 'Rooms:', COUNT(*) FROM rooms;
SELECT 'Players:', COUNT(*) FROM players;
SELECT 'Game States:', COUNT(*) FROM game_states;