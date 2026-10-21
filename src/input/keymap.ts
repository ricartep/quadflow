export type KeyAction =
  | 'toggleObjectEdit'
  | 'modeVertex'
  | 'modeEdge'
  | 'modeFace'
  | 'selectAll'
  | 'deselectAll'
  | 'transformGrab'
  | 'transformRotate'
  | 'transformScale'
  | 'extrude'
  | 'merge'
  | 'delete'
  | 'loopCut'
  | 'addPrimitive'
  | 'duplicate'
  | 'inset'
  | 'bevel'
  | 'axisX'
  | 'axisY'
  | 'axisZ'
  | 'cancelTransform'
  | 'confirmTransform'
  | 'undo'
  | 'redo'
  | 'toggleImmersive'
  | 'subdLevel0'
  | 'subdLevel1'
  | 'subdLevel2'
  | 'subdLevel3'
  | 'toggleSubdView'
  | 'toggleWireframe'
  | 'toggleXRay'
  | 'toggleFlatShading';

export interface KeyBinding {
  action: KeyAction;
  /** `KeyboardEvent.code` */
  code: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  /** Só dispara em Edit mode. */
  requiresEdit?: boolean;
  /** Só dispara durante modal G/R/S. */
  requiresTransform?: boolean;
  /** Só dispara fora do modal G/R/S. */
  blocksDuringTransform?: boolean;
}

/** Única fonte de atalhos do app. */
export const KEYMAP: readonly KeyBinding[] = [
  { action: 'toggleObjectEdit', code: 'Tab', blocksDuringTransform: true },
  {
    action: 'modeVertex',
    code: 'Digit1',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'modeEdge',
    code: 'Digit2',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'modeFace',
    code: 'Digit3',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  { action: 'selectAll', code: 'KeyA', blocksDuringTransform: true },
  { action: 'deselectAll', code: 'KeyA', alt: true, blocksDuringTransform: true },
  {
    action: 'transformGrab',
    code: 'KeyG',
    blocksDuringTransform: true,
  },
  {
    action: 'transformRotate',
    code: 'KeyR',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'transformScale',
    code: 'KeyS',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'extrude',
    code: 'KeyE',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'merge',
    code: 'KeyM',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'delete',
    code: 'KeyX',
    blocksDuringTransform: true,
  },
  {
    action: 'delete',
    code: 'Delete',
    blocksDuringTransform: true,
  },
  {
    action: 'loopCut',
    code: 'KeyR',
    ctrl: true,
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'addPrimitive',
    code: 'KeyA',
    shift: true,
    blocksDuringTransform: true,
  },
  {
    action: 'duplicate',
    code: 'KeyD',
    shift: true,
    blocksDuringTransform: true,
  },
  {
    action: 'inset',
    code: 'KeyI',
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  {
    action: 'bevel',
    code: 'KeyB',
    ctrl: true,
    requiresEdit: true,
    blocksDuringTransform: true,
  },
  { action: 'axisX', code: 'KeyX', requiresTransform: true },

  { action: 'axisY', code: 'KeyY', requiresTransform: true },
  { action: 'axisZ', code: 'KeyZ', requiresTransform: true },
  { action: 'cancelTransform', code: 'Escape', requiresTransform: true },
  { action: 'confirmTransform', code: 'Enter', requiresTransform: true },
  { action: 'confirmTransform', code: 'NumpadEnter', requiresTransform: true },
  {
    action: 'undo',
    code: 'KeyZ',
    ctrl: true,
  },
  {
    action: 'redo',
    code: 'KeyZ',
    ctrl: true,
    shift: true,
  },
  {
    action: 'toggleImmersive',
    code: 'F11',
    blocksDuringTransform: true,
  },
  {
    action: 'subdLevel0',
    code: 'Digit0',
    ctrl: true,
    blocksDuringTransform: true,
  },
  {
    action: 'subdLevel1',
    code: 'Digit1',
    ctrl: true,
    blocksDuringTransform: true,
  },
  {
    action: 'subdLevel2',
    code: 'Digit2',
    ctrl: true,
    blocksDuringTransform: true,
  },
  {
    action: 'subdLevel3',
    code: 'Digit3',
    ctrl: true,
    blocksDuringTransform: true,
  },
  {
    action: 'toggleSubdView',
    code: 'Backquote',
    blocksDuringTransform: true,
  },
  {
    action: 'toggleWireframe',
    code: 'KeyZ',
    blocksDuringTransform: true,
  },
  {
    action: 'toggleXRay',
    code: 'KeyZ',
    alt: true,
    blocksDuringTransform: true,
  },
  {
    action: 'toggleFlatShading',
    code: 'KeyZ',
    shift: true,
    blocksDuringTransform: true,
  },
] as const;

/**
 * Impede atalhos do navegador que conflitam com o app
 * (ex.: Ctrl+R recarregar, Ctrl+S salvar página, Tab sair do foco).
 * Fora do Modo Foco alguns browsers ainda engolem Ctrl+R — use F11.
 */
export function shouldPreventBrowserDefault(event: KeyboardEvent): boolean {
  if (event.code === 'Tab') return true;
  if (event.code === 'F11') return true;

  const mod = event.ctrlKey || event.metaKey;
  if (!mod) return false;

  return (
    event.code === 'KeyR' ||
    event.code === 'KeyS' ||
    event.code === 'KeyZ' ||
    event.code === 'KeyA' ||
    event.code === 'KeyB' ||
    event.code === 'KeyW' ||
    event.code === 'KeyN' ||
    event.code === 'KeyT' ||
    event.code === 'Digit0' ||
    event.code === 'Digit1' ||
    event.code === 'Digit2' ||
    event.code === 'Digit3'
  );
}

/** preventDefault + stopImmediatePropagation na fase capture. */
export function blockBrowserShortcut(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

export function matchKeyAction(
  event: KeyboardEvent,
  editMode: boolean,
  transformActive = false,
): KeyAction | null {
  for (const binding of KEYMAP) {
    if (binding.requiresEdit && !editMode) continue;
    if (binding.requiresTransform && !transformActive) continue;
    if (binding.blocksDuringTransform && transformActive) continue;
    if (event.code !== binding.code) continue;
    if (!!binding.alt !== event.altKey) continue;
    if (!!binding.ctrl !== event.ctrlKey) continue;
    if (!!binding.shift !== event.shiftKey) continue;
    return binding.action;
  }
  return null;
}

/**
 * Entrada numérica do modal G/R/S.
 * Retorna dígito, ".", "-", ou "backspace"; null se não for input numérico.
 */
export function matchNumericInput(event: KeyboardEvent): string | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;

  if (event.code === 'Backspace') return 'backspace';
  if (event.code === 'Minus' || event.code === 'NumpadSubtract') return '-';
  if (
    event.code === 'Period' ||
    event.code === 'NumpadDecimal' ||
    event.code === 'Comma'
  ) {
    return '.';
  }

  const digit = event.code.match(/^Digit(\d)$/);
  if (digit) return digit[1]!;
  const numpad = event.code.match(/^Numpad(\d)$/);
  if (numpad) return numpad[1]!;

  return null;
}
