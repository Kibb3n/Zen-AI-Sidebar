# Dia Sidebar (Sine mod for Zen)

A Dia-style AI chat sidebar for Zen, loaded as a userChrome.js mod via Sine. It is a **real sidebar**: it
sits next to the page inside Zen's own layout, so the page gets narrower (nothing floats over it). It always sits on the
**opposite side from your tab sidebar** and follows it if you move the tabs to the other side. It stays visible in normal
fullscreen (F11 / macOS) and only hides when a page itself goes fullscreen, such as a video.

**It looks like Dia's sidebar**: a bare header (new chat and the **model picker** on the left; a menu and close on the right), a blank
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

The current page is attached automatically as the pill in the bottom row (click it to leave the page out). The **camera** button attaches a screenshot as a *Capture* card; Apple Intelligence is text-only, so image content is ignored. Up to 12 cards at a time.

## Chat

- **/ Skills**: saved prompts. Built in: Summarize, Key takeaways, Explain simply, Action items, Flashcards,
  Fact-check, Proofread, Translate. Make your own (＋ New skill; *Write it for me* drafts one from a sentence).
  Type a skill's name and press Return to run it.
- **@ mentions**: open tabs, tab groups, **@list / @table / @code / @email / @tldr / @steps** to shape the
  answer, **@Web** (search the web) and **@Tabs** (ask to close, group or open tabs; you review the
  proposal and press Apply, nothing happens automatically).
- **Stop & Resume**, **Regenerate**, **Copy**, **Edit** your messages or the model's answers. Type while an
  answer is streaming and your message is queued (*Edit* it, or *Send now* to interrupt).
- **Web search**: search when you ask, and cite what it found (see below).
- The **header menu** (top right) is a small dropdown with Chat history and Skills. Both open as full-size, scrollable sheets.
- **Models**: the pill at the top left shows the model in use; click it to switch. *Add or manage models…* opens a sheet where you
  add any number of OpenAI-compatible models (Ollama, LM Studio, OpenRouter, OpenAI…) with a name, server address, model ID and
  optional key. **Find models** asks the server what it offers. Tick *Small context window* for on-device or local models limited
  to about 4K tokens, and *Can read images* for vision models. The choice applies to your next message, in every chat and window. History keeps past chats with search, restore and delete. Stored in your profile folder as
  `dia-sidebar-chats.json` (it includes the page text each chat was about). Turn it off in settings.
- **YouTube**: reads the transcript (works regardless of interface language) and summarizes automatically on
  videos. *Key moments* come with clickable **[mm:ss]** timestamps that seek the player.
- Markdown with tables, code blocks (Copy buttons), nested lists and favicon links.
- Drag the sidebar's inner edge to resize; double-click the edge to reset.
- Opened over a **split view**, the whole split becomes one chat and every pane is attached.

## Web search

Web search is **manual** to keep the on-device model focused and avoid an extra routing request. Choose
**Search the web** in the **+** menu or type **@Web**; the mod searches with DuckDuckGo, reads up to three
pages, and gives the answer clickable **[1] [2]** citations. Answers show *Searched “…”* and source chips.
Fetched page text is not saved to history.

## AI backends (Sine → this mod → settings)

The built-in model is **Apple Intelligence via AFM Server** with the fixed model `apple.local`. The default
address is `http://127.0.0.1:11435/v1`. Change it only if you configured AFM Server to use another port.
Leave the API key blank unless key protection is enabled in AFM Server. Page and attachment text is
condensed and capped, and only a short recent chat is sent, to leave room inside Apple's 4,096-token
on-device context window for the answer. If the server cannot be reached, the chat shows the server
error.

Extra models you add are stored in `dia-sidebar-models.json` in your Firefox profile folder (API keys are plain text there).
Text-only models never receive image attachments.

## Settings

Sine → this mod → settings. The AI backend and model are fixed to AFM Server and `apple.local`; the short settings list only includes what this model needs.

- **Apple Intelligence**: AFM Server address and its optional API key.
- **Chat**: answer length (concise / balanced), automatic summaries, and whether Enter sends or adds a new line.
- **Context**: attach the current page automatically, attach text selected on the page, YouTube timestamps.
- **Web search**: only when asked or off. DuckDuckGo is used when you request a search.
- **Appearance**: match your Zen space or use neutral colours, text size, and
  whether the URL bar button is shown. Drag the sidebar's edge to resize it (double-click the edge to reset).
- **Privacy**: save chat history or not.

Older AFM server address preferences still work as a fallback.

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
   `[dia-sidebar] loaded v2.1.0`. A wrong script filename shows up as `[Sine]: Failed to load script`. If
   clicking the icon does nothing, look for `[dia-sidebar] couldn't open the sidebar` and the error under it.

## Notes

- Files: `dia-sidebar.uc.js` (logic + styles), `theme.json`, `preferences.json`, `chrome.css` (toolbar icon).
- The chat icon is Ionicons' "chatbubble-ellipses" (MIT), the same glyph Zen uses for its own chat icon.
- The API key is stored as a plain-text preference in your Firefox profile, not in this repo.
- Settings from Page Summary don't carry over (this mod uses `mod.dia-sidebar.*`).
