export type ChatRole = 'system' | 'user' | 'assistant'

/** Message shape handed to the model. */
export interface ChatMessage {
  role: ChatRole
  content: string
}

/**
 * How the conversation is turned into a prompt.
 * - auto:     use the model's own chat template if the GGUF ships one, else plain
 * - template: always use the GGUF chat template (falls back to ChatML in llama.cpp)
 * - plain:    "User: … / Assistant: …" transcript, good for base models with no template
 */
export type PromptMode = 'auto' | 'template' | 'plain'

export interface ChatSettings {
  systemPrompt: string
  temperature: number
  topP: number
  topK: number
  repeatPenalty: number
  /** Max new tokens per reply */
  maxTokens: number
  /** Context window requested at model-load time */
  nCtx: number
  promptMode: PromptMode
}

export interface ModelInfo {
  displayName: string
  /** Context window actually allocated by the runtime */
  nCtx: number
  hasChatTemplate: boolean
}

export interface GenerationStats {
  tokens: number
  seconds: number
  /** How many older messages were dropped to fit the context window */
  trimmed: number
}

/** Message as rendered in the UI. */
export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'streaming' | 'done' | 'stopped' | 'error'
  stats?: GenerationStats
  error?: string
}
