# 🕵️ Imposter Game

A real-time multiplayer word game where players try to identify the imposter among them. Built with React, TypeScript, Vite, and Supabase.

## 🎮 How to Play

1. **Join or Create a Room**: Enter a 6-character room code or create a new room
2. **Choose Your Avatar**: Pick from 32 fun emoji avatars
3. **Role Assignment**: Each round, one player becomes the "Imposter"
4. **Topic Card**: 8 words are shown - crew members see the secret word highlighted
5. **Clue Phase**: Everyone submits a one-word clue about the secret word
6. **Clue Reveal**: All clues are revealed for discussion
7. **Voting**: Secret ballot to vote for who you think is the imposter
8. **Results**: Imposter is revealed, scores are calculated
9. **Next Round**: Play until someone reaches the win target!

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd imposter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file with your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Set up Supabase database**
   - Create a new Supabase project
   - Run the SQL files in order:
     - `sql/schema.sql` (creates tables and policies)
     - `sql/rpc_functions.sql` (creates game functions)
     - `sql/seed.sql` (populates topics data)

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── JoinRoom.beautiful.tsx    # Room joining interface
│   ├── Lobby.tsx                 # Game lobby
│   ├── RoleReveal.tsx            # Role and topic reveal
│   ├── ClueInput.tsx             # Clue submission
│   ├── ClueReveal.tsx            # Clue display
│   ├── Voting.tsx                # Voting interface
│   ├── Results.tsx               # Results and scoring
│   ├── Scoreboard.tsx            # Score tracking
│   └── Game.tsx                  # Main game orchestrator
├── stores/              # Zustand state management
│   └── gameStore.ts             # Game state
├── types/               # TypeScript definitions
│   └── game.ts                  # Game types
├── lib/                 # External services
│   └── supabase.ts             # Supabase client
└── utils/               # Utility functions
    └── device.ts               # Device ID management
```

## 🎯 Game Features

### ✅ Implemented
- **Room Management**: Create/join rooms with unique codes
- **Player Management**: Real-time player list with avatars
- **Role Assignment**: Random imposter selection each round
- **Topic System**: 90+ family-safe topic categories
- **Clue System**: One-word clue submission and reveal
- **Voting System**: Secret ballot voting
- **Scoring System**: Track points across multiple rounds
- **Real-time Updates**: Live game state synchronization
- **Responsive Design**: Works on desktop and mobile
- **Host Controls**: Game flow management

### 🔄 Game Flow
1. **Lobby** → Players join and wait for host to start
2. **Role Reveal** → Imposter and topic are assigned
3. **Clue Phase** → Players submit one-word clues
4. **Clue Reveal** → All clues shown for discussion
5. **Voting** → Secret ballot to identify imposter
6. **Results** → Imposter revealed, scores calculated
7. **Next Round** → Repeat until win condition met

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Deployment**: Vercel
- **Real-time**: Supabase Realtime subscriptions

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Vercel + Supabase.

### Quick Deploy
1. Set up Supabase project and run SQL files
2. Push code to GitHub
3. Connect to Vercel
4. Add environment variables
5. Deploy!

## 🎨 Customization

### Adding New Topics
Edit `sql/seed.sql` to add new topic categories:
```sql
INSERT INTO topics (category, topic, word1, word2, word3, word4, word5, word6, word7, word8, family_safe) VALUES
('Your Category', 'Your Topic', 'word1', 'word2', 'word3', 'word4', 'word5', 'word6', 'word7', 'word8', true);
```

### Styling
The app uses Tailwind CSS. Customize colors and styling in:
- `tailwind.config.js` - Theme configuration
- Component files - Individual component styles

### Game Rules
Modify game logic in:
- `sql/rpc_functions.sql` - Backend game logic
- Component files - Frontend game flow

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify Supabase URL and keys are correct
- Check that RLS policies are set up properly

**Real-time Updates Not Working**
- Ensure Supabase real-time is enabled
- Check browser console for WebSocket errors

**Build Failures**
- Run `npm install` to ensure all dependencies are installed
- Check for TypeScript errors with `npm run build`

### Getting Help
- Check the [Supabase Documentation](https://supabase.com/docs)
- Review browser console for client-side errors
- Check Supabase logs for server-side errors

---

🎉 **Have fun playing Imposter!** 🎉