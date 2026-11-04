import { createEffect, For, onCleanup, Show } from 'solid-js'
import { CONTEXT_SIZES } from '../lib/settings'
import type { ChatSettings, ModelInfo, PromptMode } from '../lib/types'
import { CloseIcon } from './icons'

export interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  settings: ChatSettings
  onChange: <K extends keyof ChatSettings>(key: K, value: ChatSettings[K]) => void
  onReset: () => void
  modelInfo: ModelInfo | null
}

const fieldLabel =
  'mb-1 flex items-baseline justify-between text-sm font-medium text-slate-700 dark:text-slate-300'
const hint = 'mt-1 text-xs text-slate-500 dark:text-slate-400'
const inputBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

const Slider = (props: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  onInput: (v: number) => void
  hint?: string
}) => (
  <div>
    <label for={props.id} class={fieldLabel}>
      <span>{props.label}</span>
      <span class="font-mono text-xs text-slate-500">{props.value}</span>
    </label>
    <input
      id={props.id}
      type="range"
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      class="w-full cursor-pointer accent-violet-600"
      onInput={(e) => props.onInput(Number(e.currentTarget.value))}
    />
    <Show when={props.hint}>
      <p class={hint}>{props.hint}</p>
    </Show>
  </div>
)

export const SettingsPanel = (props: SettingsPanelProps) => {
  let panel: HTMLElement | undefined

  createEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
    queueMicrotask(() => panel?.focus())
  })

  const promptModes: { value: PromptMode; label: string }[] = [
    { value: 'auto', label: 'Auto (use model template if it has one)' },
    { value: 'template', label: 'Model chat template' },
    { value: 'plain', label: 'Plain "User: / Assistant:" transcript' },
  ]

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-40 bg-slate-900/40"
        onClick={() => props.onClose()}
        aria-hidden="true"
      />
      <aside
        ref={panel}
        tabindex="-1"
        role="dialog"
        aria-label="Chat settings"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-xl focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Settings
          </h2>
          <button
            type="button"
            class="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            onClick={() => props.onClose()}
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        <div class="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div>
            <label for="system-prompt" class={fieldLabel}>
              System prompt
            </label>
            <textarea
              id="system-prompt"
              rows={4}
              class={`${inputBase} resize-y`}
              placeholder="Instructions that shape every reply (optional)"
              value={props.settings.systemPrompt}
              onInput={(e) =>
                props.onChange('systemPrompt', e.currentTarget.value)
              }
            />
          </div>

          <div>
            <label for="prompt-mode" class={fieldLabel}>
              Prompt format
            </label>
            <select
              id="prompt-mode"
              class={inputBase}
              value={props.settings.promptMode}
              onChange={(e) =>
                props.onChange('promptMode', e.currentTarget.value as PromptMode)
              }
            >
              <For each={promptModes}>
                {(m) => <option value={m.value}>{m.label}</option>}
              </For>
            </select>
            <p class={hint}>
              Base models without a chat template answer better with the plain
              transcript format.
            </p>
          </div>

          <Slider
            id="temperature"
            label="Temperature"
            min={0}
            max={2}
            step={0.05}
            value={props.settings.temperature}
            onInput={(v) => props.onChange('temperature', v)}
            hint="Lower is more focused, higher is more varied."
          />
          <Slider
            id="top-p"
            label="Top-p"
            min={0.1}
            max={1}
            step={0.05}
            value={props.settings.topP}
            onInput={(v) => props.onChange('topP', v)}
          />
          <Slider
            id="top-k"
            label="Top-k"
            min={1}
            max={100}
            step={1}
            value={props.settings.topK}
            onInput={(v) => props.onChange('topK', v)}
          />
          <Slider
            id="repeat-penalty"
            label="Repeat penalty"
            min={1}
            max={1.5}
            step={0.01}
            value={props.settings.repeatPenalty}
            onInput={(v) => props.onChange('repeatPenalty', v)}
            hint="Raise this if the model loops or repeats itself."
          />
          <Slider
            id="max-tokens"
            label="Max reply length (tokens)"
            min={32}
            max={1024}
            step={32}
            value={props.settings.maxTokens}
            onInput={(v) => props.onChange('maxTokens', v)}
          />

          <div>
            <label for="n-ctx" class={fieldLabel}>
              Context size (tokens)
            </label>
            <select
              id="n-ctx"
              class={inputBase}
              value={props.settings.nCtx}
              onChange={(e) =>
                props.onChange('nCtx', Number(e.currentTarget.value))
              }
            >
              <For each={CONTEXT_SIZES}>
                {(n) => <option value={n}>{n}</option>}
              </For>
            </select>
            <p class={hint}>
              Applies the next time you load a model. Larger values use more
              memory.
            </p>
          </div>

          <Show when={props.modelInfo}>
            {(info) => (
              <dl class="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                <div class="flex justify-between gap-3">
                  <dt>Loaded context window</dt>
                  <dd class="font-mono">{info().nCtx}</dd>
                </div>
                <div class="mt-1 flex justify-between gap-3">
                  <dt>Chat template in model</dt>
                  <dd class="font-mono">
                    {info().hasChatTemplate ? 'yes' : 'no'}
                  </dd>
                </div>
              </dl>
            )}
          </Show>
        </div>

        <div class="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => props.onReset()}
          >
            Reset to defaults
          </button>
        </div>
      </aside>
    </Show>
  )
}
