// ==UserScript==
// @name         Dia Sidebar
// @description  Dia-style AI chat sidebar: docked panel, Skills, @-mentions, attachments, history, key moments on YouTube
// @include      main
// ==/UserScript==

(() => {
  const ID = "dia-sidebar";
  const PREF = "mod.dia-sidebar.";
  const NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MSG = "dia-sidebar:text";
  const SEL_MSG = "dia-sidebar:selection";
  const MAX_CHARS = 24000;
  const MAX_REFS = 12;
  const VERSION = "2.0.0";
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
    drop: "M8 11V3M4.5 6.5L8 3l3.5 3.5M3 11.5v1A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-1",
  };
  const FILLED = new Set(["stop", "play"]);

  // ---------- styles (embedded so script and CSS always match) ----------
  const CSS = `
#dia-dock {
  --fg: #18181b; --bg: #fafafa; --card: #ffffff; --accent: #2f6bff; --danger: #e5484d;
  --line: color-mix(in srgb, var(--fg) 9%, transparent);
  --soft: color-mix(in srgb, var(--fg) 5%, transparent);
  --soft2: color-mix(in srgb, var(--fg) 9%, transparent);
  --mute: color-mix(in srgb, var(--fg) 52%, transparent);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  position: fixed; z-index: 2147483000; box-sizing: border-box; display: flex; flex-direction: column;
  color: var(--fg); background: var(--bg);
  font: 14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased;
  border: 1px solid var(--line); border-radius: var(--zen-native-inner-radius, 14px);
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.1);
  animation: dia-slide 0.32s var(--ease);
  &[hidden] { display: none; }
  &.dia-resizing { user-select: none; }
  &.dia-resizing * { pointer-events: none; }
  &.dia-resizing .dia-grip { pointer-events: auto; }

  .dia-grip { position: absolute; left: -6px; top: 10px; bottom: 10px; width: 12px; cursor: col-resize; z-index: 6; }
  .dia-grip::after { content: ""; position: absolute; left: 5px; top: 0; bottom: 0; width: 2px; border-radius: 2px; background: var(--accent); opacity: 0; transition: opacity 0.15s; }
  .dia-grip:hover::after, &.dia-resizing .dia-grip::after { opacity: 0.5; }

  .dia-panels { flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: inherit; overflow: hidden; position: relative; }
  .dia-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; position: relative; }
  .dia-panel[hidden] { display: none; }
  button { font: inherit; color: inherit; }
  .dia-svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  .dia-svg-fill { fill: currentColor; stroke: none; }

  /* header: just a title and three quiet icons */
  .dia-head { display: flex; align-items: center; gap: 8px; flex: none; padding: 12px 10px 4px 18px; }
  .dia-title { flex: 1; min-width: 0; font-weight: 600; font-size: 13px; letter-spacing: -0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dia-head-right { display: flex; gap: 0; }
  .dia-icon { appearance: none; background: transparent; border: 0; cursor: pointer; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--mute); transition: background-color 0.15s, color 0.15s, transform 0.15s var(--ease); }
  .dia-icon:hover { background: var(--soft); color: var(--fg); }
  .dia-icon:active { transform: scale(0.92); }

  /* conversation */
  .dia-log { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--soft2) transparent; display: flex; flex-direction: column; gap: 22px; padding: 10px 18px 18px; }
  .dia-msg { animation: dia-in 0.38s var(--ease) both; }
  @keyframes dia-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes dia-slide { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
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
  .dia-ubub { padding: 8px 14px; border-radius: 18px 18px 6px 18px; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--soft2); }
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
  @keyframes dia-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
  .dia-note { font-size: 12px; color: var(--mute); margin-top: 4px; }
  .dia-error { color: var(--danger); word-break: break-word; margin: 0; }
  .dia-streaming .dia-answer > p:last-child::after, .dia-streaming .dia-answer > ul:last-child > li:last-child::after, .dia-streaming .dia-answer > ol:last-child > li:last-child::after {
    content: "▍"; margin-inline-start: 2px; opacity: 0.6; animation: dia-blink 1s steps(2) infinite; }
  @keyframes dia-blink { 50% { opacity: 0; } }
  .dia-dots { display: inline-flex; gap: 5px; align-items: center; padding: 4px 0 1px; }
  .dia-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--mute); animation: dia-bounce 1.25s ease-in-out infinite; }
  .dia-dots i:nth-child(2) { animation-delay: 0.16s; } .dia-dots i:nth-child(3) { animation-delay: 0.32s; }
  @keyframes dia-bounce { 0%, 75%, 100% { opacity: 0.3; transform: translateY(0); } 38% { opacity: 0.95; transform: translateY(-4px); } }
  .dia-chunk-in { animation: dia-chunk 0.6s var(--ease) both; }
  @keyframes dia-chunk { from { opacity: 0; filter: blur(1px); } to { opacity: 1; filter: blur(0); } }
  .dia-think { margin: 0 0 10px; font-size: 13px; color: var(--mute); }
  .dia-think summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 4px; user-select: none; width: fit-content; }
  .dia-think summary::-webkit-details-marker { display: none; }
  .dia-think summary .dia-svg { width: 12px; height: 12px; transition: transform 0.2s; transform: rotate(-90deg); }
  .dia-think[open] summary .dia-svg { transform: none; }
  .dia-think.dia-live summary span { animation: dia-pulse 1.4s ease-in-out infinite; }
  .dia-think-body { margin-top: 6px; padding-inline-start: 12px; border-inline-start: 2px solid var(--line); white-space: pre-wrap; max-height: 180px; overflow-y: auto; scrollbar-width: thin; }

  .dia-actions { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 8px; margin-inline-start: -8px; animation: dia-fade 0.4s ease both; }
  @keyframes dia-fade { from { opacity: 0; } to { opacity: 1; } }
  .dia-mini { appearance: none; background: transparent; border: 0; cursor: pointer; font-size: 12px; padding: 3px 8px; border-radius: 8px; color: var(--mute); display: inline-flex; align-items: center; gap: 5px; transition: background-color 0.15s, color 0.15s; }
  .dia-mini .dia-svg { width: 13px; height: 13px; }
  .dia-mini:hover { color: var(--fg); background: var(--soft); }
  .dia-btn { appearance: none; cursor: pointer; border-radius: 10px; padding: 6px 14px; border: 1px solid var(--line); background: var(--card); font-size: 13px; transition: background-color 0.15s; }
  .dia-btn:hover { background: var(--soft); }
  .dia-btn.dia-primary { background: var(--fg); color: var(--bg); border-color: transparent; }
  .dia-btn.dia-primary:hover { opacity: 0.88; }
  .dia-btn[disabled] { opacity: 0.4; cursor: default; }

  /* tab-management proposal */
  .dia-act { margin-top: 12px; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; background: var(--card); }
  .dia-act ul { margin: 0 0 10px; padding-inline-start: 18px; } .dia-act li { margin: 0 0 3px; }
  .dia-act-row { display: flex; gap: 6px; align-items: center; }

  /* empty state */
  .dia-empty { margin: auto 0; padding: 0 2px; display: flex; flex-direction: column; gap: 18px; animation: dia-in 0.5s var(--ease) both; }
  .dia-empty-head { display: flex; flex-direction: column; gap: 4px; }
  .dia-empty-head h2 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -0.02em; }
  .dia-empty-head p { margin: 0; color: var(--mute); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-skills { display: flex; flex-direction: column; gap: 1px; margin: 0 -10px; }
  .dia-skill { appearance: none; background: transparent; border: 0; text-align: start; cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 12px; transition: background-color 0.15s; }
  .dia-skill:hover { background: var(--soft); }
  .dia-skill .dia-svg { color: var(--mute); }
  .dia-skill small { margin-inline-start: auto; color: var(--mute); font-size: 11.5px; }

  /* composer */
  .dia-foot { flex: none; padding: 4px 14px 14px; }
  .dia-composer { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 12px 10px 8px 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); transition: border-color 0.2s, box-shadow 0.25s; }
  .dia-composer:focus-within { border-color: color-mix(in srgb, var(--fg) 24%, transparent); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 0 0 3px var(--soft); }
  .dia-pills { display: flex; flex-wrap: wrap; gap: 5px; max-height: 74px; overflow-y: auto; scrollbar-width: thin; }
  .dia-pills:empty { display: none; }
  .dia-pill { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; box-sizing: border-box; padding: 3px 4px 3px 7px; border-radius: 9px; font-size: 12px; line-height: 1.3; background: var(--soft); animation: dia-in 0.25s var(--ease) both; }
  .dia-pill > .dia-svg { width: 13px; height: 13px; color: var(--mute); }
  .dia-pill img.dia-pill-ico { width: 14px; height: 14px; border-radius: 3px; flex: none; }
  .dia-pill img.dia-pill-thumb { width: 20px; height: 20px; border-radius: 5px; object-fit: cover; flex: none; }
  .dia-pill-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
  .dia-pill.dia-skillpill { background: color-mix(in srgb, var(--accent) 13%, transparent); color: color-mix(in srgb, var(--accent) 80%, var(--fg)); }
  .dia-pill.dia-skillpill > .dia-svg { color: var(--accent); }
  .dia-pill-x { appearance: none; border: 0; background: transparent; cursor: pointer; width: 16px; height: 16px; padding: 0; border-radius: 50%; display: grid; place-items: center; opacity: 0.45; }
  .dia-pill-x:hover { opacity: 1; background: var(--soft2); }
  .dia-pill-x .dia-svg { width: 10px; height: 10px; }
  .dia-pill.dia-locked .dia-pill-x { display: none; }
  .dia-sent .dia-pill-x { display: none; }
  .dia-sent .dia-pill { padding-inline-end: 8px; }
  .dia-input, .dia-input:hover, .dia-input:focus, .dia-input:focus-visible {
    appearance: none !important; -moz-default-appearance: none !important; background: transparent !important; border: 0 !important; border-radius: 0 !important;
    outline: 0 !important; box-shadow: none !important; resize: none; width: 100%; box-sizing: border-box; color: inherit; font: inherit;
    margin: 0; padding: 0 !important; max-height: 160px; min-height: 1.6em; scrollbar-width: thin; }
  .dia-input::placeholder { color: inherit; opacity: 0.42; }
  .dia-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
  .dia-add { width: 28px; height: 28px; }
  .dia-send { appearance: none; border: 0; cursor: pointer; flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--fg); color: var(--bg); transition: transform 0.15s var(--ease), opacity 0.15s; }
  .dia-send .dia-svg { width: 15px; height: 15px; }
  .dia-send:not([disabled]):hover { transform: scale(1.07); }
  .dia-send:active { transform: scale(0.92); }
  .dia-send[disabled] { opacity: 0.2; cursor: default; }
  .dia-addnote { font-size: 12px; color: var(--mute); padding: 0 2px; animation: dia-fade 0.3s ease both; }

  /* drop zone: files and tabs dragged onto the sidebar */
  .dia-dropzone { position: absolute; inset: 8px; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; pointer-events: none;
    border: 1.5px dashed color-mix(in srgb, var(--accent) 60%, transparent); border-radius: 18px; background: color-mix(in srgb, var(--bg) 90%, transparent);
    backdrop-filter: blur(3px); color: var(--accent); font-weight: 550; opacity: 0; transform: scale(0.985); transition: opacity 0.18s, transform 0.25s var(--ease); }
  .dia-dropzone .dia-svg { width: 26px; height: 26px; }
  .dia-dropzone small { color: var(--mute); font-weight: 400; font-size: 12px; }
  .dia-drop .dia-dropzone { opacity: 1; transform: none; }

  /* popup menu (slash skills, @ mentions, + menu) */
  .dia-menu { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; z-index: 10; max-height: 300px; overflow-y: auto; scrollbar-width: thin; padding: 5px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 14px 38px rgba(0, 0, 0, 0.18); animation: dia-in 0.2s var(--ease) both; }
  .dia-menu-sep { font-size: 11px; color: var(--mute); padding: 8px 10px 3px; letter-spacing: 0.02em; }
  .dia-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; text-align: start; appearance: none; border: 0; cursor: pointer; background: transparent; padding: 7px 10px; border-radius: 9px; font-size: 13px; }
  .dia-menu-item:hover, .dia-menu-item.dia-active { background: var(--soft); }
  .dia-menu-item > .dia-svg { color: var(--mute); }
  .dia-menu-item img.dia-menu-ico { width: 16px; height: 16px; border-radius: 4px; flex: none; }
  .dia-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dia-menu-sub { color: var(--mute); font-size: 11.5px; white-space: nowrap; }

  /* history / skills sheet */
  .dia-sheet { position: absolute; inset: 0; z-index: 8; display: flex; flex-direction: column; background: var(--bg); animation: dia-in 0.25s var(--ease) both; }
  .dia-sheet-head { display: flex; align-items: center; gap: 6px; padding: 12px 10px 6px 18px; font-weight: 600; font-size: 13px; }
  .dia-sheet-head span { flex: 1; }
  .dia-sheet-body { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 2px; }
  .dia-search { display: flex; align-items: center; gap: 8px; margin: 2px 12px 8px; padding: 7px 12px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); color: var(--mute); }
  .dia-search input { flex: 1; min-width: 0; border: 0 !important; outline: 0 !important; background: transparent !important; color: var(--fg); font: inherit; padding: 0 !important; }
  .dia-row-item { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 10px; border-radius: 12px; cursor: pointer; }
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
}
@media (prefers-color-scheme: dark) {
  #dia-dock { --fg: #f2f2f4; --bg: #19191b; --card: #242427; --accent: #7aa7ff; --danger: #ff7a7f; box-shadow: 0 0 0 0.5px rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.5); }
}
@media (prefers-reduced-motion: reduce) {
  #dia-dock, #dia-dock * { animation-duration: 1ms !important; animation-delay: 0s !important; transition-duration: 1ms !important; }
}
`;

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
  const provider = () => pref("provider", "apple");
  const apiKey = () => pref("apikey", "").trim();
  const baseUrl = () =>
    (provider() === "apple"
      ? pref("applebase", "http://127.0.0.1:11435/v1")
      : pref("baseurl", "https://api.openai.com/v1")
    )
      .trim()
      .replace(/\/+$/, "")
      .replace(/^(https?:\/\/[^/]+)$/, provider() === "apple" ? "$1/v1" : "$1");
  const model = () =>
    pref("model", "") || ({ anthropic: "claude-haiku-5-5", apple: "apple.local" }[provider()] || "gpt-4o-mini");
  const llmReady = () =>
    provider() === "anthropic"
      ? !!apiKey()
      : provider() === "apple" || !!apiKey() || /localhost|127\.0\.0\.1/.test(baseUrl());
  const isLocal = () => provider() === "apple" || /localhost|127\.0\.0\.1/.test(baseUrl());
  // Apple's on-device model has a tiny context (chunk hard); other local models handle far more.
  const chunkSize = () => parseInt(pref("maxchars", ""), 10) || (provider() === "apple" ? 6000 : isLocal() ? 16000 : MAX_CHARS);
  const thinkBudget = () => (provider() === "anthropic" ? parseInt(pref("thinking", "0"), 10) || 0 : 0);
  const keepHistory = () => pref("savehistory", "true") !== "false";
  const systemPrompt = () => {
    const extra = pref("instructions", "").trim();
    return SYSTEM + (extra ? "\n\nThe user's standing instructions for how you respond:\n" + extra : "");
  };
  const canSeeFiles = () => provider() !== "apple"; // the on-device model is text-only

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
    const FC = "dia-sidebar-chats.json", FS = "dia-sidebar-skills.json";
    const read = async (n, d) => { try { return (await IOUtils.readJSON(file(n))) || d; } catch { return d; } };
    let skills = [];
    return {
      skills: () => skills,
      async load() { skills = await read(FS, []); },
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
    const stamps = forceStamps || pref("yttimestamps", "true") !== "false";
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
    const vid = ytId(browser.currentURI.spec);
    if (vid) return getYouTubeTranscript(browser, browser.currentURI.spec); // throws on no transcript (handled by caller)
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
      console.warn("[dia-sidebar] frame script failed, trying reader mode", e);
    }
    const { ReaderMode } = ChromeUtils.importESModule("resource://gre/modules/ReaderMode.sys.mjs");
    const art = await ReaderMode.downloadAndParseDocument(browser.currentURI.spec);
    if (!art?.textContent) throw new Error("couldn't read this page");
    return { title: art.title, url: browser.currentURI.spec, text: art.textContent.replace(/\s+/g, " ") };
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
  const httpError = (status, body) =>
    `${status} ${String(body).replace(/\s+/g, " ").slice(0, 200)}` +
    (status === 401 || status === 403 ? " (check the API key / access settings of your AI server)" : "");

  // afm-server documents Bearer auth, but its Xcode setup uses x-api-key, so send both
  const authHeaders = () =>
    apiKey()
      ? { authorization: `Bearer ${apiKey()}`, ...(provider() === "apple" ? { "x-api-key": apiKey() } : {}) }
      : {};

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
    if (provider() === "apple") {
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
  // req = { system, pageBlock, messages, web }. Yields { t: "text" | "think" | "status", d }.
  async function* streamLLM(req, signal) {
    const anthropic = provider() === "anthropic";
    const url = anthropic ? "https://api.anthropic.com/v1/messages" : baseUrl() + "/chat/completions";
    const headers = anthropic
      ? {
          "content-type": "application/json",
          "x-api-key": apiKey(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        }
      : { "content-type": "application/json", ...authHeaders() };
    let body;
    if (anthropic) {
      const think = thinkBudget();
      const system = [{ type: "text", text: req.system }];
      if (req.pageBlock) system.push({ type: "text", text: req.pageBlock, cache_control: { type: "ephemeral" } });
      body = { model: model(), max_tokens: 4096 + (think >= 1024 ? think : 0), stream: true, system, messages: req.messages };
      if (think >= 1024) body.thinking = { type: "enabled", budget_tokens: think };
      if (req.web) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
    } else {
      body = {
        model: model(), stream: true,
        messages: [{ role: "system", content: req.system + (req.pageBlock ? "\n\n" + req.pageBlock : "") }, ...req.messages],
      };
    }
    let sawTool = false;
    for await (const j of sseEvents(chunks(url, headers, JSON.stringify(body), signal))) {
      if (anthropic) {
        if (j.type === "error") throw new Error(j.error?.message || "API error");
        if (j.type === "content_block_start") {
          const t = j.content_block?.type;
          if (t === "server_tool_use") { sawTool = true; yield { t: "status", d: "Searching the web…" }; }
          else if (t === "text" && sawTool) { sawTool = false; yield { t: "text", d: "\n\n" }; }
        } else if (j.type === "content_block_delta") {
          if (j.delta?.type === "thinking_delta" && j.delta.thinking) yield { t: "think", d: j.delta.thinking };
          else if (j.delta?.type === "text_delta" && j.delta.text) yield { t: "text", d: j.delta.text };
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
  }

  // one non-streaming helper (used by the Skill builder)
  async function askOnce(system, text, signal) {
    let acc = "";
    for await (const ev of streamLLM({ system, pageBlock: "", messages: [{ role: "user", content: text }], web: false }, signal)) if (ev.t === "text") acc += ev.d;
    return acc;
  }

  // user turn → API content: plain string, or parts when images / PDFs are attached
  function apiContent(text, files) {
    if (!files.length) return text;
    const anthropic = provider() === "anthropic";
    const parts = [];
    for (const f of files) {
      if (f.kind === "image") {
        parts.push(anthropic
          ? { type: "image", source: { type: "base64", media_type: f.mime, data: f.b64 } }
          : { type: "image_url", image_url: { url: `data:${f.mime};base64,${f.b64}` } });
      } else if (f.kind === "pdf" && anthropic) {
        parts.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.b64 } });
      }
    }
    parts.push({ type: "text", text });
    return parts;
  }

  // ---------- markdown -> DOM ----------
  const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|~~[^~]+~~|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>()]+)/;
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
  const inline = (s, seek) =>
    s.split(INLINE_RE).filter(Boolean).flatMap((t) => {
      if (t.startsWith("**") && t.endsWith("**") && t.length > 4) return [h("strong", {}, ...inline(t.slice(2, -2), seek))];
      if (t.startsWith("`") && t.endsWith("`") && t.length > 2) return [h("code", { textContent: t.slice(1, -1) })];
      if (t.startsWith("~~") && t.endsWith("~~") && t.length > 4) return [h("del", { textContent: t.slice(2, -2) })];
      if (t.length > 2 && t[0] === "*" && t.endsWith("*") && t[1] !== "*") return [h("em", {}, ...inline(t.slice(1, -1), seek))];
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

  function renderMd(el, text, seek, fadeStart = Infinity) {
    el.replaceChildren();
    const lines = text.split("\n");
    const starts = [];
    let off = 0;
    for (const l of lines) { starts.push(off); off += l.length + 1; }
    // wrap only the characters newer than `fadeStart` so each freshly streamed slice eases in
    const frag = (content, cStart) => {
      const from = fadeStart === Infinity ? Infinity : Math.max(0, fadeStart - cStart);
      if (from >= content.length) return inline(content, seek);
      if (from <= 0) return [h("span", { className: "dia-chunk-in" }, ...inline(content, seek))];
      return [...inline(content.slice(0, from), seek), h("span", { className: "dia-chunk-in" }, ...inline(content.slice(from), seek))];
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
          h("thead", {}, h("tr", {}, ...head.map((c) => h("th", {}, ...inline(c, seek))))),
          h("tbody", {}, ...rows.map((r) => h("tr", {}, ...head.map((_, k) => h("td", {}, ...inline(r[k] || "", seek)))))));
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
  // The page area is narrowed with a right margin on #appcontent, and the sidebar is positioned in
  // the gap by measuring the tab panels. That works the same in Firefox and in Zen's wrappers.
  const sessions = new Map(); // tab -> session
  let dock = null, panelsEl = null, dragW = null;
  const clampW = (w) => Math.max(320, Math.min(w, 760, Math.floor(window.innerWidth * 0.6)));
  const dockWidth = () => dragW ?? clampW(parseInt(pref("width", "400"), 10) || 400);

  function ensureDock() {
    if (dock) return dock;
    const grip = h("div", { className: "dia-grip", title: "Drag to resize · double-click to reset" });
    panelsEl = h("div", { className: "dia-panels" });
    dock = h("div", { id: "dia-dock", hidden: true }, grip, panelsEl);
    document.documentElement.append(dock);
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      dock.classList.add("dia-resizing");
      const x0 = e.clientX, w0 = dockWidth();
      const move = (ev) => { dragW = clampW(w0 + (x0 - ev.clientX)); updateDock(); };
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

  function updateDock() {
    if (!dock) return;
    const appc = document.getElementById("appcontent");
    const vis = !window.fullScreen && [...sessions.values()].some((s) => s.visible);
    if (!vis) {
      dock.hidden = true;
      appc?.style.removeProperty("margin-right");
      return;
    }
    const w = dockWidth();
    appc?.style.setProperty("margin-right", w + "px", "important");
    const tp = document.getElementById("tabbrowser-tabpanels") || gBrowser.selectedBrowser;
    const r = tp.getBoundingClientRect();
    if (r.height < 40) { dock.hidden = true; return; }
    dock.hidden = false;
    Object.assign(dock.style, {
      left: Math.round(r.right + 6) + "px", top: Math.round(r.top) + "px",
      width: Math.max(0, w - 6) + "px", height: Math.round(r.height) + "px",
    });
  }

  // ---------- attachment pills ----------
  const refMeta = (r) => {
    switch (r.kind) {
      case "tab": return { label: r.label || hostOf(r.url) || "Tab", image: r.image, ico: "page", tip: r.url, locked: r.locked };
      case "clip": return { label: "Pasted text", ico: "copy", tip: (r.text || "").slice(0, 300) };
      case "file": return { label: r.label, ico: "clip", tip: r.label };
      case "pdf": return { label: r.label, ico: "page", tip: r.label };
      case "image": return { label: r.label, thumb: r.dataUrl, ico: "page", tip: r.label };
      default: {
        const t = (r.text || "").trim();
        return { label: "“" + t.slice(0, 28) + (t.length > 28 ? "…" : "") + "”", ico: "chat", tip: t.slice(0, 400) };
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
    let panel, logEl, input, sendBtn, pillsEl, composerEl, titleEl, sheetEl = null;
    let started = false, busy = false, generating = false, stopped = false, closed = false, userHidden = false, wantFocus = false;
    let page = null, convo = [], refs = [], ctrl = null, gen = 0, refSeq = 0, chatId = null, chatTitle = "";
    let usePage = true, skill = null, formats = [], manage = false, web = false;
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
    const onSelection = (m) => { if (panel && !panel.hidden && !closed) addRef(m.data?.text); };
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

    function renderPills() {
      if (!pillsEl) return;
      const els = [];
      const pd = pageData();
      if (!started && usePage && pd) els.push(pill({ label: pd.label, image: pd.image, ico: "page", tip: pd.url }, () => { usePage = false; renderPills(); }));
      for (const r of refs) els.push(pill(refMeta(r), r.locked ? null : () => { refs = refs.filter((x) => x.id !== r.id); renderPills(); }));
      if (skill) els.push(pill({ label: skill.name, ico: "spark" }, () => { skill = null; renderPills(); }, "dia-skillpill"));
      for (const f of formats) els.push(pill({ label: "@" + f.name, ico: "edit", tip: f.hint }, () => { formats = formats.filter((x) => x !== f); renderPills(); }));
      if (manage) els.push(pill({ label: "Manage tabs", ico: "folder" }, () => { manage = false; renderPills(); }));
      if (web) els.push(pill({ label: "Web search", ico: "search" }, () => { web = false; renderPills(); }));
      pillsEl.replaceChildren(...els);
      if (input) input.placeholder = isVid() && usePage ? "Ask about this video…" : usePage && pd ? "Ask about this page…" : "Ask anything…";
      updateSend();
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
      if (provider() === "anthropic") {
        const dataUrl = await readDataUrl(new Blob([buf], { type: "application/pdf" }));
        clearNote();
        addContext({ kind: "pdf", label: name, url, mime: "application/pdf", b64: dataUrl.split(",")[1], text: "[PDF: " + name + "]" });
        return true;
      }
      flashNote("Reading PDF…", true);
      const text = await pdfText(buf);
      if (!text) { flashNote("Couldn't read that PDF's text (PDFs work best with the Anthropic provider)."); return false; }
      clearNote();
      addContext({ kind: "file", label: name, url, text: text.slice(0, 24000) });
      return true;
    }
    async function addFile(f) {
      const name = f.name || "attachment";
      if (/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) {
        if (f.size > 8e6) { flashNote("That image is over 8 MB."); return; }
        const dataUrl = await readDataUrl(f);
        if (!canSeeFiles()) flashNote("The on-device model can't see images — pick another provider in settings.");
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
      if (!q || "web".startsWith(q) || "search".startsWith(q)) out.push({ label: "@Web", ico: "search", sub: provider() === "anthropic" ? "Search the web" : "needs Anthropic", run: () => {
        if (provider() !== "anthropic") { flashNote("Web search needs the Anthropic provider (set it in the mod's settings)."); return; }
        web = true; renderPills();
      } });
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
    function pickSkill(s) { skill = s; renderPills(); focusInput(); }

    // ----- request building -----
    const refHead = (r) =>
      r.kind === "tab" ? `ANOTHER TAB THE USER ATTACHED (${r.label || "tab"})`
      : r.kind === "clip" ? "TEXT THE USER PASTED IN"
      : r.kind === "file" || r.kind === "pdf" ? `FILE THE USER ATTACHED (${r.label})`
      : "TEXT THE USER SELECTED ON THE PAGE";
    const sendsRaw = (r) => r.kind === "image" || (r.kind === "pdf" && provider() === "anthropic"); // sent as image/document blocks
    // the text a user turn carries: the request, @format hints, attached tabs/files/selections, tab list
    function userText(m, withTabs) {
      const apple = provider() === "apple";
      let t = m.content;
      const fm = (m.formats || []).map((id) => FORMATS.find((f) => f.id === id)?.prompt).filter(Boolean);
      if (fm.length) t += "\n\n" + fm.join(" ");
      for (const r of m.refs || []) {
        if (sendsRaw(r)) continue;
        const cap = r.kind === "file" ? (apple ? 3000 : 20000) : apple ? 2000 : 8000;
        t += `\n\n=== ${refHead(r)} ===\n${(r.text || "").slice(0, cap)}`;
      }
      if (m.manage && withTabs) t += `\n\n=== OPEN TABS ===\n${tabListText(tabSnap)}\n\n${TABS_PROTOCOL}`;
      return t;
    }
    // Every request is rebuilt from scratch. Cloud/large models get the page in the system prompt plus
    // real multi-turn history. Apple's tiny on-device model ignores history, so it gets one flattened turn.
    function buildRequest(resuming) {
      const lastU = [...convo].reverse().find((m) => m.role === "user");
      const req = lastU?.content || pref("prompt", DEFAULT_PROMPT);
      let ctx = page && !page.none ? (page.context ?? page.text.slice(0, chunkSize())) : "";
      // On YouTube every transcript line is prefixed with its [mm:ss] stamp (so "Key moments" can cite
      // times). For anything not about timing, strip them so the model doesn't echo them.
      if (page?.youtube && !/\btimestamp|\bmoment|\bchapter|time ?code|mm:ss|\bjump to\b/i.test(req)) {
        ctx = ctx.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/gm, "").replace(/ \(each line is prefixed with its \[mm:ss\] timestamp\)/, "");
      }
      const pageBlock = page && !page.none ? `=== PAGE THE USER IS VIEWING ===\nTitle: ${page.title}\nURL: ${page.url}\n\n${ctx}` : "";
      if (provider() === "apple") {
        const upto = resuming ? convo : convo.slice(0, convo.lastIndexOf(lastU));
        const transcript = upto.slice(-4).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${(m.label || m.content).slice(0, 1200)}`).join("\n");
        const ask = resuming ? "Continue your previous answer exactly where it stopped, without repeating it." : userText(lastU || { content: req }, true);
        return {
          system: systemPrompt(), pageBlock: "", web: false,
          messages: [{ role: "user", content:
            (pageBlock ? "Use the web page below to respond to the user's request. Be concise.\n\n" + pageBlock + "\n\n" : "") +
            (transcript ? `=== CONVERSATION SO FAR ===\n${transcript}\n\n` : "") + `=== REQUEST ===\n${ask}` }],
        };
      }
      const msgs = convo.slice(-24).map((m) => m.role === "assistant"
        ? { role: "assistant", content: m.content }
        : { role: "user", content: apiContent(userText(m, m === lastU), (m.refs || []).filter(sendsRaw)) });
      while (msgs[0]?.role === "assistant") msgs.shift();
      if (resuming) msgs.push({ role: "user", content: "Continue exactly where you stopped. Do not repeat what you already wrote." });
      return { system: systemPrompt(), pageBlock, messages: msgs, web: !!lastU?.web && provider() === "anthropic" };
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
        renderMd(answerEl, text, seekFn());
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
            refs = [...q.refs, ...refs]; skill = q.skill || null; formats = q.formats; manage = q.manage; web = q.web;
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
      let answerEl = block.querySelector(".dia-answer");
      if (!answerEl) { answerEl = h("div", { className: "dia-answer" }); block.append(answerEl); }
      let dots = h("div", { className: "dia-dots" }, h("i"), h("i"), h("i")); // "thinking" until the first token
      block.append(dots);
      if (!block.isConnected) logEl.append(block);
      renderQueue();
      scrollDown(true);
      let acc = prior ? prior.content : "";
      let failed = false, thinkEl = null, thinkBody = null, thinkAcc = "", statusEl = null;
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
        renderMd(answerEl, acc.slice(0, end), seek, shown);
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
        renderMd(answerEl, body, seek); // final solid pass, no fade boundary
        block.querySelector(".dia-act")?.remove();
        if (actions) { const card = actionCard(actions); if (card) block.append(card); }
      };
      if (prior) renderMd(answerEl, acc, seek);
      try {
        if (!llmReady()) {
          dropDots();
          acc = extractive(page?.text || "") || "Couldn't find enough text on this page to summarize.";
          renderMd(answerEl, acc, seek);
          answerEl.append(h("div", { className: "dia-note", textContent: "Offline summary. Add an API key (or a local model) in the mod settings for AI answers." }));
        } else {
          for await (const ev of streamLLM(buildRequest(!!prior), signal)) {
            if (ev.t === "think") { onThink(ev.d); continue; }
            if (ev.t === "status") { setStatus(ev.d); continue; }
            endThink(); clearStatus();
            acc = acc.length > 20 && ev.d.startsWith(acc) ? ev.d : acc + ev.d; // tolerate cumulative streams
            const now = Date.now();
            const end = chunkEnd();
            if (end > 0) { lastPaint = now; paint(end); }
            else if (acc.length - shown >= 500) { lastPaint = now; paint(); }
            else if (acc.length > shown && now - lastPaint >= 1800) { lastPaint = now; paint(); }
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
          block.append(h("p", { className: "dia-error", textContent: unreachable ? `Couldn't reach the AI server at ${provider() === "anthropic" ? "api.anthropic.com" : baseUrl()}. Is it running?` : `Couldn't answer: ${e.message}` }));
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
        blockEntry.set(block, entry);
      }
      dropDots();
      block.classList.remove("dia-streaming");
      if (acc && !failed) block.append(actionsRow(block, stopped));
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
        page.context = page.text.length <= size ? page.text : condense(page.text, size);
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
      return { q, label: label || q, raw: opts.text !== undefined ? "" : input.value.trim(), skill: sk, refs, formats, manage, web, usePage: usePage && !!srcUrl() };
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
      refs = []; skill = null; formats = []; manage = false; web = false; // the composer empties (snapshot keeps the old ones)
      closePop();
      if (busy) { queue.push(snap); renderQueue(); renderPills(); return; }
      dispatch(snap);
    }
    function dispatch(snap) {
      logEl.querySelector(".dia-empty")?.remove();
      const pageAtt = !started && snap.usePage ? pageData() : null;
      started = true;
      const entry = { role: "user", content: snap.q, label: snap.label, refs: snap.refs, formats: snap.formats.map((f) => f.id), manage: snap.manage, web: snap.web };
      logEl.append(userMsg(entry, pageAtt));
      if (!chatTitle) { chatTitle = snap.label.slice(0, 60); updateTitle(); }
      if (snap.manage) tabSnap = snapshotTabs();
      renderPills();
      scrollDown(true);
      if (!page) {
        if (snap.usePage) { startFirst(entry); return; }
        page = { none: true, title: "", url: "", text: "" }; // chatting without a page
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
          : { role: "assistant", content: m.content }),
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
        renderMd(block.firstChild, extractActions(m.content).text, seek);
        blockEntry.set(block, m);
        block.append(actionsRow(block, !!m.partial));
        logEl.append(block);
      }
      lastKey = srcKey();
      renderPills();
      scrollDown(false);
      focusInput();
    }

    // ----- sheets (history, skills) laid over the conversation -----
    function closeSheet() { sheetEl?.remove(); sheetEl = null; }
    function openSheet(title, ...body) {
      closeSheet();
      sheetEl = h("div", { className: "dia-sheet" },
        h("div", { className: "dia-sheet-head" }, h("span", { textContent: title }), h("button", { className: "dia-icon", title: "Close", onclick: closeSheet }, icon("close"))),
        ...body);
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
          if (!llmReady()) { prompt.placeholder = "Set up a provider in the mod's settings to use this."; return; }
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
    function renderEmpty() {
      const vid = isVid();
      const pd = pageData();
      const items = skillsFor(vid).slice(0, 9);
      logEl.append(h("div", { className: "dia-empty" },
        h("div", { className: "dia-empty-head" },
          h("h2", { textContent: vid ? "Chat with this video" : pd ? "Chat with this page" : "How can I help?" }),
          h("p", { textContent: pd ? pd.label : "Ask anything, or drop in files and tabs" })),
        h("div", { className: "dia-skills" }, ...items.map((s) =>
          h("button", { className: "dia-skill", title: (s.prompt || "").slice(0, 200), onclick: () => runSkill(s) }, icon("spark"), h("span", { textContent: s.name }), s.custom ? h("small", { textContent: "yours" }) : "")))));
    }

    // keepSplit: re-attach the other split pane(s) as locked pills. open() passes false because it
    // re-detects the split itself right after.
    function newChat(keepSplit = true) {
      ctrl?.abort();
      gen++;
      page = null; convo = []; refs = []; queue = []; started = false; generating = false;
      chatId = null; chatTitle = ""; usePage = !!srcUrl(); skill = null; formats = []; manage = false; web = false;
      closePop(); closeSheet(); clearNote();
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
    function refreshAttach() { if (!started && !closed) renderPills(); }
    function onNav() {
      if (closed) return;
      const key = srcKey();
      if (key === lastKey) { refreshAttach(); return; }
      lastKey = key;
      if (started || convo.length || page) newChat();
      else { usePage = !!srcUrl(); logEl?.querySelector(".dia-empty") && (logEl.replaceChildren(), renderEmpty()); renderPills(); }
    }

    function build() {
      ensureDock();
      const btn = (ico, title, fn) => h("button", { className: "dia-icon", title, onclick: fn }, icon(ico));
      titleEl = h("span", { textContent: "Chat" });
      const head = h("div", { className: "dia-head" },
        h("div", { className: "dia-title" }, titleEl),
        h("div", { className: "dia-head-right" },
          btn("history", "Chat history", () => openHistory()),
          btn("new", "New chat", () => newChat()),
          btn("close", `Hide (${SHORTCUT}) — your chat is kept for this tab`, () => dismiss())));
      logEl = h("div", { className: "dia-log" });
      pillsEl = h("div", { className: "dia-pills" });
      input = h("textarea", { className: "dia-input", rows: 1, placeholder: "Ask about this page…" });
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
        if (e.key === "Escape" && sheetEl) { closeSheet(); return; }
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); submit(); }
      });
      input.addEventListener("paste", (e) => {
        const fs = [...(e.clipboardData?.files || [])];
        if (fs.length) { e.preventDefault(); addFiles(fs); }
      });
      sendBtn = h("button", { className: "dia-send", onclick: () => (busy && !hasContent() ? stop() : submit()) });
      sendBtn.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing focus in the box after sending
      const addBtn = h("button", { className: "dia-icon dia-add", title: "Attach files, add tabs, Skills", onclick: (e) => { e.stopPropagation(); plusMenu(); } }, icon("plus"));
      addBtn.addEventListener("mousedown", (e) => e.preventDefault());
      composerEl = h("div", { className: "dia-composer" }, pillsEl, input, h("div", { className: "dia-row" }, addBtn, sendBtn));
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
      if (srcUrl() && (mode === "true" || (mode === "youtube" && isVid()))) {
        const first = skillsFor(isVid())[0];
        splitDone.then(() => { if (!closed && !started && !busy) runSkill(first); });
      }
    }

    // ----- visibility: the sidebar shows only while its tab (or a split sibling) is on screen -----
    function sync() {
      if (!panel || closed) return;
      const want = !userHidden && isMember(gBrowser.selectedTab);
      const was = panel.hidden;
      panel.hidden = !want;
      if (want && was) { autosize(); if (wantFocus) focusInput(); }
      updateDock();
    }
    function dismiss() { userHidden = true; closePop(); sync(); }
    function restore() { userHidden = false; sync(); focusInput(); }

    function close(immediate) {
      if (closed) return;
      closed = true;
      gen++;
      ctrl?.abort();
      closePop();
      try { mm?.removeMessageListener(SEL_MSG, onSelection); } catch {}
      sessions.delete(src);
      panel?.remove();
      updateDock();
    }

    self = {
      open, sync, dismiss, restore, close, onNav, refreshAttach, addRef,
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
    let s = sessions.get(tab) || current();
    if (s) { if (!s.visible) s.restore(); return s; }
    s = makeSession(tab);
    sessions.set(tab, s);
    s.open();
    return s;
  }
  function toggle() {
    if (stale()) return; // an older copy — the newest one handles the shortcut
    const s = sessions.get(gBrowser.selectedTab) || current();
    if (s) return s.visible ? s.dismiss() : s.restore(); // hidden chats come back as they were
    ensureSession();
  }
  // "Ask Chat about selection" from the page's context menu
  function askAbout(text) {
    if (stale() || !text) return;
    const s = ensureSession();
    s.addRef(text.slice(0, 3000));
  }

  const onKey = (e) => {
    if (stale()) return;
    if (isToggleKey(e)) {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) toggle(); // holding the shortcut auto-repeats — only act on the first press
    }
  };
  const syncAll = () => { sessions.forEach((x) => x.sync()); updateDock(); };
  const onSelect = () => { syncAll(); setTimeout(syncAll, 120); setTimeout(syncAll, 450); };
  const onTabClose = (e) => sessions.get(e.target)?.close(true);
  const onResize = () => syncAll();

  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);
  window.addEventListener("fullscreen", onResize);
  gBrowser.tabContainer.addEventListener("TabSelect", onSelect);
  gBrowser.tabContainer.addEventListener("TabClose", onTabClose);
  // keep the sidebar glued to the page area through split-view / sidebar / toolbar layout changes
  const ticker = setInterval(() => { if ([...sessions.values()].some((s) => s.visible)) updateDock(); }, 600);

  const progressListener = {
    onLocationChange(browser, webProgress) {
      try {
        if (!webProgress.isTopLevel) return;
        const tab = gBrowser.getTabForBrowser(browser);
        sessions.get(tab)?.onNav(); // includes YouTube's in-page (same-document) video switches
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

  // toolbar button (created once per session, shared across windows). Guarded: if this throws during
  // startup, the cleanup handler below must still be registered, or a later copy can't replace us.
  try {
    const { CustomizableUI } = ChromeUtils.importESModule("resource:///modules/CustomizableUI.sys.mjs");
    if (!CustomizableUI.getWidget(ID)?.provider) {
      CustomizableUI.createWidget({
        id: ID,
        type: "button",
        label: "Chat sidebar",
        tooltiptext: `Chat with this page (${SHORTCUT})`,
        defaultArea: CustomizableUI.AREA_NAVBAR,
        onCommand(e) { e.target.ownerGlobal.__diaSidebar?.toggle(); },
      });
    }
  } catch (e) { console.warn("[dia-sidebar] toolbar button", e); }

  window.__diaSidebar = {
    toggle,
    destroy() {
      for (const s of [...sessions.values()]) s.close(true);
      clearInterval(ticker);
      styleEl.remove();
      dock?.remove();
      document.getElementById("appcontent")?.style.removeProperty("margin-right");
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
})();
