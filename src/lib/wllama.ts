import { Wllama, WllamaError, type LoadModelConfig } from '@wllama/wllama'
import { assertValidGgufBlobs } from './ggufValidate'
import type {
  ChatMessage,
  ChatSettings,
  GenerationStats,
  ModelInfo,
} from './types'

/** Match installed @wllama/wllama version for CDN wasm */
const WLLAMA_VERSION = '2.3.7'

const WASM_PATHS = {
  'single-thread/wllama.wasm': `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/src/single-thread/wllama.wasm`,
  'multi-thread/wllama.wasm': `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/src/multi-thread/wllama.wasm`,
} as const

let singleton: Wllama | null = null
let loadedInfo: ModelInfo | null = null

export const isGgufFileName = (name: string): boolean => {
  return /^.*\.gguf(?:\?.*)?$/i.test(name)
}

const getInstance = (): Wllama => {
  if (!singleton) {
    singleton = new Wllama(WASM_PATHS)
  }
  return singleton
}

const describeError = (e: unknown): string => {
  return e instanceof WllamaError ? `${e.type}: ${e.message}` : String(e)
}

/**
 * Load a chat/instruct GGUF from uploaded file(s). Replaces any previously loaded model.
 */
export const loadModel = async (
  files: File[],
  nCtx: number
): Promise<ModelInfo> => {
  if (!files.length) {
    throw new Error('No model file selected')
  }
  for (const f of files) {
    if (!isGgufFileName(f.name)) {
      throw new Error(`Invalid file: "${f.name}" — expected a .gguf model`)
    }
  }

  await assertValidGgufBlobs(files)

  // A fresh instance per model: a Wllama that has exited can't be reused.
  if (singleton) {
    try {
      await singleton.exit()
    } catch {
      /* ignore */
    }
    singleton = null
    loadedInfo = null
  }
  const w = getInstance()

  const config: LoadModelConfig = {
    n_ctx: nCtx,
    n_batch: 512,
  }

  try {
    await w.loadModel(files, config)
  } catch (e) {
    singleton = null
    const s = String(e)
    if (
      e instanceof RangeError ||
      s.includes('Invalid typed array') ||
      s.includes('Array buffer allocation failed')
    ) {
      throw new Error(
        'Model load failed: invalid memory request. Either the file is corrupt / not a real GGUF ' +
          '(Git LFS pointer, HTML page), or the model + context size is too large for this browser tab. ' +
          'Try a smaller context size in Settings.'
      )
    }
    throw new Error(describeError(e) || 'Failed to load model')
  }

  let displayName = files.map((f) => f.name).join(' + ')
  let hasChatTemplate = false
  try {
    const { meta } = w.getModelMetadata()
    const name = meta['general.name']
    if (name) displayName = name
    hasChatTemplate = Boolean(meta['tokenizer.chat_template'])
  } catch {
    /* use file names, assume no template */
  }

  let allocatedCtx = nCtx
  try {
    allocatedCtx = w.getLoadedContextInfo().n_ctx
  } catch {
    /* keep requested value */
  }

  loadedInfo = { displayName, nCtx: allocatedCtx, hasChatTemplate }
  return loadedInfo
}

export const isModelReady = (): boolean => {
  return singleton?.isModelLoaded() ?? false
}

/**
 * Unload the current model and reset the singleton.
 */
export const unloadModel = async (): Promise<void> => {
  if (singleton) {
    try {
      await singleton.exit()
    } catch {
      /* suppress errors during exit */
    }
    singleton = null
  }
  loadedInfo = null
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

/** Base models happily keep writing both sides of the dialogue; cut them off. */
const PLAIN_STOP_STRINGS = ['\nUser:', '\nHuman:', '\n### User', '\n<|user|>']

const SPECIAL_TOKEN_TAIL =
  /(?:<\|im_end\|>|<\|endoftext\|>|<\|eot_id\|>|<\|end\|>|<\/s>)\s*$/

const cleanOutput = (text: string): string => {
  let out = text
  // Strip dangling end-of-turn markers some small models print literally.
  while (SPECIAL_TOKEN_TAIL.test(out)) {
    out = out.replace(SPECIAL_TOKEN_TAIL, '')
  }
  return out.replace(/^\s+/, '')
}

/** Hide a half-typed stop string (e.g. "\nUs") at the end so it doesn't flicker. */
const hidePartialStop = (text: string, stops: string[]): string => {
  for (const stop of stops) {
    for (let k = stop.length - 1; k > 0; k--) {
      if (text.endsWith(stop.slice(0, k))) {
        return text.slice(0, text.length - k)
      }
    }
  }
  return text
}

const countTokens = async (w: Wllama, text: string): Promise<number> => {
  try {
    return (await w.tokenize(text, false)).length
  } catch {
    return Math.ceil(text.length / 3.5)
  }
}

/**
 * Drop the oldest messages until the conversation (plus room for the reply)
 * fits in the context window. Always keeps the newest message.
 */
const fitToContext = async (
  w: Wllama,
  history: ChatMessage[],
  systemPrompt: string,
  maxNewTokens: number,
  nCtx: number
): Promise<{ messages: ChatMessage[]; trimmed: number }> => {
  const PER_MESSAGE_OVERHEAD = 10 // role markers / template tokens
  const SAFETY_MARGIN = 48
  const reserve = Math.min(maxNewTokens, Math.floor(nCtx * 0.75))
  let budget = nCtx - reserve - SAFETY_MARGIN
  if (systemPrompt) {
    budget -= (await countTokens(w, systemPrompt)) + PER_MESSAGE_OVERHEAD
  }
  budget = Math.max(budget, 64)

  const kept: ChatMessage[] = []
  let used = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const cost =
      (await countTokens(w, history[i].content)) + PER_MESSAGE_OVERHEAD
    if (kept.length > 0 && used + cost > budget) break
    kept.unshift(history[i])
    used += cost
  }
  // Chat templates expect the conversation to start with a user turn.
  while (kept.length > 1 && kept[0].role !== 'user') kept.shift()

  return { messages: kept, trimmed: history.length - kept.length }
}

