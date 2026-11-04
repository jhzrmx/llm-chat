import type { ChatSettings } from './types'

export const DEFAULT_SETTINGS: ChatSettings = {
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.8,
  topP: 0.95,
  topK: 40,
  repeatPenalty: 1,
  maxTokens: 256,
  nCtx: 2048,
  promptMode: 'auto',
}

export const CONTEXT_SIZES = [512, 1024, 2048, 4096, 8192] as const

const STORAGE_KEY = 'llm-chat:settings:v1'

export const loadSettings = (): ChatSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<ChatSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const saveSettings = (settings: ChatSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable (private mode, quota) — settings just won't persist */
  }
}
