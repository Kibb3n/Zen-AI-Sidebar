# Dia Sidebar (Sine mod for Zen)

A Dia-style AI chat sidebar for Zen, loaded as a userChrome.js mod via Sine. It is a **real sidebar**: it sits next to the
page inside Zen's own layout, so the page gets narrower (nothing floats over it). It always sits on the **opposite side from
your tab sidebar** and follows it if you move your tabs to the other side. It stays visible in normal fullscreen (F11 /
macOS) and only hides when a page itself goes fullscreen, such as a video.

It looks like Dia's sidebar: a bare header (new chat and the **model picker** on the left, a menu and close on the right), a
blank empty chat, and one big rounded composer with your context cards, the box, and a bottom row with **+**, a **globe** to
force web search, a **camera** and a round send button. It uses your Zen space's own colours, so it follows each space and Zen's
light/dark setting.

## Opening it

Press **⌘E** (macOS) / **Ctrl+E**, or use the chat icon in the URL bar (it appears when you hover the URL bar, next to the
bookmark star). **It only opens on a real web page.** On a new tab, a blank tab or a browser page (about:…), the shortcut does
nothing and the URL bar icon is dimmed. If you navigate a tab with the sidebar open to one of those, the sidebar hides and comes
back when the tab is on a page again. Each tab keeps its own chat while the sidebar is hidden.

> Forked from *Page Summary*. Both mods use ⌘E, so disable Page Summary before enabling this one.

## Setup guide

The first time you open the sidebar, a short guide helps you pick a model, set the effort and choose how web search works.
After you save a model, setup lets you continue or optionally add another; adding more models is never required.
To see it again, tick **Setup → Run the setup guide again** in the mod's Sine settings. **That removes any models you added**
(Apple Intelligence stays) and shows the guide the next time the sidebar is open. If a page is already open, it shows at once.

## Models

The pill at the top left shows the model in use. Click it to switch. The model applies to your next message, in every chat and
window. **Add or manage models…** opens a sheet to add as many as you like:

- **Apple Intelligence** (built in): runs on your Mac through AFM Server with the model `apple.local`. The default address is
  `http://127.0.0.1:11435/v1`. If you changed it, or turned on key protection, set the address and key under
  **Advanced** in the mod's settings.
- **Google Gemini**: sign in to Google AI Studio with your existing Google account, create an API key (the form has a button
  that opens it), and choose Flash (fast), Pro (smartest) or Flash-Lite (cheapest). The newest model of that kind is picked
  for you automatically. **Check key** verifies the key and lists the models it can use if you would rather pick an exact one.
  Gemini reads images and PDFs, and uses Google Search by itself when a question needs it.
- **Claude**: paste an Anthropic API key, then **Find models** lists the Claude models enabled for that key.
- **OpenAI · ChatGPT API**: paste an OpenAI platform API key and choose a model from its list. A ChatGPT subscription does
  not automatically include API usage; API billing is handled separately.
- **DeepSeek**: the current DeepSeek Flash model is prefilled, and **Find models** lists anything else enabled for your key.
- **Ollama**: starts with its local API address and lists models already installed on your Mac. No cloud key is needed.
- **Other compatible model** (LM Studio, OpenRouter, or another OpenAI-compatible server): provide the server address, model
  ID and optional key. **Find models** asks the server what it offers. *Small context window*, *Can read images*, and
  *Reasoning model* describe optional model capabilities.

Models you add are stored in `dia-sidebar-models.json` in your Firefox profile folder. API keys are plain text there.
Text-only models never receive image attachments.

## Effort

The **Effort slider** is in the model menu: Low, Medium, High, Max. It sets how much work the model puts into an answer, and
what that means depends on the model:

| | Low | Medium | High | Max |
|---|---|---|---|---|
| **Answer style** | brief | balanced | thorough | thorough, checked against the sources |
| **Apple Intelligence** | one quick pass | one pass | reads the **whole page in parts**, keeps notes for your question, then answers | also drafts an answer and **refines** it |
| **Gemini** | light thinking | light thinking | more thinking | longest thinking |
| **Reasoning models** | `reasoning_effort` low | medium | high | high |

Apple's on-device model only has a 4,096-token window, so higher effort works by doing more passes instead of cramming more
into one. It is slower but gives far better answers on long pages. Short pages never need the extra reading. The quick
background calls (like deciding whether to search) always stay at low effort.

Effort is a slider in the sidebar because Sine's settings page has no slider control.

## Web search

**Automatic by default.** When a question needs current or outside information, the model searches the web by itself:

