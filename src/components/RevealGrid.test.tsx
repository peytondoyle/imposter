import { RevealGrid } from './round/RevealGrid';

// Test component to verify RevealGrid works correctly
export function RevealGridTest() {
  const mockPlayers = [
    { id: '1', name: 'Peyton', avatar: '🦀', role: 'detective' as const },
    { id: '2', name: 'Louis', avatar: '🐙', role: 'detective' as const },
    { id: '3', name: 'Sam', avatar: '🦈', role: 'imposter' as const },
  ];

  const mockClues = {
    '1': 'Pizza',
    '2': 'Sushi', 
    '3': 'Toast',
  };

  const handleDiscussAndVote = () => {
    console.log('Discuss and Vote clicked!');
    alert('Discuss and Vote functionality works!');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          RevealGrid Component Test
        </h1>
        
        <RevealGrid
          players={mockPlayers}
          clues={mockClues}
          currentPlayerId="1"
          onDiscussAndVote={handleDiscussAndVote}
        />
        
        <div className="mt-8 bg-white rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Test Data:</h2>
          <div className="space-y-2">
            <div><strong>Players:</strong> {mockPlayers.length}</div>
            <div><strong>Clues:</strong> {Object.keys(mockClues).length}</div>
            <div><strong>Current Player:</strong> {mockPlayers.find(p => p.id === '1')?.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
