import { createEffect, createSignal, For, on, Show } from 'solid-js'
import type { UiMessage } from '../lib/types'
import { CheckIcon, CopyIcon, RefreshIcon } from './icons'

export interface ChatMessagesProps {
  messages: UiMessage[]
  generating: boolean
  onRegenerate: () => void
  onSuggestion: (text: string) => void
}

const SUGGESTIONS = [
  'Say hello and tell me what you can do.',
  'Explain what a web browser does in two sentences.',
  'Give me three ideas for a weekend project.',
]

const formatStats = (m: UiMessage): string => {
  const s = m.stats
  if (!s) return ''
  const parts = [`${s.tokens} tokens`]
  if (s.seconds > 0 && s.tokens > 1) {
    parts.push(`${(s.tokens / s.seconds).toFixed(1)} tok/s`)
  }
  return parts.join(' · ')
}

const AssistantActions = (props: {
  message: UiMessage
  isLast: boolean
  generating: boolean
  onRegenerate: () => void
}) => {
  const [copied, setCopied] = createSignal(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — nothing useful to do */
    }
  }

  const btn =
    'inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100'

  return (
    <div class="mt-1 flex flex-wrap items-center gap-1">
      <Show when={props.message.content}>
        <button type="button" class={btn} onClick={copy} title="Copy reply">
          <Show when={copied()} fallback={<CopyIcon class="h-3.5 w-3.5" />}>
            <CheckIcon class="h-3.5 w-3.5" />
          </Show>
          {copied() ? 'Copied' : 'Copy'}
        </button>
      </Show>
      <Show when={props.isLast && !props.generating}>
        <button
          type="button"
          class={btn}
          onClick={() => props.onRegenerate()}
          title="Generate a new reply"
        >
          <RefreshIcon class="h-3.5 w-3.5" />
          Regenerate
        </button>
      </Show>
      <Show when={formatStats(props.message)}>
        <span class="ml-1 text-xs text-slate-400 dark:text-slate-500">
          {formatStats(props.message)}
        </span>
      </Show>
      <Show when={props.message.status === 'stopped'}>
        <span class="text-xs text-slate-400 dark:text-slate-500">Stopped</span>
      </Show>
      <Show when={(props.message.stats?.trimmed ?? 0) > 0}>
        <span
          class="text-xs text-amber-600 dark:text-amber-400"
          title="The context window was full, so the oldest messages weren't sent to the model."
        >
          {props.message.stats!.trimmed} older message
          {props.message.stats!.trimmed === 1 ? '' : 's'} left out
        </span>
      </Show>
    </div>
  )
}

const TypingDots = () => (
  <span class="inline-flex items-center gap-1 py-1" aria-label="Thinking">
    <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
    <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
    <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
  </span>
)

export const ChatMessages = (props: ChatMessagesProps) => {
  let scroller!: HTMLDivElement
  let stickToBottom = true

  const onScroll = () => {
    const distance =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    stickToBottom = distance < 80
  }

  const scrollToBottom = () => {
    scroller.scrollTo({ top: scroller.scrollHeight })
  }

  // Follow the stream, unless the person has scrolled up to read.
  createEffect(
    on(
      () => {
        const last = props.messages[props.messages.length - 1]
        return [props.messages.length, last?.content.length ?? 0] as const
      },
      ([len], prev) => {
        // A brand-new message (the person just sent one) always snaps to the bottom.
        if (prev && len > prev[0]) stickToBottom = true
        if (stickToBottom) queueMicrotask(scrollToBottom)
      }
    )
  )

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      class="flex-1 overflow-y-auto px-4 py-6"
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      <div class="mx-auto flex max-w-3xl flex-col gap-5">
        <Show when={props.messages.length === 0}>
          <div class="flex flex-col items-center gap-4 py-16 text-center">
            <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">
              Model ready. Ask anything.
            </h2>
            <p class="max-w-md text-sm text-slate-600 dark:text-slate-400">
              Replies are generated on this device. Small models are fast but
              limited, so keep prompts short and specific.
            </p>
            <div class="mt-2 flex flex-wrap justify-center gap-2">
              <For each={SUGGESTIONS}>
                {(s) => (
                  <button
                    type="button"
                    class="cursor-pointer rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
                    onClick={() => props.onSuggestion(s)}
                  >
                    {s}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <For each={props.messages}>
          {(m, i) => (
            <Show
              when={m.role === 'assistant'}
              fallback={
                <div class="flex justify-end">
                  <p class="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm">
                    {m.content}
                  </p>
                </div>
              }
            >
              <div class="flex">
                <div class="max-w-[92%] min-w-0">
                  <Show
                    when={m.status !== 'error'}
                    fallback={
                      <p
                        class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
                        role="alert"
                      >
                        {m.error || 'Something went wrong.'}
                      </p>
                    }
                  >
                    <div class="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-[15px] leading-relaxed text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                      <Show
                        when={m.content}
                        fallback={<Show when={m.status === 'streaming'}><TypingDots /></Show>}
                      >
                        {m.content}
                        <Show when={m.status === 'streaming'}>
                          <span class="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-violet-500" />
                        </Show>
                      </Show>
                      <Show when={!m.content && m.status !== 'streaming'}>
                        <span class="text-slate-400 italic">(empty reply)</span>
                      </Show>
                    </div>
                  </Show>
                  <Show when={m.status !== 'streaming'}>
                    <AssistantActions
                      message={m}
                      isLast={i() === props.messages.length - 1}
                      generating={props.generating}
                      onRegenerate={props.onRegenerate}
                    />
                  </Show>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  )
}
