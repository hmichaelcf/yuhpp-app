"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CopyButton from "./CopyButton";
import StoryPicker from "./StoryPicker";
import { callApi } from "@/lib/client-api";
import { appPath } from "@/lib/paths";
import type { BankSummary } from "@/lib/story-bank-summary";
import { parseStream } from "@/lib/stream-protocol";

type Message = { role: "user" | "assistant"; content: string };

const ERRORS: Record<string, string> = {
  bad_key: "The AI service rejected the app's key. An admin needs to check ANTHROPIC_API_KEY.",
  rate_limited: "The AI service is busy right now. Wait a moment and send again.",
  overloaded: "The AI service is busy right now. Wait a moment and send again.",
  bad_request: "That message could not be processed. Try shortening it and send again.",
  upstream_error: "The reply did not come through. Send your message again.",
  cap_reached: "You have used this month's prompt runs. They reset on the 1st.",
  run_closed: "This run is finished. Start a new one from Prompts.",
  run_full: "This run has reached its turn limit. Start a new one from Prompts.",
  too_long: "That message is too long. Split it into two messages.",
  signed_out: "Your session ended. Sign in again to continue.",
};

type HastNode = { type: string; value?: string; children?: HastNode[] };

/** The plain text inside a rendered markdown element. */
function hastText(node: HastNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(hastText).join("");
}

/** Saves a search written in a run to the member's Outreach page. */
function SaveSearchButton({ query, runId }: { query: string; runId: string }) {
  const [state, setState] = useState<"" | "busy" | "saved" | "exists" | "failed">("");
  async function save() {
    setState("busy");
    const r = await callApi("POST", "/api/searches", { query, runId });
    setState(!r.ok ? "failed" : r.data.result === "exists" ? "exists" : "saved");
  }
  if (state === "saved" || state === "exists") {
    return (
      <span className="code-saved">
        {state === "saved" ? "Saved to " : "Already in "}
        <Link href="/outreach">Outreach</Link>
      </span>
    );
  }
  return (
    <button type="button" className="copy" onClick={save} disabled={state === "busy"}>
      {state === "busy" ? "Saving" : state === "failed" ? "Not saved, try again" : "Save search"}
    </button>
  );
}

