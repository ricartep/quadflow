\# Projeto: Poly Modeling Trainer



App web que ensina modelagem poligonal com atalhos e comportamento do Blender,

audita a malha do aluno e explica erros e acertos com demonstrações visuais.



\## Stack

TypeScript, Three.js, Vite, Vitest. Sem frameworks pesados de UI.



\## Regra de ouro: escopo

\- Modifique SOMENTE a seção que eu citar no pedido.

\- Se precisar mexer em outra seção, PARE e me diga o motivo antes.

\- Nunca altere interfaces públicas (index.ts de cada pasta) sem aprovação.

\- Nunca refatore código que não foi pedido.



\## Fluxo de trabalho

1\. Antes de codar, me mostre um plano curto (arquivos que serão tocados).

2\. Mudanças pequenas: uma funcionalidade por vez.

3\. Toda regra de /audit e todo operador de /tools precisa de teste em /tests.

4\. Rode os testes e o build antes de dizer que terminou.

5\. Explique o que mudou em 3-5 linhas.



\## Convenções

\- Atalhos ficam SOMENTE em /input/keymap.ts. Nenhuma outra seção hardcoda tecla.

\- Regras de auditoria são funções puras: (mesh) => Issue\[]. Sem acesso à UI.

\- Cada Issue tem: id, severidade, elementos afetados, explicação, sugestão de correção.

\- Textos pedagógicos ficam em /lessons e /explain, nunca misturados à lógica.



\## Atalhos (referência Blender)

Tab (edit/object), 1/2/3 (vértice/aresta/face), G/R/S (+X/Y/Z), E extrude,

I inset, Ctrl+B bevel, Ctrl+R loop cut, M merge, X delete/dissolve,

Alt+Z x-ray, Ctrl+1/2/3 subdivisão, Shift+A add, Shift+D duplicar,

Numpad 1/3/7 vistas, Numpad 5 ortho/persp, Z wireframe/shading.

