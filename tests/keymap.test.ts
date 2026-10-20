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
});
