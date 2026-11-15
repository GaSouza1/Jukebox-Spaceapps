# Earth Information Jukebox — Auditoria técnica de acessibilidade (cruzamento com `eval.csv`)

**Data:** 15/11/2026 · **Página avaliada pelo CSV:** `http://localhost:8443/explore` · **Código analisado:** branch `dev`, commit `343e4d5` mais o working tree de 15/11/2026 · **Referência:** WCAG 2.2, níveis A e AA (AAA tratado como recomendação)

Este relatório cruza as 41 ocorrências do relatório automatizado `eval.csv` com o código-fonte e com a página renderizada. Ele complementa, sem substituir, [`docs/accessibility-audit.md`](accessibility-audit.md), [`docs/PENDENCIAS.md`](PENDENCIAS.md) e [`docs/AUDITORIA_COMPARACAO.md`](AUDITORIA_COMPARACAO.md). **Nenhuma correção foi implementada.**

**Convenções:**

- **Confirmado (execução):** reproduzido no navegador durante esta auditoria.
- **Confirmado (código):** comprovado lendo o código, com arquivo e linha.
- **Provável:** indícios fortes; precisa de teste manual.
- **Falso positivo / sem problema:** o alerta não corresponde a uma falha de acessibilidade.
- **Não localizado:** não foi possível encontrar o elemento ou o comportamento descrito.
- **Sucesso consistente:** o CSV relata sucesso e a inspeção não contradiz.

> **Atenção: código em mudança.** Outra frente de trabalho alterou arquivos da sonificação de imagem durante a auditoria. As linhas de `ImageAnalyzer.tsx` são citadas no commit `343e4d5`, com a linha equivalente do working tree entre parênteses quando ela mudou. Os demais arquivos citados não tinham mudanças locais.

---

## 1. Resumo executivo

**Ocorrências analisadas:** 41 linhas do CSV (29 "Sucesso", 7 "Aviso", 5 "Erro").

