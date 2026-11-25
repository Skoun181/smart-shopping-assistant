import { tick } from 'svelte';

export function modalFocus(node: HTMLElement, close: () => void) {
  const previous = document.activeElement;
  const focusable = () => Array.from(node.querySelectorAll<HTMLElement>(
    'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'
  )).filter(element => element.getClientRects().length > 0);
  let active = true;
  tick().then(() => {
    if (active) (node.querySelector<HTMLElement>('[data-initial-focus]') ?? focusable()[0])?.focus();
  });
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
  window.addEventListener('keydown', keydown);
  return { destroy() {
    active = false;
    window.removeEventListener('keydown', keydown);
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
  }};
}
