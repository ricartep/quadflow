Estado atual



Concluídas: 0, 1A (half-edge) e 1B (malha e vértices na tela). Em andamento: 1C.



Roteiro completo



Cada fatia é uma branch, uma conversa e um commit.



Fase 1: Edição básica



Fatia	Resultado visível	Seções

1C	Tab, modos 1/2/3, seleção por clique	/input, /viewport

1D	G/R/S com X/Y/Z e valor numérico; Esc cancela	/input, /tools

1E	Undo/redo (Ctrl+Z, Ctrl+Shift+Z)	/core



Fase 2: Operadores



Fatia	Operador

2A	Extrude (E)

2B	Merge (M) e delete/dissolve (X)

2C	Loop cut (Ctrl+R), a mais difícil

2D	Shift+A (primitivas), Shift+D (duplicar)

2E	Inset (I)

2F	Bevel (Ctrl+B), a segunda mais difícil



Fase 3: Subdivisão e visualização



Fatia	Resultado

3A	Catmull-Clark como função pura, com testes

3B	Ctrl+1/2/3 e alternar entre a malha-base e o resultado

3C	Alt+Z (x-ray), Z (wireframe), shading liso/chapado



Fase 4: Auditoria (uma regra por fatia, todas funções puras (mesh) => Issue\[])



Fatia	Regra

4A	Estrutura (Issue, executor de regras, painel com a lista)

4B	N-gons e triângulos

4C	Normais invertidas, faces duplicadas, não-manifold

4D	Polos (valência 3, 5, 6+) e onde estão

4E	Fluxo de loops (terminam mal, espaçamento irregular)

4F	Densidade desigual de polígonos

4G	Pinçamento e artefatos ao subdividir



Fase 5: Explicações dinâmicas



Fatia	Resultado

5A	Clicar num erro destaca os elementos e abre o “Por quê?”

5B	Demonstração: aplica subdivisão e mostra o artefato causado

5C	Comparação lado a lado: malha do aluno × malha correta

5D	Animação de redirecionamento de polo



Fase 6: Lições



Fatia	Resultado

6A	Motor de lições (objetivo, dicas, checagens, nota) em JSON

6B	Camada de tutorial na tela (mostra a tecla a usar, passo a passo)

6C	Lições: cubo → cilindro com furo → esfera de quads → rosto simples → roda



Fase 7: Polimento: salvar progresso (localStorage), importar/exportar OBJ, ajustes visuais.



O atalho para economizar crédito



Não faça tudo em ordem. Monte primeiro a primeira lição jogável (v0.5), que ensina de verdade e já valida a ideia:



1C, 1D, 1E, 2A, 2B, 2C, 3A, 3B, 4A, 4B, 4D, 5A, 6A + uma lição.



Inset, bevel, duplicar, regras 4E a 4G, comparação lado a lado e as demais lições ficam para depois. Se a primeira lição não funcionar como você imagina, você descobre isso cedo e barato.



Rotina de cada fatia

powershell

git switch -c feat/nome-da-fatia

Conversa nova no Cursor.

Cole o prompt no formato:

Seção: /xxx

Tarefa: <uma frase do que a fatia entrega, conforme o ROADMAP>

Não toque em: <demais pastas>

Entrega: <funcionalidade> + testes

Antes de codar, me mostre o plano.

Confira o plano (só arquivos da seção citada).

npm test e npm run dev para validar.

git status, commit no formato feat(seção): ..., merge na main, push.

A cada fase fechada: git tag v0.X-nome.

