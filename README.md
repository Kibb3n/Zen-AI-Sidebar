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
Anthropic reads PDFs and images natively; Apple Intelligence is text-only, so images are ignored there.

## Chat

- **/ Skills**: saved prompts. Built in: Summarize, Key takeaways, Explain simply, Action items, Flashcards,
  Fact-check, Proofread, Translate. Make your own (＋ New skill; *Write it for me* drafts one from a sentence).
  Type a skill's name and press Return to run it.
- **@ mentions**: open tabs, tab groups, **@list / @table / @code / @email / @tldr / @steps** to shape the
  answer, **@Web** (Anthropic web search) and **@Tabs** (ask to close, group or open tabs; you review the
  proposal and press Apply, nothing happens automatically).
- **Stop & Resume**, **Regenerate**, **Copy**, **Edit** your messages or the model's answers. Type while an
  answer is streaming and your message is queued (*Edit* it, or *Send now* to interrupt).
- **Thinking** is shown and collapsed when the model streams it (Anthropic: enable in settings).
- **History**: past chats with search, restore and delete (clock icon). Stored in your profile folder as
  `dia-sidebar-chats.json` (it includes the page text each chat was about). Turn it off in settings.
- **YouTube**: reads the transcript (works regardless of interface language) and summarizes automatically on
  videos. *Key moments* come with clickable **[mm:ss]** timestamps that seek the player.
- Markdown with tables, code blocks (Copy buttons), nested lists and favicon links.
- Drag the sidebar's left edge to resize; double-click the edge to reset.
- Opened over a **split view**, the whole split becomes one chat and every pane is attached.

## AI backends (Sine → this mod → settings)

- **Apple Intelligence (default).** On-device via afm-server (`http://127.0.0.1:11435/v1`). No key. Long pages
  are condensed to fit its small context.
- **Anthropic (Claude).** Needs an API key. Supports PDFs, images, extended thinking and web search.
- **Any OpenAI-compatible endpoint**: OpenAI, Gemini, Groq, a local Ollama, and so on.
- **No key / server unreachable.** Falls back to an instant offline extractive summary.

## Not included

Connected apps (Gmail, Calendar, Slack…), voice dictation, HEIC images, memory, and anything that needs
Dia's own backend. Old `.doc` / `.xls` / `.ppt` files aren't read, only the modern formats.

## If nothing appears

1. **Is the chat icon in the URL bar?** If not, the script isn't running. Check that the script file is named
   exactly `dia-sidebar.uc.js` (it must match `theme.json`; some downloads turn `.uc.js` into `_uc.js`), that
   the mod is enabled in Sine, and restart Zen. Disable the old Page Summary mod.
2. Open the Browser Console (⌘⇧J / Ctrl+Shift+J) and search for `dia-sidebar`. You should see
   `[dia-sidebar] loaded v2.0.0`. If clicking the icon does nothing, look for
   `[dia-sidebar] couldn't open the sidebar` and the error under it.

## Notes

- Files: `dia-sidebar.uc.js` (logic + styles), `theme.json`, `preferences.json`, `chrome.css` (toolbar icon).
- The API key is stored as a plain-text preference in your Firefox profile, not in this repo.
- Settings from Page Summary don't carry over (this mod uses `mod.dia-sidebar.*`).
