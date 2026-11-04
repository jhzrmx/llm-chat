import { createSignal, Show, type Accessor } from 'solid-js'
import { SAMPLE_MODEL_LABEL, SAMPLE_MODEL_SIZE_HINT } from '../lib/sampleModel'

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ModelLoaderProps {
  status: Accessor<ModelStatus>
  error: Accessor<string>
  onFilesSelected: (files: File[]) => void
  /** Fetch bundled sample GGUF from /assets/models/ */
  onLoadSample?: () => void
  /** Progress / phase text while loading (download %, "Loading model…") */
  progress?: Accessor<string | null>
}

const ggufFilesFromList = (files: FileList | File[]): File[] => {
  return Array.from(files).filter((f) =>
    f.name.toLowerCase().endsWith('.gguf')
  )
}

export const ModelLoader = (props: ModelLoaderProps) => {
  const [dragOver, setDragOver] = createSignal(false)
  const loading = () => props.status() === 'loading'

  const dropZoneClass = () => {
    const base =
      'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 transition focus-within:ring-2 focus-within:ring-violet-500/40'
    const idle =
      'border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-violet-500 dark:hover:bg-violet-950/20'
    const active =
      'border-violet-500 bg-violet-100/80 ring-2 ring-violet-400/50 dark:border-violet-400 dark:bg-violet-950/40 dark:ring-violet-500/30'
    const disabled = 'pointer-events-none opacity-50'
    if (loading()) return `${base} ${idle} ${disabled}`
    if (dragOver()) return `${base} ${active}`
    return `${base} ${idle}`
  }

  function onDragEnter(e: DragEvent) {
    if (loading()) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function onDragLeave(e: DragEvent) {
    if (loading()) return
    const current = e.currentTarget as Node
    const related = e.relatedTarget as Node | null
    if (!related || !current.contains(related)) {
      setDragOver(false)
    }
  }

  function onDragOver(e: DragEvent) {
    if (loading()) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer!.dropEffect = 'copy'
  }

  function onDrop(e: DragEvent) {
    if (loading()) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = ggufFilesFromList(e.dataTransfer!.files)
    if (files.length > 0) {
      props.onFilesSelected(files)
    }
  }

  return (
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Load a model to start chatting
      </h2>
      <p class="mb-4 mt-1 text-sm text-slate-600 dark:text-slate-400">
        Pick a local <strong>.gguf</strong> language model (chat or instruct
        models work best). Split shards: select or drop all parts together.
      </p>
      <label
        class={dropZoneClass()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".gguf"
          multiple
          class="sr-only"
          disabled={loading()}
          onChange={(e) => {
            const list = e.currentTarget.files
            if (!list?.length) return
            props.onFilesSelected(Array.from(list))
            e.currentTarget.value = ''
          }}
        />
        <span class="text-2xl" aria-hidden="true">
          📁
        </span>
        <span class="mt-2 text-center font-medium text-violet-600 dark:text-violet-400">
          {dragOver()
            ? 'Drop .gguf file(s) here'
            : 'Choose .gguf file(s) or drag & drop'}
        </span>
        <span class="mt-1 text-xs text-slate-500">
          The model and your messages never leave your browser
        </span>
      </label>

      <Show when={props.onLoadSample}>
        <div class="mt-4 flex flex-col items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
          <p class="text-center text-xs text-slate-500 dark:text-slate-400">
            Or try the bundled sample (a very small model, so expect simple
            answers)
          </p>
          <button
            type="button"
            class="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
            disabled={loading()}
            onClick={() => props.onLoadSample?.()}
          >
            Load sample model ({SAMPLE_MODEL_LABEL}) [{SAMPLE_MODEL_SIZE_HINT}]
          </button>
        </div>
      </Show>

      <Show when={loading()}>
        <div
          class="mt-4 flex items-center justify-center gap-2 text-sm text-amber-700 dark:text-amber-300"
          role="status"
        >
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          {props.progress?.() ?? 'Loading model…'}
        </div>
        <p class="mt-2 text-center text-xs text-slate-500">
          First load downloads the WASM runtime from a CDN; large models may
          take a while.
        </p>
      </Show>

      <Show when={props.error() && props.status() === 'error'}>
        <p
          class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {props.error()}
        </p>
      </Show>
    </section>
  )
}
