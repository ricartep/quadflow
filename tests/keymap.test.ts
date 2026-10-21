import { describe, expect, it } from 'vitest';
import {
  matchKeyAction,
  shouldPreventBrowserDefault,
} from '../src/input/keymap';

function keyEvent(
  code: string,
  mods: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }> = {},
): KeyboardEvent {
  return {
    code,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    altKey: mods.altKey ?? false,
    shiftKey: mods.shiftKey ?? false,
  } as KeyboardEvent;
}

describe('shouldPreventBrowserDefault', () => {
  it('bloqueia Ctrl+R, Tab e F11', () => {
    expect(shouldPreventBrowserDefault(keyEvent('KeyR', { ctrlKey: true }))).toBe(
      true,
    );
    expect(shouldPreventBrowserDefault(keyEvent('Tab'))).toBe(true);
    expect(shouldPreventBrowserDefault(keyEvent('F11'))).toBe(true);
  });

  it('não bloqueia R sem modificador', () => {
    expect(shouldPreventBrowserDefault(keyEvent('KeyR'))).toBe(false);
  });
});

describe('matchKeyAction loopCut / immersive', () => {
  it('Ctrl+R em edit → loopCut', () => {
    expect(
      matchKeyAction(keyEvent('KeyR', { ctrlKey: true }), true, false),
    ).toBe('loopCut');
  });

  it('F11 → toggleImmersive', () => {
    expect(matchKeyAction(keyEvent('F11'), false, false)).toBe(
      'toggleImmersive',
    );
  });

  it('Shift+A → addPrimitive; Shift+D → duplicate (object ou edit)', () => {
    expect(
      matchKeyAction(keyEvent('KeyA', { shiftKey: true }), false, false),
    ).toBe('addPrimitive');
    expect(
      matchKeyAction(keyEvent('KeyD', { shiftKey: true }), false, false),
    ).toBe('duplicate');
    expect(
      matchKeyAction(keyEvent('KeyD', { shiftKey: true }), true, false),
    ).toBe('duplicate');
  });

  it('I em edit → inset', () => {
    expect(matchKeyAction(keyEvent('KeyI'), true, false)).toBe('inset');
  });

  it('X e Delete apagam em object ou edit', () => {
    expect(matchKeyAction(keyEvent('KeyX'), false, false)).toBe('delete');
    expect(matchKeyAction(keyEvent('Delete'), false, false)).toBe('delete');
  });

  it('Ctrl+B em edit → bevel', () => {
    expect(
      matchKeyAction(keyEvent('KeyB', { ctrlKey: true }), true, false),
    ).toBe('bevel');
  });

  it('Ctrl+0/1/2/3 → níveis de subdivisão; ` → toggle', () => {
    expect(
      matchKeyAction(keyEvent('Digit0', { ctrlKey: true }), false, false),
    ).toBe('subdLevel0');
    expect(
      matchKeyAction(keyEvent('Digit1', { ctrlKey: true }), true, false),
    ).toBe('subdLevel1');
    expect(
      matchKeyAction(keyEvent('Digit2', { ctrlKey: true }), false, false),
    ).toBe('subdLevel2');
    expect(
      matchKeyAction(keyEvent('Digit3', { ctrlKey: true }), false, false),
    ).toBe('subdLevel3');
    expect(matchKeyAction(keyEvent('Backquote'), false, false)).toBe(
      'toggleSubdView',
    );
  });

  it('1/2/3 sem Ctrl em edit continuam modo vértice/aresta/face', () => {
    expect(matchKeyAction(keyEvent('Digit1'), true, false)).toBe('modeVertex');
    expect(matchKeyAction(keyEvent('Digit2'), true, false)).toBe('modeEdge');
    expect(matchKeyAction(keyEvent('Digit3'), true, false)).toBe('modeFace');
  });

  it('bloqueia Ctrl+0/1/2/3 no browser', () => {
    expect(
      shouldPreventBrowserDefault(keyEvent('Digit0', { ctrlKey: true })),
    ).toBe(true);
    expect(
      shouldPreventBrowserDefault(keyEvent('Digit1', { ctrlKey: true })),
    ).toBe(true);
  });

  it('Z / Alt+Z / Shift+Z → wireframe, x-ray, shading', () => {
    expect(matchKeyAction(keyEvent('KeyZ'), false, false)).toBe(
      'toggleWireframe',
    );
    expect(
      matchKeyAction(keyEvent('KeyZ', { altKey: true }), false, false),
    ).toBe('toggleXRay');
    expect(
      matchKeyAction(keyEvent('KeyZ', { shiftKey: true }), true, false),
    ).toBe('toggleFlatShading');
  });

  it('Z durante transform continua eixo Z', () => {
    expect(matchKeyAction(keyEvent('KeyZ'), true, true)).toBe('axisZ');
  });
});