const buildPlainPrompt = (
  messages: ChatMessage[],
  systemPrompt: string
): string => {
  const lines: string[] = []
  if (systemPrompt) lines.push(systemPrompt, '')
  for (const m of messages) {
    lines.push(`${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
  }
  lines.push('Assistant:')
  return lines.join('\n')
}

export interface GenerationResult {
  text: string
  stats: GenerationStats
}

/**
 * Stream a reply for `history` (which must end with a user message).
 * `onText` receives the full reply-so-far on every token.
 * Aborting `signal` stops generation and resolves with the partial text.
 */
export const generateReply = async (
  history: ChatMessage[],
  settings: ChatSettings,
  onText: (text: string) => void,
  signal: AbortSignal
): Promise<GenerationResult> => {
  const w = singleton
  if (!w || !w.isModelLoaded()) {
    throw new Error('No model loaded. Load a GGUF model first.')
  }
  if (history.length === 0) {
    throw new Error('Nothing to reply to')
  }

  const mode =
    settings.promptMode === 'auto'
      ? loadedInfo?.hasChatTemplate
        ? 'template'
        : 'plain'
      : settings.promptMode
  const stops = mode === 'plain' ? PLAIN_STOP_STRINGS : []
  const systemPrompt = settings.systemPrompt.trim()

  const { messages, trimmed } = await fitToContext(
    w,
    history,
    systemPrompt,
    settings.maxTokens,
    loadedInfo?.nCtx ?? settings.nCtx
  )

  const sampling = {
    temp: settings.temperature,
    top_p: settings.topP,
    top_k: settings.topK,
    penalty_repeat: settings.repeatPenalty,
  }

  let text = ''
  let tokens = 0
  let hitStop = false
  const startedAt = performance.now()

  const onNewToken = (
    _token: number,
    _piece: Uint8Array,
    currentText: string,
    optionals: { abortSignal: () => unknown }
  ) => {
    tokens++
    let visible = currentText
    for (const stop of stops) {
      const at = visible.indexOf(stop)
      if (at >= 0) {
        visible = visible.slice(0, at)
        hitStop = true
      }
    }
    text = visible
    onText(cleanOutput(hidePartialStop(visible, stops)))
    if (hitStop || signal.aborted) optionals.abortSignal()
  }

  try {
    if (mode === 'template') {
      const chat: ChatMessage[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages
      await w.createChatCompletion(chat, {
        nPredict: settings.maxTokens,
        sampling,
        onNewToken,
      })
    } else {
      await w.createCompletion(buildPlainPrompt(messages, systemPrompt), {
        nPredict: settings.maxTokens,
        sampling,
        onNewToken,
      })
    }
  } catch (e) {
    // Aborting mid-stream may surface as an error; that's a normal stop.
    if (!signal.aborted && !hitStop) {
      const msg = describeError(e)
      if (/context|n_ctx|too long|batch/i.test(msg)) {
        throw new Error(
          `${msg} — the conversation is larger than the context window. ` +
            'Start a new chat or raise the context size in Settings and reload the model.'
        )
      }
      throw new Error(msg || 'Generation failed')
    }
  }

  const final = cleanOutput(text).replace(/\s+$/, '')
  onText(final)
  return {
    text: final,
    stats: {
      tokens,
      seconds: (performance.now() - startedAt) / 1000,
      trimmed,
    },
  }
}