function Markdown({ text, saveRunId }: { text: string; saveRunId?: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        // Code blocks get a Copy button, and in a search-building run a Save
        // button that adds the search to the Outreach page.
        pre: ({ node, children }) => {
          const code = hastText(node as HastNode | undefined).replace(/\n+$/, "");
          return (
            <div className="code-block">
              <pre>{children}</pre>
              {code.trim() ? (
                <div className="code-actions">
                  <CopyButton text={code} className="text-button" />
                  {saveRunId ? <SaveSearchButton query={code.trim()} runId={saveRunId} /> : null}
                </div>
              ) : null}
            </div>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** What identifies the bank's contents, to notice when it changed. */
function bankKey(b: BankSummary | undefined): string {
  return b ? JSON.stringify([b.total, b.stories.map((s) => [s.id, s.label, s.themes, s.complete])]) : "";
}

/**
 * "This run reads": the saved resume and, for prompts that read it, the story
 * bank. The bank part updates on its own when the member comes back to the
 * page after changing the bank somewhere else.
 */
function RunContext({ resume, bank, updated }: { resume: string | null; bank?: BankSummary; updated: boolean }) {
  const n = bank?.stories.length ?? 0;
  return (
    <div className="run-context">
      <span className="run-context-label">This run reads</span>
      <ul className="run-context-list">
        <li className={resume ? "ctx on" : "ctx off"}>
          <span className="ctx-dot" aria-hidden="true" />
          <span className="ctx-name">Your resume</span>
          <span className="ctx-detail">{resume ? `saved ${resume}` : "not saved; it will ask if this step needs it"}</span>
          <Link className="ctx-link" href="/profile">
            {resume ? "Change" : "Save it"}
          </Link>
        </li>
        {bank ? (
          <li className={n ? "ctx on" : "ctx off"}>
            <span className="ctx-dot" aria-hidden="true" />
            <span className="ctx-name">Your story bank</span>
            <span className="ctx-detail">
              {n === 0
                ? "empty; it will ask for examples"
                : n < bank.total
                  ? `${n} of ${bank.total} stories fit in one run`
                  : `${plural(n, "story", "stories")}, ${plural(bank.themes, "theme", "themes")}`}
            </span>
            {updated ? (
              <span className="ctx-updated" role="status">
                Updated
              </span>
            ) : null}
            <Link className="ctx-link" href="/stories">
              {n ? "Open" : "Add stories"}
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export default function ChatView({
  runId,
  initialMessages,
  initiallyOpen,
  description,
  saveSearches = false,
  resumeSavedOn,
  initialBank,
  initialDraft = "",
}: {
  runId: string;
  initialMessages: Message[];
  initiallyOpen: boolean;
  description: string;
  /** Offer "Save search" on code blocks (Smart Job Search Builder runs). */
  saveSearches?: boolean;
  /** When the member's saved resume was saved, or null when there is none. */
  resumeSavedOn: string | null;
  /** The story bank, for prompts that read it; undefined for the rest. */
  initialBank?: BankSummary;
  /** A first message ready to send, for a run started from a story. */
  initialDraft?: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [open, setOpen] = useState(initiallyOpen);
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [bank, setBank] = useState<BankSummary | undefined>(initialBank);
  const [bankUpdated, setBankUpdated] = useState(false);
  const [picking, setPicking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const pickerButton = useRef<HTMLButtonElement>(null);
  const lastBankCheck = useRef(0);
  const bankRef = useRef(initialBank);
  const readsBank = initialBank !== undefined;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // A run started from a story arrives with its first message written: put
  // the cursor at the end of it, ready to send or add to.
  useEffect(() => {
    const el = box.current;
    if (!initialDraft || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [initialDraft]);

  // Keep the bank current while the page is open: ask again whenever the
  // member comes back to this tab (say, after adding a story in another one)
  // and after each reply. The run itself always reads the bank as saved when
  // a message is sent; this keeps what the page shows in step with it.
  const refreshBank = useCallback(async () => {
    if (Date.now() - lastBankCheck.current < 1500) return;
    lastBankCheck.current = Date.now();
    try {
      const res = await fetch(appPath("/api/stories"), { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; bank?: BankSummary };
      if (!res.ok || !data.ok || !data.bank) return;
      const next = data.bank;
      if (bankKey(next) !== bankKey(bankRef.current)) {
        bankRef.current = next;
        setBank(next);
        setBankUpdated(true);
      }
    } catch {
      // Offline for a moment; the next check will catch up.
    }
  }, []);

  useEffect(() => {
    if (!readsBank) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshBank();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // A page restored with the Back button can be out of date too.
    const first = setTimeout(() => void refreshBank(), 0);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [readsBank, refreshBank]);

  useEffect(() => {
    if (!bankUpdated) return;
    const t = setTimeout(() => setBankUpdated(false), 4000);
    return () => clearTimeout(t);
  }, [bankUpdated]);

  /** Puts text into the message at the cursor, on its own line. */
  function insertIntoDraft(text: string) {
    const el = box.current;
    const at = el ? el.selectionStart : draft.length;
    const before = draft.slice(0, at);
    const after = draft.slice(at);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const trail = after && !after.startsWith("\n") ? "\n" : "";
    const next = before + lead + text + trail + after;
    setDraft(next);
    const cursor = (before + lead + text).length;
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(cursor, cursor);
    });
  }

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    setError(null);
    setBusy(true);
    setDraft("");
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);

    const fail = (code: string) => {
      setError(ERRORS[code] ?? ERRORS.upstream_error);
      setMessages((m) => m.slice(0, -2));
      setDraft(content);
    };

    try {
      const res = await fetch(appPath(`/api/runs/${runId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "run_closed") setOpen(false);
        fail(data.error ?? "upstream_error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let shown = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          const parsed = parseStream(raw);
          if (parsed.error) continue;
          setStatus(parsed.status);
          if (parsed.text !== shown) {
            shown = parsed.text;
            const text = shown;
            setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: text }]);
          }
        }
      } catch {
        // Reading failed partway; handled below like any unfinished reply.
      }
      const parsed = parseStream(raw);
      if (parsed.error) {
        fail(parsed.error);
      } else if (!parsed.done) {
        // The connection was cut before the reply finished.
        if (!parsed.text) {
          fail("upstream_error");
        } else {
          setDraft(content);
          setError(
            "The connection dropped before the reply finished. Refresh the page in a minute to see whether it completed. If it did not, send your message again.",
          );
        }
      }
    } catch {
      fail("upstream_error");
    } finally {
      setBusy(false);
      setStatus("");
      if (readsBank) {
        lastBankCheck.current = 0;
        void refreshBank();
      }
    }
  }

  async function finish() {
    const res = await fetch(appPath(`/api/runs/${runId}/close`), { method: "POST" }).catch(() => null);
    if (res?.ok) setOpen(false);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  }

  const storyCount = bank?.stories.length ?? 0;
  const loaded = [resumeSavedOn ? "your resume" : "", storyCount ? "your story bank" : ""].filter(Boolean);

  return (
    <div className="chat">
      <RunContext resume={resumeSavedOn} bank={bank} updated={bankUpdated} />

      {messages.length === 0 ? (
        <div className="chat-empty">
          <p>{description}</p>
          <p className="aside">
            {loaded.length ? (
              <>
                {loaded.join(" and ").replace(/^y/, "Y")} {loaded.length > 1 ? "are" : "is"} already loaded, so
                there is nothing to paste for {loaded.length > 1 ? "them" : "it"}. Start with anything else this
                step needs; if something is missing, it will ask you.
                {storyCount ? " To work with particular stories, use Add stories below." : ""}
              </>
            ) : (
              <>
                Start by pasting what this step needs, such as your resume or the job posting. If something is
                missing, it will ask you.
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === "assistant" ? (
              <>
                {m.content ? (
                  <div className="md">
                    <Markdown
                      text={m.content}
                      saveRunId={saveSearches && !(busy && i === messages.length - 1) ? runId : undefined}
                    />
                  </div>
                ) : null}
                {busy && i === messages.length - 1 && (status || !m.content) ? (
                  <p className="thinking">{status || "Working on it"}</p>
                ) : null}
              </>
            ) : (
              <p className="user-text">{m.content}</p>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="composer">
          <textarea
            ref={box}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Write or paste here. Press Ctrl+Enter or Cmd+Enter to send."
            rows={5}
            disabled={busy}
          />
          {picking && bank ? (
            <StoryPicker
              bank={bank}
              onAdd={(text) => {
                insertIntoDraft(text);
                setPicking(false);
              }}
              onClose={() => {
                setPicking(false);
                pickerButton.current?.focus();
              }}
              ignore={pickerButton}
            />
          ) : null}
          <div className="composer-row">
            <button type="button" className="text-button" onClick={finish} disabled={busy}>
              Finish this run
            </button>
            <div className="composer-actions">
              {storyCount ? (
                <button
                  ref={pickerButton}
                  type="button"
                  className="add-stories"
                  aria-expanded={picking}
                  onClick={() => {
                    if (!picking) void refreshBank();
                    setPicking((p) => !p);
                  }}
                  disabled={busy}
                >
                  Add stories
                </button>
              ) : null}
              <button
                type="button"
                className="primary-button inline"
                onClick={() => void send()}
                disabled={busy || !draft.trim()}
              >
                {busy ? "Replying" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="aside">
          This run is finished. <Link href="/prompts">Start another prompt</Link>.
        </p>
      )}
    </div>
  );
}
