import type { Topic } from '../types/game';

interface TopicCardProps {
  topic: Topic;
  secretWordIndex: number;
  isImposter: boolean;
  playerRole?: 'crew' | 'imposter';
}

export function TopicCard({ topic, secretWordIndex, isImposter, playerRole }: TopicCardProps) {
  const words = [
    topic.word1,
    topic.word2,
    topic.word3,
    topic.word4,
    topic.word5,
    topic.word6,
    topic.word7,
    topic.word8,
  ];

  const secretWord = words[secretWordIndex - 1];
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{topic.category}</h2>
          <div className="text-sm text-gray-500 mb-4">
            {isImposter ? (
              <span className="text-red-600 font-medium">🦹 You are the CHAMELEON</span>
            ) : (
              <span className="text-blue-600 font-medium">👥 You are CREW</span>
            )}
          </div>
          {!isImposter && (
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Secret Word:</span> <span className="font-bold text-blue-700">{secretWord}</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Give clues about this word without being too obvious!
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {words.map((word, index) => {
            const isSecret = index === secretWordIndex - 1;
            const shouldHighlight = !isImposter && isSecret;
            
            return (
              <div
                key={index}
                className={`
                  p-4 rounded-xl text-center font-medium text-lg border-2 transition-all
                  ${shouldHighlight 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-blue-400 shadow-lg transform scale-105' 
                    : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                  }
                `}
              >
                {word}
                {shouldHighlight && (
                  <div className="text-xs mt-1 opacity-90">SECRET</div>
                )}
              </div>
            );
          })}
        </div>

        {isImposter && (
          <div className="mt-6 bg-gradient-to-r from-red-100 to-orange-100 rounded-xl p-4">
            <p className="text-sm text-gray-700 text-center">
              <span className="font-semibold">Your Mission:</span> Blend in by giving a vague clue that could apply to any of these words.
              <br />
              <span className="text-xs text-gray-600">The crew knows the secret word, but you don't!</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