| Diagnóstico | Quantidade | IDs do CSV |
| --- | --- | --- |
| Confirmado e reproduzível | 2 | `label_02`, `textC_02` (este é AAA) |
| Provável, depende de validação manual | 1 | `input_02b` (sucesso inconclusivo: 0 controles avaliados) |
| Falso positivo ou alerta sem problema | 8 | `a_01a`, `a_02b`, `color_01`, `hx_01b`, `img_02`, `lang_01`, `layout_01b`, `list_05` |
| Não localizado | 2 | `color_02`, `focus_01` |
| Sucesso consistente com a inspeção | 28 | Demais IDs (ver [matriz](#3-matriz-de-cruzamento)) |

**O CSV não mostra os problemas mais graves.** A inspeção funcional encontrou cinco achados novos (prefixo **NA-**), nenhum deles detectável pela ferramenta:

| ID | Problema | Diagnóstico | Prioridade |
| --- | --- | --- | --- |
| NA-01 | Sem WebGL2, a página `/explore` inteira é substituída por uma tela de erro: gráfico, tabela, resumo e players somem junto com o mapa | Confirmado (execução) | P0 |
| NA-02 | O foco vai para `<body>` ao acionar **Stop** da sonificação de imagem (e, pelo mesmo mecanismo, Anterior e Próximo) | Confirmado (execução) | P1 |
| NA-03 | Narração própria com `speechSynthesis`, **ligada por padrão**, e detecção de idioma da página. Isso contraria a decisão Screen Reader First informada para esta auditoria e dois documentos do projeto | Confirmado (código); a sobreposição de vozes depende de teste manual | P1 (com decisão do time) |
| NA-04 | Play da sonificação de imagem desabilitado (fora da ordem de Tab) sem motivo associado | Confirmado (código) | P2 |
| NA-05 | Bordas de campos e menus com contraste de 1,7:1 a 1,9:1 contra o fundo (critério 1.4.11 exige 3:1 quando a borda identifica o controle) | Provável | P2 |

**Principais riscos para as pessoas usuárias:**

1. **Perda total da comparação** em computadores sem WebGL2 (aceleração gráfica desligada, máquinas virtuais, alguns ambientes remotos ou corporativos). Tabela e texto, que são as alternativas acessíveis, desaparecem por causa de um mapa decorativo (NA-01).
2. **Desorientação de quem usa teclado ou leitor de tela** ao parar a sonificação de imagem: o foco volta ao início do documento (NA-02).
3. **Duas vozes ao mesmo tempo** para quem usa leitor de tela: o anúncio "Playing image 1 of…" da região `role="status"` e a narração do navegador começam juntos (NA-03).
4. **Texto pequeno com contraste no limite:** cerca de 150 textos visíveis entre 7,4 px e 10,9 px, vários a 4,63:1. Cumprem o AA, mas são difíceis de ler para pessoas com baixa visão (`textC_02`, seção 4.9).

## 2. Metodologia

### 2.1 Arquivos analisados

| Grupo | Arquivos |
| --- | --- |
| Rotas e layout | `src/app/routes.tsx`, `src/app/routes/ExplorePage.tsx`, `src/components/layout/RootLayout.tsx`, `src/components/layout/AppHeader.tsx`, `src/components/StableText.tsx`, `index.html`, `.figma/make/site.json` |
| Comparação | `src/features/comparison/components/ComparisonControls.tsx`, `RegionSelector.tsx`, `ScientificExplanation.tsx` |
| Visualização | `src/features/visualization/charts/ComparisonChart.tsx`, `src/features/visualization/map/EarthMap.tsx` |
| Sonificação | `src/features/sonification/components/SonificationPlayer.tsx`, `ImageAnalyzer.tsx` (commit `343e4d5` e working tree), `ImageCollectionList.tsx`, `engine/narrationLanguage.ts`, `engine/narrationLayer.ts`, `engine/sequencePlayer.ts` |
| Guia | `src/features/guided-experience/components/ScreenReaderGuide.tsx`, `GuidedStep.tsx`, `hooks/useGuidedExperience.ts`, `i18n/en.ts`, `README.md` |
| Estilos | `src/index.css` |
| Documentação | `README.md`, `docs/accessibility-audit.md`, `docs/relatorio-implementacao.md`, `docs/PENDENCIAS.md`, `docs/AUDITORIA_COMPARACAO.md`, `src/features/sonification/SONIFICATION.md` |

### 2.2 Rotas e componentes inspecionados

Só a rota `/explore`, a mesma do CSV. Componentes: `AppHeader`, `ScreenReaderGuide`, `ImageSonification` (com `ImageCollectionList`), `ComparisonControls`/`RegionSelector`, `EarthMap`, `ComparisonChart`, `SonificationPlayer`, `ScientificExplanation`, `AppFooter`.

### 2.3 Como foi feito

1. **Leitura do código** dos componentes acima e da documentação de acessibilidade.
2. **Página renderizada:** servidor Vite local em outra porta (8555), sem alterar arquivos do projeto, e Chrome 150 sem interface (headless):
   - DOM final capturado e analisado para localizar os elementos de cada ocorrência (imagens, `label`, `dt`/`dd`, elementos de apresentação, títulos, atributos `on*` e `tabindex`).
   - **Contraste medido no navegador:** cor e fundo efetivos de cada texto (com composição de transparência pelos ancestrais), tamanho e peso da fonte, proporção pelo método da WCAG. Foram medidos 1.355 elementos de texto, 1.185 deles visíveis, com todos os `<details>` abertos.
   - **Ouvintes de eventos** `focus`, `focusin`, `blur` e `focusout` listados com o DevTools Protocol (`getEventListeners`).
   - **Reprodução de foco:** foco programático nos botões e tecla Enter enviada pelo DevTools Protocol, com leitura de `document.activeElement` depois de cada ação.
3. **Cruzamento:** a contagem de elementos no DOM renderizado coincide com a do CSV (2 imagens, 1 com `alt=""`, 12 títulos, 16 `dt`/`dd`, 2 `<b>`, 1 `label` oculto). Isso indica que o CSV avaliou essencialmente o mesmo código.

### 2.4 Critérios

WCAG 2.2 A e AA como requisito; AAA como recomendação (P3). WAI-ARIA 1.2 e HTML Living Standard para semântica. Decisões do projeto registradas em `src/features/guided-experience/README.md` e as informadas para esta auditoria (Screen Reader First, sem `speechSynthesis`, sem reprodução automática, conteúdo acessível no DOM, `aria-describedby`/`aria-labelledby` para instruções, `role="status"`/`role="alert"` com parcimônia).

### 2.5 Limitações

- **Nenhum teste com VoiceOver, NVDA, TalkBack ou leitor real.** O que depende deles está na [seção 5](#5-testes-manuais-necessários).
- **Ambiente headless:** sem saída de áudio real, sem síntese de fala audível e com WebGL por software. O comportamento sonoro e de fala foi inferido do código.
- **Estado único da página:** contraste medido no estado inicial (tema padrão, com detalhes abertos). Modo de alto contraste, estados de reprodução e foco não foram medidos.
- **Sem acesso à ferramenta que gerou o CSV.** Os IDs (`focus_01`, `color_02` etc.) foram interpretados pela descrição. Sem o realce de elemento da ferramenta, `color_02` e `focus_01` não puderam ser localizados com certeza.
- **Horário do CSV** (`2026-11-15 14:32:10`) sem fuso. O código pode ter mudado entre a avaliação e esta auditoria. A coincidência de contagens (item 2.3) reduz, mas não elimina, esse risco.
- Executar o Vite localmente reescreveu o cache de dependências em `node_modules/.vite`. Nenhum arquivo versionado foi alterado.

## 3. Matriz de cruzamento

Prioridade: P0 a P3 conforme a [seção 6](#6-plano-de-correção); "—" quando não há problema.

| ID original | Critério WCAG | Descrição do CSV (resumida) | Localização no código | Diagnóstico | Impacto | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| `a_01a` | 2.4.1 (A) | Primeiro link salta para o conteúdo principal | `AppHeader.tsx:16-18`; destino `RootLayout.tsx:43` (`<main id="main-content" tabIndex={-1}>`); estilo `index.css:80` | Falso positivo / sem problema (aviso informativo) | Nenhum | — |
| `a_02b` | 2.4.1 (A) | 1 link para contornar blocos | Mesmo link acima | Falso positivo / sem problema | Nenhum | — |
| `a_10` | 4.1.2 (A) | Todas as ligações têm nome (5) | Links do cabeçalho (`AppHeader.tsx:16-35`) | Sucesso consistente | — | — |
| `aria_03` | 1.3.1, 4.1.2 (A) | Valores ARIA válidos (53) | Vários | Sucesso consistente (não reavaliado um a um) | — | — |
| `aria_05` | 1.3.1, 4.1.2 (A) | Atributos ARIA permitidos (53) | Vários | Sucesso consistente (não reavaliado um a um) | — | — |
| `aria_07` | 1.3.1, 4.1.2 (A) | `aria-*` conforme a especificação (82) | Vários | Sucesso consistente (não reavaliado um a um) | — | — |
| `button_01` | 4.1.2 (A) | Todos os botões têm nome (18) | Botões com ícone usam texto `.sr-only` (ex.: `SonificationPlayer.tsx:211-229`) ou `aria-label` (`ImageCollectionList.tsx:133, 143, 156`) | Sucesso consistente | — | — |
| `color_01` | 1.4.3, 1.4.6, 1.4.8 | 1.025 regras CSS sem cor de texto ou de fundo | `src/index.css` (e estilos do MapLibre) | Falso positivo: a contagem é de regras CSS, não de problemas. A cor herdada é verificada no contraste medido | Nenhum comprovado | — |
| `color_02` | 1.4.3 (AA) | 1 combinação abaixo de 4,5:1 (ou 3:1) | **Não localizado.** Nenhum texto visível e ativo ficou abaixo do mínimo AA. Candidatos: botões desabilitados (2,5–2,6:1, isentos pelo 1.4.3) e `<option>` com cor clara e fundo transparente (seção 4.1) | Não localizado | A verificar | P2 (investigação) |
| `element_02` | 4.1.2 (A) | Nenhum `aria-hidden` com conteúdo focável (37) | Ex.: gráfico em `ComparisonChart.tsx:87` | Sucesso consistente | — | — |
| `element_04` | 4.1.2 (A) | Decorativos não expostos | — | Sucesso consistente | — | — |
| `element_08` | 4.1.2 (A) | Papéis com filhos decorativos sem focáveis (26) | — | Sucesso consistente | — | — |
| `element_10` | 1.3.1, 4.1.2 (A) | Papéis explícitos com estados obrigatórios (8) | — | Sucesso consistente | — | — |
| `focus_01` | 2.1.1, 2.4.7, 3.2.1 (A/AA) | JavaScript remove o foco quando o campo recebe foco | **Não localizado.** Não há `blur()` nem `onFocus`/`onBlur` em `src/`, e nenhum ouvinte de `focus` chama `blur`. Problema **relacionado e confirmado**: NA-02 (o foco é perdido ao desabilitar o botão acionado) | Não localizado | Ver NA-02 | P1 (via NA-02) |
| `heading_01` | 1.3.1 (A) | Títulos com nome (12) | — | Sucesso consistente | — | — |
| `heading_03` | 1.3.1 (A) | Exatamente um `h1` | `ExplorePage.tsx:41-45` | Sucesso consistente | — | — |
| `hx_01b` | 1.3.1, 2.4.10 (AAA) | 12 títulos na página | Hierarquia h1 → h2 → h3 verificada (seção 4.8) | Falso positivo / sem problema (aviso informativo) | Nenhum | — |
| `id_01` | 4.1.1 | Sem `id` repetido (40) | IDs gerados com `useId` (`RegionSelector.tsx:22`) | Sucesso consistente. O 4.1.1 é obsoleto na WCAG 2.2 | — | — |
| `img_01a` | 1.1.1 (A) | Imagens com alternativa (2) | `ImageAnalyzer.tsx:315-319` e `ImageCollectionList.tsx:113` | Sucesso consistente | — | — |
| `img_02` | 1.1.1 (A) | 1 imagem com `alt=""` | `ImageCollectionList.tsx:113`: miniatura dentro de um botão cujo nome vem do texto ao lado (`:118-122`) | Falso positivo: imagem decorativa; `alt=""` está correto | Nenhum | — |
| `input_02b` | 1.1.1, 1.3.1, 3.3.2, 4.1.2 (A) | Controles com nome (**0** ocorrências) | A página tem pelo menos 14 `select`/`input` (DOM renderizado) | **Provável, depende de validação:** sucesso com 0 elementos avaliados é inconclusivo | Desconhecido | P3 (verificação) |
| `label_01` | 2.5.3 (A) | Nome acessível contém o texto visível (4) | — | Sucesso consistente | — | — |
| `label_02` | 1.3.1, 3.3.2 (A) | 1 `label` invisível | `SonificationPlayer.tsx:196-198`: `<label htmlFor="playback-position" className="sr-only">Playback position</label>` para o slider visível `:199-208` | **Confirmado (código e DOM)** | Slider visível sem rótulo visível; atrapalha comando de voz e compreensão | P2 |
| `landmark_01` a `landmark_13` (7 linhas) | 1.3.1, 2.4.1 | `banner`, `complementary`, `contentinfo`, `main` únicos e não aninhados | `AppHeader.tsx:15`, `ScreenReaderGuide` (`aside`), `RootLayout.tsx:43`, `AppFooter.tsx` | Sucesso consistente | — | — |
| `lang_01` | 3.1.1 (A) | Idioma principal marcado como `en` | `index.html:2` (`lang="<!-- figma:lang -->"`) preenchido por `.figma/make/site.json:3` (`"language": "en"`) | Falso positivo / sem problema: o conteúdo está em inglês. Ver seção 4.7 sobre tradução e narração | Nenhum no `lang`; risco na narração (NA-03) | — |
| `layout_01b` | 1.3.1 (A) | 2 elementos obsoletos de apresentação | **Correspondência provável:** os 2 `<b aria-hidden="true">` em `EarthMap.tsx:106, 110`. Não há `font`, `center`, `big`, `u`, `s`, `tt` nem `strike` no DOM | Alerta sem problema comprovado: `<b>` não é obsoleto no HTML atual e está oculto da árvore de acessibilidade | Nenhum para leitores de tela | P3 |
| `list_02` | 1.3.1 | Listas só com itens (6) | — | Sucesso consistente | — | — |
| `list_05` | 3.1.3 (AAA) | 16 `dt`/`dd` fora de lista | `ImageAnalyzer.tsx:604-651` (working tree `:615`): `<dl className="step-readout">` com cada par dentro de `<div>` | Falso positivo: o HTML permite `div` agrupando `dt`/`dd` dentro de `dl`. O próprio CSV aprova essa `dl` em `list_06` | Nenhum comprovado (confirmar leitura em VoiceOver) | — |
| `list_06` | 3.1.3 (AAA) | Lista de descrição corretamente ordenada (1) | Mesma `dl` | Sucesso consistente | — | — |
| `listitem_01` | 1.3.1 | `li` dentro de lista (20) | — | Sucesso consistente | — | — |
| `role_01` | 1.3.4 | `role` válidos (8) | Ex.: `EarthMap.tsx:18`, `ComparisonControls.tsx:53` | Sucesso consistente | — | — |
| `scrollable_01` | 2.1.1 (A) | Área rolável operável por teclado (1) | `ComparisonChart.tsx:157-162` (`tabIndex={0}`, `role="region"`) | Sucesso consistente | — | — |
| `table_07` | 1.3.1 (A) | Cabeçalhos com células (59) | Tabelas de `ComparisonChart.tsx:163-185` e de mapeamentos em `ImageAnalyzer.tsx` | Sucesso consistente | — | — |
| `textC_02` | 1.4.6 (AAA) | 75 combinações abaixo de 7:1 (ou 4,5:1) | Medido: **86 textos visíveis**, 20 combinações de cor, mínimo **4,63:1** (`#728195` sobre `#0a1522`) | **Confirmado (execução), nível AAA** | Leitura cansativa para baixa visão, agravada pelo tamanho (seção 4.9) | P3 |
| `title_06` | 2.4.2 (A) | Título "Explore · Earth Information Jukebox" | `RootLayout.tsx:8-12, 23` | Sucesso consistente | — | — |

## 4. Detalhamento técnico

### 4.1 `color_02` — combinação de cor abaixo do mínimo (não localizado)

- **Evidência:** em 1.185 textos visíveis medidos, **nenhum** texto ativo ficou abaixo de 4,5:1 (ou 3:1 para texto grande). O menor valor foi 4,63:1 (`#728195` sobre `#0a1522`, 9,28 px), em `dl.step-readout dt`, rótulos da tabela de mapeamentos e `.timeline-readout span`.
- **Candidatos encontrados:**

  | Candidato | Onde | Proporção | Situação perante a WCAG |
  | --- | --- | --- | --- |
  | Botões Stop, Anterior e Próximo desabilitados (`opacity: 0.4`) | `index.css:1504-1505`; `ImageAnalyzer.tsx:427-474` | 2,62:1 | Isento: o 1.4.3 não se aplica a componentes inativos |
  | Setas desabilitadas da coleção (`opacity: 0.35`) | `index.css:1450-1451`; `ImageCollectionList.tsx:130-149` | 2,53:1 | Isento |
  | `<option>` com `color: #e3ebf4` e fundo transparente | `index.css:703-708, 1337-1342` (cor definida no `select`, herdada pelas opções) | 1,2:1 se o sistema pintar a lista com fundo branco | **A verificar:** no macOS a lista é nativa e usa as cores do sistema; no Windows o Chrome pode aplicar as cores do `select` |

- **Comportamento esperado:** nenhum texto ativo abaixo de 4,5:1 (normal) ou 3:1 (grande), em qualquer plataforma.
- **Recomendação:** antes de qualquer correção, abrir o relatório na ferramenta e usar o realce do elemento para identificar a combinação exata. Se forem as opções, definir `background-color` e `color` explícitos em `option`. Se forem os botões desabilitados, nenhuma correção é exigida pela WCAG, mas vale manter o estado legível (ver NA-04).
- **Validação:** reexecutar a ferramenta; conferir a lista aberta de cada `select` no Windows e no macOS.

### 4.2 `focus_01` — remoção de foco por JavaScript (não localizado) e NA-02 (perda de foco confirmada)

**O que o CSV descreve não foi encontrado:**

- `grep` em `src/`: nenhum `.blur()`, `onFocus` ou `onBlur`.
- Ouvintes listados no navegador: só os ouvintes delegados do React (`#root`, Recharts) e um `blur` em `window` do MapLibre, que para a animação do mapa quando a janela perde o foco (não remove foco de nenhum elemento).
- O foco programático existente **move** o foco de propósito e está documentado: título da nova página após navegação (`RootLayout.tsx:28-32`), título da etapa do guia (`GuidedStep.tsx:21`), retorno ao botão do guia (`useGuidedExperience.ts:29`), restauração após reordenar a coleção (`ImageCollectionList.tsx:46-57`).

**NA-02 — o foco é perdido ao acionar Stop (Confirmado, execução):**

- **Evidência:**

  ```tsx
  // ImageAnalyzer.tsx:427 (working tree :438)
  <button type="button" className="stop-button" onClick={stop} disabled={status === "idle"}>
  ```

  Ao parar, `status` vira `"idle"` e o botão que tem o foco é desabilitado. O navegador tira o foco de elementos desabilitados.
- **Reprodução (executada):**
  1. Abrir `/explore`.
  2. Na seção "Listen to an image", focar Play e pressionar Enter. Status: PLAYING; o foco fica no botão, agora "Pause".
  3. Tab até "Stop the image sonification and return to the start" e pressionar Enter.
  4. Resultado medido: `document.activeElement` = `BODY`.
  5. Mesmo teste no Stop da comparação (`SonificationPlayer.tsx:211`): o foco permanece no botão, porque ele nunca é desabilitado.
- **Mesmo mecanismo, confirmado só no código:**
  - Anterior e Próximo: `disabled={status === "idle" || !previousId}` (`:435`; working tree `:446`) e `:469` (`:480`). Perdem o foco ao chegar à primeira ou à última imagem, ou quando a sequência termina sozinha.
  - Play: `disabled={status === "loading" || …}` (`:445-449`; working tree `:456`). Pode perder o foco durante o carregamento das amostras no primeiro uso. **A verificar:** no teste headless o carregamento foi instantâneo.
- **Impacto:** quem usa teclado ou leitor de tela perde a posição; a próxima tecla Tab recomeça do topo da página (skip link). O leitor de tela pode não anunciar nada ou anunciar o documento. Falha de **2.4.3 Ordem do foco (A)** e prejuízo à previsibilidade.
- **Comportamento esperado:** o foco permanece em um controle relevante, por exemplo o próprio Stop (inativo, mas focável) ou o Play.
- **Correção recomendada:** não usar o atributo `disabled` em controles que podem estar focados no momento em que ficam inativos. Usar `aria-disabled="true"` e ignorar o clique enquanto inativo, mantendo o elemento na ordem de Tab. Como alternativa, mover o foco para o Play antes de desabilitar. Aplicar o mesmo padrão a Anterior, Próximo e Play.
- **Validação:** repetir a reprodução com teclado, VoiceOver e NVDA; `document.activeElement` deve continuar no botão (ou no Play) e o leitor deve anunciar o estado novo uma única vez.

### 4.3 `label_02` — rótulo invisível do slider de posição (Confirmado)

- **Evidência:**

  ```tsx
  // SonificationPlayer.tsx:196-208
  <label htmlFor="playback-position" className="sr-only">Playback position</label>
  <input id="playback-position" className="progress-range" aria-valuetext={valueText(currentIndex)} type="range" … />
  ```

- **Associação:** correta (`for`/`id`). O nome acessível existe ("Playback position") e o `aria-valuetext` informa mês e valores.
- **Comportamento atual:** o slider é visível, mas o rótulo não. Visualmente, o contexto é a leitura de data acima dele (`:191-194`).
- **Impacto:** pequeno para leitores de tela. Maior para quem usa comando de voz (precisa adivinhar "Playback position") e para quem tem dificuldade cognitiva. O 3.3.2 pede rótulos ou instruções para controles de entrada.
- **Correção recomendada:** tornar o rótulo visível (pode ser discreto, junto à linha do tempo) ou associar um texto visível já existente via `aria-labelledby`, mantendo o nome atual.
- **Validação:** o rótulo aparece na tela; um teste de comando de voz ("clicar em Playback position") ativa o slider; a ferramenta deixa de apontar `label_02`.

### 4.4 `layout_01b` — elementos de apresentação (alerta sem problema comprovado)

- **Evidência:** `EarthMap.tsx:106` e `:110`: `<b aria-hidden="true">A</b>` e `<b aria-hidden="true">B</b>` na legenda do mapa. São os únicos elementos do DOM com 2 ocorrências entre os candidatos a elemento de apresentação.
- **Finalidade:** letra visual da região, repetindo o marcador do mapa. O texto acessível vem logo depois ("Region A: Manaus…").
- **Avaliação:** `<b>` é válido no HTML atual e está fora da árvore de acessibilidade. Não há perda de informação.
- **Recomendação (P3):** trocar por `<span>` com classe, para eliminar o alerta sem mudar nada visualmente.
- **Validação:** ferramenta sem `layout_01b`; aparência da legenda inalterada.

### 4.5 `list_05` — `dt`/`dd` "fora de lista" (falso positivo)

- **Evidência:** `ImageAnalyzer.tsx:604-651` (working tree `:615`): uma `dl` com 8 pares `dt`/`dd`, cada um dentro de uma `<div>`. Os 16 elementos coincidem com o CSV.
- **Finalidade:** leitura de pares nome–valor (brilho → frequência etc.) da fatia atual. A `dl` é a semântica adequada.
- **Avaliação:** o HTML Living Standard permite `div` como agrupador de `dt`/`dd` dentro de `dl`. A própria ferramenta aprova essa lista em `list_06`. O comentário em `:603` explica por que não é região viva (atualiza várias vezes por segundo), o que é correto.
- **Recomendação:** nenhuma mudança de marcação. Confirmar em VoiceOver e NVDA que a lista é anunciada como lista de descrição com 8 itens (teste T-06).

### 4.6 `img_02` — imagem com `alt=""` (falso positivo)

- **Evidência:** `ImageCollectionList.tsx:106-128`. A miniatura (`<img src={image.src} alt="" />`, `:113`) fica dentro de um botão cujo nome vem do texto "Image 1 of 1: Demo image: global false-colour map" (`:118-122`).
- **Avaliação:** decorativa. A mesma imagem é exibida em tamanho grande com `alt` próprio e descrição (`ImageAnalyzer.tsx:315-342`). Um `alt` preenchido duplicaria o nome do botão.
- **Recomendação:** manter.

### 4.7 `lang_01` — idioma e tradução automática

- **`lang`:** `index.html:2` recebe `en` do `.figma/make/site.json:3`. Correto, porque todo o conteúdo está em inglês.
- **Estratégia de tradução (Confirmado, código):**
  - `StableText` (`src/components/StableText.tsx:18-24`) recria o elemento quando o texto muda, para não deixar texto traduzido desatualizado.
  - `translate="no"` em nome do produto (`AppHeader.tsx:26`), nomes de vozes (`ImageAnalyzer.tsx:571`), notação de acordes e fórmulas.
  - Essas escolhas respeitam a tradução nativa do navegador.
- **Ponto de atenção (NA-03):** `engine/narrationLanguage.ts:1-21` determina o idioma de cada frase da narração a partir do texto traduzido na página, do `lang` alterado pelo Chrome, da API `LanguageDetector` do Chrome ou do idioma do navegador. É uma **detecção de idioma**, o que contraria a restrição informada para esta auditoria. Ela não altera a tradução da página em si; afeta só a voz da narração.

### 4.8 `hx_01b` — títulos (aviso informativo)

Hierarquia no DOM renderizado: `h1` "Environmental signals, side by side." → `h2` "Listen to an image" → `h3` "Image collection" → `h2` "Choose two places to compare" → `h2` "A planetary view" → `h2` "Monthly temperature history" → `h2` "Listen to the data" → `h2` "Understanding the sound" → 4 × `h3`. Sem saltos de nível. Sem problema.

**Observação de ordem de leitura (não é falha):** a sonificação de imagem é a primeira seção da página de comparação, antes da escolha das regiões (`ExplorePage.tsx`). A dica para leitores de tela anuncia essa ordem (`i18n/en.ts:84-85`). O risco de interpretação já está registrado em `AUDITORIA_COMPARACAO.md` (AC-20).

### 4.9 `textC_02` — contraste AAA e tamanho de texto (Confirmado, AAA)

- **Medição:** 86 textos visíveis abaixo do contraste AAA, em 20 combinações. As mais frequentes:

  | Cor / fundo | Proporção | Ocorrências | Exemplos |
  | --- | --- | --- | --- |
  | `#728195` / `#0a1522` | 4,63:1 | 27 | `dl.step-readout dt`, cabeçalhos da tabela de mapeamentos, "Loop off", "2005 — 2024" |
  | `#8f9db0` / `#0a1522` | 6,66:1 | 18 | Rótulos "Speed", "Volume", "Layers", "Reading direction" |
  | `#8492a6` / `#07101b` | 6,04:1 | 7 | "Monthly aggregates · 2005–2024", "From", "To", "VS" |

- **Tamanho (achado complementar, não é falha A/AA):**

  | Tamanho calculado | Onde | Evidência |
  | --- | --- | --- |
  | 7,4 px | "NASA GIBS layer integration planned" | `.map-overlay small`, `EarthMap.tsx:97` |
  | 8 px | Identidade sonora de cada região ("solid blue line · soft sine tone, left channel") | `index.css:627-629` (`.region-selector p span { font-size: 0.5rem }`), `RegionSelector.tsx:46-48` |
  | 9–10,9 px | Cerca de 140 textos, entre eles rótulos de controles, legenda, unidades e status | Diversos seletores em `index.css` (ex.: `:624`, `:700`, `:871`, `:1412`, `:1526`) |

- **Impacto:** a informação de identidade sonora, essencial para entender a comparação, está no menor texto da página. Para baixa visão, tamanho pequeno somado a contraste no limite é a combinação mais difícil.
- **Recomendação (P3, com a identidade sonora em P2):** tamanho mínimo de 12 px para texto informativo, e de 14 px para a identidade sonora. Aumentar a luminosidade de `#728195` para atingir 7:1 nos textos que carregam informação.
- **Validação:** nova medição; zoom de 200 % sem perda (teste T-08).

### 4.10 NA-01 — falha total da página sem WebGL2 (Confirmado, execução)

- **Evidência:**
  - Primeira captura, em Chrome headless sem GPU: o `#root` contém apenas "Unexpected Application Error!" e "GPUInitializationError: WebGL2 is required to display this map", com a pilha apontando para `EarthMap.tsx:26` (código transformado).
  - Origem: `new maplibregl.Map({...})` em `EarthMap.tsx:29`, dentro de `useEffect`, sem `try/catch`.
  - Não há `errorElement` nas rotas (`src/app/routes.tsx:7-17`) nem componente de limite de erro em `src/`.
- **Reprodução:** abrir `/explore` em um navegador com WebGL2 indisponível (aceleração de hardware desligada ou Chrome headless sem `--use-angle=swiftshader`).
- **Impacto:** **o mapa é contexto visual e tem alternativa em texto**, mas a falha dele derruba gráfico, resumo, tabela, controles e os dois players. Atinge justamente quem depende das alternativas textuais e pode usar equipamentos ou ambientes sem aceleração gráfica. **A verificar:** a frequência real desse cenário entre o público.
- **Comportamento esperado:** sem WebGL2, o mapa é substituído por uma mensagem curta e a lista de regiões (`EarthMap.tsx:103-113` já tem esse texto). O resto da página funciona.
- **Correção recomendada:** criar o mapa dentro de `try/catch` (ou checar suporte a WebGL2 antes) e, em caso de falha, renderizar só a legenda textual com um aviso. Adicionalmente, um limite de erro por seção (ou `errorElement` na rota) para que a falha de um componente não apague a página.
- **Validação:** abrir `/explore` com aceleração de hardware desligada; a tabela, o resumo e os players continuam disponíveis; um leitor de tela encontra a mensagem do mapa.

### 4.11 NA-03 — narração própria e detecção de idioma

- **Evidência (Confirmado, código, commit `343e4d5`):**
  - Camada "Narration" ligada por padrão: `narration: true` (`ImageAnalyzer.tsx:87-91`).
  - Fala com `speechSynthesis`: `engine/narrationLayer.ts` (`SpeechSynthesisUtterance`).
  - Seletor de voz e velocidade da voz: `ImageAnalyzer.tsx:547-576`. No DOM renderizado, o seletor listou as vozes do sistema (ex.: "Alex (en-US)", "Maged (ar-SA)").
  - Detecção de idioma: `engine/narrationLanguage.ts:1-21`.
  - **Sobreposição prevista:** ao apertar Play, o efeito de anúncio grava "Playing image 1 of 1, Demo image…" na região `role="status"` (`ImageAnalyzer.tsx:147-176`, `:599-601`), e a sequência começa pela narração (`sequencePlayer.ts`, fase "narration"). O leitor de tela e a voz do navegador falam ao mesmo tempo. **A confirmar em teste manual** (T-02).
- **Conflito de documentação (Confirmado):**

  | Documento | O que diz |
  | --- | --- |
  | Restrição desta auditoria | "O leitor de tela é o único narrador. Não utilizar SpeechSynthesis, narração própria…" |
  | `src/features/guided-experience/README.md:12` | "A aplicação não tem voz própria (`speechSynthesis`)" |
  | `src/features/guided-experience/README.md:138` | Critério "Sem voz própria" marcado como **Atendido** |
  | `docs/accessibility-audit.md:221` e `:287` | "`speechSynthesis` nunca é chamado" |
  | `README.md` (seção "Narração") e `SONIFICATION.md` | Documentam a narração como recurso da sonificação de imagem, separado do leitor de tela, e restringem a regra de "sem voz própria" ao guia |

  O projeto tem hoje **duas regras incompatíveis registradas**. Essa decisão já aparece como pendente em `AUDITORIA_COMPARACAO.md` (AC-14, D-13).
- **Impacto:** duas vozes simultâneas ou em sequência confusa para pessoas cegas; voz em idioma diferente do leitor de tela quando a página é traduzida; descumprimento de uma regra apresentada como requisito.
- **Correção recomendada (depende de decisão do time):**
  - Se a regra Screen Reader First vale para toda a aplicação: desligar a camada por padrão ou removê-la, retirar a detecção de idioma e manter o roteiro como texto no DOM (o roteiro já é exibido na página).
  - Se a narração for mantida como exceção: deixá-la **desligada por padrão**, com explicação junto ao controle, e atualizar `guided-experience/README.md`, `accessibility-audit.md` e o README de forma coerente.
- **Validação:** em VoiceOver e NVDA, apertar Play sem mudar nada não produz fala além da do leitor de tela; os documentos não se contradizem.

### 4.12 NA-04 — Play desabilitado sem motivo acessível (Confirmado, código)

- **Evidência:** o Play da imagem fica `disabled` quando a análise ainda carrega ou quando todas as camadas estão desligadas (`ImageAnalyzer.tsx:445-449`). O aviso "All layers are off…" existe (`:585-587`), mas não está associado ao botão, e um botão `disabled` sai da ordem de Tab.
- **Impacto:** quem navega por Tab não encontra o Play e não sabe por quê. O PENDENCIAS já pede "Botão Play desabilitado com motivo explicado" para a comparação (A-02); aqui o mesmo princípio falta na sonificação de imagem.
- **Correção recomendada:** `aria-disabled="true"` (mantém o foco) com `aria-describedby` apontando para o motivo.
- **Validação:** com todas as camadas desligadas, Tab chega ao Play; o leitor anuncia "indisponível" e o motivo.

### 4.13 NA-05 — contraste das bordas de controles (Provável)

- **Evidência (cálculo):** borda `#33445a` contra o fundo do `select` `#101d2c` = 1,71:1; contra o fundo da página `#07101b` = 1,92:1. Fundo do `select` contra o painel = 1,08:1. Regras em `index.css:614-620`, `:703-708`, `:1337-1342`.
- **Avaliação:** o 1.4.11 (AA) exige 3:1 para a informação visual necessária para identificar um controle. Os `select` também têm texto e seta, o que pode bastar para identificá-los. Por isso o diagnóstico é provável, não confirmado.
- **Correção recomendada:** bordas com pelo menos 3:1 contra o fundo adjacente (o anel de foco `#8ac8ff`, com 10,3–10,7:1, já cumpre).
- **Validação:** medição das bordas; teste com pessoas com baixa visão (T-08).

### 4.14 Pontos verificados sem problema

- **Skip link e foco visível:** skip link é o primeiro elemento focável e vai para `main` (`AppHeader.tsx:16-18`, `RootLayout.tsx:43`). O `:focus-visible` tem contorno de 2 px `#8ac8ff` (`index.css:37-39`). `outline: none` só em `main` e no `h1`, que recebem foco programático e não são interativos (`index.css:1598-1600`).
- **Descrição antes do áudio:** os dois botões Play têm `aria-describedby` para a descrição completa (`SonificationPlayer.tsx:174-178, 219`; `ImageAnalyzer.tsx:295-299, 450`).
- **Sem reprodução automática:** nada toca sem Play (confirmado no código dos dois players e no guia).
- **Regiões vivas:** uma `role="status"` por componente (`ComparisonControls.tsx:130-132`; `SonificationPlayer.tsx:286-288`; `ImageAnalyzer.tsx:599-601`), `role="alert"` só para erro (`:589-593`). Valores por fatia não são anunciados (`:603`).
- **Gráfico, tabela e mapa:** gráfico oculto da árvore de acessibilidade, com resumo textual e tabela (`ComparisonChart.tsx:86-187`); mapa com legenda textual e coordenadas (`EarthMap.tsx:99-113`). Limitação conhecida: o gráfico não é navegável por teclado (`relatorio-implementacao.md`).
- **Movimento reduzido:** `@media (prefers-reduced-motion: reduce)` em `index.css:1252`; o mapa respeita a preferência (`EarthMap.tsx:9-10, 87`).

## 5. Testes manuais necessários

| ID | Objetivo | Procedimento | Resultado esperado | Tecnologia | Critério de aprovação |
| --- | --- | --- | --- | --- | --- |
| T-01 | Confirmar NA-02 com tecnologia assistiva | Play e depois Stop na sonificação de imagem com Enter e Espaço; repetir com Anterior e Próximo na última imagem e com o fim natural da sequência | O foco permanece em um controle do player; anúncio único do novo estado | Teclado; VoiceOver + Safari; NVDA + Firefox e Chrome | Nenhum caso de foco no `body` ou no topo da página |
| T-02 | Medir a sobreposição de vozes (NA-03) | Play na sonificação de imagem com configurações padrão | Saber se o anúncio do leitor e a narração se sobrepõem, e por quanto tempo | VoiceOver + Safari; NVDA + Chrome | Registro gravado ou anotado para a decisão do time |
| T-03 | Localizar `color_02` e `focus_01` | Abrir o relatório na ferramenta que gerou o CSV e usar o realce do elemento | Elemento exato identificado | Ferramenta de avaliação | Seletor e estado anotados neste relatório |
| T-04 | Cores das listas de opções (candidato a `color_02`) | Abrir cada `select` da página | Texto legível na lista aberta | Chrome e Edge no Windows; Safari e Chrome no macOS | Contraste ≥ 4,5:1 na lista aberta |
| T-05 | Página sem WebGL2 (NA-01) | Desligar a aceleração de hardware do Chrome e abrir `/explore` | Hoje: erro na página inteira. Após correção: só o mapa indisponível | Chrome | Tabela, resumo e players acessíveis |
| T-06 | Leitura da `dl` de valores (`list_05`) | Navegar até "Brightness … Stereo pan" durante e depois da reprodução | Lista de descrição com 8 pares, sem anúncios automáticos | VoiceOver + Safari; NVDA | Pares lidos como termo e valor |
| T-07 | Slider de posição durante a reprodução | Focar "Playback position" e tocar a comparação | Sem anúncio a cada mês (500 ms); o player anuncia só transições | NVDA + Chrome; VoiceOver + Safari | Nenhuma fala repetitiva enquanto o slider está focado. **A verificar:** leitores costumam anunciar mudança de valor de slider focado |
| T-08 | Ampliação e legibilidade | Zoom de 200 % e 400 %; largura de 320 px; ampliador do sistema | Sem corte nem rolagem horizontal; textos de 8 px legíveis após ampliação | Navegador; ZoomText ou ampliador do macOS | 1.4.4 e 1.4.10 atendidos; parecer de pessoa com baixa visão |
| T-09 | Modo de alto contraste próprio | Ativar o botão "High contrast" (`AppHeader.tsx:39-48`) e medir | Contraste ≥ 7:1 nos textos informativos | Navegador + medidor de contraste | Nenhum texto informativo abaixo de 4,5:1; medição registrada |
| T-10 | Cores forçadas do Windows | Ativar um tema de contraste do Windows | Controles, foco e marcadores visíveis | Windows + Edge | Todos os controles identificáveis |
| T-11 | Tradução nativa com conteúdo dinâmico | "Traduzir para português" no Chrome; trocar regiões, variável e período; tocar e parar | Textos atualizados e traduzidos; narração (se mantida) no idioma da página | Chrome; NVDA | Nenhum texto desatualizado; nenhuma voz em idioma diferente sem aviso |
| T-12 | Descoberta do Play desabilitado (NA-04) | Desligar todas as camadas e navegar por Tab | O Play é encontrado e o motivo é anunciado | Teclado; VoiceOver; NVDA | Motivo anunciado ao focar |
| T-13 | Skip link e guia oculto | Tab a partir do topo | "Skip to content" visível ao focar; "Start guided experience" encontrado | Teclado; VoiceOver; NVDA | Os dois visíveis ao receber foco |
| T-14 | Comando de voz | Ditar "clicar em Playback position", "clicar em Stop" | Controles ativados pelo nome | Controle por Voz do macOS ou Dragon | Ativação sem ajuda visual |

Os testes de leitor de tela já pendentes em `docs/accessibility-audit.md` e `docs/relatorio-implementacao.md` continuam válidos e não foram repetidos aqui.

## 6. Plano de correção

| Tarefa | Prioridade | Ref. CSV / achado | Componente | O que fazer | Critério de aceite |
| --- | --- | --- | --- | --- | --- |
| TA-01 | **P0** | NA-01 | `EarthMap.tsx`; `routes.tsx` | Isolar a falha do mapa (verificar WebGL2 ou `try/catch`) e adicionar limite de erro por seção ou `errorElement` | Sem WebGL2, `/explore` mostra tabela, resumo e players; o mapa mostra aviso e lista de regiões (T-05) |
| TA-02 | **P1** | NA-02 (relacionado a `focus_01`) | `ImageAnalyzer.tsx` (Stop, Anterior, Próximo, Play) | Trocar `disabled` por `aria-disabled` com clique ignorado, ou mover o foco antes de desabilitar | `document.activeElement` nunca vira `body` após acionar qualquer controle do player (T-01) |
| TA-03 | **P1** | NA-03 | `ImageAnalyzer.tsx`, `narrationLayer.ts`, `narrationLanguage.ts`, documentação | **Decisão do time** (D-13 em `AUDITORIA_COMPARACAO.md`); depois aplicar: narração desligada por padrão ou removida; detecção de idioma retirada se a regra global for mantida; documentos alinhados | Uma única regra registrada; comportamento padrão sem voz própria se a regra global valer (T-02) |
| TA-04 | P2 | NA-04 | `ImageAnalyzer.tsx` | Play com `aria-disabled` e `aria-describedby` para o motivo | T-12 aprovado |
| TA-05 | P2 | `label_02` | `SonificationPlayer.tsx` | Rótulo visível para o slider de posição | Rótulo visível; T-14 aprovado; ferramenta sem `label_02` |
| TA-06 | P2 | `color_02` | A definir (T-03) | Localizar a combinação e corrigir; se for `<option>`, cores explícitas | Ferramenta sem `color_02`; T-04 aprovado |
| TA-07 | P2 | NA-05 | `index.css` (bordas de `select`, `input`, painéis de região) | Bordas com ≥ 3:1 contra o fundo adjacente | Medição ≥ 3:1 |
| TA-08 | P2 | `textC_02` (parte) | `RegionSelector.tsx`; `index.css:627-629` | Identidade sonora das regiões com pelo menos 14 px | Texto legível sem zoom; T-08 aprovado |
| TA-09 | P3 | `textC_02` | `index.css` (tokens de cor secundária, tamanhos 7–10 px) | Tamanho mínimo de 12 px e contraste ≥ 7:1 para textos informativos | Nova medição sem textos informativos abaixo de 7:1 |
| TA-10 | P3 | `layout_01b` | `EarthMap.tsx:106, 110` | `<b>` → `<span>` com classe | Ferramenta sem `layout_01b`; aparência igual |
| TA-11 | P3 | `input_02b` | — | Confirmar por que a ferramenta avaliou 0 controles (página carregada antes da renderização?) | Nova execução com contagem coerente |
| TA-12 | P3 | Documentação | `guided-experience/README.md:12, 138`; `accessibility-audit.md:221, 287` | Atualizar depois de TA-03 | Nenhuma afirmação contraditória sobre `speechSynthesis` |

**Não precisam de tarefa:** `a_01a`, `a_02b`, `color_01`, `hx_01b`, `img_02`, `lang_01` e `list_05` (falsos positivos ou avisos sem problema), além dos sucessos consistentes.

## 7. Limitações e pendências

- **`color_02` e `focus_01` não foram localizados.** As explicações da seção 4 são candidatos, não conclusões. Dependem de T-03.
- **Nenhum teste com tecnologia assistiva real.** Tudo o que envolve anúncio, sobreposição de vozes, leitura de `dl`, slider e tradução com leitor de tela está na seção 5.
- **NA-01:** a falha foi reproduzida em ambiente headless; a frequência entre o público é desconhecida.
- **NA-02:** confirmado para Stop; Anterior, Próximo e Play foram confirmados só pelo código.
- **NA-03:** a sobreposição de vozes foi deduzida do código; não houve áudio no ambiente de teste.
- **NA-05:** depende de julgamento sobre o que identifica o controle; tratado como provável.
- **Contraste medido só no tema padrão e no estado inicial.** Alto contraste, estados de hover, foco, reprodução e mensagens de erro não foram medidos.
- **Sucessos do CSV não foram reavaliados um a um** (ex.: os 82 atributos `aria-*`). Foram marcados como consistentes porque nada na inspeção os contradiz.
- **O código está mudando:** se a sonificação de imagem for alterada antes das correções, as linhas citadas de `ImageAnalyzer.tsx` precisam ser conferidas de novo.
- **Pendências anteriores continuam abertas:** validação com VoiceOver e NVDA (`accessibility-audit.md`, A-06 do PENDENCIAS) e as pendências A-01 a A-05 relacionadas aos dados.

## 8. Conclusão

**Há informação suficiente para iniciar as correções de TA-01, TA-02, TA-04, TA-05, TA-07, TA-08, TA-09 e TA-10.** Todas têm evidência no código ou no navegador, localização exata e critério de aceite.

**Ainda é preciso investigar ou decidir antes de corrigir:**

- **TA-03 (narração própria):** exige decisão do time, porque o projeto tem duas regras incompatíveis registradas.
- **TA-06 (`color_02`):** exige localizar o elemento na ferramenta.
- **TA-11 (`input_02b`):** exige entender o resultado inconclusivo da ferramenta.

**Ordem sugerida:**

1. TA-01: a falha do mapa derruba todas as alternativas acessíveis.
2. TA-02: a perda de foco afeta todo uso por teclado do player de imagem.
3. Decisão de TA-03.
4. Itens P2.

O CSV, sozinho, levaria a equipe a corrigir `list_05`, `img_02` e `layout_01b`, que não são problemas reais, e deixaria de fora os três achados de maior impacto.
