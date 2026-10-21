import type { Issue } from '../audit';

/** Textos pedagógicos longos (5A — “Por quê?”). */
export function whyTextForIssue(issue: Issue): string {
  if (issue.id.includes('tri')) {
    return (
      'Triângulos quebram o fluxo de edge loops. Em subdivisão Catmull-Clark ' +
      'eles geram pinçamento e sombreamento estranho. Prefira quads sempre que possível.'
    );
  }
  if (issue.id.includes('ngon')) {
    return (
      'N-gons (5+ lados) não têm uma diagonal “natural”. O subdivisor escolhe ' +
      'uma tessellação imprevisível — o relevo fica irregular. Divida em quads.'
    );
  }
  if (issue.id.includes('duplicate')) {
    return (
      'Faces duplicadas ocupam o mesmo espaço e confundem normais, seleção e ' +
      'export. Apague a cópia extra.'
    );
  }
  if (issue.id.includes('nonmanifold')) {
    return (
      'Em modelagem limpa cada aresta liga no máximo duas faces. Três ou mais ' +
      'faces na mesma aresta é geometria não-manifold — ruim para subdivisão e engines.'
    );
  }
  if (issue.id.includes('normal.flipped')) {
    return (
      'Normais invertidas fazem a face “olhar para dentro”. Isso afeta shading, ' +
      'baking e a direção do inset/extrude. Corrija o winding da face.'
    );
  }
  if (issue.id.includes('pole.e')) {
    return (
      'Polo E (valência 3) concentra curvatura. Em cantos de caixa é esperado; ' +
      'no meio de uma superfície suave, redirecione o fluxo com loops.'
    );
  }
  if (issue.id.includes('pole.n')) {
    return (
      'Polo N (valência 5) espalha curvatura. Útil para mudar direção de loops, ' +
      'mas evite na silhueta do personagem onde a subdivisão deve ficar limpa.'
    );
  }
  if (issue.id.includes('pole.high') || issue.id.includes('pinch')) {
    return (
      'Valência alta puxa a malha no Catmull-Clark (pinçamento). Redistribua ' +
      'os loops até a valência voltar a 3–5.'
    );
  }
  if (issue.id.includes('loop.break')) {
    return (
      'Edge loops só atravessam faixas de quads. Um tri/n-gon no caminho ' +
      'mata o loop — por isso Ctrl+R “para” ali.'
    );
  }
  if (issue.id.includes('loop.spacing')) {
    return (
      'Loops muito apertados num lado e largos no outro geram densidade desigual ' +
      'depois da subdivisão. Equalize o espaçamento.'
    );
  }
  if (issue.id.includes('density')) {
    return (
      'Faces minúsculas ao lado de faces enormes fazem o subdivisor concentrar ' +
      'detalhe onde você não quer. Busque tamanho de face parecido na região.'
    );
  }
  return `${issue.explanation} ${issue.suggestion}`;
}
