# viewport

## Responsabilidade
Câmera, grid, renderização Three.js, seleção visual e shading da cena.

## Interface pública
`index.ts` — montagem e ciclo de vida do viewport (criar cena, anexar ao DOM, render loop).

## O que NÃO pode ser alterado
- A interface pública (`index.ts`) sem aprovação.
- Keymap de atalhos (fica em `/input`).
- Lógica de auditoria ou textos pedagógicos.
