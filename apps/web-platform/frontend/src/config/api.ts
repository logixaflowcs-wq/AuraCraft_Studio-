// Shared API configuration. Set VITE_API_URL to the deployed FastAPI origin.
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  (import.meta.env.DEV ? 'http://localhost:8010' : 'https://auracraft-backend.onrender.com');

export const API_ENDPOINTS = {
  tts: API_BASE_URL + '/api/tts/synthesize',
  voices: API_BASE_URL + '/api/tts/voices',
  health: API_BASE_URL + '/health',
  characters: API_BASE_URL + '/api/characters',
  renderPlan: API_BASE_URL + '/api/avatar-video/render-plan',
} as const;
