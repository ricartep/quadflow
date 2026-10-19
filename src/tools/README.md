# tools

## Responsabilidade
Operadores de modelagem (extrude, loop cut, bevel, inset, merge, etc.).

## Interface pública
`index.ts` — operadores exportados que recebem malha/seleção e retornam malha atualizada.

## O que NÃO pode ser alterado
- A interface pública (`index.ts`) sem aprovação.
- Todo operador novo exige testes em `/tests`.
- Keymap e textos pedagógicos não residem aqui.
