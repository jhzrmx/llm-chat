import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { ChatHeader } from './components/ChatHeader'
import { ChatInput } from './components/ChatInput'
import { ChatMessages } from './components/ChatMessages'
import { ModelLoader, type ModelStatus } from './components/ModelLoader'
import { SettingsPanel } from './components/SettingsPanel'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from './lib/settings'
import { fetchSampleModelFile } from './lib/sampleModel'
import type {
  ChatMessage,
  ChatSettings,
  ModelInfo,
  UiMessage,
} from './lib/types'
import { generateReply, loadModel, unloadModel } from './lib/wllama'

const App = () => {
  const [modelStatus, setModelStatus] = createSignal<ModelStatus>('idle')
  const [modelInfo, setModelInfo] = createSignal<ModelInfo | null>(null)
  const [modelError, setModelError] = createSignal('')
  const [loadProgress, setLoadProgress] = createSignal<string | null>(null)

  const [settings, setSettings] = createStore<ChatSettings>(loadSettings())
  const [settingsOpen, setSettingsOpen] = createSignal(false)

  const [messages, setMessages] = createStore<UiMessage[]>([])
  const [generating, setGenerating] = createSignal(false)
  let abortController: AbortController | null = null

  // Persist settings whenever any of them changes.
  createEffect(() => saveSettings({ ...settings }))

  onCleanup(() => abortController?.abort())

  const modelReady = () => modelStatus() === 'ready'

  // Root-level array assignment on a Solid store merges by index and never
  // shrinks it, so removals go through `produce`.
  const clearMessages = () =>
    setMessages(
      produce((draft) => {
        draft.splice(0, draft.length)
      })
    )
  const dropLastMessage = () =>
    setMessages(
      produce((draft) => {
        draft.pop()
      })
    )

  const changeSetting = <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ) => {
    setSettings(key, value)
  }

  const resetSettings = () => setSettings({ ...DEFAULT_SETTINGS })

  /* ---------------------------- model loading --------------------------- */

  const beginLoad = () => {
    setModelError('')
    setModelStatus('loading')
    setModelInfo(null)
    setLoadProgress(null)
  }

  const finishLoad = (info: ModelInfo) => {
    setModelInfo(info)
    setModelStatus('ready')
    clearMessages()
  }

  const failLoad = (e: unknown) => {
    setModelStatus('error')
    setModelError(e instanceof Error ? e.message : String(e))
  }

  const handleFiles = async (files: File[]) => {
    beginLoad()
    setLoadProgress('Loading model…')
    try {
      finishLoad(await loadModel(files, settings.nCtx))
    } catch (e) {
      failLoad(e)
    } finally {
      setLoadProgress(null)
    }
  }

  const handleLoadSample = async () => {
    beginLoad()
    try {
      const file = await fetchSampleModelFile((loaded, total) => {
        setLoadProgress(
          total != null && total > 0
            ? `Downloading sample… ${Math.min(100, Math.round((100 * loaded) / total))}%`
            : `Downloading sample… ${(loaded / (1024 * 1024)).toFixed(1)} MB`
        )
      })
      setLoadProgress('Loading model…')
      finishLoad(await loadModel([file], settings.nCtx))
    } catch (e) {
      failLoad(e)
    } finally {
      setLoadProgress(null)
    }
  }

  const handleUnload = async () => {
    abortController?.abort()
    await unloadModel()
    setModelStatus('idle')
    setModelInfo(null)
    setModelError('')
    clearMessages()
  }

  /* ------------------------------- chatting ------------------------------ */

  const patchMessage = (id: string, patch: Partial<UiMessage>) => {
    const idx = messages.findIndex((m) => m.id === id)
    if (idx >= 0) setMessages(idx, patch)
  }

  /** Generate an assistant reply to the conversation as it currently stands. */
  const runGeneration = async () => {
    // Failed or empty replies are shown in the UI but never fed back to the model.
    const history: ChatMessage[] = messages
      .filter(
        (m) =>
          m.role === 'user' ||
          (m.status !== 'error' && m.content.trim().length > 0)
      )
      .map((m) => ({ role: m.role, content: m.content }))

    const id = crypto.randomUUID()
    setMessages(messages.length, {
      id,
      role: 'assistant',
      content: '',
      status: 'streaming',
    })

    const controller = new AbortController()
    abortController = controller
    setGenerating(true)

    try {
      const result = await generateReply(
        history,
        { ...settings },
        (text) => patchMessage(id, { content: text }),
        controller.signal
      )
      patchMessage(id, {
        content: result.text,
        status: controller.signal.aborted ? 'stopped' : 'done',
        stats: result.stats,
      })
    } catch (e) {
      patchMessage(id, {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      if (abortController === controller) abortController = null
      setGenerating(false)
    }
  }

  const handleSend = (text: string) => {
    const content = text.trim()
    if (!content || generating() || !modelReady()) return
    setMessages(messages.length, {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      status: 'done',
    })
    void runGeneration()
  }

  const handleRegenerate = () => {
    if (generating() || !modelReady()) return
    const last = messages[messages.length - 1]
    if (last?.role !== 'assistant') return
    dropLastMessage()
    void runGeneration()
  }

  const handleStop = () => abortController?.abort()

  const handleNewChat = () => {
    abortController?.abort()
    clearMessages()
  }

  return (
    <div class="flex h-dvh flex-col bg-slate-50 dark:bg-slate-950">
      <ChatHeader
        modelName={modelInfo()?.displayName ?? ''}
        ready={modelReady()}
        hasMessages={messages.length > 0}
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onUnload={handleUnload}
      />

      <Show
        when={modelReady()}
        fallback={
          <main class="flex-1 overflow-y-auto px-4 py-10">
            <div class="mx-auto max-w-2xl">
              <ModelLoader
                status={modelStatus}
                error={modelError}
                onFilesSelected={handleFiles}
                onLoadSample={handleLoadSample}
                progress={loadProgress}
              />
            </div>
          </main>
        }
      >
        <ChatMessages
          messages={messages}
          generating={generating()}
          onRegenerate={handleRegenerate}
          onSuggestion={handleSend}
        />
        <ChatInput
          generating={generating()}
          disabled={!modelReady()}
          onSend={handleSend}
          onStop={handleStop}
        />
      </Show>

      <SettingsPanel
        open={settingsOpen()}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={changeSetting}
        onReset={resetSettings}
        modelInfo={modelInfo()}
      />
    </div>
  )
}

export default App
