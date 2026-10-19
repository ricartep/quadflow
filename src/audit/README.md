# audit

## Responsabilidade
Regras puras de análise de malha que produzem `Issue[]`.

## Interface pública
`index.ts` — tipo `Issue` e funções `(mesh) => Issue[]`.

## O que NÃO pode ser alterado
- A interface pública (`index.ts`) sem aprovação.
- Regras devem permanecer funções puras, sem acesso à UI.
- Toda regra nova exige testes em `/tests`.
- Textos pedagógicos longos ficam em `/lessons` e `/explain`.
