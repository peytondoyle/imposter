const DEVICE_ID_KEY = 'imposter_device_id';
const PLAYER_TOKEN_PREFIX = 'imposter_token_';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

export function savePlayerToken(roomCode: string, token: string): void {
  localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${roomCode}`, token);
}

export function getPlayerToken(roomCode: string): string | null {
  return localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${roomCode}`);
}

export function clearPlayerToken(roomCode: string): void {
  localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${roomCode}`);
}