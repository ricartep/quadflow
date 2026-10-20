export type LegendAppMode = 'object' | 'edit';
export type LegendDomain = 'vertex' | 'edge' | 'face';

export interface LegendContext {
  appMode: LegendAppMode;
  domain: LegendDomain;
  transforming: boolean;
  loopCutting?: boolean;
}

export interface ShortcutLegend {
  update(ctx: LegendContext): void;
  dispose(): void;
}

interface ShortcutRow {
  keys: string;
  desc: string;
}

function rowsFor(ctx: LegendContext): { title: string; rows: ShortcutRow[] } {
  if (ctx.transforming) {
    return {
      title: 'Transformando (G / R / S)',
      rows: [
        { keys: 'Arrastar', desc: 'Ajusta o valor com o mouse' },
        { keys: '0–9 . −', desc: 'Digite um valor numérico' },
        { keys: 'X Y Z', desc: 'Trava o eixo (de novo libera)' },
        { keys: 'Enter / LMB', desc: 'Confirma' },
        { keys: 'Esc / RMB', desc: 'Cancela' },
      ],
    };
  }

  if (ctx.loopCutting) {
    return {
      title: 'Loop Cut (Ctrl+R)',
      rows: [
        { keys: 'Mover', desc: 'Escolhe o anel e a posição do corte' },
        { keys: 'LMB / Enter', desc: 'Confirma o corte' },
        { keys: 'Esc / RMB', desc: 'Cancela' },
      ],
    };
  }

  if (ctx.appMode === 'object') {
    return {
      title: 'Object Mode',
      rows: [
        { keys: 'Tab', desc: 'Entrar no Edit Mode' },
        { keys: 'MMB', desc: 'Orbitar a câmera' },
        { keys: 'Shift+MMB', desc: 'Pan' },
        { keys: 'Scroll', desc: 'Zoom' },
        { keys: 'Shift+A', desc: 'Add — cubo na origem' },
        { keys: 'Ctrl+Z', desc: 'Desfazer' },
        { keys: 'Ctrl+Shift+Z', desc: 'Refazer' },
        { keys: 'F11', desc: 'Modo Foco (captura Ctrl+R…)' },
      ],
    };
  }

  const shared: ShortcutRow[] = [
    { keys: 'Tab', desc: 'Voltar ao Object Mode' },
    { keys: '1 / 2 / 3', desc: 'Vértice · Aresta · Face' },
    { keys: 'A', desc: 'Selecionar tudo' },
    { keys: 'Alt+A', desc: 'Limpar seleção' },
    { keys: 'Shift+A', desc: 'Add — cubo na origem' },
    { keys: 'Shift+D', desc: 'Duplicar seleção + G' },
    { keys: 'G R S', desc: 'Mover · Rotacionar · Escalar' },
    { keys: 'Ctrl+R', desc: 'Loop Cut — preview do anel' },
    { keys: 'Ctrl+Z', desc: 'Desfazer' },
    { keys: 'F11', desc: 'Modo Foco (captura Ctrl+R…)' },
  ];

  if (ctx.domain === 'vertex') {
    return {
      title: 'Edit · Vertex',
      rows: [
        ...shared,
        { keys: 'E', desc: 'Extrude — cria aresta (wire)' },
        { keys: 'M', desc: 'Merge no centróide' },
        { keys: 'X', desc: 'Apagar vértices' },
        { keys: 'Clique', desc: 'Selecionar · Shift acumula' },
        { keys: 'Arrastar', desc: 'Seleção em caixa (vários)' },
      ],
    };
  }

  if (ctx.domain === 'edge') {
    return {
      title: 'Edit · Edge',
      rows: [
        ...shared,
        { keys: 'E', desc: 'Extrude — cria uma face (quad)' },
        { keys: 'X', desc: 'Dissolve (fundir faces)' },
        { keys: 'M', desc: 'Merge dos extremos' },
        { keys: 'Clique', desc: 'Selecionar · Shift acumula' },
        { keys: 'Arrastar', desc: 'Seleção em caixa (vários)' },
      ],
    };
  }

  return {
    title: 'Edit · Face',
    rows: [
      ...shared,
      { keys: 'E', desc: 'Extrude — extrai a face' },
      { keys: 'X', desc: 'Apagar faces' },
      { keys: 'M', desc: 'Merge dos vértices da face' },
      { keys: 'Clique', desc: 'Selecionar · Shift acumula' },
      { keys: 'Arrastar', desc: 'Seleção em caixa (vários)' },
    ],
  };
}

/** Painel educativo de atalhos, atualizado conforme o modo. */
export function createShortcutLegend(parent: HTMLElement): ShortcutLegend {
  const root = document.createElement('aside');
  root.className = 'qf-legend';
  root.setAttribute('aria-label', 'Atalhos do QuadFlow');
  parent.appendChild(root);

  const render = (ctx: LegendContext): void => {
    const { title, rows } = rowsFor(ctx);
    root.innerHTML = `
      <div class="qf-legend__brand">QUADFLOW</div>
      <div class="qf-legend__title">${title}</div>
      <ul class="qf-legend__list">
        ${rows
          .map(
            (row) => `
          <li class="qf-legend__row">
            <kbd class="qf-legend__keys">${row.keys}</kbd>
            <span class="qf-legend__desc">${row.desc}</span>
          </li>`,
          )
          .join('')}
      </ul>
      <p class="qf-legend__hint">Dica: use Modo Foco (F11) para o browser não roubar Ctrl+R / Tab.</p>
    `;
  };

  render({ appMode: 'object', domain: 'vertex', transforming: false });

  return {
    update(ctx: LegendContext): void {
      render(ctx);
    },
    dispose(): void {
      root.remove();
    },
  };
}
