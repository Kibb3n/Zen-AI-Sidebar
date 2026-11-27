# Dia Sidebar

A Dia-style AI chat sidebar for the Zen browser, installed as a Sine mod. Press **⌘E** (Ctrl+E on Windows/Linux) on any web page and chat about it, with the page sitting right next to the chat.

It works with Apple Intelligence (runs on your Mac, no API key), Gemini, Claude, OpenAI, DeepSeek, Ollama, or any OpenAI-compatible model.

## What it does

- **Chats about the page you're on.** Summaries, questions, explanations, fact-checks. YouTube videos are summarised automatically, with clickable timestamps.
- **Add more context.** Other tabs, tab groups, links on the page, selected text, screenshots, and dropped files (PDF, Word, Excel, PowerPoint, text, images).
- **Web search only when you ask.** Turn on the globe button and it searches the web, reads the best pages and answers with numbered sources. With the globe off it never goes online.
- **Follows links.** Say "open the second source" or paste a link that's on the page.
- **Shows its work.** A small activity line shows what it's doing (reading, searching, thinking), and you can expand it to see every page it opened.
- **Checks itself.** On Apple Intelligence it checks figures, dates and quotes against the page and sources, and flags anything it can't find.
- **Skills and mentions.** Saved prompts with `/`, and `@` to mention tabs or shape the answer (`@list`, `@steps`, `@table`).
- **Looks native.** It sits on the opposite side from your tab sidebar, matches your Zen space colours, and keeps history on your computer (optional).

## Install

1. Put the files at the root of a public GitHub repo and set `homepage` in `theme.json` to its URL.
2. In Zen: Settings → Sine → turn on **Enable installing JS from unofficial sources**. (Without this, Sine skips the script and nothing appears.)
3. Install the mod from the repo URL in Sine, make sure it's enabled, and restart Zen.
4. Disable the old *Page Summary* mod if you have it. Both use ⌘E.

The script must be named `dia-sidebar.uc.js`. On first open, a short guide helps you pick a model.

## Using Apple Intelligence with AFM Server

Apple Intelligence runs on your Mac through **AFM Server**, a small menu bar app that lets other apps talk to Apple's on-device model. The mod is already set up for its default address, so you mostly just install it and leave it running.

**You need:** a Mac with Apple Silicon, macOS 26 (Tahoe) or later, and Apple Intelligence turned on and finished downloading (System Settings → Apple Intelligence & Siri).

**Set up**

1. Download the latest `afm-server` zip from the project's Releases page (github.com/Techopolis/afm-server/releases), unzip it, move `afm-server.app` to Applications and open it.
2. A lightning bolt appears in the menu bar. Green means the server is running. It starts by itself on port 11435.
3. In Zen, open the sidebar on a web page and pick **Apple Intelligence** from the model menu. Nothing else to configure.

**Keep it working**

- **Leave AFM Server running.** If it's closed, the sidebar says it couldn't reach Apple Intelligence. To start it automatically, add it in System Settings → General → Login Items & Extensions.
- **Quick test:** in Terminal, `curl http://127.0.0.1:11435/debug/health` should answer with `"status": "ok"`.
- **Changed the port?** Set the same port in the mod: Settings → Advanced (tick *Show advanced options*) → **AFM Server address**, for example `http://127.0.0.1:12000/v1`.
- **AFM Server asks for an API key?** Paste it into **AFM Server API key** in the same place. If it doesn't, leave that blank.
- **Leave AFM Server's own System Prompt setting empty or at its default** (⌘, in the app). The mod sends its own instructions with every message, and a second set may compete with them. If answers feel off, check it.

**Getting the best answers**

- Apple's on-device model has a small memory (about 4,096 tokens), so the mod works in several steps instead of one big one. That's what the **Effort** slider (model menu) controls. **Low** is quick. **Medium** is one careful pass. **High** reads long pages in parts, drafts an answer, then fact-checks it. **Max** checks twice. Higher effort is slower but more accurate, and it doesn't make answers longer.
- Press the **globe** for anything about the outside world or recent events. The model's own knowledge is limited, and it never searches the web unless the globe is on.
- It reads text only. It can't look at images, and a PDF has to have real text in it.
- Apple's safety rules can refuse some questions. Rephrase and try again.
- AFM Server handles about three requests at a time by default and queues the rest, so many chats at once will feel slower.

**If something's wrong**

| Problem | Likely fix |
|---|---|
| "Couldn't reach Apple Intelligence" | Open AFM Server and check the bolt is green, and that the port matches the mod's address. |
| Empty or generic replies | Apple Intelligence isn't on, or is still downloading. Check System Settings. |
| Port already in use | Change the port in AFM Server's menu bar controls, then update the address in the mod. |

## Other models

Click the model name at the top left of the sidebar, then **Add or manage models…**. Gemini, Claude, OpenAI and DeepSeek need an API key. Ollama and other local servers need only their address. Keys are stored as plain text in `dia-sidebar-models.json` in your Firefox profile, never in this repo.

## Settings

Sine → this mod → settings. Automatic summaries, Enter-to-send, search provider (DuckDuckGo, Google, Brave or SearXNG), what to attach, colours and text size, saving history, and the AFM Server address and key under Advanced. Model and effort are in the sidebar's model menu.

## If nothing appears

1. It only opens on a real web page. On a new tab the URL bar icon is dimmed on purpose.
2. No chat icon when you hover the URL bar means the script isn't running. Recheck the Sine steps above.
3. Open the Browser Console (⌘⇧J) and search for `dia-sidebar`. You should see `loaded`. `Failed to load script` means the script has the wrong filename.

## Not included

Connected apps (Gmail, Calendar, Slack), voice dictation, HEIC images and memory. Old `.doc`, `.xls` and `.ppt` files aren't read, only the modern formats. Pages that need you signed in can't be opened from a link, so open them in a tab and add the tab.

## Files

`dia-sidebar.uc.js` (everything), `theme.json`, `preferences.json`, `chrome.css`. The chat icon is Ionicons' "chatbubble-ellipses" (MIT).
