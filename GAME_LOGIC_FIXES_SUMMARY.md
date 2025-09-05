# Game Logic, Score System, and Win Conditions - Complete Fixes

## ✅ **FIXES IMPLEMENTED**

### 1. **Complete Game Flow with Score Calculation**
- ✅ Added `handleEndRound()` function that calls the `end_round` RPC function
- ✅ Proper score calculation using database functions
- ✅ Crew gets 1 point if imposter is caught
- ✅ Imposter gets 1 point if not caught + 1 bonus point for correct guess

### 2. **Imposter Guess Phase**
- ✅ Added new `imposter_guess` phase to game flow
- ✅ Imposter can guess the secret word for bonus points
- ✅ Non-imposters see waiting screen during guess phase
- ✅ Guess is passed to `end_round` function for score calculation

### 3. **Enhanced Results Phase**
- ✅ Shows actual secret word that was selected
- ✅ Displays imposter's guess and whether it was correct
- ✅ Shows current scores for all players
- ✅ Displays vote results with counts
- ✅ Shows game winner when someone reaches win target

### 4. **Win Condition Checking**
- ✅ Checks if any player has reached `win_target` (default 5 points)
- ✅ Displays special game winner announcement
- ✅ Different buttons for "Next Round" vs "New Game" based on win status

### 5. **Score Display Updates**
- ✅ Lobby shows current scores for all players (always visible)
- ✅ Results screen shows detailed score breakdown
- ✅ Score updates in real-time after each round

### 6. **Legacy System Cleanup**
- ✅ Removed all `game_states` table references from App.tsx
- ✅ Updated room status from 'waiting' to 'lobby'
- ✅ Cleaned up legacy cleanup code

## 🎮 **COMPLETE GAME FLOW**

1. **Role Reveal** - Players see their roles (Crew/Imposter)
2. **Clue Phase** - All players submit clues
3. **Reveal Clues** - All clues are shown to everyone
4. **Vote Phase** - Players vote on who they think is the imposter
5. **Imposter Guess** - Imposter guesses the secret word for bonus points
6. **Results** - Scores calculated, winner announced, next round or new game

## 🏆 **SCORING SYSTEM**

### Crew Members:
- **+1 point** if imposter is caught (voted out)

### Imposter:
- **+1 point** if not caught (not voted out)
- **+1 bonus point** if correctly guesses the secret word

### Win Condition:
- First player to reach `win_target` points (default: 5) wins the game

## 🔧 **TECHNICAL IMPLEMENTATION**

### Database Integration:
- Uses `end_round` RPC function for score calculation
- Updates `total_score` in `players` table
- Checks `win_target` from `rooms` table
- Real-time updates via Supabase subscriptions

### UI Components:
- `Game.multiplayer.improved.tsx` - Complete game flow with scoring
- `Lobby.realtime.tsx` - Shows current scores
- `Lobby.beautiful.tsx` - Enhanced score display
- `Lobby.working.tsx` - Consistent score display

### Phase Management:
- Added `imposter_guess` and `done` phases
- Proper phase transitions using `advance_phase` RPC
- Host controls for advancing phases

## 🎯 **KEY FEATURES**

1. **Real-time Score Updates** - Scores update immediately after each round
2. **Bonus Point System** - Imposter gets extra points for correct guesses
3. **Win Condition Detection** - Automatic game winner detection
4. **Comprehensive Results** - Shows all game details and statistics
5. **Clean UI** - Beautiful, consistent score displays throughout

## 🚀 **READY FOR TESTING**

The complete game flow is now implemented with:
- ✅ Proper score calculation
- ✅ Win condition checking
- ✅ Imposter guess phase
- ✅ Real-time updates
- ✅ Clean legacy code removal
- ✅ Enhanced UI with score displays

All components are using the new rounds-based system with proper RPC function calls for score calculation and game state management.
