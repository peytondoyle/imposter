import { useState } from 'react';

interface GameSettingsProps {
  isHost: boolean;
  currentSettings: {
    promptCount: number;
    winTarget: number;
    maxRounds: number;
    selectedTheme: string;
    familySafeOnly: boolean;
  };
  onSettingsChange: (settings: GameSettings) => void;
  onClose: () => void;
  themePacks: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
}

export interface GameSettings {
  promptCount: number;
  winTarget: number;
  maxRounds: number;
  selectedTheme: string;
  familySafeOnly: boolean;
}

export function GameSettings({
  isHost,
  currentSettings,
  onSettingsChange,
  onClose,
  themePacks
}: GameSettingsProps) {
  const [settings, setSettings] = useState<GameSettings>(currentSettings);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSettingChange = (key: keyof GameSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSettingsChange(settings);
    setHasChanges(false);
  };

  const handleReset = () => {
    setSettings(currentSettings);
    setHasChanges(false);
  };

  if (!isHost) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-4">Host Only</h2>
          <p className="text-white/80 mb-6">Only the host can change game settings.</p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚙️</span>
            <h1 className="text-3xl font-bold text-white">Game Settings</h1>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Settings Form */}
        <div className="space-y-6">
          {/* Prompt Count */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">📝 Prompts per Round</h3>
            <p className="text-white/70 text-sm mb-4">
              Choose how many prompts each player answers per round
            </p>
            <div className="flex gap-3">
              {[3, 4, 5].map((count) => (
                <button
                  key={count}
                  onClick={() => handleSettingChange('promptCount', count)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    settings.promptCount === count
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {count} prompts
                </button>
              ))}
            </div>
          </div>

          {/* Win Target */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">🏆 Win Target</h3>
            <p className="text-white/70 text-sm mb-4">
              Points needed to win the game
            </p>
            <div className="flex gap-3">
              {[3, 5, 7, 10].map((target) => (
                <button
                  key={target}
                  onClick={() => handleSettingChange('winTarget', target)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    settings.winTarget === target
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {target} points
                </button>
              ))}
            </div>
          </div>

          {/* Max Rounds */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">🔄 Maximum Rounds</h3>
            <p className="text-white/70 text-sm mb-4">
              Maximum number of rounds before game ends
            </p>
            <div className="flex gap-3">
              {[5, 10, 15, 20].map((rounds) => (
                <button
                  key={rounds}
                  onClick={() => handleSettingChange('maxRounds', rounds)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    settings.maxRounds === rounds
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {rounds} rounds
                </button>
              ))}
            </div>
          </div>

          {/* Theme Selection */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">🎨 Theme Pack</h3>
            <p className="text-white/70 text-sm mb-4">
              Choose the category of prompts for this game
            </p>
            <div className="grid grid-cols-2 gap-3">
              {themePacks.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleSettingChange('selectedTheme', theme.id)}
                  className={`p-4 rounded-lg text-left transition-all ${
                    settings.selectedTheme === theme.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{theme.icon}</span>
                    <div>
                      <div className="font-semibold">{theme.name}</div>
                      <div className="text-xs opacity-70">{theme.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Family Safe Mode */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">👨‍👩‍👧‍👦 Family Safe Mode</h3>
            <p className="text-white/70 text-sm mb-4">
              Only show family-friendly prompts
            </p>
            <button
              onClick={() => handleSettingChange('familySafeOnly', !settings.familySafeOnly)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                settings.familySafeOnly
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {settings.familySafeOnly ? '✅ Enabled' : '❌ Disabled'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex-1 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>

        {hasChanges && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-400/30 rounded-xl">
            <p className="text-yellow-200 text-sm text-center">
              You have unsaved changes. Click "Save Changes" to apply them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
