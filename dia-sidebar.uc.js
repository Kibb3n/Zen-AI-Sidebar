// ==UserScript==
// @name         Dia Sidebar
// @description  Dia-style AI chat sidebar: docked panel, Skills, @-mentions, attachments, history, key moments on YouTube
// @include      main
// ==/UserScript==

(() => {
  const diaMain = () => {
  const ID = "dia-sidebar";
  const PREF = "mod.dia-sidebar.";
  const NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MSG = "dia-sidebar:text";
  const SEL_MSG = "dia-sidebar:selection";
  const MAX_CHARS = 24000;
  const MAX_REFS = 12;
  const VERSION = "2.9.0";
  const DEFAULT_PROMPT = "Summarize this page into concise bullet points.";
  const SYSTEM =
    "You are an AI assistant living in a sidebar next to the web page the user is viewing. " +
    "Use the page content and anything the user attached (tabs, selected text, files, images). " +
    "Be concise and direct: lead with the answer, avoid filler and heavy formatting. Use markdown (short bullets, " +
    "tables and fenced code blocks only when they help). When asked to summarize, reply in 5-8 concise bullet points " +
    "(bold only key terms) with no preamble. If the page does not contain the answer, say so instead of guessing.";

  // ---------- Skills (Dia's saved prompts) ----------
  // prompt "" = the configurable summary instruction
  const SKILLS = [
    { id: "summarize", name: "Summarize", prompt: "" },
    { id: "takeaways", name: "Key takeaways", prompt: "What are the key takeaways? Answer in a few concise bullets." },
    { id: "simple", name: "Explain simply", prompt: "Explain this in plain language for a curious beginner. Keep it short and add one concrete analogy." },
    { id: "actions", name: "Action items", prompt: "List any action items, decisions or next steps from this. If there are none, say so." },
    { id: "flashcards", name: "Flashcards", prompt: "Create 6-10 study flashcards from this. Write each as a bullet: **Q:** question — **A:** short answer." },
    { id: "factcheck", name: "Fact-check", prompt: "Pick the main factual claims, say which look well supported by the text and which are unsupported, vague or need checking elsewhere. Be brief." },
    { id: "proofread", name: "Proofread", prompt: "Proofread the selected or attached text (or, if there is none, the user's message). Show the corrected version first, then a short list of what you changed." },
    { id: "translate", name: "Translate", prompt: "Translate the selected text into English (if nothing is selected, translate the main points of this page). Keep tone and meaning." },
  ];
  // shown instead of the page skills when the sidebar is open on a YouTube video
  const YT_SKILLS = [
    { id: "yt-summarize", name: "Summarize", prompt: "Summarize this video in 5-7 concise bullet points. Do not include any timestamps." },
    { id: "yt-moments", name: "Key moments", prompt: "Identify the most important moments across the ENTIRE video, from start to finish. Give 6-10 bullets total — never one per line, and do not stop partway through. Group related content into a single moment. Begin each bullet with the [mm:ss] timestamp of the transcript line where that moment STARTS (the line whose text is about it, not the line before), then a short one-line description. If a Chapters list is given, give one bullet per chapter, starting with exactly that chapter's listed time and naming the chapter. Bold at most one key term per bullet." },
    { id: "yt-takeaways", name: "Takeaways", prompt: "What are the main takeaways from this video? Answer in a few concise bullet points with no timestamps." },
    { id: "yt-tldr", name: "TL;DR", prompt: "Give a two-sentence TL;DR of this video. No timestamps." },
  ];
  // appended to the system prompt whenever a search tool is available, so the model searches on its own like Dia does
  const SEARCH_NUDGE =
    "You have a live web search tool. Use it automatically, without asking permission, whenever the answer depends on current, recent or outside information " +
    "(news, prices, scores, weather, people, companies, products, software versions, events, anything described as latest or current) or whenever you are not sure. " +
    "Do not search for questions about the page itself, rewriting, translating, math, or timeless knowledge. " +
    "Write specific search queries: use the real names, product or version numbers and the year instead of words like it/this/that, " +
    "work out what \"it\" is from the page and the chat, ask for the exact fact you need (price, release date, specs, score, fix) rather than the bare topic, and drop filler words. " +
    "If the first results are off-target or do not answer the question, search again with different, more specific wording before you answer. " +
    "When you do need to look something up, first say one short, friendly sentence about what the page already tells them (or doesn't) and that you're checking further, then search, then carry on with the answer.";
  // How a good query is written. Shared by the routers below so models without a search tool search for the right thing.
  const QUERY_RULES =
    "HOW TO WRITE THE QUERY: it must find the exact thing the user means, so make it specific. " +
    "Replace it/this/that/they/he/she with the real name, taken from the page title, the page excerpt or the recent chat. " +
    "Keep the distinctive words: names, products, model or version numbers, places, error messages. Add the year when the question is about something latest, current or new. " +
    "Drop filler such as please, can you, tell me, search for, what is. Ask for the specific fact wanted (price, release date, specs, score, how to fix) instead of only the topic. " +
    "Use double quotes only around an exact name or error message that must match word for word. One topic per query, usually 3 to 9 words, never a full sentence. " +
    "Examples: page 'Framework Laptop 13 review', user 'how much is it?' -> SEARCH: framework laptop 13 price. " +
    "Chat about the Lakers, user 'who won last night?' -> SEARCH: lakers game result last night. " +
    "User 'why do I get ECONNREFUSED 127.0.0.1:5432' -> SEARCH: ECONNREFUSED 127.0.0.1:5432 postgres fix. " +
    "Only when the question has two separate parts or one query may miss, add an extra line ALT: with a second query for the other part or from a different angle.";
  // A dedicated step that writes the query from the whole conversation (used for every web search, whichever model is chosen)
  const QUERY_WRITER_SYSTEM =
    "You write the web search query for a browser assistant. You are given the page the user is on, the conversation so far and the user's latest message. " +
    "Do not copy the latest message. Work out what the user actually wants to find out right now, using the whole conversation: their earlier questions, the answers already given, " +
    "what 'it', 'that', 'them', 'the second one', 'more' or 'what about X' refers to, and the page they are on. Then write the query a careful researcher would type to find exactly that. " +
    "Reply with exactly one line: SEARCH: followed by the query. " + QUERY_RULES + " Never add anything else.";
  // For models without a built-in search tool: one quick call decides whether (and what) to search
  const ROUTER_SYSTEM =
    "You help a browser assistant decide whether it must look further than the page the user is viewing to answer their latest message. " +
    "Reply with exactly NO when the page excerpt (or general knowledge, rewriting, summarizing, translating, math, coding help) is enough. " +
    "Otherwise reply with two lines. First line: SAY: one short, casual sentence in the first person (max 25 words) saying what the page does or doesn't tell them about their question and that you're going to look further. " +
    "If you are not sure what the page says, just say you'll look it up. Second line: SEARCH: followed by one specific web search query (see the rules below), or LINKS: followed by up to 3 comma-separated numbers from the supplied page-link list. " +
    "Choose LINKS when the user asks about a link embedded in the page and one of the listed links fits. " +
    "Choose a search for news, recent or changing facts, prices, products, people or companies you may not know, facts the page doesn't contain, or when the user asks to look something up online. " + QUERY_RULES + " Never add anything else.";
  const ROUTER_LINKS =
    "You help a browser assistant decide whether it should open links that are embedded in the page the user is viewing, to answer their latest message. You may only use the numbered links in the supplied list: there is no web search. " +
    "Reply with exactly NO when the page excerpt is enough. Otherwise reply with two lines. First line: SAY: one short, casual sentence in the first person (max 25 words) saying what the page does or doesn't tell them and that you'll check a link on the page. " +
    "Second line: LINKS: followed by up to 3 comma-separated numbers from the list (when the user asks to open or read links, pick the most relevant ones). Never add anything else.";
  const ROUTER_FORCED =
    "Act on the user's latest message using the recent chat, the page excerpt and the supplied page-link list. Reply with two lines. First line: SAY: one short, casual first-person sentence (max 25 words) about what the page already tells them, if anything, and that you're going to look further. " +
    "Second line: if they ask to search/read/follow links embedded in the current page, LINKS: followed by up to 3 relevant numbers from the list; otherwise SEARCH: followed by the single best web search query (see the rules below). " + QUERY_RULES + " Never add anything else.";
  // @formats: steer the shape of the answer
  const FORMATS = [
    { id: "list", name: "list", hint: "Bulleted list", prompt: "Format the answer as a concise bulleted list." },
    { id: "table", name: "table", hint: "Markdown table", prompt: "Present the answer as a markdown table." },
    { id: "code", name: "code", hint: "Code blocks", prompt: "Answer with code in fenced code blocks and minimal prose." },
    { id: "email", name: "email", hint: "Ready-to-send email", prompt: "Write the answer as a ready-to-send email: subject line, greeting, body, sign-off." },
    { id: "tldr", name: "tldr", hint: "Two sentences max", prompt: "Answer in two sentences at most." },
    { id: "steps", name: "steps", hint: "Numbered steps", prompt: "Format the answer as short numbered steps." },
  ];
  // the protocol for "@Tabs": the model proposes actions, the user confirms them with one click
  const TABS_PROTOCOL =
    "The user wants to manage their open tabs. Their open tabs are listed above with numeric ids. Explain briefly what you'd do, " +
    "then END your reply with ONE fenced block tagged `tabs` containing JSON: " +
    '{"actions":[{"type":"close","ids":[1,2]},{"type":"group","ids":[3,4],"name":"Short name"},{"type":"open","urls":["https://…"]},{"type":"switch","id":5}]}. ' +
    "Only use ids from the list. Never close pinned tabs. The user will review and confirm before anything happens.";

  const ICONS = {
    chat: "M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5a1.5 1.5 0 0 1-1.5 1.5H8l-3 2.5V11H4.5A1.5 1.5 0 0 1 3 9.5z",
    new: "M7 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5V9M11.3 2.7l2 2L8 10l-2.7.7L6 8z",
    close: "M4 4l8 8M12 4l-8 8",
    send: "M8 13V3M3.5 7.5L8 3l4.5 4.5",
    stop: "M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z",
    history: "M8 3.2a4.8 4.8 0 1 1-4.5 3.2M2.6 3v3.4H6M8 5.6V8l1.7 1.1",
    plus: "M8 3.5v9M3.5 8h9",
    minus: "M3.5 8h9",
    clip: "M10.8 6.2L6.6 10.4a1.3 1.3 0 0 0 1.9 1.9l4.3-4.3a2.8 2.8 0 0 0-4-4L4.6 8.3a4.3 4.3 0 0 0 6.1 6.1l2-2",
    spark: "M6.5 2.5l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3L2 7l3.3-1.2zM12 9.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z",
    edit: "M3 13l.7-2.8 6.9-6.9a1.4 1.4 0 0 1 2 2L5.8 12.3z",
    copy: "M5.5 5.5h7v7h-7zM3.5 10.5v-7h7",
    refresh: "M13 8a5 5 0 1 1-1.6-3.7M13 2.8v2.7h-2.7",
    trash: "M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8",
    search: "M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.5 10.5l3 3",
    chev: "M4.5 6.5L8 10l3.5-3.5",
    page: "M4 2.5h5l3 3v8H4zM9 2.5v3h3",
    folder: "M2.5 4.5h4l1.2 1.5h5.8v6.5h-11z",
    tabs: "M3.5 3h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7A1.5 1.5 0 0 1 3.5 3zM2 6.5h12M4.6 4.8h.01M6.6 4.8h.01",
    play: "M5.5 3.8v8.4L12 8z",
    check: "M3.5 8.5l3 3 6-6.5",
    sidebar: "M3.5 3h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7A1.5 1.5 0 0 1 3.5 3zM9.5 3v10M11.4 6.2v3.6",
    chevs: "M5.5 6.3L8 3.8l2.5 2.5M5.5 9.7L8 12.2l2.5-2.5",
    camera: "M2 6.4A1.4 1.4 0 0 1 3.4 5h1.5l.9-1.5h4.4l.9 1.5h1.5A1.4 1.4 0 0 1 14 6.4v5.2a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 11.6zM8 10.6a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2z",
    globe: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2.5 8h11M8 2.5c1.6 1.5 2.4 3.4 2.4 5.5S9.6 12 8 13.5C6.4 12 5.6 10.1 5.6 8S6.4 4 8 2.5z",
    drop: "M8 11V3M4.5 6.5L8 3l3.5 3.5M3 11.5v1A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-1",
  };
  const FILLED = new Set(["stop", "play"]);

  // ---------- styles (embedded so script and CSS always match) ----------
  const CSS = `
#dia-dock {
  /* Colours come from Zen's own tokens, so the sidebar follows every space (--zen-primary-color) and Zen's own
     light/dark setting (light-dark). The fallbacks keep it neutral in plain Firefox. */
  --fg: var(--toolbar-color, light-dark(#18181b, #f2f2f4));
  --panel: var(--zen-main-browser-background, var(--toolbar-bgcolor, light-dark(#f3f3f5, #1b1b1d)));
  --card: color-mix(in srgb, var(--fg) 9%, transparent);
  --glass: color-mix(in srgb, var(--fg) 12%, transparent);
  --pop: light-dark(color-mix(in srgb, var(--tint) 12%, #ffffff), color-mix(in srgb, var(--tint) 16%, #18191b));
  --tint: var(--zen-primary-color, #6b7cff);
  --accent: light-dark(color-mix(in srgb, var(--tint) 80%, black), color-mix(in srgb, var(--tint) 70%, white));
  --on-accent: light-dark(#ffffff, #101010);
  --danger: light-dark(#d93036, #ff7a7f);
  --line: color-mix(in srgb, var(--fg) 10%, transparent);
  --soft: color-mix(in srgb, var(--fg) 5%, transparent);
  --soft2: color-mix(in srgb, var(--fg) 9%, transparent);
  --mute: color-mix(in srgb, var(--fg) 52%, transparent);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  &[data-accent="neutral"] { --tint: light-dark(#5b6b86, #b8c4d9); --panel: light-dark(#f4f4f5, #1a1a1c); }
  /* a real sidebar: an in-flow flex item next to the tab box, styled like Zen's own page card */
  /* The dock's height comes only from its row (align-self: stretch), never from its content. Without "contain: size" the
     chat's content height leaks into Zen's #zen-tabbox-wrapper (min-height: auto), the dock grows taller than the window,
     the composer is pushed off-screen and neither the chat nor the History/Skills lists can scroll. */
  position: relative; flex: 0 0 var(--dia-w, 400px); width: var(--dia-w, 400px); min-width: 0; min-height: 0; max-height: 100%; align-self: stretch; contain: size;
  margin-inline-start: var(--zen-element-separation, 8px);
  box-sizing: border-box; display: flex; flex-direction: column;
  /* No paint of its own: like Zen's tab sidebar, the sidebar is transparent over the space's own background, so it is exactly
     the colour of the space (gradient and all) and follows each space and light/dark. Only the neutral colour option, and the
     floating fallback (which overlays the page), get a solid panel. */
  color: var(--fg); background: transparent;
  font: var(--dia-fs, 14px)/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased;
  border-radius: calc(var(--zen-native-inner-radius, 12px) / var(--zen-squircle-value, 1)); corner-shape: round;
  box-shadow: none;
  &[data-accent="neutral"], &.dia-float { background: var(--panel); background-attachment: fixed; box-shadow: var(--zen-big-shadow, 0 2px 10px rgba(0, 0, 0, 0.14)); }
  animation: dia-slide 0.32s var(--ease);
  &[hidden] { display: none; }
  &[data-side="left"] { margin-inline-start: 0; margin-inline-end: var(--zen-element-separation, 8px); animation-name: dia-slide-l; }
  &.dia-float { position: fixed; top: 80px; right: 8px; bottom: 8px; margin: 0; z-index: 2147483000; flex: none; }
  /* Stays visible in normal fullscreen (F11 / macOS). Hidden only when a page itself goes fullscreen (a video, say). */
  :root[inDOMFullscreen="true"] & { display: none; }
  &.dia-resizing { user-select: none; }
  &.dia-resizing * { pointer-events: none; }
  &.dia-resizing .dia-grip { pointer-events: auto; }

  .dia-grip { position: absolute; left: calc(-1 * var(--zen-element-separation, 8px) - 2px); top: 10px; bottom: 10px; width: calc(var(--zen-element-separation, 8px) + 6px); cursor: col-resize; z-index: 6; }
  &[data-side="left"] .dia-grip { left: auto; right: calc(-1 * var(--zen-element-separation, 8px) - 2px); }
  .dia-grip::after { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; margin-left: -1px; border-radius: 3px; background: var(--accent); opacity: 0; transition: opacity 0.15s; }
  .dia-grip:hover::after, &.dia-resizing .dia-grip::after { opacity: 0.5; }

  .dia-panels { position: absolute; inset: 0; display: flex; flex-direction: column; border-radius: inherit; overflow: hidden; }
  .dia-panel { flex: 1 1 0%; min-height: 0; display: flex; flex-direction: column; position: relative; }
  .dia-panel[hidden] { display: none; }
  button { font: inherit; color: inherit; }
  .dia-svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  .dia-svg-fill { fill: currentColor; stroke: none; }

  /* header, like Dia: new chat on the left; layout menu and close on the right. No title. */
  .dia-head { display: flex; align-items: center; justify-content: space-between; flex: none; padding: 14px 14px 6px 16px; }
  .dia-head-left { display: flex; align-items: center; gap: 2px; min-width: 0; flex: 0 1 auto; }
  .dia-head-right { display: flex; align-items: center; gap: 4px; flex: none; }
  .dia-modelbtn { appearance: none; border: 0; background: transparent; color: var(--mute); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; height: 34px; min-width: 0; padding: 0 8px 0 10px; border-radius: 12px; font-size: 13px; transition: background-color 0.15s, color 0.15s; }
  .dia-modelbtn:hover, .dia-modelbtn.dia-open { background: var(--soft); color: var(--fg); }
  .dia-modelname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px; }
  .dia-modelbtn .dia-svg { width: 13px; height: 13px; flex: none; }
  .dia-icon { appearance: none; background: transparent; border: 0; cursor: pointer; width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; color: var(--mute); transition: background-color 0.15s, color 0.15s, transform 0.15s var(--ease); }
  .dia-icon:hover { background: var(--soft); color: var(--fg); }
  .dia-icon:active { transform: scale(0.92); }
  .dia-webbtn.on { background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent); }
  .dia-webbtn { width: 34px; height: 34px; flex: none; border-radius: 50%; }
  .dia-webbtn .dia-svg { width: 20px; height: 20px; stroke-width: 1.8; }
  .dia-head .dia-icon { width: 34px; height: 34px; border-radius: 12px; }
  .dia-head .dia-icon .dia-svg { width: 20px; height: 20px; }
  .dia-head .dia-layout { width: auto; padding: 0 6px 0 8px; display: inline-flex; align-items: center; gap: 1px; }
  .dia-head .dia-layout .dia-svg:last-child { width: 13px; height: 13px; }

  /* conversation */
  .dia-log { flex: 1 1 0%; min-height: 0; overflow-x: hidden; overscroll-behavior-y: contain; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--soft2) transparent; display: flex; flex-direction: column; gap: 22px; padding: 10px 18px 18px; }
  .dia-log > * { flex-shrink: 0; } /* messages keep their height; the log scrolls instead of squashing them */
  .dia-msg { animation: dia-in 0.38s var(--ease) both; }
  .dia-answer { overflow-wrap: anywhere; }
  .dia-answer p, .dia-ubub p { margin: 0 0 10px; }
  .dia-answer p:last-child { margin-bottom: 0; }
  .dia-answer ul, .dia-answer ol { margin: 0 0 10px; padding-inline-start: 22px; }
  .dia-answer li { margin: 0 0 4px; padding-inline-start: 2px; }
  .dia-answer li > ul, .dia-answer li > ol { margin: 6px 0 0; }
  .dia-answer li::marker { color: var(--mute); }
  .dia-answer .dia-h { font-weight: 650; margin: 16px 0 6px; }
  .dia-answer > .dia-h:first-child { margin-top: 0; }
  .dia-answer blockquote { margin: 0 0 10px; padding: 2px 0 2px 14px; border-inline-start: 3px solid var(--soft2); color: var(--mute); }
  .dia-answer hr { border: 0; border-top: 1px solid var(--line); margin: 14px 0; }
  .dia-answer code { font: 0.88em ui-monospace, Menlo, Consolas, monospace; padding: 1px 5px; border-radius: 6px; background: var(--soft2); }
  .dia-answer del { opacity: 0.6; }
  .dia-link { color: var(--accent); cursor: pointer; text-decoration: none; word-break: break-word; }
  .dia-link:hover { text-decoration: underline; }
  .dia-fav { width: 13px; height: 13px; border-radius: 3px; vertical-align: -2px; margin-inline-end: 4px; }
  .dia-ts { color: var(--mute); cursor: pointer; text-decoration: none; font-variant-numeric: tabular-nums; font-size: 0.86em; font-weight: 550; white-space: nowrap; background: var(--soft); border-radius: 6px; padding: 1px 6px; margin-inline-end: 3px; }
  .dia-ts:hover { color: var(--fg); background: var(--soft2); }
  .dia-code { margin: 0 0 10px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
  .dia-code-head { display: flex; align-items: center; justify-content: space-between; padding: 3px 6px 3px 14px; font-size: 11.5px; color: var(--mute); background: var(--soft); }
  .dia-code pre { margin: 0; padding: 12px 14px; overflow-x: auto; scrollbar-width: thin; }
  .dia-code pre code { padding: 0; background: none; font-size: 12.5px; line-height: 1.55; white-space: pre; }
  .dia-table { margin: 0 0 10px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
  .dia-table-scroll { overflow-x: auto; scrollbar-width: thin; }
  .dia-table table { border-collapse: collapse; width: 100%; font-size: 13px; }
  .dia-table th, .dia-table td { padding: 7px 12px; text-align: start; vertical-align: top; border-bottom: 1px solid var(--line); }
  .dia-table th { font-weight: 600; white-space: nowrap; border-bottom-color: var(--soft2); }
  .dia-table tr:last-child td { border-bottom: 0; }

  /* your messages */
  .dia-ug { align-self: flex-end; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: 88%; position: relative; }
  .dia-ubub { padding: 8px 14px; border-radius: 18px 18px 6px 18px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--glass); }
  .dia-ug-tools { position: absolute; left: -30px; bottom: 0; opacity: 0; transition: opacity 0.15s; }
  .dia-ug:hover .dia-ug-tools { opacity: 1; }
  .dia-sent { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; }
  .dia-sentimg { max-width: 170px; max-height: 130px; border-radius: 12px; border: 1px solid var(--line); object-fit: cover; }
  .dia-edit { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
  .dia-edit textarea { resize: vertical; width: 100%; box-sizing: border-box; font: inherit; color: inherit; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); outline: 0; min-height: 64px; max-height: 320px; }
  .dia-edit textarea:focus { border-color: color-mix(in srgb, var(--fg) 30%, transparent); }
  .dia-edit-row { display: flex; gap: 6px; justify-content: flex-end; }
  .dia-queued { align-self: flex-end; max-width: 88%; display: flex; align-items: center; gap: 2px; padding: 3px 4px 3px 12px; border: 1px dashed var(--line); border-radius: 16px; color: var(--mute); font-size: 12.5px; }
  .dia-queued > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* status, errors, streaming */
  .dia-note { font-size: 12px; color: var(--mute); margin-top: 4px; }
  .dia-error { color: var(--danger); word-break: break-word; margin: 0; }
  /* while an answer is being written: a soft breathing dot at the end of the text */
  .dia-streaming .dia-answer:not(.dia-seg-done) > p:last-child::after, .dia-streaming .dia-answer:not(.dia-seg-done) > ul:last-child > li:last-child::after, .dia-streaming .dia-answer:not(.dia-seg-done) > ol:last-child > li:last-child::after {
    content: ""; display: inline-block; width: 7px; height: 7px; margin-inline-start: 5px; border-radius: 50%; background: var(--accent); vertical-align: 0.06em; animation: dia-breathe 1.2s ease-in-out infinite; }
  .dia-chunk-in { animation: dia-chunk 0.42s var(--ease) both; }
  .dia-think { margin: 0 0 10px; font-size: 13px; color: var(--mute); }
  .dia-think summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 4px; user-select: none; width: fit-content; }
  .dia-think summary::-webkit-details-marker { display: none; }
  .dia-think summary .dia-svg { width: 12px; height: 12px; transition: transform 0.2s; transform: rotate(-90deg); }
  .dia-think[open] summary .dia-svg { transform: none; }
  .dia-think-body { margin-top: 6px; padding-inline-start: 12px; border-inline-start: 2px solid var(--line); white-space: pre-wrap; max-height: 180px; overflow-y: auto; scrollbar-width: thin; }

  /* the agent's activity, shown the way Dia does it: ONE compact pill for whatever it is doing right now (Reading 1
     attachment, Searching the web…, or three dots while it thinks). When a step is finished it settles into a muted line
     ("Read 1 attachment"). Click either to open the full list of steps; click again to minimise it. */
  .dia-progress { position: relative; flex: none; height: 2px; margin: 0 18px; border-radius: 2px; overflow: hidden; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
  .dia-progress::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; border-radius: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: dia-sweep 1.4s cubic-bezier(0.45, 0, 0.25, 1) infinite; }
  .dia-working .dia-progress { opacity: 1; }
  .dia-working .dia-composer { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
  .dia-send { position: relative; }
  .dia-working .dia-send::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid transparent; border-top-color: var(--accent); border-right-color: color-mix(in srgb, var(--accent) 35%, transparent); animation: dia-spin 0.9s linear infinite; pointer-events: none; }
  .dia-flow { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 0 0 10px; font-size: 13.5px; line-height: 18px; color: var(--mute); }
  .dia-flow[hidden] { display: none; }
  .dia-flow-sum { appearance: none; border: 0; background: transparent; display: flex; align-items: center; gap: 7px; max-width: 100%; padding: 2px 6px 2px 0; border-radius: 8px; cursor: pointer; color: inherit; font: inherit; font-weight: 500; line-height: 18px; animation: dia-step-in 0.3s var(--ease) both; }
  .dia-flow-sum[hidden] { display: none; }
  .dia-flow-sum:hover { color: var(--fg); }
  .dia-flow-sum > .dia-sum-ico { display: flex; flex: none; }
  .dia-flow-sum .dia-svg { width: 14px; height: 14px; flex: none; }
  .dia-flow-sum .dia-chev { width: 12px; height: 12px; opacity: 0.5; transform: rotate(-90deg); transition: transform 0.25s var(--ease), opacity 0.15s; }
  .dia-flow-sum:hover .dia-chev { opacity: 1; }
  .dia-flow.dia-open .dia-flow-sum .dia-chev { transform: none; opacity: 1; }
  .dia-flow-sumtext { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .dia-flow-pill { appearance: none; border: 0; display: inline-flex; align-items: center; gap: 9px; max-width: 100%; box-sizing: border-box; padding: 8px 15px 8px 11px; border-radius: 999px; background: var(--glass); color: var(--mute); cursor: pointer; font: inherit; font-size: var(--dia-fs, 14px); line-height: 20px; transition: background-color 0.15s; }
  .dia-flow-pill[hidden], .dia-flow.dia-open .dia-flow-pill { display: none; }
  .dia-flow-pill:hover { background: color-mix(in srgb, var(--fg) 17%, transparent); }
  .dia-flow-pill.dia-pill-pop { animation: dia-pill-in 0.3s var(--ease) both; }
  .dia-pill-ico { display: flex; flex: none; }
  .dia-pill-ico .dia-svg { width: 16px; height: 16px; }
  .dia-pill-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-pill-time { flex: none; font-size: 12px; font-variant-numeric: tabular-nums; opacity: 0.7; }
  .dia-pill-time:empty { display: none; }
  .dia-favs { display: flex; flex: none; padding-inline-start: 7px; }
  .dia-favs img { width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; margin-inline-start: -7px; border: 2px solid color-mix(in srgb, var(--fg) 14%, #202226); background: #fff; object-fit: contain; animation: dia-pop 0.3s var(--ease) both; }
  .dia-dots { display: inline-flex; align-items: center; gap: 5px; padding: 6px 4px; }
  .dia-dots i { display: block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: dia-wave 1.2s ease-in-out infinite; }
  .dia-dots i:nth-child(2) { animation-delay: 0.15s; }
  .dia-dots i:nth-child(3) { animation-delay: 0.3s; }
  /* the full list of steps, opened on demand */
  .dia-flow-body { display: grid; grid-template-rows: 0fr; width: 100%; transition: grid-template-rows 0.32s var(--ease); }
  .dia-flow.dia-open .dia-flow-body { grid-template-rows: 1fr; }
  .dia-flow-list { min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 8px; }
  .dia-flow.dia-open .dia-flow-list { padding: 2px 0 2px 2px; }
  .dia-step { display: flex; align-items: flex-start; gap: 9px; animation: dia-step-in 0.34s var(--ease) both; }
  .dia-step-ico { flex: none; width: 16px; height: 18px; display: grid; place-items: center; }
  .dia-step-ico .dia-svg { width: 14px; height: 14px; stroke-width: 2.2; }
  .dia-step.dia-done .dia-step-ico { color: var(--accent); }
  .dia-step.dia-done .dia-step-ico .dia-svg path { stroke-dasharray: 22; stroke-dashoffset: 22; animation: dia-draw 0.4s var(--ease) 0.04s forwards; }
  .dia-step.dia-fail .dia-step-ico { color: var(--danger); }
  .dia-step.dia-stopped .dia-step-ico { color: var(--mute); }
  .dia-spin { display: block; width: 12px; height: 12px; box-sizing: border-box; border-radius: 50%; border: 1.8px solid color-mix(in srgb, var(--accent) 24%, transparent); border-top-color: var(--accent); animation: dia-spin 0.8s linear infinite; }
  .dia-step-main { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .dia-step-label { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .dia-step-text { min-width: 0; overflow-wrap: anywhere; }
  .dia-step-time { flex: none; font-size: 12px; font-variant-numeric: tabular-nums; opacity: 0.7; }
  .dia-step.dia-done .dia-step-text, .dia-step.dia-stopped .dia-step-text { color: var(--mute); }
  .dia-step.dia-fail .dia-step-text { color: var(--danger); }
  /* whatever is running carries a light sweep across its text, so nothing ever looks frozen */
  .dia-step.dia-active .dia-step-text, .dia-pill-text, .dia-think.dia-live summary span {
    background: linear-gradient(100deg, var(--mute) 32%, var(--fg) 50%, var(--mute) 68%) 100% 0 / 260% 100% no-repeat;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; animation: dia-shimmer 1.7s linear infinite; }
  .dia-step-chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .dia-step-chips:empty { display: none; }
  .dia-chipsrc { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 2px 8px 2px 6px; border-radius: 9px; background: var(--soft); font-size: 12px; color: var(--fg); animation: dia-step-in 0.3s var(--ease) both; transition: opacity 0.2s; }
  .dia-chipsrc img { width: 13px; height: 13px; border-radius: 3px; flex: none; }
  .dia-chipsrc > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px; }
  .dia-chipsrc > i { flex: none; width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--accent) 28%, transparent); border-top-color: var(--accent); animation: dia-spin 0.8s linear infinite; }
  .dia-chipsrc.dia-ok > i { border: 0; background: var(--accent); animation: dia-pop 0.3s var(--ease); }
  .dia-chipsrc.dia-bad { opacity: 0.55; }
  .dia-chipsrc.dia-bad > span { text-decoration: line-through; }
  .dia-chipsrc.dia-bad > i { border: 0; background: var(--danger); animation: none; }

  .dia-actions { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 8px; margin-inline-start: -8px; animation: dia-fade 0.4s ease both; }
  .dia-mini { appearance: none; background: transparent; border: 0; cursor: pointer; font-size: 12px; padding: 3px 8px; border-radius: 8px; color: var(--mute); display: inline-flex; align-items: center; gap: 5px; transition: background-color 0.15s, color 0.15s; }
  .dia-mini .dia-svg { width: 13px; height: 13px; }
  .dia-mini:hover { color: var(--fg); background: var(--soft); }
  .dia-btn { appearance: none; cursor: pointer; border-radius: 10px; padding: 6px 14px; border: 1px solid var(--line); background: var(--card); font-size: 13px; transition: background-color 0.15s; }
  .dia-btn:hover { background: var(--soft); }
  .dia-btn.dia-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
  .dia-btn.dia-primary:hover { opacity: 0.88; }
  .dia-btn[disabled] { opacity: 0.4; cursor: default; }

  /* tab-management proposal */
  .dia-act { margin-top: 12px; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; background: var(--card); }
  .dia-act ul { margin: 0 0 10px; padding-inline-start: 18px; } .dia-act li { margin: 0 0 3px; }
  .dia-act-row { display: flex; gap: 6px; align-items: center; }

  /* composer, like Dia: one big rounded card with context cards, the box, and attachment/search controls */
  .dia-foot { flex: none; padding: 6px 14px 14px; }
  .dia-composer { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 12px 12px 10px 14px; border: 1px solid var(--line); border-radius: 26px; background: var(--glass); backdrop-filter: blur(14px); transition: border-color 0.2s; }
  .dia-composer:focus-within { border-color: color-mix(in srgb, var(--fg) 28%, transparent); }
  .dia-cards { display: flex; flex-wrap: wrap; gap: 8px; max-height: min(196px, 24vh); overflow-y: auto; scrollbar-width: thin; padding: 8px 8px 0 0; margin: -8px -8px 0 0; }
  .dia-cards:empty { display: none; }
  .dia-card { position: relative; display: flex; align-items: center; gap: 12px; max-width: 100%; box-sizing: border-box; padding: 8px 36px 8px 8px; border-radius: 16px; background: var(--glass); animation: dia-in 0.25s var(--ease) both; }
  .dia-card-static { padding-right: 10px; }
  .dia-card.dia-off { opacity: 0.48; filter: grayscale(1); background: color-mix(in srgb, #858585 14%, var(--glass)); }
  .dia-card.dia-page-toggle { transition: opacity 0.15s, filter 0.15s, background-color 0.15s; }
  /* the page you are on: a small round minimise button on the chip's corner (hover), instead of an X. Minimising leaves the
     page out of the first message (the chip greys out); the button then becomes a plus that puts it back. */
  .dia-card.dia-page-toggle { padding-right: 12px; }
  .dia-page-min { position: absolute; top: -7px; right: -7px; z-index: 1; appearance: none; border: 0; padding: 0; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
    background: var(--fg); color: var(--on-accent, #fff); box-shadow: 0 1px 5px rgba(0, 0, 0, 0.35); opacity: 0; transform: scale(0.8); transition: opacity 0.15s, transform 0.15s var(--ease); }
  .dia-page-min .dia-svg { width: 11px; height: 11px; stroke-width: 2.4; }
  .dia-card:hover .dia-page-min, .dia-page-min:focus-visible, .dia-card.dia-off .dia-page-min { opacity: 1; transform: none; }
  .dia-page-min:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .dia-card-thumb { width: 38px; height: 48px; flex: none; border-radius: 9px; overflow: hidden; display: grid; place-items: center; background: var(--soft2); color: var(--mute); }
  .dia-card-thumb img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .dia-card-thumb img.dia-card-fav { width: 20px; height: 20px; object-fit: contain; border-radius: 4px; }
  .dia-card-text { min-width: 0; display: flex; flex-direction: column; justify-content: center; line-height: 1.3; }
  .dia-card-title { font-size: 14.5px; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-card-sub { font-size: 13px; color: var(--mute); }
  .dia-card-x { position: absolute; top: 6px; right: 6px; appearance: none; border: 0; background: var(--soft2); cursor: pointer; width: 20px; height: 20px; padding: 0; border-radius: 50%; display: grid; place-items: center; opacity: 0; transition: opacity 0.15s; }
  .dia-card:hover .dia-card-x { opacity: 0.9; }
  .dia-card-x:hover { opacity: 1 !important; }
  .dia-card-x .dia-svg { width: 11px; height: 11px; }
  .dia-card.dia-locked .dia-card-x { display: none; }
  .dia-pills { display: flex; flex-wrap: wrap; gap: 5px; max-height: 74px; overflow-y: auto; scrollbar-width: thin; }
  .dia-pills:empty { display: none; }
  .dia-pill { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; box-sizing: border-box; padding: 3px 4px 3px 7px; border-radius: 9px; font-size: 12px; line-height: 1.3; background: var(--soft2); animation: dia-in 0.25s var(--ease) both; }
  .dia-pill > .dia-svg { width: 13px; height: 13px; color: var(--mute); }
  .dia-pill img.dia-pill-ico { width: 14px; height: 14px; border-radius: 3px; flex: none; }
  .dia-pill img.dia-pill-thumb { width: 20px; height: 20px; border-radius: 5px; object-fit: cover; flex: none; }
  .dia-pill-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
  .dia-pill.dia-skillpill { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .dia-pill.dia-skillpill > .dia-svg { color: var(--accent); }
  .dia-pill-x { appearance: none; border: 0; background: transparent; cursor: pointer; width: 16px; height: 16px; padding: 0; border-radius: 50%; display: grid; place-items: center; opacity: 0.45; }
  .dia-pill-x:hover { opacity: 1; background: var(--soft2); }
  .dia-pill-x .dia-svg { width: 10px; height: 10px; }
  .dia-pill.dia-locked .dia-pill-x { display: none; }
  .dia-sent .dia-pill-x { display: none; }
  .dia-sent .dia-pill { padding-inline-end: 8px; }
  .dia-input, .dia-input:hover, .dia-input:focus, .dia-input:focus-visible {
    appearance: none !important; -moz-default-appearance: none !important; background: transparent !important; border: 0 !important; border-radius: 0 !important;
    outline: 0 !important; box-shadow: none !important; resize: none; width: 100%; box-sizing: border-box; color: inherit; font: inherit; font-size: calc(var(--dia-fs, 14px) + 1px);
    margin: 0; padding: 2px 0 !important; max-height: 160px; min-height: 1.7em; scrollbar-width: thin; }
  .dia-input::placeholder { color: inherit; opacity: 0.5; }
  .dia-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .dia-row-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
  .dia-row-right { display: flex; align-items: center; gap: 6px; flex: none; }
  .dia-add, .dia-cam, .dia-tabsbtn { width: 34px; height: 34px; flex: none; border-radius: 50%; }
  .dia-add .dia-svg, .dia-cam .dia-svg, .dia-tabsbtn .dia-svg { width: 20px; height: 20px; }
  .dia-tabsbtn .dia-svg { stroke-width: 1.7; }
  .dia-chip { appearance: none; border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; flex: none; padding: 5px 11px 5px 9px; border-radius: 999px; font-size: 13px; color: inherit; background: color-mix(in srgb, var(--accent) 20%, transparent); }
  .dia-chip[hidden] { display: none; }
  .dia-chip .dia-svg { width: 14px; height: 14px; color: var(--accent); }
  .dia-send { appearance: none; border: 0; cursor: pointer; flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 78%, white); color: var(--on-accent); transition: transform 0.15s var(--ease), opacity 0.15s; }
  .dia-send .dia-svg { width: 18px; height: 18px; stroke-width: 2; }
  .dia-send:not([disabled]):hover { transform: scale(1.07); }
  .dia-send:active { transform: scale(0.92); }
  .dia-send[disabled] { opacity: 0.3; cursor: default; }
  .dia-addnote { font-size: 12px; color: var(--mute); padding: 0 2px; animation: dia-fade 0.3s ease both; }
  .dia-webstatus { display: flex; align-items: center; gap: 6px; padding: 0 2px; font-size: 12px; line-height: 1.3; color: var(--accent); cursor: pointer; animation: dia-fade 0.3s ease both; }
  .dia-webstatus .dia-svg { width: 14px; height: 14px; flex: none; stroke-width: 1.8; }
  .dia-webstatus b { font-weight: 600; }
  .dia-webstatus .dia-webstatus-act { margin-left: auto; color: var(--mute); }
  .dia-webstatus:hover .dia-webstatus-act { color: var(--fg); }
  .dia-webstatus.dia-off { color: var(--mute); cursor: default; }

  /* web sources */
  .dia-sources { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: 12px; color: var(--mute); animation: dia-fade 0.4s ease both; }
  .dia-searched { display: inline-flex; align-items: center; gap: 5px; margin-inline-end: 3px; }
  .dia-searched .dia-svg { width: 13px; height: 13px; }
  .dia-src { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 3px 9px 3px 7px; border-radius: 9px; background: var(--soft); color: inherit; text-decoration: none; cursor: pointer; transition: background-color 0.15s, color 0.15s; }
  .dia-src:hover { background: var(--soft2); color: var(--fg); }
  .dia-src b { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fg); opacity: 0.7; }
  .dia-src span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
  .dia-src .dia-fav { margin: 0; }
  .dia-cite { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; margin-inline: 1px 2px; box-sizing: border-box; border-radius: 8px; background: var(--soft2); color: var(--mute); font-size: 10.5px; font-weight: 600; text-decoration: none; cursor: pointer; vertical-align: 1px; transition: background-color 0.15s, color 0.15s; }
  .dia-cite:hover { background: var(--accent); color: var(--on-accent); }

  /* drop zone: files and tabs dragged onto the sidebar */
  .dia-dropzone { position: absolute; inset: 8px; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; pointer-events: none;
    border: 1.5px dashed color-mix(in srgb, var(--accent) 60%, transparent); border-radius: 18px; background: color-mix(in srgb, var(--pop) 92%, transparent);
    backdrop-filter: blur(3px); color: var(--accent); font-weight: 550; opacity: 0; transform: scale(0.985); transition: opacity 0.18s, transform 0.25s var(--ease); }
  .dia-dropzone .dia-svg { width: 26px; height: 26px; }
  .dia-dropzone small { color: var(--mute); font-weight: 400; font-size: 12px; }
  .dia-drop .dia-dropzone { opacity: 1; transform: none; }

  /* popup menu (slash skills, @ mentions, + menu) */
  .dia-menu { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; z-index: 10; max-height: min(300px, 45vh); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding: 5px; background: var(--pop); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 14px 38px rgba(0, 0, 0, 0.28); animation: dia-in 0.2s var(--ease) both; }
  .dia-menu-sep { font-size: 11px; color: var(--mute); padding: 8px 10px 3px; letter-spacing: 0.02em; }
  .dia-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; text-align: start; appearance: none; border: 0; cursor: pointer; background: transparent; padding: 7px 10px; border-radius: 9px; font-size: 13px; }
  .dia-menu-item:hover, .dia-menu-item.dia-active { background: var(--soft); }
  .dia-menu-item > .dia-svg { color: var(--mute); }
  .dia-menu-item img.dia-menu-ico { width: 16px; height: 16px; border-radius: 4px; flex: none; }
  .dia-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-menu-sub { color: var(--mute); font-size: 11.5px; white-space: nowrap; }
  .dia-hmenu { position: absolute; top: 52px; right: 12px; z-index: 11; width: min(290px, calc(100% - 24px)); box-sizing: border-box; padding: 5px; background: var(--pop); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 14px 38px rgba(0, 0, 0, 0.28); animation: dia-in 0.18s var(--ease) both; }
  .dia-menu-choice { appearance: none; flex: 0 0 auto; width: 100%; display: flex; align-items: center; gap: 12px; box-sizing: border-box; padding: 9px 10px; text-align: start; border: 0; border-radius: 10px; color: inherit; background: transparent; cursor: pointer; font: inherit; }
  .dia-menu-choice:hover { background: var(--soft); }
  .dia-menu-choice > .dia-svg { color: var(--mute); }
  .dia-menu-choice-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .dia-menu-choice-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-menu-choice.dia-active { background: var(--soft); }
  .dia-ico-gap { width: 16px; height: 16px; flex: none; }
  .dia-menu-rule { height: 1px; margin: 4px 6px; background: var(--line); }
  .dia-hmenu.dia-mmenu { right: auto; left: 12px; width: min(330px, calc(100% - 24px)); max-height: calc(100% - 70px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
  .dia-menu-choice-sub { color: var(--mute); font-size: 12px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-head .dia-layout.dia-open { background: var(--soft); color: var(--fg); }

  /* history / skills sheet */
  .dia-sheet { position: absolute; inset: 0; z-index: 8; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: transparent; border-radius: inherit; animation: dia-in 0.25s var(--ease) both; }
  &[data-accent="neutral"] .dia-sheet, &.dia-float .dia-sheet { background: var(--panel); background-attachment: fixed; }
  .dia-sheet-head { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; padding: 12px 10px 6px 18px; font-weight: 600; font-size: 13px; }
  .dia-sheet-head span { flex: 1; }
  .dia-panel.dia-sheeted > :not(.dia-sheet):not(.dia-dropzone):not(.dia-hmenu) { visibility: hidden; } /* never let the chat show through a sheet */
  .dia-sheet-body { flex: 1 1 0%; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 2px; }
  /* tab & link picker */
  .dia-picker { display: flex; flex-direction: column; padding: 8px 8px 6px; max-height: min(440px, 64vh); overflow: hidden; }
  .dia-pk-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex: none; }
  .dia-pk-seg { display: flex; gap: 2px; padding: 2px; border-radius: 10px; background: var(--soft2); flex: none; }
  .dia-pk-seg button { appearance: none; border: 0; background: transparent; cursor: pointer; padding: 4px 11px; border-radius: 8px; font-size: 12.5px; color: var(--mute); transition: background-color 0.15s, color 0.15s; }
  .dia-pk-seg button.on { background: var(--pop); color: var(--fg); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }
  .dia-picker .dia-search { margin: 0; padding: 5px 10px; flex: 1; min-width: 0; }
  .dia-pk-chips { display: flex; gap: 6px; margin-bottom: 6px; overflow-x: auto; scrollbar-width: none; flex: none; }
  .dia-pk-chips:empty { display: none; }
  .dia-pk-chip { appearance: none; flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px 3px 8px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: inherit; cursor: pointer; font-size: 12px; transition: background-color 0.15s, color 0.15s; }
  .dia-pk-chip .dia-svg { width: 13px; height: 13px; }
  .dia-pk-chip:hover { background: var(--soft); }
  .dia-pk-chip.on { background: color-mix(in srgb, var(--accent) 18%, transparent); border-color: transparent; color: var(--accent); }
  .dia-pk-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
  .dia-pk-sec { font-size: 11px; color: var(--mute); padding: 8px 8px 3px; letter-spacing: 0.02em; }
  .dia-pk-row { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; appearance: none; border: 0; background: transparent; text-align: start; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: inherit; font: inherit; }
  .dia-pk-row:hover, .dia-pk-row.dia-active { background: var(--soft); }
  .dia-pk-row > .dia-svg { width: 16px; height: 16px; flex: none; color: var(--mute); }
  .dia-pk-fav { width: 18px; height: 18px; border-radius: 4px; flex: none; object-fit: contain; }
  .dia-pk-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .dia-pk-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-pk-sub { font-size: 11.5px; color: var(--mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-pk-check { flex: none; width: 18px; height: 18px; box-sizing: border-box; display: grid; place-items: center; border-radius: 50%; border: 1.6px solid color-mix(in srgb, var(--fg) 30%, transparent); color: transparent; transition: background-color 0.15s, border-color 0.15s, transform 0.15s var(--ease); }
  .dia-pk-check .dia-svg { width: 11px; height: 11px; stroke-width: 2.8; }
  .dia-pk-row:active .dia-pk-check { transform: scale(0.85); }
  .dia-pk-row.dia-on .dia-pk-check { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }
  .dia-pk-row.dia-loading .dia-pk-check { background: transparent; border-color: color-mix(in srgb, var(--accent) 25%, transparent); border-top-color: var(--accent); color: transparent; animation: dia-spin 0.8s linear infinite; }
  .dia-pk-empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 22px 10px; color: var(--mute); font-size: 12.5px; }
  .dia-pk-foot { display: flex; align-items: center; gap: 4px; margin-top: 6px; padding: 7px 2px 0; border-top: 1px solid var(--line); flex: none; }
  .dia-pk-count { flex: 1; font-size: 12px; color: var(--mute); padding-inline-start: 6px; }
  .dia-pk-btn { appearance: none; border: 0; background: transparent; cursor: pointer; font-size: 12.5px; color: var(--mute); padding: 4px 9px; border-radius: 8px; }
  .dia-pk-btn:hover { background: var(--soft); color: var(--fg); }
  .dia-pk-btn[hidden] { display: none; }
  .dia-pk-done, .dia-pk-done:hover { background: var(--accent); color: var(--on-accent, #fff); padding: 4px 14px; border-radius: 999px; }
  /* a card whose text is still being read */
  .dia-card-thumb { position: relative; }
  .dia-card-loading .dia-card-fav { opacity: 0.3; }
  .dia-card-spin { position: absolute; inset: 0; margin: auto; width: 18px; height: 18px; }
  .dia-card-loading .dia-card-sub { background: linear-gradient(100deg, var(--mute) 32%, var(--fg) 50%, var(--mute) 68%) 100% 0 / 260% 100% no-repeat; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; animation: dia-shimmer 1.7s linear infinite; }
  .dia-search { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; margin: 2px 12px 8px; padding: 7px 12px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); color: var(--mute); }
  .dia-search input { flex: 1; min-width: 0; border: 0 !important; outline: 0 !important; background: transparent !important; color: var(--fg); font: inherit; padding: 0 !important; }
  .dia-row-item { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 10px; border-radius: 12px; cursor: pointer; }
  .dia-row-item:hover { background: var(--soft); }
  .dia-row-main { flex: 1; min-width: 0; }
  .dia-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-row-sub { font-size: 12px; color: var(--mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-row-item .dia-icon { opacity: 0; width: 26px; height: 26px; }
  .dia-row-item:hover .dia-icon { opacity: 1; }
  .dia-empty-note { color: var(--mute); text-align: center; padding: 28px 10px; }
  .dia-form { display: flex; flex-direction: column; gap: 8px; padding: 4px 2px 8px; }
  .dia-form label { font-size: 12px; color: var(--mute); }
  .dia-form input, .dia-form textarea { font: inherit; color: inherit; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); outline: 0; resize: vertical; width: 100%; box-sizing: border-box; }
  .dia-form input:focus, .dia-form textarea:focus { border-color: color-mix(in srgb, var(--fg) 30%, transparent); }
  .dia-form textarea { min-height: 100px; }
  .dia-form input[type="checkbox"] { width: 16px; height: 16px; padding: 0; margin: 0; flex: none; accent-color: var(--accent); }
  .dia-form label.dia-check { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--fg); line-height: 1.4; }
  .dia-form label.dia-check input { margin-top: 1px; }
  .dia-found { display: flex; flex-wrap: wrap; gap: 6px; }
  .dia-found:empty, .dia-form .dia-note:empty { display: none; }
  .dia-eff { padding: 8px 10px 6px; }
  .dia-eff-top { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  .dia-eff-val { color: var(--accent); }
  .dia-eff-range { display: block; width: 100%; margin: 0; padding: 0; accent-color: var(--accent); cursor: pointer; }
  .dia-eff-ticks { display: flex; justify-content: space-between; margin-top: 3px; font-size: 11px; color: var(--mute); }
  .dia-eff-hint { margin-top: 6px; min-height: 2.8em; font-size: 12px; line-height: 1.4; color: var(--mute); }
  .dia-onb { gap: 12px; }
  .dia-onb-hero { margin: 4px 2px 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
  .dia-onb-sub { margin: 0 2px; font-size: 13px; line-height: 1.5; color: var(--mute); }
  .dia-onb-list { display: grid; gap: 10px; margin: 4px 2px; padding: 0; list-style: none; font-size: 13.5px; line-height: 1.45; }
  .dia-onb-card { appearance: none; display: flex; flex-direction: column; gap: 3px; width: 100%; box-sizing: border-box; padding: 12px 14px; text-align: start; border: 1px solid var(--line); border-radius: 14px; background: var(--card); color: inherit; font: inherit; cursor: pointer; transition: background-color 0.15s, border-color 0.15s; }
  .dia-onb-card:hover { background: var(--soft); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
  .dia-onb-card b { font-size: 14px; }
  .dia-onb-card span { font-size: 12.5px; line-height: 1.4; color: var(--mute); }
  .dia-onb-steps { display: flex; justify-content: center; gap: 5px; }
  .dia-onb-steps i { width: 6px; height: 6px; border-radius: 50%; background: var(--soft2); }
  .dia-onb-steps i.on { background: var(--accent); }
  .dia-seg { display: flex; flex-wrap: wrap; gap: 6px; }
  .dia-seg .dia-chip.on { background: var(--accent); color: var(--on-accent); }
  .dia-found .dia-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; }
}

@keyframes dia-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes dia-slide { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
@keyframes dia-slide-l { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: none; } }
@keyframes dia-chunk { from { opacity: 0; filter: blur(2px); } to { opacity: 1; filter: blur(0); } }
@keyframes dia-breathe { 0%, 100% { opacity: 0.35; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1); } }
@keyframes dia-spin { to { transform: rotate(1turn); } }
@keyframes dia-sweep { from { transform: translateX(-100%); } to { transform: translateX(270%); } }
@keyframes dia-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@keyframes dia-step-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes dia-draw { to { stroke-dashoffset: 0; } }
@keyframes dia-pop { from { transform: scale(0.3); } 60% { transform: scale(1.35); } to { transform: scale(1); } }
@keyframes dia-wave { 0%, 60%, 100% { opacity: 0.35; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
@keyframes dia-pill-in { from { opacity: 0; transform: translateY(5px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes dia-fade { from { opacity: 0; } to { opacity: 1; } }
/* the chat button inside the URL bar (in Zen, the URL bar sits at the top of the left sidebar).
   Icon: Ionicons "chatbubble-ellipses" (MIT), the glyph Zen ships for its own chat icon.
   It is drawn as a mask filled with Zen's toolbar text colour (white in dark spaces), so it does not depend on
   context-fill working, and it can't pick up any other colour. Hidden until you hover the URL bar. */
#dia-sidebar-urlbar { margin-inline: 1px; }
#dia-sidebar-urlbar:not([open]) { opacity: 0; transition: opacity 0.15s; }
#urlbar:hover #dia-sidebar-urlbar, #urlbar[focused] #dia-sidebar-urlbar, #dia-sidebar-urlbar:hover, #dia-sidebar-urlbar[open] { opacity: 1; }
#dia-sidebar-urlbar .urlbar-icon {
  list-style-image: none !important;
  width: 16px; height: 16px; box-sizing: border-box;
  background-color: var(--toolbar-color, currentColor) !important;
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='black'%3E%3Cpath d='M 398,81.84 A 227.4,227.4 0 0 0 255.82,32 C 194.9,32 138,55.47 95.46,98.09 54.35,139.33 31.82,193.78 32,251.37 a 215.66,215.66 0 0 0 35.65,118.76 l 0.19,0.27 c 0.28,0.41 0.57,0.82 0.86,1.22 0.29,0.4 0.65,0.92 0.73,1.05 l 0.22,0.4 c 1.13,2 2,4.44 1.23,6.9 l -18.42,66.66 a 29.13,29.13 0 0 0 -1.2,7.63 25.69,25.69 0 0 0 25.57,25.74 29.44,29.44 0 0 0 10.45,-2.29 l 67.49,-24.36 0.85,-0.33 a 14.75,14.75 0 0 1 5.8,-1.15 15.12,15.12 0 0 1 5.37,1 c 1.62,0.63 16.33,6.26 31.85,10.6 12.9,3.6 39.74,9 60.77,9 59.65,0 115.35,-23.1 156.83,-65.06 C 457.36,365.77 480,310.42 480,251.49 a 213.5,213.5 0 0 0 -4.78,-45 C 464.88,157.87 437.46,113.59 398,81.84 Z M 87.48,380 Z M 160,288 a 32,32 0 1 1 32,-32 32,32 0 0 1 -32,32 z m 96,0 a 32,32 0 1 1 32,-32 32,32 0 0 1 -32,32 z m 96,0 a 32,32 0 1 1 32,-32 32,32 0 0 1 -32,32 z'/%3E%3C/svg%3E"); mask-repeat: no-repeat; mask-position: center; mask-size: 16px 16px;
  opacity: 0.9; transition: opacity 0.15s;
}
#dia-sidebar-urlbar:hover .urlbar-icon, #dia-sidebar-urlbar[open] .urlbar-icon { opacity: 1; }
/* while the sidebar is open: a neutral highlight behind the (still white) icon */
#dia-sidebar-urlbar[open] { background-color: color-mix(in srgb, var(--toolbar-color, currentColor) 14%, transparent); border-radius: var(--urlbar-icon-border-radius, 6px); }
#dia-sidebar-urlbar[disabled] .urlbar-icon { opacity: 0.3 !important; }
#dia-sidebar-urlbar[nudge] { animation: dia-nudge 0.35s; }
@keyframes dia-nudge { 20%, 60% { transform: translateX(-2px); } 40%, 80% { transform: translateX(2px); } }
@media (prefers-reduced-motion: reduce) {
  #dia-dock, #dia-dock * { animation-duration: 1ms !important; animation-delay: 0s !important; transition-duration: 1ms !important; }
  #dia-dock .dia-spin, #dia-dock .dia-chipsrc > i, #dia-dock .dia-dots i, #dia-dock .dia-progress::before, #dia-dock .dia-send::after, #dia-dock .dia-streaming .dia-answer *::after { animation: none !important; }
  #dia-dock .dia-step.dia-active .dia-step-text, #dia-dock .dia-pill-text, #dia-dock .dia-think.dia-live summary span { animation: none !important; background: none !important; -webkit-text-fill-color: currentColor; color: var(--fg); }
}
`;

  // A "page" is a real web page in the tab. A new tab, a blank tab or a browser-internal page isn't one, and the
  // sidebar can't be opened there.
  const tabHasPage = (t) => {
    try { return /^https?$/.test(t?.linkedBrowser?.currentURI?.scheme || "") && !t.hasAttribute?.("zen-empty-tab"); } catch { return false; }
  };
  const IS_MAC = navigator.platform.startsWith("Mac");
  const SHORTCUT = IS_MAC ? "⌘E" : "Ctrl+E";
  const isToggleKey = (e) =>
    e.code === "KeyE" && !e.altKey && !e.shiftKey &&
    (IS_MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey);

  window.__diaSidebar?.destroy();
  // Each load of the script in this window gets a number; only the newest copy may act, so a copy
  // that never finished starting up can't open a second sidebar when you press the shortcut.
  const COPY = (window.__diaSidebarCopy = (window.__diaSidebarCopy || 0) + 1);
  const stale = () => window.__diaSidebarCopy !== COPY;
  for (const p of document.querySelectorAll("#dia-dock")) p.remove();

  // ---------- prefs ----------
  const pref = (k, d) => {
    try { return Services.prefs.getStringPref(PREF + k, d) || d; } catch { return d; }
  };
  const setPref = (k, v) => { try { Services.prefs.setStringPref(PREF + k, String(v)); } catch {} };
  // checkboxes in Sine's settings are real booleans
  const bool = (k, d) => { try { return Services.prefs.getBoolPref(PREF + k); } catch { return d; } };
  // ---------- models ----------
  // Apple Intelligence (AFM Server) is built in and uses the address/key in Sine's settings. Any number of other
  // OpenAI-compatible models (Ollama, LM Studio, OpenRouter, OpenAI…) can be added from the model menu; they live in
  // the profile folder and you switch between them from the sidebar header.
  const DEFAULT_BASE = "http://127.0.0.1:11435/v1";
  const normBase = (u) => String(u || "").trim().replace(/\/+$/, "").replace(/^(https?:\/\/[^/]+)$/, "$1/v1");
  const builtinModel = () => ({
    id: "apple", name: "Apple Intelligence", model: "apple.local", builtin: true, small: true, vision: false,
    base: normBase(pref("server", "") || pref("applebase", "") || DEFAULT_BASE),
    key: pref("apikey", "").trim(),
  });
  const allModels = () => [builtinModel(), ...store.models().map((m) => ({ ...m, base: normBase(m.base) }))];
  const activeModel = () => { const id = pref("activemodel", "apple"); return allModels().find((m) => m.id === id) || builtinModel(); };
  // "apple" = the small-context prompt layout (one flattened turn, tight caps); "openai" = normal multi-turn chat
  const provider = () => {
    const m = activeModel();
    return m.type === "gemini" ? "gemini" : m.type === "anthropic" ? "anthropic" : m.small ? "apple" : "openai";
  };
  const geminiLabel = (id) => ({ flash: "Newest Flash (fast)", pro: "Newest Pro (smartest)", "flash-lite": "Newest Flash-Lite (cheapest)" })[id] || id;
  const modelSub = (m) => m.builtin ? `${m.model} · on this Mac` : m.type === "gemini" ? `${geminiLabel(m.model)} · Google` : `${m.model} · ${hostOf(m.base) || m.base}`;
  const apiKey = () => (activeModel().key || "").trim();
  const baseUrl = () => activeModel().base;
  const model = () => activeModel().model;
  const isNative = () => provider() === "anthropic" || provider() === "gemini"; // has its own web-search tool and reads PDFs natively
  const rawPdf = () => isNative(); // models that read PDF bytes directly
  // servers on this machine or your network: no Origin header (some local servers reject it) and no key needed
  const LOCAL_RE = /^https?:\/\/(localhost(?=[:/]|$)|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/:]+\.local(?=[:/]|$))/i;
  const isLocal = () => provider() === "apple" || LOCAL_RE.test(baseUrl());
  const llmReady = () => isNative() ? !!apiKey() : provider() === "apple" || !!apiKey() || isLocal();
  // Keep page text small for Apple's fixed 4,096-token on-device context window.
  // small on-device model: leave room inside a 4,096-token window; Gemini can take the whole page
  const chunkSize = () => (isNative() ? MAX_CHARS * 2 : provider() === "apple" ? 4200 : 16000);
  // ---------- effort ----------
  // The slider in the sidebar's model menu. Higher effort = fuller answers and more work per answer: thinking for
  // models that support it and, for the small on-device model, a multi-step read of the whole page.
  const effort = () => Math.min(4, Math.max(1, parseInt(pref("effort", "2"), 10) || 2));
  const EFFORT_NAMES = ["Low", "Medium", "High", "Max"];
  const thinkBudget = () => (isNative() ? [0, 1024, 8192, 24576][effort() - 1] : 0);
  const reasoningEffort = () => ["low", "medium", "high", "high"][effort() - 1];
  // The internet is only ever searched when the globe is on for that message (or @Web). Without it the assistant works from
  // the page that is already loaded and the links on that page, nothing else. (The old Automatic / Only when I ask / Off
  // setting is gone: it is always "manual" now, whatever an older version saved.)
  const webMode = () => "manual";
  // "own": the assistant writes the query from the conversation, searches, reads the pages and answers from them (any model).
  // "builtin": Gemini/Claude run their own search tool, which picks its own queries.
  const ownSearch = () => pref("searchmode", "own") !== "builtin";
  // if Anthropic/Gemini reject their built-in search tool (plan, region, model), we search from the browser instead
  const searchBroken = new Set(); // providers whose built-in search tool was refused (remembered per provider)
  // messages that are clearly about live / outside information search even if the model wouldn't have chosen to
  const WEB_HINT = /\b(latest|newest|currently|right now|today|tonight|tomorrow|yesterday|this (week|weekend|month|year)|news|headlines?|breaking|price of|how much (is|does|are|do)|cost of|weather|forecast|score|standings|who won|who is the (ceo|president|prime minister|founder)|release date|when (is|does|did|will)|stock|exchange rate|trending|near me|open now|search (the )?(web|online|for)|look (it |this |that |them )?up|google|find (it |this |that )?(out|online))\b|\b20(2[4-9]|3\d)\b/i;
  const ABOUT_PAGE = /\b(this|the|that) (page|article|video|post|site|text|document|paper|thread|email|tab)\b|\bsummari[sz]e\b|\bproofread\b|\btranslate\b/i;
  const WANTS_PAGE_LINKS = /\b(?:search|look through|check|follow|open|read|find|browse)\b.{0,70}\b(?:links?|hyperlinks?)\b|\b(?:links?|hyperlinks?)\b.{0,70}\b(?:embedded|on|in|from|within|inside)\b.{0,40}\b(?:page|site|website|article)\b/i;
  const needsWeb = (t) => !!t && WEB_HINT.test(t) && (!ABOUT_PAGE.test(t) || /\b(search|look up|google|online)\b/i.test(t));
  const keepHistory = () => bool("history", pref("savehistory", "true") !== "false");
  // Search provider settings. Google and DuckDuckGo need no API key; configured providers are
  // tried as fallbacks when an endpoint is unavailable or rate-limited.
  const searchEngine = () => ["duckduckgo", "google", "brave", "searxng"].includes(pref("searchengine", "duckduckgo")) ? pref("searchengine", "duckduckgo") : "duckduckgo";
  const searchSetup = (eng) => (eng === "brave" ? pref("searchkey", "") : pref("searxurl", "")).trim() || pref("searchsetup", "").trim();
  const STYLES = [
    "", // Low: the base prompt is already brief
    "Give balanced answers: clear and complete without padding (this overrides the instruction to be brief).",
    "Give thorough, well-structured answers with the relevant detail and context (this overrides the instruction to be brief).",
    "Give thorough, well-structured answers with the relevant detail and context (this overrides the instruction to be brief). Work through the question carefully and check your answer against the page and any sources before you reply.",
  ];
  // Apple Intelligence talks like a normal chatbot: friendly flowing paragraphs, no bullet lists, and more detail the higher
  // the effort. (Other models keep the concise, structured style above.)
  const APPLE_SYSTEM =
    "You are a friendly AI assistant living in a sidebar next to the web page the user is viewing. " +
    "Talk the way a good chatbot does in a normal conversation: warm, natural, plain language, in full sentences and short paragraphs, like a knowledgeable friend explaining something. " +
    "Use the page content and anything the user attached. Start with the actual answer, then give the useful context. " +
    "Write in flowing paragraphs: do not use bullet points, numbered lists, headings or tables unless the user clearly asks for a list, steps or a table. " +
    "Bold at most a key term or two. If the page does not contain the answer, say so plainly and then say what you can. Never make up details.";
  const APPLE_STYLES = [
    "Keep it short: one or two friendly sentences.",
    "Answer in one or two short, natural paragraphs.",
    "Give a full, detailed answer the way a thorough chatbot would: several natural paragraphs that explain the key points and why they matter, add useful context, and give an example where it helps. Don't be brief, and don't turn it into a list.",
    "Give a full, detailed answer the way a thorough chatbot would: several natural paragraphs that explain the key points and why they matter, add useful context, and give an example where it helps. Check what you say against the page and any sources, and mention anything the page doesn't cover. Don't be brief, and don't turn it into a list.",
  ];
  // the built-in prompts ask for bullets; on Apple Intelligence they ask for a friendly summary instead
  const chatty = (s) => s
    .replace(/Summarize this page into concise bullet points\./, "Give me a friendly summary of this page.")
    .replace(/Summarize this video in 5-7 concise bullet points\./, "Give me a friendly summary of this video.")
    .replace(/Answer in a few concise bullet(?:s| points)( with no timestamps)?\./, (m, ts) => "Talk me through them conversationally" + (ts ? ", with no timestamps." : "."))
    .replace(/\b(?:in )?(?:\d+-\d+ |a few )?concise bullet(?:ed)? points?\b/gi, "in a few friendly paragraphs");
  const systemPrompt = () => {
    const apple = provider() === "apple";
    let s = apple ? APPLE_SYSTEM : SYSTEM;
    const style = (apple ? APPLE_STYLES : STYLES)[effort() - 1];
    if (style) s += "\n\n" + style;
    const lang = pref("language", "").trim();
    if (lang) s += `\n\nAlways reply in ${lang}, whatever language the page or the question is in.`;
    const extra = pref("instructions", "").trim();
    return s + (extra ? "\n\nThe user's standing instructions for how you respond:\n" + extra : "");
  };
  const canSeeFiles = () => !!activeModel().vision; // only models marked "Can read images" get image attachments
  const textOnlyNote = () => `${activeModel().name} is text-only; image contents won't be analyzed.`;

  // ---------- DOM helpers ----------
  const h = (tag, props = {}, ...kids) => {
    const el = document.createElementNS(NS, tag);
    Object.assign(el, props);
    el.append(...kids);
    return el;
  };
  const icon = (name) => {
    const s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 16 16");
    s.setAttribute("class", FILLED.has(name) ? "dia-svg dia-svg-fill" : "dia-svg");
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", ICONS[name] || "");
    s.append(p);
    return s;
  };
  const copyText = (t) => {
    try { Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(t); } catch {}
  };
  const timeAgo = (ts) => {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const hr = Math.round(m / 60);
    if (hr < 24) return hr + "h ago";
    const d = Math.round(hr / 24);
    return d < 30 ? d + "d ago" : new Date(ts).toLocaleDateString();
  };
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

  const styleEl = h("style", { id: "dia-style", textContent: CSS });
  document.documentElement.append(styleEl);

  // ---------- profile storage: chat history + your own Skills (plain JSON next to prefs.js) ----------
  const store = (() => {
    const file = (n) => PathUtils.join(PathUtils.profileDir, n);
    const FC = "dia-sidebar-chats.json", FS = "dia-sidebar-skills.json", FM = "dia-sidebar-models.json";
    const read = async (n, d) => { try { return (await IOUtils.readJSON(file(n))) || d; } catch { return d; } };
    let skills = [], models = [];
    return {
      skills: () => skills,
      models: () => models,
      async load() { skills = await read(FS, []); const m = await read(FM, []); models = Array.isArray(m) ? m.filter((x) => x && x.id && x.base && x.model) : []; },
      async saveModels(list) {
        models = list;
        try { await IOUtils.writeJSON(file(FM), list); } catch (e) { console.warn("[dia-sidebar] save models", e); }
      },
      chats: () => read(FC, []),
      async upsert(c) {
        // re-read first so two windows saving at once don't clobber each other
        const cur = await read(FC, []);
        const i = cur.findIndex((x) => x.id === c.id);
        if (i >= 0) cur[i] = c; else cur.unshift(c);
        cur.sort((a, b) => b.ts - a.ts);
        cur.length = Math.min(cur.length, 200);
        try { await IOUtils.writeJSON(file(FC), cur); } catch (e) { console.warn("[dia-sidebar] save chat", e); }
      },
      async remove(id) {
        const cur = (await read(FC, [])).filter((x) => x.id !== id);
        try { await IOUtils.writeJSON(file(FC), cur); } catch {}
      },
      async clear() { try { await IOUtils.writeJSON(file(FC), []); } catch {} },
      async saveSkills(list) {
        skills = list;
        try { await IOUtils.writeJSON(file(FS), list); } catch (e) { console.warn("[dia-sidebar] save skills", e); }
      },
    };
  })();
  store.load();
  const skillsFor = (isVid) => [...(isVid ? YT_SKILLS : SKILLS), ...store.skills().map((s) => ({ ...s, custom: true }))];

  // ---------- Office files (.docx/.pptx/.xlsx are zips of XML) ----------
  async function unzipEntries(buf, want) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("not a zip file");
    const n = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const out = {};
    for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (!want(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const raw = u8.subarray(start, start + csize);
      out[name] = method === 0 ? raw
        : new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    }
    return out;
  }
  const xmlText = (u8) => new TextDecoder().decode(u8);
  const unEntity = (s) => s.replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c)).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  async function officeText(buf, name) {
    const ext = name.toLowerCase().split(".").pop();
    const files = await unzipEntries(buf, (n) => /^(word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/sharedStrings\.xml|xl\/workbook\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(n));
    if (ext === "docx") {
      const x = files["word/document.xml"];
      return x ? unEntity(xmlText(x).replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "")).trim() : "";
    }
    const byNum = (a, b) => parseInt(a.match(/\d+/g).pop(), 10) - parseInt(b.match(/\d+/g).pop(), 10);
    if (ext === "pptx") {
      return Object.keys(files).filter((n) => /slides\/slide/.test(n)).sort(byNum).map((n, i) =>
        `--- Slide ${i + 1} ---\n` + unEntity(xmlText(files[n]).replace(/<\/a:p>/g, "\n").replace(/<[^>]+>/g, "")).replace(/\n{2,}/g, "\n").trim()).join("\n\n");
    }
    if (ext === "xlsx") {
      const parse = (u8) => new DOMParser().parseFromString(xmlText(u8), "application/xml");
      const shared = files["xl/sharedStrings.xml"]
        ? [...parse(files["xl/sharedStrings.xml"]).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent).join(""))
        : [];
      const names = files["xl/workbook.xml"] ? [...parse(files["xl/workbook.xml"]).getElementsByTagName("sheet")].map((s) => s.getAttribute("name")) : [];
      let out = "";
      for (const [i, n] of Object.keys(files).filter((k) => /worksheets\/sheet/.test(k)).sort(byNum).entries()) {
        out += `--- Sheet: ${names[i] || i + 1} ---\n`;
        let rows = 0;
        for (const row of parse(files[n]).getElementsByTagName("row")) {
          if (++rows > 300) { out += "…\n"; break; }
          out += [...row.getElementsByTagName("c")].map((c) => {
            const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0]?.textContent ?? "";
            return t === "s" ? shared[+v] ?? "" : t === "inlineStr" ? c.textContent : v;
          }).join("\t") + "\n";
        }
        out += "\n";
        if (out.length > 40000) break;
      }
      return out.trim();
    }
    return "";
  }

  // ---------- page text ----------
  // Collects the links on a page WITH their meaning: anchor text, the sentence/row around the link, the heading it sits
  // under, and whether it is a reference, an outbound link, an in-site link or just navigation. Nothing is skipped just
  // because it is outside <main>, so listing pages (search results, forums, link roundups) work too.
  // IMPORTANT: this function is also stringified into a frame script, so it must not use anything outside itself.
  function extractPageLinks(doc) {
    try {
      const loc = doc.location;
      const base = loc?.href || "";
      const pageNoHash = base.replace(/#.*$/, "").replace(/\/$/, "");
      const pageHost = (loc?.hostname || "").replace(/^www\./, "");
      const main = doc.querySelector("article, main, [role=main], #mw-content-text, #content, .post, .entry-content");
      const NAV = "nav, footer, aside, [role=navigation], [role=contentinfo], [role=complementary], .navbox, .toc, #toc, .mw-editsection, .navbar, .menu, .breadcrumb, .breadcrumbs, .pagination, .sidebar";
      const REFS = ".references, .reflist, #references, .footnotes, .endnotes, .bibliography, .citation, cite, .sources, #sources, [id^=cite_note]";
      const NOISE_TEXT = /^(skip to (main )?content|sign ?in|log ?in|sign ?up|register|subscribe|share|tweet|pin it|email|print|save|reply|permalink|report|flag|hide|menu|home|top|back to top|cookies?|accept( all)?|reject( all)?|manage|privacy( policy)?|terms( of (use|service))?|contact( us)?|about( us)?|advertis\w*|more|next|previous|prev|older|newer|[«»‹›…×x])$/i;
      const NOISE_URL = /^https?:\/\/(?:[^/]+\.)?(?:facebook\.com\/(?:sharer|share|dialog)|(?:twitter|x)\.com\/(?:intent|share)|linkedin\.com\/(?:shareArticle|sharing)|pinterest\.com\/pin\/create|reddit\.com\/submit|api\.whatsapp\.com\/send|wa\.me|t\.me\/share)/i;
      const TRACK = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|ref_url|cmpid|spm|yclid|_hsenc|_hsmi)$/i;
      const found = new Map();
      let order = 0, scanned = 0, section = "";
      for (const el of doc.querySelectorAll("h1, h2, h3, a[href]")) {
        if (++scanned > 5000) break;
        if (el.localName !== "a") {
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          if (t) section = t.slice(0, 60);
          continue;
        }
        const raw = el.getAttribute("href") || "";
        if (!raw || raw[0] === "#" || /^(javascript|mailto|tel|data|blob|about|file|sms):/i.test(raw)) continue;
        let u;
        try { u = new URL(raw, base); } catch { continue; }
        if (!/^https?:$/.test(u.protocol)) continue;
        // see through the redirect wrappers sites put around outbound links
        const hn = u.hostname.replace(/^www\./, "");
        let inner = "";
        if (/^google\.[a-z.]+$/.test(hn) && u.pathname === "/url") inner = u.searchParams.get("q") || u.searchParams.get("url") || "";
        else if (/^l?m?\.facebook\.com$/.test(hn) && u.pathname.startsWith("/l.php")) inner = u.searchParams.get("u") || "";
        else if (hn === "duckduckgo.com" && u.pathname.startsWith("/l/")) inner = u.searchParams.get("uddg") || "";
        else if (hn === "out.reddit.com") inner = u.searchParams.get("url") || "";
        if (/^https?:\/\//i.test(inner)) { try { u = new URL(inner); } catch {} }
        for (const k of [...u.searchParams.keys()]) if (TRACK.test(k)) u.searchParams.delete(k);
        u.hash = "";
        const href = u.href;
        if (href.replace(/\/$/, "") === pageNoHash || NOISE_URL.test(href)) continue;

        const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        let title = text || (el.getAttribute("aria-label") || el.getAttribute("title") || el.querySelector("img[alt]")?.getAttribute("alt") || "").replace(/\s+/g, " ").trim();
        if (!title) {
          try { title = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_+]+/g, " ").trim(); } catch {}
          if (title.length < 3) title = u.hostname.replace(/^www\./, "");
        }
        title = title.slice(0, 120);
        if (title.length < 2 || NOISE_TEXT.test(title)) continue;

        const prev = found.get(href);
        if (prev) { prev.n++; if (prev.title.length < 8 && title.length > prev.title.length) prev.title = title; continue; }
        const inRefs = !!el.closest(REFS);
        const inMain = !!(main && main.contains(el));
        const navish = !inRefs && !!(el.closest(NAV) || (!main && el.closest("header, [role=banner]")));
        const external = u.hostname.replace(/^www\./, "") !== pageHost;
        const kind = inRefs ? "ref" : navish ? "nav" : external ? "out" : "in";
        const score = (kind === "ref" ? 2 : kind === "out" ? 1.5 : kind === "in" ? 1 : -1) + (inMain ? 1.5 : 0) + Math.min(title.length, 60) / 20;
        found.set(href, { title, url: href, kind, section, n: 1, order: order++, score, el, text });
      }
      // keep the 120 most useful links, then restore page order so "the third link" means what it looks like
      const picked = [...found.values()].sort((a, b) => b.score - a.score).slice(0, 120).sort((a, b) => a.order - b.order);
      return picked.map((l) => {
        let ctx = "";
        try {
          const block = l.el.closest("li, tr, article, p, dd, blockquote, figcaption, td, div") || l.el.parentElement;
          const bt = (block?.textContent || "").replace(/\s+/g, " ").trim();
          const at = l.text || l.title;
          const i = at ? bt.indexOf(at) : -1;
          ctx = i >= 0 ? (bt.length <= 260 ? bt : bt.slice(Math.max(0, i - 110), Math.min(bt.length, i + at.length + 110))) : bt.length <= 260 ? bt : "";
          if (ctx === l.title) ctx = "";
        } catch {}
        return { title: l.title, url: l.url, kind: l.kind, section: l.section, ctx, n: l.n };
      });
    } catch (e) { return []; }
  }
  function extractInContent(extractLinks) {
    const doc = content.document;
    const root = doc.querySelector("article, main, [role=main], #mw-content-text, #content") || doc.body;
    const skip = "nav, footer, aside, header, form, .navbox, .reflist, .references, .toc, #toc, .mw-editsection";
    const parts = [];
    for (const el of root.querySelectorAll("h1,h2,h3,p,li,blockquote")) {
      if (el.closest(skip)) continue;
      const t = el.textContent.replace(/\s+/g, " ").replace(/\[\d+\]/g, "").trim();
      if (t.length > 1) parts.push(t);
    }
    let text = parts.join("\n");
    if (text.length < 200) text = (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
    sendAsyncMessage("dia-sidebar:text", { title: doc.title, url: doc.location.href, text, links: extractLinks ? extractLinks(doc) : [] });
  }

  // Read the live document from browser chrome first. This avoids depending on ReaderMode, which
  // is missing from some Zen builds, and also handles pages that do not report through messageManager.
  function extractFromDocument(doc) {
    const root = doc.querySelector("article, main, [role=main], #mw-content-text, #content") || doc.body;
    if (!root) return "";
    const skip = "nav, footer, aside, header, form, .navbox, .reflist, .references, .toc, #toc, .mw-editsection";
    const parts = [];
    for (const el of root.querySelectorAll("h1,h2,h3,p,li,blockquote")) {
      if (el.closest(skip)) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").replace(/\[\d+\]/g, "").trim();
      if (t.length > 1) parts.push(t);
    }
    let text = parts.join("\n");
    if (text.length < 200) text = (root.innerText || doc.body?.innerText || root.textContent || "").replace(/\s+/g, " ").trim();
    return text;
  }

  // Runs inside the page: reports text the user selects (after mouse/keyboard selection)
  function selectionWatcher() {
    let last = "";
    const read = () => {
      let t = "";
      try { t = (content.getSelection()?.toString() || "").replace(/\s+/g, " ").trim(); } catch {}
      if (!t) { last = ""; return; }
      if (t === last) return;
      last = t;
      sendAsyncMessage("dia-sidebar:selection", { text: t.slice(0, 3000) });
    };
    addEventListener("mouseup", () => content.setTimeout(read, 40), true);
    addEventListener("keyup", () => content.setTimeout(read, 40), true);
  }

  // ---------- YouTube transcript ----------
  // On a video page the DOM text is just chrome/comments, so we read the captions instead.
  const ytId = (url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^(www|m|music)\./, "");
      if (host === "youtu.be") return (u.pathname.slice(1).match(/^[\w-]{11}/) || [])[0] || null;
      if (host !== "youtube.com") return null;
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      return m ? m[1] : null;
    } catch { return null; }
  };

  const ytTime = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0");
  };

  // Runs INSIDE the YouTube tab. Caption files are now bot-gated (pot token) and the get_transcript
  // API returns 400, but YouTube's own "Show transcript" panel still works because the page mints a
  // valid token itself. So we open that panel and read the rendered segments straight from the DOM.
  function extractYouTubeTranscript() {
    const send = (d) => sendAsyncMessage("dia-sidebar:text", d);
    const win = content.wrappedJSObject;       // the page's real window/DOM — bypasses the Xray
    const pdoc = win.document;                 //   wrapper that hides custom-element contents
    const sleep = (ms) => new Promise((r) => content.setTimeout(r, ms));
    const toArr = (nl) => { const a = []; if (nl) for (let i = 0; i < nl.length; i++) a.push(nl[i]); return a; };
    const toMs = (txt) => {
      const p = (txt || "").trim().split(":").map(Number);
      if (!p.length || p.some((n) => isNaN(n))) return 0;
      const s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] || 0);
      return s * 1000;
    };
    let hostCount = 0;
    let panelPeek = "";
    const readSegs = () => {
      let hosts = toArr(pdoc.querySelectorAll("ytd-transcript-segment-renderer, yt-transcript-segment-renderer"));
      if (!hosts.length) hosts = toArr(pdoc.querySelectorAll("[class*='transcript-segment-renderer'], [class*='transcript-segment']"));
      hostCount = hosts.length;
      // chapter headers render as separate elements between segments; map each to the segment after it
      const heads = toArr(pdoc.querySelectorAll("ytd-transcript-section-header-renderer, [class*='transcript-section-header']"));
      const headFor = new Map();
      for (const hd of heads) {
        const title = ((hd.innerText || hd.textContent) || "").replace(/\s+/g, " ").trim();
        if (!title) continue;
        const next = hosts.find((s) => hd.compareDocumentPosition(s) & 4); // first segment after the header
        if (next && !headFor.has(next)) headFor.set(next, title.slice(0, 120));
      }
      const out = [];
      for (const n of hosts) {
        const tsEl = n.querySelector(".segment-timestamp, [class*='timestamp']");
        const txEl = n.querySelector(".segment-text, [class*='segment-text']");
        let ts = ((tsEl && tsEl.textContent) || "").trim();
        let raw = ((txEl && txEl.textContent) || "").replace(/\s+/g, " ").trim();
        if (!raw) {
          // class names may have changed — fall back to the whole row and split off the timestamp
          raw = ((n.innerText || n.textContent) || "").replace(/\s+/g, " ").trim();
          const m = raw.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+([\s\S]+)$/);
          if (m) { ts = ts || m[1]; raw = m[2]; }
        }
        raw = raw.trim();
        if (raw) out.push(headFor.has(n) ? [toMs(ts), raw, headFor.get(n)] : [toMs(ts), raw]);
      }
      return out;
    };
    // DOM-tag-agnostic fallback: read the opened transcript panel's text and parse every line that
    // starts with an mm:ss timestamp. Survives YouTube renaming its segment elements.
    // Parse a transcript panel's visible text into [ms, text, chapter?] rows. Handles both layouts:
    // timestamp and text on one line ("0:04 hello"), AND timestamp on its own line with the text
    // following it. Chapter headings ("Intro", "Topic 2") also appear in the panel as lines with no
    // timestamp, sitting just BEFORE the chapter's first line. Each row takes exactly one text line;
    // any extra non-timestamp lines are held and given to the NEXT timestamp as its chapter. Gluing
    // them onto the previous row put every chapter under the previous chapter's timestamp.
    const DUR_RE = /^(\d+\s*(hours?|minutes?|seconds?|hodin[ay]?|minut[ay]?|sekund[ay]?)[,\s]*)+$/i; // a11y "4 seconds"
    const parsePanelText = (txt) => {
      const rows = [];
      let cur = null, pending = [];
      for (const raw of txt.split("\n")) {
        const line = raw.trim();
        if (!line || DUR_RE.test(line)) continue;
        const m = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.*)$/);
        if (m) {
          if (cur) rows.push(cur);
          cur = [toMs(m[1]), m[2].trim()];
          if (pending.length) { cur[2] = pending.join(" ").slice(0, 120); pending = []; }
        } else if (cur && !cur[1]) cur[1] = line; // the text line right after its timestamp
        else if (cur) pending.push(line);          // extra line → heading of the next chapter
      }
      if (cur) { if (pending.length) cur[1] = (cur[1] + " " + pending.join(" ")).trim(); rows.push(cur); }
      return rows.filter((r) => r[1]); // drop stray timestamps that never got any text
    };
    const readFromPanel = () => {
      const specific = pdoc.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
      const list = specific ? [specific] : [];
      for (const el of toArr(pdoc.querySelectorAll('ytd-engagement-panel-section-list-renderer,[class*="engagement-panel"],[class*="transcript"]'))) {
        if (el !== specific) list.push(el);
      }
      let best = [];
      for (const p of list) {
        const txt = ((p.innerText || p.textContent) || "").trim();
        if (!txt || !/\d{1,2}:\d{2}/.test(txt)) continue;
        const rows = parsePanelText(txt);
        if (!panelPeek && rows.length) panelPeek = txt.slice(0, 300);
        if (p === specific && rows.length >= 3) return rows; // the real transcript panel wins outright
        if (rows.length > best.length) best = rows;
      }
      return best.length >= 3 ? best : [];
    };
    // find the "Show transcript" button WITHOUT relying on English text — prefer the structural
    // location (description's transcript section), then fall back to a language-independent scan
    // of button/link/menu labels (covers the ⋯ actions-menu item on newer layouts)
    const WORDS = ["transcript", "přepis", "prepis", "transkript", "stenogram", "transcripción", "transcription", "trascrizione", "transkription", "文字起こし", "トランスクリプト", "字幕", "자막", "트랜스크립트", "расшифровка", "стенограма"];
    const hasWord = (el) => {
      const t = (((el.getAttribute && el.getAttribute("aria-label")) || "") + " " + (el.textContent || "")).toLowerCase();
      return WORDS.some((w) => t.includes(w));
    };
    const findBtn = () => {
      for (const s of [
        "ytd-video-description-transcript-section-renderer button",
        "ytd-video-description-transcript-section-renderer ytd-button-renderer",
        "[class*='transcript-section'] button",
        'button[aria-label*="transcript" i]',
        'button[aria-label*="přepis" i]',
      ]) { const b = pdoc.querySelector(s); if (b) return b; }
      for (const el of toArr(pdoc.querySelectorAll("button, tp-yt-paper-button, yt-button-shape button, ytd-button-renderer, a, ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model"))) {
        if (hasWord(el)) return el;
      }
      return null;
    };
    // open the ⋯ "More actions" menu (next to Like/Share) so its "Show transcript" item renders
    const openMoreMenu = () => {
      for (const s of [
        'ytd-watch-metadata #actions ytd-menu-renderer button[aria-label*="More actions" i]',
        'button[aria-label*="More actions" i]',
        'button[aria-label*="Další akce" i]',
        'button[aria-label*="その他の操作" i]',
        'button[aria-label*="더보기" i]',
        'ytd-watch-metadata ytd-menu-renderer yt-icon-button',
        '#actions ytd-menu-renderer #button',
      ]) {
        const mb = pdoc.querySelector(s);
        if (mb) { try { (mb.tagName === "BUTTON" ? mb : (mb.querySelector && mb.querySelector("button")) || mb).click(); } catch (e) {} return true; }
      }
      return false;
    };

    // The video's real chapter list as [[ms, title], …] — the authoritative start time of every topic.
    // Source 1: YouTube's chapter cards (ytd-macro-markers-list-item-renderer: title + time).
    // Source 2: "0:00 Intro" style lines in the description, which is where chapters come from.
    const readChapters = () => {
      const valid = (list) => {
        const seen = new Set(), out = [];
        for (const c of list) if (c[1] && !seen.has(c[0])) { seen.add(c[0]); out.push(c); }
        out.sort((a, b) => a[0] - b[0]);
        return out.length >= 2 ? out : [];
      };
      try {
        const cards = toArr(pdoc.querySelectorAll("ytd-macro-markers-list-item-renderer")).map((n) => {
          const tEl = n.querySelector("#time"), hEl = n.querySelector("h4, #title, #details");
          const ts = ((tEl && (tEl.textContent || "")) || "").trim();
          const title = ((hEl && (hEl.textContent || "")) || "").replace(/\s+/g, " ").trim();
          return /^\d{1,2}:\d{2}(:\d{2})?$/.test(ts) ? [toMs(ts), title.slice(0, 120)] : null;
        }).filter(Boolean);
        const fromCards = valid(cards);
        if (fromCards.length) return fromCards;
      } catch (e) {}
      try {
        const d = pdoc.querySelector("ytd-watch-metadata #description-inline-expander, #description-inline-expander, ytd-text-inline-expander, #description");
        const txt = (d && d.textContent) || "";
        const lines = [];
        for (const raw of txt.split("\n")) {
          const m = raw.trim().match(/^[([]?(\d{1,2}:\d{2}(?::\d{2})?)[)\]]?\s*[-–—:|.]?\s*(.{2,})$/);
          if (m) lines.push([toMs(m[1]), m[2].replace(/\s+/g, " ").trim().slice(0, 120)]);
        }
        const fromDesc = valid(lines);
        if (fromDesc.length && fromDesc[0][0] === 0) return fromDesc; // real chapter lists start at 0:00
      } catch (e) {}
      return [];
    };

    (async () => {
      const info = { youtube: true, url: pdoc.location.href, title: (pdoc.title || "").replace(/\s*[-–—]\s*YouTube\s*$/, "") };
      try {
        try {
          const vd = (win.ytInitialPlayerResponse || {}).videoDetails || {};
          if (vd.title) info.title = vd.title;
          info.author = vd.author || "";
          info.seconds = +vd.lengthSeconds || 0;
        } catch (e) {}

        let segs = readSegs();
        if (!segs.length) segs = readFromPanel();
        if (!segs.length) {
          // expand the description so its transcript section renders (scope to the description's own
          // "…more"/"…více" expander so we don't accidentally hit a comment's expander)
          for (const sel of ["ytd-watch-metadata #expand", "#description #expand", "#description-inline-expander #expand", "ytd-text-inline-expander #expand", "tp-yt-paper-button#expand"]) {
            const ex = pdoc.querySelector(sel);
            if (ex) { try { ex.click(); } catch (e) {} info.expanded = true; break; }
          }
          // wait for the transcript button to render, then click the actual <button> inside it
          let btn = null;
          for (let i = 0; i < 20 && !btn; i++) { btn = findBtn(); if (!btn) await sleep(250); }
          // newer layouts hide "Show transcript" behind the ⋯ actions menu instead of the description
          if (!btn) {
            info.triedMenu = openMoreMenu();
            for (let i = 0; i < 16 && !btn; i++) { await sleep(200); btn = findBtn(); }
          }
          info.foundButton = !!btn;
          if (btn) {
            const clickIt = () => {
              const c = btn.tagName === "BUTTON" ? btn : (btn.querySelector && btn.querySelector("button")) || btn;
              try { c.click(); } catch (e) {}
            };
            clickIt();
            // read via the segment elements first, then the panel's raw text; keep polling until the
            // transcript stops growing, so we capture the whole thing (not a half-rendered first chunk)
            let stable = 0, reclicked = false;
            for (let i = 0; i < 52; i++) {
              await sleep(250);
              let r = readSegs();
              if (!r.length) { r = readFromPanel(); if (r.length) info.viaPanel = true; }
              if (r.length > segs.length) { segs = r; stable = 0; }
              else if (segs.length && ++stable >= 3) break; // held steady ~0.75s → fully loaded
              // if, after ~2s, nothing opened at all, the first click likely didn't register — retry
              // once (but only when no transcript panel has appeared, so we never toggle an open one shut)
              if (!segs.length && !reclicked && i === 8) {
                const op = pdoc.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
                const hasRows = op && /\d{1,2}:\d{2}/.test((op.innerText || op.textContent || ""));
                if (!hasRows) { reclicked = true; btn = findBtn() || btn; clickIt(); }
              }
            }
            // tidy up: close the panel we opened
            try {
              const panel = pdoc.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
              const close = panel && panel.querySelector('button[aria-label*="Close" i], button[aria-label*="Zavřít" i], button[aria-label*="閉じる"]');
              if (close) { try { close.click(); } catch (e) {} }
            } catch (e) {}
          }
        }
        info.hostCount = hostCount;
        info.panelPeek = panelPeek;
        info.segs = segs;
        try { info.chapters = readChapters(); } catch (e) { info.chapters = []; }
        if (!segs.length) info.noPanel = true;
        send(info);
      } catch (e) {
        info.error = String((e && e.message) || e);
        send(info);
      }
    })();
  }

  async function getYouTubeTranscript(browser, pageUrl, forceStamps) {
    const mm = browser.messageManager;
    const data = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { mm.removeMessageListener(MSG, listener); reject(new Error("timeout")); }, 30000);
      const listener = (m) => { clearTimeout(timer); mm.removeMessageListener(MSG, listener); resolve(m.data); };
      mm.addMessageListener(MSG, listener);
      mm.loadFrameScript("data:application/javascript," + encodeURIComponent(`(${extractYouTubeTranscript.toString()})()`), false);
    });
    console.log("[dia-sidebar] yt transcript:", { segments: data?.segs?.length || 0, chapters: data?.chapters?.length || 0, segmentRows: data?.hostCount, foundButton: data?.foundButton, expanded: data?.expanded, triedMenu: data?.triedMenu, viaPanel: data?.viaPanel, noPanel: data?.noPanel, panelPeek: data?.panelPeek, error: data?.error });
    if (data?.error) throw new Error(data.error);
    const segs = data?.segs || [];
    if (!segs.length) {
      const e = new Error("couldn't open a transcript for this video (it may not have captions)");
      e.noCaptions = true;
      throw e;
    }
    const stamps = forceStamps || bool("ytstamps", pref("yttimestamps", "true") !== "false");
    const title = data.title || "YouTube video";
    // merge the granular ~2s caption lines into larger blocks: far less text (faster for a local
    // model) and far fewer timestamps, so a plain summary stays clean and "key moments" groups
    // naturally instead of firing a bullet every few seconds. A chapter start always opens a new
    // block (labelled with the chapter name), so each chapter keeps its own exact timestamp.
    // Real chapters (from YouTube's chapter list) win over headings guessed from the panel text.
    const chapters = (data.chapters || []).filter((c) => Array.isArray(c) && c[1]);
    // the chapter that STARTS at segment i (its first line), as [startMs, title], or undefined
    const chapterAt = (t, i) => {
      if (!chapters.length) return segs[i][2] ? [t, segs[i][2]] : undefined;
      const prev = i ? segs[i - 1][0] : -1;
      return chapters.find((c) => c[0] > prev && c[0] <= t) || (i === 0 ? chapters[0] : undefined);
    };
    const blocks = [];
    let cur = null;
    segs.forEach(([t, text], i) => {
      const ch = chapterAt(t, i);
      // a chapter block uses the chapter's exact start time, so the stamp matches YouTube's own
      if (ch) { cur = { t: Math.min(t, ch[0]), text, chapter: ch[1] }; blocks.push(cur); }
      else if (!cur || t - cur.t > 40000 || cur.text.length > 400) { cur = { t, text }; blocks.push(cur); }
      else cur.text += " " + text;
    });
    const lines = blocks.map((b) => {
      const body = (b.chapter ? `(Chapter: ${b.chapter}) ` : "") + b.text;
      return stamps ? `[${ytTime(b.t)}] ${body}` : body;
    });
    // the video's real length — used to tell the model its upper bound and to drop any
    // timestamp it invents beyond the end of the video
    const seconds = data.seconds || (blocks.length ? Math.round(blocks[blocks.length - 1].t / 1000) : 0);
    const head =
      `Video title: ${title}` +
      (data.author ? `\nChannel: ${data.author}` : "") +
      (seconds ? `\nLength: ${ytTime(seconds * 1000)} (the video ends at ${ytTime(seconds * 1000)} — no timestamp can be later than this)` : "") +
      (chapters.length && stamps
        ? `\nChapters (exact start times — a topic's timestamp is the time of ITS OWN chapter, never the one before):\n` +
          chapters.map((c) => `[${ytTime(c[0])}] ${c[1]}`).join("\n")
        : "") +
      `\n\nThis is the spoken transcript of the video` +
      (stamps ? " (each line is prefixed with its real [mm:ss] timestamp — only ever cite timestamps copied exactly from these lines)" : "") + ":\n";
    return { title, url: pageUrl, text: head + lines.join("\n"), youtube: true, seconds, chapters };
  }

  async function getPageText(browser) {
    const url = browser.currentURI.spec;
    const vid = ytId(url);
    if (vid) return getYouTubeTranscript(browser, url); // throws on no transcript (handled by caller)
    try {
      const doc = browser.contentDocument;
      const text = doc?.body ? extractFromDocument(doc) : "";
      if (text) return { title: doc.title || browser.contentTitle || "Page", url, text, links: extractPageLinks(doc) };
    } catch (e) {
      console.warn("[dia-sidebar] direct page read failed, trying messageManager", e);
    }
    try {
      const mm = browser.messageManager;
      const data = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          mm.removeMessageListener(MSG, listener);
          reject(new Error("timeout"));
        }, 4000);
        const listener = (m) => {
          clearTimeout(timer);
          mm.removeMessageListener(MSG, listener);
          resolve(m.data);
        };
        mm.addMessageListener(MSG, listener);
        mm.loadFrameScript(
          "data:application/javascript," + encodeURIComponent(`(${extractInContent.toString()})(${extractPageLinks.toString()})`),
          false
        );
      });
      if (data?.text) return data;
    } catch (e) {
      console.warn("[dia-sidebar] frame script page read failed", e);
    }
    throw new Error("Zen could not read this page's text. Try selecting the relevant text and attaching it to your message.");
  }

  // ---------- offline extractive summarizer ----------
  function extractive(text, n = 6) {
    const sents = (text.replace(/\s+/g, " ").match(/[^.!?。！？]+[.!?。！？]+/g) || [])
      .map((s) => s.trim())
      .filter((s) => s.length > 30 && s.length < 400);
    if (sents.length <= n) return sents.map((s) => "- " + s).join("\n");
    const stop = new Set(
      "the and for with that this from which who his her their has have had not but also than then into over after before are was were been its they you your".split(" ")
    );
    const words = (s) => (s.toLowerCase().match(/[\p{L}']{3,}/gu) || []).filter((w) => !stop.has(w));
    const freq = new Map();
    for (const s of sents) for (const w of words(s)) freq.set(w, (freq.get(w) || 0) + 1);
    return sents
      .map((s, i) => {
        const ws = words(s);
        const score = (ws.reduce((a, w) => a + freq.get(w), 0) / Math.sqrt(ws.length || 1)) * (i < sents.length * 0.3 ? 1.15 : 1);
        return { s, i, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .sort((a, b) => a.i - b.i)
      .map((x) => "- " + x.s)
      .join("\n");
  }

  // ---------- networking ----------
  const httpError = (status, body) => {
    let msg = String(body);
    try { const j = JSON.parse(msg); msg = (Array.isArray(j) ? j[0] : j)?.error?.message || msg; } catch {}
    return `${status} ${msg.replace(/\s+/g, " ").slice(0, 300)}` +
      (status === 401 || status === 403 ? " (check the API key / access settings of your AI server)" : "");
  };
  const httpFailure = (status, body, retryAfter) => {
    const e = new Error(httpError(status, body));
    e.status = Number(status);
    const seconds = Number(retryAfter);
    const date = Date.parse(retryAfter || "");
    if (Number.isFinite(seconds) && seconds > 0) e.retryAfterMs = seconds * 1000;
    else if (Number.isFinite(date)) e.retryAfterMs = Math.max(0, date - Date.now());
    return e;
  };
  const responseStatus = (e) => Number(e?.status || (String(e?.message || e).match(/^(\d{3})\b/) || [])[1]);
  const userFacingError = (e) => {
    const message = String(e?.message || e);
    if (responseStatus(e) === 429 && provider() === "gemini") return "Google has rate-limited this Gemini API project. Check this model's limits in Google AI Studio. If its quota is exhausted or set to zero, wait for its reset, choose a model with available quota, or enable Gemini API billing; the sidebar can't override Google's limits.";
    if (responseStatus(e) === 429) return "This model is rate-limited right now. The sidebar retried automatically. Try again shortly, switch models, or check your provider's quota.";
    return message;
  };

  // Keep both key headers for compatibility with AFM Server builds that use either name.
  const authHeaders = () =>
    apiKey() ? { authorization: `Bearer ${apiKey()}`, "x-api-key": apiKey() } : {};

  async function* fetchChunks(url, headers, body, signal) {
    const res = await fetch(url, { method: "POST", signal, headers, body });
    if (!res.ok) throw httpFailure(res.status, await res.text(), res.headers?.get?.("Retry-After"));
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield dec.decode(value, { stream: true });
    }
  }

  // Raw browser channel: unlike fetch(), it adds no Origin / Sec-Fetch-* headers, which some
  // local servers (like afm-server) may reject with 403.
  async function* channelChunks(url, headers, body, signal) {
    const { NetUtil } = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");
    let ch;
    try {
      ch = NetUtil.newChannel({ uri: url, loadUsingSystemPrincipal: true }).QueryInterface(Ci.nsIHttpChannel);
      const sis = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
      sis.setUTF8Data(body);
      ch.QueryInterface(Ci.nsIUploadChannel2).explicitSetUploadStream(sis, "application/json", -1, "POST", false);
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() !== "content-type") ch.setRequestHeader(k, v, false);
      }
    } catch (e) {
      e.channelSetup = true;
      throw e;
    }

    const queue = [];
    let wake = null, done = false, failure = null, status = 0, full = "", retryAfter = "";
    const ping = () => { wake?.(); wake = null; };
    const dec = new TextDecoder();
    const listener = {
      QueryInterface: ChromeUtils.generateQI(["nsIStreamListener", "nsIRequestObserver"]),
      onStartRequest() { try { status = ch.responseStatus; } catch {} },
      onDataAvailable(_req, stream, _offset, count) {
        const bin = NetUtil.readInputStreamToString(stream, count);
        const txt = dec.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)), { stream: true });
        full += txt;
        if (status < 400) { queue.push(txt); ping(); }
      },
      onStopRequest(_req, code) {
        try { retryAfter = ch.getResponseHeader("Retry-After"); } catch {}
        if (signal.aborted) failure = new DOMException("aborted", "AbortError");
        else if (!Components.isSuccessCode(code) && !status) failure = new TypeError("network error");
        done = true;
        ping();
      },
    };
    signal.addEventListener("abort", () => {
      try { ch.cancel(Components.results.NS_BINDING_ABORTED); } catch {}
    }, { once: true });
    try {
      ch.asyncOpen(listener);
    } catch (e) {
      e.channelSetup = true;
      throw e;
    }

    for (;;) {
      while (queue.length) yield queue.shift();
      if (done) break;
      await new Promise((r) => (wake = r));
    }
    if (failure) throw failure;
    if (status >= 400) throw httpFailure(status, full, retryAfter);
  }

  async function* chunks(url, headers, body, signal) {
    if (isLocal()) {
      try {
        yield* channelChunks(url, headers, body, signal);
        return;
      } catch (e) {
        if (!e.channelSetup) throw e;
        console.warn("[dia-sidebar] channel transport unavailable, using fetch", e);
      }
    }
    yield* fetchChunks(url, headers, body, signal);
  }

  // Providers can return a transient 429 before streaming starts. Retry with a short bounded
  // backoff, respecting Retry-After when available, then let the UI explain any remaining quota limit.
  function waitForRetry(ms, signal) {
    if (signal?.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
      const onAbort = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); reject(new DOMException("aborted", "AbortError")); };
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
  async function* resilientChunks(url, headers, body, signal, maxRetries = 1) {
    for (let attempt = 0; ; attempt++) {
      try { yield* chunks(url, headers, body, signal); return; }
      catch (e) {
        if (e.status !== 429 || attempt >= maxRetries || signal?.aborted) throw e;
        const delay = Math.min(10000, Math.max(1000, e.retryAfterMs || 1000 * 2 ** attempt));
        await waitForRetry(delay, signal);
      }
    }
  }

  // GET (used to list a server's models). Local servers go through a raw channel, like the chat requests.
  async function httpGet(url, headers = {}) {
    if (!LOCAL_RE.test(url)) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      const txt = await res.text();
      if (!res.ok) throw new Error(httpError(res.status, txt));
      return txt;
    }
    const { NetUtil } = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");
    return new Promise((resolve, reject) => {
      let ch, full = "", status = 0;
      try {
        ch = NetUtil.newChannel({ uri: url, loadUsingSystemPrincipal: true }).QueryInterface(Ci.nsIHttpChannel);
        for (const [k, v] of Object.entries(headers)) ch.setRequestHeader(k, v, false);
      } catch (e) { reject(e); return; }
      const timer = setTimeout(() => { try { ch.cancel(Components.results.NS_BINDING_ABORTED); } catch {} reject(new Error("timed out")); }, 8000);
      const dec = new TextDecoder();
      try {
        ch.asyncOpen({
          QueryInterface: ChromeUtils.generateQI(["nsIStreamListener", "nsIRequestObserver"]),
          onStartRequest() { try { status = ch.responseStatus; } catch {} },
          onDataAvailable(_r, stream, _o, count) {
            const bin = NetUtil.readInputStreamToString(stream, count);
            full += dec.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)), { stream: true });
          },
          onStopRequest(_r, code) {
            clearTimeout(timer);
            if (status >= 400) reject(new Error(httpError(status, full)));
            else if (!Components.isSuccessCode(code) && !status) reject(new TypeError("network error"));
            else resolve(full);
          },
        });
      } catch (e) { clearTimeout(timer); reject(e); }
    });
  }

  async function* sseEvents(chunkIter) {
    let buf = "";
    for await (const c of chunkIter) {
      buf += c;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try { yield JSON.parse(d); } catch {}
      }
    }
  }

  // ---------- context building ----------
  // Reduce long text to its most informative lines/sentences with a cheap local TF ranking (no
  // LLM), so a long video/page is summarized in ONE model pass instead of many slow map-reduce
  // calls. Keeps original order (and any leading [mm:ss] timestamps) so "key moments" still work.
  function condense(text, budget) {
    if (text.length <= budget) return text;
    let units = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (units.length < 6) units = (text.match(/[^.!?。！？]+[.!?。！？]+/g) || [text]).map((s) => s.trim()).filter(Boolean);
    const stop = new Set(
      "the and for with that this from which who his her their has have had not but also than then into over after before are was were been its they you your".split(" ")
    );
    const words = (s) => (s.toLowerCase().match(/[\p{L}']{3,}/gu) || []).filter((w) => !stop.has(w));
    const freq = new Map();
    for (const u of units) for (const w of words(u)) freq.set(w, (freq.get(w) || 0) + 1);
    const scored = units
      .map((u, i) => {
        const ws = words(u);
        // chapter starts are always kept: they carry the exact timestamps "key moments" relies on
        if (/^\[[\d:]+\] \(Chapter: /.test(u)) return { u, i, score: Infinity };
        return { u, i, score: ws.reduce((a, w) => a + (freq.get(w) || 0), 0) / Math.sqrt(ws.length || 1) };
      })
      .sort((a, b) => b.score - a.score);
    const picked = [];
    let used = 0;
    for (const s of scored) {
      if (used + s.u.length + 1 > budget) continue;
      picked.push(s);
      used += s.u.length + 1;
      if (used >= budget * 0.98) break;
    }
    picked.sort((a, b) => a.i - b.i);
    return picked.map((s) => s.u).join("\n");
  }

  // ---------- helpers shared by the markdown renderer ----------
  const tsToSeconds = (ts) => {
    const p = ts.split(":").map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] || 0);
  };
  const TS_RE = /\[?\b(\d{1,2}:\d{2}(?::\d{2})?)\b\]?/g;
  // open a URL from an answer in a new tab (model output is untrusted → web principal)
  function openLink(url) {
    try { openWebLinkIn(url, "tab", { triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}) }); return; } catch (e) {}
    try { gBrowser.selectedTab = gBrowser.addTab(url, { triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}) }); } catch (e) {}
  }
  function seekVideo(browser, seconds) {
    if (!browser) return;
    try { const tab = gBrowser.getTabForBrowser(browser); if (tab) gBrowser.selectedTab = tab; } catch (e) {}
    const code = `(() => { try { const v = content.document.querySelector("video.html5-main-video, video"); if (v) { v.currentTime = ${Number(seconds) || 0}; if (v.paused) v.play(); } } catch (e) {} })()`;
    try { browser.messageManager.loadFrameScript("data:application/javascript," + encodeURIComponent(code), false); } catch (e) {}
  }

  // The small model tends to give a topic the start time of the PREVIOUS chapter, because hosts
  // introduce the next topic at the end of the current one. When the video has real chapters, match
  // each bullet to the chapter it's about (by the chapter title's words) and swap in that
  // chapter's exact start time. Words shared by many titles ("hypothesis") count for less.
  function snapToChapters(text, chapters) {
    if (!chapters || chapters.length < 2) return text;
    const words = (s) => (s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
    const titleWords = chapters.map((c) => [...new Set(words(c[1]))]);
    const df = new Map();
    for (const ws of titleWords) for (const w of ws) df.set(w, (df.get(w) || 0) + 1);
    const LEAD = /^(\s*(?:[-*•]|\d+[.)])?\s*(?:\*\*)?\[?)(\d{1,2}:\d{2}(?::\d{2})?)(\]?)/;
    return text.split("\n").map((ln) => {
      const m = ln.match(LEAD);
      if (!m) return ln;
      const body = ln.slice(m[0].length).toLowerCase();
      const orig = tsToSeconds(m[2]) * 1000;
      let best = -1, bestScore = 0;
      chapters.forEach((c, i) => {
        let s = 0;
        for (const w of titleWords[i]) if (body.includes(w)) s += 1 / df.get(w);
        if (s > bestScore || (s === bestScore && s > 0 && Math.abs(c[0] - orig) < Math.abs(chapters[best][0] - orig))) { best = i; bestScore = s; }
      });
      if (best < 0 || bestScore < 0.5) return ln; // no confident match — leave the model's stamp
      return m[1] + ytTime(chapters[best][0]) + m[3] + ln.slice(m[0].length);
    }).join("\n");
  }

  // The local model likes to invent [mm:ss] stamps past the end of the video. Scrub the answer
  // before it's shown: if the user wanted timestamps, drop any line that cites a time beyond the
  // video length (hallucinated); if they didn't, strip stamps out of the prose entirely.
  function scrubStamps(text, maxSeconds, wantTs) {
    const TOK = /\[?\b(\d{1,2}:\d{2}(?::\d{2})?)\b\]?/g;
    if (!wantTs) {
      return text
        .split("\n")
        .map((ln) => ln.replace(TOK, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim())
        .join("\n");
    }
    if (!maxSeconds) return text;
    const limit = maxSeconds + 3; // small tolerance for rounding
    return text
      .split("\n")
      .filter((ln) => {
        TOK.lastIndex = 0;
        let m;
        while ((m = TOK.exec(ln))) if (tsToSeconds(m[1]) > limit) return false;
        return true;
      })
      .join("\n");
  }

  // ---------- model call ----------
  const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
  const dedupeSources = (list) => {
    const seen = new Set();
    return list.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url));
  };
  // req = { system, pageBlock, messages, web, forceWeb }.
  // Yields { t: "text" | "think" | "status" | "query" | "sources", d }.
  // If the provider rejects its built-in search tool before answering, the error carries webUnavailable = true
  // so the caller can search from the browser instead.
  async function* streamLLM(req, signal) {
    let started = false;
    try {
      for await (const ev of streamRaw(req, signal)) { started = true; yield ev; }
    } catch (e) {
      const m = String(e?.message || "");
      if (!started && req.web && e.name !== "AbortError" && /^(400|403|404|429)\b/.test(m) && /search|ground|tool/i.test(m)) e.webUnavailable = true;
      throw e;
    }
  }

  // Gemini: a blank model (or "flash", "flash-lite", "pro") means "the newest one of that kind this API key can use",
  // so a retired or renamed model ID never breaks chat. An exact ID (gemini-3.8-flash) is used as typed.
  const geminiAuto = {};
  const geminiVer = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)-/) || [])[1] || "0");
  async function geminiCandidates(signal) {
    const want = (activeModel().model || "flash").trim().replace(/^models\//, "");
    if (/^gemini-/.test(want)) return [want];
    const kind = /^(flash-lite|pro)$/.test(want) ? want : "flash";
    if (geminiAuto[kind]) return geminiAuto[kind];
    let list = [];
    try {
      const r = await fetchText(`${GEMINI_BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey() } }, 8000, signal);
      if (r.ok) {
        list = (JSON.parse(r.text).models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map((m) => String(m.name).replace(/^models\//, ""))
          .filter((n) => /^gemini-\d+(?:\.\d+)?-(?:flash-lite|flash|pro)(?:-|$)/.test(n))
          .sort((x, y) => geminiVer(y) - geminiVer(x));
      }
    } catch (e) { if (e.name === "AbortError") throw e; }
    if (list.length) {
      const familyOf = (n) => (n.match(/^gemini-\d+(?:\.\d+)?-(flash-lite|flash|pro)(?:-|$)/) || [])[1];
      const candidates = list.filter((n) => familyOf(n) === kind).slice(0, 2);
      // Flash may fall back to the cheaper Flash-Lite family, but never silently upgrades to Pro.
      if (kind === "flash") {
        const lite = list.find((n) => familyOf(n) === "flash-lite");
        if (lite) candidates.push(lite);
      }
      if (candidates.length) {
        geminiAuto[kind] = candidates; // only cache model IDs actually offered to this API key
        return candidates;
      }
    }
    return kind === "flash" ? ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]
      : kind === "flash-lite" ? ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
      : ["gemini-3.1-pro-preview", "gemini-2.5-pro"];
  }
  // the models this key can chat with, newest first (also proves the key works)
  async function geminiList(key) {
    const r = await fetchText(`${GEMINI_BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } }, 9000);
    if (!r.ok) throw new Error(httpError(r.status, r.text));
    return (JSON.parse(r.text).models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name).replace(/^models\//, ""))
      .filter((n) => /^gemini-/.test(n) && !/(embedding|tts|image|live|audio|robotics|computer)/.test(n))
      .sort((x, y) => geminiVer(y) - geminiVer(x) || x.localeCompare(y));
  }
  async function* geminiStream(req, system, signal) {
    const headers = { "content-type": "application/json", "x-goog-api-key": apiKey() };
    const contents = [];
    for (const m of req.messages) { // Gemini wants strictly alternating user/model turns
      const role = m.role === "assistant" ? "model" : "user";
      const parts = typeof m.content === "string" ? [{ text: m.content }] : m.content;
      if (contents.at(-1)?.role === role) contents.at(-1).parts.push(...parts);
      else contents.push({ role, parts: [...parts] });
    }
    const tb = req.quick ? 0 : thinkBudget();
    const cands = await geminiCandidates(signal);
    const autoChoice = !/^gemini-/.test((activeModel().model || "").trim().replace(/^models\//, ""));
    let lastErr = null;
    for (let ci = 0; ci < cands.length; ci++) {
      const mid = cands[ci];
      let useThink = true;
      for (let attempt = 0; attempt < 2; attempt++) {
        const body = { system_instruction: { parts: [{ text: system + (req.pageBlock ? "\n\n" + req.pageBlock : "") }] }, contents, generationConfig: { maxOutputTokens: 8192 } };
        if (req.web) body.tools = [{ google_search: {} }];
        if (useThink) {
          // Gemini 2.x takes a token budget, 3.x a level (never both). Without a setting, 3.x gets "low" so chat stays fast.
          if (tb) body.generationConfig.thinkingConfig = /gemini-2\./.test(mid) ? { thinkingBudget: tb, includeThoughts: true } : { thinkingLevel: tb <= 1024 ? "low" : tb <= 8192 ? "medium" : "high", includeThoughts: true };
          else if (/gemini-(3|4)/.test(mid)) body.generationConfig.thinkingConfig = { thinkingLevel: "low" };
        }
        let got = false, gotText = false;
        const srcs = new Map(), seenQ = new Set();
        try {
          const url = `${GEMINI_BASE}/models/${encodeURIComponent(mid)}:streamGenerateContent?alt=sse`;
          for await (const j of sseEvents(resilientChunks(url, headers, JSON.stringify(body), signal, 2))) {
            if (j.error) { const err = new Error(j.error.message || "Gemini API error"); err.status = Number(j.error.code); throw err; }
            got = true;
            if (j.promptFeedback?.blockReason) throw new Error("Gemini blocked this request (" + j.promptFeedback.blockReason + ")");
            const c = j.candidates?.[0];
            if (!c) continue;
            for (const p of c.content?.parts || []) {
              if (!p.text) continue;
              if (!p.thought) gotText = true;
              yield { t: p.thought ? "think" : "text", d: p.text };
            }
            const g = c.groundingMetadata;
            if (g) {
              for (const q of g.webSearchQueries || []) if (!seenQ.has(q)) { seenQ.add(q); yield { t: "query", d: q }; }
              for (const ch of g.groundingChunks || []) if (ch.web?.uri) srcs.set(ch.web.uri, { title: ch.web.title || "", url: ch.web.uri });
            }
            if (c.finishReason && !gotText && !/^(STOP|MAX_TOKENS)$/.test(c.finishReason)) throw new Error("Gemini stopped without an answer (" + c.finishReason + ")");
          }
          if (srcs.size) yield { t: "sources", d: [...srcs.values()].slice(0, 8) };
          return;
        } catch (e) {
          if (e.name === "AbortError" || got) throw e;
          const m = String(e.message || "");
          if (useThink && /thinking|thought/i.test(m)) { useThink = false; continue; } // this model doesn't take that setting
          if (e.status === 429 && autoChoice && ci < cands.length - 1) {
            yield { t: "status", d: `${mid} is rate-limited; trying another Gemini model…` };
            lastErr = e;
            break;
          } // other models can have separate quota buckets
          if (/^404\b|not found|not supported|no longer available|deprecated/i.test(m) && !/search|ground|tool/i.test(m) && ci < cands.length - 1) { lastErr = e; break; } // try the next model
          throw e;
        }
      }
    }
    throw lastErr || new Error("No usable Gemini model for this API key");
  }

  async function* streamRaw(req, signal) {
    const prov = provider();
    const system = req.system + (req.web ? "\n\n" + SEARCH_NUDGE : "") +
      (req.web && req.forceWeb ? "\n\nWeb search is required for this request: search the web for current information before answering. Write your own search query from the whole conversation and the page, never just the user's latest message word for word." +
        (req.queryHint ? ` A search query has already been written for you from the conversation: "${req.queryHint}". Search for that, or for a sharper version of it if the results are off.` : "") : "");
    if (prov === "gemini") { yield* geminiStream(req, system, signal); return; }
    let url, headers, body;
    if (prov === "anthropic") {
      url = "https://api.anthropic.com/v1/messages";
      headers = { "content-type": "application/json", "x-api-key": apiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
      const think = thinkBudget();
      const sys = [{ type: "text", text: system }];
      if (req.pageBlock) sys.push({ type: "text", text: req.pageBlock, cache_control: { type: "ephemeral" } });
      body = { model: model(), max_tokens: 4096 + (think >= 1024 ? think : 0), stream: true, system: sys, messages: req.messages };
      if (think >= 1024) body.thinking = { type: "enabled", budget_tokens: think };
      if (req.web) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
    } else {
      url = baseUrl() + "/chat/completions";
      headers = { "content-type": "application/json", ...authHeaders() };
      body = { model: model(), stream: true, messages: [{ role: "system", content: system + (req.pageBlock ? "\n\n" + req.pageBlock : "") }, ...req.messages] };
      if (activeModel().reasoning) body.reasoning_effort = req.quick ? "low" : reasoningEffort(); // the Effort slider, for models that take it
    }
    let sawTool = false, toolIdx = -1, toolBuf = "";
    const results = [], cited = [];
    for await (const j of sseEvents(resilientChunks(url, headers, JSON.stringify(body), signal))) {
      if (prov === "anthropic") {
        if (j.type === "error") throw new Error(j.error?.message || "API error");
        if (j.type === "content_block_start") {
          const cb = j.content_block || {};
          if (cb.type === "server_tool_use") { sawTool = true; toolIdx = j.index; toolBuf = ""; yield { t: "status", d: "Searching the web…" }; }
          else if (cb.type === "web_search_tool_result") { for (const r of Array.isArray(cb.content) ? cb.content : []) if (r.url) results.push({ title: r.title || "", url: r.url }); }
          else if (cb.type === "text" && sawTool) { sawTool = false; yield { t: "text", d: "\n\n" }; }
        } else if (j.type === "content_block_delta") {
          const d = j.delta || {};
          if (d.type === "thinking_delta" && d.thinking) yield { t: "think", d: d.thinking };
          else if (d.type === "text_delta" && d.text) yield { t: "text", d: d.text };
          else if (d.type === "input_json_delta" && j.index === toolIdx) toolBuf += d.partial_json || "";
          else if (d.type === "citations_delta" && d.citation?.url) cited.push({ title: d.citation.title || "", url: d.citation.url });
        } else if (j.type === "content_block_stop" && j.index === toolIdx) {
          try { const q = JSON.parse(toolBuf).query; if (q) yield { t: "query", d: q }; } catch {}
          toolIdx = -1; toolBuf = "";
        }
      } else {
        if (j.error) throw new Error(j.error.message || "API error");
        const dl = j.choices?.[0]?.delta;
        if (!dl) continue;
        const rs = dl.reasoning_content || dl.reasoning;
        if (rs) yield { t: "think", d: rs };
        if (dl.content) yield { t: "text", d: dl.content };
      }
    }
    // sources: what the model actually cited if we know, otherwise everything it looked at
    const src = dedupeSources(cited.length ? cited : results);
    if (src.length) yield { t: "sources", d: src.slice(0, 8) };
  }

  // one non-streaming helper (used by the Skill builder)
  async function askOnce(system, text, signal, quick) {
    let acc = "";
    for await (const ev of streamLLM({ system, pageBlock: "", messages: [{ role: "user", content: text }], web: false, quick: !!quick }, signal)) if (ev.t === "text") acc += ev.d;
    return acc;
  }

  // user turn → API content: plain string, or parts when images / PDFs are attached
  function apiContent(text, files) {
    if (!files.length) return text;
    const prov = provider();
    const parts = [];
    for (const f of files) {
      if (f.kind === "image") {
        parts.push(prov === "anthropic" ? { type: "image", source: { type: "base64", media_type: f.mime, data: f.b64 } }
          : prov === "gemini" ? { inline_data: { mime_type: f.mime, data: f.b64 } }
          : { type: "image_url", image_url: { url: `data:${f.mime};base64,${f.b64}` } });
      } else if (f.kind === "pdf" && prov === "anthropic") {
        parts.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.b64 } });
      } else if (f.kind === "pdf" && prov === "gemini") {
        parts.push({ inline_data: { mime_type: "application/pdf", data: f.b64 } });
      }
    }
    parts.push(prov === "gemini" ? { text } : { type: "text", text });
    return parts;
  }

  // ---------- web search for models without a built-in tool (Apple, OpenAI-compatible, Ollama…) ----------
  // The model writes a query, we search from the browser, read the top pages, and hand the text back as
  // numbered sources the model cites as [1], [2]…
  async function fetchText(url, opts = {}, ms = 9000, signal) {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), ms);
    const onAbort = () => c.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(url, { credentials: "omit", redirect: "follow", ...opts, signal: c.signal });
      return { ok: res.ok, status: res.status, ctype: res.headers?.get?.("content-type") || "", text: await res.text() };
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
  }
  let googleSearchLastAt = 0;
  async function googleWebSearch(q, signal) {
    const gap = 3500 - (Date.now() - googleSearchLastAt);
    if (gap > 0) await waitForRetry(gap, signal);
    googleSearchLastAt = Date.now();
    // Google serves localized HTML here, so use the signed-in browser session when available.
    // Keep requests deliberately spaced; Google can still challenge automated requests with a CAPTCHA.
    const r = await fetchText(`https://www.google.com/search?q=${encodeURIComponent(q)}&num=8`, {
      credentials: "include", headers: { Accept: "text/html,application/xhtml+xml" },
    }, 10000, signal);
    if (!r.ok) throw new Error("Google Search returned " + r.status);
    const doc = new DOMParser().parseFromString(r.text, "text/html");
    const results = [];
    for (const a of doc.querySelectorAll("a")) {
      const h3 = a.querySelector("h3");
      if (!h3) continue;
      let href = a.getAttribute("href") || "";
      try {
        const u = new URL(href, "https://www.google.com");
        if (/google\.[^/]+$/i.test(u.hostname) && u.pathname === "/url") href = u.searchParams.get("q") || u.searchParams.get("url") || "";
        else href = u.href;
      } catch { continue; }
      if (!/^https?:\/\//i.test(href)) continue;
      let host = "";
      try { host = new URL(href).hostname; } catch { continue; }
      if (/(^|\.)google(?:\.[a-z0-9-]+)+$/i.test(host) || /(^|\.)googleusercontent\.com$/i.test(host)) continue;
      const box = a.closest("div.MjjYud, div.g, [data-sokoban-container]") || a.parentElement?.parentElement;
      const snippet = box?.querySelector(".VwiC3b, [data-sncf], .aCOpRe")?.textContent?.trim() || "";
      if (!results.some((x) => x.url === href)) results.push({ title: h3.textContent.trim(), url: href, snippet });
      if (results.length >= 8) break;
    }
    return results;
  }
  const stripTags = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim();
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg,iframe").forEach((n) => n.remove());
    const root = doc.querySelector("main, article, [role=main]") || doc.body;
    return (root?.textContent || "").replace(/\s+/g, " ").trim();
  }
  async function webSearch(q, signal) {
    const enc = encodeURIComponent(q);
    const preferred = searchEngine();
    const ready = { duckduckgo: true, google: true, brave: !!searchSetup("brave"), searxng: !!searchSetup("searxng") };
    const order = [preferred, ...["duckduckgo", "google", "brave", "searxng"].filter((x) => x !== preferred && ready[x])];
    const label = (eng) => ({ duckduckgo: "DuckDuckGo", google: "Google Search", brave: "Brave Search", searxng: "SearXNG" })[eng] || eng;
    const errors = [];
    for (const eng of order) {
      if (!ready[eng]) {
        if (eng === preferred) errors.push("Add a Brave Search API key or SearXNG address in the mod's settings");
        continue;
      }
      try {
        let results = [];
        if (eng === "brave") {
          const key = searchSetup("brave");
          const r = await fetchText(`https://api.search.brave.com/res/v1/web/search?q=${enc}&count=6`, { headers: { Accept: "application/json", "X-Subscription-Token": key } }, 9000, signal);
          if (!r.ok) throw new Error("Brave Search returned " + r.status);
          results = (JSON.parse(r.text).web?.results || []).map((x) => ({ title: stripTags(x.title), url: x.url, snippet: stripTags(x.description) }));
        } else if (eng === "searxng") {
          const base = searchSetup("searxng").replace(/\/+$/, "");
          const r = await fetchText(`${base}/search?q=${enc}&format=json`, {}, 9000, signal);
          if (!r.ok) throw new Error("SearXNG returned " + r.status + " (JSON output must be enabled on the instance)");
          results = (JSON.parse(r.text).results || []).map((x) => ({ title: x.title || "", url: x.url, snippet: x.content || "" }));
        } else if (eng === "google") {
          results = await googleWebSearch(q, signal);
        } else {
          const r = await fetchText(`https://html.duckduckgo.com/html/?q=${enc}`, {}, 9000, signal);
          if (!r.ok) throw new Error("DuckDuckGo returned " + r.status);
          const doc = new DOMParser().parseFromString(r.text, "text/html");
          for (const el of doc.querySelectorAll(".result")) {
            const a = el.querySelector("a.result__a");
            if (!a || el.classList.contains("result--ad")) continue;
            let href = a.getAttribute("href") || "";
            const m = href.match(/[?&]uddg=([^&]+)/);
            if (m) href = decodeURIComponent(m[1]);
            if (href.startsWith("//")) href = "https:" + href;
            if (!/^https?:\/\//.test(href)) continue;
            results.push({ title: a.textContent.trim(), url: href, snippet: el.querySelector(".result__snippet")?.textContent.trim() || "" });
            if (results.length >= 6) break;
          }
        }
        results = results.filter((r) => /^https?:\/\//.test(r.url)).slice(0, 6);
        if (results.length) return results;
        errors.push(`${label(eng)} returned no results (possibly rate-limited or challenged)`);
      } catch (e) {
        if (signal?.aborted) throw e; // only the user stopping ends the answer; a timeout just tries the next provider
        errors.push(`${label(eng)}: ${String(e.message || e).slice(0, 140)}`);
      }
    }
    throw new Error("Web search failed. " + errors.join("; ") + ". Check the search settings or try again.");
  }
  // ---------- writing and judging search queries ----------
  // Whatever the model writes is tidied (filler, stray labels and quotes removed, the year added for "latest"), and the results
  // are re-ranked by how well they match the question, so the pages that get read are the ones that actually answer it.
  const QFILLER = [
    /^(?:hey|hi|hello|ok(?:ay)?|so|well|please|pls|kindly|and|also)\b[,!.\s]*/i,
    /^(?:can|could|would|will)\s+you\s+(?:please\s+)?/i,
    /^i(?:'|’)?\s*(?:d|would)?\s*(?:like|want|need|wanna)\s+(?:you\s+)?to\s+(?:know\s+)?/i,
    /^(?:i(?:'|’)d\s+like\s+to\s+know|let\s+me\s+know|tell\s+me|show\s+me|give\s+me)\b[,:\s]*/i,
    /^(?:search|google|research|browse|look)\s+(?:(?:the\s+)?(?:web|internet|online)\s+)?(?:for|about|up|into)\b[:,]?\s*/i,
    /^(?:search|google)\s+(?:the\s+)?(?:web|internet|online)\s+/i,
    /^(?:find\s+out|find|look\s+up|check)\s+(?:about\s+|online\s+|out\s+)?/i,
    /^(?:what|who|which)\s+(?:is|are|was|were)\s+(?:the\s+)?/i,
  ];
  const QGENERIC = new Set("and the for with from what which who how why are was were has have had can does did you your com www http https org net".split(" "));
  const qterms = (s) => [...new Set(((String(s || "").toLowerCase().match(/[\p{L}\p{N}]+(?:[.+#'’-][\p{L}\p{N}]+)*/gu)) || [])
    .filter((w) => (w.length >= 3 || /\d/.test(w)) && !/^20\d\d$/.test(w) && !LSTOP.has(w) && !QGENERIC.has(w)))];
  const sameQuery = (a, b) => qterms(a).sort().join(" ") === qterms(b).sort().join(" ");
  function tidyQuery(q, msg = "") {
    let s = String(q || "").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
    s = s.replace(/^(?:SEARCH|QUERY|ALT)\s*:\s*/i, "").replace(/\s+(?:ALT|SAY|LINKS|SEARCH)\s*:.*$/i, "");
    s = s.replace(/^[\s*•>\-–—`'‘’]+/, "").replace(/[\s*`'‘’.,;:!?]+$/, "");
    const wrapped = s.match(/^"([^"]*)"$/);
    if (wrapped) s = wrapped[1];
    for (let i = 0; i < 4; i++) { const before = s; for (const re of QFILLER) s = s.replace(re, ""); if (s === before) break; }
    s = s.replace(/[\s,]+(?:please|pls|thanks|thank you|online|on the (?:web|internet))$/i, "").replace(/[\s.,;:!?]+$/, "").trim();
    if ((s.match(/"/g) || []).length % 2) s = s.replace(/"/g, ""); // an unbalanced quote makes search engines return nothing useful
    s = s.split(" ").slice(0, 16).join(" ").slice(0, 180);
    const recency = /\b(?:latest|newest|current(?:ly)?|most recent|up[- ]to[- ]date)\b/i;
    if (s && (recency.test(s) || recency.test(msg)) && !/\b20\d\d\b/.test(s) && !/\b(?:today|tonight|yesterday|tomorrow|this (?:week|month)|right now|last night)\b/i.test(s)) s += " " + new Date().getFullYear();
    return s;
  }
  // when the model gives no query, build one from the message (with the page's subject when the message only says "it"/"this")
  function fallbackQuery(msg, page) {
    let s = tidyQuery(msg, msg);
    const vague = /\b(?:it|its|this|that|these|those|they|them|he|she|his|her|there)\b/i.test(s) || qterms(s).length < 2;
    if (vague && page?.title) {
      const title = page.title.replace(/\s*[:|]\s*r\/\w+\s*$/i, "").replace(/\s+[|\-–—·•]\s+[^|\-–—·•]{2,40}$/, "").trim();
      s = (title.split(/\s+/).slice(0, 10).join(" ") + " " + s).trim();
    }
    return (s || String(msg || "")).slice(0, 200);
  }
  // "what is this about?" means nothing to a search engine: when the query still says it/this/that (or has almost no words),
  // put the page's subject in front of it
  function anchorQuery(q, msg, page) {
    if (!page?.title) return q;
    const vague = /\b(?:it|its|this|that|these|those|they|them|he|she|there)\b/i.test(q) || qterms(q).length < 2;
    if (!vague) return q;
    const title = page.title.replace(/\s*[:|]\s*r\/\w+\s*$/i, "").replace(/\s+[|\-–—·•]\s+[^|\-–—·•]{2,40}$/, "").trim().split(/\s+/).slice(0, 12).join(" ");
    const rest = q.replace(/\b(?:it|its|this|that|these|those|they|them|he|she|there|about|what|is|are|whats)\b/gi, " ").replace(/\s+/g, " ").trim();
    return tidyQuery(`${title} ${rest}`.trim(), msg);
  }
  const UNREADABLE = /(?:^|\.)(?:pinterest\.[a-z.]+|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)$/;
  const normUrl = (u) => { try { const x = new URL(u); for (const k of [...x.searchParams.keys()]) if (/^(?:utm_|fbclid|gclid|ref$)/i.test(k)) x.searchParams.delete(k); return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/$/, "") + x.search).toLowerCase(); } catch { return u; } };
  // how well one result matches the question: terms in its title, snippet, address and site, weighted, plus how much of the question it covers
  function scoreResult(r, terms, rank) {
    const title = qterms(r.title), snip = qterms(r.snippet), host = hostOf(r.url).toLowerCase();
    let path = "";
    try { path = decodeURIComponent(new URL(r.url).pathname); } catch {}
    const urlT = qterms(path.replace(/[-_/.]+/g, " "));
    let s = 0, hit = 0;
    for (const w of terms) {
      let w1 = 0;
      if (title.includes(w)) w1 += 3;
      if (snip.includes(w)) w1 += 1.5;
      if (urlT.includes(w)) w1 += 1.5;
      if (host.includes(w)) w1 += 2;
      if (w1) hit++;
      s += w1;
    }
    const cover = terms.length ? hit / terms.length : 1;
    s += cover * 4 + Math.max(0, 6 - rank) * 0.4;
    if (UNREADABLE.test(host)) s -= 3; // login walls: the page can't be read anyway
    return { s, cover };
  }
  // Searches with the model's query; if the results don't match the question (or a second angle was asked for), tries another
  // wording, merges everything, drops duplicates, and ranks by relevance with at most two results per site.
  async function smartSearch(q, alt, signal, userMsg) {
    const queries = [q];
    const first = await webSearch(q, signal);
    const terms1 = qterms(q);
    const weak = (list) => terms1.length >= 2 && !list.slice(0, 4).some((r, i) => scoreResult(r, terms1, i).cover >= 0.5);
    let second = alt && !sameQuery(alt, q) ? alt : "";
    if (!second && (first.length < 3 || weak(first))) {
      const fb = tidyQuery(userMsg, userMsg);
      second = fb && !sameQuery(fb, q) ? fb : terms1.length > 5 ? terms1.slice(0, 5).join(" ") : "";
    }
    let extra = [];
    if (second) {
      try { extra = await webSearch(second, signal); queries.push(second); }
      catch (e) { if (signal?.aborted) throw e; }
    }
    const seen = new Map();
    [first, extra].forEach((list) => list.forEach((r, i) => {
      const k = normUrl(r.url), prev = seen.get(k);
      if (prev) { prev.rank = Math.min(prev.rank, i); prev.hits++; } else seen.set(k, { r, rank: i, hits: 1 });
    }));
    const terms = [...new Set([...terms1, ...(second ? qterms(second) : [])])];
    const ranked = [...seen.values()]
      .map((x) => ({ ...x, sc: scoreResult(x.r, terms, x.rank).s + (x.hits > 1 ? 2 : 0) }))
      .sort((a, b) => b.sc - a.sc);
    const perHost = new Map(), keep = [], rest = [];
    for (const x of ranked) {
      const hn = hostOf(x.r.url), n = perHost.get(hn) || 0;
      if (n < 2) { perHost.set(hn, n + 1); keep.push(x.r); } else rest.push(x.r);
    }
    return { results: [...keep, ...rest].slice(0, 6), queries };
  }
  // Opens the top results and keeps the passages that matter for the query (not just the first few hundred characters)
  async function readSources(results, signal, cap, query, chips) {
    const one = async (r, chip) => {
      try {
        const pg = await fetchReadable(r.url, signal, { ms: 7000 });
        if (pg.ok && pg.text) { r.text = focusText(pg.text, query || r.title, cap); chip?.done(); return true; }
        chip?.fail();
      } catch (e) { if (signal?.aborted) throw e; chip?.fail(); }
      return false;
    };
    const wave = await Promise.all(results.slice(0, 3).map((r, i) => one(r, chips?.[i])));
    const missing = wave.filter((ok) => !ok).length;
    if (missing) await Promise.all(results.slice(3, 3 + missing).map((r) => one(r))); // a page that wouldn't open is replaced by the next result
  }
  // ---------- links: understanding them, picking the right ones, reading them ----------
  // The page's links arrive from extractPageLinks with their context. Here we (1) work out whether the user wants links
  // followed, (2) pick the right ones locally (explicit URLs, "the third source", names, keywords) so even the tiny
  // on-device model only has to choose between a short list, (3) open them and keep only the passages that matter for the
  // question, and (4) turn the model's [L3] labels back into real clickable links.
  const LSTOP = new Set(("the and for with that this from what which who whom how why about page pages link links tell read open check look find any all are was were has have had can could does did " +
    "you your into onto over than then them they their there these those its me my our out get got want need please show give summarize summarise explain article articles first second third fourth fifth last next one two three").split(" "));
  const ltokens = (s) => (String(s || "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter((w) => !LSTOP.has(w));
  const ORD_WORDS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, last: -1 };
  const LNOUN = "(links?|hyperlinks?|references?|citations?|footnotes?|sources?)";
  const LINK_NEAR = /\b(?:open|read|follow|check|visit|click|go (?:to|through)|look (?:at|into|through|up)|dig (?:into|through)|browse|fetch|pull up|scan|crawl|explore|summari[sz]e|compare|verify)\b[^.?!]{0,80}\b(?:links?|hyperlinks?|urls?|references?|citations?|footnotes?|sources?)\b|\b(?:links?|hyperlinks?|references?|citations?|sources?)\b[^.?!]{0,60}\b(?:on|in|from|within|inside|embedded)\b[^.?!]{0,40}\b(?:page|site|website|article|post|thread)\b/i;
  const LINKED_THING = /\blinked\s+(?:article|page|post|story|study|paper|report|docs?|documentation|site|source|video|thread|resource|content)s?\b|\b(?:article|page|post|study|paper|report|source)s?\s+(?:it|they|this|that|the \w+)\s+(?:links?|cites?|references?)\b/i;
  const LEARN_MORE = /\b(?:learn more|read more|original (?:source|study|paper|report|announcement)|primary source|where (?:did|does) (?:this|that|it|the \w+) come from)\b/i;
  function linkIntent(text) {
    const t = String(text || "");
    const urls = [...new Set((t.match(/https?:\/\/[^\s<>()"'`]+/g) || []).map((u) => u.replace(/[.,;:!?\]]+$/, "")))].slice(0, 3);
    const ord = [];
    const add = (word, noun) => {
      const n = ORD_WORDS[word.toLowerCase()] ?? parseInt(word, 10);
      if (n && !ord.some((o) => o.n === n)) ord.push({ n, refs: /^(?:refer|citation|footnote|source)/i.test(noun) });
    };
    for (const m of t.matchAll(new RegExp(`\\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|\\d{1,3}(?:st|nd|rd|th))\\s+(?:\\w+\\s+)?${LNOUN}\\b`, "gi"))) add(m[1], m[2]);
    for (const m of t.matchAll(new RegExp(`\\b${LNOUN}\\s*(?:#|no\\.?\\s*|number\\s*)?\\[?(\\d{1,3})\\]?(?!\\d)`, "gi"))) add(m[2], m[1]);
    const textWants = !!(ord.length || LINK_NEAR.test(t) || LINKED_THING.test(t) || LEARN_MORE.test(t) || WANTS_PAGE_LINKS.test(t));
    return { wants: textWants || urls.length > 0, textWants, urls, ord };
  }

  // relevance of every link to a request, from its text, the words around it, its heading and its address
  function rankLinks(links, query) {
    const q = new Set(ltokens(query));
    const wantsRefs = /\b(?:sources?|references?|cite[sd]?|citations?|footnotes?|stud(?:y|ies)|papers?|research|original|evidence|proof)\b/i.test(query || "");
    const ranked = (links || []).map((l, i) => {
      let s = 0;
      if (q.size) {
        const tt = ltokens(l.title), ct = ltokens(l.ctx), st = ltokens(l.section);
        let path = "";
        try { path = decodeURIComponent(new URL(l.url).pathname); } catch {}
        const ut = ltokens(path.replace(/[-_/.]+/g, " ")), host = hostOf(l.url).toLowerCase();
        for (const w of q) {
          if (tt.includes(w)) s += 3;
          if (ct.includes(w)) s += 1.2;
          if (st.includes(w)) s += 1;
          if (ut.includes(w)) s += 1.5;
          if (host.includes(w)) s += 2.5; // "the nature link", "check the arxiv paper"
        }
        if (s && tt.length && tt.every((w) => q.has(w))) s += 2; // the whole title is in the request
      }
      if (l.kind === "nav") s -= 1.5;
      else if (l.kind === "ref" || l.kind === "out") s += wantsRefs ? 1.5 : 0.3;
      return { ...l, i, s };
    });
    return ranked.sort((a, b) => b.s - a.s || a.i - b.i);
  }

  // which links should be opened for this request? explicit URLs and "the third link" are certain; names and keywords are
  // ranked locally; anything still unclear comes back as a short candidate list for the model to choose from
  function pickLinks(links, query, intent, max = 3) {
    const picks = [];
    const add = (l, why) => { if (l && /^https?:/.test(l.url) && !picks.some((p) => p.url === l.url)) picks.push({ ...l, why }); };
    for (const u of intent.urls) add({ title: hostOf(u) || u, url: u, kind: "out", ctx: "" }, "url");
    const content = links.filter((l) => l.kind !== "nav");
    const refs = links.filter((l) => l.kind === "ref");
    for (const o of intent.ord) {
      const pool = o.refs && refs.length ? refs : content.length ? content : links;
      add(o.n === -1 ? pool[pool.length - 1] : pool[o.n - 1], "ordinal");
    }
    if (picks.length) return { picks: picks.slice(0, max), candidates: [], confident: true };
    const ranked = rankLinks(links, query);
    let cands = ranked.filter((l) => l.s >= 2.5).slice(0, 12);
    if (!cands.length && intent.wants) { // "read the sources": no names to match, so go by structure and spread across sites
      const seen = new Set();
      cands = [...ranked.filter((l) => l.kind === "ref"), ...ranked.filter((l) => l.kind === "out"), ...ranked.filter((l) => l.kind === "in")]
        .filter((l) => { const hn = hostOf(l.url); if (seen.has(hn)) return false; seen.add(hn); return true; }).slice(0, 10);
      return { picks: cands.slice(0, max), candidates: cands, confident: cands.length <= max };
    }
    const [a, b] = cands;
    if (a && a.s >= 5 && (!b || a.s >= b.s * 1.5)) return { picks: [a], candidates: cands, confident: true };
    if (cands.length && cands.length <= max) return { picks: cands, candidates: cands, confident: true };
    return { picks: cands.slice(0, max), candidates: cands, confident: false };
  }

  // the numbered link list that goes into a prompt: the links most relevant to the request first (kept in page order),
  // trimmed to a character budget. The model refers to a link by its label, e.g. [L3].
  function linksPrompt(links, query, budget, n, compact) {
    if (!links?.length || budget < 120) return "";
    const chosen = rankLinks(links, query).slice(0, n).sort((a, b) => a.i - b.i);
    const lines = [];
    let used = 0;
    for (const l of chosen) {
      let path = "";
      try { const u = new URL(l.url); path = (u.pathname + u.search).replace(/\/$/, ""); } catch {}
      const line = compact
        ? `L${l.i + 1} ${l.title.slice(0, 70)} (${hostOf(l.url)})`
        : `L${l.i + 1}${l.kind === "ref" ? " [reference]" : l.kind === "nav" ? " [site menu]" : ""} ${l.title} — ${hostOf(l.url)}${path.slice(0, 60)}` +
          (l.ctx && l.ctx !== l.title ? `\n    around it: “${l.ctx.slice(0, 150)}”` : "");
      if (used + line.length + 1 > budget) break;
      lines.push(line);
      used += line.length + 1;
    }
    if (!lines.length) return "";
    return `\n\n=== LINKS ON THIS PAGE (to point the user to one, write its label in square brackets like [L3]; never type a URL yourself) ===\n${lines.join("\n")}`;
  }
  // [L3] in an answer becomes a real link to the page's third link
  const expandLinkRefs = (text, links) => !links?.length || !text.includes("[L") ? text
    : text.replace(/\[L(\d{1,3})\]/g, (m, n) => {
      const l = links[+n - 1];
      return l ? `[${l.title.replace(/[\[\]()]/g, "").slice(0, 70)}](${l.url.replace(/\)/g, "%29")})` : m;
    });

  // a linked page, reduced to what a reader needs: title, description and body lines (PDFs are read too)
  function readableFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const meta = (sel) => (doc.querySelector(sel)?.getAttribute("content") || "").trim();
    const title = meta('meta[property="og:title"]') || (doc.title || "").trim();
    const desc = meta('meta[name="description"]') || meta('meta[property="og:description"]');
    doc.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg,iframe,template,[aria-hidden=true],.sidebar,#comments,.comments,.cookie-banner").forEach((n) => n.remove());
    const root = doc.querySelector("article, main, [role=main], #mw-content-text, #content, .post-content, .entry-content") || doc.body;
    const lines = [], seen = new Set();
    for (const el of root?.querySelectorAll("h1,h2,h3,p,li,blockquote,dd,pre") || []) {
      const t = (el.textContent || "").replace(/\s+/g, " ").replace(/\[\d+\]/g, "").trim();
      if (t.length < (/^H/.test(el.tagName) ? 2 : 25) || seen.has(t)) continue;
      seen.add(t);
      lines.push(t);
    }
    let text = lines.join("\n");
    if (text.length < 300) text = (root?.textContent || "").replace(/\s+/g, " ").trim();
    return { title, desc, text };
  }
  async function fetchReadable(url, signal, { ms = 8500, credentials = "omit" } = {}) {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), ms);
    const onAbort = () => c.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(url, { credentials, redirect: "follow", signal: c.signal, headers: { Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8,*/*;q=0.5" } });
      if (!res.ok) return { ok: false, status: res.status };
      const ctype = res.headers?.get?.("content-type") || "";
      if (/pdf/i.test(ctype) || /\.pdf(?:$|[?#])/i.test(url)) {
        const text = await pdfText(await res.arrayBuffer());
        return text ? { ok: true, title: "", desc: "", text } : { ok: false, status: 0 };
      }
      if (ctype && !/html|xml|text\/plain|json/i.test(ctype)) return { ok: false, status: 0 };
      const body = await res.text();
      if (/json|text\/plain/i.test(ctype)) return { ok: true, title: "", desc: "", text: body.slice(0, 60000) };
      return { ok: true, ...readableFromHtml(body) };
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
  }
  // the passages of a long text that matter for a request (plus its opening), in their original order
  function focusText(text, query, cap) {
    if (text.length <= cap) return text;
    const q = new Set(ltokens(query));
    if (!q.size) return condense(text, cap);
    const units = text.split("\n").map((u) => u.trim()).filter(Boolean);
    const scored = units.map((u, i) => {
      const ws = ltokens(u);
      let s = 0;
      for (const w of ws) if (q.has(w)) s += 1;
      return { u, i, s: i === 0 ? s / Math.sqrt(ws.length || 1) + 1 : s / Math.sqrt(ws.length || 1) };
    });
    if (!scored.some((x) => x.s > 0.9 && x.i !== 0)) return condense(text, cap);
    const out = [];
    let used = 0;
    for (const x of [...scored].sort((a, b) => b.s - a.s)) {
      if (x.s <= 0 && out.length) break;
      const piece = x.u.length > 600 ? x.u.slice(0, 600) + "…" : x.u;
      if (used + piece.length + 1 > cap) continue;
      out.push({ i: x.i, u: piece });
      used += piece.length + 1;
    }
    return out.sort((a, b) => a.i - b.i).map((x) => x.u).join("\n");
  }
  // Opens the chosen links in parallel and keeps what matters for the request. A page that is slow or refuses is marked
  // as failed instead of ending the whole answer. On the small on-device model each page is first distilled into notes
  // (its window cannot hold a page), rather than being cut off after a few hundred characters.
  async function readLinkPages(picks, signal, o) {
    const results = picks.map((l) => ({ title: l.title, url: l.url, snippet: l.ctx || "" }));
    await Promise.all(results.map(async (r, i) => {
      const chip = o.chips?.[i];
      try {
        const pg = await fetchReadable(r.url, signal);
        if (!pg.ok || !pg.text) throw new Error("unreadable");
        if (pg.title && (!r.title || r.title === hostOf(r.url) || r.title.length < 12)) r.title = pg.title.slice(0, 120);
        r.full = pg.text; r.desc = pg.desc;
        chip?.done();
      } catch (e) {
        if (signal?.aborted) throw e; // only the user stopping ends the answer, never one slow page
        r.failed = true;
        chip?.fail();
      }
    }));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.full) continue;
      if (o.notes && r.full.length > o.cap) {
        o.step?.set(`Taking notes on ${hostOf(r.url)}`);
        try {
          const out = (await askOnce(NOTES_SYSTEM, `Request: ${String(o.query).slice(0, 300)}\n\nExcerpt from “${r.title}” (${hostOf(r.url)}):\n${focusText(r.full, o.query, 3800)}`, signal, true)).trim();
          if (out && !/^NONE\b/i.test(out)) r.text = out.replace(/\s+/g, " ").slice(0, Math.max(o.cap, 560));
        } catch (e) { if (signal?.aborted) throw e; }
      }
      if (!r.text) r.text = ((r.desc ? r.desc + "\n" : "") + focusText(r.full, o.query, o.cap)).slice(0, o.cap + (r.desc || "").length);
      delete r.full;
    }
    return results;
  }
  const webBlock = (q, results, cap, linked) =>
    (linked ? `=== PAGES OPENED FROM LINKS (${q}) ===\n` : `=== WEB SEARCH RESULTS for "${q}" ===\n`) +
    results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n` + (r.failed
      ? `(This page could not be opened. All that is known is the text around the link on the source page: ${(r.snippet || "none").slice(0, 200)})`
      : (r.text || r.snippet || "").slice(0, cap))).join("\n\n") +
    "\n\nUse these results for facts beyond the page. Cite sources inline as [1], [2] right after the claims they support. Never cite a source that isn't listed. If a page could not be opened, say so instead of guessing what it contains. If these results don't actually answer the question, say what is missing and suggest a more specific follow-up instead of guessing.";
  // ----- higher effort on the small on-device model -----
  // Its 4,096-token window can't hold a long page, so High reads the whole page in parts and keeps notes that matter
  // for the question; Max also drafts an answer and then refines it.
  const NOTES_SYSTEM =
    "You are reading one excerpt of a longer web page for a reader who has a specific request. Write short plain-text notes (at most 80 words) " +
    "with the facts, figures, names, dates, claims and quotes in this excerpt that matter for the request. No preamble. If the excerpt has nothing relevant, reply exactly NONE.";
  function splitForReading(text, size) {
    const out = [];
    let cur = "";
    for (const para of String(text).split(/\n+/)) {
      if (cur && cur.length + para.length + 1 > size) { out.push(cur); cur = ""; }
      if (para.length > size) { for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size)); continue; }
      cur += (cur ? "\n" : "") + para;
    }
    if (cur) out.push(cur);
    return out;
  }
  async function deepRead(question, text, signal, tick) {
    const size = 4200, cap = effort() >= 4 ? 12 : 7;
    let parts = splitForReading(text, size);
    if (parts.length > cap) parts = Array.from({ length: cap }, (_, i) => parts[Math.round((i * (parts.length - 1)) / (cap - 1))]); // keep the start and end, sample the middle evenly
    const notes = [];
    for (let i = 0; i < parts.length; i++) {
      tick?.(i + 1, parts.length);
      try {
        const out = (await askOnce(NOTES_SYSTEM, `Request: ${String(question).slice(0, 300)}\n\nExcerpt ${i + 1} of ${parts.length}:\n${parts[i]}`, signal, true)).trim();
        if (out && !/^NONE\b/i.test(out)) notes.push(out.replace(/\s+/g, " ").slice(0, 520));
      } catch (e) { if (e.name === "AbortError") throw e; }
    }
    return notes.map((n) => "• " + n).join("\n");
  }
  async function refineRequest(req, signal, setStatus) {
    try {
      setStatus("Drafting an answer…");
      const draft = (await askOnce(req.system, req.messages[0].content, signal)).trim();
      if (!draft) return req;
      setStatus("Refining…");
      const c = req.messages[0].content, i = c.lastIndexOf("=== REQUEST ===");
      const src = i > 0 ? c.slice(0, i) : "", ask = i >= 0 ? c.slice(i) : c;
      const cut = (t, n) => (t.length <= n ? t : t.slice(0, n - 1) + "…");
      return { ...req, messages: [{ role: "user", content: `${cut(src, 4800)}\n\n=== DRAFT ANSWER ===\n${cut(draft, 2400)}\n\n${cut(ask, 1200)}\n\nImprove the draft answer above: fix anything the sources contradict, add important points it missed, and tighten the wording. Reply with only the improved answer.` }] };
    } catch (e) { if (e.name === "AbortError") throw e; return req; }
  }
  // Writes the web search query from the whole conversation (earlier questions, the answers given, the page), not from the last
  // message alone. Returns { query, alt } or null when the model gave nothing usable.
  async function composeQuery(convo, page, signal) {
    const last = [...convo].reverse().find((m) => m.role === "user");
    const msg = (last?.label || last?.content || "").replace(/\s+/g, " ").slice(0, 500);
    const small = provider() === "apple";
    const line = (m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${(m.label || m.content || "").replace(/\s+/g, " ").slice(0, m.role === "assistant" ? (small ? 220 : 500) : (small ? 160 : 320))}`;
    const history = convo.slice(small ? -5 : -9, -1).map(line).join("\n");
    const excerpt = page?.text ? focusText(page.text, msg, small ? 700 : 1800) : "";
    const ctx = `Today is ${new Date().toDateString()}.\n` +
      (page?.title ? `Page the user is on: ${page.title}${page.url ? " (" + hostOf(page.url) + ")" : ""}\n` : "") +
      (excerpt ? `Page excerpt:\n${excerpt}\n` : "") +
      (history ? `Conversation so far:\n${history}\n` : "") + `Latest user message: ${msg}`;
    let out = "";
    try { out = await askOnce(QUERY_WRITER_SYSTEM, ctx, signal, true); } catch (e) { if (signal?.aborted) throw e; return null; }
    let q = tidyQuery(out.match(/SEARCH:\s*(.+)/i)?.[1], msg);
    if (!q) return null;
    q = anchorQuery(q, msg, page);
    let alt = tidyQuery(out.match(/ALT:\s*(.+)/i)?.[1], msg);
    if (alt && sameQuery(alt, q)) alt = "";
    return { query: q, alt };
  }
  // Asks the model whether to search the web or open some of the page's links; returns { query } or { links }.
  // Only a short, locally ranked candidate list is shown (never all of the page's links), which is what lets a 4,096-token
  // model choose well.
  async function planSearch(convo, page, forced, signal, candidates = [], allowSearch = true) {
    const last = [...convo].reverse().find((m) => m.role === "user");
    const msg = (last?.label || last?.content || "").slice(0, 400);
    const small = provider() === "apple";
    const recent = convo.slice(small ? -4 : -7, -1).map((m) => `${m.role}: ${(m.label || m.content || "").replace(/\s+/g, " ").slice(0, m.role === "assistant" ? (small ? 160 : 320) : (small ? 140 : 240))}`).join("\n");
    const options = candidates.slice(0, 12);
    const linkList = options.length
      ? `Links embedded in the current page (choose by number):\n${options.map((x, i) => `${i + 1}. ${x.title.slice(0, 80)} (${hostOf(x.url)})${x.ctx && x.ctx !== x.title ? " — " + x.ctx.slice(0, 90) : ""}`).join("\n")}\n`
      : "";
    const excerpt = page?.text ? focusText(page.text, msg, provider() === "apple" ? 900 : 2500) : "";
    const ctx = `Today is ${new Date().toDateString()}.\n` + (page?.title ? `Page: ${page.title}${page.url ? " (" + hostOf(page.url) + ")" : ""}\n` : "") + (excerpt ? `Page excerpt:\n${excerpt}\n` : "") + linkList + (recent ? `Recent chat:\n${recent}\n` : "") + `User message: ${msg}`;
    let out = "";
    try { out = await askOnce(!allowSearch ? ROUTER_LINKS : forced ? ROUTER_FORCED : ROUTER_SYSTEM, ctx, signal, true); } catch (e) { if (signal?.aborted) throw e; }
    const sm = out.match(/SAY:\s*(.+)/i);
    const say = (sm?.[1] || "").trim().replace(/^["“]+|["”]+$/g, "").replace(/\s+(?:SEARCH|LINKS|ALT):.*$/i, "").slice(0, 220);
    const lm = options.length ? out.match(/LINKS:\s*([\d,\s]+)/i) : null;
    const links = lm ? [...new Set((lm[1].match(/\d+/g) || []).map(Number))].filter((n) => n > 0 && n <= options.length).slice(0, 3).map((n) => options[n - 1]) : [];
    if (links.length) return { query: "", links, say };
    if (!allowSearch) return { query: "", links: [], say: "" }; // no globe: never a web query
    const m = out.match(/SEARCH:\s*(.+)/i);
    const q = m?.[1] ? anchorQuery(tidyQuery(m[1], msg), msg, page) : "";
    const am = out.match(/ALT:\s*(.+)/i);
    let alt = tidyQuery(am?.[1], msg);
    if (alt && sameQuery(alt, q)) alt = "";
    if (q || forced) {
      // the query is written from the whole conversation, so follow-ups ("what about the second one?") search for the right thing
      const composed = convo.length > 1 || page?.title ? await composeQuery(convo, page, signal) : null;
      if (composed) return { query: composed.query, alt: composed.alt || alt, links: [], say };
    }
    if (q) return { query: q, alt, links: [], say };
    // no usable query from the model: build one from the message (and the page's subject) rather than sending the raw message
    return { query: forced ? fallbackQuery(msg, page) : "", alt: "", links: [], say: forced ? say : "" };
  }

  // ---------- markdown -> DOM ----------
  const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|~~[^~]+~~|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\)|\[\d{1,2}\]|https?:\/\/[^\s<>()]+)/;
  const linkEl = (url, text) => {
    const u = url.replace(/[.,;:]+$/, "");
    const a = h("a", {
      className: "dia-link", href: "#", title: u,
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); openLink(u); },
    });
    if (/^https?:/.test(u)) a.append(h("img", { className: "dia-fav", src: "page-icon:" + u, onerror: (e) => e.target.remove() }));
    a.append(text);
    return a;
  };

  // seek is an optional (seconds) => void; when given, [mm:ss] / mm:ss become clickable jump links
  const citeEl = (src, n) => h("a", { className: "dia-cite", href: "#", textContent: String(n), title: (src.title ? src.title + "\n" : "") + src.url,
    onclick: (e) => { e.preventDefault(); e.stopPropagation(); openLink(src.url); } });
  // cites: numbered web sources so a bare [1] becomes a clickable chip
  const inline = (s, seek, cites) =>
    s.split(INLINE_RE).filter(Boolean).flatMap((t) => {
      if (t.startsWith("**") && t.endsWith("**") && t.length > 4) return [h("strong", {}, ...inline(t.slice(2, -2), seek, cites))];
      if (t.startsWith("`") && t.endsWith("`") && t.length > 2) return [h("code", { textContent: t.slice(1, -1) })];
      if (t.startsWith("~~") && t.endsWith("~~") && t.length > 4) return [h("del", { textContent: t.slice(2, -2) })];
      if (t.length > 2 && t[0] === "*" && t.endsWith("*") && t[1] !== "*") return [h("em", {}, ...inline(t.slice(1, -1), seek, cites))];
      const cm = t.match(/^\[(\d{1,2})\]$/);
      if (cm) { const src = cites?.[+cm[1] - 1]; return [src ? citeEl(src, cm[1]) : document.createTextNode(t)]; }
      const md = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (md) return [linkEl(md[2], md[1])];
      if (/^https?:\/\//.test(t)) return [linkEl(t, t.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48))];
      if (!seek) return [document.createTextNode(t)];
      const out = [];
      let last = 0, m;
      TS_RE.lastIndex = 0;
      while ((m = TS_RE.exec(t))) {
        if (m.index > last) out.push(document.createTextNode(t.slice(last, m.index)));
        const secs = tsToSeconds(m[1]);
        out.push(h("a", {
          className: "dia-ts", textContent: m[1], href: "#", title: `Jump to ${m[1]}`,
          onclick: (e) => { e.preventDefault(); e.stopPropagation(); seek(secs); },
        }));
        last = m.index + m[0].length;
      }
      if (!out.length) return [document.createTextNode(t)];
      if (last < t.length) out.push(document.createTextNode(t.slice(last)));
      return out;
    });

  const copyBtn = (getText, label = "Copy") =>
    h("button", {
      className: "dia-mini", textContent: label, title: "Copy",
      onclick: (e) => { copyText(getText()); const b = e.currentTarget; b.textContent = "Copied"; setTimeout(() => (b.textContent = label), 1200); },
    });

  const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  const splitRow = (ln) => ln.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  function renderMd(el, text, seek, fadeStart = Infinity, cites = null) {
    el.replaceChildren();
    const lines = text.split("\n");
    const starts = [];
    let off = 0;
    for (const l of lines) { starts.push(off); off += l.length + 1; }
    // wrap only the characters newer than `fadeStart` so each freshly streamed slice eases in
    const frag = (content, cStart) => {
      const from = fadeStart === Infinity ? Infinity : Math.max(0, fadeStart - cStart);
      if (from >= content.length) return inline(content, seek, cites);
      if (from <= 0) return [h("span", { className: "dia-chunk-in" }, ...inline(content, seek, cites))];
      return [...inline(content.slice(0, from), seek, cites), h("span", { className: "dia-chunk-in" }, ...inline(content.slice(from), seek, cites))];
    };
    const stack = []; // open (possibly nested) lists: { indent, tag, el, lastLi }
    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trim();
      const fence = line.match(/^```\s*([\w+#.-]*)/);
      if (fence) {
        stack.length = 0;
        const code = [];
        let j = i + 1;
        while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) code.push(lines[j++]);
        const src = code.join("\n");
        el.append(h("div", { className: "dia-code" },
          h("div", { className: "dia-code-head" }, h("span", { textContent: fence[1] || "code" }), copyBtn(() => src)),
          h("pre", {}, h("code", { textContent: src }))));
        i = j + 1;
        continue;
      }
      if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        stack.length = 0;
        const head = splitRow(line);
        const rows = [];
        let j = i + 2;
        while (j < lines.length && lines[j].includes("|") && lines[j].trim()) rows.push(splitRow(lines[j++]));
        const tsv = [head, ...rows].map((r) => r.join("\t")).join("\n");
        const table = h("table", {},
          h("thead", {}, h("tr", {}, ...head.map((c) => h("th", {}, ...inline(c, seek, cites))))),
          h("tbody", {}, ...rows.map((r) => h("tr", {}, ...head.map((_, k) => h("td", {}, ...inline(r[k] || "", seek, cites)))))));
        el.append(h("div", { className: "dia-table" }, h("div", { className: "dia-code-head" }, h("span", { textContent: "table" }), copyBtn(() => tsv)), h("div", { className: "dia-table-scroll" }, table)));
        i = j;
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { stack.length = 0; el.append(h("hr")); i++; continue; }
      const hd = line.match(/^#{1,4}\s+(.*)/);
      if (hd) { stack.length = 0; el.append(h("p", { className: "dia-h" }, ...frag(hd[1], starts[i] + raw.indexOf(hd[1])))); i++; continue; }
      if (/^>/.test(line)) {
        stack.length = 0;
        const q = h("blockquote");
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          const c = lines[i].replace(/^\s*>\s?/, "");
          if (c.trim()) q.append(h("p", {}, ...frag(c, starts[i] + lines[i].indexOf(c))));
          i++;
        }
        el.append(q);
        continue;
      }
      const m = raw.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
      if (m) {
        const indent = m[1].replace(/\t/g, "  ").length;
        const tag = /\d/.test(m[2]) ? "ol" : "ul";
        while (stack.length && stack.at(-1).indent > indent) stack.pop();
        let top = stack.at(-1);
        if (top && top.indent === indent && top.tag !== tag) { stack.pop(); top = stack.at(-1); }
        if (!top || top.indent < indent) {
          const lst = tag === "ol" ? h("ol", { start: parseInt(m[2], 10) || 1 }) : h("ul");
          (top?.lastLi || el).append(lst);
          top = { indent, tag, el: lst, lastLi: null };
          stack.push(top);
        }
        const li = h("li", {}, ...frag(m[3], starts[i] + raw.indexOf(m[3])));
        top.el.append(li);
        top.lastLi = li;
        i++;
        continue;
      }
      if (line) { stack.length = 0; el.append(h("p", {}, ...frag(line, starts[i] + raw.indexOf(line)))); }
      i++; // a blank line keeps an open list open, so numbered lists survive paragraph gaps
    }
  }

  // pull the ```tabs {json}``` proposal out of an answer (shown as a confirm card instead)
  function extractActions(text) {
    const m = text.match(/```tabs\s*([\s\S]*?)```/);
    if (!m) return { text, actions: null };
    let actions = null;
    try { actions = JSON.parse(m[1]).actions; } catch {}
    return { text: text.replace(m[0], "").trim(), actions: Array.isArray(actions) ? actions : null };
  }

  // ---------- activity flow: what the agent is doing, in Dia's compact style ----------
  // By default you only see ONE small pill for the step that is running right now ("Reading 1 attachment", "Searching the
  // web" with the favicons of the pages it opens, or three dots while it thinks). A finished step settles into a muted
  // line ("Read 1 attachment"). Click the pill or the line to maximise the whole process (every step, every page it
  // opened, how long it took); click again to minimise it.
  function makeFlow(block, before, atEnd) {
    const t0 = Date.now();
    const root = h("div", { className: "dia-flow dia-live", hidden: true });
    const sumIco = h("span", { className: "dia-sum-ico" });
    const sumText = h("span", { className: "dia-flow-sumtext" });
    const chev = icon("chev");
    chev.setAttribute("class", "dia-svg dia-chev");
    const sum = h("button", { className: "dia-flow-sum", type: "button", hidden: true }, sumIco, sumText, chev);
    const list = h("div", { className: "dia-flow-list" });
    const pill = h("button", { className: "dia-flow-pill", type: "button", hidden: true });
    const pillTime = h("span", { className: "dia-pill-time" });
    root.append(sum, h("div", { className: "dia-flow-body" }, list), pill);
    if (atEnd) block.append(root);
    else if (before && before.parentNode === block) block.insertBefore(root, before);
    else block.prepend(root);
    const toggle = () => {
      const open = root.classList.toggle("dia-open");
      sum.setAttribute("aria-expanded", String(open));
      pill.setAttribute("aria-expanded", String(open));
      repaint();
    };
    sum.addEventListener("click", toggle);
    pill.addEventListener("click", toggle);
    const steps = [];
    let active = null, timer = null, ended = false, mode = "done", total = 0, pillKey = "", sumKey = "";
    const fmt = (ms) => (ms < 9950 ? (ms / 1000).toFixed(1) : Math.round(ms / 1000)) + "s";
    // after a few seconds the running step shows how long it has been going, so a slow model never looks hung
    const tick = () => {
      if (active?.state !== "active") return;
      const ms = Date.now() - active.start;
      active.time.textContent = ms >= 3000 ? fmt(ms) : "";
      pillTime.textContent = ms >= 4000 ? fmt(ms) : "";
    };
    const paintPill = () => {
      const s = active;
      if (!s || s.state !== "active") { pill.hidden = true; pillKey = ""; pillTime.textContent = ""; return; }
      pill.hidden = false;
      const dots = s.quiet || s.dots;
      const favs = s.favs.slice(0, 3);
      const key = dots ? "dots" : (s.pillText || s.label) + "|" + favs.join("|") + "|" + (s.ico || "");
      if (key === pillKey) return;
      pillKey = key;
      pill.classList.remove("dia-pill-pop"); void pill.offsetWidth; pill.classList.add("dia-pill-pop");
      if (dots) pill.replaceChildren(h("span", { className: "dia-dots" }, h("i"), h("i"), h("i")), pillTime);
      else pill.replaceChildren(
        favs.length ? h("span", { className: "dia-favs" }, ...favs.map((u) => h("img", { src: u, onerror: (e) => e.target.remove() })))
          : h("span", { className: "dia-pill-ico" }, icon(s.ico || "search")),
        h("span", { className: "dia-pill-text", textContent: s.pillText || s.label }), pillTime);
    };
    // the muted line: what has been done so far
    const refresh = () => {
      const done = steps.filter((s) => !s.quiet && s.state !== "dropped" && s.state !== "active" && s.kind !== "links" && s.kind !== "plan");
      const open = root.classList.contains("dia-open");
      if (!done.length && !open) sum.hidden = true;
      else if (!done.length) { // opened while the first step is still running: keep a line to click to minimise it again
        sum.hidden = false;
        sumText.textContent = "Hide steps";
        if (sumKey !== "hide") { sumKey = "hide"; sumIco.replaceChildren(icon("spark")); }
      } else {
        sum.hidden = false;
        const parts = done.map((s) => s.doneLabel || s.label);
        const lead = parts.length > 2 ? `${parts[0]} · ${parts[1]} · +${parts.length - 2}` : parts.join(" · ");
        sumText.textContent = (mode === "stopped" ? "Stopped · " : "") + lead + (ended && total >= 3000 ? " · " + fmt(total) : "");
        const ico = done[0].ico || "check";
        if (ico !== sumKey) { sumKey = ico; sumIco.replaceChildren(icon(ico)); }
      }
      root.hidden = !open && sum.hidden && pill.hidden && !steps.some((s) => s.state !== "dropped" && s.state !== "active" && !s.quiet && s.kind !== "plan");
    };
    const repaint = () => { paintPill(); refresh(); };
    function mk(label, o) {
      const ico = h("span", { className: "dia-step-ico" }, h("i", { className: "dia-spin" }));
      const text = h("span", { className: "dia-step-text", textContent: label });
      const time = h("span", { className: "dia-step-time" });
      const chips = h("div", { className: "dia-step-chips" });
      const el = h("div", { className: "dia-step dia-active" }, ico, h("div", { className: "dia-step-main" }, h("div", { className: "dia-step-label" }, text, time), chips));
      const s = {
        el, time, label, kind: o.kind || "", ico: o.ico || "", pillText: o.pill || "", dots: !!o.dots, favs: [],
        quiet: !!o.quiet, doneText: o.done || "", doneLabel: "", state: "active", start: Date.now(),
        set(t) { s.label = t; text.textContent = t; if (active === s) paintPill(); return s; },
        chip(d) {
          const src = d.icon || "page-icon:" + d.url;
          const c = h("span", { className: "dia-chipsrc", title: d.url || d.label },
            h("img", { src, onerror: (e) => e.target.remove() }), h("span", { textContent: d.label }), h("i"));
          chips.append(c);
          s.favs.push(src);
          if (active === s) paintPill();
          return { done() { c.classList.add("dia-ok"); }, fail() { c.classList.add("dia-bad"); } };
        },
        finish(state, glyph, t) {
          if (s.state !== "active") return s;
          s.state = state;
          el.classList.remove("dia-active");
          el.classList.add("dia-" + state);
          ico.replaceChildren(icon(glyph));
          if (t || s.doneText) s.set(t || s.doneText);
          s.doneLabel = s.label;
          time.textContent = "";
          repaint();
          return s;
        },
        done(t) { return s.finish("done", "check", t); },
        fail(t) { return s.finish("fail", "close", t); },
        halt() { return s.finish("stopped", "close"); },
        drop() { if (s.state === "dropped") return s; s.state = "dropped"; el.remove(); repaint(); return s; },
      };
      return s;
    }
    const api = {
      root,
      get active() { return active; },
      get steps() { return steps; },
      begin(label, o = {}) {
        ended = false;
        root.classList.add("dia-live");
        if (active) { if (active.quiet) active.drop(); else active.done(); }
        const s = mk(label, o);
        steps.push(s); active = s; list.append(s.el);
        clearInterval(timer); timer = setInterval(tick, 1000);
        pillTime.textContent = "";
        repaint();
        return s;
      },
      // the three dots: shown whenever nothing else is running, so something is always alive on screen
      wait() { if (!active || active.state !== "active") api.begin("Thinking", { quiet: true }); },
      dropQuiet() { if (active?.quiet) { active.drop(); active = null; repaint(); } },
      note(label, o = {}) { const s = mk(label, o); s.done(); steps.push(s); list.append(s.el); repaint(); return s; },
      end(how = "done") {
        if (ended) return;
        ended = true; mode = how;
        clearInterval(timer); timer = null;
        if (active) { if (active.quiet) active.drop(); else if (how === "done") active.done(); else if (how === "failed") active.fail(); else active.halt(); active = null; }
        total = Date.now() - t0;
        root.classList.remove("dia-live");
        repaint();
      },
    };
    return api;
  }

  // ---------- the docked sidebar (one per window) ----------
  // A real sidebar: the dock is a flex item placed right next to Zen's #tabbrowser-tabbox inside
  // #zen-tabbox-wrapper (plain Firefox has the same tabbox/parent shape), so the page genuinely gets narrower.
  const sessions = new Map(); // tab -> session
  let dock = null, panelsEl = null, dragW = null;
  const hostW = () => document.getElementById("tabbrowser-tabbox")?.parentNode?.getBoundingClientRect().width || window.innerWidth;
  const clampW = (w) => Math.max(320, Math.min(w, 800, Math.floor(hostW() * 0.6)));
  const dockWidth = () => dragW ?? clampW(parseInt(pref("width", "400"), 10) || 400);
  // The chat always sits on the opposite side of Zen's tab sidebar (no setting). With horizontal tabs there is no
  // sidebar, so it goes on the right.
  const tabsOnRight = () => {
    try { return Services.prefs.getBoolPref("zen.tabs.vertical", true) && Services.prefs.getBoolPref("zen.tabs.vertical.right-side", false); }
    catch { return document.documentElement.hasAttribute("zen-right-side"); }
  };
  const dockSide = () => (tabsOnRight() ? "left" : "right");

  function mountDock() {
    const tabbox = document.getElementById("tabbrowser-tabbox");
    const parent = tabbox?.parentNode;
    if (!parent) { // can't find the tab box: float over the page as a last resort
      dock.classList.add("dia-float");
      if (dock.parentNode !== document.documentElement) document.documentElement.append(dock);
      return;
    }
    dock.classList.remove("dia-float");
    const left = dockSide() === "left";
    const placed = dock.parentNode === parent && (left ? tabbox.previousElementSibling === dock : tabbox.nextElementSibling === dock);
    if (!placed) { if (left) tabbox.before(dock); else tabbox.after(dock); }
  }

  function ensureDock() {
    if (dock) return dock;
    const grip = h("div", { className: "dia-grip", title: "Drag to resize · double-click to reset" });
    panelsEl = h("div", { className: "dia-panels" });
    dock = h("div", { id: "dia-dock", hidden: true }, grip, panelsEl);
    mountDock();
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      dock.classList.add("dia-resizing");
      const x0 = e.clientX, w0 = dockWidth(), sign = dockSide() === "left" ? -1 : 1;
      const move = (ev) => { dragW = clampW(w0 + sign * (x0 - ev.clientX)); updateDock(); };
      const up = (ev) => {
        try { grip.releasePointerCapture(ev.pointerId); } catch {}
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
        grip.removeEventListener("pointercancel", up);
        dock.classList.remove("dia-resizing");
        if (dragW) setPref("width", dragW);
        dragW = null;
        updateDock();
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
      grip.addEventListener("pointercancel", up);
    });
    grip.addEventListener("dblclick", () => { setPref("width", "400"); updateDock(); });
    return dock;
  }

  // shows/hides the dock and applies the look settings (side, text size, colours, width)
  function updateDock() {
    if (!dock) return;
    syncButton();
    if (![...sessions.values()].some((s) => s.visible)) { dock.hidden = true; return; }
    mountDock();
    dock.dataset.side = dockSide();
    dock.dataset.accent = pref("accent", "space") === "neutral" ? "neutral" : "space";
    dock.style.setProperty("--dia-w", dockWidth() + "px");
    dock.style.setProperty("--dia-fs", { small: "13px", large: "15.5px" }[pref("textsize", "medium")] || "14px");
    dock.hidden = false;
  }

  // ---------- attachment pills ----------
  const refMeta = (r) => {
    switch (r.kind) {
      case "tab": return { label: r.label || hostOf(r.url) || "Tab", sub: r.loading ? "Reading…" : hostOf(r.url) || "Tab", image: r.image, ico: "page", tip: r.url, locked: r.locked, loading: r.loading };
      case "clip": return { label: "Pasted text", sub: "Clipboard", ico: "copy", tip: (r.text || "").slice(0, 300) };
      case "file": return { label: r.label, sub: "File", ico: "clip", tip: r.label };
      case "pdf": return { label: r.label, sub: "PDF", ico: "page", tip: r.label };
      case "image": return { label: r.label, sub: r.capture ? "Capture" : "Image", thumb: r.dataUrl, ico: "page", tip: r.label };
      default: {
        const t = (r.text || "").trim();
        return { label: "“" + t.slice(0, 40) + (t.length > 40 ? "…" : "") + "”", sub: "Selection", ico: "chat", tip: t.slice(0, 400) };
      }
    }
  };
  function pill(d, onRemove, cls = "") {
    const el = h("span", { className: "dia-pill " + cls + (d.locked ? " dia-locked" : ""), title: d.tip || d.label || "" });
    if (d.thumb) el.append(h("img", { className: "dia-pill-thumb", src: d.thumb }));
    else if (d.image) el.append(h("img", { className: "dia-pill-ico", src: d.image, onerror: (e) => e.target.replaceWith(icon(d.ico || "page")) }));
    else el.append(icon(d.ico || "page"));
    el.append(h("span", { className: "dia-pill-label", textContent: d.label }));
    if (onRemove) el.append(h("button", { className: "dia-pill-x", title: "Remove", onclick: (e) => { e.stopPropagation(); onRemove(); } }, icon("close")));
    return el;
  }

  // a context card, like Dia's: picture (or icon) + title + a small subtitle (Capture, File, the site…)
  function card(d, onRemove) {
    const el = h("div", { className: "dia-card" + (d.locked ? " dia-locked" : "") + (!onRemove ? " dia-card-static" : "") + (d.loading ? " dia-card-loading" : ""), title: d.tip || d.label || "" });
    const thumb = h("div", { className: "dia-card-thumb" });
    if (d.thumb) thumb.append(h("img", { src: d.thumb }));
    else if (d.image) thumb.append(h("img", { className: "dia-card-fav", src: d.image, onerror: (e) => e.target.replaceWith(icon(d.ico || "page")) }));
    else thumb.append(icon(d.ico || "page"));
    if (d.loading) thumb.append(h("i", { className: "dia-spin dia-card-spin" }));
    el.append(thumb, h("div", { className: "dia-card-text" },
      h("div", { className: "dia-card-title", textContent: d.label }),
      h("div", { className: "dia-card-sub", textContent: d.sub || "" })));
    if (onRemove) el.append(h("button", { className: "dia-card-x", title: "Remove", onclick: (e) => { e.stopPropagation(); onRemove(); } }, icon("close")));
    return el;
  }
  // screenshot of a tab: the full image (sent to the model) plus a small thumbnail for the card
  async function captureBrowser(b) {
    try {
      const r = b.getBoundingClientRect();
      if (r.width < 50 || r.height < 50) return null;
      const bmp = await b.drawSnapshot(0, 0, r.width, r.height, Math.min(1, 1280 / r.width), "white");
      const draw = (w, hh, q) => {
        const c = document.createElementNS(NS, "canvas");
        c.width = w; c.height = hh;
        c.getContext("2d").drawImage(bmp, 0, 0, w, hh);
        return c.toDataURL("image/jpeg", q);
      };
      const full = draw(bmp.width, bmp.height, 0.8);
      const thumb = draw(120, Math.max(1, Math.round((bmp.height * 120) / bmp.width)), 0.7);
      bmp.close?.();
      return { b64: full.split(",")[1], thumb };
    } catch (e) { return null; }
  }

  // ---------- helpers for files ----------
  const readDataUrl = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|ini|log|xml|html?|css|scss|jsx?|tsx?|mjs|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|zsh|sql|r|lua|tex|srt|vtt)$/i;
  const isTextFile = (f) => /^text\//.test(f.type) || /json|xml|javascript|yaml/.test(f.type) || TEXT_EXT.test(f.name || "");
  // best effort: Firefox ships pdf.js, so borrow it to read a PDF's text for non-Anthropic providers
  async function pdfText(buf) {
    try {
      const pdfjs = await import("resource://pdf.js/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "resource://pdf.js/build/pdf.worker.mjs";
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      let out = "";
      for (let p = 1; p <= Math.min(doc.numPages, 40) && out.length < 30000; p++) {
        const tc = await (await doc.getPage(p)).getTextContent();
        out += tc.items.map((i) => i.str).join(" ") + "\n\n";
      }
      return out.trim();
    } catch (e) { console.warn("[dia-sidebar] pdf.js text extraction failed", e); return ""; }
  }

  // What was dragged onto the sidebar? Tabs from the tab strip / vertical sidebar (Firefox & Zen set
  // application/x-moz-tab), whole tab groups, or a bare URL that matches an open tab.
  function tabsFromDrop(dt) {
    const tabs = new Set(), groups = [];
    const types = [...(dt.types || [])];
    try {
      if (types.includes("application/x-moz-tab")) {
        for (let i = 0; i < (dt.mozItemCount || 1); i++) {
          const t = dt.mozGetDataAt("application/x-moz-tab", i);
          if (t?.linkedBrowser) tabs.add(t);
        }
      }
      for (const ty of types) {
        if (!/tab-?group|zen-folder/i.test(ty)) continue;
        const g = dt.mozGetDataAt(ty, 0);
        if (g?.tabs) groups.push(g);
      }
    } catch (e) {}
    if (!tabs.size && !groups.length) {
      let u = "";
      try { u = (dt.getData("text/x-moz-url") || dt.getData("text/uri-list") || "").split("\n")[0].trim(); } catch (e) {}
      const t = u && gBrowser.tabs.find((x) => x.linkedBrowser?.currentURI?.spec === u);
      if (t) tabs.add(t);
    }
    return { tabs: [...tabs], groups };
  }
  const isDroppable = (e) => {
    const t = [...(e.dataTransfer?.types || [])];
    return t.includes("Files") || t.includes("application/x-moz-tab") || t.some((x) => /tab-?group|zen-folder/i.test(x)) || t.includes("text/x-moz-url") || t.includes("text/uri-list");
  };

  // ---------- per-tab session ----------
  function makeSession(src) {
    let panel, logEl, input, sendBtn, pillsEl, cardsEl, webBtnEl, composerEl, titleEl, modelBtnEl, sheetEl = null, hmenuEl = null, hmenuKind = "";
    let started = false, busy = false, generating = false, stopped = false, closed = false, userHidden = false, wantFocus = false;
    let page = null, convo = [], refs = [], ctrl = null, gen = 0, refSeq = 0, chatId = null, chatTitle = "", pageRefPromoted = false;
    let usePage = true, skill = null, formats = [], manage = false, webOn = false; // webOn: the globe button
    let queue = [], drainAfter = false, tabSnap = [], lastKey = "";
    const reading = new Set(); // tab / link reads still in flight
    let picker = null, linkCache = { key: "", links: [], pending: false }; // the tab & link picker, and the page's links read ahead of time
    let members = [src]; // all tabs this chat spans — >1 when opened over a split view
    let self = null, noteEl = null, noteTimer = null, pop = null, webStatusEl = null, webOffTimer = null;
    const isMember = (t) => t === src || members.includes(t);

    const srcUrl = () => {
      const uri = src.linkedBrowser?.currentURI;
      return uri && /^https?$/.test(uri.scheme) ? uri.spec : null;
    };
    // identity of the current page: the YouTube video id when on YouTube, else the URL minus its
    // #hash. Changes only when you actually move to a different page/video (not on seeks or #jumps).
    const srcKey = () => { const u = srcUrl(); return u ? (ytId(u) || u.split("#")[0]) : ""; };
    const isVid = () => !!ytId(srcUrl() || "");
    const hasContent = () => !!(input?.value.trim() || refs.length || skill);
    const nearBottom = () => logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 80;
    const scrollDown = (smooth) => logEl?.scrollTo({ top: logEl.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    const autosize = () => {
      if (!input) return;
      input.style.height = "auto";
      const sh = input.scrollHeight;
      input.style.height = sh > 0 ? Math.min(sh, 140) + "px" : "";
    };
    function updateSend() {
      if (!sendBtn) return;
      const stopMode = busy && !hasContent();
      sendBtn.replaceChildren(icon(stopMode ? "stop" : "send"));
      sendBtn.title = stopMode ? "Stop generating" : busy ? "Queue this message" : "Send";
      sendBtn.disabled = !busy && !hasContent();
    }
    const setBusy = (b) => { busy = b; panel?.classList.toggle("dia-working", b); updateSend(); };
    const updateTitle = () => { if (titleEl) titleEl.textContent = chatTitle || (isVid() ? "Video chat" : "Chat"); };
    // Focus the textarea reliably: when the sidebar opens from a shortcut, keyboard focus is still in
    // the web content (a separate focus scope), so also blur the content browser and raise the window.
    function focusInput() {
      if (!input) return;
      wantFocus = true;
      const go = () => {
        if (closed || !panel || panel.hidden) return;
        try { gBrowser.selectedBrowser?.blur?.(); } catch (e) {}
        try { window.focus(); } catch (e) {}
        try { input.focus({ preventScroll: true }); } catch (e) {}
      };
      go();
      requestAnimationFrame(go);
      for (const ms of [60, 200, 400]) setTimeout(go, ms);
    }

    // ----- text selected on the page becomes a pill in the composer -----
    const mm = src.linkedBrowser?.messageManager;
    const onSelection = (m) => { if (panel && !panel.hidden && !closed && bool("attachselection", true)) addRef(m.data?.text); };
    if (mm) {
      try {
        mm.loadFrameScript(
          "data:application/javascript," + encodeURIComponent(
            `if (typeof __diaSel === "undefined") { var __diaSel = true; (${selectionWatcher.toString()})(); }`
          ),
          true
        );
        mm.addMessageListener(SEL_MSG, onSelection);
      } catch (e) { console.warn("[dia-sidebar] selection watcher failed", e); }
    }

    const pageData = () => {
      const url = srcUrl();
      if (!url) return null;
      let label = src.label || url;
      if (/youtube\.com$|youtu\.be$/.test(hostOf(url))) label = label.replace(/\s*[-–—]\s*YouTube\s*$/, "");
      return { url, label, image: src.image };
    };

    // The current page starts as a toggle card. Once the first send has captured the page,
    // it becomes an ordinary removable tab attachment for the next message.
    function currentPageCard(pd) {
      const el = card({ label: pd.label, sub: hostOf(pd.url) || "Current page", image: pd.image, ico: "page", tip: pd.url }, null);
      el.classList.add("dia-page-toggle");
      el.classList.toggle("dia-off", !usePage);
      const toggle = () => { if (!started) { usePage = !usePage; renderPills(); } };
      const minBtn = h("button", {
        className: "dia-page-min", type: "button",
        title: usePage ? "Minimise: leave this page out of the first message" : "Add this page back to the first message",
        onclick: (e) => { e.stopPropagation(); toggle(); },
      }, icon(usePage ? "minus" : "plus"));
      minBtn.setAttribute("aria-label", usePage ? "Page included. Click to leave it out." : "Page left out. Click to include it.");
      minBtn.setAttribute("aria-pressed", String(!usePage));
      el.append(minBtn);
      return el;
    }
    function renderPills() {
      if (!pillsEl) return;
      const els = [];
      const pd = pageData();
      cardsEl.replaceChildren(...(!started && pd ? [currentPageCard(pd)] : []), ...refs.map((r) => card(refMeta(r), r.locked ? null : () => { refs = refs.filter((x) => x.id !== r.id); renderPills(); })));
      if (skill) els.push(pill({ label: skill.name, ico: "spark" }, () => { skill = null; renderPills(); }, "dia-skillpill"));
      for (const f of formats) els.push(pill({ label: "@" + f.name, ico: "edit", tip: f.hint }, () => { formats = formats.filter((x) => x !== f); renderPills(); }));
      if (manage) els.push(pill({ label: "Manage tabs", ico: "folder" }, () => { manage = false; renderPills(); }));
      pillsEl.replaceChildren(...els);
      const hasPageContext = started ? refs.some((r) => r.pageSource) : usePage;
      if (input) input.placeholder = isVid() && hasPageContext ? "Ask a question about this video..." : hasPageContext && pd ? "Ask a question about this page..." : "Ask anything...";
      updateSend();
      updateWebBtn();
      syncPicker();
    }

    function addRef(text) {
      if (!text || text.length < 2) return;
      // growing/shrinking the same selection replaces its pill instead of stacking
      const i = refs.findIndex((r) => (r.kind || "text") === "text" && (r.text.includes(text) || text.includes(r.text)));
      if (i >= 0) refs[i] = { id: refs[i].id, kind: "text", text };
      else refs.push({ id: ++refSeq, kind: "text", text });
      while (refs.length > MAX_REFS) { const k = refs.findIndex((r) => !r.locked); if (k < 0) break; refs.splice(k, 1); }
      renderPills();
    }
    function addContext(item) {
      if (!item || !item.text || !item.text.trim()) return;
      refs.push({ id: ++refSeq, ...item });
      while (refs.length > MAX_REFS) { const i = refs.findIndex((r) => !r.locked); if (i < 0) break; refs.splice(i, 1); }
      renderPills();
    }

    // small transient line under the pills for add-context status
    function clearNote() { clearTimeout(noteTimer); if (noteEl) { noteEl.remove(); noteEl = null; } }
    function flashNote(msg, sticky) {
      clearNote();
      if (!pillsEl) return;
      noteEl = h("div", { className: "dia-addnote", textContent: msg });
      pillsEl.after(noteEl);
      if (!sticky) noteTimer = setTimeout(clearNote, 3200);
    }

    // ----- extra context sources: clipboard, other tabs, tab groups, files -----
    function readClipboard() {
      try {
        const xfer = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
        xfer.init(null);
        for (const flavor of ["text/plain", "text/unicode"]) {
          try {
            xfer.addDataFlavor(flavor);
            Services.clipboard.getData(xfer, Services.clipboard.kGlobalClipboard);
            const o = {};
            xfer.getTransferData(flavor, o);
            const s = o.value?.QueryInterface?.(Ci.nsISupportsString)?.data;
            if (s) return s;
          } catch (e) {}
        }
      } catch (e) {}
      return "";
    }
    function pasteCard() {
      const t = readClipboard().replace(/\s+/g, " ").trim();
      if (!t) { flashNote("Clipboard is empty (or not text)."); return; }
      addContext({ kind: "clip", label: "Pasted", text: t.slice(0, 8000) });
    }

    // the camera button: attach a screenshot of the page (for models that can see images)
    async function addCapture() {
      if (!srcUrl() && !src.linkedBrowser) return;
      if (!canSeeFiles()) flashNote(textOnlyNote());
      else flashNote("Capturing…", true);
      const cap = await captureBrowser(src.linkedBrowser);
      if (!cap) { flashNote("Couldn't capture this page."); return; }
      if (canSeeFiles()) clearNote();
      addContext({ kind: "image", capture: true, label: src.label || hostOf(srcUrl()) || "Page", url: srcUrl() || "", mime: "image/jpeg", b64: cap.b64, dataUrl: cap.thumb, text: "[capture of " + (src.label || "the page") + "]" });
    }

    // a PDF's bytes: Anthropic reads them natively (text + figures); other providers get extracted text
    async function addPdfBuffer(buf, name, url) {
      if (rawPdf()) {
        const dataUrl = await readDataUrl(new Blob([buf], { type: "application/pdf" }));
        clearNote();
        addContext({ kind: "pdf", label: name, url, key: url, mime: "application/pdf", b64: dataUrl.split(",")[1], text: "[PDF: " + name + "]" });
        return true;
      }
      flashNote("Reading PDF…", true);
      const text = await pdfText(buf);
      if (!text) { flashNote("Couldn't read that PDF's text. AFM Server's apple.local model needs text; try copying the relevant passage into chat."); return false; }
      clearNote();
      addContext({ kind: "file", label: name, url, key: url, text: text.slice(0, 24000) });
      return true;
    }
    async function addFile(f) {
      const name = f.name || "attachment";
      if (/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) {
        if (f.size > 8e6) { flashNote("That image is over 8 MB."); return; }
        const dataUrl = await readDataUrl(f);
        if (!canSeeFiles()) flashNote(textOnlyNote());
        addContext({ kind: "image", label: name, mime: f.type, b64: dataUrl.split(",")[1], dataUrl, text: "[image: " + name + "]" });
      } else if (f.type === "application/pdf" || /\.pdf$/i.test(name)) {
        if (f.size > 25e6) { flashNote("That PDF is over 25 MB."); return; }
        await addPdfBuffer(await f.arrayBuffer(), name);
      } else if (/\.(docx|pptx|xlsx)$/i.test(name)) {
        if (f.size > 30e6) { flashNote("That file is over 30 MB."); return; }
        const text = await officeText(await f.arrayBuffer(), name);
        if (!text) { flashNote("Couldn't find any text in " + name + "."); return; }
        addContext({ kind: "file", label: name, text: text.slice(0, 30000) });
      } else if (isTextFile(f)) {
        addContext({ kind: "file", label: name, text: (await f.text()).slice(0, 24000) });
      } else {
        flashNote("Unsupported file. Images, PDFs, Word/Excel/PowerPoint and text/code files work.");
      }
    }
    async function addFiles(list) {
      for (const f of [...list]) {
        if (refs.length >= MAX_REFS) { flashNote(`Up to ${MAX_REFS} attachments at a time.`); break; }
        try { await addFile(f); } catch (e) { flashNote("Couldn't read " + (f.name || "that file") + "."); }
      }
    }
    function pickFile() {
      const inp = h("input", { type: "file", multiple: true });
      inp.addEventListener("change", () => addFiles(inp.files));
      inp.click();
    }

    // Find the OTHER tab(s) in the same split view as the active tab. Preferred path: ask Zen's
    // split-view manager for the group that contains the active tab (deterministic). Fallback: a
    // geometric test — a real split sibling is laid out BESIDE the active pane, so it barely overlaps
    // the active pane's rect. Never returns unrelated background tabs.
    function splitSiblings() {
      try {
        const zs = window.gZenViewSplitter;
        const groups = zs && (zs._data || zs.splitViewGroups || zs.groups);
        if (Array.isArray(groups)) {
          for (const g of groups) {
            const gt = (g?.tabs || g?.tabIds || []).map((x) => (x && x.linkedBrowser ? x : x?.tab)).filter(Boolean);
            if (gt.some((t) => t === src || t === gBrowser.selectedTab)) {
              return gt.filter((t) => t !== src && t.linkedBrowser && !t.pending);
            }
          }
        }
      } catch (e) {}
      try {
        const selR = gBrowser.selectedBrowser.getBoundingClientRect();
        const selArea = selR.width * selR.height;
        if (selArea < 2500) return [];
        return gBrowser.tabs.filter((t) => {
          if (t === src || t.pending || !t.linkedPanel || !t.linkedBrowser) return false;
          if (!/^https?$/.test(t.linkedBrowser.currentURI?.scheme || "")) return false;
          if (!paneVisible(t)) return false;
          const r = t.linkedBrowser.getBoundingClientRect();
          if (r.width * r.height < 2500) return false;
          const ox = Math.max(0, Math.min(r.right, selR.right) - Math.max(r.left, selR.left));
          const oy = Math.max(0, Math.min(r.bottom, selR.bottom) - Math.max(r.top, selR.top));
          return ox * oy < selArea * 0.35;
        });
      } catch (e) { return []; }
    }
    // Opened on top of a split view → the whole split is ONE environment: every pane becomes a locked
    // pill (no ✕), and the sidebar stays put whichever half you click.
    function attachSplitTabs() {
      const others = splitSiblings().slice(0, 3);
      for (const t of others) for (const o of [...sessions.values()]) if (o !== self && o.has(t)) o.close(true);
      members = [src, ...others];
      return Promise.all(others.map((t) => addTab(t, true)));
    }

    // ----- tabs & links: one picker that stays open -----
    // Every open web tab (sleeping ones too, they are fetched instead of read live) and every link on the page can be
    // ticked in one panel. Cards appear the instant you tap, with a spinner until the text is in, and sending waits for
    // any that are still reading.
    const tabUrl = (t) => { try { return t.linkedBrowser?.currentURI?.spec || ""; } catch { return ""; } };
    const isWebTab = (t) => { try { return !!t.linkedBrowser && !t.hasAttribute?.("zen-empty-tab") && /^https?$/.test(t.linkedBrowser.currentURI?.scheme || ""); } catch { return false; } };
    const wsOf = (t) => { try { return t.getAttribute?.("zen-workspace-id") || ""; } catch { return ""; } };
    const webTabs = () => gBrowser.tabs.filter((t) => t !== src && isWebTab(t)).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    const loadedTabs = webTabs;
    const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "now" : m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d"; };
    const keyOf = (r) => r.key || r.url;
    const isOn = (key) => !!key && refs.some((r) => keyOf(r) === key);
    const isLoading = (key) => refs.some((r) => keyOf(r) === key && r.loading);
    const tabRefs = () => refs.filter((r) => r.kind === "tab" && !r.pageSource);

    // runs a read for a card that is already on screen; if it fails the card goes away with a note
    function readInto(ref, work) {
      renderPills();
      const job = (async () => {
        try { await work(ref); }
        catch (e) { if (refs.includes(ref)) { refs = refs.filter((x) => x !== ref); flashNote(`Couldn't read “${(ref.label || "that page").slice(0, 40)}”.`); } }
        ref.loading = false;
      })();
      reading.add(job);
      job.finally(() => { reading.delete(job); renderPills(); });
      return job;
    }
    function addTab(tab, locked = false) {
      if (!tab || tab === src) return Promise.resolve();
      const key = tabUrl(tab);
      if (!key || isOn(key)) return Promise.resolve();
      if (refs.length >= MAX_REFS) { flashNote(`Up to ${MAX_REFS} attachments at a time.`); return Promise.resolve(); }
      const ref = { id: ++refSeq, kind: "tab", key, label: tab.label || hostOf(key) || "Tab", image: tab.image || "", url: key, text: "", loading: true, locked };
      refs.push(ref);
      return readInto(ref, async () => {
        if (tab.linkedBrowser?.documentContentType === "application/pdf" || /\.pdf(?:$|[?#])/i.test(key)) { // a PDF in a tab: fetch the file itself
          const res = await fetch(key, { credentials: "include" });
          if (!res.ok) throw new Error("HTTP " + res.status);
          if (!(await addPdfBuffer(await res.arrayBuffer(), (tab.label || "PDF").replace(/\.pdf$/i, "") + ".pdf", key))) throw new Error("no text");
          refs = refs.filter((x) => x !== ref);
          return;
        }
        let text = "", url = key;
        if (!tab.pending) { // a live tab: read what is on screen
          try { const d = await getPageText(tab.linkedBrowser); text = (d?.text || "").replace(/\s+/g, " ").trim(); url = d?.url || key; } catch {}
        }
        if (!text) { // a sleeping tab (or one that wouldn't answer): fetch the page itself
          const pg = await fetchReadable(key, null, { credentials: "include", ms: 10000 });
          if (pg.ok) text = ((pg.desc ? pg.desc + " " : "") + pg.text).replace(/\s+/g, " ").trim();
        }
        if (!text) throw new Error("empty");
        if (!refs.includes(ref)) return; // removed while reading
        if (refs.some((r) => r !== ref && r.kind === "tab" && r.url === url)) { refs = refs.filter((x) => x !== ref); return; }
        ref.text = text.slice(0, 6000); ref.url = url;
      });
    }
    // a link from the page, opened and read like a tab
    function addLink(l) {
      const key = l.url;
      if (!key || isOn(key)) return Promise.resolve();
      if (refs.length >= MAX_REFS) { flashNote(`Up to ${MAX_REFS} attachments at a time.`); return Promise.resolve(); }
      const ref = { id: ++refSeq, kind: "tab", key, fromLink: true, label: l.title || hostOf(key), image: "page-icon:" + key, url: key, text: "", loading: true };
      refs.push(ref);
      return readInto(ref, async () => {
        const pg = await fetchReadable(key, null, { ms: 10000 });
        if (!pg.ok || !pg.text) throw new Error("unreadable");
        if (!refs.includes(ref)) return;
        ref.text = ((pg.desc ? pg.desc + " " : "") + pg.text).replace(/\s+/g, " ").trim().slice(0, 6000);
        if (pg.title && (ref.label || "").length < 12) ref.label = pg.title.slice(0, 120);
      });
    }
    function addGroup(group) {
      const tabs = (group.tabs || []).filter((t) => t !== src && isWebTab(t));
      if (!tabs.length) { flashNote("That group has no web tabs to read."); return; }
      const room = Math.max(0, MAX_REFS - refs.length);
      const fresh = tabs.filter((t) => !isOn(tabUrl(t)));
      fresh.slice(0, room).forEach((t) => addTab(t));
      if (fresh.length > room) flashNote(`Added ${room} of ${tabs.length} tabs in “${group.label || "group"}”.`);
    }
    const tabGroupsList = () => { try { return [...(gBrowser.tabGroups || [])].filter((g) => (g.tabs || []).length); } catch { return []; } };
    // the links on the page you are looking at (read once, kept until you navigate)
    async function linksNow() {
      if (page && !page.none && page.links) return page.links;
      const key = srcUrl() || "";
      if (!key || ytId(key)) return [];
      if (linkCache.key === key) return linkCache.links;
      try { const d = await getPageText(src.linkedBrowser); linkCache = { key, links: d.links || [], pending: false }; return linkCache.links; } catch { return []; }
    }
    const cachedLinks = () => (page && !page.none && page.links) || (linkCache.key === srcUrl() ? linkCache.links : null);

    function closePicker() {
      if (!picker) return;
      picker.el.remove(); picker = null;
      document.removeEventListener("pointerdown", onPickerDown, true);
    }
    const onPickerDown = (e) => { if (picker && !picker.el.contains(e.target) && !e.target.closest(".dia-add, .dia-tabsbtn")) closePicker(); };
    function syncPicker() {
      if (!picker) return;
      for (const r of picker.rows) {
        const on = isOn(r.item.key);
        r.el.classList.toggle("dia-on", on);
        r.el.classList.toggle("dia-loading", on && isLoading(r.item.key));
        r.el.setAttribute("aria-pressed", String(on));
      }
      for (const c of picker.chips) c.el.classList.toggle("on", c.keys.length > 0 && c.keys.every(isOn));
      const n = tabRefs().length;
      picker.count.textContent = n ? `${n} added` : "Tap to add";
      picker.clear.hidden = !n;
      picker.segTabs.textContent = "Tabs";
      picker.segLinks.textContent = picker.links ? `Links · ${picker.links.length}` : "Links";
    }
    function pickerItems() {
      const term = picker.search.value.trim().toLowerCase();
      const match = (...s) => !term || s.some((x) => (x || "").toLowerCase().includes(term));
      if (picker.mode === "links") {
        const links = (picker.links || []).filter((l) => match(l.title, l.url, l.ctx, l.section));
        const mk = (l) => ({ key: l.url, label: l.title, sub: hostOf(l.url) + (l.ctx && l.ctx !== l.title ? "  ·  " + l.ctx.replace(l.title, "…").slice(0, 80) : ""), image: "page-icon:" + l.url, add: () => addLink(l) });
        const refsL = links.filter((l) => l.kind === "ref"), body = links.filter((l) => l.kind === "in" || l.kind === "out"), nav = links.filter((l) => l.kind === "nav");
        const groups = [["In the page", body], ["References", refsL], ["Site menu", nav]].filter(([, a]) => a.length);
        return groups.flatMap(([name, a]) => (groups.length > 1 ? [{ sep: name }] : []).concat(a.map(mk)));
      }
      const mk = (t) => ({
        key: tabUrl(t), label: t.label || hostOf(tabUrl(t)) || "Tab",
        sub: [hostOf(tabUrl(t)), t.group?.label, t.pending ? "sleeping" : "", t.lastAccessed ? ago(t.lastAccessed) : ""].filter(Boolean).join("  ·  "),
        image: t.image, add: () => addTab(t),
      });
      const all = webTabs().filter((t) => match(t.label, tabUrl(t)));
      if (term) return all.map(mk);
      const ws = wsOf(src);
      const inGroup = src.group ? all.filter((t) => t.group === src.group) : [];
      const here = all.filter((t) => !inGroup.includes(t) && (!ws || !wsOf(t) || wsOf(t) === ws));
      const other = all.filter((t) => !inGroup.includes(t) && !here.includes(t));
      const secs = [["In this group", inGroup], ["This space", here], ["Other spaces", other]].filter(([, a]) => a.length);
      return secs.flatMap(([name, a]) => (secs.length > 1 ? [{ sep: name }] : []).concat(a.map(mk)));
    }
    function paintPicker() {
      if (!picker) return;
      const items = pickerItems();
      picker.rows = []; picker.items = items.filter((it) => !it.sep);
      const els = [];
      if (picker.mode === "links" && !picker.links) els.push(h("div", { className: "dia-pk-empty" }, h("i", { className: "dia-spin dia-pk-spin" }), "Looking through the page…"));
      else if (!items.length) els.push(h("div", { className: "dia-pk-empty", textContent: picker.search.value.trim() ? "Nothing matches." : picker.mode === "links" ? "No links found on this page." : "No other web tabs are open." }));
      for (const it of items) {
        if (it.sep) { els.push(h("div", { className: "dia-pk-sec", textContent: it.sep })); continue; }
        const row = h("button", { className: "dia-pk-row", type: "button", title: it.label });
        row.append(
          it.image ? h("img", { className: "dia-pk-fav", src: it.image, onerror: (e) => e.target.replaceWith(icon("page")) }) : icon("page"),
          h("span", { className: "dia-pk-main" }, h("span", { className: "dia-pk-title", textContent: it.label }), h("span", { className: "dia-pk-sub", textContent: it.sub || "" })),
          h("span", { className: "dia-pk-check" }, icon("check")));
        row.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing in the search box
        row.addEventListener("click", () => { picker.active = picker.rows.findIndex((r) => r.el === row); togglePicked(it); });
        els.push(row);
        picker.rows.push({ el: row, item: it });
      }
      picker.list.replaceChildren(...els);
      picker.active = Math.min(picker.active, Math.max(0, picker.rows.length - 1));
      markActive(false);
      // quick chips: add a whole tab group in one tap
      const chips = [];
      picker.chips = [];
      if (picker.mode === "tabs" && !picker.search.value.trim()) {
        for (const g of tabGroupsList()) {
          const tabs = (g.tabs || []).filter((t) => t !== src && isWebTab(t));
          if (tabs.length < 2) continue;
          const keys = tabs.map(tabUrl);
          const el = h("button", { className: "dia-pk-chip", type: "button", title: `Add all ${tabs.length} tabs in this group` }, icon("folder"), h("span", { textContent: `${g.label || "Group"} · ${tabs.length}` }));
          el.addEventListener("mousedown", (e) => e.preventDefault());
          el.addEventListener("click", () => { if (keys.every(isOn)) { refs = refs.filter((r) => !keys.includes(keyOf(r)) || r.locked); renderPills(); } else addGroup(g); });
          chips.push(el); picker.chips.push({ el, keys });
        }
      }
      picker.chipRow.replaceChildren(...chips);
      syncPicker();
    }
    function markActive(scroll = true) {
      picker.rows.forEach((r, i) => r.el.classList.toggle("dia-active", i === picker.active));
      if (scroll) picker.rows[picker.active]?.el.scrollIntoView({ block: "nearest" });
    }
    function togglePicked(it) {
      if (isOn(it.key)) { refs = refs.filter((r) => keyOf(r) !== it.key || r.locked); renderPills(); }
      else it.add();
    }
    function setPickerMode(mode) {
      if (!picker) return;
      picker.mode = mode;
      picker.segTabs.classList.toggle("on", mode === "tabs");
      picker.segLinks.classList.toggle("on", mode === "links");
      picker.search.placeholder = mode === "links" ? "Search links on this page" : "Search open tabs";
      picker.active = 0;
      if (mode === "links" && !picker.links) {
        const me = picker;
        linksNow().then((l) => { if (picker === me) { picker.links = l; paintPicker(); } });
      }
      paintPicker();
    }
    function openPicker(mode = "tabs", q = "") {
      closePop(); closePicker();
      const search = h("input", { type: "text", value: q, placeholder: "Search open tabs", spellcheck: false });
      const segTabs = h("button", { className: "on", type: "button", textContent: "Tabs", onclick: () => setPickerMode("tabs") });
      const segLinks = h("button", { type: "button", textContent: "Links", onclick: () => setPickerMode("links") });
      const chipRow = h("div", { className: "dia-pk-chips" });
      const list = h("div", { className: "dia-pk-list", role: "listbox" });
      const count = h("span", { className: "dia-pk-count" });
      const addAll = h("button", { className: "dia-pk-btn", type: "button", textContent: "Add all", onclick: () => {
        const room = Math.max(0, MAX_REFS - refs.length);
        const todo = picker.items.filter((it) => !isOn(it.key));
        todo.slice(0, room).forEach((it) => it.add());
        if (todo.length > room) flashNote(`Added ${room}. Up to ${MAX_REFS} attachments at a time.`);
      } });
      const clear = h("button", { className: "dia-pk-btn", type: "button", textContent: "Clear", onclick: () => { refs = refs.filter((r) => r.kind !== "tab" || r.pageSource || r.locked); renderPills(); } });
      const done = h("button", { className: "dia-pk-btn dia-pk-done", type: "button", textContent: "Done", onclick: () => { closePicker(); focusInput(); } });
      for (const b of [segTabs, segLinks, addAll, clear, done]) b.addEventListener("mousedown", (e) => e.preventDefault());
      const el = h("div", { className: "dia-menu dia-picker" },
        h("div", { className: "dia-pk-top" }, h("div", { className: "dia-pk-seg" }, segTabs, segLinks), h("div", { className: "dia-search" }, icon("search"), search)),
        chipRow, list, h("div", { className: "dia-pk-foot" }, count, clear, addAll, done));
      composerEl.append(el);
      picker = { el, search, list, chipRow, count, clear, segTabs, segLinks, mode: "tabs", rows: [], items: [], chips: [], active: 0, links: cachedLinks() };
      search.addEventListener("input", () => { picker.active = 0; paintPicker(); });
      search.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (picker.rows.length) { picker.active = (picker.active + (e.key === "ArrowDown" ? 1 : -1) + picker.rows.length) % picker.rows.length; markActive(); } }
        else if (e.key === "Enter" || (e.key === " " && !search.value)) { e.preventDefault(); const r = picker.rows[picker.active]; if (r) togglePicked(r.item); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePicker(); focusInput(); }
      });
      setTimeout(() => { if (picker) document.addEventListener("pointerdown", onPickerDown, true); }, 0);
      setPickerMode(mode);
      setTimeout(() => search.focus(), 0);
    }

    const snapshotTabs = () => gBrowser.tabs.filter((t) => !t.hidden && !t.hasAttribute?.("zen-empty-tab")).slice(0, 60);
    const tabListText = (tabs) => tabs.map((t, i) =>
      `${i + 1}. ${(t.label || "Untitled").slice(0, 80)} — ${t.linkedBrowser?.currentURI?.spec || ""}` +
      (t.pinned ? " [pinned]" : "") + (t.group?.label ? ` [group: ${t.group.label}]` : "") + (t === gBrowser.selectedTab ? " [current]" : "")
    ).join("\n");

    // ----- popup menu: / skills, @ mentions, + add -----
    const onDocDown = (e) => { if (pop && !pop.el.contains(e.target) && !e.target.closest(".dia-add")) closePop(); };
    function closePop() {
      if (!pop) return;
      pop.el.remove(); pop = null;
      document.removeEventListener("pointerdown", onDocDown, true);
    }
    function showPop(trigger, start, items) {
      const keep = pop && pop.trigger === trigger ? pop.idx : 0;
      const sel = items.map((it, k) => (it.sep ? -1 : k)).filter((k) => k >= 0);
      if (!sel.length) { closePop(); return; }
      const hadListener = !!pop;
      pop?.el.remove();
      const idx = Math.min(keep, sel.length - 1);
      const el = h("div", { className: "dia-menu" });
      const rows = [];
      items.forEach((it, k) => {
        if (it.sep) { el.append(h("div", { className: "dia-menu-sep", textContent: it.sep })); return; }
        const row = h("button", { className: "dia-menu-item" + (k === sel[idx] ? " dia-active" : ""), title: it.title || "" });
        row.append(
          it.image ? h("img", { className: "dia-menu-ico", src: it.image, onerror: (e) => e.target.replaceWith(icon(it.ico || "page")) }) : icon(it.ico || "page"),
          h("span", { className: "dia-menu-label", textContent: it.label })
        );
        if (it.sub) row.append(h("span", { className: "dia-menu-sub", textContent: it.sub }));
        row.addEventListener("mousedown", (e) => { e.preventDefault(); pickPop(k); });
        el.append(row);
        rows[k] = row;
      });
      composerEl.append(el);
      pop = { el, items, rows, sel, idx, trigger, start };
      if (!hadListener) setTimeout(() => document.addEventListener("pointerdown", onDocDown, true), 0);
    }
    function movePop(d) {
      if (!pop) return;
      pop.idx = (pop.idx + d + pop.sel.length) % pop.sel.length;
      pop.sel.forEach((k, i) => pop.rows[k].classList.toggle("dia-active", i === pop.idx));
      pop.rows[pop.sel[pop.idx]]?.scrollIntoView({ block: "nearest" });
    }
    function pickPop(k) {
      if (!pop) return;
      const it = pop.items[k], { start, trigger } = pop;
      closePop();
      if (trigger !== "plus" && start >= 0 && input) { // remove the "/query" or "@query" the user typed
        const v = input.value, caret = input.selectionStart ?? v.length;
        input.value = v.slice(0, start) + v.slice(caret);
        input.selectionStart = input.selectionEnd = start;
        autosize();
      }
      input?.focus();
      it.run?.();
    }
    const tabItems = (tabs) => tabs.map((t) => ({ label: t.label || "Tab", image: t.image, ico: "page", sub: isOn(tabUrl(t)) ? "Added" : hostOf(tabUrl(t)), title: t.label || "", run: () => addTab(t) }));
    const toolItems = (q) => {
      const out = [];
      if (!q || "tabs".startsWith(q) || "manage".startsWith(q)) out.push({ label: "@Tabs", ico: "folder", sub: "Manage open tabs", run: () => { manage = true; renderPills(); } });
      if (!q || "web".startsWith(q) || "search".startsWith(q)) out.push({ label: "@Web", ico: "globe", sub: "Let it search the internet", run: () => { setWeb(true); } });
      return out;
    };
    function slashMenu(start, q) {
      const skills = skillsFor(isVid()).filter((s) => !q || s.name.toLowerCase().includes(q));
      const items = [];
      if (skills.length) items.push({ sep: "Skills" }, ...skills.map((s) => ({ label: s.name, ico: "spark", sub: s.custom ? "yours" : "", run: () => pickSkill(s) })));
      items.push({ sep: "Manage" }, { label: "New skill…", ico: "plus", run: () => openSkills(true) }, { label: "Browse skills…", ico: "spark", run: () => openSkills() });
      showPop("slash", start, items);
    }
    function atMenu(start, q) {
      const match = (s) => !q || (s || "").toLowerCase().includes(q);
      const matchingTabs = webTabs().filter((t) => match(t.label) || match(tabUrl(t)));
      const tabs = matchingTabs.slice(0, 8);
      const groups = tabGroupsList().filter((g) => match(g.label)).slice(0, 4);
      const fm = FORMATS.filter((f) => !q || f.name.startsWith(q));
      const tools = toolItems(q);
      // links on the page: matches show up as you type (the page's links are read in the background the first time)
      const lk = cachedLinks();
      if (!lk && !linkCache.pending && srcUrl() && !ytId(srcUrl())) { linkCache.pending = true; linksNow().then(() => { linkCache.pending = false; }); }
      const linkHits = lk && q.length >= 2 ? rankLinks(lk, q).filter((l) => l.s >= 2.5 && l.kind !== "nav").slice(0, 3) : [];
      const items = [];
      if (tabs.length) items.push({ sep: "Tabs" }, ...tabItems(tabs));
      if (linkHits.length) items.push({ sep: "Links on this page" }, ...linkHits.map((l) => ({ label: l.title, image: "page-icon:" + l.url, ico: "globe", sub: hostOf(l.url), title: l.url, run: () => addLink(l) })));
      if (matchingTabs.length > 8 || lk?.length) items.push({ label: "Browse tabs & links…", ico: "folder", sub: matchingTabs.length > 8 ? `${matchingTabs.length} tabs` : "", run: () => openPicker("tabs", q) });
      if (groups.length) items.push({ sep: "Tab groups" }, ...groups.map((g) => ({ label: g.label || "Unnamed group", ico: "folder", sub: (g.tabs || []).length + " tabs", run: () => addGroup(g) })));
      if (fm.length) items.push({ sep: "Formats" }, ...fm.map((f) => ({ label: "@" + f.name, ico: "edit", sub: f.hint, run: () => { formats = formats.includes(f) ? formats : [...formats, f]; renderPills(); } })));
      if (tools.length) items.push({ sep: "Tools" }, ...tools);
      showPop("at", start, items);
    }
    function plusMenu() {
      if (pop?.trigger === "plus") { closePop(); return; }
      closePop(); closePicker();
      const count = webTabs().length;
      const items = [
        { label: "Add tabs & links…", ico: "folder", sub: count ? `${count} open` : "", run: () => openPicker("tabs") },
        { label: "Attach file or image…", ico: "clip", run: pickFile },
        { label: "Paste clipboard text", ico: "copy", run: pasteCard },
      ];
      if (!usePage && !started && srcUrl()) items.push({ label: "Add this page", ico: "page", run: () => { usePage = true; renderPills(); } });
      items.push({ label: webOn ? "Turn off web search" : "Search the web", ico: "globe", run: () => setWeb(!webOn) });
      items.push({ sep: "Skills  ·  or type /" }, { label: "Browse skills…", ico: "spark", run: () => openSkills() }, { label: "New skill…", ico: "plus", run: () => openSkills(true) });
      items.push({ sep: "Tools" }, ...toolItems(""));
      showPop("plus", -1, items);
    }
    function updatePop() {
      if (!input) return;
      const v = input.value, caret = input.selectionStart ?? v.length, before = v.slice(0, caret);
      let m = before.match(/(?:^|\s)\/([^\s/]*)$/);
      if (m) return slashMenu(caret - m[1].length - 1, m[1].toLowerCase());
      m = before.match(/(?:^|\s)@([^\s@]*)$/);
      if (m) return atMenu(caret - m[1].length - 1, m[1].toLowerCase());
      if (pop && pop.trigger !== "plus") closePop();
    }
    // The persistent globe forces a search for each message in this chat, including when global
    // search is Off. Browser-side search works for AFM and other models without a native search tool.
    // The line above the text box: always there while web search is on, and shown for a few seconds after it is turned off
    function clearWebStatus() { clearTimeout(webOffTimer); webOffTimer = null; if (webStatusEl) { webStatusEl.remove(); webStatusEl = null; } }
    function syncWebStatus(offFlash) {
      if (!input || !input.parentNode) return;
      if (!webOn && !offFlash) { if (!webOffTimer) clearWebStatus(); return; } // keep a "turned off" message until its timer ends
      if (!webStatusEl) {
        webStatusEl = h("div", { className: "dia-webstatus", onclick: () => { if (webOn) setWeb(false); } });
        webStatusEl.setAttribute("role", "status");
        webStatusEl.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing focus in the box
      }
      if (webOn) {
        clearTimeout(webOffTimer); webOffTimer = null;
        webStatusEl.className = "dia-webstatus";
        webStatusEl.title = "Click to turn web search off";
        webStatusEl.replaceChildren(icon("globe"), h("span", {}, h("b", { textContent: "Web search is on" })), h("span", { className: "dia-webstatus-act", textContent: "Turn off" }));
      } else {
        clearTimeout(webOffTimer);
        webStatusEl.className = "dia-webstatus dia-off";
        webStatusEl.title = "";
        webStatusEl.replaceChildren(icon("globe"), h("span", { textContent: "Web search is off: it will only use links on this page." }));
        webOffTimer = setTimeout(clearWebStatus, 4500);
      }
      if (webStatusEl.nextSibling !== input) input.before(webStatusEl);
    }
    function updateWebBtn(offFlash) {
      if (!webBtnEl) return;
      webBtnEl.classList.toggle("on", webOn);
      webBtnEl.setAttribute("aria-pressed", String(webOn));
      webBtnEl.title = webOn ? "The internet is on for this chat. Click to turn it off." : "Let the assistant search the internet. Without it, it only uses links on the page you're on.";
      syncWebStatus(offFlash === true);
    }
    function setWeb(on) {
      const was = webOn;
      webOn = !!on;
      updateWebBtn(was && !webOn);
    }
    function pickSkill(s) { skill = s; renderPills(); focusInput(); }

    // ----- request building -----
    // the page text fitted to the model in use (cached per size, so switching models mid-chat re-fits it)
    function pageCtx() {
      const size = chunkSize();
      if (page.text.length <= size) return page.text;
      page.ctx = page.ctx || {};
      try { return (page.ctx[size] ??= condense(page.text, size)); } catch { return page.text.slice(0, size); }
    }
    const refHead = (r) =>
      r.kind === "tab" ? `ANOTHER TAB THE USER ATTACHED (${r.label || "tab"})`
      : r.kind === "clip" ? "TEXT THE USER PASTED IN"
      : r.kind === "file" || r.kind === "pdf" ? `FILE THE USER ATTACHED (${r.label})`
      : "TEXT THE USER SELECTED ON THE PAGE";
    const sendsRaw = (r) => (r.kind === "image" && canSeeFiles()) || (r.kind === "pdf" && rawPdf()); // sent as image/document blocks
    // the text a user turn carries: the request, @format hints, attached tabs/files/selections, tab list
    function userText(m, withTabs) {
      const apple = provider() === "apple";
      let t = apple && (m.fromSkill || m.content === DEFAULT_PROMPT || m.content === pref("prompt", DEFAULT_PROMPT)) ? chatty(m.content) : m.content;
      const fm = (m.formats || []).map((id) => FORMATS.find((f) => f.id === id)?.prompt).filter(Boolean);
      if (fm.length) t += "\n\n" + fm.join(" ");
      for (const r of m.refs || []) {
        if (r.kind === "image" || sendsRaw(r) || r.loading) continue;
        const cap = r.kind === "file" ? (apple ? 3000 : 20000) : apple ? 2000 : 8000;
        t += `\n\n=== ${refHead(r)} ===\n${(r.text || "").slice(0, cap)}`;
      }
      if (m.manage && withTabs) t += `\n\n=== OPEN TABS ===\n${tabListText(tabSnap)}\n\n${TABS_PROTOCOL}`;
      // Keep a pile of attachments from overwhelming the small on-device context window.
      return apple && t.length > 3600 ? t.slice(0, 3560) + "\n[…additional request or attachment text omitted]" : t;
    }
    // Every request is rebuilt from scratch. Cloud/large models get the page in the system prompt plus
    // real multi-turn history. Apple's tiny on-device model ignores history, so it gets one flattened turn.
    function buildRequest(resuming, webCtx, deep, lead, queryHint = "") {
      const lastU = [...convo].reverse().find((m) => m.role === "user");
      const firstU = convo.find((m) => m.role === "user");
      const firstTurn = lastU === firstU;
      const includePage = !!(page && !page.none && (firstTurn ? lastU?.pageContext !== false : !pageRefPromoted));
      const req = lastU?.content || pref("prompt", DEFAULT_PROMPT);
      const noWebNote = "\n\nYou cannot search or browse the internet in this chat. Work only from the page, what the user attached, and the page's own links listed above (if any). If the answer isn't there, say so plainly and mention that they can press the globe button to let you search the web. Never claim to have looked anything up online.";
      // when a sentence was already said before researching, the answer carries on from it
      const leadNote = lead ? `\n\nYou have already started this reply by telling the user: “${lead}” Carry straight on from there with what you found. Don't repeat that sentence or greet them again.` : "";
      let ctx = includePage ? pageCtx() : "";
      // On YouTube every transcript line is prefixed with its [mm:ss] stamp (so "Key moments" can cite
      // times). For anything not about timing, strip them so the model doesn't echo them.
      if (includePage && page?.youtube && !/\btimestamp|\bmoment|\bchapter|time ?code|mm:ss|\bjump to\b/i.test(req)) {
        ctx = ctx.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/gm, "").replace(/ \(each line is prefixed with its \[mm:ss\] timestamp\)/, "");
      }
      const apple = provider() === "apple";
      // the page's links, most relevant to this request first. On the small model the links get their own share of the
      // window: they used to sit after the page text and were cut off by its limit, so the model never saw them.
      // (follow-up turns carry the page as its removable card instead, so the links stay for as long as the page does)
      const linksOn = !!(page && !page.none && page.links?.length && (includePage || (lastU?.refs || []).some((r) => r.pageSource)));
      const linkTxt = linksOn ? linksPrompt(page.links, req, apple ? (webCtx ? 420 : 760) : 7000, apple ? 8 : 40, apple) : "";
      const pageBlock = includePage ? `=== PAGE THE USER IS VIEWING ===\nTitle: ${page.title}\nURL: ${page.url}\n\n${ctx}${linkTxt}` : linkTxt.trim();
      if (apple) {
        const upto = resuming ? convo : convo.slice(0, convo.lastIndexOf(lastU));
        const transcript = upto.slice(-2).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${(m.label || m.content).slice(0, 500)}`).join("\n");
        const fit = (text, limit) => text.length <= limit ? text : text.slice(0, limit - 44) + "\n[…context shortened for the on-device model]";
        const budget = webCtx ? 2200 : 4200;
        const body = deep ? `=== PAGE THE USER IS VIEWING (notes from reading all of it) ===\nTitle: ${page.title}\nURL: ${page.url}\n\n${deep}` : `=== PAGE THE USER IS VIEWING ===\nTitle: ${page.title}\nURL: ${page.url}\n\n${ctx}`;
        const pageContext = includePage ? fit(body, Math.max(900, budget - linkTxt.length)) + linkTxt : linkTxt.trim();
        const webContext = webCtx ? fit(webCtx.text, 2600) : "";
        const ask = resuming ? "Continue your previous answer exactly where it stopped, without repeating it." : userText(lastU || { content: req }, true);
        return {
          system: systemPrompt() + leadNote + (lastU?.web ? "" : noWebNote), pageBlock: "", web: false,
          messages: [{ role: "user", content:
            (pageContext ? (includePage ? "Use the web page below to respond to the user's request." + (effort() <= 1 ? " Be concise." : "") + "\n\n" : "") + pageContext + "\n\n" : "") +
            (webContext ? webContext + "\n\n" : "") +
            (transcript ? `=== CONVERSATION SO FAR ===\n${transcript}\n\n` : "") + `=== REQUEST ===\n${ask}` }],
        };
      }
      const msgs = convo.slice(-24).map((m) => m.role === "assistant"
        ? { role: "assistant", content: m.content }
        : { role: "user", content: apiContent(userText(m, m === lastU), (m.refs || []).filter(sendsRaw)) });
      while (msgs[0]?.role === "assistant") msgs.shift();
      if (resuming) msgs.push({ role: "user", content: "Continue exactly where you stopped. Do not repeat what you already wrote." });
      const linkSearch = WANTS_PAGE_LINKS.test(lastU?.label || lastU?.content || "");
      const forced = !!lastU?.web; // the globe: the only thing that lets a request reach the internet
      const nativeWeb = isNative() && !ownSearch() && !searchBroken.has(provider()) && forced && !linkSearch; // page-link requests use the captured page links directly
      return { system: systemPrompt() + leadNote + (forced ? "" : noWebNote), pageBlock: [pageBlock, webCtx?.text].filter(Boolean).join("\n\n"), messages: msgs, web: nativeWeb, forceWeb: forced, queryHint: nativeWeb ? queryHint : "" };
    }

    // ----- messages in the log -----
    function userMsg(entry, pageAtt) {
      const chips = [];
      if (pageAtt) chips.push(pill({ label: pageAtt.label, image: pageAtt.image, ico: "page", tip: pageAtt.url }));
      for (const r of entry.refs || []) chips.push(pill(refMeta(r)));
      const imgs = (entry.refs || []).filter((r) => r.kind === "image" && r.dataUrl).map((r) => h("img", { className: "dia-sentimg", src: r.dataUrl, title: r.label }));
      const bubble = h("div", { className: "dia-ubub", textContent: entry.label || entry.content });
      const block = h("div", { className: "dia-msg dia-ug" },
        ...(imgs.length ? [h("div", { className: "dia-sent" }, ...imgs)] : []),
        ...(chips.length ? [h("div", { className: "dia-sent" }, ...chips)] : []),
        bubble,
        h("div", { className: "dia-ug-tools" }, h("button", { className: "dia-icon", title: "Edit message", onclick: () => editMsg(block, entry) }, icon("edit"))));
      return block;
    }
    // edit a message you sent: everything after it is dropped and the answer is regenerated
    function editMsg(block, entry) {
      if (busy || block.querySelector(".dia-edit")) return;
      const bubble = block.querySelector(".dia-ubub");
      const ta = h("textarea", { value: entry.label || entry.content, rows: 3 });
      const done = () => { editor.remove(); bubble.hidden = false; };
      const save = () => {
        const v = ta.value.trim();
        if (!v) return;
        const i = convo.indexOf(entry);
        if (i < 0) return done();
        convo.length = i + 1; // drop the old answer and everything after
        entry.content = v; entry.label = v;
        bubble.textContent = v;
        while (block.nextSibling) block.nextSibling.remove();
        done();
        generate();
      };
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); save(); }
        if (e.key === "Escape") { e.stopPropagation(); done(); }
      });
      const editor = h("div", { className: "dia-edit" }, ta,
        h("div", { className: "dia-edit-row" },
          h("button", { className: "dia-btn", textContent: "Cancel", onclick: done }),
          h("button", { className: "dia-btn dia-primary", textContent: "Save & resend", onclick: save })));
      bubble.hidden = true;
      bubble.after(editor);
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }

    const blockEntry = new WeakMap(); // answer block -> its message in `convo`
    const citesOf = (m) => (m?.numbered ? m.sources : null); // numbered sources behind [1], [2]… citations
    // "Searched “…”" plus a chip per source (numbered when the answer cites them as [n])
    function sourcesRow(m) {
      const src = m?.sources || [], qs = m?.queries || [];
      if (!src.length && !qs.length) return null;
      const row = h("div", { className: "dia-sources" });
      if (qs.length) row.append(h("span", { className: "dia-searched" }, icon("search"), `Searched “${qs[0]}”` + (qs.length > 1 ? ` +${qs.length - 1}` : "")));
      src.slice(0, 6).forEach((s, i) => {
        const host = hostOf(s.url);
        const redirect = /vertexaisearch|googleusercontent/.test(host); // Gemini links go through Google; its title is the real domain
        const label = redirect ? s.title || host : host || s.title;
        const fav = redirect ? (/^[\w.-]+\.[a-z]{2,}$/i.test(s.title || "") ? "page-icon:https://" + s.title : "") : "page-icon:" + s.url;
        row.append(h("a", { className: "dia-src", href: "#", title: `${s.title || ""}\n${s.url}`, onclick: (e) => { e.preventDefault(); openLink(s.url); } },
          ...(m.numbered ? [h("b", { textContent: String(i + 1) })] : []),
          ...(fav ? [h("img", { className: "dia-fav", src: fav, onerror: (e) => e.target.remove() })] : []),
          h("span", { textContent: label })));
      });
      if (src.length > 6) row.append(h("span", { className: "dia-searched", textContent: `+${src.length - 6}` }));
      return row;
    }
    const seekFn = () => (page?.youtube && ytId(page.url) === ytId(srcUrl() || "") ? (s) => seekVideo(src.linkedBrowser, s) : null);
    function actionsRow(block, partial) {
      const mini = (ico, label, fn) => h("button", { className: "dia-mini", title: label, onclick: fn }, icon(ico), label);
      const row = h("div", { className: "dia-actions" });
      row.append(copyBtn(() => blockEntry.get(block)?.content || ""));
      row.append(mini("edit", "Edit", () => editAnswer(block)));
      if (partial) row.append(mini("play", "Resume", () => resume(block)));
      row.append(mini("refresh", "Regenerate", regenerate));
      return row;
    }
    // edit an answer in place: your edit becomes what the model sees on the next turn
    function editAnswer(block) {
      const entry = blockEntry.get(block);
      if (busy || !entry || block.querySelector(".dia-edit")) return;
      const answerEl = block.querySelector(".dia-answer");
      const ta = h("textarea", { value: entry.content, rows: 8 });
      const actions = block.querySelector(".dia-actions");
      const done = () => { editor.remove(); answerEl.hidden = false; if (actions) actions.hidden = false; };
      const save = () => {
        const v = ta.value.trim();
        if (!v) return;
        entry.content = v; entry.partial = false;
        const { text } = extractActions(v);
        renderMd(answerEl, text, seekFn(), Infinity, citesOf(entry));
        block.querySelector(".dia-mini[title=Resume]")?.remove();
        done();
        saveChat();
      };
      ta.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(); } });
      const editor = h("div", { className: "dia-edit" }, ta, h("div", { className: "dia-edit-row" },
        h("button", { className: "dia-btn", textContent: "Cancel", onclick: done }),
        h("button", { className: "dia-btn dia-primary", textContent: "Save", onclick: save })));
      answerEl.hidden = true;
      if (actions) actions.hidden = true;
      answerEl.after(editor);
      ta.focus();
    }

    // a proposal from "@Tabs": nothing happens until you press Apply
    function actionCard(actions) {
      const lines = [], runs = [];
      const byId = (id) => tabSnap[Number(id) - 1];
      for (const a of actions) {
        if (a.type === "close") {
          const ts = (a.ids || []).map(byId).filter((t) => t && !t.pinned && t !== src);
          if (ts.length) { lines.push(`Close ${ts.length} tab${ts.length > 1 ? "s" : ""}: ${ts.slice(0, 4).map((t) => t.label).join(", ")}${ts.length > 4 ? "…" : ""}`); runs.push(() => ts.forEach((t) => gBrowser.removeTab(t))); }
        } else if (a.type === "group") {
          const ts = (a.ids || []).map(byId).filter(Boolean);
          if (ts.length) { lines.push(`Group ${ts.length} tab${ts.length > 1 ? "s" : ""} as “${String(a.name || "Group").slice(0, 40)}”`); runs.push(() => gBrowser.addTabGroup(ts, { label: String(a.name || "Group").slice(0, 40) })); }
        } else if (a.type === "open") {
          const us = (a.urls || []).filter((u) => /^https?:\/\//.test(u)).slice(0, 10);
          if (us.length) { lines.push(`Open ${us.length} link${us.length > 1 ? "s" : ""}: ${us.slice(0, 3).map(hostOf).join(", ")}${us.length > 3 ? "…" : ""}`); runs.push(() => us.forEach(openLink)); }
        } else if (a.type === "switch") {
          const t = byId(a.id);
          if (t) { lines.push(`Switch to “${t.label}”`); runs.push(() => { gBrowser.selectedTab = t; }); }
        }
      }
      if (!runs.length) return null;
      const apply = h("button", { className: "dia-btn dia-primary", textContent: "Apply", onclick: () => {
        apply.disabled = true;
        let ok = true;
        for (const r of runs) { try { r(); } catch (e) { ok = false; console.warn("[dia-sidebar] tab action failed", e); } }
        apply.textContent = ok ? "Done" : "Some actions failed";
      } });
      return h("div", { className: "dia-act" }, h("ul", {}, ...lines.map((l) => h("li", { textContent: l }))), h("div", { className: "dia-act-row" }, apply));
    }

    // ----- queued messages (typed while an answer is still streaming) -----
    function renderQueue() {
      logEl?.querySelectorAll(".dia-queued").forEach((n) => n.remove());
      for (const q of queue) {
        logEl.append(h("div", { className: "dia-queued" },
          h("span", { textContent: q.label }),
          h("button", { className: "dia-mini", textContent: "Edit", title: "Pull this back into the message box", onclick: () => {
            queue = queue.filter((x) => x !== q); renderQueue();
            refs = [...q.refs, ...refs]; skill = q.skill || null; formats = q.formats; manage = q.manage;
            input.value = q.raw || ""; autosize(); renderPills(); focusInput();
          } }),
          h("button", { className: "dia-mini", textContent: "Send now", title: "Stop the current answer and send this now", onclick: () => { queue = [q, ...queue.filter((x) => x !== q)]; renderQueue(); stop(true); } }),
          h("button", { className: "dia-mini", title: "Remove", onclick: () => { queue = queue.filter((x) => x !== q); renderQueue(); } }, icon("close"))));
      }
      if (nearBottom()) scrollDown(false);
    }
    function drainQueue() {
      if (busy || closed || !queue.length) return;
      const next = queue.shift();
      renderQueue();
      dispatch(next);
    }

    // ----- generation -----
    async function generate(opts = {}) {
      ctrl?.abort();
      ctrl = new AbortController();
      const signal = ctrl.signal;
      const my = ++gen;
      stopped = false; generating = true;
      setBusy(true);
      const prior = opts.resume ? convo.at(-1) : null; // the partial assistant message being continued
      const block = opts.block || h("div", { className: "dia-msg dia-ai" });
      block.classList.add("dia-streaming");
      block.classList.remove("dia-pending");
      block.querySelector(".dia-actions")?.remove();
      block.querySelector(".dia-sources")?.remove();
      if (opts.resume) { // a continued answer is shown as one piece again
        block.querySelectorAll(".dia-flow").forEach((n) => n.remove());
        [...block.querySelectorAll(".dia-answer")].slice(1).forEach((n) => n.remove());
        block._flow = null;
      }
      let answerEl = block.querySelector(".dia-answer");
      if (!answerEl) { answerEl = h("div", { className: "dia-answer" }); block.append(answerEl); }
      answerEl.classList.remove("dia-seg-done");
      let flow = block._flow || (block._flow = makeFlow(block, answerEl));
      let segStart = 0, lead = ""; // the text so far is split into pieces around each research pill; `lead` is the sentence said before researching
      flow.wait(); // from the first moment something is alive on screen
      if (!block.isConnected) logEl.append(block);
      renderQueue();
      scrollDown(true);
      let acc = prior ? prior.content : "";
      let failed = false, thinkEl = null, thinkBody = null, thinkAcc = "", thinkT0 = 0, answerStarted = false, paintTimer = null;
      let webCtx = prior?.webText ? { text: prior.webText } : null, searchInfo = null; // fallback web search (models without a built-in tool)
      let cites = citesOf(prior);
      const qset = new Set(), srcMap = new Map();
      const seek = isVid() ? seekFn() : null;
      const wantTs = /\btimestamp|\bmoment|\bchapter|time ?code|mm:ss|\bjump to\b/i.test([...convo].reverse().find((m) => m.role === "user")?.content || "");
      const clean = (t) => (page?.youtube && seek ? scrubStamps(wantTs ? snapToChapters(t, page.chapters) : t, page.seconds, wantTs) : t);
      const view = (t) => expandLinkRefs(t, page?.links); // [L3] -> a real link
      const onThink = (d) => {
        thinkAcc += d;
        if (!thinkEl) {
          thinkT0 = Date.now();
          thinkBody = h("div", { className: "dia-think-body" });
          thinkEl = h("details", { className: "dia-think dia-live", open: true }, h("summary", {}, icon("chev"), h("span", { textContent: "Thinking…" })), thinkBody);
          block.insertBefore(thinkEl, answerEl);
        }
        flow.dropQuiet();
        thinkBody.textContent = thinkAcc;
        thinkBody.scrollTop = thinkBody.scrollHeight;
        if (nearBottom()) scrollDown(false);
      };
      const endThink = () => {
        if (!thinkEl || !thinkEl.classList.contains("dia-live")) return;
        thinkEl.classList.remove("dia-live");
        thinkEl.open = false;
        thinkEl.querySelector("summary span").textContent = `Thought for ${Math.max(1, Math.round((Date.now() - thinkT0) / 1000))}s`;
      };
      // Text appears as it arrives, a few words at a time, each new slice easing in. A slice never ends inside a word or
      // inside **bold**, `code`, a [link](…) or a [L3] label, so nothing flashes half-formed, and a timer makes sure
      // the last words show up even when the stream pauses.
      let shown = acc.length, lastPaint = 0;
      const settle = () => { if (answerStarted) return; answerStarted = true; endThink(); flow.end("done"); };
      const paint = (end = acc.length) => {
        if (end <= shown) return;
        settle();
        const stick = nearBottom();
        renderMd(answerEl, view(acc.slice(segStart, end)), seek, view(acc.slice(segStart, shown)).length, cites);
        shown = end;
        lastPaint = Date.now();
        if (stick) scrollDown(false);
      };
      const revealEnd = (force) => {
        let end = acc.length;
        if (!force && !/\s$/.test(acc)) end = acc.search(/\S*$/); // only whole words
        const ls = acc.lastIndexOf("\n", end - 1) + 1, cur = acc.slice(ls, end);
        let cut = -1;
        const lim = (i) => { if (i >= 0 && (cut < 0 || i < cut)) cut = i; };
        if ((cur.match(/`/g) || []).length % 2) lim(cur.lastIndexOf("`"));
        if ((cur.match(/\*\*/g) || []).length % 2) lim(cur.lastIndexOf("**"));
        if ((cur.match(/~~/g) || []).length % 2) lim(cur.lastIndexOf("~~"));
        const ob = cur.lastIndexOf("[");
        if (ob >= 0 && cur.indexOf("]", ob) < 0) lim(ob);
        const lk = cur.search(/\[[^\[\]]*\]\([^)\s]*$/);
        if (lk >= 0) lim(lk);
        if (cut >= 0) end = ls + cut;
        return end > shown ? end : -1;
      };
      const flush = () => {
        paintTimer = null;
        let e = revealEnd(false);
        if (e < 0 && Date.now() - lastPaint > 2500) e = revealEnd(true); // never sit on text for long
        if (e > 0) paint(e);
      };
      const schedule = () => { if (!paintTimer) paintTimer = setTimeout(flush, Math.max(0, 110 - (Date.now() - lastPaint))); };
      // The assistant has said something and is about to look further (a search, a link): park the text where it is, give
      // the research its own pill below it, and let the rest of the answer continue underneath, like a chat would.
      const newPhase = () => {
        clearTimeout(paintTimer); paintTimer = null;
        if (acc.length > shown) paint();
        if (!answerStarted) return; // nothing said yet: the pill simply goes at the top
        const seg = view(clean(acc.slice(segStart)));
        renderMd(answerEl, seg, seek, Infinity, cites);
        answerEl.classList.add("dia-seg-done");
        acc = acc.slice(0, segStart) + seg + "\n\n";
        segStart = shown = acc.length;
        flow = makeFlow(block, null, true);
        block._flow = flow;
        answerEl = h("div", { className: "dia-answer" });
        block.append(answerEl);
        answerStarted = false;
      };
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      // a sentence that is already known is revealed a couple of words at a time, as if it were being typed
      const typeOut = async (text) => {
        const words = text.match(/\S+\s*/g) || [text];
        for (let i = 0; i < words.length; i += 2) {
          if (signal.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
          acc += words.slice(i, i + 2).join("");
          schedule();
          await sleep(55);
        }
        await sleep(160);
      };
      const finalRender = (text) => {
        const { text: body, actions } = extractActions(text);
        renderMd(answerEl, body, seek, Infinity, cites); // final solid pass, no fade boundary
        block.querySelector(".dia-act")?.remove();
        if (actions) { const card = actionCard(actions); if (card) block.append(card); }
      };
      if (prior) renderMd(answerEl, view(acc), seek, Infinity, cites);
      try {
        if (!llmReady()) {
          flow.dropQuiet();
          acc = extractive(page?.text || "") || "Couldn't find enough text on this page to summarize.";
          renderMd(answerEl, acc, seek);
          answerEl.append(h("div", { className: "dia-note", textContent: "Offline summary. This model needs an API key: open the model menu at the top of the sidebar and edit it." }));
        } else {
          const lastU = [...convo].reverse().find((m) => m.role === "user");
          // Search from the browser (for models without a built-in tool, or when that tool was rejected):
          // the model writes a query, we search, read the top pages and hand them back as numbered sources.
          // questions that are plainly about the page itself never need a search, so skip the extra routing call
          const askText = lastU?.label || lastU?.content || "";
          const canWeb = !!lastU?.web; // the globe is on for this message
          const firstU = convo.find((m) => m.role === "user");
          const searchPage = (lastU === firstU && lastU?.pageContext === false) ? null : page;
          const sameUrl = (a, b) => a.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase() === b.replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
          const rawIntent = linkIntent(askText);
          // without the globe, only links that are on the page that is already loaded may be opened
          const offPage = canWeb ? [] : rawIntent.urls.filter((u) => !(searchPage?.links || []).some((l) => sameUrl(l.url, u)));
          const intent = canWeb ? rawIntent : { ...rawIntent, urls: rawIntent.urls.filter((u) => !offPage.includes(u)) };
          intent.wants = !!(intent.textWants || intent.urls.length);
          if (offPage.length) block.insertBefore(h("div", { className: "dia-note", textContent: "That address isn't a link on this page, so I haven't opened it. Press the globe if you'd like me to go online." }), answerEl);
          const linkSearch = intent.wants;
          const skipRouter = !linkSearch && !canWeb && (askText.trim().length < 6 || ABOUT_PAGE.test(askText));
          const runFallback = async () => {
            if (skipRouter) return;
            const apple = provider() === "apple";
            const cap = apple ? 1100 : 3500;
            const pageLinks = searchPage?.links || [];
            try {
              let picks = [], query = "", alt = "", say = "";
              // 1) cheap local pass: explicit URLs, "the third source", a link named in the question, keyword overlap
              const local = pageLinks.length || intent.urls.length ? pickLinks(pageLinks, askText, intent, apple ? 3 : 4) : { picks: [], candidates: [], confident: false };
              // no globe and nothing on the page to follow: nothing to do (no extra model call either)
              if (!canWeb && !(intent.wants && local.picks.length && local.confident) && !local.candidates.length) {
                if (intent.textWants) block.insertBefore(h("div", { className: "dia-note", textContent: "I couldn't find a matching link on this page. Press the globe to let me search the web." }), answerEl);
                return;
              }
              if (intent.wants && local.picks.length && local.confident) {
                picks = local.picks;
                const why = local.picks[0].why;
                say = picks.length > 1 ? "Let me open those links and see what they say." : why === "url" ? "Let me open that page and see what it says." : "Let me open that link and see what it says.";
                flow.note(why === "url" ? "Using the link you gave" : why === "ordinal" ? "Found the link you meant" : `Matched ${picks.length === 1 ? "a link" : picks.length + " links"} on this page`, { kind: "links" });
              } else {
                // 2) the model chooses from a short candidate list (or decides to search the web, or to do nothing)
                const step = flow.begin(local.candidates.length ? `Looking through ${pageLinks.length} links on this page` : intent.wants ? "Deciding what to open" : "Deciding whether to look anything up", { kind: "plan", dots: true, done: "Chose what to look at" });
                const route = await planSearch(convo, searchPage, canWeb || intent.wants, signal, local.candidates, canWeb);
                say = route.say;
                if (route.links.length) { picks = route.links; step.done(`Picked ${picks.length} link${picks.length > 1 ? "s" : ""}`); }
                else if (intent.wants && local.picks.length) { picks = local.picks; step.done(`Picked ${picks.length} link${picks.length > 1 ? "s" : ""}`); }
                else if (route.query && canWeb) { query = route.query; alt = route.alt || ""; step.done("Decided to search the web"); } // only with the globe on
                else step.drop();
              }
              // like a chat: say what the page does (or doesn't) tell them, and that you're looking further, BEFORE going off to look
              if (picks.length || query) {
                lead = (say || (picks.length ? "Let me look into that link." : "Let me look that up.")).trim();
                await typeOut(lead);
                newPhase();
              }
              if (picks.length) {
                const step = flow.begin(picks.length === 1 ? `Opening ${hostOf(picks[0].url) || picks[0].title}` : `Opening ${picks.length} linked pages`, { kind: "read", ico: "globe", pill: picks.length === 1 ? "Reading a link" : "Reading links" });
                const chips = picks.map((l) => step.chip({ url: l.url, label: hostOf(l.url) || l.title }));
                const results = await readLinkPages(picks, signal, { cap, query: askText, chips, step, notes: apple && effort() >= 2 });
                const ok = results.filter((r) => !r.failed).length;
                step.done(ok === results.length ? (ok === 1 ? `Read ${hostOf(results[0].url) || "the page"}` : `Read ${ok} linked pages`) : `Read ${ok} of ${results.length} linked pages`);
                const from = searchPage?.title || "the current page";
                webCtx = { text: webBlock("from " + from, results, cap, true) };
                searchInfo = { query: "Links from " + from, sources: results.map((r) => ({ title: r.title, url: r.url })) };
                cites = searchInfo.sources;
              } else if (query) {
                const s1 = flow.begin(`Searching the web for “${query}”`, { kind: "search", ico: "globe", pill: "Searching the web", done: `Searched for “${query}”` });
                const found = await smartSearch(query, alt, signal, askText);
                const results = found.results;
                if (found.queries.length > 1) s1.set(`Searching the web for “${found.queries[0]}” and “${found.queries[1]}”`);
                s1.done(found.queries.length > 1 ? `Searched for “${found.queries[0]}” and “${found.queries[1]}”` : undefined);
                const s2 = flow.begin("Reading the top results", { kind: "read", ico: "globe", pill: "Searching the web" });
                const chips = results.slice(0, 3).map((r) => s2.chip({ url: r.url, label: hostOf(r.url) || r.title }));
                await readSources(results, signal, cap, query, chips);
                s2.done(`Read ${results.filter((r) => r.text).length} results`);
                webCtx = { text: webBlock(found.queries.join('" and "'), results, cap) };
                searchInfo = { query: found.queries.join(" · "), sources: results.map((r) => ({ title: r.title, url: r.url })) };
                cites = searchInfo.sources;
              }
            } catch (e) {
              if (signal.aborted) throw e;
              flow.active?.fail?.();
              block.insertBefore(h("div", { className: "dia-note", textContent: "Couldn't search the web: " + e.message }), answerEl);
            }
          };
          // the globe (web + links) or, without it, the links on the loaded page; the built-in search tool of Gemini/Claude only ever runs with the globe
          const wantsSearch = !prior && (canWeb || linkSearch || (!lastU?.fromSkill && !!searchPage?.links?.length));
          if (wantsSearch && (linkSearch || !isNative() || (canWeb && (ownSearch() || searchBroken.has(provider()))))) await runFallback();
          // Gemini/Claude run their own search tool, so first write the query from the whole conversation and hand it over
          let queryHint = "";
          if (wantsSearch && canWeb && !linkSearch && isNative() && !ownSearch() && !searchBroken.has(provider()) && (convo.length > 1 || searchPage?.title)) {
            const qs = flow.begin("Writing a search query from the conversation", { kind: "plan", dots: true, done: "Wrote a search query" });
            try {
              const c = await composeQuery(convo, searchPage, signal);
              if (c) { queryHint = c.query; qs.done(`Search query: “${c.query}”`); } else qs.drop();
            } catch (e) { if (signal.aborted) throw e; qs.drop(); }
          }
          // High effort on the small on-device model: read the whole page in parts, keep notes for this question
          let deep = null;
          if (provider() === "apple" && effort() >= 3 && !prior && lastU === firstU && lastU?.pageContext !== false && page && !page.none && page.text.length > chunkSize() * 1.3) {
            const ds = flow.begin("Reading the whole page in parts", { kind: "read", done: "Read the whole page" });
            try { deep = (await deepRead(lastU?.content || pref("prompt", DEFAULT_PROMPT), page.text, signal, (i, n) => ds.set(`Reading the page in parts (${i}/${n})`))) || null; }
            catch (e) { if (signal.aborted) throw e; deep = null; }
            ds.done();
          }
          const setStatus = (t) => flow.begin(t, { kind: "refine", done: /^Draft/.test(t) ? "Drafted an answer" : "Refined the answer" });
          for (let attempt = 0; ; attempt++) {
            try {
              let reqNow = buildRequest(!!prior, webCtx, deep, lead, queryHint);
              if (provider() === "apple" && effort() >= 4 && !prior) { // Max: draft first, then stream the improved answer
                reqNow = await refineRequest(reqNow, signal, setStatus);
                if (flow.active?.state === "active") flow.active.done();
              }
              if (reqNow.web && reqNow.forceWeb) flow.begin("Searching the web", { kind: "search", ico: "globe", done: "Searched the web" });
              else flow.wait();
              for await (const ev of streamLLM(reqNow, signal)) {
                if (ev.t === "think") { onThink(ev.d); continue; }
                if (ev.t === "status") {
                  const isSearch = /search/i.test(ev.d);
                  if (answerStarted && isSearch) newPhase(); // the model already said something, then went to search
                  if (answerStarted) flow.note(ev.d, { kind: "misc" });
                  else flow.begin(ev.d, isSearch ? { kind: "search", ico: "globe", pill: "Searching the web", done: "Searched the web" } : { kind: "misc" });
                  continue;
                }
                if (ev.t === "query") {
                  qset.add(ev.d);
                  const a = flow.active;
                  if (a && a.kind === "search" && a.state === "active" && !answerStarted) { a.set(`Searching “${ev.d}”`); a.doneText = `Searched “${ev.d}”`; }
                  else flow.note(`Searched “${ev.d}”`, { kind: "search" });
                  continue;
                }
                if (ev.t === "sources") {
                  for (const s of ev.d) srcMap.set(s.url, s);
                  const st = [...flow.steps].reverse().find((s) => s.kind === "search");
                  if (st && !st.chipped) {
                    st.chipped = true;
                    for (const s of ev.d.slice(0, 4)) {
                      const redirect = /vertexaisearch|googleusercontent/.test(hostOf(s.url));
                      st.chip({ url: s.url, label: (redirect ? s.title : hostOf(s.url)) || hostOf(s.url) || "source", icon: redirect ? (/^[\w.-]+\.[a-z]{2,}$/i.test(s.title || "") ? "page-icon:https://" + s.title : "") : "" }).done();
                    }
                  }
                  continue;
                }
                endThink();
                acc = acc.length > 20 && ev.d.startsWith(acc) ? ev.d : acc + ev.d; // tolerate cumulative streams
                schedule();
              }
              break;
            } catch (e) {
              // the built-in search tool was refused before any answer: remember it and search from the browser instead
              if (e.webUnavailable && attempt === 0 && !acc && !prior && canWeb) { searchBroken.add(provider()); await runFallback(); continue; }
              throw e;
            }
          }
          clearTimeout(paintTimer); paintTimer = null;
          endThink();
          paint();
          const lastSeg = view(clean(acc.slice(segStart)));
          acc = acc.slice(0, segStart) + lastSeg;
          finalRender(lastSeg);
          if (segStart && !lastSeg.trim()) answerEl.remove();
        }
      } catch (e) {
        clearTimeout(paintTimer); paintTimer = null;
        endThink();
        if (e.name === "AbortError") {
          if (stopped) { if (acc) { const seg = view(acc.slice(segStart)); acc = acc.slice(0, segStart) + seg; finalRender(seg); } }
          else if (my === gen) { failed = true; block.append(h("p", { className: "dia-error", textContent: "That took too long and was cancelled. Try again." })); }
        } else {
          failed = true;
          const unreachable = e instanceof TypeError;
          block.append(h("p", { className: "dia-error", textContent: unreachable ? `Couldn't reach ${activeModel().name} at ${baseUrl()}. Is it running?` : `Couldn't answer: ${userFacingError(e)}` }));
          const lastU = [...convo].reverse().find((m) => m.role === "user");
          const errRow = h("div", { className: "dia-actions" },
            h("button", { className: "dia-mini", textContent: "Retry", onclick: () => { if (busy) return; block.remove(); generate(); } }));
          if (responseStatus(e) === 429 && provider() === "gemini") {
            errRow.append(
              h("button", { className: "dia-mini", textContent: "Choose another model", onclick: () => openModels() }),
              h("button", { className: "dia-mini", textContent: "Check Gemini limits", onclick: () => openLink("https://aistudio.google.com/rate-limit?timeRange=last-28-days") }));
          }
          if (lastU?.refs?.length) errRow.append(h("button", { className: "dia-mini", textContent: "Retry without attachments", onclick: () => {
            if (busy) return; lastU.refs = []; block.remove(); generate(); } }));
          block.append(errRow);
          if (unreachable && !acc && page?.text && convo.length === 1) {
            const fb = h("div");
            renderMd(fb, extractive(page.text), seek);
            block.append(fb);
          }
        }
      }
      flow.end(failed ? "failed" : stopped ? "stopped" : "done");
      generating = false;
      if (closed || my !== gen) return;
      if (acc && !failed) {
        let entry = prior;
        if (prior) { prior.content = acc; prior.partial = stopped; }
        else { entry = { role: "assistant", content: acc, partial: stopped }; convo.push(entry); }
        const sources = searchInfo ? searchInfo.sources : [...srcMap.values()];
        const queries = searchInfo ? [searchInfo.query] : [...qset];
        if (sources.length) { entry.sources = sources; entry.numbered = !!searchInfo; }
        if (queries.length) entry.queries = queries;
        if (webCtx) entry.webText = webCtx.text; // kept in memory so Resume doesn't search again
        blockEntry.set(block, entry);
      }
      block.classList.remove("dia-streaming");
      if (acc && !failed) {
        const srow = sourcesRow(blockEntry.get(block));
        if (srow) block.append(srow);
        block.append(actionsRow(block, stopped));
      }
      setBusy(false);
      scrollDown(true);
      saveChat();
      if ((!stopped && !failed) || drainAfter) { drainAfter = false; drainQueue(); }
    }

    // ■ stops generating and keeps what was already written (Resume continues it). With sendNext, the
    // next queued message goes out right after ("steer").
    function stop(sendNext = false) {
      stopped = true;
      drainAfter = sendNext;
      ctrl?.abort();
      if (!generating) { // still reading the page
        gen++;
        setBusy(false);
        logEl?.querySelectorAll(".dia-pending").forEach((n) => { n._flow?.end("stopped"); n.remove(); });
        if (sendNext) { drainAfter = false; drainQueue(); }
      }
    }
    function resume(block) { if (busy || convo.at(-1)?.role !== "assistant") return; generate({ resume: true, block }); }
    function regenerate() {
      if (busy || !page) return;
      const blocks = logEl.querySelectorAll(".dia-ai");
      blocks[blocks.length - 1]?.remove();
      if (convo.at(-1)?.role === "assistant") convo.pop();
      generate();
    }

    // The first message loads the page text; later ones reuse it
    async function startFirst(entry) {
      const url = srcUrl();
      if (!url) {
        logEl.append(h("p", { className: "dia-msg dia-error", textContent: "Open a regular web page first, or remove the page from the message to chat without it." }));
        return;
      }
      ctrl?.abort();
      const my = ++gen;
      setBusy(true);
      // the answer's block exists from the first moment, so "Reading this page" is already visible and the same
      // activity list simply carries on into searching / thinking / writing
      const block = h("div", { className: "dia-msg dia-ai dia-pending" });
      const flow = (block._flow = makeFlow(block, null));
      const video = !!ytId(url);
      const rd = flow.begin(video ? "Fetching the video captions" : "Reading 1 attachment", { kind: "read", ico: video ? "play" : "clip", done: video ? "Read the captions" : "Read 1 attachment" });
      const pd0 = pageData();
      const chip = rd.chip({ url, label: (pd0?.label || hostOf(url) || "this page").slice(0, 40), icon: pd0?.image });
      logEl.append(block);
      scrollDown(true);
      try {
        page = await getPageText(src.linkedBrowser);
      } catch (e) {
        if (closed || my !== gen) { flow.end("stopped"); return; }
        if (entry.pageContext === false) {
          page = { none: true, title: "", url: "", text: "" };
          pageRefPromoted = true;
          flow.end("stopped");
          block.remove();
          convo.push(entry);
          renderPills();
          generate();
          return;
        }
        const msg = e.noCaptions
          ? "This video has no captions available, so there's no transcript to read."
          : `Couldn't read this ${video ? "video" : "page"}: ${e.message}`;
        chip.fail();
        flow.end("failed");
        block.replaceWith(h("p", { className: "dia-msg dia-error", textContent: msg }));
        setBusy(false);
        return;
      }
      if (closed || my !== gen) { flow.end("stopped"); if (!closed) page = null; return; }
      page.text = page.text.slice(0, MAX_CHARS * 2);
      ctrl = new AbortController();
      try { page.context = pageCtx(); } catch (e) { page.context = page.text.slice(0, chunkSize()); }
      chip.done();
      rd.done();
      if (page.links?.length) flow.note(`Found ${page.links.length} link${page.links.length === 1 ? "" : "s"} on the page`, { kind: "links" });
      pageRefPromoted = true;
      if (!refs.some((r) => r.pageSource)) {
        const pd = pageData() || { label: page.title || page.url, image: src.image };
        refs.push({ id: ++refSeq, kind: "tab", pageSource: true, label: page.title || pd.label, url: page.url || url, image: pd.image, text: page.text });
      }
      renderPills();
      convo.push(entry);
      generate({ block });
    }

    // ----- sending -----
    function snapshot(opts) {
      let q = opts.text !== undefined ? opts.text.trim() : input.value.trim();
      const sk = opts.text !== undefined ? null : skill;
      let label = opts.label || "";
      if (!q && !sk && !refs.length) return null;
      if (sk) {
        const base = sk.prompt || pref("prompt", DEFAULT_PROMPT);
        label = label || (q ? `${sk.name}: ${q}` : sk.name);
        q = q ? `${base}\n\nUser's additional input: ${q}` : base;
      } else if (!q) q = "Explain this.";
      return { q, label: label || q, raw: opts.text !== undefined ? "" : input.value.trim(), skill: sk, fromSkill: !!sk || !!opts.label, refs, formats, manage, web: webOn, usePage: usePage && !!srcUrl() };
    }
    function submit(opts = {}) {
      if (reading.size) { // a tab or link card is still reading: send as soon as it is in
        flashNote("Finishing reading your tabs…", true);
        Promise.allSettled([...reading]).then(() => { clearNote(); if (!closed) submit(opts); });
        return;
      }
      if (opts.text === undefined && !skill) { // typing a skill's name and pressing Return runs it, no slash needed
        const t = input.value.trim().toLowerCase();
        const m = t && skillsFor(isVid()).find((s) => s.name.toLowerCase() === t);
        if (m) { skill = m; input.value = ""; }
      }
      const snap = snapshot(opts);
      if (!snap) return;
      if (opts.text === undefined) { input.value = ""; autosize(); }
      refs = []; skill = null; formats = []; manage = false; // the composer empties (snapshot keeps the old ones)
      closePop(); closePicker();
      if (busy) { queue.push(snap); renderQueue(); renderPills(); return; }
      dispatch(snap);
    }
    function dispatch(snap) {
      logEl.querySelector(".dia-empty")?.remove();
      const firstMessage = !started;
      const pageAtt = firstMessage && snap.usePage ? pageData() : null;
      started = true;
      const entry = { role: "user", content: snap.q, label: snap.label, refs: snap.refs, formats: snap.formats.map((f) => f.id), manage: snap.manage, web: snap.web, fromSkill: snap.fromSkill, pageContext: firstMessage ? !!snap.usePage : undefined };
      logEl.append(userMsg(entry, pageAtt));
      if (!chatTitle) { chatTitle = snap.label.slice(0, 60); updateTitle(); }
      if (snap.manage) tabSnap = snapshotTabs();
      renderPills();
      scrollDown(true);
      if (firstMessage && !page) {
        if (srcUrl()) { startFirst(entry); return; }
        page = { none: true, title: "", url: "", text: "" };
        pageRefPromoted = true;
        renderPills();
      }
      convo.push(entry);
      generate();
    }
    const runSkill = (s) => submit({ text: s.prompt || pref("prompt", DEFAULT_PROMPT), label: s.name });

    // ----- history -----
    function saveChat() {
      if (!keepHistory() || !convo.length) return;
      if (!chatId) chatId = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const strip = (r) => ({ kind: r.kind, label: r.label, url: r.url, text: r.kind === "image" || r.kind === "pdf" ? "" : (r.text || "").slice(0, 2500) });
      store.upsert({
        id: chatId, ts: Date.now(), title: chatTitle || "Chat", url: page?.url || srcUrl() || "",
        page: page && !page.none ? { title: page.title, url: page.url, text: page.text.slice(0, 20000), links: (page.links || []).slice(0, 60).map((l) => ({ ...l, ctx: (l.ctx || "").slice(0, 140) })), youtube: !!page.youtube, seconds: page.seconds, chapters: page.chapters } : null,
        msgs: convo.map((m) => m.role === "user"
          ? { role: "user", content: m.content, label: m.label, formats: m.formats, refs: (m.refs || []).map(strip), pageContext: m.pageContext }
          : { role: "assistant", content: m.content, sources: m.sources, queries: m.queries, numbered: m.numbered }),
      });
    }
    function loadChat(c) {
      newChat(false);
      logEl.replaceChildren();
      chatId = c.id; chatTitle = c.title || "Chat"; updateTitle();
      page = c.page ? { ...c.page } : { none: true, title: "", url: "", text: "" };
      if (page.text) page.context = condense(page.text, chunkSize());
      convo = c.msgs.map((m) => ({ ...m }));
      pageRefPromoted = convo.some((m) => m.role === "user" && m.pageContext !== undefined);
      if (pageRefPromoted && !page.none) {
        refs.push({ id: ++refSeq, kind: "tab", pageSource: true, label: page.title || hostOf(page.url), url: page.url, image: src.image, text: page.text });
      }
      started = true;
      const seek = page.youtube && ytId(page.url) === ytId(srcUrl() || "") ? (s) => seekVideo(src.linkedBrowser, s) : null;
      for (const m of convo) {
        if (m.role === "user") { logEl.append(userMsg(m, null)); continue; }
        const block = h("div", { className: "dia-msg dia-ai" }, h("div", { className: "dia-answer" }));
        renderMd(block.firstChild, extractActions(m.content).text, seek, Infinity, citesOf(m));
        blockEntry.set(block, m);
        const srow = sourcesRow(m);
        if (srow) block.append(srow);
        block.append(actionsRow(block, !!m.partial));
        logEl.append(block);
      }
      lastKey = srcKey();
      renderPills();
      scrollDown(false);
      focusInput();
    }

    // ----- sheets (history, skills) laid over the conversation -----
    function closeSheet() {
      const wasSetup = sheetEl?.dataset.onb; // leaving the setup guide any way counts as done
      sheetEl?.remove(); sheetEl = null; panel?.classList.remove("dia-sheeted");
      if (wasSetup) { try { Services.prefs.setBoolPref(PREF + "setupdone", true); } catch {} }
    }
    function openSheet(title, ...body) {
      closeSheet(); closeHMenu(); closePicker();
      sheetEl = h("div", { className: "dia-sheet" },
        h("div", { className: "dia-sheet-head" }, h("span", { textContent: title }), h("button", { className: "dia-icon", title: "Close", onclick: closeSheet }, icon("close"))),
        ...body);
      panel.classList.add("dia-sheeted");
      panel.append(sheetEl);
      return sheetEl;
    }
    async function openHistory() {
      const q = h("input", { type: "text", placeholder: "Search chats" });
      const listEl = h("div", { className: "dia-sheet-body" });
      openSheet("Chat history", h("div", { className: "dia-search" }, icon("search"), q), listEl);
      let chats = await store.chats();
      const row = (c) => h("div", { className: "dia-row-item", onclick: () => { closeSheet(); loadChat(c); } },
        h("div", { className: "dia-row-main" },
          h("div", { className: "dia-row-title", textContent: c.title || "Chat" }),
          h("div", { className: "dia-row-sub", textContent: `${hostOf(c.url) || "no page"} · ${timeAgo(c.ts)}` })),
        h("button", { className: "dia-icon", title: "Delete chat", onclick: (e) => { e.stopPropagation(); chats = chats.filter((x) => x.id !== c.id); store.remove(c.id); paint(); } }, icon("trash")));
      const paint = () => {
        const t = q.value.trim().toLowerCase();
        const rows = chats.filter((c) => !t || (c.title || "").toLowerCase().includes(t) || (c.url || "").toLowerCase().includes(t) || c.msgs.some((m) => (m.content || "").toLowerCase().includes(t)));
        listEl.replaceChildren(...(rows.length ? rows.map(row) : [h("div", { className: "dia-empty-note", textContent: t ? "No chats match." : keepHistory() ? "No saved chats yet." : "Chat history is turned off in the mod's settings." })]));
        if (chats.length && !t) listEl.append(h("button", { className: "dia-mini", textContent: "Clear all history", onclick: () => { chats = []; store.clear(); paint(); } }));
      };
      q.addEventListener("input", paint);
      q.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeSheet(); focusInput(); } });
      paint();
      q.focus();
    }
    function openSkills(startNew) {
      const body = h("div", { className: "dia-sheet-body" });
      openSheet("Skills", body);
      const skillRow = (s, mine) => h("div", { className: "dia-row-item", onclick: () => { closeSheet(); pickSkill(s); } },
        h("div", { className: "dia-row-main" },
          h("div", { className: "dia-row-title", textContent: s.name }),
          h("div", { className: "dia-row-sub", textContent: (s.prompt || pref("prompt", DEFAULT_PROMPT)).slice(0, 90) })),
        ...(mine ? [
          h("button", { className: "dia-icon", title: "Edit", onclick: (e) => { e.stopPropagation(); form(s); } }, icon("edit")),
          h("button", { className: "dia-icon", title: "Delete", onclick: (e) => { e.stopPropagation(); store.saveSkills(store.skills().filter((x) => x.id !== s.id)).then(paint); } }, icon("trash")),
        ] : []));
      const paint = () => {
        const mine = store.skills();
        body.replaceChildren(
          h("button", { className: "dia-btn", textContent: "＋ New skill", onclick: () => form(null) }),
          h("div", { className: "dia-menu-sep", textContent: "Your skills" }),
          ...(mine.length ? mine.map((s) => skillRow(s, true)) : [h("div", { className: "dia-note", textContent: "Nothing yet. A skill is a saved prompt you can run on any page with /." })]),
          h("div", { className: "dia-menu-sep", textContent: "Built in" }),
          ...(isVid() ? YT_SKILLS : SKILLS).map((s) => skillRow(s, false)));
      };
      const form = (s) => {
        const name = h("input", { type: "text", value: s?.name || "", placeholder: "e.g. Draft a reply" });
        const prompt = h("textarea", { value: s?.prompt || "", placeholder: "What should it do? e.g. Write a friendly, concise reply to this email in my voice." });
        const draft = h("button", { className: "dia-btn", textContent: "✦ Write it for me", title: "Describe what you want in a sentence, then let the model write the skill", onclick: async () => {
          const d = prompt.value.trim() || name.value.trim();
          if (!d) { prompt.focus(); return; }
          if (!llmReady()) { prompt.placeholder = "Check that the AI server is running, then try again."; return; }
          draft.disabled = true; draft.textContent = "Writing…";
          try {
            const out = await askOnce("You turn a user's one-line idea into a reusable AI skill for a browser sidebar that can see the current page. Reply with ONLY JSON: {\"name\": \"2-3 word title\", \"prompt\": \"clear instructions for the assistant, second person, under 80 words\"}.", d);
            const j = JSON.parse(out.replace(/```json|```/g, "").trim());
            if (j.name) name.value = String(j.name).slice(0, 40);
            if (j.prompt) prompt.value = String(j.prompt);
          } catch (e) { prompt.placeholder = "Couldn't draft that. Write the instructions yourself."; }
          draft.disabled = false; draft.textContent = "✦ Write it for me";
        } });
        const save = h("button", { className: "dia-btn dia-primary", textContent: "Save skill", onclick: async () => {
          const n = name.value.trim(), p = prompt.value.trim();
          if (!n || !p) { name.focus(); return; }
          const list = store.skills().filter((x) => x.id !== s?.id);
          list.push({ id: s?.id || "u" + Date.now().toString(36), name: n.slice(0, 40), prompt: p });
          await store.saveSkills(list);
          paint();
        } });
        body.replaceChildren(h("div", { className: "dia-form" },
          h("label", { textContent: "Name" }), name, h("label", { textContent: "Instructions" }), prompt,
          h("div", { className: "dia-edit-row" }, draft, h("button", { className: "dia-btn", textContent: "Cancel", onclick: paint }), save)));
        name.focus();
      };
      if (startNew === true) form(null); else paint();
    }

    // ----- conversation lifecycle -----
    // Dia shows nothing in an empty chat: no greeting, no suggestions. Skills live behind / and the header menu.
    function renderEmpty() {}

    // The header buttons open small dropdowns: the layout button (History, Skills) and the model picker (models + the
    // effort slider). History, Skills, the model manager and the setup guide open as full-size sheets (they have lists to scroll).
    const onHMenuDown = (e) => { if (hmenuEl && !hmenuEl.contains(e.target) && !e.target.closest?.(".dia-layout, .dia-modelbtn")) closeHMenu(); };
    function closeHMenu() {
      if (!hmenuEl) return;
      hmenuEl.remove(); hmenuEl = null; hmenuKind = "";
      panel?.querySelectorAll(".dia-layout, .dia-modelbtn").forEach((b) => b.classList.remove("dia-open"));
      document.removeEventListener("pointerdown", onHMenuDown, true);
    }
    function showHMenu(kind, btnSel, cls, ...items) {
      closePop(); closeSheet();
      hmenuEl = h("div", { className: "dia-hmenu " + cls }, ...items);
      hmenuKind = kind;
      panel.append(hmenuEl);
      panel.querySelector(btnSel)?.classList.add("dia-open");
      setTimeout(() => { if (hmenuEl) document.addEventListener("pointerdown", onHMenuDown, true); }, 0);
    }
    const menuChoice = (ico, label, detail, fn, active) => h("button", { className: "dia-menu-choice" + (active ? " dia-active" : ""), onclick: () => { closeHMenu(); fn(); } },
      ico ? icon(ico) : h("span", { className: "dia-ico-gap" }),
      h("span", { className: "dia-menu-choice-main" },
        h("span", { className: "dia-menu-choice-title", textContent: label }),
        ...(detail ? [h("span", { className: "dia-menu-choice-sub", textContent: detail })] : [])));
    function openHeaderMenu() {
      if (hmenuKind === "layout") { closeHMenu(); return; }
      closeHMenu();
      showHMenu("layout", ".dia-layout", "dia-lmenu",
        menuChoice("history", "Chat history", "Search, reopen, or delete saved chats", () => openHistory()),
        menuChoice("spark", "Skills", "Choose or edit saved prompts", () => openSkills()));
    }

    // ----- effort slider: how much work the model puts into an answer -----
    const effortHint = (v) => {
      const base = ["Quick, short answers.", "Balanced answers.", "Thorough answers.", "The most careful answers."][v - 1];
      const p = provider();
      const extra = p === "apple" ? ["", "", " Reads the whole page in parts first, so it takes longer.", " Reads the whole page, drafts an answer, then refines it. Slowest."][v - 1]
        : p === "gemini" || activeModel().reasoning ? ["", " Thinks a little.", " Thinks harder.", " Thinks the longest."][v - 1] : "";
      return base + extra;
    };
    function effortControl() {
      const val = h("span", { className: "dia-eff-val" });
      const hint = h("div", { className: "dia-eff-hint" });
      const slider = h("input", { className: "dia-eff-range", type: "range", min: "1", max: "4", step: "1", value: String(effort()) });
      const paint = () => { const v = +slider.value; val.textContent = EFFORT_NAMES[v - 1]; hint.textContent = effortHint(v); };
      slider.addEventListener("input", paint); // the label follows the thumb…
      slider.addEventListener("change", () => setPref("effort", slider.value)); // …and the setting is saved when you let go
      paint();
      return h("div", { className: "dia-eff" },
        h("div", { className: "dia-eff-top" }, h("span", { textContent: "Effort" }), val),
        slider,
        h("div", { className: "dia-eff-ticks" }, ...EFFORT_NAMES.map((n) => h("span", { textContent: n }))),
        hint);
    }

    // ----- model picker -----
    function openModelMenu() {
      if (hmenuKind === "models") { closeHMenu(); return; }
      closeHMenu();
      const cur = activeModel();
      showHMenu("models", ".dia-modelbtn", "dia-mmenu",
        ...allModels().map((m) => menuChoice(m.id === cur.id ? "check" : null, m.name, modelSub(m), () => pickModel(m), m.id === cur.id)),
        h("div", { className: "dia-menu-rule" }),
        effortControl(),
        h("div", { className: "dia-menu-rule" }),
        menuChoice("plus", "Add or manage models…", "Gemini, Ollama, LM Studio, OpenRouter…", () => openModels()));
    }
    // the model applies to the next message; it is shared by every chat and window
    function pickModel(m) { setPref("activemodel", m.id); refreshModel(); focusInput(); }
    function refreshModel() {
      if (!modelBtnEl) return;
      const m = activeModel();
      modelBtnEl.querySelector(".dia-modelname").textContent = m.name;
      modelBtnEl.title = `Model: ${m.name} (${m.model}). Click to switch.`;
    }
    async function saveModel(entry) {
      const cur = store.models();
      const isNew = !cur.some((x) => x.id === entry.id);
      await store.saveModels(isNew ? [...cur, entry] : cur.map((x) => (x.id === entry.id ? entry : x)));
      if (isNew) setPref("activemodel", entry.id); // a model you just added is the one you want to try
      refreshModel();
    }

    // ----- model forms (used by the model manager and the setup guide) -----
    // Gemini: just a key. The newest Flash/Pro is picked for you (or choose an exact model after checking the key).
    function renderGeminiForm(body, m, done, cancel) {
      const key = h("input", { type: "password", value: m?.key || "", placeholder: "Paste your Gemini API key" });
      const status = h("div", { className: "dia-note" });
      const found = h("div", { className: "dia-found" });
      const seg = h("div", { className: "dia-seg" });
      let variant = m?.model || "flash";
      const paintSeg = () => seg.replaceChildren(...[["flash", "Flash · fast"], ["pro", "Pro · smartest"], ["flash-lite", "Flash-Lite · cheapest"]].map(([v, l]) =>
        h("button", { className: "dia-chip" + (variant === v ? " on" : ""), textContent: l, onclick: () => { variant = v; status.textContent = ""; paintSeg(); } })));
      paintSeg();
      const check = h("button", { className: "dia-btn", textContent: "Check key", onclick: async () => {
        const k = key.value.trim();
        if (!k) { key.focus(); status.textContent = "Paste your API key first."; return; }
        check.disabled = true; status.textContent = "Checking…"; found.replaceChildren();
        try {
          const ids = await geminiList(k);
          status.textContent = ids.length ? `Key works. ${ids.length} models available. Or tap an exact model:` : "Key works, but no chat models were listed.";
          found.replaceChildren(...ids.slice(0, 40).map((id) => h("button", { className: "dia-chip", textContent: id, title: id, onclick: () => { variant = id; status.textContent = "Using " + id; paintSeg(); } })));
        } catch (e) { status.textContent = "That key didn't work (" + String(e.message || e).slice(0, 120) + ")."; }
        check.disabled = false;
      } });
      const save = h("button", { className: "dia-btn dia-primary", textContent: "Save", onclick: async () => {
        const k = key.value.trim();
        if (!k) { key.focus(); status.textContent = "Paste your API key first."; return; }
        const nice = { flash: "Gemini Flash", pro: "Gemini Pro", "flash-lite": "Gemini Flash-Lite" }[variant] || variant;
        const entry = { id: m?.id || "m" + Date.now().toString(36), type: "gemini", name: m?.name || nice, base: GEMINI_BASE, model: variant, key: k, small: false, vision: true };
        await saveModel(entry);
        done(entry);
      } });
      body.replaceChildren(h("div", { className: "dia-form" },
        h("div", { className: "dia-onb-sub", textContent: "Sign in to Google AI Studio with your existing Google account, create a Gemini API key, and paste it here. The newest model of the kind you pick is used automatically." }),
        h("div", { className: "dia-edit-row" }, h("button", { className: "dia-btn", textContent: "Get a free key", onclick: () => openLink("https://aistudio.google.com/apikey") })),
        h("label", { textContent: "API key" }), key,
        h("label", { textContent: "Which kind" }), seg,
        h("div", { className: "dia-edit-row" }, check), status, found,
        h("div", { className: "dia-note", textContent: "Saved in your Firefox profile folder, not sent anywhere except to Google." }),
        h("div", { className: "dia-edit-row" }, h("button", { className: "dia-btn", textContent: "Cancel", onclick: cancel }), save)));
      key.focus();
    }
    // Common model form for direct provider APIs and OpenAI-compatible servers.
    function renderCustomForm(body, m, done, cancel, preset = {}) {
      const type = m?.type || preset.type || "openai";
      const name = h("input", { type: "text", value: m?.name || preset.name || "", placeholder: "e.g. Llama 3.1 (Ollama)" });
      const base = h("input", { type: "text", value: m?.base || preset.base || "", placeholder: "http://localhost:11434/v1", disabled: type === "anthropic" });
      const mid = h("input", { type: "text", value: m?.model || preset.model || "", placeholder: preset.model ? `Default: ${preset.model}` : "Choose from the model list" });
      const key = h("input", { type: "password", value: m?.key || preset.key || "", placeholder: type === "anthropic" || preset.requiresKey ? "Paste your API key" : "Only if the server needs one" });
      const small = h("input", { type: "checkbox", checked: m ? !!m.small : !!preset.small });
      const vision = h("input", { type: "checkbox", checked: m ? !!m.vision : !!preset.vision });
      const reasoning = h("input", { type: "checkbox", checked: m ? !!m.reasoning : !!preset.reasoning });
      const status = h("div", { className: "dia-note" });
      const found = h("div", { className: "dia-found" });
      const find = h("button", { className: "dia-btn", textContent: "Find models", title: "List models available to this API key or server", onclick: async () => {
        const b = normBase(base.value);
        if (!/^https?:\/\//i.test(b)) { base.focus(); status.textContent = "Enter the server address first (starting with http:// or https://)."; return; }
        if ((type === "anthropic" || preset.requiresKey) && !key.value.trim()) { key.focus(); status.textContent = "Paste your API key first."; return; }
        find.disabled = true; status.textContent = "Looking…"; found.replaceChildren();
        try {
          const k = key.value.trim();
          const headers = type === "anthropic"
            ? { "x-api-key": k, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
            : k ? { authorization: `Bearer ${k}`, "x-api-key": k } : {};
          const url = type === "anthropic" ? b + "/models?limit=1000" : b + "/models";
          const j = JSON.parse(await httpGet(url, headers));
          const ids = (Array.isArray(j) ? j : j.data || j.models || []).map((x) => (typeof x === "string" ? x : x.id || x.name || x.model)).filter(Boolean).slice(0, 80);
          status.textContent = ids.length ? "Tap a model to use it:" : "No models were listed. Type a model ID yourself.";
          found.replaceChildren(...ids.map((id) => h("button", { className: "dia-chip", textContent: id, title: id, onclick: () => { mid.value = id; if (!name.value.trim()) name.value = preset.name || id; } })));
        } catch (e) { status.textContent = "Couldn't list models (" + String(e.message || e).slice(0, 120) + "). You can still type a model ID yourself."; }
        find.disabled = false;
      } });
      const save = h("button", { className: "dia-btn dia-primary", textContent: "Save model", onclick: async () => {
        const b = normBase(base.value), mi = mid.value.trim(), k = key.value.trim();
        if (!/^https?:\/\//i.test(b)) { base.focus(); status.textContent = "The server address must start with http:// or https://."; return; }
        if (!mi) { mid.focus(); status.textContent = "Choose a model or enter its model ID."; return; }
        if ((type === "anthropic" || preset.requiresKey) && !k) { key.focus(); status.textContent = "Paste your API key first."; return; }
        const entry = { id: m?.id || "m" + Date.now().toString(36), type, name: (name.value.trim() || mi).slice(0, 40), base: b, model: mi, key: k, small: small.checked, vision: vision.checked, reasoning: reasoning.checked };
        await saveModel(entry);
        done(entry);
      } });
      const notes = [];
      if (preset.description) notes.push(h("div", { className: "dia-onb-sub", textContent: preset.description }));
      if (preset.keyUrl) notes.push(h("div", { className: "dia-edit-row" }, h("button", { className: "dia-btn", textContent: preset.keyLabel || "Get an API key", onclick: () => openLink(preset.keyUrl) })));
      body.replaceChildren(h("div", { className: "dia-form" },
        ...notes,
        h("label", { textContent: "Name" }), name,
        h("label", { textContent: type === "anthropic" ? "Anthropic API" : "Server address (OpenAI-compatible)" }), base,
        h("label", { textContent: "Model" }), mid,
        h("div", { className: "dia-edit-row" }, find), status, found,
        h("label", { textContent: "API key" }), key,
        h("label", { className: "dia-check" }, small, h("span", { textContent: "Small context window (for on-device or local models limited to about 4K tokens)" })),
        h("label", { className: "dia-check" }, vision, h("span", { textContent: "Can read images" })),
        ...(type === "anthropic" ? [] : [h("label", { className: "dia-check" }, reasoning, h("span", { textContent: "Reasoning model (sends the Effort setting to it)" }))]),
        h("div", { className: "dia-note", textContent: "The key is saved in your Firefox profile and sent only to this provider." }),
        h("div", { className: "dia-edit-row" }, h("button", { className: "dia-btn", textContent: "Cancel", onclick: cancel }), save)));
      name.focus();
    }
    const CLAUDE_PRESET = {
      type: "anthropic", name: "Claude", base: "https://api.anthropic.com", vision: true, requiresKey: true,
      keyUrl: "https://console.anthropic.com/settings/keys", keyLabel: "Get a Claude API key",
      description: "Connect with an Anthropic API key, then list the Claude models available to your account.",
    };
    const OPENAI_PRESET = {
      type: "openai", name: "OpenAI / ChatGPT API", base: "https://api.openai.com/v1", requiresKey: true,
      keyUrl: "https://platform.openai.com/api-keys", keyLabel: "Get an OpenAI API key",
      description: "Use the OpenAI API with a platform API key. A ChatGPT subscription by itself is not an API key.",
    };
    const DEEPSEEK_PRESET = {
      type: "openai", name: "DeepSeek", base: "https://api.deepseek.com/v1", model: "deepseek-flash", requiresKey: true,
      keyUrl: "https://platform.deepseek.com/api_keys", keyLabel: "Get a DeepSeek API key",
      description: "The current DeepSeek Flash model is prefilled; use Find models to see the models enabled for your key.",
    };
    const OLLAMA_PRESET = {
      type: "openai", name: "Ollama", base: "http://localhost:11434/v1",
      keyUrl: "https://ollama.com/download", keyLabel: "Get Ollama",
      description: "Start Ollama on this Mac, then use Find models to select a model you have pulled locally.",
    };

    // ----- model manager sheet -----
    function openModels() {
      const body = h("div", { className: "dia-sheet-body" });
      openSheet("Models", body);
      const row = (m) => h("div", { className: "dia-row-item", onclick: () => { closeSheet(); pickModel(m); } },
        h("div", { className: "dia-row-main" },
          h("div", { className: "dia-row-title", textContent: m.name + (m.id === activeModel().id ? "  ·  in use" : "") }),
          h("div", { className: "dia-row-sub", textContent: m.builtin ? `${m.model} · address and key are under Advanced in the mod's settings` : modelSub(m) })),
        ...(m.builtin ? [] : [
          h("button", { className: "dia-icon", title: "Edit", onclick: (e) => { e.stopPropagation(); edit(m); } }, icon("edit")),
          h("button", { className: "dia-icon", title: "Delete", onclick: (e) => {
            e.stopPropagation();
            if (pref("activemodel", "apple") === m.id) setPref("activemodel", "apple");
            store.saveModels(store.models().filter((x) => x.id !== m.id)).then(() => { refreshModel(); paint(); });
          } }, icon("trash")),
        ]));
      const paint = () => {
        const mine = allModels().filter((m) => !m.builtin);
        body.replaceChildren(
          h("div", { className: "dia-seg" },
            h("button", { className: "dia-btn", textContent: "＋ Gemini", onclick: () => renderGeminiForm(body, null, paint, paint) }),
            h("button", { className: "dia-btn", textContent: "＋ Claude", onclick: () => renderCustomForm(body, null, paint, paint, CLAUDE_PRESET) }),
            h("button", { className: "dia-btn", textContent: "＋ OpenAI / ChatGPT", onclick: () => renderCustomForm(body, null, paint, paint, OPENAI_PRESET) }),
            h("button", { className: "dia-btn", textContent: "＋ DeepSeek", onclick: () => renderCustomForm(body, null, paint, paint, DEEPSEEK_PRESET) }),
            h("button", { className: "dia-btn", textContent: "＋ Ollama", onclick: () => renderCustomForm(body, null, paint, paint, OLLAMA_PRESET) }),
            h("button", { className: "dia-btn", textContent: "＋ Other", onclick: () => renderCustomForm(body, null, paint, paint) })),
          h("div", { className: "dia-menu-sep", textContent: "Your models" }),
          ...(mine.length ? mine.map(row) : [h("div", { className: "dia-note", textContent: "Nothing yet. Choose a provider above, or connect any OpenAI-compatible server. Then switch models from the top of the sidebar." })]),
          h("div", { className: "dia-menu-sep", textContent: "Built in" }),
          row(builtinModel()));
      };
      const edit = (m) => m.type === "gemini" ? renderGeminiForm(body, m, paint, paint) : renderCustomForm(body, m, paint, paint, m.type === "anthropic" ? CLAUDE_PRESET : {});
      paint();
    }

    // ----- setup guide (first run, and "Run setup again" in the mod's settings) -----
    function openOnboarding() {
      const body = h("div", { className: "dia-sheet-body dia-onb" });
      openSheet("Set up", body);
      sheetEl.dataset.onb = "1";
      const dots = (n) => h("div", { className: "dia-onb-steps" }, ...[0, 1, 2, 3].map((i) => h("i", { className: i === n ? "on" : "" })));
      const hero = (t) => h("div", { className: "dia-onb-hero", textContent: t });
      const sub = (t) => h("div", { className: "dia-onb-sub", textContent: t });
      const btn = (label, fn, primary) => h("button", { className: "dia-btn" + (primary ? " dia-primary" : ""), textContent: label, onclick: fn });
      const nav = (...b) => h("div", { className: "dia-edit-row" }, ...b);
      const card = (title, text, fn) => h("button", { className: "dia-onb-card", onclick: fn }, h("b", { textContent: title }), h("span", { textContent: text }));
      let pickStep, afmStep, prefsStep, doneStep;
      const modelAddedStep = (entry) => body.replaceChildren(dots(1), hero(`${entry.name} is ready`),
        sub("You can continue setup now. Adding more models is optional, and you can add or switch models later from the model menu."),
        ...(store.models().length ? [h("div", { className: "dia-note", textContent: "Added: " + store.models().map((m) => m.name).join(", ") })] : []),
        nav(btn("Add another model", () => pickStep()), btn("Continue", () => prefsStep(), true)));
      const welcome = () => body.replaceChildren(dots(0), hero("Chat with any page"),
        h("ul", { className: "dia-onb-list" }, ...[
          "Ask about the page you're on, or drag in tabs, files and text for extra context.",
          "Pick your AI: private on your Mac, or a cloud model like Gemini. Switch any time from the top of the sidebar.",
          "It searches the web by itself when a question needs fresh information.",
        ].map((t) => h("li", { textContent: t }))),
        nav(btn("Skip", () => closeSheet()), btn("Get started", () => pickStep(), true)));
      pickStep = () => body.replaceChildren(dots(1), hero("Choose your AI"), sub("You can add more later and switch between them."),
        card("Apple Intelligence", "Private and free. Runs on this Mac through AFM Server.", () => afmStep()),
        card("Google Gemini", "Fast and capable. Needs a free API key from Google AI Studio.", () => renderGeminiForm(body, null, (entry) => modelAddedStep(entry), () => pickStep())),
        card("Claude", "Connect directly with an Anthropic API key and choose from the Claude models available to you.", () => renderCustomForm(body, null, (entry) => modelAddedStep(entry), () => pickStep(), CLAUDE_PRESET)),
        card("OpenAI · ChatGPT API", "Use an OpenAI platform API key and list the models available to it.", () => renderCustomForm(body, null, (entry) => modelAddedStep(entry), () => pickStep(), OPENAI_PRESET)),
        card("DeepSeek", "A ready-to-use DeepSeek API setup with model discovery.", () => renderCustomForm(body, null, (entry) => modelAddedStep(entry), () => pickStep(), DEEPSEEK_PRESET)),
        card("Ollama", "Run models locally on this Mac. No cloud API key needed.", () => renderCustomForm(body, null, (entry) => modelAddedStep(entry), () => pickStep(), OLLAMA_PRESET)),
        card("Other compatible model", "LM Studio, OpenRouter, or another OpenAI-compatible server.", () => renderCustomForm(body, null, (entry) => modelAddedStep(entry), () => pickStep())),
        ...(store.models().length ? [h("div", { className: "dia-note", textContent: "Added: " + store.models().map((m) => m.name).join(", ") })] : []),
        nav(btn("Back", welcome), btn("Continue", () => prefsStep(), true)));
      afmStep = () => {
        const st = h("div", { className: "dia-note" });
        const test = btn("Test connection", async () => {
          test.disabled = true; st.textContent = "Checking…";
          const b = builtinModel();
          try { await httpGet(b.base + "/models", b.key ? { authorization: `Bearer ${b.key}`, "x-api-key": b.key } : {}); st.textContent = "Connected. AFM Server is running."; }
          catch (e) { st.textContent = e instanceof TypeError ? `Couldn't reach AFM Server at ${b.base}. Start it, then test again.` : "AFM Server answered, so it's running."; }
          test.disabled = false;
        });
        body.replaceChildren(dots(1), hero("Apple Intelligence"),
          sub("It runs on your Mac through AFM Server, so nothing leaves your computer. Start AFM Server, then test the connection. If you changed its address or key, set them under Advanced in the mod's settings."),
          nav(test), st,
          nav(btn("Back", () => pickStep()), btn("Use Apple Intelligence", () => { setPref("activemodel", "apple"); refreshModel(); prefsStep(); }, true)));
      };
      prefsStep = () => {
        body.replaceChildren(dots(2), hero("How should it work?"), effortControl(),
          h("div", { className: "dia-eff-top" }, h("span", { textContent: "Web search" })),
          h("div", { className: "dia-note", textContent: "It never goes online on its own. Press the globe button when you want it to search the internet. Until then it only uses the page you're on and the links on that page." }),
          nav(btn("Back", () => pickStep()), btn("Finish", () => doneStep(), true)));
      };
      doneStep = () => body.replaceChildren(dots(3), hero("You're all set"),
        h("ul", { className: "dia-onb-list" }, ...[
          `Press ${SHORTCUT} any time to show or hide the sidebar.`,
          "Change the model or the effort from the pill at the top left.",
          "Drag in tabs, files or selected text to add context.",
        ].map((t) => h("li", { textContent: t }))),
        nav(btn("Start chatting", () => { closeSheet(); focusInput(); }, true)));
      welcome();
    }

    // keepSplit: re-attach the other split pane(s) as locked pills. open() passes false because it
    // re-detects the split itself right after.
    function newChat(keepSplit = true) {
      ctrl?.abort();
      gen++;
      page = null; convo = []; refs = []; queue = []; started = false; generating = false;
      chatId = null; chatTitle = ""; pageRefPromoted = false; usePage = !!srcUrl() && bool("attachpage", true); skill = null; formats = []; manage = false; webOn = false;
      closePop(); closePicker(); closeHMenu(); closeSheet(); clearNote(); clearWebStatus();
      if (input) { input.value = ""; autosize(); }
      logEl.replaceChildren();
      setBusy(false);
      renderEmpty();
      updateTitle();
      renderPills();
      if (keepSplit) {
        const others = members.filter((t) => t !== src && t.linkedBrowser && gBrowser.tabs.includes(t));
        members = [src, ...others];
        others.forEach((t) => addTab(t, true));
      }
      focusInput();
    }

    // Called on any top-level navigation in the source tab (including YouTube's in-page video
    // switches). A different page/video starts a fresh chat (the old one stays in History);
    // otherwise just refresh the page attachment card.
    function refreshAttach() { if (closed) return; if (!started) renderPills(); else updateWebBtn(); }
    function onNav() {
      if (closed) return;
      const key = srcKey();
      if (key === lastKey) { refreshAttach(); return; }
      lastKey = key;
      if (started || convo.length || page) newChat();
      else { usePage = !!srcUrl() && bool("attachpage", true); logEl?.querySelector(".dia-empty") && (logEl.replaceChildren(), renderEmpty()); renderPills(); }
    }

    function build() {
      ensureDock();
      modelBtnEl = h("button", { className: "dia-modelbtn", onclick: (e) => { e.stopPropagation(); openModelMenu(); } }, h("span", { className: "dia-modelname" }), icon("chev"));
      const head = h("div", { className: "dia-head" },
        h("div", { className: "dia-head-left" },
          h("button", { className: "dia-icon dia-new", title: "New chat", onclick: () => newChat() }, icon("new")),
          modelBtnEl),
        h("div", { className: "dia-head-right" },
          h("button", { className: "dia-icon dia-layout", title: "Chat history and Skills", onclick: (e) => { e.stopPropagation(); openHeaderMenu(); } }, icon("sidebar"), icon("chevs")),
          h("button", { className: "dia-icon dia-close", title: `Hide (${SHORTCUT}), your chat is kept for this tab`, onclick: () => dismiss() }, icon("close"))));
      refreshModel();
      logEl = h("div", { className: "dia-log" });
      cardsEl = h("div", { className: "dia-cards" });
      pillsEl = h("div", { className: "dia-pills" });
      input = h("textarea", { className: "dia-input", rows: 1, placeholder: "Ask a question about this page..." });
      input.addEventListener("input", () => { autosize(); updatePop(); updateSend(); });
      input.addEventListener("focus", () => { wantFocus = false; });
      input.addEventListener("blur", () => setTimeout(() => { if (pop && pop.trigger !== "plus") closePop(); }, 150));
      input.addEventListener("keydown", (e) => {
        if (pop) {
          if (e.key === "ArrowDown") { e.preventDefault(); movePop(1); return; }
          if (e.key === "ArrowUp") { e.preventDefault(); movePop(-1); return; }
          if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); pickPop(pop.sel[pop.idx]); return; }
          if (e.key === "Escape") { e.preventDefault(); closePop(); return; }
        }
        if (e.key === "Escape" && (sheetEl || hmenuEl)) { e.preventDefault(); closeSheet(); closeHMenu(); return; }
        if (e.key === "Enter" && !e.isComposing) {
          // default: Enter sends, Shift+Enter adds a line. With "Enter sends" off it is ⌘/Ctrl+Enter that sends.
          const send = bool("entersends", true) ? !e.shiftKey : e.metaKey || e.ctrlKey;
          if (send) { e.preventDefault(); e.stopPropagation(); submit(); }
        }
      });
      input.addEventListener("paste", (e) => {
        const fs = [...(e.clipboardData?.files || [])];
        if (fs.length) { e.preventDefault(); addFiles(fs); }
      });
      sendBtn = h("button", { className: "dia-send", onclick: () => (busy && !hasContent() ? stop() : submit()) });
      sendBtn.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing focus in the box after sending
      const addBtn = h("button", { className: "dia-icon dia-add", title: "Attach files, add tabs, Skills", onclick: (e) => { e.stopPropagation(); plusMenu(); } }, icon("plus"));
      webBtnEl = h("button", { className: "dia-icon dia-webbtn", title: "Let the assistant search the internet. Without it, it only uses links on the page you're on.", onclick: () => setWeb(!webOn) }, icon("globe"));
      webBtnEl.setAttribute("aria-label", "Toggle web search");
      webBtnEl.setAttribute("aria-pressed", "false");
      const tabsBtn = h("button", { className: "dia-icon dia-tabsbtn", title: "Add tabs and page links as context", onclick: (e) => { e.stopPropagation(); if (picker) closePicker(); else openPicker("tabs"); } }, icon("tabs"));
      const camBtn = h("button", { className: "dia-icon dia-cam", title: "Capture this page", onclick: () => addCapture() }, icon("camera"));
      for (const b of [addBtn, tabsBtn, webBtnEl, camBtn]) b.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing focus in the box
      composerEl = h("div", { className: "dia-composer" }, cardsEl, pillsEl, input,
        h("div", { className: "dia-row" }, h("div", { className: "dia-row-left" }, addBtn, tabsBtn, webBtnEl), h("div", { className: "dia-row-right" }, camBtn, sendBtn)));
      const dropzone = h("div", { className: "dia-dropzone" }, icon("drop"), h("span", { textContent: "Drop to add as context" }), h("small", { textContent: "Files, tabs or tab groups" }));
      panel = h("div", { className: "dia-panel", hidden: true }, head, h("div", { className: "dia-progress" }), logEl, h("div", { className: "dia-foot" }, composerEl), dropzone);
      // drag files, tabs (from the tab strip or Zen's sidebar) or whole tab groups onto the sidebar
      const over = (e) => {
        if (!isDroppable(e)) return;
        e.preventDefault();
        // "copy" matters: a tab drag that ends with dropEffect "none" makes the browser tear the tab out into a new window
        try { e.dataTransfer.dropEffect = "copy"; } catch (err) {}
        panel.classList.add("dia-drop");
      };
      panel.addEventListener("dragenter", over);
      panel.addEventListener("dragover", over);
      panel.addEventListener("dragleave", (e) => { if (!panel.contains(e.relatedTarget)) panel.classList.remove("dia-drop"); });
      panel.addEventListener("drop", async (e) => {
        panel.classList.remove("dia-drop");
        if (!isDroppable(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const dt = e.dataTransfer;
        const { tabs, groups } = tabsFromDrop(dt);
        const files = [...(dt.files || [])];
        for (const g of groups) addGroup(g);
        tabs.forEach((t) => addTab(t)); // cards appear at once and read in parallel
        if (files.length) await addFiles(files);
        if (!tabs.length && !groups.length && !files.length) flashNote("Drop a file, or drag a tab onto the sidebar.");
        focusInput();
      });
      panelsEl.append(panel);
      setBusy(false);
    }

    // open an empty chat; the page is attached as a pill, nothing is read or sent until you ask
    function open() {
      if (!panel) build();
      newChat(false);
      lastKey = srcKey();
      userHidden = false;
      sync();
      focusInput();
      const splitDone = attachSplitTabs(); // grab the other split pane(s), if any
      const mode = pref("autosummarize", "youtube"); // "true" = always, "youtube" = only on videos
      const needSetup = !bool("setupdone", false);
      if (needSetup) setTimeout(() => { if (!closed && panel && !panel.hidden && !sheetEl) openOnboarding(); }, 300); // first run: the setup guide
      if (!needSetup && srcUrl() && (mode === "true" || (mode === "youtube" && isVid()))) {
        const first = skillsFor(isVid())[0];
        splitDone.then(() => { if (!closed && !started && !busy) runSkill(first); });
      }
    }

    // ----- visibility: the sidebar shows only while its tab (or a split sibling) is on screen -----
    function sync() {
      if (!panel || closed) return;
      const want = !userHidden && isMember(gBrowser.selectedTab) && tabHasPage(gBrowser.selectedTab);
      const was = panel.hidden;
      panel.hidden = !want;
      if (want && was) { autosize(); if (wantFocus) focusInput(); }
      updateDock();
    }
    function dismiss() { userHidden = true; closePop(); closePicker(); closeHMenu(); sync(); }
    function restore() { userHidden = false; sync(); focusInput(); }

    function close(immediate) {
      if (closed) return;
      closed = true;
      gen++;
      ctrl?.abort();
      closePop(); closePicker();
      closeHMenu();
      try { mm?.removeMessageListener(SEL_MSG, onSelection); } catch {}
      sessions.delete(src);
      panel?.remove();
      updateDock();
    }

    self = {
      open, sync, dismiss, restore, close, onNav, refreshAttach, refreshModel, addRef, startOnboarding: () => openOnboarding(),
      has: (t) => isMember(t),
      get src() { return src; },
      get visible() { return !!panel && !panel.hidden; },
    };
    return self;
  }

  // ---------- window-level wiring ----------
  const paneVisible = (t) => {
    const b = t?.linkedBrowser;
    if (!b) return false;
    if (t === gBrowser.selectedTab) return true;
    const box = b.closest(".browserSidebarContainer") || b;
    const cs = getComputedStyle(box);
    const r = box.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 100 && r.height > 100;
  };
  const current = () => [...sessions.values()].find((x) => x.has(gBrowser.selectedTab));

  // open (or reveal) the sidebar on the current tab; returns its session
  function ensureSession() {
    const tab = gBrowser.selectedTab;
    if (!tabHasPage(tab)) return null; // no page, no sidebar
    let s = sessions.get(tab) || current();
    if (s) { if (!s.visible) s.restore(); return s; }
    s = makeSession(tab);
    sessions.set(tab, s);
    s.open();
    return s;
  }
  function toggle() {
    if (stale()) return; // an older copy — the newest one handles the shortcut
    try {
      const tab = gBrowser.selectedTab;
      const s = sessions.get(tab) || current();
      if (s && s.visible) return s.dismiss();
      if (!tabHasPage(tab)) { nudgeButton(); return; } // new tab, blank or internal page: nothing to chat about
      if (s) return s.restore(); // hidden chats come back as they were
      ensureSession();
    } catch (e) { console.error("[dia-sidebar] couldn't open the sidebar:", e); }
  }
  // "Ask Chat about selection" from the page's context menu
  function askAbout(text) {
    if (stale() || !text) return;
    const s = ensureSession();
    s?.addRef(text.slice(0, 3000));
  }

  const onKey = (e) => {
    if (stale()) return;
    if (isToggleKey(e)) {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) toggle(); // holding the shortcut auto-repeats — only act on the first press
    }
  };
  const syncAll = () => { sessions.forEach((x) => x.sync()); syncButton(); updateDock(); }; // the button reflects "is there a page?" even before any sidebar exists
  // "Run setup again" (Sine settings): forget the models you added and show the setup guide again
  async function resetSetup() {
    if (stale()) return;
    try {
      await store.saveModels([]);
      setPref("activemodel", "apple");
      Services.prefs.setBoolPref(PREF + "setupdone", false);
      sessions.forEach((x) => x.refreshModel());
      if (window === Services.wm.getMostRecentWindow("navigator:browser")) ensureSession()?.startOnboarding(); // shows at once when a page is open, else on the next open
    } catch (e) { console.warn("[dia-sidebar] run setup again", e); }
  }
  const onSelect = () => { syncAll(); setTimeout(syncAll, 120); setTimeout(syncAll, 450); };
  const onTabClose = (e) => sessions.get(e.target)?.close(true);
  const onResize = () => syncAll();

  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);
  window.addEventListener("fullscreen", onResize);
  gBrowser.tabContainer.addEventListener("TabSelect", onSelect);
  gBrowser.tabContainer.addEventListener("TabClose", onTabClose);
  // settings take effect immediately (side, text size, colours, search mode, URL bar button…)
  const prefObserver = { observe(_s, _t, data) { try { if (data === PREF + "rerunsetup") { resetSetup(); return; } syncAll(); sessions.forEach((s) => { s.refreshAttach(); s.refreshModel(); }); applyUrlbarPref(); } catch (e) { console.warn("[dia-sidebar] settings", e); } } };
  try { Services.prefs.addObserver(PREF, prefObserver); } catch (e) { console.warn("[dia-sidebar] settings observer", e); }
  try { Services.prefs.addObserver("zen.tabs.vertical", prefObserver); } catch (e) { console.warn("[dia-sidebar] tab sidebar observer", e); } // follow the tab sidebar when it switches sides

  const progressListener = {
    onLocationChange(browser, webProgress) {
      try {
        if (!webProgress.isTopLevel) return;
        const tab = gBrowser.getTabForBrowser(browser);
        sessions.get(tab)?.onNav(); // includes YouTube's in-page (same-document) video switches
        if (tab === gBrowser.selectedTab) syncAll(); // leaving for a new tab / internal page hides the sidebar
      } catch (e) { console.warn("[dia-sidebar] location listener", e); }
    },
  };
  gBrowser.addTabsProgressListener(progressListener);
  const onTabAttr = (e) => sessions.get(e.target)?.refreshAttach();
  gBrowser.tabContainer.addEventListener("TabAttrModified", onTabAttr);

  // right-click selected text → "Ask Chat about selection"
  let ctxSel = "";
  const ctxMenu = document.getElementById("contentAreaContextMenu");
  let ctxItem = null;
  const onCtxShowing = (e) => {
    if (e.target !== ctxMenu || !ctxItem) return;
    try { ctxSel = (window.gContextMenu?.selectionInfo?.fullText || window.gContextMenu?.selectionInfo?.text || "").trim(); } catch { ctxSel = ""; }
    ctxItem.hidden = !ctxSel;
  };
  try {
    if (ctxMenu) {
      ctxItem = document.createXULElement("menuitem");
      ctxItem.id = "dia-sidebar-ask";
      ctxItem.setAttribute("label", "Ask Chat about selection");
      ctxItem.hidden = true;
      ctxItem.addEventListener("command", () => askAbout(ctxSel));
      const after = document.getElementById("context-searchselect") || document.getElementById("context-selectall");
      ctxMenu.insertBefore(ctxItem, after ? after.nextSibling : null);
      ctxMenu.addEventListener("popupshowing", onCtxShowing);
    }
  } catch (e) { console.warn("[dia-sidebar] context menu item", e); }

  // Chat button inside the URL bar (Zen puts the URL bar at the top of the left sidebar). It also lights up
  // while the sidebar is open on this tab. If the URL bar can't be found, fall back to a toolbar button.
  let urlBtn = null, btnTimer = null;
  function syncButton() {
    try {
      urlBtn?.toggleAttribute("open", !!current()?.visible);
      const ok = tabHasPage(gBrowser.selectedTab);
      urlBtn?.toggleAttribute("disabled", !ok);
      urlBtn?.setAttribute("tooltiptext", ok ? `Chat with this page (${SHORTCUT})` : "Open a web page to chat with it");
    } catch (e) {}
  }
  function nudgeButton() { try { urlBtn?.setAttribute("nudge", ""); setTimeout(() => urlBtn?.removeAttribute("nudge"), 400); } catch {} }
  function mountUrlbarButton() {
    if (urlBtn?.isConnected) return true;
    const host = document.getElementById("page-action-buttons") || document.getElementById("urlbar-input-container");
    if (!host) return false;
    urlBtn = document.createXULElement("hbox");
    urlBtn.id = "dia-sidebar-urlbar";
    urlBtn.className = "urlbar-page-action urlbar-icon-wrapper";
    urlBtn.setAttribute("role", "button");
    urlBtn.setAttribute("tooltiptext", `Chat with this page (${SHORTCUT})`);
    const img = document.createXULElement("image");
    img.className = "urlbar-icon";
    urlBtn.append(img);
    urlBtn.addEventListener("click", (e) => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); toggle(); } });
    const star = document.getElementById("star-button-box");
    if (star && star.parentNode === host) host.insertBefore(urlBtn, star); else host.append(urlBtn);
    syncButton();
    return true;
  }
  function toolbarFallback() {
    try {
      const { CustomizableUI } = ChromeUtils.importESModule("resource:///modules/CustomizableUI.sys.mjs");
      if (!CustomizableUI.getWidget(ID)?.provider) {
        CustomizableUI.createWidget({
          id: ID, type: "button", label: "Chat sidebar", tooltiptext: `Chat with this page (${SHORTCUT})`,
          defaultArea: CustomizableUI.AREA_NAVBAR, onCommand(e) { e.target.ownerGlobal.__diaSidebar?.toggle(); },
        });
      }
    } catch (e) { console.warn("[dia-sidebar] toolbar button", e); }
  }
  function applyUrlbarPref() {
    if (!bool("urlbarbutton", true)) { urlBtn?.remove(); urlBtn = null; return; }
    if (!urlBtn?.isConnected) { try { mountUrlbarButton(); } catch (e) {} }
  }
  try {
    if (bool("urlbarbutton", true) && !mountUrlbarButton()) { // the URL bar may not be built yet this early in startup
      let tries = 0;
      btnTimer = setInterval(() => {
        let done = false;
        try { done = mountUrlbarButton(); } catch (e) { console.warn("[dia-sidebar] url bar button", e); }
        if (done || ++tries >= 20) { clearInterval(btnTimer); btnTimer = null; if (!done) toolbarFallback(); }
      }, 500);
    }
  } catch (e) { console.warn("[dia-sidebar] url bar button", e); toolbarFallback(); }

  window.__diaSidebar = {
    toggle,
    destroy() {
      for (const s of [...sessions.values()]) s.close(true);
      try { Services.prefs.removeObserver(PREF, prefObserver); } catch {}
      try { Services.prefs.removeObserver("zen.tabs.vertical", prefObserver); } catch {}
      if (btnTimer) clearInterval(btnTimer);
      urlBtn?.remove();
      styleEl.remove();
      dock?.remove();
      ctxMenu?.removeEventListener("popupshowing", onCtxShowing);
      ctxItem?.remove();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("fullscreen", onResize);
      gBrowser.tabContainer.removeEventListener("TabSelect", onSelect);
      gBrowser.tabContainer.removeEventListener("TabClose", onTabClose);
      gBrowser.tabContainer.removeEventListener("TabAttrModified", onTabAttr);
      gBrowser.removeTabsProgressListener(progressListener);
      delete window.__diaSidebar;
    },
  };
  console.log(`[dia-sidebar] loaded v${VERSION} · ${ownSearch() ? "writes its own search queries" : "built-in model search"} (copy #${COPY} in this window${COPY > 1 ? " — older copies disabled" : ""})`);
  };

  // Sine runs scripts at the window's "load" event, which can be before the browser UI is built. Wait for it.
  (function boot(n) {
    let ready = false;
    try { ready = typeof gBrowser !== "undefined" && !!gBrowser?.tabContainer && !!document.getElementById("tabbrowser-tabpanels"); } catch (e) {}
    if (ready) {
      try { diaMain(); } catch (e) { console.error("[dia-sidebar] failed to start:", e); }
    } else if (n < 160) {
      setTimeout(() => boot(n + 1), 250);
    } else {
      console.error("[dia-sidebar] gave up waiting for the browser window to finish loading");
    }
  })(0);
})();
