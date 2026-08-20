import { NextRequest } from "next/server";
import { getGeneration, replayLog, subscribe } from "@/lib/mock/store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gen = getGeneration(id);
  if (!gen) return new Response("Unknown generation", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const write = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      for (const event of replayLog(gen)) write(event.type, event.data);

      unsubscribe = subscribe(gen, (event) => write(event.type, event.data));

      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 15000);
      // Stash for cleanup on cancel().
      (controller as unknown as { _heartbeat: ReturnType<typeof setInterval> })._heartbeat = heartbeat;
    },
    cancel(controller) {
      unsubscribe();
      clearInterval((controller as unknown as { _heartbeat: ReturnType<typeof setInterval> })._heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