- **Gemini** uses Google Search directly.
- **Other models** (including Apple Intelligence) make one quick call to decide whether and what to search, then the mod
  searches with DuckDuckGo by default, reads up to three pages and answers with clickable **[1] [2]** citations. Click the
  globe to force a search for this chat; it also works with Apple Intelligence through AFM Server. In Settings, you can
  choose Google Search, Brave Search or a SearXNG instance. Available providers are tried as fallbacks if the selected one
  is unavailable or rate-limited. When you ask it to search links embedded in the current page, it can choose relevant links,
  read up to three linked pages and answer with clickable citations. Questions that are plainly about the page ("summarize this
  page") skip that extra call.

Google Search reads the browser's Google results page, spaces requests out, and can use the existing browser session when
available. Google may still show a CAPTCHA or rate-limit the request; the mod then tries another configured provider. This is
page scraping, not Google-account authentication or a Google Search API. Google's Custom Search JSON API is closed to new
customers and is scheduled to end for existing customers on January 1, 2027.

Brave Search needs an API key and SearXNG needs an instance address. Google Search and DuckDuckGo need no extra setup.

Change automatic search in **Settings → Chat → Web search** (Automatic / Only when I ask / Off), or in the setup guide. The
globe or **@Web** forces a search even when automatic search is Off. Fetched page text is not saved to history.

Gemini API limits are set by Google per project and model. The sidebar retries temporary 429s and, when using the automatic
Flash choice, tries another offered Flash model and then Flash-Lite. If the project quota is zero or exhausted, open
**Check Gemini limits** in the error message; the sidebar cannot override Google's project limits.

## Context: drag things in

Drop onto the sidebar (a "Drop to add as context" overlay appears):

- **Tabs**: drag a tab from Zen's tab list. Its readable text becomes a card. Drop several at once, or a whole **tab group /
  folder**. PDFs open in a tab are read as PDFs.
- **Files**: images (PNG, JPEG, GIF, WebP), **PDFs**, **Word / Excel / PowerPoint** (.docx .xlsx .pptx), and text or code files.
  Paste images straight into the box too.
- **Selected text**: select text on the page and it appears as a Selection card, or right-click → *Ask Chat about selection*.

The current page starts as a context card above the chat box with an **Included / Skipped** control. It is greyed out when
skipped from the first message. After that first message, it becomes a normal removable tab card for later messages. Use **+ →
Add an open tab…** to search and choose from your loaded web tabs. The **camera** attaches a screenshot as a *Capture* card
(only models marked *Can read images* look at it). Up to 12 cards at a time.

## Chat

- **/ Skills**: saved prompts. Built in: Summarize, Key takeaways, Explain simply, Action items, Flashcards, Fact-check,
  Proofread, Translate. Make your own (＋ New skill; *Write it for me* drafts one from a sentence).
- **@ mentions**: open tabs, tab groups, **@list / @table / @code / @email / @tldr / @steps** to shape the answer, **@Web** and
  **@Tabs** (ask to close, group or open tabs; you review the proposal and press Apply).
- **Stop & Resume**, **Regenerate**, **Copy**, **Edit** your messages or the model's answers. Type while an answer is streaming
  and your message is queued.
- The **header menu** (top right) has **Chat history** (search, restore, delete; stored in `dia-sidebar-chats.json`, turn it off
  in settings) and **Skills**. Both open as full-size, scrollable sheets.
- **YouTube**: reads the transcript and summarizes automatically on videos, with clickable **[mm:ss]** key moments.
- Markdown with tables, code blocks (Copy buttons), nested lists and favicon links.
- Drag the sidebar's inner edge to resize; double-click the edge to reset. Opened over a **split view**, every pane is attached.

## Settings (Sine → this mod → settings)

Short on purpose; model and effort live in the sidebar.

- **Chat**: web search mode, automatic summaries, Enter-to-send.
- **Context**: attach the current page, attach selected text.
- **Appearance**: match your Zen space or neutral colours, text size, URL bar button.
- **Privacy**: save chat history.
- **Setup**: run the setup guide again.
- **Advanced** (tick *Show advanced options*): AFM Server address and key.

Settings from earlier versions that no longer exist (answer length, sidebar side, YouTube timestamps, the old web search
setting) are ignored: answer length is now the Effort slider, the side follows your tab sidebar, and web search is now
automatic unless you change the new setting.

## Not included

Connected apps (Gmail, Calendar, Slack…), voice dictation, HEIC images, memory, and anything that needs Dia's own backend. Old
`.doc` / `.xls` / `.ppt` files aren't read, only the modern formats. Local `file://` pages and Reader View are not treated as
pages yet.

## Install (Sine)

Sine installs mods from a GitHub repo, and only runs a mod's JavaScript if you allow it:

1. Put these files at the root of a public GitHub repo and set `homepage` in `theme.json` to its URL.
2. Zen Settings → Sine → turn on **Enable installing JS from unofficial sources**. Without it, Sine loads a mod's CSS but
   silently skips its script, so nothing appears.
3. In Sine, install from the repo URL, make sure the mod is enabled, then restart Zen.
4. Disable or uninstall the old Page Summary mod (both use ⌘E).

**Updating an install that uses another script filename?** Sine stores each mod's script filename when it is installed
(`chrome/sine-mods/mods.json`), so a script with a different name is never loaded. Reinstall from the repo, or save the new script
over the old one under its original name and restart.

## If nothing appears

1. The sidebar only opens on a web page. On a new tab the URL bar icon is dimmed on purpose. Open a site first.
2. Hover the URL bar: the chat icon appears on hover. No icon at all means the script isn't running: check the two Sine steps above.
3. Open the Browser Console (⌘⇧J / Ctrl+Shift+J) and search for `dia-sidebar`. You should see `[dia-sidebar] loaded v2.3.0`. A
   wrong script filename shows up as `[Sine]: Failed to load script`. If clicking the icon does nothing on a page, look for
   `[dia-sidebar] couldn't open the sidebar` and the error under it.

## Notes

- Files: `dia-sidebar.uc.js` (logic + styles), `theme.json`, `preferences.json`, `chrome.css` (toolbar icon fallback).
- The chat icon is Ionicons' "chatbubble-ellipses" (MIT), the same glyph Zen uses for its own chat icon.
- Model API keys are stored as plain text in `dia-sidebar-models.json` in your Firefox profile, not in this repo. A Brave
  Search API key is stored in Firefox preferences. Search queries go to the selected provider, then Google/DuckDuckGo and any
  configured Brave or SearXNG fallback.
