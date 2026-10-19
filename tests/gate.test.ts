import { describe, expect, it } from 'vitest';
import { hashCode, verifyCode } from '../src/ui/gate/crypto';

describe('hashCode', () => {
  it('produz hash hex de 64 caracteres', async () => {
    const hash = await hashCode('qualquer');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('trata espaços como parte do input', async () => {
    const trimmed = await hashCode('abc');
    const leading = await hashCode(' abc');
    const trailing = await hashCode('abc ');
    const both = await hashCode(' abc ');
    expect(leading).not.toBe(trimmed);
    expect(trailing).not.toBe(trimmed);
    expect(both).not.toBe(trimmed);
  });
});

describe('verifyCode', () => {
  it('aceita o código certo', async () => {
    const secret = 'codigo-certo-teste';
    const expected = await hashCode(secret);
    await expect(verifyCode(secret, expected)).resolves.toBe(true);
  });

  it('rejeita o código errado', async () => {
    const expected = await hashCode('codigo-certo-teste');
    await expect(verifyCode('codigo-errado', expected)).resolves.toBe(false);
  });

  it('rejeita input vazio', async () => {
    const expected = await hashCode('codigo-certo-teste');
    await expect(verifyCode('', expected)).resolves.toBe(false);
  });

  it('rejeita código com espaços extras', async () => {
    const secret = 'codigo-certo-teste';
    const expected = await hashCode(secret);
    await expect(verifyCode(` ${secret} `, expected)).resolves.toBe(false);
  });
});
