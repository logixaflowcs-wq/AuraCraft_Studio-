// AuraCraft Studio — Shared API configuration
// Uses VITE_API_URL env var when deployed; falls back to localhost for development

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8010';

export const API_ENDPOINTS = {
  tts:         `${API_BASE_URL}/api/tts/synthesize`,
  voices:      `${API_BASE_URL}/api/tts/voices`,          // Fixed: was /api/voices
  health:      `${API_BASE_URL}/health`,
  characters:  `${API_BASE_URL}/api/characters`,
  renderPlan:  `${API_BASE_URL}/api/avatar-video/render-plan`, // Fixed: was /api/render-plan
  archetypes:  `${API_BASE_URL}/api/characters/archetypes`,
  telegram:    `${API_BASE_URL}/api/telegram/webhook`,
} as const;
