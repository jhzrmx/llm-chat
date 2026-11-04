import { Show } from 'solid-js'
import { PlusIcon, PowerIcon, SlidersIcon } from './icons'

export interface ChatHeaderProps {
  modelName: string
  ready: boolean
  hasMessages: boolean
  onNewChat: () => void
  onOpenSettings: () => void
  onUnload: () => void
}

const iconBtn =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'

export const ChatHeader = (props: ChatHeaderProps) => (
  <header class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
    <div class="flex min-w-0 items-center gap-3">
      <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        LLM Chat
      </h1>
      <Show when={props.ready}>
        <span
          class="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300"
          title={props.modelName}
        >
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span class="truncate">{props.modelName}</span>
        </span>
      </Show>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <Show when={props.ready}>
        <button
          type="button"
          class={iconBtn}
          onClick={props.onNewChat}
          disabled={!props.hasMessages}
          title="Start a new chat"
        >
          <PlusIcon class="h-4 w-4" />
          <span class="hidden sm:inline">New chat</span>
        </button>
      </Show>
      <button
        type="button"
        class={iconBtn}
        onClick={props.onOpenSettings}
        title="Settings"
      >
        <SlidersIcon class="h-4 w-4" />
        <span class="hidden sm:inline">Settings</span>
      </button>
      <Show when={props.ready}>
        <button
          type="button"
          class={`${iconBtn} hover:text-red-600! dark:hover:text-red-400!`}
          onClick={props.onUnload}
          title="Unload model and clear the chat"
        >
          <PowerIcon class="h-4 w-4" />
          <span class="hidden sm:inline">Unload</span>
        </button>
      </Show>
    </div>
  </header>
)
