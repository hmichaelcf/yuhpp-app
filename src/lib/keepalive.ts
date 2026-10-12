// Webflow Cloud drops a response that sends nothing for 20 seconds. Work
// that can take longer (reading a resume with a model) streams its JSON
// result: a space right away and every few seconds while the work runs
// (JSON ignores leading whitespace), then the JSON. The status is always
// 200; the body's "ok" says how it went.

export function keepAliveJson(work: () => Promise<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // The browser went away; finish the work anyway.
        }
      };
      send(" ");
      const timer = setInterval(() => send(" "), 5_000);
      try {
        send(JSON.stringify(await work()));
      } finally {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      // event-stream tells proxies not to buffer the keepalive spaces.
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
