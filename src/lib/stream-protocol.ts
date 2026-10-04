// How a streamed reply travels from /api/runs/[id]/messages to the browser.
// The body is the reply text, plus a few control characters that never
// appear in it:
//   KEEPALIVE      sent every few seconds while nothing else is, because
//                  Webflow Cloud drops a response that goes 20 seconds silent
//   STATUS...END   what the model is doing while no text is coming
//   ERROR_PREFIX   the whole body, when the turn failed before any text
//   DONE           the last byte of a reply that finished, so a connection
//                  cut partway can be told apart from a finished reply
// Shared by the server route and the chat view, so it has no server imports.

export const KEEPALIVE = "\u0001";
export const STATUS_START = "\u0002";
export const STATUS_END = "\u0003";
export const ERROR_PREFIX = "\u0000ERROR:";
export const DONE = "\u0004";

const CONTROL = /[\u0000-\u0004]/g;

/** Removes protocol characters from model text or a status line. */
export function clean(text: string): string {
  return text.replace(CONTROL, "");
}

export function statusLine(status: string): string {
  return `${STATUS_START}${clean(status).slice(0, 160)}${STATUS_END}`;
}

/**
 * Splits everything received so far into the reply text, the latest status
 * (empty once text has come after it), and an error code if the turn failed.
 */
export function parseStream(raw: string): {
  text: string;
  status: string;
  error: string | null;
  done: boolean;
} {
  const done = raw.endsWith(DONE);
  const body = raw.split(KEEPALIVE).join("").split(DONE).join("");
  let text = "";
  let status = "";
  let pos = 0;
  for (;;) {
    const open = body.indexOf(STATUS_START, pos);
    if (open < 0) break;
    const close = body.indexOf(STATUS_END, open);
    text += body.slice(pos, open);
    if (close < 0) {
      // A status line split across chunks: wait for the rest.
      pos = body.length;
      break;
    }
    status = body.slice(open + 1, close);
    pos = close + 1;
  }
  const rest = body.slice(pos);
  if (rest) status = "";
  text += rest;
  if (text.startsWith(ERROR_PREFIX)) {
    const error = text.slice(ERROR_PREFIX.length).trim() || "upstream_error";
    return { text: "", status: "", error, done: true };
  }
  return { text, status, error: null, done };
}
