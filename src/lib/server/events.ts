import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();
emitter.setMaxListeners(0);
export type Topic = 'shopping' | 'pantry' | 'catalog';

export function changed(topic: Topic): void {
  emitter.emit('change', topic);
}

export function subscribe(listener: (topic: Topic) => void): () => void {
  emitter.on('change', listener);
  return () => emitter.off('change', listener);
}
