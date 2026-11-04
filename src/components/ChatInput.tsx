import { createEffect, createSignal } from 'solid-js'
import { ArrowUpIcon, StopIcon } from './icons'

export interface ChatInputProps {
  generating: boolean
  disabled: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export const ChatInput = (props: ChatInputProps) => {
  let textarea!: HTMLTextAreaElement
  const [value, setValue] = createSignal('')

  const resize = () => {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  const submit = () => {
    const text = value().trim()
    if (!text || props.generating || props.disabled) return
    props.onSend(text)
    setValue('')
    queueMicrotask(resize)
  }

  // Hand focus back once a reply finishes so the next message can be typed right away.
  // Skipped on touch devices, where it would pop the on-screen keyboard open.
  createEffect(() => {
    if (props.generating || props.disabled) return
    if (window.matchMedia('(pointer: fine)').matches) textarea?.focus()
  })

  const canSend = () => value().trim().length > 0 && !props.disabled

  return (
    <div class="border-t border-slate-200 bg-slate-50/90 px-4 pb-4 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div class="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-slate-600 dark:bg-slate-800">
        <textarea
          ref={textarea}
          rows={1}
          class="max-h-50 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-slate-100"
          placeholder={
            props.disabled
              ? 'Load a model to start chatting'
              : 'Message the model…  (Enter to send, Shift+Enter for a new line)'
          }
          aria-label="Message"
          value={value()}
          disabled={props.disabled}
          onInput={(e) => {
            setValue(e.currentTarget.value)
            resize()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        {props.generating ? (
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-slate-800 text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
            onClick={() => props.onStop()}
            title="Stop generating"
            aria-label="Stop generating"
          >
            <StopIcon class="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            class="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canSend()}
            onClick={submit}
            title="Send message"
            aria-label="Send message"
          >
            <ArrowUpIcon class="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
