# QUADFLOW
App web que ensina modelagem poligonal com os atalhos e o comportamento do
Blender, audita a malha do aluno e explica erros e acertos com demonstrações
visuais (polos, fluxo de loops, redirecionamento, subdivisão dinâmica).

## Stack
TypeScript, Three.js, Vite, Vitest. Sem frameworks pesados de UI.

## Estrutura de seções
/src/core       → malha half-edge (vértices, arestas, faces)
/src/viewport   → câmera, grid, render, seleção, shading
/src/input      → keymap estilo Blender
/src/tools      → operadores (extrude, loop cut, bevel, inset, merge...)
/src/modifiers  → subdivisão Catmull-Clark, mirror
/src/audit      → regras de análise de malha
/src/lessons    → fases, tutoriais, desafios
/src/explain    → demonstrações visuais de erro vs acerto
/src/ui         → painéis, HUD, feedback
/docs  /tests

## Regra de ouro: escopo
- Modifique SOMENTE a seção que eu citar no pedido.
- Se precisar mexer em outra seção, PARE e explique o motivo antes.
- Nunca altere interfaces públicas (index.ts) sem aprovação.
- Nunca refatore código que não foi pedido.

## Fluxo de trabalho
1. Mostre um plano curto (arquivos que serão tocados) antes de codar.
2. Uma funcionalidade por vez.
3. Regras de /audit e operadores de /tools exigem testes em /tests.
4. Rode testes e build antes de dizer que terminou.
5. Resuma o que mudou em 3-5 linhas.

## Convenções
- Atalhos ficam SOMENTE em /input/keymap.ts.
- Regras de auditoria são funções puras: (mesh) => Issue[].
- Issue = id, severidade, elementos afetados, explicação, sugestão de correção.
- Textos pedagógicos ficam em /lessons e /explain, nunca na lógica.

## Atalhos (referência Blender)
Tab, 1/2/3, G/R/S (+X/Y/Z), E, I, Ctrl+B, Ctrl+R, M, X, Alt+Z,
Ctrl+1/2/3 (subdivisão), Shift+A, Shift+D, Numpad 1/3/7/5, Z.
