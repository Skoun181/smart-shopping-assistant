import type { RequestHandler } from './$types';
import { subscribe, type Topic } from '#lib/server/events.ts';

export const GET: RequestHandler = ({ request }) => {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value:string) => { try { controller.enqueue(encoder.encode(value)); } catch { /* closed */ } };
      const listener = (topic: Topic) => send('data: ' + JSON.stringify({topic}) + '\n\n');
      unsubscribe = subscribe(listener);
      send(': connected\n\n');
      timer = setInterval(()=>send(': heartbeat\n\n'), 20000);
      request.signal.addEventListener('abort', () => { unsubscribe?.(); if (timer) clearInterval(timer); try { controller.close(); } catch { /* already closed */ } }, {once:true});
    },
    cancel() { unsubscribe?.(); if (timer) clearInterval(timer); }
  });
  return new Response(stream, {
    headers: {
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive',
      'X-Accel-Buffering':'no'
    }
  });
};
