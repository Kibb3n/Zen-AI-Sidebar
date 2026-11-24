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
  const VERSION = "2.2.0";
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
    "Do not search for questions about the page itself, rewriting, translating, math, or timeless knowledge.";
  // For models without a built-in search tool: one quick call decides whether (and what) to search
  const ROUTER_SYSTEM =
    "You decide whether a browser assistant must search the web to answer the user's latest message. " +
    "Reply with exactly NO, or with SEARCH: followed by one concise web search query (max 12 words). " +
    "Answer NO for questions about the page the user is viewing, rewriting, summarizing, translating, math, coding help, or timeless general knowledge. " +
    "Answer SEARCH for news, recent or changing facts, prices, products, people or companies you may not know, or when the user asks to look something up online. Never add anything else.";
  const ROUTER_FORCED =
    "Write the single best web search query (max 12 words) for the user's latest message, using the recent chat for context. " +
    "Reply with exactly SEARCH: followed by the query, nothing else.";
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
  color: var(--fg); background: var(--panel); background-attachment: fixed;
  font: var(--dia-fs, 14px)/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased;
  border-radius: calc(var(--zen-native-inner-radius, 12px) / var(--zen-squircle-value, 1)); corner-shape: round;
  box-shadow: var(--zen-big-shadow, 0 2px 10px rgba(0, 0, 0, 0.14));
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
  .dia-status { animation: dia-in 0.4s var(--ease) both, dia-pulse 1.6s ease-in-out 0.5s infinite; color: var(--mute); }
  .dia-note { font-size: 12px; color: var(--mute); margin-top: 4px; }
  .dia-error { color: var(--danger); word-break: break-word; margin: 0; }
  .dia-streaming .dia-answer > p:last-child::after, .dia-streaming .dia-answer > ul:last-child > li:last-child::after, .dia-streaming .dia-answer > ol:last-child > li:last-child::after {
    content: "▍"; margin-inline-start: 2px; opacity: 0.6; animation: dia-blink 1s steps(2) infinite; }
  .dia-dots { display: inline-flex; gap: 5px; align-items: center; padding: 4px 0 1px; }
  .dia-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--mute); animation: dia-bounce 1.25s ease-in-out infinite; }
  .dia-dots i:nth-child(2) { animation-delay: 0.16s; } .dia-dots i:nth-child(3) { animation-delay: 0.32s; }
  .dia-chunk-in { animation: dia-chunk 0.6s var(--ease) both; }
  .dia-think { margin: 0 0 10px; font-size: 13px; color: var(--mute); }
  .dia-think summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 4px; user-select: none; width: fit-content; }
  .dia-think summary::-webkit-details-marker { display: none; }
  .dia-think summary .dia-svg { width: 12px; height: 12px; transition: transform 0.2s; transform: rotate(-90deg); }
  .dia-think[open] summary .dia-svg { transform: none; }
  .dia-think.dia-live summary span { animation: dia-pulse 1.4s ease-in-out infinite; }
  .dia-think-body { margin-top: 6px; padding-inline-start: 12px; border-inline-start: 2px solid var(--line); white-space: pre-wrap; max-height: 180px; overflow-y: auto; scrollbar-width: thin; }

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

  /* composer, like Dia: one big rounded card (capture cards, the box, then + / tab pill / camera / send) */
  .dia-foot { flex: none; padding: 6px 14px 14px; }
  .dia-composer { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 12px 12px 10px 14px; border: 1px solid var(--line); border-radius: 26px; background: var(--glass); backdrop-filter: blur(14px); transition: border-color 0.2s; }
  .dia-composer:focus-within { border-color: color-mix(in srgb, var(--fg) 28%, transparent); }
  .dia-cards { display: flex; flex-wrap: wrap; gap: 8px; max-height: min(196px, 24vh); overflow-y: auto; scrollbar-width: thin; }
  .dia-cards:empty { display: none; }
  .dia-card { position: relative; display: flex; align-items: center; gap: 12px; max-width: 100%; box-sizing: border-box; padding: 8px 36px 8px 8px; border-radius: 16px; background: var(--glass); animation: dia-in 0.25s var(--ease) both; }
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
  .dia-add, .dia-cam { width: 34px; height: 34px; flex: none; border-radius: 50%; }
  .dia-add .dia-svg, .dia-cam .dia-svg { width: 20px; height: 20px; }
  .dia-tabpill { appearance: none; display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; box-sizing: border-box; padding: 4px 16px 4px 5px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--fg) 22%, transparent); background: transparent; color: inherit; cursor: pointer; font-size: 14px; transition: background-color 0.15s, opacity 0.15s; }
  .dia-tabpill:hover { background: var(--soft); }
  .dia-tabpill[hidden] { display: none; }
  .dia-tabpill.dia-off { opacity: 0.5; border-style: dashed; }
  .dia-tabpill.dia-fixed { cursor: default; pointer-events: none; }
  .dia-tabpill .dia-tabfav { width: 24px; height: 24px; flex: none; border-radius: 8px; background: var(--soft2); display: grid; place-items: center; overflow: hidden; color: var(--mute); }
  .dia-tabpill .dia-tabfav img { width: 16px; height: 16px; border-radius: 4px; }
  .dia-tabpill .dia-tabfav .dia-svg { width: 14px; height: 14px; }
  .dia-tabpill > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-chip { appearance: none; border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; flex: none; padding: 5px 11px 5px 9px; border-radius: 999px; font-size: 13px; color: inherit; background: color-mix(in srgb, var(--accent) 20%, transparent); }
  .dia-chip[hidden] { display: none; }
  .dia-chip .dia-svg { width: 14px; height: 14px; color: var(--accent); }
  .dia-send { appearance: none; border: 0; cursor: pointer; flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 78%, white); color: var(--on-accent); transition: transform 0.15s var(--ease), opacity 0.15s; }
  .dia-send .dia-svg { width: 18px; height: 18px; stroke-width: 2; }
  .dia-send:not([disabled]):hover { transform: scale(1.07); }
  .dia-send:active { transform: scale(0.92); }
  .dia-send[disabled] { opacity: 0.3; cursor: default; }
  .dia-addnote { font-size: 12px; color: var(--mute); padding: 0 2px; animation: dia-fade 0.3s ease both; }

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
  .dia-sheet { position: absolute; inset: 0; z-index: 8; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--panel); background-attachment: fixed; border-radius: inherit; animation: dia-in 0.25s var(--ease) both; }
  .dia-sheet-head { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; padding: 12px 10px 6px 18px; font-weight: 600; font-size: 13px; }
  .dia-sheet-head span { flex: 1; }
  .dia-panel.dia-sheeted > :not(.dia-sheet):not(.dia-dropzone):not(.dia-hmenu) { visibility: hidden; } /* never let the chat show through a sheet */
  .dia-sheet-body { flex: 1 1 0%; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 2px; }
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
@keyframes dia-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
@keyframes dia-blink { 50% { opacity: 0; } }
@keyframes dia-bounce { 0%, 75%, 100% { opacity: 0.3; transform: translateY(0); } 38% { opacity: 0.95; transform: translateY(-4px); } }
@keyframes dia-chunk { from { opacity: 0; filter: blur(1px); } to { opacity: 1; filter: blur(0); } }
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
  const provider = () => (activeModel().type === "gemini" ? "gemini" : activeModel().small ? "apple" : "openai");
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
  // "auto" (default, like Dia): the assistant searches the web by itself whenever the question needs it.
  // "manual": only when you turn the globe on / use @Web. "off": never.
  const webMode = () => {
    const v = pref("search", "auto");
    return v === "manual" || v === "off" ? v : "auto";
  };
  // if Anthropic/Gemini reject their built-in search tool (plan, region, model), we search from the browser instead
  const searchBroken = new Set(); // providers whose built-in search tool was refused (remembered per provider)
  // messages that are clearly about live / outside information search even if the model wouldn't have chosen to
  const WEB_HINT = /\b(latest|newest|currently|right now|today|tonight|tomorrow|yesterday|this (week|weekend|month|year)|news|headlines?|breaking|price of|how much (is|does|are|do)|cost of|weather|forecast|score|standings|who won|who is the (ceo|president|prime minister|founder)|release date|when (is|does|did|will)|stock|exchange rate|trending|near me|open now|search (the )?(web|online|for)|look (it |this |that |them )?up|google|find (it |this |that )?(out|online))\b|\b20(2[4-9]|3\d)\b/i;
  const ABOUT_PAGE = /\b(this|the|that) (page|article|video|post|site|text|document|paper|thread|email|tab)\b|\bsummari[sz]e\b|\bproofread\b|\btranslate\b/i;
  const needsWeb = (t) => !!t && WEB_HINT.test(t) && (!ABOUT_PAGE.test(t) || /\b(search|look up|google|online)\b/i.test(t));
  const keepHistory = () => bool("history", pref("savehistory", "true") !== "false");
  // Brave API key or SearXNG address (one field; older per-engine fields still work)
  const searchSetup = (eng) => pref("searchsetup", "").trim() || (eng === "brave" ? pref("searchkey", "") : pref("searxurl", "")).trim();
  const STYLES = [
    "", // Low: the base prompt is already brief
    "Give balanced answers: clear and complete without padding (this overrides the instruction to be brief).",
    "Give thorough, well-structured answers with the relevant detail and context (this overrides the instruction to be brief).",
    "Give thorough, well-structured answers with the relevant detail and context (this overrides the instruction to be brief). Work through the question carefully and check your answer against the page and any sources before you reply.",
  ];
  const systemPrompt = () => {
    let s = SYSTEM;
    const style = STYLES[effort() - 1];
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
  function extractInContent() {
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
    sendAsyncMessage("dia-sidebar:text", { title: doc.title, url: doc.location.href, text });
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
      if (text) return { title: doc.title || browser.contentTitle || "Page", url, text };
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
          "data:application/javascript," + encodeURIComponent(`(${extractInContent.toString()})()`),
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

  // Keep both key headers for compatibility with AFM Server builds that use either name.
  const authHeaders = () =>
    apiKey() ? { authorization: `Bearer ${apiKey()}`, "x-api-key": apiKey() } : {};

  async function* fetchChunks(url, headers, body, signal) {
    const res = await fetch(url, { method: "POST", signal, headers, body });
    if (!res.ok) throw new Error(httpError(res.status, await res.text()));
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
    let wake = null, done = false, failure = null, status = 0, full = "";
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
    if (status >= 400) throw new Error(httpError(status, full));
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
    const re = new RegExp(`^gemini-\\d+(?:\\.\\d+)?-${kind}$`);
    let list = [];
    try {
      const r = await fetchText(`${GEMINI_BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey() } }, 8000, signal);
      if (r.ok) {
        list = (JSON.parse(r.text).models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map((m) => String(m.name).replace(/^models\//, ""))
          .filter((n) => re.test(n))
          .sort((x, y) => geminiVer(y) - geminiVer(x));
      }
    } catch (e) { if (e.name === "AbortError") throw e; }
    if (!list.length) {
      list = kind === "flash" ? ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"]
        : kind === "flash-lite" ? ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]
        : ["gemini-3.1-pro-preview", "gemini-2.5-pro"];
    } else geminiAuto[kind] = list; // only cache a real answer from the API
    return list;
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
          for await (const j of sseEvents(chunks(url, headers, JSON.stringify(body), signal))) {
            got = true;
            if (j.error) throw new Error(j.error.message || "Gemini API error");
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
      (req.web && req.forceWeb ? "\n\nWeb search is required for this request: search the web for current information before answering." : "");
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
    for await (const j of sseEvents(chunks(url, headers, JSON.stringify(body), signal))) {
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
  const stripTags = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').trim();
  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg,iframe").forEach((n) => n.remove());
    const root = doc.querySelector("main, article, [role=main]") || doc.body;
    return (root?.textContent || "").replace(/\s+/g, " ").trim();
  }
  async function webSearch(q, signal) {
    const eng = "duckduckgo"; // keep local-model settings simple; no external search API key is needed
    const enc = encodeURIComponent(q);
    let results = [];
    if (eng === "brave") {
      const key = searchSetup("brave");
      if (!key) throw new Error("Add your Brave Search API key in the mod's settings");
      const r = await fetchText(`https://api.search.brave.com/res/v1/web/search?q=${enc}&count=6`, { headers: { Accept: "application/json", "X-Subscription-Token": key } }, 9000, signal);
      if (!r.ok) throw new Error("Brave Search returned " + r.status);
      results = (JSON.parse(r.text).web?.results || []).map((x) => ({ title: stripTags(x.title), url: x.url, snippet: stripTags(x.description) }));
    } else if (eng === "searxng") {
      const base = searchSetup("searxng").replace(/\/+$/, "");
      if (!base) throw new Error("Add your SearXNG address in the mod's settings");
      const r = await fetchText(`${base}/search?q=${enc}&format=json`, {}, 9000, signal);
      if (!r.ok) throw new Error("SearXNG returned " + r.status + " (JSON output must be enabled on the instance)");
      results = (JSON.parse(r.text).results || []).map((x) => ({ title: x.title || "", url: x.url, snippet: x.content || "" }));
    } else {
      const r = await fetchText(`https://html.duckduckgo.com/html/?q=${enc}`, {}, 9000, signal);
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
    if (!results.length) throw new Error("DuckDuckGo gave no results (it may be rate-limiting). Try again in a moment.");
    return results;
  }
  async function readSources(results, signal, cap) {
    await Promise.all(results.slice(0, 3).map(async (r) => {
      try {
        const res = await fetchText(r.url, {}, 7000, signal);
        if (res.ok && /html|text/.test(res.ctype)) r.text = htmlToText(res.text).slice(0, cap);
      } catch {}
    }));
  }
  const webBlock = (q, results, cap) =>
    `=== WEB SEARCH RESULTS for "${q}" ===\n` +
    results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${(r.text || r.snippet || "").slice(0, cap)}`).join("\n\n") +
    "\n\nUse these results for facts beyond the page. Cite sources inline as [1], [2] right after the claims they support. Never cite a source that isn't listed.";
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
  // asks the model whether to search; returns the query, or "" for no search
  async function planSearch(convo, page, forced, signal) {
    const last = [...convo].reverse().find((m) => m.role === "user");
    const msg = (last?.label || last?.content || "").slice(0, 400);
    const recent = convo.slice(-5, -1).map((m) => `${m.role}: ${(m.label || m.content || "").slice(0, 200)}`).join("\n");
    const ctx = `Today is ${new Date().toDateString()}.\n` + (page?.title ? `Page: ${page.title}\n` : "") + (recent ? `Recent chat:\n${recent}\n` : "") + `User message: ${msg}`;
    let out = "";
    try { out = await askOnce(forced ? ROUTER_FORCED : ROUTER_SYSTEM, ctx, signal, true); } catch (e) { if (e.name === "AbortError") throw e; }
    const m = out.match(/SEARCH:\s*(.+)/i);
    const q = (m?.[1] || "").trim().replace(/^["“'`]+|["”'`.]+$/g, "").slice(0, 200);
    if (q) return q;
    return forced ? msg.replace(/\s+/g, " ").slice(0, 200) : "";
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
      case "tab": return { label: r.label || hostOf(r.url) || "Tab", sub: hostOf(r.url) || "Tab", image: r.image, ico: "page", tip: r.url, locked: r.locked };
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
    const el = h("div", { className: "dia-card" + (d.locked ? " dia-locked" : ""), title: d.tip || d.label || "" });
    const thumb = h("div", { className: "dia-card-thumb" });
    if (d.thumb) thumb.append(h("img", { src: d.thumb }));
    else if (d.image) thumb.append(h("img", { className: "dia-card-fav", src: d.image, onerror: (e) => e.target.replaceWith(icon(d.ico || "page")) }));
    else thumb.append(icon(d.ico || "page"));
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
    let panel, logEl, input, sendBtn, pillsEl, cardsEl, tabPillEl, webPillEl, composerEl, titleEl, modelBtnEl, sheetEl = null, hmenuEl = null, hmenuKind = "";
    let started = false, busy = false, generating = false, stopped = false, closed = false, userHidden = false, wantFocus = false;
    let page = null, convo = [], refs = [], ctrl = null, gen = 0, refSeq = 0, chatId = null, chatTitle = "";
    let usePage = true, skill = null, formats = [], manage = false, webOn = false; // webOn: the globe button
    let queue = [], drainAfter = false, tabSnap = [], lastKey = "";
    let members = [src]; // all tabs this chat spans — >1 when opened over a split view
    let self = null, noteEl = null, noteTimer = null, pop = null;
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
    const setBusy = (b) => { busy = b; updateSend(); };
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

    // the current page, shown as a pill in the bottom row: its site name and icon. Click to leave it out.
    function renderTabPill(pd) {
      if (!tabPillEl) return;
      const show = !!pd && !(page && page.none);
      tabPillEl.hidden = !show;
      if (!show) return;
      const host = hostOf(pd.url) || pd.label;
      tabPillEl.classList.toggle("dia-off", !usePage && !started);
      tabPillEl.classList.toggle("dia-fixed", started);
      tabPillEl.title = started ? pd.label : usePage ? "This page is used as context. Click to leave it out." : "Click to use this page as context";
      const fav = h("span", { className: "dia-tabfav" });
      if (pd.image) fav.append(h("img", { src: pd.image, onerror: (e) => e.target.replaceWith(icon("page")) })); else fav.append(icon("page"));
      tabPillEl.replaceChildren(fav, h("span", { textContent: host }));
    }
    function renderPills() {
      if (!pillsEl) return;
      const els = [];
      const pd = pageData();
      cardsEl.replaceChildren(...refs.map((r) => card(refMeta(r), r.locked ? null : () => { refs = refs.filter((x) => x.id !== r.id); renderPills(); })));
      if (skill) els.push(pill({ label: skill.name, ico: "spark" }, () => { skill = null; renderPills(); }, "dia-skillpill"));
      for (const f of formats) els.push(pill({ label: "@" + f.name, ico: "edit", tip: f.hint }, () => { formats = formats.filter((x) => x !== f); renderPills(); }));
      if (manage) els.push(pill({ label: "Manage tabs", ico: "folder" }, () => { manage = false; renderPills(); }));
      pillsEl.replaceChildren(...els);
      renderTabPill(pd);
      if (input) input.placeholder = isVid() && usePage ? "Ask a question about this video..." : usePage && pd ? "Ask a question about this page..." : "Ask anything...";
      updateSend();
      updateWebBtn();
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

    async function addTab(tab, locked = false) {
      if (!tab || tab === src) return;
      const url = tab.linkedBrowser?.currentURI?.spec;
      if (refs.some((r) => r.kind === "tab" && r.url === url)) return;
      if (tab.linkedBrowser.documentContentType === "application/pdf") { // a PDF open in a tab: fetch the file itself
        flashNote("Reading PDF…", true);
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error("HTTP " + res.status);
          await addPdfBuffer(await res.arrayBuffer(), (tab.label || "PDF").replace(/\.pdf$/i, "") + ".pdf", url);
        } catch (e) { flashNote("Couldn't read that PDF tab."); }
        return;
      }
      flashNote("Reading tab…", true);
      try {
        const data = await getPageText(tab.linkedBrowser);
        const text = (data?.text || "").replace(/\s+/g, " ").trim().slice(0, 6000);
        if (!text) { flashNote("Couldn't read that tab."); return; }
        clearNote();
        if (refs.some((r) => r.kind === "tab" && r.url === data.url)) return; // a quick double add
        addContext({ kind: "tab", label: tab.label || data.title || "Tab", image: tab.image || "", url: data.url, text, locked });
      } catch (e) { flashNote("Couldn't read that tab."); }
    }
    async function addGroup(group) {
      const tabs = (group.tabs || []).filter((t) => t !== src && !t.pending && t.linkedBrowser && /^https?$/.test(t.linkedBrowser.currentURI?.scheme || ""));
      if (!tabs.length) { flashNote("That group has no loaded tabs to read."); return; }
      for (const t of tabs.slice(0, 6)) await addTab(t);
      if (tabs.length > 6) flashNote(`Added 6 of ${tabs.length} tabs in “${group.label || "group"}”.`);
    }

    // a PDF's bytes: Anthropic reads them natively (text + figures); other providers get extracted text
    async function addPdfBuffer(buf, name, url) {
      if (rawPdf()) {
        const dataUrl = await readDataUrl(new Blob([buf], { type: "application/pdf" }));
        clearNote();
        addContext({ kind: "pdf", label: name, url, mime: "application/pdf", b64: dataUrl.split(",")[1], text: "[PDF: " + name + "]" });
        return true;
      }
      flashNote("Reading PDF…", true);
      const text = await pdfText(buf);
      if (!text) { flashNote("Couldn't read that PDF's text. AFM Server's apple.local model needs text; try copying the relevant passage into chat."); return false; }
      clearNote();
      addContext({ kind: "file", label: name, url, text: text.slice(0, 24000) });
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

    // tabs that are actually loaded (skip lazy/discarded/restored-but-unloaded tabs) and on the web
    const loadedTabs = () => gBrowser.tabs.filter((t) =>
      t !== src && !t.pending && t.linkedPanel && t.linkedBrowser && !t.hasAttribute?.("zen-empty-tab") && /^https?$/.test(t.linkedBrowser.currentURI?.scheme || ""));
    const tabGroupsList = () => { try { return [...(gBrowser.tabGroups || [])].filter((g) => (g.tabs || []).length); } catch { return []; } };
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
    const tabItems = (tabs) => tabs.map((t) => ({ label: t.label || "Tab", image: t.image, ico: "page", sub: hostOf(t.linkedBrowser.currentURI?.spec), title: t.label || "", run: () => addTab(t) }));
    const toolItems = (q) => {
      const out = [];
      if (!q || "tabs".startsWith(q) || "manage".startsWith(q)) out.push({ label: "@Tabs", ico: "folder", sub: "Manage open tabs", run: () => { manage = true; renderPills(); } });
      if (webMode() !== "off" && (!q || "web".startsWith(q) || "search".startsWith(q))) out.push({ label: "@Web", ico: "globe", sub: "Search the web", run: () => { setWeb(true); } });
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
      const tabs = loadedTabs().filter((t) => match(t.label) || match(t.linkedBrowser.currentURI?.spec)).slice(0, 6);
      const groups = tabGroupsList().filter((g) => match(g.label)).slice(0, 4);
      const fm = FORMATS.filter((f) => !q || f.name.startsWith(q));
      const tools = toolItems(q);
      const items = [];
      if (tabs.length) items.push({ sep: "Tabs" }, ...tabItems(tabs));
      if (groups.length) items.push({ sep: "Tab groups" }, ...groups.map((g) => ({ label: g.label || "Unnamed group", ico: "folder", sub: (g.tabs || []).length + " tabs", run: () => addGroup(g) })));
      if (fm.length) items.push({ sep: "Formats" }, ...fm.map((f) => ({ label: "@" + f.name, ico: "edit", sub: f.hint, run: () => { formats = formats.includes(f) ? formats : [...formats, f]; renderPills(); } })));
      if (tools.length) items.push({ sep: "Tools" }, ...tools);
      showPop("at", start, items);
    }
    function plusMenu() {
      if (pop?.trigger === "plus") { closePop(); return; }
      closePop();
      const tabs = loadedTabs().slice(0, 6);
      const items = [
        { label: "Attach file or image…", ico: "clip", run: pickFile },
        { label: "Paste clipboard text", ico: "copy", run: pasteCard },
      ];
      if (!usePage && !started && srcUrl()) items.push({ label: "Add this page", ico: "page", run: () => { usePage = true; renderPills(); } });
      if (webMode() !== "off") items.push({ label: webOn ? "Turn off web search" : "Search the web", ico: "globe", run: () => setWeb(!webOn) });
      if (tabs.length) items.push({ sep: "Add a tab  ·  or type @" }, ...tabItems(tabs));
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
    // "Search the web" (+ menu or @Web) forces a web search for this chat and shows a small Web chip in the bottom row.
    // In "auto" mode Anthropic/Gemini already decide on their own.
    function updateWebBtn() {
      if (!webPillEl) return;
      webPillEl.hidden = !(webOn && webMode() !== "off");
    }
    function setWeb(on) {
      webOn = !!on;
      updateWebBtn();
      if (webOn) flashNote("Web search is on for this chat.");
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
      let t = m.content;
      const fm = (m.formats || []).map((id) => FORMATS.find((f) => f.id === id)?.prompt).filter(Boolean);
      if (fm.length) t += "\n\n" + fm.join(" ");
      for (const r of m.refs || []) {
        if (r.kind === "image" || sendsRaw(r)) continue;
        const cap = r.kind === "file" ? (apple ? 3000 : 20000) : apple ? 2000 : 8000;
        t += `\n\n=== ${refHead(r)} ===\n${(r.text || "").slice(0, cap)}`;
      }
      if (m.manage && withTabs) t += `\n\n=== OPEN TABS ===\n${tabListText(tabSnap)}\n\n${TABS_PROTOCOL}`;
      // Keep a pile of attachments from overwhelming the small on-device context window.
      return apple && t.length > 3600 ? t.slice(0, 3560) + "\n[…additional request or attachment text omitted]" : t;
    }
    // Every request is rebuilt from scratch. Cloud/large models get the page in the system prompt plus
    // real multi-turn history. Apple's tiny on-device model ignores history, so it gets one flattened turn.
    function buildRequest(resuming, webCtx, deep) {
      const lastU = [...convo].reverse().find((m) => m.role === "user");
      const req = lastU?.content || pref("prompt", DEFAULT_PROMPT);
      let ctx = page && !page.none ? pageCtx() : "";
      // On YouTube every transcript line is prefixed with its [mm:ss] stamp (so "Key moments" can cite
      // times). For anything not about timing, strip them so the model doesn't echo them.
      if (page?.youtube && !/\btimestamp|\bmoment|\bchapter|time ?code|mm:ss|\bjump to\b/i.test(req)) {
        ctx = ctx.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/gm, "").replace(/ \(each line is prefixed with its \[mm:ss\] timestamp\)/, "");
      }
      const pageBlock = page && !page.none ? `=== PAGE THE USER IS VIEWING ===\nTitle: ${page.title}\nURL: ${page.url}\n\n${ctx}` : "";
      if (provider() === "apple") {
        const upto = resuming ? convo : convo.slice(0, convo.lastIndexOf(lastU));
        const transcript = upto.slice(-2).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${(m.label || m.content).slice(0, 500)}`).join("\n");
        const fit = (text, limit) => text.length <= limit ? text : text.slice(0, limit - 44) + "\n[…context shortened for the on-device model]";
        const budget = webCtx ? 3000 : 4200;
        const pageContext = deep ? fit(`=== PAGE THE USER IS VIEWING (notes from reading all of it) ===\nTitle: ${page.title}\nURL: ${page.url}\n\n${deep}`, budget) : fit(pageBlock, budget);
        const webContext = webCtx ? fit(webCtx.text, 1800) : "";
        const ask = resuming ? "Continue your previous answer exactly where it stopped, without repeating it." : userText(lastU || { content: req }, true);
        return {
          system: systemPrompt(), pageBlock: "", web: false,
          messages: [{ role: "user", content:
            (pageContext ? "Use the web page below to respond to the user's request." + (effort() <= 2 ? " Be concise." : "") + "\n\n" + pageContext + "\n\n" : "") +
            (webContext ? webContext + "\n\n" : "") +
            (transcript ? `=== CONVERSATION SO FAR ===\n${transcript}\n\n` : "") + `=== REQUEST ===\n${ask}` }],
        };
      }
      const msgs = convo.slice(-24).map((m) => m.role === "assistant"
        ? { role: "assistant", content: m.content }
        : { role: "user", content: apiContent(userText(m, m === lastU), (m.refs || []).filter(sendsRaw)) });
      while (msgs[0]?.role === "assistant") msgs.shift();
      if (resuming) msgs.push({ role: "user", content: "Continue exactly where you stopped. Do not repeat what you already wrote." });
      const heur = webMode() === "auto" && !lastU?.fromSkill && needsWeb(lastU?.label || lastU?.content || "");
      const forced = !!lastU?.web || heur;
      const nativeWeb = isNative() && !searchBroken.has(provider()) && webMode() !== "off" && (webMode() === "auto" || forced); // Anthropic/Gemini run their own search
      return { system: systemPrompt(), pageBlock: [pageBlock, webCtx?.text].filter(Boolean).join("\n\n"), messages: msgs, web: nativeWeb, forceWeb: forced };
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
      block.querySelector(".dia-actions")?.remove();
      block.querySelector(".dia-sources")?.remove();
      let answerEl = block.querySelector(".dia-answer");
      if (!answerEl) { answerEl = h("div", { className: "dia-answer" }); block.append(answerEl); }
      let dots = h("div", { className: "dia-dots" }, h("i"), h("i"), h("i")); // "thinking" until the first token
      block.append(dots);
      if (!block.isConnected) logEl.append(block);
      renderQueue();
      scrollDown(true);
      let acc = prior ? prior.content : "";
      let failed = false, thinkEl = null, thinkBody = null, thinkAcc = "", statusEl = null;
      let webCtx = prior?.webText ? { text: prior.webText } : null, searchInfo = null; // fallback web search (models without a built-in tool)
      let cites = citesOf(prior);
      const qset = new Set(), srcMap = new Map();
      const t0 = Date.now();
      const seek = isVid() ? seekFn() : null;
      const wantTs = /\btimestamp|\bmoment|\bchapter|time ?code|mm:ss|\bjump to\b/i.test([...convo].reverse().find((m) => m.role === "user")?.content || "");
      const clean = (t) => (page?.youtube && seek ? scrubStamps(wantTs ? snapToChapters(t, page.chapters) : t, page.seconds, wantTs) : t);
      const dropDots = () => { if (dots) { dots.remove(); dots = null; } };
      const setStatus = (t) => { dropDots(); if (!statusEl) { statusEl = h("div", { className: "dia-status" }); block.append(statusEl); } statusEl.textContent = t; };
      const clearStatus = () => { statusEl?.remove(); statusEl = null; };
      const onThink = (d) => {
        thinkAcc += d;
        if (!thinkEl) {
          thinkBody = h("div", { className: "dia-think-body" });
          thinkEl = h("details", { className: "dia-think dia-live", open: true }, h("summary", {}, icon("chev"), h("span", { textContent: "Thinking…" })), thinkBody);
          block.insertBefore(thinkEl, answerEl);
        }
        dropDots();
        thinkBody.textContent = thinkAcc;
        thinkBody.scrollTop = thinkBody.scrollHeight;
        if (nearBottom()) scrollDown(false);
      };
      const endThink = () => {
        if (!thinkEl || !thinkEl.classList.contains("dia-live")) return;
        thinkEl.classList.remove("dia-live");
        thinkEl.open = false;
        thinkEl.querySelector("summary span").textContent = `Thought for ${Math.max(1, Math.round((Date.now() - t0) / 1000))}s`;
      };
      // Reveal the answer in whole multi-line chunks: hold streamed text back until ~3 lines have piled
      // up, then render up to `end` and ease the new block in together (settled text stays solid).
      const CHUNK_LINES = 3;
      let shown = acc.length, lastPaint = 0;
      const paint = (end = acc.length) => {
        if (end <= shown) return;
        dropDots();
        const stick = nearBottom();
        renderMd(answerEl, acc.slice(0, end), seek, shown, cites);
        shown = end;
        if (stick) scrollDown(false);
      };
      const chunkEnd = () => {
        let n = 0;
        for (let i = shown; i < acc.length; i++) if (acc[i] === "\n" && ++n >= CHUNK_LINES) return i + 1;
        return -1;
      };
      const finalRender = (text) => {
        const { text: body, actions } = extractActions(text);
        renderMd(answerEl, body, seek, Infinity, cites); // final solid pass, no fade boundary
        block.querySelector(".dia-act")?.remove();
        if (actions) { const card = actionCard(actions); if (card) block.append(card); }
      };
      if (prior) renderMd(answerEl, acc, seek, Infinity, cites);
      try {
        if (!llmReady()) {
          dropDots();
          acc = extractive(page?.text || "") || "Couldn't find enough text on this page to summarize.";
          renderMd(answerEl, acc, seek);
          answerEl.append(h("div", { className: "dia-note", textContent: "Offline summary. This model needs an API key: open the model menu at the top of the sidebar and edit it." }));
        } else {
          const lastU = [...convo].reverse().find((m) => m.role === "user");
          const heur = webMode() === "auto" && !lastU?.fromSkill && needsWeb(lastU?.label || lastU?.content || "");
          // Search from the browser (for models without a built-in tool, or when that tool was rejected):
          // the model writes a query, we search, read the top pages and hand them back as numbered sources.
          // questions that are plainly about the page itself never need a search, so skip the extra routing call
          const askText = lastU?.label || lastU?.content || "";
          const skipRouter = !lastU?.web && !heur && (askText.trim().length < 6 || ABOUT_PAGE.test(askText));
          const runFallback = async () => {
            if (skipRouter) return;
            try {
              const q = await planSearch(convo, page, !!lastU?.web || heur, signal);
              if (q) {
                const cap = provider() === "apple" ? 900 : 3500;
                setStatus(`Searching the web for “${q}”…`);
                const results = await webSearch(q, signal);
                setStatus("Reading sources…");
                await readSources(results, signal, cap);
                webCtx = { text: webBlock(q, results, cap) };
                searchInfo = { query: q, sources: results.map((r) => ({ title: r.title, url: r.url })) };
                cites = searchInfo.sources;
              }
            } catch (e) {
              if (e.name === "AbortError") throw e;
              clearStatus();
              block.insertBefore(h("div", { className: "dia-note", textContent: "Couldn't search the web: " + e.message }), answerEl);
            }
          };
          const wantsSearch = !prior && webMode() !== "off" && (lastU?.web || (webMode() === "auto" && !lastU?.fromSkill));
          if (wantsSearch && (!isNative() || searchBroken.has(provider()))) await runFallback();
          // High effort on the small on-device model: read the whole page in parts, keep notes for this question
          let deep = null;
          if (provider() === "apple" && effort() >= 3 && !prior && page && !page.none && page.text.length > chunkSize() * 1.3) {
            try { deep = (await deepRead(lastU?.content || pref("prompt", DEFAULT_PROMPT), page.text, signal, (i, n) => setStatus(`Reading the page in parts (${i}/${n})…`))) || null; }
            catch (e) { if (e.name === "AbortError") throw e; deep = null; }
            clearStatus();
          }
          for (let attempt = 0; ; attempt++) {
            try {
              let reqNow = buildRequest(!!prior, webCtx, deep);
              if (provider() === "apple" && effort() >= 4 && !prior) reqNow = await refineRequest(reqNow, signal, setStatus); // Max: draft first, then stream the improved answer
              for await (const ev of streamLLM(reqNow, signal)) {
                if (ev.t === "think") { onThink(ev.d); continue; }
                if (ev.t === "status") { setStatus(ev.d); continue; }
                if (ev.t === "query") { qset.add(ev.d); continue; }
                if (ev.t === "sources") { for (const s of ev.d) srcMap.set(s.url, s); continue; }
                endThink(); clearStatus();
                acc = acc.length > 20 && ev.d.startsWith(acc) ? ev.d : acc + ev.d; // tolerate cumulative streams
                const now = Date.now();
                const end = chunkEnd();
                if (end > 0) { lastPaint = now; paint(end); }
                else if (acc.length - shown >= 500) { lastPaint = now; paint(); }
                else if (acc.length > shown && now - lastPaint >= 1800) { lastPaint = now; paint(); }
              }
              break;
            } catch (e) {
              // the built-in search tool was refused before any answer: remember it and search from the browser instead
              if (e.webUnavailable && attempt === 0 && !acc && !prior && wantsSearch) { searchBroken.add(provider()); clearStatus(); await runFallback(); continue; }
              throw e;
            }
          }
          endThink(); clearStatus();
          paint();
          acc = clean(acc);
          finalRender(acc);
        }
      } catch (e) {
        dropDots(); clearStatus(); endThink();
        if (e.name === "AbortError") {
          if (stopped && acc) finalRender(acc);
        } else {
          failed = true;
          const unreachable = e instanceof TypeError;
          block.append(h("p", { className: "dia-error", textContent: unreachable ? `Couldn't reach ${activeModel().name} at ${baseUrl()}. Is it running?` : `Couldn't answer: ${e.message}` }));
          const lastU = [...convo].reverse().find((m) => m.role === "user");
          const errRow = h("div", { className: "dia-actions" },
            h("button", { className: "dia-mini", textContent: "Retry", onclick: () => { if (busy) return; block.remove(); generate(); } }));
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
      dropDots();
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
        logEl?.querySelectorAll(".dia-status").forEach((n) => n.remove());
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
      const status = h("div", { className: "dia-msg dia-status", textContent: ytId(url) ? "Fetching video captions…" : "Reading page…" });
      logEl.append(status);
      scrollDown(true);
      try {
        page = await getPageText(src.linkedBrowser);
      } catch (e) {
        if (closed || my !== gen) return;
        const msg = e.noCaptions
          ? "This video has no captions available, so there's no transcript to read."
          : `Couldn't read this ${ytId(url) ? "video" : "page"}: ${e.message}`;
        status.replaceWith(h("p", { className: "dia-msg dia-error", textContent: msg }));
        setBusy(false);
        return;
      }
      if (closed || my !== gen) { if (!closed) page = null; return; }
      page.text = page.text.slice(0, MAX_CHARS * 2);
      ctrl = new AbortController();
      try {
        const size = chunkSize();
        if (page.text.length > size) status.textContent = "Condensing…";
        page.context = pageCtx();
      } catch (e) { page.context = page.text.slice(0, chunkSize()); }
      status.remove();
      convo.push(entry);
      generate();
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
      if (opts.text === undefined && !skill) { // typing a skill's name and pressing Return runs it, no slash needed
        const t = input.value.trim().toLowerCase();
        const m = t && skillsFor(isVid()).find((s) => s.name.toLowerCase() === t);
        if (m) { skill = m; input.value = ""; }
      }
      const snap = snapshot(opts);
      if (!snap) return;
      if (opts.text === undefined) { input.value = ""; autosize(); }
      refs = []; skill = null; formats = []; manage = false; // the composer empties (snapshot keeps the old ones)
      closePop();
      if (busy) { queue.push(snap); renderQueue(); renderPills(); return; }
      dispatch(snap);
    }
    function dispatch(snap) {
      logEl.querySelector(".dia-empty")?.remove();
      const pageAtt = !started && snap.usePage ? pageData() : null;
      started = true;
      const entry = { role: "user", content: snap.q, label: snap.label, refs: snap.refs, formats: snap.formats.map((f) => f.id), manage: snap.manage, web: snap.web, fromSkill: snap.fromSkill };
      logEl.append(userMsg(entry, pageAtt));
      if (!chatTitle) { chatTitle = snap.label.slice(0, 60); updateTitle(); }
      if (snap.manage) tabSnap = snapshotTabs();
      renderPills();
      scrollDown(true);
      if (!page) {
        if (snap.usePage) { startFirst(entry); return; }
        page = { none: true, title: "", url: "", text: "" }; // chatting without a page
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
        page: page && !page.none ? { title: page.title, url: page.url, text: page.text.slice(0, 20000), youtube: !!page.youtube, seconds: page.seconds, chapters: page.chapters } : null,
        msgs: convo.map((m) => m.role === "user"
          ? { role: "user", content: m.content, label: m.label, formats: m.formats, refs: (m.refs || []).map(strip) }
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
      closeSheet(); closeHMenu();
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
        h("div", { className: "dia-onb-sub", textContent: "Get a free key in Google AI Studio, paste it here, and you're done. The newest model of the kind you pick is used automatically." }),
        h("div", { className: "dia-edit-row" }, h("button", { className: "dia-btn", textContent: "Get a free key", onclick: () => openLink("https://aistudio.google.com/apikey") })),
        h("label", { textContent: "API key" }), key,
        h("label", { textContent: "Which kind" }), seg,
        h("div", { className: "dia-edit-row" }, check), status, found,
        h("div", { className: "dia-note", textContent: "Saved in your Firefox profile folder, not sent anywhere except to Google." }),
        h("div", { className: "dia-edit-row" }, h("button", { className: "dia-btn", textContent: "Cancel", onclick: cancel }), save)));
      key.focus();
    }
    // any other OpenAI-compatible server
    function renderCustomForm(body, m, done, cancel) {
      const name = h("input", { type: "text", value: m?.name || "", placeholder: "e.g. Llama 3.1 (Ollama)" });
      const base = h("input", { type: "text", value: m?.base || "", placeholder: "http://localhost:11434/v1" });
      const mid = h("input", { type: "text", value: m?.model || "", placeholder: "Model ID, e.g. llama3.1:8b" });
      const key = h("input", { type: "password", value: m?.key || "", placeholder: "Only if the server needs one" });
      const small = h("input", { type: "checkbox", checked: !!m?.small });
      const vision = h("input", { type: "checkbox", checked: !!m?.vision });
      const reasoning = h("input", { type: "checkbox", checked: !!m?.reasoning });
      const status = h("div", { className: "dia-note" });
      const found = h("div", { className: "dia-found" });
      const find = h("button", { className: "dia-btn", textContent: "Find models", title: "Ask the server which models it offers", onclick: async () => {
        const b = normBase(base.value);
        if (!/^https?:\/\//i.test(b)) { base.focus(); status.textContent = "Enter the server address first (starting with http:// or https://)."; return; }
        find.disabled = true; status.textContent = "Looking…"; found.replaceChildren();
        try {
          const k = key.value.trim();
          const j = JSON.parse(await httpGet(b + "/models", k ? { authorization: `Bearer ${k}`, "x-api-key": k } : {}));
          const ids = (Array.isArray(j) ? j : j.data || j.models || []).map((x) => (typeof x === "string" ? x : x.id || x.name || x.model)).filter(Boolean).slice(0, 80);
          status.textContent = ids.length ? "Tap one to use it:" : "That server didn't list any models. Type the model ID yourself.";
          found.replaceChildren(...ids.map((id) => h("button", { className: "dia-chip", textContent: id, title: id, onclick: () => { mid.value = id; if (!name.value.trim()) name.value = id; } })));
        } catch (e) { status.textContent = "Couldn't list models from that server (" + String(e.message || e).slice(0, 120) + "). You can still type the model ID yourself."; }
        find.disabled = false;
      } });
      const save = h("button", { className: "dia-btn dia-primary", textContent: "Save model", onclick: async () => {
        const b = normBase(base.value), mi = mid.value.trim();
        if (!/^https?:\/\//i.test(b)) { base.focus(); status.textContent = "The server address must start with http:// or https://."; return; }
        if (!mi) { mid.focus(); status.textContent = "Enter the model ID (or use Find models)."; return; }
        const entry = { id: m?.id || "m" + Date.now().toString(36), name: (name.value.trim() || mi).slice(0, 40), base: b, model: mi, key: key.value.trim(), small: small.checked, vision: vision.checked, reasoning: reasoning.checked };
        await saveModel(entry);
        done(entry);
      } });
      body.replaceChildren(h("div", { className: "dia-form" },
        h("label", { textContent: "Name" }), name,
        h("label", { textContent: "Server address (OpenAI-compatible)" }), base,
        h("label", { textContent: "Model ID" }), mid,
        h("div", { className: "dia-edit-row" }, find), status, found,
        h("label", { textContent: "API key" }), key,
        h("label", { className: "dia-check" }, small, h("span", { textContent: "Small context window (tick for on-device or local models limited to about 4K tokens)" })),
        h("label", { className: "dia-check" }, vision, h("span", { textContent: "Can read images" })),
        h("label", { className: "dia-check" }, reasoning, h("span", { textContent: "Reasoning model (sends the Effort setting to it)" })),
        h("div", { className: "dia-note", textContent: "Saved in your Firefox profile folder, not sent anywhere except to this server." }),
        h("div", { className: "dia-edit-row" }, h("button", { className: "dia-btn", textContent: "Cancel", onclick: cancel }), save)));
      name.focus();
    }

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
            h("button", { className: "dia-btn", textContent: "＋ Add Gemini", onclick: () => renderGeminiForm(body, null, paint, paint) }),
            h("button", { className: "dia-btn", textContent: "＋ Add another model", onclick: () => renderCustomForm(body, null, paint, paint) })),
          h("div", { className: "dia-menu-sep", textContent: "Your models" }),
          ...(mine.length ? mine.map(row) : [h("div", { className: "dia-note", textContent: "Nothing yet. Add Gemini with just an API key, or any OpenAI-compatible server (Ollama, LM Studio, OpenRouter, OpenAI…). Then switch between models from the top of the sidebar." })]),
          h("div", { className: "dia-menu-sep", textContent: "Built in" }),
          row(builtinModel()));
      };
      const edit = (m) => (m.type === "gemini" ? renderGeminiForm : renderCustomForm)(body, m, paint, paint);
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
      const welcome = () => body.replaceChildren(dots(0), hero("Chat with any page"),
        h("ul", { className: "dia-onb-list" }, ...[
          "Ask about the page you're on, or drag in tabs, files and text for extra context.",
          "Pick your AI: private on your Mac, or a cloud model like Gemini. Switch any time from the top of the sidebar.",
          "It searches the web by itself when a question needs fresh information.",
        ].map((t) => h("li", { textContent: t }))),
        nav(btn("Skip", () => closeSheet()), btn("Get started", () => pickStep(), true)));
      pickStep = () => body.replaceChildren(dots(1), hero("Choose your AI"), sub("You can add more later and switch between them."),
        card("Apple Intelligence", "Private and free. Runs on this Mac through AFM Server.", () => afmStep()),
        card("Google Gemini", "Fast and capable. Needs a free API key from Google AI Studio.", () => renderGeminiForm(body, null, () => pickStep(), () => pickStep())),
        card("Something else", "Ollama, LM Studio, OpenRouter, OpenAI… any OpenAI-compatible server.", () => renderCustomForm(body, null, () => pickStep(), () => pickStep())),
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
        const seg = h("div", { className: "dia-seg" });
        const paint = () => seg.replaceChildren(...[["auto", "Automatic"], ["manual", "Only when I ask"], ["off", "Off"]].map(([v, l]) =>
          h("button", { className: "dia-chip" + (webMode() === v ? " on" : ""), textContent: l, onclick: () => { setPref("search", v); paint(); } })));
        paint();
        body.replaceChildren(dots(2), hero("How should it work?"), effortControl(),
          h("div", { className: "dia-eff-top" }, h("span", { textContent: "Web search" })), seg,
          h("div", { className: "dia-note", textContent: "Automatic searches the web when a question needs fresh information." }),
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
      chatId = null; chatTitle = ""; usePage = !!srcUrl() && bool("attachpage", true); skill = null; formats = []; manage = false; webOn = false;
      closePop(); closeHMenu(); closeSheet(); clearNote();
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
    // otherwise just refresh the page pill.
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
      tabPillEl = h("button", { className: "dia-tabpill", hidden: true, onclick: () => { if (started) return; usePage = !usePage; renderPills(); } });
      webPillEl = h("button", { className: "dia-chip dia-web", hidden: true, title: "Web search is on for this chat. Click to turn off.", onclick: () => setWeb(false) }, icon("globe"), "Web");
      const camBtn = h("button", { className: "dia-icon dia-cam", title: "Capture this page", onclick: () => addCapture() }, icon("camera"));
      for (const b of [addBtn, tabPillEl, webPillEl, camBtn]) b.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing focus in the box
      composerEl = h("div", { className: "dia-composer" }, cardsEl, pillsEl, input,
        h("div", { className: "dia-row" }, h("div", { className: "dia-row-left" }, addBtn, tabPillEl, webPillEl), h("div", { className: "dia-row-right" }, camBtn, sendBtn)));
      const dropzone = h("div", { className: "dia-dropzone" }, icon("drop"), h("span", { textContent: "Drop to add as context" }), h("small", { textContent: "Files, tabs or tab groups" }));
      panel = h("div", { className: "dia-panel", hidden: true }, head, logEl, h("div", { className: "dia-foot" }, composerEl), dropzone);
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
        for (const g of groups) await addGroup(g);
        for (const t of tabs) await addTab(t);
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
    function dismiss() { userHidden = true; closePop(); closeHMenu(); sync(); }
    function restore() { userHidden = false; sync(); focusInput(); }

    function close(immediate) {
      if (closed) return;
      closed = true;
      gen++;
      ctrl?.abort();
      closePop();
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
  console.log(`[dia-sidebar] loaded v${VERSION} (copy #${COPY} in this window${COPY > 1 ? " — older copies disabled" : ""})`);
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
