import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Prompt {
  id: number;
  prompt_text: string;
  category: string;
}

interface AnswerFormProps {
  roundId: string;
  playerId: string;
  prompts: Prompt[];
  isImposter: boolean;
  onAnswersSubmitted: () => void;
  writeToken: string;
}

export function AnswerForm({ 
  roundId, 
  playerId, 
  prompts, 
  isImposter, 
  onAnswersSubmitted,
  writeToken 
}: AnswerFormProps) {
  const [answers, setAnswers] = useState<{ [promptId: number]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Check if all prompts have answers
  const allAnswered = prompts.every(prompt => 
    answers[prompt.id] && answers[prompt.id].trim().length > 0
  );

  const handleAnswerChange = (promptId: number, value: string) => {
    // Limit to 1-3 words
    const words = value.trim().split(/\s+/).slice(0, 3).join(' ');
    setAnswers(prev => ({
      ...prev,
      [promptId]: words
    }));
  };

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      // Prepare answers data
      const answersData = prompts.map(prompt => ({
        prompt_id: prompt.id,
        answer_text: answers[prompt.id].trim()
      }));

      // Submit answers using RPC function
      const { error } = await supabase.rpc('submit_answers', {
        p_round_id: roundId,
        p_player_id: playerId,
        p_answers: JSON.stringify(answersData),
        p_write_token: writeToken
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      onAnswersSubmitted();
    } catch (err: any) {
      console.error('Error submitting answers:', err);
      setError(err.message || 'Failed to submit answers');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <p className="text-white text-xl mb-4">Answers submitted!</p>
        <p className="text-white/70">Waiting for other players...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Answer the Prompts</h2>
        <p className="text-white/80">
          {isImposter 
            ? "Give vague answers that could apply to any prompt (1-3 words each)"
            : "Answer each prompt as if you know the secret word (1-3 words each)"
          }
        </p>
      </div>

      <div className="space-y-4">
        {prompts.map((prompt, index) => (
          <div key={prompt.id} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium mb-2">{prompt.prompt_text}</p>
                <div className="relative">
                  <input
                    type="text"
                    value={answers[prompt.id] || ''}
                    onChange={(e) => handleAnswerChange(prompt.id, e.target.value)}
                    placeholder="Enter 1-3 words..."
                    maxLength={50}
                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    disabled={submitting}
                  />
                  <div className="text-xs text-white/60 mt-1">
                    {answers[prompt.id]?.split(/\s+/).length || 0}/3 words
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4 text-red-200 text-center">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-green-400/30 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting...' : 'Submit All Answers'}
      </button>
    </div>
  );
}
