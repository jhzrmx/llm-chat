# LLM Chat (SolidJS + Wllama)

Client-only chat app: load a local **GGUF language model** and chat with it in your browser via [Wllama](https://github.com/ngxson/wllama) (llama.cpp compiled to WebAssembly). No server, no API keys — the model and your messages stay on your device.

Live preview: <https://jhzrmx.github.io/llm-chat/>

## Features

- Load any `.gguf` chat/instruct model (file picker, drag & drop, or multi-part shards)
- Streaming replies with **Stop**, **Regenerate**, and **Copy**
- Tokens/sec readout for each reply
- Automatic context-window management (oldest messages are dropped when the chat outgrows the context)
- Settings drawer: system prompt, temperature, top-p, top-k, repeat penalty, max reply length, context size, prompt format — persisted in `localStorage`
- Uses the model's own **chat template** when the GGUF includes one, with a plain `User:` / `Assistant:` fallback for base models
- Installable PWA, light/dark mode

## Setup

```bash
npm install
npm run dev
```

Open the URL shown (e.g. `http://localhost:5173/llm-chat/`).

> The sample model is a ~90M-parameter model, so replies are fast but simple. For better answers load a larger instruct model, such as a small Qwen, Llama, SmolLM or Gemma GGUF (Q4 quantisations of ~0.5–1.5B parameters run well in a browser tab).

## Build

```bash
npm run build
npm run preview
```

### PWA

Production build emits a **service worker** + **web manifest** (installable app). Precache covers the app shell; **Wllama `.wasm`** files are cached at runtime from jsDelivr, and the sample `.gguf` is cached on first load. Models you pick from disk are not cached (they already live on your disk).

`npm install` uses `legacy-peer-deps` (`.npmrc`) so `vite-plugin-pwa` works with **Vite 8** until peer ranges catch up.

## Deploying

The dev server sets **COOP** / **COEP** headers so Wllama can use multi-thread WASM. For production, configure the same headers on your host:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

WASM is loaded from jsDelivr (`@wllama/wllama`); the model stays local in the browser.

The base path is set by `repositoryTarget` in `vite.config.ts` (currently `llm-chat/`). **Change it if your repository has a different name**, otherwise assets will 404 on GitHub Pages.

## Project layout

```
src/
  App.tsx                 state: model status, messages, settings, generation control
  components/
    ModelLoader.tsx       first-run screen (file picker / sample model)
    ChatHeader.tsx        model badge, New chat, Settings, Unload
    ChatMessages.tsx      message list, streaming caret, copy / regenerate
    ChatInput.tsx         auto-growing textarea, send / stop
    SettingsPanel.tsx     sampling + prompt settings drawer
  lib/
    wllama.ts             load model, streaming generation, context fitting
    settings.ts           defaults + localStorage persistence
    sampleModel.ts        fetch the bundled sample GGUF
    ggufValidate.ts       reject LFS pointers / HTML / non-GGUF files early
    types.ts              shared types
```

## Scripts

| Script              | Description                     |
| ------------------- | ------------------------------- |
| `npm run dev`       | Vite dev server                 |
| `npm run build`     | Production bundle               |
| `npm run preview`   | Preview production build        |
| `npm run typecheck` | `tsc` (may hit upstream quirks) |

## Stack

SolidJS · Vite · **Tailwind CSS v4** (`@tailwindcss/vite` — no `tailwind.config` / PostCSS) · `@wllama/wllama`

`package.json` includes an npm **override** so `@tailwindcss/vite` accepts Vite 8.
