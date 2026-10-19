# input

## Responsabilidade
Keymap estilo Blender e despacho de atalhos para ferramentas/viewport.

## Interface pública
`index.ts` — registro e consulta do keymap; `keymap.ts` é a única fonte de atalhos.

## O que NÃO pode ser alterado
- A interface pública (`index.ts`) sem aprovação.
- Hardcoding de teclas em outras seções — atalhos ficam SOMENTE em `keymap.ts`.
