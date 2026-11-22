// Small helpers shared by the Buttons-tab groups.
import type { ReactNode } from "react";
import type { DropOption } from "../../kit";

/** Dropdown options from a driver's action list. A current action the list
    doesn't name (a macro, a shortcut, an encoding this build can't label) is
    kept as a disabled first entry so the row still shows what the button does
    — the same "preserve, don't misrepresent" rule the v1 selects follow. */
export function actionOptions(options: readonly string[], current: string | null | undefined): DropOption<string>[] {
  const list: DropOption<string>[] = options.map((o) => ({ value: o, label: o }));
  if (current != null && current !== "" && !options.includes(current)) {
    list.unshift({ value: current, label: current, disabled: true });
  }
  return list;
}

/** A single-entry, read-only option list for a locked row's (disabled) Dropdown. */
export function lockedOption(label: string): DropOption<string>[] {
  return [{ value: label, label }];
}

/** Read-only action text in a Remap row's 220-wide control slot (Control=Value). */
export function RemapValue({ children, title }: { children: ReactNode; title?: string }): ReactNode {
  return <span className="mk-btn-value mk-t-label14" title={title}>{children}</span>;
}

/** One quiet line of context under a group (firmware locks, where changes are saved). */
export function GroupNote({ children }: { children: ReactNode }): ReactNode {
  return <p className="mk-btn-note mk-t-caption12">{children}</p>;
}
