// Focus helpers for the kit's modal / alertdialog surfaces and for controls
// that remove themselves when used (Activate, Apply, Reset, rename confirm).
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/** Keeps Tab / Shift+Tab inside `container` (for aria-modal surfaces). Call
    from the container's onKeyDown when event.key === "Tab". */
export function trapTab(event: KeyboardEvent<Element>, container: HTMLElement): void {
  const items = focusables(container);
  if (items.length === 0) { event.preventDefault(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || active === container || !container.contains(active)) { event.preventDefault(); last.focus(); }
  } else if (active === last || !container.contains(active)) {
    event.preventDefault(); first.focus();
  }
}

export interface FocusRescueOptions {
  /** Repeated items inside the root (rows / cards). Focus returns to the same item. */
  item?: string;
  /** Inside an item, the element whose text identifies it (survives re-ordering). */
  key?: string;
  /** Picks the element to focus inside the recovered item (or root); falls back to its first focusable. */
  prefer?: (scope: HTMLElement, wasIn: { renaming: boolean }) => HTMLElement | null;
}

/** When the focused control inside `root` unmounts (an Activate button that
    becomes an Active pill, a rename field that closes, a Reset that hides
    itself), focus would fall to <body>. This hands it to a stable control in
    the same row / card instead. */
export function useFocusRescue(root: RefObject<HTMLElement>, opts: FocusRescueOptions = {}): void {
  const last = useRef<{ el: HTMLElement; key: string | null; index: number; renaming: boolean } | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onIn = (e: FocusEvent): void => {
      const el = e.target as HTMLElement;
      const { item, key } = optsRef.current;
      const itemEl = item ? el.closest<HTMLElement>(item) : null;
      const items = item ? Array.from(node.querySelectorAll(item)) : [];
      last.current = {
        el,
        key: itemEl && key ? itemEl.querySelector(key)?.textContent ?? null : null,
        index: itemEl ? items.indexOf(itemEl) : -1,
        renaming: !!el.closest(".is-renaming"),
      };
    };
    node.addEventListener("focusin", onIn);
    return () => node.removeEventListener("focusin", onIn);
  }, [root]);

  useLayoutEffect(() => {
    const node = root.current;
    const prev = last.current;
    if (!node || !prev || prev.el.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    last.current = null;
    const { item, key, prefer } = optsRef.current;
    let scope: HTMLElement = node;
    if (item) {
      const items = Array.from(node.querySelectorAll<HTMLElement>(item));
      const byKey = prev.key !== null && key ? items.find((it) => it.querySelector(key)?.textContent === prev.key) : undefined;
      scope = byKey ?? items[prev.index] ?? node;
    }
    const target = prefer?.(scope, { renaming: prev.renaming }) ?? focusables(scope)[0] ?? focusables(node)[0];
    target?.focus({ preventScroll: true });
  });
}
