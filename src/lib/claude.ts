import "server-only";
import { requireSecret } from "./config";

// Streams one assistant turn from the Claude Messages API.
// Docs: platform.claude.com/docs/en/build-with-claude/streaming
//
// Handles: text streaming, the web search server tool, citations (turned into
// a Sources list), automatic prompt caching, and pause_turn continuations.

const API_BASE = process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com";
const MAX_CONTINUATIONS = 3;

type Block = { type: string; [key: string]: unknown };

export type ChatMessage = { role: "user" | "assistant"; content: string | Block[] };

export type TurnUsage = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  searches: number;
};

export type TurnResult = {
  text: string;
  sources: { url: string; title: string }[];
  usage: TurnUsage;
  stopReason: string | null;
};

/** A failure talking to Claude. `code` is safe to show the browser. */
export class ClaudeError extends Error {
  constructor(
    public code: "bad_key" | "rate_limited" | "overloaded" | "bad_request" | "upstream_error",
    message: string,
  ) {
    super(message);
  }
}

function codeFor(status: number): ClaudeError["code"] {
  if (status === 401 || status === 403) return "bad_key";
  if (status === 429) return "rate_limited";
  if (status === 529 || status === 503) return "overloaded";
  if (status === 400 || status === 413) return "bad_request";
  return "upstream_error";
}

/** Splits a server-sent-events body into parsed JSON events. */
async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        yield JSON.parse(data) as Record<string, unknown>;
      } catch {
        // A malformed event is skipped rather than ending the reply.
      }
    }
  }
}

type RawUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
};

export async function streamTurn(opts: {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  webSearch: boolean;
  maxSearches: number;
  onText: (text: string) => void;
}): Promise<TurnResult> {
  const conversation = [...opts.messages];
  const usage: TurnUsage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const sources = new Map<string, string>();
  let text = "";
  let stopReason: string | null = null;

  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": requireSecret("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: conversation,
        stream: true,
        cache_control: { type: "ephemeral" },
        ...(opts.webSearch
          ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches }] }
          : {}),
      }),
    }).catch(() => null);

    if (!res) throw new ClaudeError("upstream_error", "Claude could not be reached");
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      console.error(`Claude API returned HTTP ${res.status}: ${detail.slice(0, 300)}`);
      throw new ClaudeError(codeFor(res.status), `Claude returned ${res.status}`);
    }

    const blocks: Block[] = [];
    const partialJson = new Map<number, string>();
    let startUsage: RawUsage = {};
    let endUsage: RawUsage | null = null;

    for await (const ev of events(res.body)) {
      const index = typeof ev.index === "number" ? ev.index : -1;
      switch (ev.type) {
        case "message_start":
          startUsage = ((ev.message as { usage?: RawUsage })?.usage ?? {}) as RawUsage;
          break;
        case "content_block_start":
          blocks[index] = { ...(ev.content_block as Block) };
          break;
        case "content_block_delta": {
          const delta = ev.delta as Block;
          const block = blocks[index];
          if (!block) break;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            block.text = `${(block.text as string) ?? ""}${delta.text}`;
            text += delta.text;
            opts.onText(delta.text);
          } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
            partialJson.set(index, (partialJson.get(index) ?? "") + delta.partial_json);
          } else if (delta.type === "citations_delta") {
            const added = (delta.citation ? [delta.citation] : (delta.citations as unknown[]) ?? []) as {
              url?: string;
              title?: string;
            }[];
            block.citations = [...(((block.citations as unknown[]) ?? []) as unknown[]), ...added];
            for (const c of added) {
              if (c.url) sources.set(c.url, c.title || c.url);
            }
          }
          break;
        }
        case "content_block_stop": {
          const json = partialJson.get(index);
          if (json !== undefined && blocks[index]) {
            try {
              blocks[index].input = JSON.parse(json || "{}");
            } catch {
              blocks[index].input = {};
            }
          }
          break;
        }
        case "message_delta":
          stopReason = ((ev.delta as { stop_reason?: string })?.stop_reason ?? null) as string | null;
          endUsage = (ev.usage ?? null) as RawUsage | null;
          break;
        case "error": {
          const message = (ev.error as { message?: string })?.message ?? "stream error";
          console.error(`Claude stream error: ${message}`);
          throw new ClaudeError("upstream_error", message);
        }
      }
    }

    // message_delta usage is cumulative for the request; fall back to message_start.
    const u: RawUsage = { ...startUsage, ...(endUsage ?? {}) };
    usage.input += u.input_tokens ?? 0;
    usage.output += u.output_tokens ?? 0;
    usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
    usage.cacheRead += u.cache_read_input_tokens ?? 0;
    usage.searches += u.server_tool_use?.web_search_requests ?? 0;

    if (stopReason !== "pause_turn") break;

    // A long web-search turn was paused: hand back what came so far and continue.
    const content = blocks.filter(Boolean).map((b) => {
      const copy = { ...b };
      if (copy.citations == null || (Array.isArray(copy.citations) && copy.citations.length === 0)) {
        delete copy.citations;
      }
      return copy;
    });
    conversation.push({ role: "assistant", content });
  }

  return {
    text,
    sources: Array.from(sources, ([url, title]) => ({ url, title })),
    usage,
    stopReason,
  };
}

/** USD cost of a turn, from prices kept in settings. */
export function turnCost(
  usage: TurnUsage,
  prices: { input: number; output: number; cacheWrite: number; cacheRead: number; search: number },
): number {
  const perToken =
    usage.input * prices.input +
    usage.output * prices.output +
    usage.cacheWrite * prices.cacheWrite +
    usage.cacheRead * prices.cacheRead;
  return perToken / 1_000_000 + usage.searches * prices.search;
}
