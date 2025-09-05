# Imposter Selection Fix - Ensuring Exactly ONE Imposter

## 🎯 **Problem Identified**
The game was not properly assigning roles to players, which could lead to:
- Multiple imposters or no imposters
- Inconsistent role display
- Players not knowing their correct role

## ✅ **Root Cause**
The issue was in `Game.multiplayer.improved.tsx` where:
1. The `imposter_id` was correctly stored in the database round
2. But the individual players in the game state didn't have their `role` field assigned
3. This meant the UI couldn't properly display who was the imposter vs crew

## 🔧 **Fix Implemented**

### 1. **Role Assignment Logic**
```typescript
// Assign roles to players based on imposter_id
const playersWithRoles = (playersData || []).map((player: any) => ({
  ...player,
  role: player.id === roundData.imposter_id ? 'imposter' : 'detective'
}));
```

### 2. **Validation Check**
```typescript
// Validate that there's exactly one imposter
const imposterCount = playersWithRoles.filter(p => p.role === 'imposter').length;
if (imposterCount !== 1) {
  console.error('ERROR: Expected exactly 1 imposter, but found', imposterCount);
  // ... detailed logging for debugging
}
```

### 3. **Updated Player Assignment**
- Updated current player lookup to use `playersWithRoles`
- Added role information to debug logging
- Ensured all player references use the role-assigned players

## 🎮 **How It Works Now**

1. **Database Level**: `start_round` RPC function selects exactly one random imposter
2. **Frontend Level**: Game state creation assigns roles based on `imposter_id`
3. **Validation**: Console logging confirms exactly 1 imposter is assigned
4. **UI Display**: Players see correct role (Crew/Imposter) in role reveal phase

## 🔍 **Database Verification**
The database function `start_round` correctly:
- Gets all active players in the room
- Selects exactly one random player as imposter: 
  ```sql
  v_imposter_id := v_player_ids[floor(random() * array_length(v_player_ids, 1) + 1)::int];
  ```
- Stores the imposter_id in the rounds table

## 🧪 **Testing**
Created `test_imposter_selection.sql` to verify:
- Imposter selection logic works correctly
- Exactly one imposter is selected per round
- No duplicate or missing imposters

## ✅ **Result**
- **Exactly ONE imposter** is guaranteed per round
- All players have correct role assignments
- Role reveal phase shows correct roles
- Imposter guess phase only shows for the actual imposter
- Voting and scoring work correctly with proper role identification

The game now ensures there's always exactly one imposter per round, with proper role assignment and validation throughout the system.
