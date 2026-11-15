# Auditoria de acessibilidade — Earth Information Jukebox

**Data:** 14/11/2026 · **Referência:** WCAG 2.2 nível AA e WAI-ARIA Authoring Practices · **Escopo:** rotas `/`, `/explore` e `/about`, incluindo mapa, gráfico e os dois players de sonificação.

## Resumo

- **Resultado automatizado:** o axe-core 4.x não encontra nenhuma violação nas três rotas, com e sem o modo de alto contraste.
- **Teclado:** o percurso por teclado cobre todos os controles, sem armadilhas de foco.
- **Descrição antes do áudio:** cada player tem uma descrição contextual, gerada a partir dos dados selecionados, ligada ao botão Play por `aria-describedby`.
- **Leitores de tela:** não foram testados com VoiceOver nem NVDA reais (ver [Testes](#testes-executados)). A aprovação para usuários de leitor de tela depende dessa validação manual.

## Requisito crítico: descrição acessível antes do áudio

| Player | Onde está | Como é anunciada |
| --- | --- | --- |
| Comparação de regiões | `#player-description` em `SonificationPlayer.tsx` | Lida ao focar o botão "Play sonification" (`aria-describedby`). Também aparece na leitura linear, logo após o título "Listen to the data". |
| Sonificação de imagem | `#image-sonification-description` em `ImageAnalyzer.tsx` | Lida ao focar "Play image sonification". Também aparece na leitura linear, logo após o aviso de sonificação exploratória. |

Requisitos da descrição:

- **Visibilidade:** usa a classe `.sr-only`, então não ocupa espaço visual. Continua no DOM durante toda a interação, por isso pode ser relida a qualquer momento.
- **Atualização dinâmica:** é recalculada a cada render. Por exemplo, para a comparação Manaus × Londres em precipitação, de 2024 a 2024:

  > "About this sound: a sound representation of the line chart “Monthly precipitation history”. It compares precipitation (mm/month) in Manaus, Brasil (Region A) and London, United Kingdom (Region B), month by month from January 2024 to December 2024: 12 months, about 6 seconds at the current speed. Each month plays one short note per region at the same time. Pitch represents the value… Both regions share the same pitch scale, from the lowest value in this comparison, 27 mm/month, to the highest, 202.4 mm/month… Manaus is a soft sine tone in the left channel; London is a brighter triangle tone in the right channel…"

- **Conteúdo:** identifica a variável e a unidade, as regiões, o período, a quantidade de meses e a duração. Também explica as características sonoras: altura = valor, escala compartilhada, timbre e canal estéreo por região.
- **Sem interpretações inventadas:** a descrição só afirma fatos derivados dos dados, como os valores mínimo e máximo. Ela informa que os dados são sintéticos.
- **Sonificação de imagem:** declara que não há variável científica calibrada (a imagem não tem legenda). Explica brilho → altura, contraste → volume, família de cor → instrumento e posição → estéreo. Informa que a camada cinematográfica não carrega dados.
- **Sem `aria-label` longo:** o botão mantém um nome curto ("Play sonification") e a explicação vai na descrição.

## Problemas encontrados e correções

### Estrutura global e navegação

| # | Problema | WCAG | Correção | Arquivo |
| --- | --- | --- | --- | --- |
| 1 | Todas as páginas tinham o título "Figma Make App". | 2.4.2 | Título único por rota e título do site em `site.json`. | `RootLayout.tsx`, `.figma/make/site.json` |
| 2 | A navegação SPA não informava a mudança de página: o foco ficava no link clicado. | 2.4.3, 4.1.3 | Após a navegação, o foco vai para o `h1` da nova página (`tabIndex=-1`). | `RootLayout.tsx` |
| 3 | O destino do skip link (`main`) não era focável. | 2.4.1 | `tabIndex={-1}` em `main`. Verificado que o foco chega a `#main-content`. | `RootLayout.tsx` |
| 4 | O nome acessível do link da marca não continha o texto visível. | 2.5.3 | `aria-label` removido; o nome passa a ser o texto visível + ", home" (`.sr-only`). | `AppHeader.tsx` |
| 5 | O botão de alto contraste não expunha seu estado. | 4.1.2 | `aria-pressed` controlado por estado. | `AppHeader.tsx` |
| 6 | O alto contraste era só um `filter: contrast(1.16)`, que pouco ajuda textos acinzentados. | 1.4.3 (reforço) | No modo alto contraste, os textos secundários e as bordas de controles ficam quase brancos. | `index.css` |
| 7 | O header sticky podia cobrir o elemento focado ao navegar com Shift+Tab. | 2.4.11 | `scroll-padding-top: 6rem` no `html`. | `index.css` |
| 8 | Sete cores de texto secundário estavam abaixo de 4.5:1 (de 3.24:1 a 4.35:1). O selo "NOT YET CONNECTED" tinha 4.11:1. | 1.4.3 | Substituídas por `#8492a6`, com contraste mínimo de 5.38:1 sobre todos os fundos usados. | `index.css` |
| 9 | Overflow horizontal de 1 px em 320 px de largura (campo de arquivo). | 1.4.10 | Largura do campo limitada ao contêiner. | `index.css` |

### Home e About

| # | Problema | WCAG | Correção | Arquivo |
| --- | --- | --- | --- | --- |
| 10 | A ilustração do planeta tinha `aria-label` em um `div` genérico, que leitores de tela ignoram. | 1.1.1, 4.1.2 | `role="img"` com descrição que a identifica como ilustração decorativa. | `HomePage.tsx` |
| 11 | O índice "On this page" não era um landmark. | 1.3.1 | Virou `<nav aria-labelledby>`. | `AboutPage.tsx`, `index.css` |
| 12 | Links externos abriam em nova aba sem aviso, e as setas "↗" e "→" eram lidas. | 3.2.2 (boa prática G201) | Texto "(opens in a new tab)" em `.sr-only`; setas com `aria-hidden`. | `AboutPage.tsx` |
| 13 | A metodologia descrevia faixas de altura diferentes por região, sem estéreo. | — (precisão) | Texto atualizado para a escala compartilhada e os canais esquerdo/direito. | `AboutPage.tsx`, `ScientificExplanation.tsx` |

### Seleção de regiões, variável e período

| # | Problema | WCAG | Correção | Arquivo |
| --- | --- | --- | --- | --- |
| 14 | As coordenadas não estavam associadas ao `select`, e a identidade da região (cor da linha, timbre) era comunicada só pela cor. | 1.3.1, 1.4.1 | Rótulo visível "Region A/B" ligado ao `select`. `aria-describedby` aponta para as coordenadas (formato "3.12° S, 60.02° W") e para a identidade ("Solid blue line · soft sine tone, left channel"), ambas também visíveis. | `RegionSelector.tsx`, `ComparisonControls.tsx` |
| 15 | O nome do botão de variável era "Temperature°C", sem espaço. | 2.5.3 | Espaço adicionado: "Temperature °C". | `ComparisonControls.tsx` |
| 16 | Escolher um ano inicial maior que o final era ignorado silenciosamente (o `select` voltava ao valor anterior). | 3.2.2, 3.3.2 | O outro limite acompanha a escolha. Por exemplo, From=2020 com To=2010 resulta em 2010–2010, e o resultado é anunciado. | `ComparisonControls.tsx` |
| 17 | Mudar a comparação não gerava nenhuma confirmação. | 4.1.3 | Uma mensagem curta em `role="status"`: "Now comparing Manaus and London, precipitation, 2005 to 2024." | `ComparisonControls.tsx` |

### Mapa

| # | Problema | WCAG | Correção | Arquivo |
| --- | --- | --- | --- | --- |
| 18 | O contêiner `role="img"` escondia elementos focáveis (canvas, marcadores, botões de zoom). Tab chegava a controles sem nome para o leitor de tela. | 4.1.2, 1.3.1 | `role="img"` removido. O mapa virou `<figure>` com `<figcaption>` listando as regiões, países e coordenadas. O canvas recebeu instruções de teclado. | `EarthMap.tsx` |
| 19 | Marcadores eram distinguidos só pela cor e tinham o nome genérico "Map marker". | 1.4.1, 4.1.2 | Marcadores com a letra A/B visível, `role="button"` (Enter/Espaço abre o popup) e nome "Region A: Manaus, Brasil". | `EarthMap.tsx`, `index.css` |
| 20 | A animação de enquadramento ignorava `prefers-reduced-motion`. | 2.3.3 (boa prática) | Duração 0 quando o usuário prefere menos movimento. | `EarthMap.tsx` |

### Gráfico

| # | Problema | WCAG | Correção | Arquivo |
| --- | --- | --- | --- | --- |
| 21 | As duas linhas eram diferenciadas só pela cor. | 1.4.1 | A linha da Região B ficou tracejada, e a legenda diz "solid line" / "dashed line". | `ComparisonChart.tsx`, `index.css` |
| 22 | O bloco de valores atuais tinha `aria-live="polite"` e anunciava a cada mês durante a reprodução (a cada 500 ms). | 4.1.3, 2.2.2 | `aria-live` removido; o player anuncia só mudanças de estado. | `ComparisonChart.tsx` |
| 23 | Não havia alternativa textual: só um parágrafo `.sr-only` com o mês atual. Também não havia tendências nem tabela. | 1.1.1, 1.3.1 | `<figure>` com `<figcaption>` visível contendo média, mínimo e máximo (com mês), variação do primeiro ao último ano e diferença média entre as regiões, tudo calculado dos dados. Também há uma tabela completa em `<details>`, com `caption`, `th scope` e a coluna "Difference (A − B)"; a linha do mês em reprodução fica marcada com `aria-current`. | `ComparisonChart.tsx` |
| 24 | O Recharts 3 tornava o SVG focável dentro de `aria-hidden`. | 4.1.2 | `accessibilityLayer={false}`, porque o resumo e a tabela são as alternativas. | `ComparisonChart.tsx` |
| 25 | A legenda tinha `aria-label` em `div` genérico, o que é proibido. | 4.1.2 | Virou `<ul>` rotulada. | `ComparisonChart.tsx` |

### Player de comparação

| # | Problema | WCAG | Correção | Arquivo |
| --- | --- | --- | --- | --- |
| 26 | Não havia descrição antes do áudio. | 1.1.1, 3.3.2 | Ver a seção [Requisito crítico](#requisito-crítico-descrição-acessível-antes-do-áudio). | `SonificationPlayer.tsx` |
| 27 | Play, pausa, parada e fim não eram anunciados. | 4.1.3 | `role="status"` com mensagens curtas. Desde a atualização de onboarding, elas incluem o modo de reprodução: "Playing both regions together, from January 2024.", "Paused at March 2024.", "Stopped. Position reset to January 2024.", "Finished playing Region A, Manaus, on its own." | `SonificationPlayer.tsx` |
| 28 | O slider de posição era lido como índice ("0", "1"…). | 4.1.2, 1.3.1 | `aria-valuetext` com mês e valores: "January 2005: Manaus 24.5 °C, New York 18.2 °C". Permite consultar os dados pelo teclado. | `SonificationPlayer.tsx` |
| 29 | O volume era lido como "0.65". | 4.1.2 | `aria-valuetext="65%"`; o texto visual duplicado ficou com `aria-hidden`. | `SonificationPlayer.tsx` |
| 30 | Reprodução automática inesperada: o estado `isPlaying` persistia na store ao sair da página, e o áudio voltava sozinho ao retornar. Os sintetizadores também não eram liberados. | 1.4.2, 3.2.1 | Ao desmontar, a reprodução para e os sintetizadores são descartados. Verificado: ao voltar para Explore, o status é "READY". | `SonificationPlayer.tsx` |
| 31 | As regiões só eram distinguíveis pelo timbre (seno × triângulo, diferença sutil). Além disso, cada região usava uma faixa de altura diferente, então valores iguais soavam diferentes. | 1.3.3 (não depender só de uma característica sensorial); precisão científica | Escala de altura única para as duas regiões. Região A no canal esquerdo e Região B no direito, além do timbre. | `SonificationPlayer.tsx` |
| 32 | O menu de velocidade não mostrava 0.5× como selecionado (`value=".5"` ≠ `0.5`). | 4.1.2 | Valor corrigido. | `SonificationPlayer.tsx` |

### Player de sonificação de imagem

| # | Problema | WCAG | Correção | Arquivo |
| --- | --- | --- | --- | --- |
| 33 | Interface em português numa página `lang="en"`, então o leitor de tela pronunciava com a voz errada. | 3.1.2 | Interface traduzida para inglês, coerente com o resto da aplicação. | `ImageAnalyzer.tsx`, `instrumentManager.ts`, `imageAnalyzer.ts` |
| 34 | O texto alternativo ("Imagem utilizada na sonificação") não descrevia a imagem. | 1.1.1 | Descrição real da imagem de demonstração. Imagens enviadas pelo usuário recebem um texto com o nome do arquivo, informando que não há descrição. | `ImageAnalyzer.tsx` |
| 35 | A faixa de dados colorida (brilho por fatia) não tinha alternativa. | 1.1.1, 1.4.1 | "Text profile of the image": 6 trechos com a família de cor dominante (%), o brilho médio e a altura aproximada em Hz, calculados da análise. | `ImageAnalyzer.tsx` |
| 36 | Não havia descrição antes do áudio nem anúncios de estado. | 1.1.1, 4.1.3 | Descrição ligada ao Play. Status com mensagens "Loading sounds…", "Playing…", "Paused at slice 7 of 96.", "Stopped…" e "Playback finished." | `ImageAnalyzer.tsx` |
| 37 | Setas "→" nos rótulos eram lidas; a tabela de mapeamentos não tinha `caption` nem `scope`. | 1.3.1 | Setas com `aria-hidden`; `caption` e `th scope` adicionados. | `ImageAnalyzer.tsx` |

## Critérios WCAG 2.2 cobertos

**Verificados pelos testes automatizados e de teclado desta auditoria:**

- **Perceptível:**
  - 1.1.1 Conteúdo não textual
  - 1.3.1 Informações e relações
  - 1.3.3 Características sensoriais
  - 1.4.1 Uso de cor
  - 1.4.2 Controle de áudio (sem reprodução automática; parada e volume independentes)
  - 1.4.3 Contraste mínimo, para texto sobre fundo sólido
  - 1.4.10 Reflow, em 320 px
- **Operável:**
  - 2.1.1 Teclado
  - 2.1.2 Sem armadilha de teclado
  - 2.4.1 Ignorar blocos
  - 2.4.2 Página com título
  - 2.4.3 Ordem do foco
  - 2.4.6 Cabeçalhos e rótulos
  - 2.4.7 Foco visível
  - 2.4.11 Foco não obscurecido (mínimo)
  - 2.5.3 Rótulo no nome
- **Compreensível:**
  - 3.1.1 Idioma da página
  - 3.1.2 Idioma das partes
  - 3.2.2 Em entrada
  - 3.3.2 Rótulos ou instruções
- **Robusto:**
  - 4.1.2 Nome, função, valor
  - 4.1.3 Mensagens de status

**Dependem de validação manual:**

- 1.4.11 Contraste não textual: bordas de campos e trilhos de sliders sobre fundo escuro.
- 1.4.4 Redimensionar texto até 200 %.
- 1.4.12 Espaçamento de texto.
- 2.5.8 Tamanho do alvo, especialmente o botão de parar (36 px) e os botões de zoom do mapa.

## Testes executados

| Teste | Ambiente | Resultado |
| --- | --- | --- |
| axe-core 4.x (tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice), com todos os `<details>` abertos | Chrome headless, build de produção (`vite preview`) | **0 violações** em `/`, `/explore` e `/about`, também com alto contraste ativo. Na primeira execução eram 2 tipos (`label-content-name-mismatch` e `color-contrast`), depois 1 (`aria-prohibited-attr` no contêiner da tabela); todos foram corrigidos. |
| axe: itens "incomplete" | idem | `color-contrast` (texto sobre o mapa e linhas da tabela dentro do contêiner com rolagem: o axe não determina o fundo) e `label-content-name-mismatch` (botões com ícone `aria-hidden` e `aria-label`). Revisados manualmente no código: a sobreposição do mapa tem fundo de 85 % de opacidade e a tabela usa texto claro sobre fundo escuro. |
| Navegação só por teclado (Tab/Shift+Tab, 70 paradas em `/explore`) | Chrome headless via DevTools Protocol | Todos os controles são alcançáveis em ordem lógica e todos mostram anel de foco. Depois do último controle, o foco sai da página e volta ao skip link: **sem armadilha**. O skip link move o foco para `#main-content`. |
| Árvore de acessibilidade (nomes, descrições, estados) | Chrome DevTools Protocol `Accessibility.getFullAXTree` | Os botões Play expõem a descrição completa. Os sliders expõem `valuetext`, as regiões expõem coordenadas e identidade, e as figuras do mapa e do gráfico expõem resumos. `aria-pressed` funciona nos botões de variável e de alto contraste. |
| Cenários 1–9 do pedido, de forma programática | idem | Seleção de região, troca de variável, alteração e correção do período, Play, Pause, Stop, troca de rota com foco no `h1`, ausência de reprodução automática ao voltar e anúncios dos dois players: **todos com o comportamento esperado**. |
| Reflow em 320 × 800 | idem | Sem rolagem horizontal nas três rotas, após a correção do item 9. |
| `tsc --noEmit` e `vite build` | local | Sem erros. |

**Não executados:**

- **VoiceOver + Safari (macOS):** não foi executado. Este ambiente roda sem interface gráfica interativa e não consegue operar nem ouvir o VoiceOver. **Não declarado como aprovado.**
- **NVDA + Chrome/Firefox (Windows):** ambiente Windows indisponível. **Não declarado como aprovado.**

A árvore de acessibilidade do Chrome mostra o que é exposto aos leitores de tela, mas não substitui o teste com eles: a verbosidade, a ordem dos anúncios e a leitura de `aria-describedby` variam por leitor.

## Validação manual pendente

1. **VoiceOver + Safari e NVDA + Firefox, cenários 1–9.** Confirmar em especial:
   - se a descrição ligada por `aria-describedby` é lida ao focar Play (o NVDA pode ler após uma pausa; o VoiceOver lê após um atraso ou com VO+Shift+H);
   - se as mensagens de status não se sobrepõem ao anúncio de mudança de nome do botão Play/Pause.
2. **Escuta com usuários.** A diferença entre os timbres seno e triângulo e a separação estéreo devem ser avaliadas com fones e com alto-falante mono. Em mono, a separação estéreo desaparece, e as regiões ficam distinguíveis só pelo timbre ou pela escuta sequencial ("Listen to Region A only" / "Region B only", que tocam centralizadas).
3. **Zoom de 200 % e 400 %** em navegador desktop, além do critério 1.4.12 (espaçamento de texto).
4. **Contraste não textual (1.4.11)** das bordas `#33445a` dos campos sobre `#101d2c`. O texto dentro dos campos os identifica, mas usuários com baixa visão devem avaliar.
5. **Tamanho dos alvos (2.5.8)**, principalmente em dispositivos de toque.
6. **Teclado no mapa.** O canvas do MapLibre aceita setas e +/-; verificar se a experiência é útil com leitor de tela. A alternativa funcional (seleção por `select` e lista textual de regiões) já está disponível.

## Limitações conhecidas

- **Navegação por teclado no gráfico:** o gráfico SVG não é navegável por teclado. A consulta dos dados acontece pela tabela, pelo resumo e pelo slider de posição do player, que lê mês e valores.
- **Descrição da imagem enviada:** imagens enviadas pelo usuário não têm descrição automática do conteúdo. A legenda da figura informa isso e que a aplicação não reconhece objetos. O perfil textual ("measured visual features") descreve apenas as características visuais medidas. A descrição da imagem de demonstração é identificada como escrita pela equipe do projeto.
- **Popups do mapa:** os popups dos marcadores repetem a informação da legenda textual e não são anunciados como região viva.
- **Erros no console:** o console mostra "Worker failed to load" do MapLibre no build de pré-visualização. É anterior a esta auditoria e não afeta a acessibilidade da alternativa textual.
- **Dados de demonstração:** os dados são sintéticos (a aplicação informa isso). Quando os dados da NASA forem conectados, os textos gerados continuarão válidos, porque são calculados das séries.

## Atualização — onboarding acessível (guided experience)

> **Substituída** pela [refatoração híbrida](#atualização--onboarding-screen-reader-first-híbrido) abaixo: o painel visual descrito nesta seção foi removido. A escuta sequencial, os anúncios do player e a legenda da imagem continuam valendo.

**Mesma data · escopo:** novo fluxo guiado em `/explore` (entrada também pela Home), reprodução sequencial por região e separação entre descrições humanas e características calculadas da imagem. Detalhes de arquitetura e critérios de aceite estão em [`src/features/guided-experience/README.md`](../src/features/guided-experience/README.md).

### Mudanças com impacto em acessibilidade

| Mudança | Motivo | WCAG |
| --- | --- | --- |
| Guia não modal em 5 etapas, com o foco no título de cada etapa e restaurado no botão de entrada ao pular ou finalizar | Orientar a primeira utilização sem armadilha de foco e sem `aria-live` para mudar de etapa | 2.4.3, 2.4.6, 3.3.2, 4.1.2 |
| Entrada com texto visível, ligado por `aria-describedby`, e `aria-expanded`/`aria-controls` | O mesmo texto para quem enxerga e para o leitor de tela | 1.3.1, 4.1.2 |
| Modo de reprodução (ambas, só A, só B) no player e no guia; região sozinha centralizada | Alternativa ao estéreo para alto-falante mono, um fone ou audição assimétrica | 1.3.3, 1.4.1 (por analogia: não depender de um único canal sensorial) |
| Anúncios de estado vindos da store, numa única região `role="status"` | Sem duplicação quando o guia e o player controlam a mesma reprodução | 4.1.3 |
| Pause e Stop do guia com `aria-disabled` (não `disabled`) | O foco não se perde ao parar | 2.4.3 |
| Descrição pré-áudio do player e etapa 4 do guia geradas pela mesma função | Textos que não divergem e que citam valores reais | 1.1.1 |
| Legenda da imagem separa a "descrição escrita pela equipe" de "nenhuma descrição humana disponível" | Não sugerir reconhecimento semântico que a aplicação não faz | 1.1.1 |
| Links da etapa 5 com espaçamento mínimo de 24 px | O axe apontou `target-size` | 2.5.8 |
| Selects do player limitados à largura da coluna | O menu "Listen to" causava rolagem horizontal em 320 px | 1.4.10 |

### Testes executados (Chrome headless, build de produção)

56 verificações automatizadas, **56 aprovadas**:

- **Abertura:** o guia está fechado ao carregar e nenhum áudio toca por 2 s. A entrada tem nome, descrição e `aria-expanded`. O foco não se move na carga da página.
- **Teclado:** Tab chega ao botão de entrada; Enter abre o guia e foca "Step 1 of 5: Welcome". A partir do título, Tab alcança a navegação do guia.
- **Navegação entre etapas:** Next, Back e a lista de etapas movem o foco ao título correto.
- **Regiões:** o `select` de região do guia altera a configuração principal.
- **Etapa 4:**
  - lista os 8 fatos, que coincidem com a descrição do player;
  - nenhum áudio toca antes de um botão de escuta;
  - "Region A only" toca e anuncia o início e o fim;
  - "Region B only" anuncia;
  - Pause e Resume anunciam e mantêm o foco no botão;
  - Stop anuncia, mantém o foco e silencia o áudio;
  - "Both together" anuncia.
- **Etapa 5:** os links apontam para alvos existentes.
- **Encerramento:** Finish e Skip fecham o guia e restauram o foco; reiniciar foca a etapa 1 de novo.
- **Entrada pela Home:** navega para `/explore`, abre o guia, foca a etapa 1, não toca áudio e não reabre o guia ao recarregar.
- **axe:** sem violações em `/`, `/about`, `/explore` com o guia fechado e em cada uma das 5 etapas.
- **Regressão:** a sonificação de imagem avança e o player de comparação toca; `speechSynthesis` nunca é chamado; nenhum erro novo em tempo de execução.
- **Reflow em 320 px:** sem rolagem horizontal, com o guia fechado e em cada etapa.
- **Suíte anterior:** reexecutada, sem violações e com anel de foco em todos os elementos.

**Não executados:**

- **VoiceOver + Safari e NVDA:** não executados. Não há interface gráfica interativa nem Windows neste ambiente. **Não declarados como aprovados.**
- **Lint:** o projeto não tem linter configurado; foram executados apenas TypeScript (`tsc --noEmit`) e o build de produção.
- **Testes unitários:** o projeto não tem suíte de testes.

### Validação manual pendente (onboarding)

1. **Foco no título da etapa:** com VoiceOver e com NVDA, verificar se, ao focar um título com `tabIndex=-1`, o leitor anuncia "Step N of 5…" e continua a leitura da etapa.
2. **Repetição de anúncios:** verificar se não há anúncio repetido quando o botão Pause muda de nome para Resume enquanto a mensagem "Paused at…" é emitida.
3. **Escuta sequencial:** confirmar com fones, com um fone só e com alto-falante mono que a escuta sequencial permite identificar cada região.
4. **Entrada pela Home:** com leitor de tela, avaliar se chegar na Explore com o foco na etapa 1, sem passar pelo `h1`, é compreensível.

## Atualização — onboarding Screen Reader First (híbrido)

**Escopo:** o painel visual do guia foi removido. As orientações agora chegam ao leitor de tela por dois caminhos:

- **Navegação natural:** dicas `.sr-only` ligadas aos controles reais.
- **Guia completo sob demanda:** um landmark global (`<aside aria-label="Guided experience">`), visualmente oculto e visível só com foco de teclado.

Detalhes em [`src/features/guided-experience/README.md`](../src/features/guided-experience/README.md).

### Mudanças com impacto em acessibilidade

| Mudança | Motivo | WCAG |
| --- | --- | --- |
| Dica da página Explore em `.sr-only`, na ordem de leitura | Entender a página sem iniciar um guia | 1.3.2, 3.3.2 |
| Grupo dos menus de região (`role="group"`) com `aria-describedby` | Instrução ligada aos controles reais | 1.3.1, 3.3.2 |
| Menu "Listen to" com `aria-describedby` sobre estéreo e escuta sequencial | Não presumir fones; oferecer a alternativa no próprio controle | 1.3.3, 3.3.2 |
| Guia em landmark global, oculto pelo padrão de recorte e visível com `:focus-within` | Disponível em todas as páginas sem painel visual; foco sempre visível | 2.4.1, 2.4.7, 4.1.2 |
| Foco no título `h2` da etapa, com `preventScroll`; restauração do foco no botão ao fechar | Anunciar só a etapa atual, sem leitura longa nem rolagem inesperada | 2.4.3, 3.2.1 |
| Guia sem controles próprios de região ou reprodução; links para os controles reais | Sem controles duplicados e sem mudar estado | 3.2.2 |
| Remoção do painel visual, dos botões visíveis na Home e na Explore e dos estilos `.guided-*` | Interface visual igual à anterior ao onboarding | — |

### Testes executados (Chrome headless, build de produção)

71 verificações, **71 aprovadas**:

- **Tour removido:** nenhum elemento do painel visual no DOM; exatamente 2 menus de região na página.
- **Guia oculto e acessível:** sem foco, o guia mede 1×1 px e não usa `display:none`, `visibility:hidden`, `hidden` nem `aria-hidden`; seu conteúdo continua na árvore de acessibilidade.
- **Árvore de acessibilidade:**
  - botão com nome, descrição e `aria-expanded`;
  - landmark "Guided experience";
  - dica da página;
  - descrição do grupo de regiões e do menu "Listen to";
  - descrição do Play preservada.
- **Teclado:**
  - o botão é alcançável por Tab e fica visível ao receber foco;
  - Enter foca "Step 1 of 5: Welcome";
  - Tab leva a "Next step" e "Close guide";
  - Previous e Next movem o foco ao título certo;
  - Close e Finish restauram o foco no botão.
- **Sem efeitos indesejados:** nenhuma mensagem de status nem áudio ao iniciar ou navegar o guia; regiões e modo do player inalterados; a página não rola ao abrir ou fechar o guia, nem com a página já rolada.
- **Conteúdo:** a etapa 4 lista os mesmos 8 fatos da descrição do Play; os links das etapas apontam para seções existentes.
- **Outras páginas:** o guia funciona em `/` e `/about`, com dados da store e links para a Explore.
- **axe:** sem violações em `/`, `/explore` e `/about`, com o guia fechado e aberto (todas as etapas na Explore).
- **Regressão:**
  - player: modo "Region A only", Play, Pause e Stop com avisos;
  - sonificação de imagem;
  - resumo e tabela do gráfico;
  - texto do mapa;
  - legenda da imagem;
  - nenhum uso de `speechSynthesis`;
  - nenhum erro novo em tempo de execução;
  - sem rolagem horizontal em 320 px com o guia aberto.
- **Suíte da auditoria anterior:** reexecutada, com 0 violações e anel de foco em todos os elementos.

**Não executados:** VoiceOver + Safari e NVDA (o ambiente não tem interface gráfica interativa nem Windows); lint e testes unitários (o projeto não os tem). **Não declarados como aprovados.**

### Validação manual pendente

1. **Encontrar o guia:** com VoiceOver e NVDA, verificar se o botão oculto é fácil de achar por Tab, landmarks e lista de botões.
2. **Anúncio da etapa:** verificar se o foco no título anuncia só "Step N of 5: …", sem leitura automática do resto.
3. **Repetição da dica de regiões:** avaliar se ouvir a dica no parágrafo e de novo como descrição do grupo, ao entrar com Tab, incomoda.
4. **Caixa visível com foco:** avaliar com usuários de teclado com baixa visão a caixa que aparece no canto superior.

## Atualização — compatibilidade com a tradução automática do navegador

**Escopo:** o conteúdo visível e o conteúdo para leitores de tela (incluindo `.sr-only` e nomes acessíveis) devem continuar corretos quando o usuário usa a tradução nativa do navegador, por exemplo "Traduzir para português" no Chrome. A aplicação segue em inglês (`lang="en"`) e não tem tradução própria. Detalhes da implementação estão em [`src/features/guided-experience/README.md`](../src/features/guided-experience/README.md#compatibilidade-com-a-tradução-automática-do-navegador).

### Como foi testado

1. **Tradução real, uma rodada.** O tradutor nativo do Chrome não pode ser acionado no Chrome headless, que não tem o botão "Traduzir". Usei como aproximação o script público de tradução do Google (`translate_a/element.js`), o mesmo mecanismo que o Chrome injeta na página. Ele foi injetado só no teste, nunca no app. A primeira rodada traduziu a página para português. Em seguida, a ferramenta de permissões bloqueou novas injeções, porque elas enviam o conteúdo da página a um serviço externo. **Por isso, as correções não foram verificadas com tradução real.**
2. **Simulação local da tradução (sem serviço externo).** Um script troca cada nó de texto da página por `<font><font>[PT] …</font></font>`, a mesma estrutura que o tradutor produz. Depois muda o estado do React (região, variável, Play/Pause, guia, sonificação de imagem) e verifica se a tela mostra os valores novos e se o React não gera erros.
3. **Regressão:** a suíte do onboarding híbrido e a suíte da auditoria foram reexecutadas.

### Resultados

**Cenário A — inglês original:** sem mudança de comportamento. A suíte do onboarding passou com 71 de 71, e o axe não aponta violações em `/`, `/explore` e `/about`.

**Cenário B — tradução real para português (rodada única, antes das correções):**

| Conteúdo | Resultado |
| --- | --- |
| Texto visível no topo (`h1`, cabeçalho) | Traduzido |
| `.sr-only` perto do topo (dica da Explore, descrição da sonificação de imagem, botão e descrição do guia) | Traduzido: conteúdo oculto **é** traduzido |
| Atributos `aria-label`, `aria-valuetext`, `alt`, `title`, rótulo do landmark | Traduzidos. Exemplo: "January 2005: Manaus 24.5 °C, New York 18.2 °C" virou "Janeiro de 2005: Manaus 24,5 °C, Nova Iorque 18,2 °C" |
| Rótulos curtos em `aria-label` | **Mal traduzidos** por falta de contexto: "Play sonification" virou "Sonificação de jogo"; "Play image sonification" virou "Sonificação de imagem de reprodução" |
| Conteúdo mais abaixo na página (dica de regiões, descrição do player, título e resumo do gráfico, opções de menu) | **Não traduzido** em cerca de 7 s, sem rolar a página |
| Conteúdo criado depois da tradução (etapas do guia, mensagens de status, página About após navegação interna) | **Não traduzido** em 3,5 a 4 s |
| `lang` do documento | Passou a `pt` |
| Erros do React | Nenhum |

**Simulação local da tradução:**

| | Antes das correções | Depois |
| --- | --- | --- |
| Valores mostrados após mudar região ou variável | **Desatualizados**: o resumo do gráfico, o cabeçalho da tabela, a legenda do mapa e a descrição do player continuavam com "New York" depois da troca para Londres; o título continuava "temperature" depois da troca para precipitação | Corretos |
| Status do player, leitura do mês, guia | Corretos | Corretos |
| Leituras da sonificação de imagem | Inconclusivo: a aba estava oculta nessa rodada, um artefato do teste | Corretas |
| Erros do React | Nenhum | Nenhum |
| Total | 8 de 15 verificações | **15 de 15** |

A suíte do onboarding passou com 71 de 71 e a auditoria com 0 violações após as correções.

### Problemas encontrados e correções

| Problema | Impacto | Correção |
| --- | --- | --- |
| O React atualizava nós de texto que o tradutor já tinha substituído | Depois de traduzir, mudar região ou variável deixava **valores e nomes antigos** na tela e para o leitor de tela | Componente `StableText`: cada texto que muda fica num elemento com `key` igual ao texto. A tabela troca `<thead>`/`<tbody>` inteiros quando a comparação muda. Ramos condicionais de texto ficam em elementos próprios |
| Rótulos curtos só em `aria-label` | Tradução sem contexto e errada | Nomes como texto real no DOM: `.sr-only` dentro dos botões, `<label>` no slider, `aria-labelledby` para landmarks, grupos, listas, a barra de progresso, a ilustração da Home e o resumo final. Rótulos com mais contexto ("Play the sonification") |
| Instruções longas em atributo (canvas do mapa) | Texto longo fora do DOM | Nome curto ("Interactive map") e instruções num parágrafo `.sr-only` ligado por `aria-describedby` |
| Frases montadas com várias interpolações JSX | Tradução por fragmentos | Uma string por frase no resumo do gráfico, na descrição dos players, na legenda do mapa e no resumo final |
| Notação técnica traduzível | "Am" seria traduzido como palavra | `translate="no"` só em símbolos de acorde, "Rec. 709", "Y′", fórmula, notas C4/C6 e nome do produto |

Sem mudança visual. Nenhum mapeamento científico foi alterado.

### Problemas de tradução e de pronúncia (registrados separadamente)

**Tradução:**

- Conteúdo longe da área visível e conteúdo novo não foram traduzidos nos tempos medidos com o script do Google. Não se sabe se o tradutor nativo do Chrome traduz a página inteira de uma vez ou também sob demanda; isso precisa de verificação manual.
- Mensagens de status (`role="status"`) são anunciadas no momento em que aparecem. Como a tradução é assíncrona, o leitor de tela provavelmente as anuncia **em inglês**, mesmo que sejam traduzidas logo depois. Não há como evitar isso sem um sistema de tradução próprio, que está fora do escopo.
- `aria-valuetext` (posição, volume, progresso) é atributo. Ele foi traduzido na rodada real, mas o React reescreve o valor a cada mudança, e não se sabe se o tradutor traduz de novo. Os números continuam corretos em qualquer caso.

**Pronúncia:**

- Depois da tradução, o documento passa a `lang="pt"`. Qualquer trecho que continue em inglês (status ainda não traduzidos, `translate="no"`) será lido com voz em português.
- O nome do produto e os símbolos de acorde ficam em inglês de propósito e serão lidos com pronúncia portuguesa.

### Validação manual pendente

1. **Chrome real com "Traduzir para português"**, nos três momentos pedidos: página aberta já traduzida, tradução pedida depois de carregar, e conteúdo dinâmico atualizado após a tradução. Verificar o guia completo, as dicas `.sr-only`, nomes e descrições dos controles e as descrições científicas. Também mudar região e variável, tocar e parar os áudios.
2. **NVDA + Chrome e VoiceOver + Safari** com a página traduzida. Anotar à parte os erros de tradução e os de pronúncia.
3. Confirmar se as mensagens de status são anunciadas em inglês ou em português.
