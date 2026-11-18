import { EventEmitter } from 'node:events';
import { database, now } from './db';

const emitter = new EventEmitter();
emitter.setMaxListeners(0);
export type Topic = 'shopping' | 'pantry' | 'catalog';
export function changed(topic: Topic) {
  database().prepare('INSERT INTO change_events(topic,created_at) VALUES(?,?)').run(topic,now());
  emitter.emit('change',topic);
}
export function subscribe(listener: (topic: Topic) => void) {
  emitter.on('change',listener);
  return () => emitter.off('change',listener);
}
