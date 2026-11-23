# Dia Sidebar (Sine mod for Zen)

A Dia-style AI chat sidebar for Zen, loaded as a userChrome.js mod via Sine. It is a **real sidebar**: it
sits next to the page inside Zen's own layout, so the page gets narrower (nothing floats over it).

**It looks like Dia's sidebar**: a bare header (new chat on the left; a layout menu and close on the right), a blank
empty chat, and one big rounded composer holding your context cards, the box, and a bottom row with **+**, the
current tab as a pill, a **camera** (capture the page) and a round send button. It sits on your **Zen space's own
background colour** and uses Zen's text colour, page-card radius and shadow, so it follows each space and Zen's
light/dark setting.

Click the **chat icon in the URL bar** (it appears when you hover the URL bar, next to the bookmark star, in the same
colour as the other icons), or press **⌘E** (macOS) / **Ctrl+E**, to show or hide it. Each tab keeps its own chat
while the sidebar is hidden.

> Forked from *Page Summary*. Both mods use ⌘E, so disable Page Summary before enabling this one.

## Context: drag things in

Drop onto the sidebar (a "Drop to add as context" overlay appears):

- **Tabs**: drag a tab from Zen's tab list (or the tab strip). Its readable text becomes a card. Drop
  several at once, or a whole **tab group / folder**. PDFs open in a tab are read as PDFs.
- **Files**: images (PNG, JPEG, GIF, WebP), **PDFs**, **Word / Excel / PowerPoint** (.docx .xlsx .pptx),
  and text or code files. Paste images straight into the box too.
- **Selected text**: select text on the page and it appears as a Selection card, or right-click → *Ask Chat about selection*.

The current page is attached automatically as the pill in the bottom row (click it to leave the page out). The **camera** button attaches a screenshot of the page as a *Capture* card for models that can see images. Up to 12 cards at a time.
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
- **History** and **Skills** are in the menu next to the close button (the layout icon), which also moves the sidebar to the other side. History keeps past chats with search, restore and delete. Stored in your profile folder as
  `dia-sidebar-chats.json` (it includes the page text each chat was about). Turn it off in settings.
- **YouTube**: reads the transcript (works regardless of interface language) and summarizes automatically on
  videos. *Key moments* come with clickable **[mm:ss]** timestamps that seek the player.
- Markdown with tables, code blocks (Copy buttons), nested lists and favicon links.
- Drag the sidebar's left edge to resize; double-click the edge to reset.
- Opened over a **split view**, the whole split becomes one chat and every pane is attached.

## Web search

Search is **automatic**, like Dia: ask about news, prices, scores, people, products, "latest" anything, or
tell it to look something up, and the assistant searches by itself. Questions about the page, rewriting,
translating and Skills don't trigger a search. **Search the web** in the **+** menu (or **@Web**) forces a search for the
whole chat and shows a small *Web* chip. Answers show *Searched “…”* and the sources as chips under the answer. How it searches depends
on the provider:

- **Gemini** (Google Search) and **Anthropic** (web search tool) use their own built-in tools and decide on
  their own, and are told to search whenever a question needs it.
- **Apple Intelligence, OpenAI-compatible, Ollama and others** have no search tool, so the mod searches from
  your browser: the model writes a query, the mod searches (DuckDuckGo by default; Brave or your own SearXNG
  in settings), reads the top three pages, and the answer cites them as clickable **[1] [2]**. Clearly
  current questions ("today", "latest", "price of…") search immediately; for the rest, a quick check asks the
  model whether a search is needed first.
- If Gemini or Anthropic **refuse their search tool** (plan, region, model), the mod switches to the
  browser-side search for the rest of the session instead of failing.
- Settings → *Web search* can switch this to "only when I ask" or Off. Fetched pages are never saved
  to history, only the list of sources.

## AI backends (Sine → this mod → settings)

- **Apple Intelligence (default).** On-device via afm-server (default `http://127.0.0.1:11435/v1`, change it with *Server address*). If you enabled API-key protection in afm-server, enter that key in the mod's *API key* setting; requests use `Authorization: Bearer`. Long pages
  are condensed to fit its small context.
- **Anthropic (Claude).** Needs an API key. Supports PDFs, images, extended thinking and built-in web search.
- **Google Gemini.** Needs an API key from Google AI Studio. Leave *Model* blank to always use the **newest
  Gemini Flash** your key can access (it asks Google which models exist, so a retired model ID never breaks
  chat); type `flash-lite` or `pro` for those families, or an exact ID such as `gemini-3.8-flash`. If a model
  is unavailable it falls through to the next newest, and a model that rejects the thinking setting is retried
  without it. Uses Google's native API for Google Search grounding, PDFs, images and thinking. Pointing the
  *OpenAI-compatible* provider at Gemini's compatibility endpoint also works for plain chat, but that endpoint
  has no search, so prefer this provider.
- **Any OpenAI-compatible endpoint**: OpenAI, Groq, a local Ollama, and so on.
- **No key / server unreachable.** Falls back to an instant offline extractive summary.

## Settings

Sine → this mod → settings. Everything is grouped and applies immediately (no restart). Fields that don't apply
to your provider are hidden (for example, no API key box for Apple Intelligence).

- **AI model**: provider, API key, model, server address, and whether to show the model's thinking.
- **Chat**: answer length (concise / balanced / detailed), reply language, custom instructions, automatic
  summaries, and whether Enter sends or adds a new line.
- **Context**: attach the current page automatically, attach text selected on the page, YouTube timestamps.
- **Web search**: automatic / only when I ask / off, plus the search engine for models without
  built-in search (DuckDuckGo, Brave, SearXNG).
- **Appearance**: sidebar on the left or right, match your Zen space or use neutral colours, text size, and
  whether the URL bar button is shown. Drag the sidebar's edge to resize it (double-click the edge to reset).
- **Privacy**: save chat history or not. **Advanced**: the Summarize instruction and the page-text limit.

Settings from earlier versions (separate server addresses, search key fields) still work as a fallback.

## Not included

Connected apps (Gmail, Calendar, Slack…), voice dictation (Dia's microphone button; Firefox has no built-in speech recognition), HEIC images, memory, and anything that needs
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
   icons) and gets a subtle highlight while the sidebar is open. No icon at all means the script isn't running: check
   the two Sine steps above.
2. Open the Browser Console (⌘⇧J / Ctrl+Shift+J) and search for `dia-sidebar`. You should see
   `[dia-sidebar] loaded v2.0.0`. A wrong script filename shows up as `[Sine]: Failed to load script`. If
   clicking the icon does nothing, look for `[dia-sidebar] couldn't open the sidebar` and the error under it.

## Notes

- Files: `dia-sidebar.uc.js` (logic + styles), `theme.json`, `preferences.json`, `chrome.css` (toolbar icon).
- The chat icon is Ionicons' "chatbubble-ellipses" (MIT), the same glyph Zen uses for its own chat icon.
- The API key is stored as a plain-text preference in your Firefox profile, not in this repo.
- Settings from Page Summary don't carry over (this mod uses `mod.dia-sidebar.*`).
