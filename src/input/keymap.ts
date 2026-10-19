export type KeyAction =
  | 'toggleObjectEdit'
  | 'modeVertex'
  | 'modeEdge'
  | 'modeFace'
  | 'selectAll'
  | 'deselectAll';

export interface KeyBinding {
  action: KeyAction;
  /** `KeyboardEvent.code` */
  code: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  /** Só dispara em Edit mode. */
  requiresEdit?: boolean;
}

/** Única fonte de atalhos do app. */
export const KEYMAP: readonly KeyBinding[] = [
  { action: 'toggleObjectEdit', code: 'Tab' },
  { action: 'modeVertex', code: 'Digit1', requiresEdit: true },
  { action: 'modeEdge', code: 'Digit2', requiresEdit: true },
  { action: 'modeFace', code: 'Digit3', requiresEdit: true },
  { action: 'selectAll', code: 'KeyA' },
  { action: 'deselectAll', code: 'KeyA', alt: true },
] as const;

export function matchKeyAction(
  event: KeyboardEvent,
  editMode: boolean,
): KeyAction | null {
  for (const binding of KEYMAP) {
    if (binding.requiresEdit && !editMode) continue;
    if (event.code !== binding.code) continue;
    if (!!binding.alt !== event.altKey) continue;
    if (!!binding.ctrl !== event.ctrlKey) continue;
    if (!!binding.shift !== event.shiftKey) continue;
    return binding.action;
  }
  return null;
}
