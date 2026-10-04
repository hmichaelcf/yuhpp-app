"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { appPath } from "@/lib/paths";
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

function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export default function ChatView({
  runId,
  initialMessages,
  initiallyOpen,
  description,
}: {
  runId: string;
  initialMessages: Message[];
  initiallyOpen: boolean;
  description: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [open, setOpen] = useState(initiallyOpen);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

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

  return (
    <div className="chat">
      {messages.length === 0 ? (
        <div className="chat-empty">
          <p>{description}</p>
          <p className="aside">
            Start by pasting what this step needs, such as your resume or the job posting. If
            something is missing, it will ask you.
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
                    <Markdown text={m.content} />
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
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Write or paste here. Press Ctrl+Enter or Cmd+Enter to send."
            rows={5}
            disabled={busy}
          />
          <div className="composer-row">
            <button type="button" className="text-button" onClick={finish} disabled={busy}>
              Finish this run
            </button>
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
      ) : (
        <p className="aside">
          This run is finished. <Link href="/prompts">Start another prompt</Link>.
        </p>
      )}
    </div>
  );
}
