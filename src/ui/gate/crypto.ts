const SALT_PREFIX = 'quadflow-salt:';

/** SHA-256 hex de `"quadflow-salt:" + input` via Web Crypto. */
export async function hashCode(input: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT_PREFIX}${input}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Compara o hash do input com o hash esperado (timing-safe em string). */
export async function verifyCode(
  input: string,
  expectedHash: string,
): Promise<boolean> {
  if (input.length === 0 || expectedHash.length === 0) {
    return false;
  }
  const actual = await hashCode(input);
  if (actual.length !== expectedHash.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}
