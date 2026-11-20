# Dia Sidebar (Sine mod for Zen)

A Dia-style AI chat sidebar for Zen, loaded as a userChrome.js mod via Sine. It docks on the right and
**resizes the page** (it doesn't float over it). Click the **chat icon in the URL bar** (next to the
bookmark star), or press **⌘E** (macOS) / **Ctrl+E** (Windows/Linux), to show or hide it. The icon lights up
while the sidebar is open. Each tab keeps its own chat while the sidebar is hidden.

> Forked from *Page Summary*. Both mods use ⌘E, so disable Page Summary before enabling this one.

## Context: drag things in

Drop onto the sidebar (a "Drop to add as context" overlay appears):

- **Tabs**: drag a tab from Zen's tab list (or the tab strip). Its readable text becomes a pill. Drop
  several at once, or a whole **tab group / folder**. PDFs open in a tab are read as PDFs.
- **Files**: images (PNG, JPEG, GIF, WebP), **PDFs**, **Word / Excel / PowerPoint** (.docx .xlsx .pptx),
  and text or code files. Paste images straight into the box too.
- **Selected text**: select text on the page and it appears as a pill, or right-click → *Ask Chat about selection*.

The current page is attached automatically (click its ✕ to chat without it). Up to 12 pills at a time.
Anthropic and Gemini read PDFs and images natively; Apple Intelligence is text-only, so images are ignored there.

## Chat

- **/ Skills**: saved prompts. Built in: Summarize, Key takeaways, Explain simply, Action items, Flashcards,
  Fact-check, Proofread, Translate. Make your own (＋ New skill; *Write it for me* drafts one from a sentence).
  Type a skill's name and press Return to run it.
- **@ mentions**: open tabs, tab groups, **@list / @table / @code / @email / @tldr / @steps** to shape the
  answer, **@Web** (search the web) and **@Tabs** (ask to close, group or open tabs; you review the
  proposal and press Apply, nothing happens automatically).
- **Stop & Resume**, **Regenerate**, **Copy**, **Edit** your messages or the model's answers. Type while an
  answer is streaming and your message is queued (*Edit* it, or *Send now* to interrupt).
- **Web search**: the model can search the web and cite what it found (see below).
- **Thinking** is shown and collapsed when the model streams it (Anthropic and Gemini: enable in settings).
- **History**: past chats with search, restore and delete (clock icon). Stored in your profile folder as
  `dia-sidebar-chats.json` (it includes the page text each chat was about). Turn it off in settings.
- **YouTube**: reads the transcript (works regardless of interface language) and summarizes automatically on
  videos. *Key moments* come with clickable **[mm:ss]** timestamps that seek the player.
- Markdown with tables, code blocks (Copy buttons), nested lists and favicon links.
- Drag the sidebar's left edge to resize; double-click the edge to reset.
- Opened over a **split view**, the whole split becomes one chat and every pane is attached.

## Web search

Click the **globe** button (or type **@Web**) to search the web for a chat. Answers show *Searched “…”* and
the sources as chips under the answer, and open links in a new tab. How it works depends on the provider:

- **Gemini** and **Anthropic** search with their own built-in tools, and by default decide on their own when
  to (so you only pay for searches the model chooses to make). The globe button makes them always search.
- **Apple Intelligence, OpenAI-compatible, Ollama and others** have no search tool, so the mod does it from
  your browser: the model writes a query, the mod searches (DuckDuckGo by default, or Brave / your own
  SearXNG in settings), reads the top three pages, and the answer cites them as clickable **[1] [2]**.
  By default this happens only when the globe is on. In settings, *Web search → Automatic* adds a quick
  check before each message so the model can decide on its own.
- Settings → *Web search → Off* removes the button entirely. Fetched pages are never saved to history; only
  the list of sources is.

## AI backends (Sine → this mod → settings)

- **Apple Intelligence (default).** On-device via afm-server (`http://127.0.0.1:11435/v1`). No key. Long pages
  are condensed to fit its small context.
- **Anthropic (Claude).** Needs an API key. Supports PDFs, images, extended thinking and built-in web search.
- **Google Gemini.** Needs an API key from Google AI Studio. Uses the native API (default model
  `gemini-3.5-flash`, change it in settings) so it gets Google Search grounding, PDFs, images and thinking.
  Pointing the *OpenAI-compatible* provider at Gemini's compatibility endpoint also works for chat, but that
  endpoint has no web search, so prefer this provider.
- **Any OpenAI-compatible endpoint**: OpenAI, Groq, a local Ollama, and so on.
- **No key / server unreachable.** Falls back to an instant offline extractive summary.

## Not included

Connected apps (Gmail, Calendar, Slack…), voice dictation, HEIC images, memory, and anything that needs
Dia's own backend. Old `.doc` / `.xls` / `.ppt` files aren't read, only the modern formats.

## Install (Sine)

Sine installs mods from a GitHub repo, and it only runs a mod's JavaScript if you allow it:

1. Put these files at the root of a public GitHub repo and set `homepage` in `theme.json` to its URL.
2. Zen Settings → Sine → turn on **Enable installing JS from unofficial sources**. Without it, Sine
   loads a mod's CSS but silently skips its script, so nothing appears.
3. In Sine, install from the repo URL, make sure the mod is enabled, then restart Zen.
4. Disable or uninstall the old Page Summary mod (both use ⌘E).

**Upgrading your existing Page Summary mod in place?** Sine stores each mod's script filename when it is
installed (`chrome/sine-mods/mods.json`), so a script with a different name is never loaded. Either
reinstall from a repo (above), or save this script over the old one under its original name,
`page-summary.uc.js`, and restart.

## If nothing appears

1. Hover the URL bar at the top of the sidebar: the chat icon appears on hover (like Zen's other URL bar
   icons) and stays lit while the sidebar is open. No icon at all means the script isn't running: check
   the two Sine steps above.
2. Open the Browser Console (⌘⇧J / Ctrl+Shift+J) and search for `dia-sidebar`. You should see
   `[dia-sidebar] loaded v2.0.0`. A wrong script filename shows up as `[Sine]: Failed to load script`. If
   clicking the icon does nothing, look for `[dia-sidebar] couldn't open the sidebar` and the error under it.

## Notes

- Files: `dia-sidebar.uc.js` (logic + styles), `theme.json`, `preferences.json`, `chrome.css` (toolbar icon).
- The chat icon is Ionicons' "chatbubble-ellipses" (MIT), the same glyph Zen uses for its own chat icon.
- The API key is stored as a plain-text preference in your Firefox profile, not in this repo.
- Settings from Page Summary don't carry over (this mod uses `mod.dia-sidebar.*`).
