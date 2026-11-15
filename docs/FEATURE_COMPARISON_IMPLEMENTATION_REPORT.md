# Earth Information Jukebox — Relatório técnico de implementação da Feature de Comparação

**Data:** 15/11/2026 · **Branch:** `dev` (commit `343e4d5`) mais o working tree observado em 15/11/2026 · **Escopo:** comparação de dados ambientais entre duas regiões com dados da NASA, reaproveitando o motor de sonificação existente

Este relatório é um **plano de engenharia**. Nenhum arquivo da aplicação foi alterado, nenhuma dependência foi instalada e nenhum serviço ou componente foi criado.

Ele **complementa** dois documentos e não repete o conteúdo deles:

- [`docs/PENDENCIAS.md`](PENDENCIAS.md): pendências `P-xx` e `A-xx`.
- [`docs/AUDITORIA_COMPARACAO.md`](AUDITORIA_COMPARACAO.md): problemas `AC-xx` e decisões `D-xx`.

Os achados novos deste relatório usam o prefixo **`FC-`** (Feature de Comparação). Riscos usam **`R-`** e perguntas pendentes usam **`Q-`**.

**Convenções**

- **Fato (código):** confirmado no código, com arquivo e linha (working tree de 15/11/2026).
- **Fato (API):** confirmado por chamada real executada em 15/11/2026, com a URL registrada em [Fontes](#fontes-consultadas).
- **Fato (docs):** confirmado na documentação oficial consultada em 15/11/2026.
- **Externo (não verificado):** conhecimento de domínio não confirmado nesta análise.
- **Recomendação:** proposta deste relatório, ainda não aprovada.
- **Decisão pendente:** escolha do time, listada na seção 13.

> **Working tree em mudança.** Os arquivos `engine/dataMapper.ts`, `engine/instrumentManager.ts`, `engine/layers.ts`, `engine/playbackController.ts` e `engine/sequencePlayer.ts` têm alterações não commitadas de outra frente de trabalho (camada cinematográfica). As linhas citadas desses arquivos são do working tree. A Etapa 3 deste plano mexe nesses arquivos e **só deve começar depois que esse trabalho for commitado** (risco [R-01](#12-riscos-técnicos)).

---

## Sumário

1. [Resumo executivo](#1-resumo-executivo)
2. [Arquitetura atual](#2-arquitetura-atual)
3. [Mapa de reutilização](#3-mapa-de-reutilização)
4. [Análise das APIs](#4-análise-das-apis)
5. [Arquitetura proposta](#5-arquitetura-proposta)
6. [Contratos TypeScript](#6-contratos-typescript)
7. [Estratégia de sonificação](#7-estratégia-de-sonificação)
8. [Proposta de interface](#8-proposta-de-interface)
9. [Acessibilidade](#9-acessibilidade)
10. [Plano de implementação](#10-plano-de-implementação)
11. [Critérios de aceite](#11-critérios-de-aceite)
12. [Riscos técnicos](#12-riscos-técnicos)
13. [Dúvidas e decisões pendentes](#13-dúvidas-e-decisões-pendentes)

---

## 1. Resumo executivo

**Diagnóstico**

- **A comparação já existe na interface, de ponta a ponta, com dados sintéticos.** Seleção de duas regiões, indicador, período, mapa, gráfico, tabela, resumo, player e descrições acessíveis funcionam na rota `/explore`. Todos os valores vêm de `createDemoSeries` (`src/features/data/demoData.ts:56-83`). A feature, portanto, **não é nova do zero**: o trabalho é trocar a fonte de dados, corrigir o modelo de dados e unificar o áudio.
- **Existem dois motores de áudio independentes** ([FC-01](#fc-01)):
  - **Imagem:** `PlaybackController` + `InstrumentManager` + `Tone.Transport`, com sincronização por `Tone.Draw` (`src/features/sonification/engine/`). Bem modularizado e coberto por testes.
  - **Comparação:** `Tone.Synth` criado dentro do componente e avançado por `setTimeout` em estado React (`SonificationPlayer.tsx:70-115`). Sem testes, sem relógio de áudio, escala linear em Hz (AC-02).
  - Os dois podem tocar **ao mesmo tempo**, porque nada coordena o uso do áudio.
- **O acoplamento entre imagem e áudio está em um ponto só.** `PlaybackController.play(analysis: ImageAnalysis)` chama `mapAnalysis` e `cinematicProfile` internamente (`playbackController.ts:73-114`) ([FC-02](#fc-02)). O resto do motor (`ScientificLayer`, `InstrumentManager`, `SynchronizationManager`) já trabalha com eventos sonoros, não com pixels. Desacoplar exige introduzir um contrato neutro (`SonificationScore`) e manter `play(analysis)` como adaptador, sem mudar o comportamento da imagem.

**Viabilidade**

- **Alta para o MVP** (duas regiões, `T2M` mensal, áudio sincronizado), **sem backend e sem nova dependência**:
  - O NASA POWER aceita chamadas diretas do navegador: `access-control-allow-origin: *` (Fato, API).
  - Uma requisição por região traz 46 anos de 5 parâmetros em ~44 KB e ~1,3 s (Fato, API). O período pode ser filtrado no cliente, sem nova requisição.
  - O motor de imagem pode tocar duas vozes de dados com três adaptações pequenas: contrato de partitura, um canal por voz no `InstrumentManager` e `seek`.
- **O GIBS tem a camada visual da mesma grandeza e da mesma reanálise do POWER** (`MERRA2_2m_Air_Temperature_Monthly`, Fato, API). Mapa e série podem mostrar a mesma variável, a mesma fonte e o mesmo mês.
- **O Earth Information Center não oferece API nem permite incorporação** (`X-Frame-Options: SAMEORIGIN`), e a API do SVS restringe CORS a outra origem (Fato, API, [FC-10](#fc-10)). A associação com o EIC no MVP deve ser feita por **links curados**, não por integração ([4.3](#43-earth-information-center-eic)).

**Fatos novos sobre os dados que mudam decisões** (detalhados na seção 4):

| ID | Fato (API) | Consequência |
| --- | --- | --- |
| [FC-05](#fc-05) | `T2M_MAX`/`T2M_MIN` mensais são o **extremo do mês** (máxima das máximas diárias), não a média das máximas | Rotular como "maior máxima diária do mês"; não comparar com a média |
| [FC-06](#fc-06) | `PRECTOTCORR_SUM` é o total mensal, apesar de o cabeçalho dizer `mm/day` | Confirma P-03; a unidade não pode ser lida cegamente do bloco `parameters` |
| [FC-07](#fc-07) | O ano corrente vem sem a chave `13` e com `-999` nos meses ainda não processados | A cobertura vem dos dados, não de constante; ausentes são o caso normal |
| [FC-08](#fc-08) | O POWER usa a célula de 0,5° × 0,625° mais próxima, sem interpolar. Sorocaba e São Paulo caem em células vizinhas | Resolve o "A verificar" de AC-08; a resolução precisa aparecer na interface |
| [FC-09](#fc-09) | A camada GIBS MERRA-2 tem lacunas na série de datas (404) e o colormap está em kelvin | O mapa precisa tratar a falta de imagem e converter a legenda |

**Recomendação central:** implementar o MVP em seis etapas incrementais ([seção 10](#10-plano-de-implementação)). As etapas 1 a 4 entregam a comparação real com áudio sincronizado. A Etapa 3 é a mais sensível: **migra a sonificação da comparação para o motor existente**, em vez de evoluir o segundo motor.

---

## 2. Arquitetura atual

### 2.1 Stack e dependências (Fato, código: `package.json`)

| Camada | Tecnologia | Uso |
| --- | --- | --- |
| UI | React 19, React DOM 19 | Componentes funcionais com hooks |
| Roteamento | `react-router` 7 (`createBrowserRouter`) | `/`, `/explore`, `/about` (`src/app/routes.tsx`) |
| Estado global | `zustand` 5 | Uma store: `useComparisonStore` (`src/stores/comparisonStore.ts`) |
| Áudio | `tone` 15 | Motor da imagem (estático) e player da comparação (`import("tone")` dinâmico) |
| Gráficos | `recharts` 3 | `ComparisonChart` |
| Mapa | `maplibre-gl` 6 | `EarthMap`, com tiles do OpenStreetMap |
| Estilo | Tailwind CSS 4 + CSS global (`src/index.css`, ~1800 linhas) | Classes semânticas próprias (`.player-card`, `.chart-card` etc.) |
| Build | Vite 8, TypeScript 5.7 (`strict`) | Alias `@` → `src` |
| Testes | `node:test` + `scripts/test-hooks.mjs` (sem dependência) | `npm test`: **94 testes, 94 passando**; `tsc --noEmit` sem erros (Fato, execução) |

Não existe cliente HTTP, `.env` nem backend. A única requisição de rede da aplicação, fora de fontes e tiles, é o carregamento dos samples de piano (`instrumentManager.ts:292-309`).

### 2.2 Organização de diretórios

```
src/
├── app/                      rotas e páginas (HomePage, ExplorePage, AboutPage)
├── components/               layout (AppHeader, AppFooter, RootLayout), DataSourceBadge, StableText
├── stores/comparisonStore.ts estado da comparação e da reprodução (zustand)
├── types/data.ts             Region, RegionSeries, EnvironmentalDataPoint, ComparisonState, SonificationState
└── features/
    ├── comparison/           ComparisonControls, RegionSelector, ScientificExplanation
    ├── data/                 demoData (regiões, indicadores, séries sintéticas), seriesStats
    ├── visualization/        charts/ComparisonChart, map/EarthMap
    ├── guided-experience/    ScreenReaderGuide, hooks, i18n/en.ts, README (regras de acessibilidade)
    └── sonification/
        ├── components/       ImageAnalyzer (exporta ImageSonification), ImageCollectionList, SonificationPlayer
        ├── engine/           imageAnalyzer, dataMapper, layers, instrumentManager, playbackController,
        │                     synchronization, sequencePlayer, narrationLayer, cinematicComposer, cinematicProfile
        ├── collection/       coleção de imagens (funções puras + hook)
        ├── hooks/            useImageSequence
        ├── describeImage.ts, describeSonification.ts
        └── SONIFICATION.md   documentação do motor de imagem
```

**Padrões adotados pelo projeto** (a seguir na implementação):

- Funções puras em módulos `.ts`, testadas com `node:test` (`imageCollection.ts`, `cinematicProfile.ts`, `describeImage.ts`).
- Classes de motor sem React, com callbacks (`PlaybackController`, `SequencePlayer`, `NarrationLayer`), ligadas por um hook que cria no mount e descarta no unmount (`useImageSequence.ts:62-101`).
- Interfaces mínimas para injeção e teste (`CompositionEngine`, `Narrator` em `sequencePlayer.ts:29-47`).
- **Fonte única de verdade** para mapeamento e texto: `COMPARISON_MAPPING` e `REGION_SOUND` (`describeSonification.ts:12-25`) alimentam o player, o guia e a descrição lida antes do áudio.
- Texto que muda com os dados em `StableText`, para resistir à tradução automática do navegador (`src/components/StableText.tsx`).
- Uma mensagem `role="status"` por mudança, nunca por passo de reprodução.

### 2.3 Arquitetura de componentes da página `/explore` (Fato, código: `ExplorePage.tsx`)

```
RootLayout
├── AppHeader (alto contraste)
├── ScreenReaderGuide  ← lê a store; gera as séries DE NOVO (P-15)
└── <main>
    └── ExplorePage    ← lê a store; gera seriesA/seriesB com useMemo (linhas 16-25)
        ├── ImageSonification       "00 / IMAGE SONIFICATION" (independente da store, AC-20)
        ├── ComparisonControls      "01 / SETUP"      → setRegion, setIndicator, setPeriod
        ├── EarthMap                "02 / GEOGRAPHY"  ← regionA, regionB
        ├── ComparisonChart         "03 / DATA"       ← seriesA, seriesB, currentIndex
        ├── SonificationPlayer      "04 / SONIFICATION" ← seriesA, seriesB; lê e escreve a store
        ├── ScientificExplanation   "05 / METHODOLOGY" ← indicator
        └── data-summary
```

Os componentes de visualização **recebem as séries por props**. Por isso a troca de fonte de dados é localizada: muda quem produz `seriesA`/`seriesB`, não quem consome.

### 2.4 Gerenciamento de estado

| Estado | Onde | Observação |
| --- | --- | --- |
| Regiões, indicador, período | `useComparisonStore` (`comparisonStore.ts:48-59`) | `indicator: string` com casts `as IndicatorId` espalhados (AC-17) |
| Reprodução da comparação (`isPlaying`, `currentIndex`, `playbackSpeed`, `volume`, `playbackMode`, `lastAction`) | Mesma store (`:54-59`) | Qualquer mudança de seleção para a reprodução (`stopForChange`, `:42-46`) |
| Séries | **Nenhum lugar compartilhado.** Recalculadas em `ExplorePage` e em `ScreenReaderGuide` | Com dados remotos, isso duplicaria requisições (P-15) |
| Reprodução da imagem | Estado local de `ImageSonification` + `useImageSequence` | Não passa pela store |
| Coleção e análises de imagem | `useImageCollection` (estado local, cache por `id|direção`) | Padrão útil de cache assíncrono com descarte de resultado obsoleto (`useImageCollection.ts:78-90`) |

### 2.5 Fluxo atual de imagem para áudio (Fato, código)

```
1. Entrada
   DEMO_IMAGE (src/assets/refence.png) ou upload (<input type=file>)
   └─ useImageCollection.add → URL.createObjectURL                 collection/useImageCollection.ts:93-118

2. Extração (sem React, síncrona, em canvas)
   loadImage(src) → analyzeImage(img, direction)                    useImageCollection.ts:84-88
   └─ imageAnalyzer.ts:62-149
      downscale ≤ 480 px → 96 fatias no eixo de leitura → por fatia:
      luma, saturação, contraste, centróide horizontal, família de cor, variação
      ⇒ ImageAnalysis { steps: VisualStep[96], stats }

3. Fila e narração
   ImageSonification monta SequenceItem[] { id, analysis, narration }  ImageAnalyzer.tsx (useMemo "queue")
   useImageSequence cria PlaybackController + NarrationLayer + SequencePlayer  hooks/useImageSequence.ts:62-101

4. Play (clique do usuário)
   SequencePlayer.play(id) → composition.prepare() (Tone.start + samples)   sequencePlayer.ts:129-141
   → narração (speechSynthesis) → composition.play(analysis)                 sequencePlayer.ts:246-290

5. Mapeamento dados → som  (dentro de PlaybackController.play)               playbackController.ts:73-114
   mapAnalysis(analysis)      → ScientificEvent[] (freq. em oitavas C4–C6, velocity, pan, timbre)  dataMapper.ts:38-55
   cinematicProfile(analysis) → energy (0..1)  → composeCinematic(...) → CinematicPlan
   new ScientificLayer(instruments); new CinematicLayer(instruments, plan)

6. Agendamento e reprodução
   Transport.bpm = 100 × speed; scheduleRepeat(tick, "8n")                  playbackController.ts:105-112
   tick(time): index = Transport.getTicksAtTime(time) / (PPQ/2)             synchronization.ts:17-19
               ScientificLayer.play(event, time) → panner → sampler/synth   layers.ts:15-27
               CinematicLayer.play(index, time)
               Tone.Draw.schedule(onStep(index), time)  → UI (cursor, faixa, slider)

7. Fim
   index ≥ events.length → Transport.stop; setTimeout → finish → onEnded    playbackController.ts:161-174
   → SequencePlayer avança para a próxima imagem ou encerra
```

### 2.6 Serviços de geração e reprodução de áudio

| Módulo | Responsabilidade | Dependência de imagem |
| --- | --- | --- |
| `engine/imageAnalyzer.ts` | Pixels → `ImageAnalysis` | Total (é a fonte) |
| `engine/dataMapper.ts` | `VisualStep` → `ScientificEvent` (pitch em oitavas, `PITCH_FLOOR_HZ = 261.63`, `PITCH_OCTAVES = 2`) | `ScientificEvent.source: VisualStep`; timbre por família de cor |
| `engine/cinematicProfile.ts` | `ImageAnalysis` → `energy` | Recebe `Pick<ImageAnalysis, "steps">` |
| `engine/cinematicComposer.ts` | `energy` + duração → plano musical | **Nenhuma** (função pura de números, por projeto) |
| `engine/layers.ts` | `ScientificLayer` toca `ScientificEvent`; `CinematicLayer` toca o plano | **Nenhuma** além do tipo `ScientificEvent` |
| `engine/instrumentManager.ts` | Grafo Tone.js: vozes científicas (piano sampleado, sino FM, seno), vozes cinematográficas, reverb, limiter, volume | **Nenhuma**, mas tem **um único** `sciPanner` (`:55`) |
| `engine/synchronization.ts` | Índice a partir do relógio do Transport; `Tone.Draw` | **Nenhuma** |
| `engine/playbackController.ts` | Play, pause, resume, stop, velocidade, volume, camadas | **Acoplado**: `play(analysis: ImageAnalysis)` |
| `engine/sequencePlayer.ts` | Fila de imagens, narração antes, loop | Usa `ImageAnalysis` como carga opaca |
| `components/SonificationPlayer.tsx` (comparação) | `Tone.Synth` seno/triângulo + `Tone.Panner`, `setTimeout` de 500 ms/passo | Não usa nada do motor |

### 2.7 Integração e configuração do Tone.js

- **Contexto e desbloqueio:** `Tone.start()` dentro do clique (`playbackController.ts:58-61, 82`; `SonificationPlayer.tsx:73`).
- **Relógio:** `Tone.getTransport()`, **singleton global** usado só pela imagem (`playbackController.ts:29`). A comparação não usa o Transport.
- **Grafo da imagem** (`instrumentManager.ts:1-11`): vozes científicas → `Panner` → `Filter(5 kHz)` → `sciBus` → `master`; vozes cinematográficas → `Filter(1.8 kHz)` → `cinBus` (−10 dB) → `master`; `master = Volume → Limiter(−1 dB) → Destination`. Polifonia limitada a 12 (`:287`).
- **Samples:** Salamander Grand Piano em `public/samples/piano/`, com fallback sintetizado e aviso após 15 s (`:117-139, 292-309`).
- **Separação de registro:** a camada cinematográfica fica abaixo de C4 ou acima de C6 (`cinematicComposer.ts:32-35`), deixando C4–C6 livre para os dados.
- **Comparação:** dois `Tone.Synth` ligados direto a `Panner → Destination`, sem limiter nem master (`SonificationPlayer.tsx:75-82`). Volume em dB calculado no componente (`:90`).

### 2.8 Sincronização entre interface, processamento e áudio

| Aspecto | Imagem | Comparação |
| --- | --- | --- |
| Fonte do tempo | Relógio de áudio (`Transport`, `getTicksAtTime`) | `window.setTimeout` dentro de `useEffect` (`SonificationPlayer.tsx:99-115`) |
| Atualização da UI | `Tone.Draw.schedule` no instante em que o som é ouvido | `setCurrentIndex` na store antes do próximo passo |
| Pausa e retomada | `Transport.pause/start`; o índice vem do relógio | `isPlaying=false`; o índice fica na store |
| Velocidade | `Transport.bpm.rampTo` | Divisor do `setTimeout` |
| Navegação (seek) | **Não existe** ([FC-04](#fc-04)) | Slider grava `currentIndex` na store (`:199-208`) |
| Aba em segundo plano | Fim detectado por `setTimeout` (Draw para em segundo plano) | Externo (não verificado): timers são reduzidos em segundo plano |

### 2.9 Erros, carregamento e cancelamento

| Mecanismo | Onde | Reaproveitável? |
| --- | --- | --- |
| Token de sessão para descartar `play()` assíncrono obsoleto | `PlaybackController.session` (`:39, 77, 89, 132`) | Sim, padrão a copiar |
| Token por execução de item (`token`, `live()`) | `SequencePlayer` (`:86, 246-290`) | Sim, padrão a copiar |
| Resultado assíncrono descartado se a chave sumiu | `useImageCollection.ts:88` | Sim, para o cache de séries |
| Estado `loading` só no primeiro play (samples) | `PlaybackController.play` (`:79`) | Sim |
| Falha de samples → fallback + aviso | `InstrumentManager.load` (`:117-139`) | Sim |
| Erro de áudio exibido | `SequenceCallbacks.onError` → `useImageSequence.error` | Sim |
| `AbortController` para rede | **Não existe** | Criar |
| Estados de carregamento e erro de dados | **Não existem** (A-02) | Criar |
| `errorElement` nas rotas | **Não existe**: sem WebGL2, `/explore` inteira falha (A-07) | Fora do escopo, mas afeta a comparação |

### 2.10 Achados de arquitetura (novos)

<a id="fc-01"></a>**FC-01 — Dois motores de áudio, sem coordenação.** O player da comparação cria seus próprios `Tone.Synth` e seu relógio por `setTimeout` (`SonificationPlayer.tsx:70-115`), enquanto a imagem usa o Transport. A imagem e a comparação podem tocar simultaneamente na mesma página. Consequência: duplicação de responsabilidades (volume, limiter, fim, velocidade), sincronização mais fraca na comparação e sobreposição sonora possível.

<a id="fc-02"></a>**FC-02 — `PlaybackController.play` é tipado para imagem.** `play(analysis: ImageAnalysis)` chama `mapAnalysis(analysis)` e `cinematicProfile(analysis)` (`playbackController.ts:91, 99`). Todo o resto do controlador só usa `this.events.length` e `this.events[index]`. É o único ponto de acoplamento entre extração da imagem e geração do áudio.

<a id="fc-03"></a>**FC-03 — Um único panner para as vozes de dados.** `InstrumentManager` tem um `sciPanner` (`:55`), cujo pan é rampado a cada evento (`setScientificPan`, `:210-212`). Duas vozes simultâneas (A à esquerda, B à direita) não podem ter posições independentes sem um canal por voz.

<a id="fc-04"></a>**FC-04 — Sem navegação temporal no motor.** `PlaybackController` não tem `seek`; `play()` sempre começa do passo 0 (`:105-112`). A comparação precisa de slider de posição, que hoje existe só no player próprio.

<a id="fc-11"></a>**FC-11 — Tempo base diferente.** A imagem usa 0,3 s por passo (100 BPM, colcheia, `playbackController.ts:15`). A comparação usa 0,5 s por mês (`COMPARISON_MAPPING.stepMs`, `describeSonification.ts:16-17`), e esse valor aparece nos textos lidos antes do áudio. O motor precisa aceitar o tempo base por partitura.

---

## 3. Mapa de reutilização

### 3.1 Matriz pedida

| Componente existente | Classificação | Justificativa (fundamentada no código) |
| --- | --- | --- |
| **Processamento de imagem** (`imageAnalyzer.ts`) | **Evitar** (como fonte de valores) · **Reutilizar o padrão** | Extrair temperatura de pixels é método falho (AUDITORIA_COMPARACAO 5.3; colormap GIBS é discreto e em K, [FC-09](#fc-09)). Reaproveita-se a **forma** do pipeline: extração pura → estrutura de passos com `stats` → mapper único. A série do POWER ocupa o lugar de `ImageAnalysis`. |
| **Motor de sonificação** (`dataMapper.ts`, `layers.ts`, `playbackController.ts`) | **Adaptar** | Recebe só imagem por causa de FC-02. Com um contrato `SonificationScore`, o mesmo motor toca imagem e séries. A fórmula de altura em oitavas (`lumaToFrequency`, `dataMapper.ts:38-40`) é exatamente a recomendada para a comparação (AC-02): generalizar para `normToFrequency`. |
| **Tone.js: instrumentos, sintetizadores e efeitos** (`instrumentManager.ts`) | **Adaptar** | Reutilizar master, limiter, reverb, samples, fallback e as vozes `glass` (seno) e `piano`. Adaptar: um canal (panner) por voz de dados ([FC-03](#fc-03)) e, se D-16 mantiver as identidades atuais, uma voz triangular. |
| **Playback Controller** (`playbackController.ts`) | **Adaptar** | Play, pause, resume, stop, velocidade, volume, token de sessão e fim natural servem como estão. Faltam: `playScore`, `seek(index)` ([FC-04](#fc-04)), tempo base por partitura ([FC-11](#fc-11)) e exclusividade do Transport ([FC-01](#fc-01)). |
| **Timeline** (`synchronization.ts`) | **Reutilizar** | `indexAt(time)` e `notify` via `Tone.Draw` resolvem a sincronização de UI. `seek` usa o mesmo `stepTicks`. Nenhuma mudança. |
| **Timeline da comparação** (`setTimeout` em `SonificationPlayer.tsx:99-115`) | **Evitar** | Relógio fora do áudio, acoplado ao ciclo de render. Substituído pelo Transport. |
| **Visualização: gráfico** (`ComparisonChart.tsx`) | **Adaptar** | Estrutura, legenda (linha sólida e tracejada), resumo, tabela e `ReferenceLine` do mês atual servem. Adaptar para consumir linhas alinhadas por data com `null` (AC-06), unidade única (AC-05) e proveniência real (A-04). |
| **Visualização: mapa** (`EarthMap.tsx`) | **Adaptar** | Marcadores com letra A/B, popups acessíveis e legenda textual servem. Adicionar fonte raster GIBS (P-11) com data e legenda. |
| **Visualização: waveform decorativa** (`SonificationPlayer.tsx:179-190`) | **Reutilizar** | `aria-hidden`, só progresso. |
| **Estado global** (`comparisonStore.ts`) | **Adaptar** | Mantém seleção, modo, velocidade, volume e `lastAction` (anúncios). Tipar `indicator` como `IndicatorId`. `currentIndex` passa a ser escrito pelo motor (via `onStep`). Dados remotos **não** entram na store: ficam em cache de módulo (seção 5.4). |
| **Acessibilidade: controles do player** | **Reutilizar** | Botões com texto `.sr-only`, slider com `aria-valuetext`, menu "Listen to" (A, B, ambos), anúncio único por transição (`SonificationPlayer.tsx:119-135`), descrição antes do áudio (`aria-describedby="player-description"`). |
| **Acessibilidade: descrições** (`describeSonification.ts`, `seriesStats.ts`) | **Adaptar** | A arquitetura de fonte única está certa. Adaptar textos de altura (oitavas), ausentes, proveniência e resolução espacial. |
| **Guia para leitores de tela** (`ScreenReaderGuide.tsx`) | **Adaptar** | Mantém as etapas; troca `createDemoSeries` pelo mesmo hook de dados da página (P-15). |
| **`StableText`** | **Reutilizar** | Todo texto dinâmico novo deve usá-lo. |
| **`SequencePlayer` e `NarrationLayer`** | **Evitar** (para a comparação) | A fila de imagens não se aplica a duas séries. A narração própria conflita com a regra "o leitor de tela é o único narrador" (D-13, A-09). A descrição antes do áudio continua sendo feita pelo leitor de tela. |
| **Camada cinematográfica** (`cinematicComposer.ts`, `CinematicLayer`) | **Evitar no MVP** · Reutilizável depois | Não carrega dados por projeto e respeita a banda C4–C6. Mas em comparação de duas vozes acrescenta massa sonora que dificulta a escuta (requisito "evitar sobreposição"). Desligada por padrão; opção futura (Q-07). |
| **Cliente de dados, cache, estados de carregamento e erro** | **Criar** | Não existe nada (P-02, A-02). |
| **Alinhamento por data, compatibilidade e diferenças** | **Criar** | Hoje é por índice (AC-06). |
| **Catálogo de indicadores** (`demoData.ts:29-44`) | **Adaptar** (mover) | Vira módulo próprio, tipado, com fonte, agregação e camada GIBS. |
| **Catálogo de regiões** (`demoData.ts:3-27`) | **Reutilizar** (mover) | As 5 cidades servem ao MVP. Acrescentar fonte da coordenada e resolução. |
| **`createDemoSeries`** | **Evitar em produção** | Sazonalidade errada e tendência embutida (AC-01). Em testes, trocar por fixture real gravada do POWER. |

### 3.2 Acoplamento entre extração da imagem e geração do áudio

**Onde está (Fato, código):**

1. `PlaybackController.play(analysis: ImageAnalysis)` mapeia e compõe internamente (`playbackController.ts:91-103`).
2. `ScientificEvent.source: VisualStep` e `timbre` derivado de `HueFamily` (`dataMapper.ts:20-28, 31-35`).
3. `CompositionEngine.play(analysis: ImageAnalysis)` na interface que o `SequencePlayer` usa (`sequencePlayer.ts:33`).

**Onde não está:** `ScientificLayer`, `InstrumentManager`, `SynchronizationManager`, `CinematicLayer` e `composeCinematic` não conhecem imagens.

**Como desacoplar sem mudar a imagem (Recomendação):**

```
ANTES                                          DEPOIS
ImageAnalysis ──► PlaybackController.play      ImageAnalysis ──► imageToScore() ──┐
                  (mapAnalysis + profile)                                         ├──► PlaybackController.playScore(score)
                                               ComparisonData ─► comparisonToScore()┘
```

1. **Criar `engine/score.ts`** com o contrato neutro `SonificationScore` ([6.6](#66-configuração-de-sonificação)): número de passos, tempo base, vozes (id, timbre, pan fixo ou por evento) e, por voz, uma nota ou `null` por passo, mais a energia cinematográfica opcional.
2. **Criar `engine/imageScore.ts`** com `imageToScore(analysis, cinematicEnergy)`, movendo para lá o que hoje está nas linhas 91 e 99 de `playbackController.ts`. A voz única `"main"` usa o pan por evento (como hoje).
3. **Em `PlaybackController`:** novo `playScore(score, fromIndex = 0)`; `play(analysis)` passa a ser `return this.playScore(imageToScore(analysis, cinematicProfile(analysis).energy))`. A interface `CompositionEngine` **não muda**, então `SequencePlayer` e seus testes ficam intactos.
4. **Em `ScientificLayer`:** `play(stepIndex, time, stepSeconds)` percorre as vozes do score e toca cada nota não nula no canal da voz.
5. **`ScientificEvent.source`** deixa de ser lido pelo motor. A tela da imagem continua usando `mapAnalysis` para a faixa de dados (`ImageAnalyzer.tsx`, `events`), sem mudança.

**Garantia de não regressão:** os 94 testes atuais continuam passando. Acrescentar um teste de equivalência: para uma `ImageAnalysis` fixa, `imageToScore` produz as mesmas frequências, velocidades, pans e timbres que `mapAnalysis`.

---

## 4. Análise das APIs

### 4.1 NASA POWER

#### Endpoints e uso

| Endpoint | `start`/`end` | Resposta (Fato, API) | Uso recomendado |
| --- | --- | --- | --- |
| `/api/temporal/monthly/point` | Anos (`2005`, `2024`) | Chaves `AAAAMM`, mais `AAAA13` (anual) em anos completos | **MVP**: série principal |
| `/api/temporal/daily/point` | `AAAAMMDD` | Chaves `AAAAMMDD` | Fora do MVP. Útil para validar agregações e para detalhar um mês |
| `/api/temporal/climatology/point` | Sem período (fixo) | Chaves `JAN`…`DEC`, `ANN`; cabeçalho: "January 2001 - December 2025" | Contexto ("normal do mês"). **Não** é base de anomalia configurável ([FC-12](#fc-12)) |

**Requisição recomendada para o MVP** (uma por região):

```
GET https://power.larc.nasa.gov/api/temporal/monthly/point
  ?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M
  &community=AG
  &latitude={lat}&longitude={lon}
  &start=1981&end={anoCorrente}
  &format=JSON
```

Medido em 15/11/2026 para Londres: HTTP 200, **44 064 bytes, 1,28 s** (Fato, API). Trazer todos os parâmetros e o período inteiro de uma vez faz com que trocar indicador ou período **não** gere nova requisição.

#### Formato da resposta (Fato, API)

```jsonc
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [-60.02, -3.12, 51.37] }, // lon, lat pedidos (3 casas), elevação da célula
  "properties": { "parameter": { "T2M": { "202301": 25.64, "...": 0, "202313": 28.22 } } },
  "header": {
    "title": "NASA/POWER Source Native Resolution Monthly and Annual",
    "api": { "version": "v2.10.0", "name": "POWER Monthly and Annual API" },
    "sources": ["MERRA2", "POWER"],
    "fill_value": -999.0,
    "time_standard": "LST",
    "start": "20230101", "end": "20241231"
  },
  "messages": [],
  "parameters": { "T2M": { "units": "C", "longname": "Temperature at 2 Meters" } },
  "times": { "data": 0.282, "process": 0.02 }
}
```

Erros vêm com HTTP 422 e mensagens legíveis (Fato, API):

- Parâmetro inválido: `{"header": "...failed...", "messages": ["One of your parameters is incorrect: FOO."]}`.
- Início antes de 1981: `"Your start date out of range. The data starts at 1981/01/01."`.
- `community` ausente: formato diferente (`{"detail": [{"type": "missing", "loc": ["query","community"], ...}]}`). O parser de erro deve aceitar os dois formatos.

#### Parâmetros e unidades

| Parâmetro | `units` (API) | `longname` (API) | Agregação mensal real | Exibição recomendada |
| --- | --- | --- | --- | --- |
| `T2M` | `C` | Temperature at 2 Meters | Média do mês | `°C`, "temperatura média do ar a 2 m" |
| `T2M_MAX` | `C` | Temperature at 2 Meters Maximum | **Máxima das máximas diárias** ([FC-05](#fc-05)) | "maior temperatura máxima diária do mês" |
| `T2M_MIN` | `C` | Temperature at 2 Meters Minimum | **Mínima das mínimas diárias** ([FC-05](#fc-05)) | "menor temperatura mínima diária do mês" |
| `PRECTOTCORR` | `mm/day` | Precipitation Corrected | Média diária do mês (taxa) | `mm/dia` (P-03) |
| `PRECTOTCORR_SUM` | `mm/day` (**rótulo errado**) | Precipitation Corrected Sum | **Total do mês** ([FC-06](#fc-06)) | `mm/mês` |
| `RH2M` | `%` | Relative Humidity at 2 Meters | Média do mês | `%` |

<a id="fc-05"></a>**FC-05 — `T2M_MAX`/`T2M_MIN` mensais são extremos (Fato, API).** Para Londres, janeiro de 2024: a maior `T2M_MAX` diária foi 12,66 °C, a média das máximas diárias foi 7,11 °C, e o valor mensal devolvido foi **12,66**. Para `T2M_MIN`: mínima diária −4,79, média 1,12, mensal **−4,79**. A documentação mensal não esclarece isso (Fato, docs). Consequência: `T2M_MAX` mensal é muito sensível a um único dia e não é "a máxima típica do mês". Se entrar no produto, a descrição deve dizer isso.

<a id="fc-06"></a>**FC-06 — Unidade de `PRECTOTCORR_SUM` (Fato, API).** No mesmo mês, a soma das `PRECTOTCORR` diárias foi 56,79 e o `PRECTOTCORR_SUM` mensal foi 56,79, mas o bloco `parameters` declara `mm/day`. Logo, o catálogo de indicadores precisa ter a unidade **de exibição** escrita e testada, e usar o `units` da API só como verificação (com exceção registrada para esse parâmetro).

#### Disponibilidade temporal

- **Início:** 1981-01 (Fato, API: erro 422 para 1980).
- **Fim:** a documentação mensal diz "Jan. 1, 1981 - as of the previous year" (Fato, docs), mas a API devolveu meses de 2026 até setembro e `-999.0` para outubro e novembro (Fato, API). A documentação de metodologia explica: MERRA-2 até "within several months of real time", depois GEOS FP-IT (Fato, docs).

<a id="fc-07"></a>**FC-07 — Ano incompleto (Fato, API).** Para `start=2025&end=2026`, a resposta tem `202513` (ano completo) mas **não** tem `202613`, e traz `202610: -999.0`, `202611: -999.0`. O `header.end` foi `20261130`. Consequências:

- A cobertura (primeiro e último mês com dado) é calculada dos dados, não fixada no código (resolve P-06).
- `-999` não é exceção rara: aparece em toda consulta que inclui o ano corrente.
- A chave `13` deve ser descartada pelo padrão `/^\d{4}(0[1-9]|1[0-2])$/`, não por "existe 13".
- **Recomendação:** o período padrão termina no **último ano completo para as duas regiões** (hoje 2025). Meses parciais do ano corrente ficam fora por padrão (Q-05).

#### Limitações de consulta

| Limite | Valor | Status |
| --- | --- | --- |
| Parâmetros por requisição (ponto) | 20 | Fato, docs |
| Parâmetros por requisição (região) | 1, grade de 0,5° × 0,5° | Fato, docs |
| Taxa de requisições | **Não documentada** nas páginas consultadas. 8 requisições seguidas: todas 200, 0,3–0,8 s | Fato, API (amostra pequena). Q-03 |
| CORS | `access-control-allow-origin: *` | Fato, API |
| Cache HTTP | Resposta passa por CloudFront (`x-cache`, `age`) | Fato, API. Não substitui cache local |
| Autenticação | Nenhuma | Fato, API |

#### Resolução espacial e duas regiões

<a id="fc-08"></a>**FC-08 — Célula mais próxima, sem interpolação (Fato, API).** O cabeçalho CSV diz "Elevation from MERRA-2: Average for 0.5 x 0.625 degree lat/lon region". Três pontos diferentes na área de São Paulo (−23,55/−46,63; −23,40/−46,70; −23,60/−46,60) devolveram **valores idênticos** (jan/2024: 23,85 °C; jul/2024: 17,26 °C) e a mesma elevação (790,19 m). Sorocaba (−23,50/−47,45) devolveu outra célula (24,81 °C; 17,69 °C; 702,59 m). A `geometry` devolve as coordenadas **pedidas**, arredondadas a 3 casas, e não o centro da célula.

Consequências:

- Duas regiões na mesma célula produzem séries idênticas. A comparação deve detectar isso (mesma elevação **e** mesmos valores) e avisar, além de impedir A = B (AC-07).
- A interface deve dizer que o valor representa uma célula de ~55 km (N–S) × ~69 km·cos(latitude) (L–O). Em 23° S, ~55 × 64 km.
- **Duas regiões = duas requisições independentes.** Não existe endpoint de "dois pontos". O endpoint regional exige 1 parâmetro por chamada e grade diferente (0,5° × 0,5°), por isso **não** é recomendado.

#### Comunidades

`AG`, `RE` e `SB` devolveram **os mesmos valores e unidades** para `T2M`, `PRECTOTCORR` e `RH2M` em Londres, 2024 (Fato, API). A diferença entre comunidades afeta outros parâmetros (por exemplo, unidades de radiação; Externo, não verificado). **Recomendação:** fixar `community=AG` no catálogo e registrar no teste de fixture.

#### Padrão de tempo e ausentes

- `time_standard: "LST"` (hora solar local). Em dados mensais o efeito é de borda de mês e pequeno (Externo, não verificado). Registrar na proveniência.
- `fill_value: -999.0` → `null`. Nunca vira número, nota, mínimo ou máximo (P-04).
- Critério comum de ausentes nas duas séries: um mês só entra em estatísticas de diferença se **as duas** regiões tiverem valor ([6.4](#64-dados-de-comparação-e-diferença)).

#### Necessidade de agregação temporal

- **MVP:** nenhuma. O POWER já entrega médias mensais.
- **Médias anuais:** calcular no cliente só com anos de 12 meses presentes, ou usar a chave `13` validada. Não usar `slice(0, 12)` (AC-04).
- **Diário → mensal:** desnecessário; o endpoint mensal faz isso e a diferença de definição de extremo ([FC-05](#fc-05)) mostra o risco de reagregar sem documentação.

<a id="fc-12"></a>**FC-12 — Base de anomalia.** O endpoint de climatologia tem período fixo 2001–2025 (Fato, API), que não coincide com normais climatológicas convencionais (1991–2020, Externo, não verificado). Como a série mensal completa já é baixada, a base de anomalia pode ser calculada no cliente para qualquer período de referência. **Decisão pendente** (Q-04). Fora do MVP.

### 4.2 NASA GIBS

**O que foi verificado (Fato, API):**

| Item | Resultado |
| --- | --- |
| WMTS EPSG:3857 (compatível com MapLibre) | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{Time}/{TileMatrixSet}/{z}/{y}/{x}.png` |
| CORS | `access-control-allow-origin: *` em capabilities e tiles |
| Cabeçalhos expostos | `layer-time-request`, `layer-time-actual`, `layer-identifier-actual` |
| Capabilities | 1330 camadas; XML de 5,8 MB (pesado demais para baixar no cliente) |
| Legenda | `https://gibs.earthdata.nasa.gov/legends/{Layer}_H.svg` (SVG, 200) |
| Colormap | `https://gibs.earthdata.nasa.gov/colormaps/v1.3/{Layer}.xml`, com `units="K"` para temperatura |
| Data ausente | HTTP 404 no tile |

**Camadas relevantes (Fato, API):**

| Indicador (POWER) | Camada GIBS da mesma grandeza e fonte | Matriz | Observação |
| --- | --- | --- | --- |
| `T2M` | `MERRA2_2m_Air_Temperature_Monthly` ("2-meter Air Temperature, (Monthly, MERRA2)") | `GoogleMapsCompatible_Level6` | **Mesma reanálise do POWER.** Colormap em K |
| `PRECTOTCORR` / `_SUM` | `MERRA2_Precipitation_Bias_Corrected_Monthly` | `Level6` | Mesma fonte; unidade da legenda **a verificar** |
| `RH2M` | Não há equivalente a 2 m. Há `MERRA2_Relative_Humidity_After_Moist_700hPa_Monthly` | — | **Grandeza diferente** (700 hPa). Não usar como imagem de `RH2M` |
| (não usar com `T2M`) | `MODIS_*_Land_Surface_Temp_*` | `Level7` | Temperatura da **superfície**, não do ar (AC-11) |

<a id="fc-09"></a>**FC-09 — Lacunas e unidade da camada GIBS (Fato, API).** A dimensão `Time` de `MERRA2_2m_Air_Temperature_Monthly` não é contínua: há intervalos como `1980-01-01/2023-11-01/P1M`, `2024-02-01/2024-04-01/P1M`, `2024-06-01/2025-04-01/P1M` e `2025-07-01/2026-08-01/P1M`, além de entradas diárias espúrias em abril–junho de 2025. Tiles de `2023-12-01` e `2024-05-01` dão **404**. Consequências:

- O mapa não pode pressupor imagem para todo mês da série.
- A legenda está em K; a série em °C. A conversão (K − 273,15) deve ser feita no texto da legenda acessível.
- `Level6` limita o zoom máximo a 6. A célula MERRA-2 é visível como bloco nesse nível, o que **comunica bem a resolução** ([FC-08](#fc-08)).

**Uso recomendado:** contexto visual, nunca fonte de número. Detalhes na Etapa 5.

### 4.3 Earth Information Center (EIC)

**O que foi verificado (Fato, API, 15/11/2026):**

| Pergunta | Resposta |
| --- | --- |
| Há API pública em `earth.gov`? | **Não encontrada.** `https://earth.gov/api` → 404. O `sitemap.xml` lista só `/` e `/about`. |
| Pode ser incorporado (iframe)? | **Não.** `X-Frame-Options: SAMEORIGIN`. |
| Que conteúdo há? | Páginas por tema (`/themes/agriculture`, `/themes/water-resources`, `/themes/disasters` etc.), portais (`/ghgcenter`, `/sealevel`) e links para ferramentas externas, entre elas o **Hometown Dashboard** do SVS e o **RAIN Global** (precipitação). Todas as páginas de tema respondem 200. |
| A galeria EIC do SVS (`https://svs.gsfc.nasa.gov/api/40467`) é acessível? | Responde 200 com `title: "Earth Information Center (EIC)"` e 6 `media_groups`, mas `access-control-allow-origin` é **outra origem** (`https://tempo.multiverse.music`). **O navegador bloqueia** a leitura a partir do app. |

<a id="fc-10"></a>**FC-10 — O EIC não é integrável pelo navegador (Fato, API).** Sem API pública, sem incorporação por iframe e com a galeria do SVS bloqueada por CORS. Qualquer associação ao EIC no MVP é por link ou por conteúdo estático versionado.

**Como atender ao requisito "associar dados científicos às visualizações do EIC" sem presumir integração:**

1. **MVP: links curados por indicador.** Um campo `eicLinks` no catálogo de indicadores, com título, URL e motivo (por exemplo, `T2M` → página de tema relevante do earth.gov e o Hometown Dashboard). Exibidos em `ScientificExplanation` como "Saiba mais no Earth Information Center", com "(abre em nova aba)" como já é feito em `AboutPage.tsx:60-81`. Custo baixo, sem dependência de rede.
2. **Mesma fonte de dados que o EIC usa nos mapas:** a camada GIBS MERRA-2 (seção 4.2). Isso associa a visualização do app ao ecossistema de dados da NASA de forma verificável, sem afirmar que é "a visualização do EIC".
3. **Pós-MVP, se o time quiser conteúdo do SVS:** usar um **snapshot estático** versionado (o `EIC.json` de `origin/main`, P-12), com créditos e data de captura. Chamar a API do SVS do navegador não funciona hoje.
4. **Não fazer:** iframe do earth.gov, scraping de páginas Next.js ou afirmar que valores "vêm do EIC".

**Pendências:** quais páginas do EIC são as associações corretas por indicador (Q-09); se o texto institucional "NASA POWER · GIBS · EIC" (`HomePage.tsx:38`) deve virar "NASA POWER · GIBS · links para o EIC" (P-13).

---

## 5. Arquitetura proposta

### 5.1 Fluxo de dados

```
[1] Seleção                          ComparisonControls / RegionSelector
    regionA, regionB, indicatorId,   → useComparisonStore (zustand)
    period, mode, speed, volume
                │
[2] Consulta    ▼
    useComparisonData(regionA, regionB)            ← usado por ExplorePage E ScreenReaderGuide (P-15)
      ├─ powerClient.fetchMonthly(regionA)   ─┐    cache de módulo: Map<chave, Promise<...>>
      └─ powerClient.fetchMonthly(regionB)   ─┤    uma requisição por região (todos os parâmetros, 1981→hoje)
                                              ▼
      powerParse.parseMonthly(json) → RegionDataset { region, provenance, series por parâmetro }
                │
[3] Normalização e alinhamento (puras, memoizadas)
    selectSeries(dataset, indicatorId, period) → MonthlySeries (−999→null, sem chave 13, unidade do catálogo)
    checkCompatibility(seriesA, seriesB)       → issues[] (indicador, unidade, medida, frequência, período, célula)
    alignByDate(seriesA, seriesB)              → ComparisonData { rows: {date, a, b, difference}[], coverage }
    summarizeDifference(data)                  → RegionDifference
                │
[4] Visualização ├──► ComparisonChart (linhas, tabela, resumo)
                 ├──► EarthMap (marcadores + camada GIBS do indicador)
                 └──► ScientificExplanation (proveniência, links EIC)
                │
[5] Sonificação  ▼
    comparisonToScore(data, config) → SonificationScore (2 vozes, 1 passo por mês, null = silêncio)
    describeComparisonSonification(data, score, …) → texto lido antes do áudio (mesmos números do score)
                │
[6] Reprodução   ▼
    useComparisonPlayback(score) → PlaybackController.playScore / pause / resume / stop / seek
                │                  InstrumentManager: canal "a" (pan −0,7), canal "b" (pan +0,7)
[7] Sincronia    ▼
    onStep(index) via Tone.Draw → store.setCurrentIndex → gráfico (ReferenceLine), slider, leitura, tabela
```

### 5.2 Módulos propostos

Nomes seguem o padrão do projeto (funções puras + hook + motor sem React). Das abstrações sugeridas no pedido, só três são justificadas pelo código; as demais são absorvidas por módulos existentes:

| Sugestão do pedido | Decisão | Motivo |
| --- | --- | --- |
| `NasaPowerProvider` | **Criar** como `features/data/power/powerClient.ts` + `powerParse.ts` | Necessário (P-02). Duas funções, não uma classe: o projeto usa classes só para objetos com ciclo de vida |
| `DataNormalizationService` + `ComparisonDataAdapter` | **Criar como um módulo puro**: `features/data/comparison.ts` | Alinhamento, compatibilidade e diferença são uma única responsabilidade e testáveis sem rede |
| `ComparisonService` | **Não criar** | O hook `useComparisonData` + o módulo puro cobrem. Uma camada a mais só repassaria chamadas |
| `EarthSonificationEngine` | **Não criar** | Seria um segundo motor ([FC-01](#fc-01)). O `PlaybackController` adaptado é o motor único |
| `PlaybackController` | **Adaptar o existente** | `playScore`, `seek`, tempo base por partitura, exclusividade do Transport |

**Arquivos novos**

| Arquivo | Conteúdo | Puro? |
| --- | --- | --- |
| `src/features/data/indicators.ts` | Catálogo tipado (move de `demoData.ts:29-44`) | Sim |
| `src/features/data/regions.ts` | Catálogo de regiões (move de `demoData.ts:3-27`) + fonte da coordenada | Sim |
| `src/features/data/power/powerClient.ts` | Montagem de URL, `fetch` com `AbortSignal`, timeout, erros tipados, cache de módulo | Não (rede) |
| `src/features/data/power/powerParse.ts` | JSON → `RegionDataset`; `-999`→`null`; descarta chave anual; valida unidades | Sim |
| `src/features/data/power/fixtures/*.json` | Respostas reais gravadas (Manaus e Londres) | — |
| `src/features/data/comparison.ts` | `selectSeries`, `checkCompatibility`, `alignByDate`, `summarizeDifference`, `coverageOf` | Sim |
| `src/features/data/useComparisonData.ts` | Hook: estados `idle/loading/ready/error`, descarte de resultado obsoleto | Não |
| `src/features/sonification/engine/score.ts` | Contrato `SonificationScore`, `normToFrequency` | Sim |
| `src/features/sonification/engine/imageScore.ts` | `imageToScore` (adaptador da imagem) | Sim |
| `src/features/sonification/engine/comparisonScore.ts` | `comparisonToScore` (escala comum, vozes A/B, silêncio) | Sim |
| `src/features/sonification/engine/transportOwner.ts` | Exclusividade do Transport entre controladores ([FC-01](#fc-01)) | Quase (estado de módulo) |
| `src/features/sonification/hooks/useComparisonPlayback.ts` | Liga `PlaybackController` à store, como `useImageSequence` | Não |
| `*.test.ts` ao lado de cada módulo puro | `node:test` | — |

**Arquivos alterados**

| Arquivo | Mudança |
| --- | --- |
| `src/types/data.ts` | `value: number \| null`; proveniência; medida; `IndicatorId` tipado |
| `src/stores/comparisonStore.ts` | `indicator: IndicatorId`; período padrão a partir da cobertura; `play/pause/stop` continuam emitindo `lastAction` |
| `src/app/routes/ExplorePage.tsx` | Usa `useComparisonData`; estados de carregamento, erro e incompatibilidade |
| `src/features/guided-experience/components/ScreenReaderGuide.tsx` | `useSelectedSeries` → `useComparisonData` (P-15) |
| `src/features/comparison/components/ComparisonControls.tsx` | Indicadores do catálogo; anos da cobertura; A ≠ B |
| `src/features/comparison/components/RegionSelector.tsx` | Resolução da célula no texto da região |
| `src/features/comparison/components/ScientificExplanation.tsx` | Proveniência real; links EIC |
| `src/features/visualization/charts/ComparisonChart.tsx` | Consome `ComparisonData.rows`; lacunas; "No data" |
| `src/features/visualization/map/EarthMap.tsx` | Camada GIBS + legenda + data |
| `src/features/sonification/components/SonificationPlayer.tsx` | Remove `Tone.Synth`/`setTimeout`; usa `useComparisonPlayback` |
| `src/features/sonification/describeSonification.ts` | Oitavas; frequências e domínio vindos do score; ausentes; proveniência |
| `src/features/sonification/engine/playbackController.ts` | `playScore`, `seek`, tempo base, `transportOwner` |
| `src/features/sonification/engine/instrumentManager.ts` | Canais de voz com panner próprio; voz triangular (se D-16) |
| `src/features/sonification/engine/layers.ts` | `ScientificLayer` multivoz |
| `src/components/DataSourceBadge.tsx` | Selo derivado da proveniência (P-13) |
| `src/features/data/demoData.ts` | Fica só com `formatMonth` e, se D-09 permitir, o mock para desenvolvimento |

### 5.3 Integração com o sistema atual (o que **não** muda)

- Rotas, layout, `RootLayout`, cabeçalho e alto contraste.
- A sonificação de imagem: `ImageSonification`, coleção, narração, `SequencePlayer` e a interface `CompositionEngine`.
- Identidade visual: classes CSS existentes (`.control-panel`, `.chart-card`, `.player-card`, `.science-section`). Componentes novos usam as mesmas classes.
- Regras do guia (`guided-experience/README.md`): nada toca sozinho, leitor de tela como único narrador da comparação, sem controles duplicados.

### 5.4 Cache, cancelamento e desempenho

- **Cache de módulo** em `powerClient.ts`: `Map<string, Promise<RegionDataset>>`, chave `power|monthly|AG|{lat.toFixed(3)}|{lon.toFixed(3)}|{parâmetros ordenados}|1981-{anoCorrente}`. Guardar a **promise** evita requisições duplicadas entre a página e o guia (P-15). Uma promise rejeitada é removida do mapa para permitir nova tentativa.
- **Persistência:** fora do MVP. Se a latência ou a disponibilidade durante demonstrações for um problema, gravar em `localStorage` com prazo de validade (Q-06), envolvendo toda leitura e escrita em `try/catch`.
- **Cancelamento:** a requisição compartilhada **não** é abortada quando um consumidor desmonta (outro pode depender dela). Cada consumidor descarta resultado obsoleto comparando a chave da seleção atual, como em `useImageCollection.ts:88`. `AbortSignal` é usado só para **timeout** (recomendação: 20 s, Q-03).
- **Troca de indicador ou período:** sem rede; só recalcula `selectSeries` e `alignByDate` em `useMemo`.
- **Durante a reprodução:** o score é calculado **uma vez** por (dados, modo). O `tick` só indexa arrays. A cada passo, só `currentIndex` muda. Recomendações:
  - memoizar `chartData` em `ComparisonChart` (hoje recalculado a cada render, `:23-27`), para que só a `ReferenceLine` mude;
  - a camada GIBS do mapa **não** muda de data a cada passo (ver Etapa 5).
- **Volume do download:** ~44 KB por região para 46 anos e 5 parâmetros. Sem necessidade de paginação.

### 5.5 Estados da página

| Estado | Condição | Interface |
| --- | --- | --- |
| `loading` | Alguma das duas séries carregando | Controles ativos; gráfico e player com esqueleto; Play com `aria-disabled` e motivo; anúncio "Loading NASA POWER data for X and Y…" |
| `error` | Falha de rede, HTTP, timeout ou parse | `role="alert"` com causa e botão "Try again"; seleção mantida; nenhum valor antigo exibido como atual |
| `incompatible` | `checkCompatibility` devolve problemas (mesma região, mesma célula, unidades, período sem sobreposição) | Mensagem explicando o motivo; gráfico mostra as séries se fizer sentido; player desabilitado com motivo |
| `ready` | Dados alinhados | Como hoje, com proveniência real |
| `partial` | `ready` com meses ausentes | Como `ready`, mais contagem de ausentes no resumo e na descrição do som |

---

## 6. Contratos TypeScript

Os contratos abaixo são **propostas**. Seguem o estilo de `src/types/data.ts` e do motor (interfaces simples, uniões discriminadas, `as const` + `satisfies` para catálogos). Onde substituem um tipo existente, a mudança é indicada.

### 6.1 Região geográfica

```ts
// src/types/data.ts (substitui Region)
export type RegionId = string;

export interface Region {
  id: RegionId;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Só "point" no MVP. Área fica para D-06. */
  geometry: "point";
  /** De onde vem a coordenada (ex.: "curated city centre"). */
  coordinateSource: string;
}

/** A célula de grade que o POWER usou para a região (FC-08). */
export interface GridCell {
  /** Tamanho da célula, em graus. MERRA-2: 0.5 × 0.625. */
  latitudeDegrees: number;
  longitudeDegrees: number;
  /** Elevação média da célula, em metros, de geometry.coordinates[2]. */
  elevationMeters: number;
}
```

### 6.2 Indicador ambiental

O catálogo é a única coisa a mudar para acrescentar um indicador. Os módulos de dados, gráfico, som e texto leem o catálogo e não têm `switch` por indicador.

```ts
// src/features/data/indicators.ts
export type PhysicalQuantity = "air_temperature_2m" | "precipitation" | "relative_humidity_2m";

/** O que um valor mensal representa (FC-05, FC-06). */
export type MonthlyAggregation =
  | "monthly_mean"            // T2M, RH2M
  | "monthly_extreme_max"     // T2M_MAX: maior máxima diária do mês
  | "monthly_extreme_min"     // T2M_MIN: menor mínima diária do mês
  | "monthly_mean_daily_rate" // PRECTOTCORR: média diária do mês
  | "monthly_total";          // PRECTOTCORR_SUM

export interface UnitDefinition {
  /** Exatamente como a API declara (para verificação). */
  source: string;
  /** Como aparece na tela. */
  display: string;
  /** Por extenso, para leitores de tela e descrições (A-05). */
  spoken: string;
}

export interface IndicatorDefinition {
  id: string;
  quantity: PhysicalQuantity;
  aggregation: MonthlyAggregation;
  source: { provider: "NASA_POWER"; parameter: string; community: "AG" };
  label: string;
  shortLabel: string;
  description: string;
  unit: UnitDefinition;
  /** Faixa física plausível; valores fora viram ausentes com aviso. */
  plausibleRange: readonly [number, number];
  /** Camada GIBS da MESMA grandeza e fonte, ou null (AC-11). */
  gibsLayer: { id: string; legendUnit: "K" | "mm/day" | "%"; matrixSet: string } | null;
  eicLinks: readonly { title: string; url: string }[];
  /** Medidas derivadas permitidas para este indicador. */
  measures: readonly MeasureKind[];
}

export const INDICATORS = {
  T2M: {
    id: "T2M",
    quantity: "air_temperature_2m",
    aggregation: "monthly_mean",
    source: { provider: "NASA_POWER", parameter: "T2M", community: "AG" },
    label: "Mean air temperature",
    shortLabel: "Temperature",
    description: "Monthly mean air temperature at 2 meters above the surface (MERRA-2 reanalysis).",
    unit: { source: "C", display: "°C", spoken: "degrees Celsius" },
    plausibleRange: [-90, 60],
    gibsLayer: {
      id: "MERRA2_2m_Air_Temperature_Monthly",
      legendUnit: "K",
      matrixSet: "GoogleMapsCompatible_Level6",
    },
    eicLinks: [],
    measures: ["absolute", "anomaly", "change"],
  },
  // PRECTOTCORR_SUM, RH2M… entram aqui depois de D-01 e D-02.
} as const satisfies Record<string, IndicatorDefinition>;

export type IndicatorId = keyof typeof INDICATORS;
```

### 6.3 Série temporal e medidas

Temperatura absoluta, anomalia e variação temporal são **medidas diferentes**, com unidades de interpretação diferentes. O tipo impede que uma seja passada no lugar da outra.

```ts
// src/types/data.ts
/** "YYYY-MM", validado em powerParse. */
export type YearMonth = string & { readonly __brand: "YearMonth" };

export type MeasureKind = "absolute" | "anomaly" | "change";

export type Measure =
  /** Valor físico do mês (ex.: 26,4 °C). */
  | { kind: "absolute" }
  /** Valor do mês menos a média do MESMO mês do calendário no período de referência,
   *  calculada para a MESMA região. Unidade igual (°C), mas zero = "normal". */
  | { kind: "anomaly"; baseline: { startYear: number; endYear: number } }
  /** Diferença em relação a um mês anterior da MESMA série (variação temporal).
   *  lag 12 = mesmo mês do ano anterior, sem efeito sazonal. */
  | { kind: "change"; lagMonths: 1 | 12 };

export interface DataPoint {
  date: YearMonth;
  /** null = ausente (fill_value, fora da faixa plausível ou mês não publicado). */
  value: number | null;
}

export interface Provenance {
  provider: "NASA_POWER" | "SYNTHETIC";
  /** header.title, header.api.version, header.sources */
  product: string;
  apiVersion: string | null;
  sources: string[];
  timeStandard: "LST" | "UTC" | null;
  fillValue: number | null;
  gridCell: GridCell | null;
  requestUrl: string | null;
  /** ISO 8601, momento da resposta. */
  retrievedAt: string;
}

/** Substitui RegionSeries. Igual ao atual, com value anulável, medida e proveniência. */
export interface MonthlySeries {
  region: Region;
  indicatorId: IndicatorId;
  measure: Measure;
  unit: string;          // unit.display do catálogo (fonte única; AC-05)
  frequency: "monthly";
  points: DataPoint[];   // ordenado, sem buracos de data (ausente = value null)
  provenance: Provenance;
}

/** Tudo o que uma resposta do POWER traz para uma região. */
export interface RegionDataset {
  region: Region;
  provenance: Provenance;
  /** Por parâmetro do POWER, todos os meses de 1981 até header.end. */
  parameters: Record<string, { unitSource: string; longName: string; points: DataPoint[] }>;
}
```

**Por que mudar `value` para `number | null` em vez de criar um tipo paralelo:** o compilador aponta cada uso que precisa tratar o ausente (`describeSeries`, `ComparisonChart`, `describeComparisonSonification`, o player). É a forma de migrar com menor risco de esquecer um consumidor.

### 6.4 Dados de comparação e diferença

```ts
// src/features/data/comparison.ts
export interface ComparisonRow {
  date: YearMonth;
  a: number | null;
  b: number | null;
  /** a − b; null se qualquer lado for null. */
  difference: number | null;
}

export interface Coverage {
  months: number;
  presentA: number;
  presentB: number;
  /** Meses usados em estatísticas de diferença. */
  bothPresent: number;
}

export type CompatibilityIssue =
  | { kind: "same_region" }
  | { kind: "same_grid_cell" }                  // FC-08
  | { kind: "indicator_mismatch" }
  | { kind: "unit_mismatch"; a: string; b: string }
  | { kind: "measure_mismatch" }                // ex.: anomalia × absoluto
  | { kind: "baseline_mismatch" }               // anomalias com bases diferentes
  | { kind: "frequency_mismatch" }
  | { kind: "no_overlap" }                      // nenhum mês com as duas presentes
  | { kind: "low_coverage"; bothPresent: number; months: number };

export interface ComparisonData {
  indicatorId: IndicatorId;
  measure: Measure;
  unit: string;
  period: { start: YearMonth; end: YearMonth };
  regionA: Region;
  regionB: Region;
  rows: ComparisonRow[];       // única estrutura consumida por gráfico, tabela, som e textos
  coverage: Coverage;
  provenance: { a: Provenance; b: Provenance };
  issues: CompatibilityIssue[]; // vazio = comparável
}

export interface RegionDifference {
  /** Média de (a − b) só nos meses com as duas presentes. */
  meanDifference: number | null;
  monthsUsed: number;
  largest: { date: YearMonth; difference: number } | null;   // a mais acima de b
  smallest: { date: YearMonth; difference: number } | null;  // b mais acima de a
  /** Meses em que A > B, A < B e A = B (após arredondamento de exibição). */
  sign: { aHigher: number; bHigher: number; equal: number };
}

export function alignByDate(a: MonthlySeries, b: MonthlySeries): ComparisonData;
export function checkCompatibility(a: MonthlySeries, b: MonthlySeries): CompatibilityIssue[];
export function summarizeDifference(data: ComparisonData): RegionDifference;
```

`alignByDate` gera a lista de meses a partir da **união** do período pedido, não de uma das séries. Isso elimina o `TypeError` de AC-06 e o corte silencioso de meses de B.

### 6.5 Estado de carregamento

```ts
// src/features/data/useComparisonData.ts
export type DataError =
  | { kind: "network"; message: string; retryable: true }
  | { kind: "timeout"; message: string; retryable: true }
  | { kind: "http"; status: number; messages: string[]; retryable: boolean }
  | { kind: "parse"; message: string; retryable: false };

export type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: DataError; retry: () => void };
```

### 6.6 Configuração de sonificação

```ts
// src/features/sonification/engine/score.ts
export type VoiceId = "main" | "a" | "b";
export type VoiceTimbre = "piano" | "bell" | "glass" | "triangle";

export interface ScoreNote {
  frequency: number;   // contínua, sem quantização (como dataMapper)
  velocity: number;    // 0..1
  /** Só a imagem varia o pan por nota; as regiões usam o pan fixo da voz. */
  pan?: number;
  timbre?: VoiceTimbre; // a imagem troca de timbre por família de cor
}

export interface ScoreVoice {
  id: VoiceId;
  timbre: VoiceTimbre;
  /** Pan fixo do canal da voz, −1..1. */
  pan: number;
  /** Um item por passo; null = silêncio (ausente ou voz desligada). */
  notes: (ScoreNote | null)[];
}

export interface SonificationScore {
  stepCount: number;
  /** Segundos por passo a 1×. Imagem: 0,3. Comparação: 0,5 (FC-11). */
  stepSeconds: number;
  voices: ScoreVoice[];
  /** null = camada cinematográfica desligada nesta partitura. */
  cinematic: { energy: number } | null;
}

/** Generaliza lumaToFrequency (dataMapper.ts:38-40): linear em oitavas. */
export function normToFrequency(norm: number, floorHz = 261.63, octaves = 2): number;
```

```ts
// src/features/sonification/engine/comparisonScore.ts
export interface PitchScale {
  floorHz: number;   // 261.63 (C4)
  octaves: number;   // 2 → teto 1046.5 Hz (C6)
  /** Domínio COMUM às duas regiões, na unidade física. */
  domain: { min: number; max: number };
  /** Como o domínio foi escolhido: pelos dados da comparação ou fixo por indicador (Q-08). */
  domainSource: "comparison" | "indicator";
}

export type MissingValuePolicy = "silence"; // MVP; extensível (ex.: "marker")

export interface ComparisonSonificationConfig {
  scale: PitchScale;
  mode: PlaybackMode;          // "both" | "a" | "b" (reutiliza comparisonStore)
  missing: MissingValuePolicy;
  voices: { a: { timbre: VoiceTimbre; pan: number }; b: { timbre: VoiceTimbre; pan: number } };
  stepSeconds: number;         // 0.5
  cinematic: false;            // MVP
}

export function comparisonToScore(
  data: ComparisonData,
  config: ComparisonSonificationConfig,
): SonificationScore;
```

### 6.7 Estado da reprodução

```ts
// Reutiliza PlaybackStatus de playbackController.ts: "idle" | "loading" | "playing" | "paused"
export interface ComparisonPlaybackState {
  status: PlaybackStatus;
  /** Mês atual (índice em ComparisonData.rows); 0 em idle. Escrito por onStep. */
  index: number;
  speed: number;        // 0.5 | 1 | 1.5 | 2 (como hoje)
  volume: number;       // 0..1
  mode: PlaybackMode;
  lastAction: PlaybackAction | null; // reutiliza o tipo da store, para anúncios
}
```

A store atual já guarda `isPlaying`, `currentIndex`, `playbackSpeed`, `volume`, `playbackMode` e `lastAction` (`comparisonStore.ts:17-36`). **Recomendação:** manter esses campos e derivar `status` do controlador no hook, em vez de duplicar estado.

### 6.8 Como um novo indicador entra sem mudança estrutural

1. Acrescentar uma entrada em `INDICATORS` (parâmetro, agregação, unidades, faixa, camada GIBS ou `null`, links).
2. Acrescentar o parâmetro à lista da requisição (derivada do catálogo, até 20).
3. Acrescentar um teste de parse com fixture contendo o parâmetro.

Nada mais muda: controles, gráfico, tabela, score, descrições e mapa leem o catálogo. Indicadores com agregação ou fonte diferentes (por exemplo, IMERG) exigem outro `provider`, o que é uma mudança deliberada (D-01, D-08).

---

## 7. Estratégia de sonificação

### 7.1 Princípios (herdados de `SONIFICATION.md` e da comparação atual)

1. **Uma variável física por dimensão sonora, monotônica e sem quantização.** Como `dataMapper.ts` (`Every mapping is linear (or linear-in-octaves for pitch) and unquantised`).
2. **Escala comum às duas regiões.** Mesmo valor, mesma altura (já é a regra atual, `describeSonification.ts:95`).
3. **Altura linear em oitavas** (resolve AC-02, decisão D-11). Diferenças iguais de valor soam como intervalos iguais.
4. **Identidade da região por timbre e posição estéreo, nunca só por cor.**
5. **Tempo = tempo.** Um passo por mês, em ordem cronológica, ritmo constante. O ritmo **não** codifica valor.
6. **Ausente = silêncio**, explicado antes do áudio (A-03).
7. **O texto lido antes do áudio cita os números exatos do score** (domínio, frequências, duração), calculados da mesma estrutura.

### 7.2 Mapeamento inicial recomendado (MVP: `T2M` absoluta)

| Informação científica | Característica sonora | Regra | Justificativa |
| --- | --- | --- | --- |
| Temperatura média mensal (°C) | **Altura** | `f = 261,63 × 2^(2 × norm)`, `norm = (v − min) / (max − min)` com min/max das duas séries juntas no período | Mesma fórmula da imagem (`dataMapper.ts:38-40`); banda C4–C6 reservada aos dados, longe da camada cinematográfica |
| Região A | **Timbre + canal** | Seno suave, pan −0,7 | Mantém a identidade atual (`REGION_SOUND.a`) |
| Região B | **Timbre + canal** | Triângulo, pan +0,7 | Mantém a identidade atual (`REGION_SOUND.b`); exige voz triangular no `InstrumentManager` (D-16) |
| Diferença entre regiões | **Intervalo entre as duas notas simultâneas** | Implícito pela escala comum | Já é a forma atual; sem nova camada no MVP (AC-03, D-12) |
| Variação temporal | **Contorno melódico** de cada voz | Implícito: passo a passo | Ritmo constante evita confundir "ritmo" com "valor" |
| Mês ausente | **Silêncio na voz** | `note = null` | Nunca vira a nota mais grave (P-04) |
| Intensidade (velocity) | **Constante** (0,7) | Não codifica dado | A percepção de volume é pouco confiável e depende do equipamento |
| Ano novo | Nenhum som no MVP | — | Q-07: um marcador discreto de janeiro ajudaria a orientação, mas acrescenta som |

**Casos de borda:**

- `max − min` menor que o passo de exibição (0,1 °C, por exemplo): todas as notas no meio da escala, e a descrição diz "values are almost equal; all notes play at the same pitch". Substitui o divisor fixo `Math.max(max − min, 1)` (P-14).
- Um só lado presente em um mês: só essa voz toca; o outro lado fica em silêncio.
- Modo "a" ou "b": a voz não escolhida tem todas as notas `null`; a voz escolhida fica centralizada (pan 0), como hoje (`SonificationPlayer.tsx:86-87`).

### 7.3 Mapeamentos sugeridos no pedido: avaliação

| Sugestão | Avaliação | Quando |
| --- | --- | --- |
| Temperatura → altura | **Adotar** | MVP |
| Diferença → intervalo | **Adotar como implícito** (escala comum). Uma voz dedicada à diferença (A − B com referência audível no zero) é um modo à parte, porque com três vozes a escuta satura | Pós-MVP, se D-12 aprovar |
| Variação temporal → ritmo e sequência | **Sequência sim, ritmo não.** Ritmo variável deslocaria a correspondência mês ↔ passo, quebrando a sincronia com o gráfico | — |
| Precipitação → densidade ou textura | **Não no MVP.** Precipitação mensal é contínua; densidade discreta (notas por passo) quantiza o valor e muda o tempo. Recomendação: precipitação como **indicador selecionável** com o mesmo mapeamento de altura, para que cada escuta tenha uma variável só | Depois de D-02 |
| Umidade → modulação ou timbre | **Não no MVP.** Timbre já identifica a região; usá-lo para dado destruiria essa identidade | Só se o time quiser escuta multivariada (Q-07) |

**Anomalia e variação (pós-MVP):**

- **Anomalia:** mesmo mapeamento de altura, domínio **simétrico em torno de zero** (−M..+M, M = maior |anomalia|), de forma que o centro da escala seja "normal". Recomendação adicional: um tom de referência baixo e contínuo no zero, opcional. O texto deve dizer "above or below its own normal", nunca "warmer than the other region".
- **Variação (lag 12):** idem, domínio simétrico; texto "compared with the same month one year earlier".
- As três medidas **nunca** compartilham uma escala na mesma escuta. O tipo `Measure` impede misturar.

### 7.4 Escolha do domínio da escala (Q-08)

| Opção | Vantagem | Desvantagem |
| --- | --- | --- |
| **Domínio da comparação** (min/max das duas séries no período, comportamento atual) | Usa toda a faixa audível; diferenças pequenas ficam audíveis | Mesma temperatura soa diferente em comparações diferentes; Manaus (amplitude ~6 °C) soa quase plana ao lado de Londres |
| **Domínio fixo por indicador** (ex.: −30 a 45 °C) | Altura absoluta e comparável entre sessões | Comparações tropicais ficam em uma faixa estreita |

**Recomendação para o MVP:** manter o domínio da comparação (é o comportamento testado e descrito hoje) e informar os extremos e as frequências no texto, como já acontece. Registrar a alternativa como decisão (Q-08).

### 7.5 Sobreposição e legibilidade

- Banda separada da camada cinematográfica (C4–C6); camada cinematográfica **desligada** na comparação do MVP.
- Panorama ±0,7 com fones ou caixas estéreo; modo "A only"/"B only" para escuta sequencial (já existe e é recomendado pelo guia, `guidedText.hints.stereo`).
- Timbres de envoltória distinta (seno com ataque suave × triângulo mais brilhante).
- Duração da nota: 90% do passo (`NOTE_LENGTH`, `layers.ts:13`), sem sobreposição entre meses.
- **Pós-MVP (Q-07):** modo intercalado, A no início do passo e B na metade, para quem ouve em mono ou com um fone só.

### 7.6 Adaptação do motor sem prejudicar a imagem

Ver [3.2](#32-acoplamento-entre-extração-da-imagem-e-geração-do-áudio). Mudanças concretas:

| Arquivo | Mudança | Efeito na imagem |
| --- | --- | --- |
| `engine/score.ts` (novo) | Contrato + `normToFrequency` | `lumaToFrequency` passa a chamar `normToFrequency`; valores iguais |
| `engine/imageScore.ts` (novo) | `imageToScore(analysis, energy)` com voz `"main"`, pan por nota, timbre por nota | Equivalente a `mapAnalysis` (teste de equivalência) |
| `engine/playbackController.ts` | `playScore(score, fromIndex)`; `play(analysis)` delega; `stepSeconds` define o BPM; `seek(index)`; `transportOwner.claim(this)` | `play(analysis)` mantém a assinatura |
| `engine/instrumentManager.ts` | `channel(voiceId)`: panner → `sciFilter` por voz, criado sob demanda; voz `triangle` | Canal `"main"` = `sciPanner` atual |
| `engine/layers.ts` | `ScientificLayer.play(stepIndex, time, stepSeconds)` multivoz | Uma voz, mesmo resultado |
| `engine/transportOwner.ts` (novo) | `claim(owner)` para o dono anterior (chama `stop()`) | Se a comparação tocar, a imagem para, e vice-versa |

**Cálculo do tempo:** `bpm = 60 / (2 × stepSeconds) × speed`. Imagem: 0,3 s → 100 BPM (igual ao atual). Comparação: 0,5 s → 60 BPM.

**`seek(index)`:** `transport.ticks = index × sync.stepTicks`. Em `paused`, só reposiciona; em `playing`, reposiciona e `CinematicLayer.resync()`; em `idle`, guarda `fromIndex` para o próximo `playScore`. Notifica `onStep(index)` para a UI.

---

## 8. Proposta de interface

### 8.1 Princípio

Não redesenhar. A página `/explore` já tem a jornada certa (setup → mapa → gráfico → som → método). A interface muda em **estados** (carregamento, erro, ausentes), **proveniência** e **dois controles novos**, todos com as classes CSS existentes.

### 8.2 Jornada do usuário

```
1. Chega em /explore
   → título, nota "NASA POWER · MERRA-2" (substitui "DEMO DATA" quando real), dica .sr-only
2. 01 / SETUP: escolhe Região A e B (lista curada), indicador, período
   → anúncio "Now comparing …" (existe)  +  anúncio de carregamento (novo)
   → se A = B ou mesma célula: mensagem e player desabilitado com motivo
3. 02 / GEOGRAPHY: mapa com marcadores A/B, camada MERRA-2 do indicador no mês selecionado, legenda
4. 03 / DATA COMPARISON: gráfico com lacunas, leitura do mês, resumo, tabela com "No data"
5. 04 / SONIFICATION: descrição antes do áudio (botão Play), Play/Pause/Stop, posição, "Listen to", velocidade, volume
   → durante a reprodução: linha do mês no gráfico, leitura, slider e linha da tabela acompanham
6. 05 / METHODOLOGY: o que se ouve, mapeamento, identidades, limites científicos, fonte real, links EIC
```

### 8.3 Componentes

| Necessidade | Componente | Situação | Mudança |
| --- | --- | --- | --- |
| Seleção de duas regiões | `RegionSelector` ×2 em `ComparisonControls` | Existe | Opção já escolhida no outro lado vem desabilitada **com texto** ("— selected as Region B"); texto da célula de grade |
| Seleção de indicador | Botões segmentados com `aria-pressed` | Existe | Lista do catálogo; no MVP só `T2M` (o segmentado pode ficar com um item ou mostrar `PRECTOTCORR` como "coming soon" sem botão, Q-10) |
| Seleção de período | Dois `<select>` | Existe | Anos da cobertura comum (1981 → último ano completo); manter o ajuste automático do outro limite (`ComparisonControls.tsx:22-33`) |
| Medida (absoluto/anomalia) | — | **Criar** (pós-MVP) | Segmentado igual ao de indicador |
| Visualização das séries | `ComparisonChart` | Existe | `connectNulls={false}`; esqueleto de carregamento; texto de proveniência; nota de ausentes |
| Identificação sonora | `sound-key` no player; `identity` no `RegionSelector` | Existe | Texto vindo de `REGION_SOUND` (sem mudança se D-16 mantiver as identidades) |
| Player sincronizado | `SonificationPlayer` | Existe | Motor trocado; mesmos controles; Play com `aria-disabled` + motivo durante carregamento |
| Explicação científica | `ScientificExplanation` | Existe | Fonte, versão, data de acesso, célula, ausentes; links EIC; remove "NOT YET CONNECTED" |
| Estados de carregamento e erro | — | **Criar** `DataStatus` (um componente pequeno em `features/comparison/components/`) | `role="status"` para carregando/concluído; `role="alert"` + "Try again" para erro |
| Selo de origem | `DataSourceBadge` | Existe | Recebe `provenance`; "NASA POWER" ou "DEMO DATA" |
| Contexto EIC | — | **Criar** lista de links no `ScientificExplanation` | Mesmo padrão de `source-list` da About |
| Sonificação de imagem no topo | `ImageSonification` | Existe | **Decisão pendente** (D-10, AC-20). Recomendação mínima: mover para depois da seção 05, sem outras mudanças |

### 8.4 Mapa (Etapa 5)

- Fonte raster MapLibre `gibs-{indicador}` acima do OSM, com `maxzoom: 6`, opacidade ~0,7 e atribuição "NASA GIBS · MERRA-2".
- **Data exibida:** o mês selecionado na posição do player quando pausado ou parado; durante a reprodução, a imagem **não** muda a cada mês (240+ trocas de tile em 2 min). Recomendação: atualizar no pause, no stop, no seek e, durante a reprodução, no máximo uma vez por ano (janeiro), com `prefers-reduced-motion` desligando a atualização automática (Q-11).
- **Lacuna da camada** ([FC-09](#fc-09)): tratar o evento `error` da fonte; mostrar "No GIBS image for {mês}; the series values are unaffected" e manter o último mês válido identificado pela data.
- **Legenda:** SVG do GIBS com `alt` e um texto acessível: "Colour scale: 2-meter air temperature, MERRA-2, from X °C to Y °C" (convertido de K).
- **Falha de WebGL2** (A-07): o mapa precisa de fallback textual para não derrubar a página. Pré-requisito da Etapa 5.

---

## 9. Acessibilidade

A acessibilidade atual é forte e documentada (`docs/accessibility-audit.md`, `guided-experience/README.md`). A comparação com dados reais deve **preservar** o que existe e cobrir o que os dados reais introduzem.

### 9.1 Requisitos e estratégia

| Requisito | Estado atual | Estratégia |
| --- | --- | --- |
| **Navegação por teclado completa** | Todos os controles são nativos (`select`, `button`, `input range`) | Manter controles nativos. **Não** usar `disabled` no botão focado (A-08): usar `aria-disabled="true"` + `aria-describedby` com o motivo. Sem atalhos de tecla única globais (WCAG 2.1.4). O slider de posição faz seek com setas, Home/End e PageUp/PageDown nativos |
| **VoiceOver e NVDA** | Validação manual pendente (A-06) | Plano de teste em [9.3](#93-plano-de-validação-com-leitores-de-tela); usar só padrões já usados no app |
| **Semântica e anúncios** | `role="status"` por mudança de seleção e por transição do player | Acrescentar: "Loading NASA POWER data for X and Y." → "Data loaded: N months, M missing." (uma mensagem cada). Erro em `role="alert"`. **Nunca** anunciar cada mês durante a reprodução; no pause, anunciar o mês e os dois valores (já existe) |
| **Regiões sem depender de cor** | Letra A/B, linha sólida × tracejada, timbre, canal, nome em todo texto | Manter; acrescentar a letra também no estado de "No data" da tabela ("A: no data") |
| **Controles acessíveis do player** | Texto `.sr-only` nos ícones, slider com `aria-valuetext` | `aria-valuetext` com ausentes: "March 2024: Manaus 26.5 degrees Celsius, London no data". Resolver o rótulo visível do slider (A-11) |
| **Alternativas textuais para gráficos** | `figcaption` com resumo calculado + tabela completa | Resumo usa `RegionDifference` (só meses com as duas presentes, com contagem); tabela com "No data"; proveniência real; unidade por extenso no texto lido |
| **Significado científico dos sons** | Descrição completa antes do áudio, de fonte única | Acrescentar: escala em oitavas, frequências exatas do score, convenção de silêncio, célula de grade, fonte e data de acesso. O guia lê a mesma função (P-15) |
| **Carregamento sem perder contexto** | — | Durante o carregamento, os controles continuam operáveis; o foco nunca vai para `<body>`; o conteúdo antigo não é apresentado como atual |
| **Narração** | A comparação não usa `speechSynthesis` | **Manter assim** (regra do guia). A decisão D-13/A-09 vale para a imagem |
| **Tradução automática** | `StableText` em todo texto dinâmico | Usar `StableText` nos textos novos (estado, proveniência, ausentes) |
| **Alto contraste** | Classe `high-contrast` | Novos elementos usam tokens existentes; a camada GIBS ganha opção de ocultar (o colormap não tem contraste garantido) |

### 9.2 Texto lido antes do áudio (exemplo do resultado esperado)

O texto é gerado por `describeComparisonSonification(data, score, speed, mode)`. Exemplo para o MVP, com números ilustrativos:

> About this sound: A sound representation of the line chart "Monthly temperature history", playing both regions together. Variable: mean air temperature at 2 meters, in degrees Celsius, from NASA POWER (MERRA-2 reanalysis), retrieved 15 November 2026. Each value represents a grid cell of about 55 by 64 kilometres, not a point in the city. Region A is Manaus, Brasil. Region B is London, United Kingdom. January 2005 to December 2025: 252 months, one month every 0.5 seconds, about 126 seconds at 1× speed. 3 months have no data for London; during those months only Manaus is heard. Pitch represents temperature on a scale shared by both regions, from 262 hertz for the lowest value in this comparison (−1.2 °C) to 1047 hertz for the highest (32.8 °C); equal steps in temperature sound as equal musical steps. Manaus is a soft sine tone in the left channel; London is a brighter triangle tone in the right channel.

### 9.3 Plano de validação com leitores de tela

| Cenário | VoiceOver (Safari, macOS) | NVDA (Firefox e Chrome, Windows) |
| --- | --- | --- |
| Trocar região e ouvir o anúncio de carregamento e de conclusão (uma vez cada) | ✔ | ✔ |
| Simular erro (modo avião) → alerta, "Try again" focável, foco preservado | ✔ | ✔ |
| Play desabilitado durante o carregamento: o motivo é lido | ✔ | ✔ |
| Descrição antes do áudio: números iguais à tabela e ao resumo | ✔ | ✔ |
| Pause: anúncio do mês com os dois valores, incluindo "no data" | ✔ | ✔ |
| Slider: setas avançam um mês, `aria-valuetext` correto, som reposicionado | ✔ | ✔ |
| Tabela: navegação por células, "No data" lido, linha atual (`aria-current`) | ✔ | ✔ |
| Guia (5 etapas): mesmos números da página | ✔ | ✔ |
| Imagem e comparação: iniciar uma para a outra (sem duas vozes) | ✔ | ✔ |
| Unidades: "°C" pronunciado como graus Celsius (A-05) | ✔ | ✔ |

---

## 10. Plano de implementação

**MVP:** comparação de duas regiões com `T2M` mensal real do NASA POWER e reprodução sonora sincronizada = **Etapas 1 a 4**, mais os itens de acessibilidade e teste marcados "MVP" na Etapa 6. As Etapas 5 e o restante da 6 completam a feature.

**Decisões mínimas antes da Etapa 1** (uma conversa curta): D-08 (só fontes públicas, recomendado: sim), D-09 (falha do POWER: erro claro, recomendado), D-05 (MVP compara valores absolutos, recomendado), Q-05 (período padrão até o último ano completo).

### Etapa 1 — Integração com NASA POWER

- **Objetivo:** séries reais de `T2M` para as regiões selecionadas, com proveniência, cache, estados de carregamento e erro, e uma única origem para a página e o guia.
- **Arquivos ou módulos:**
  - Novos: `src/features/data/indicators.ts`, `src/features/data/regions.ts`, `src/features/data/power/powerClient.ts`, `src/features/data/power/powerParse.ts`, `src/features/data/power/powerParse.test.ts`, `src/features/data/power/fixtures/{manaus,london}-monthly.json`, `src/features/data/useComparisonData.ts`, `src/features/comparison/components/DataStatus.tsx`.
  - Alterados: `src/types/data.ts` (6.1, 6.3), `src/stores/comparisonStore.ts` (`IndicatorId`), `src/app/routes/ExplorePage.tsx`, `src/features/guided-experience/components/ScreenReaderGuide.tsx` (P-15), `src/components/DataSourceBadge.tsx`, `src/features/data/demoData.ts` (sai o catálogo).
- **Dependências:** D-08, D-09; nenhuma dependência npm.
- **Resultado esperado:** `/explore` mostra dados reais de `T2M`; o gráfico, a tabela e o resumo existentes funcionam (ainda por índice, já que as duas séries vêm do mesmo endpoint e período); o selo diz "NASA POWER".
- **Critérios de aceite:**
  - [ ] `powerParse` converte `-999` em `null`, descarta `AAAA13`, aceita ano sem chave `13` ([FC-07](#fc-07)) e falha com erro tipado em JSON inválido; testado com fixtures reais.
  - [ ] Unidade exibida vem do catálogo; a unidade da API é verificada e uma divergência registra aviso no console em desenvolvimento.
  - [ ] Uma requisição por região, mesmo com página e guia montados; trocar indicador ou período não gera requisição (verificável na aba Network).
  - [ ] Erro HTTP 422, timeout e falta de rede mostram `role="alert"` com "Try again"; nenhum valor sintético aparece em produção.
  - [ ] Resultado de uma seleção anterior nunca substitui o da seleção atual (teste do hook com promessas resolvidas fora de ordem).
  - [ ] Nenhuma credencial ou variável de ambiente nova.

### Etapa 2 — Normalização e comparação das séries

- **Objetivo:** uma estrutura alinhada por data (`ComparisonData`) consumida por todos; compatibilidade verificada; diferenças só sobre meses válidos.
- **Arquivos ou módulos:**
  - Novos: `src/features/data/comparison.ts`, `src/features/data/comparison.test.ts`.
  - Alterados: `src/features/data/seriesStats.ts` (média anual só com anos completos; remove `slice(0, 12)`, AC-04), `src/features/visualization/charts/ComparisonChart.tsx` (consome `rows`; `connectNulls={false}`; "No data"; unidade única, AC-05), `src/features/comparison/components/ComparisonControls.tsx` (anos da cobertura; A ≠ B), `src/features/comparison/components/RegionSelector.tsx` (célula de grade).
- **Dependências:** Etapa 1.
- **Resultado esperado:** séries de tamanhos diferentes e meses ausentes não quebram nada (AC-06); a interface explica quando a comparação não é válida.
- **Critérios de aceite:**
  - [ ] Nenhum consumidor acessa `series.data[index]`/`series.points[index]` de outra série; `grep` confirma.
  - [ ] Teste: A com 24 meses e B com 20 → 24 linhas, 4 com `b: null`, sem exceção.
  - [ ] `checkCompatibility` detecta mesma região, mesma célula (fixture São Paulo × ponto vizinho, [FC-08](#fc-08)), unidades diferentes e ausência de sobreposição.
  - [ ] Diferença média e contagem usam só meses com as duas presentes; o resumo informa quantos meses foram excluídos.
  - [ ] Teste de sanidade climática com fixture real: mês mais quente de Londres entre junho e agosto (falha com o mock atual, AC-01).

### Etapa 3 — Integração com o mecanismo de sonificação existente

- **Objetivo:** a comparação toca pelo `PlaybackController`, sem segundo motor, sem mudar a experiência da imagem.
- **Arquivos ou módulos:**
  - Novos: `src/features/sonification/engine/score.ts`, `engine/imageScore.ts`, `engine/comparisonScore.ts`, `engine/transportOwner.ts`, `hooks/useComparisonPlayback.ts`, e testes `score.test.ts`, `imageScore.test.ts` (equivalência com `mapAnalysis`), `comparisonScore.test.ts`.
  - Alterados: `engine/playbackController.ts` (`playScore`, `stepSeconds`, `transportOwner`), `engine/instrumentManager.ts` (canal por voz; voz triangular se D-16), `engine/layers.ts` (multivoz), `engine/dataMapper.ts` (`lumaToFrequency` delega a `normToFrequency`), `components/SonificationPlayer.tsx` (remove `Tone.Synth`, `setTimeout`, `playNotes`, `disposeSynths`), `describeSonification.ts` (oitavas; números do score; silêncio; proveniência; `COMPARISON_MAPPING` passa a ter `floorHz`/`octaves` no lugar de `lowHz`/`highHz`).
  - Atualizados: `SONIFICATION.md` (seção nova "Comparison scores"), `src/app/routes/AboutPage.tsx` (texto da metodologia, seção 03).
- **Dependências:** Etapa 2; D-11 (oitavas), D-16 (identidades de timbre); **trabalho em andamento no motor commitado** (R-01).
- **Resultado esperado:** mesmo player, mesmos controles; som pelo motor compartilhado (limiter, master); altura em oitavas; silêncio nos ausentes; imagem e comparação nunca tocam juntas.
- **Critérios de aceite:**
  - [ ] Os 94 testes existentes passam sem alteração nos arquivos de teste da imagem; `tsc --noEmit` sem erros.
  - [ ] Teste de equivalência: `imageToScore` = `mapAnalysis` (frequência, velocity, pan, timbre) para uma análise fixa.
  - [ ] `comparisonToScore`: menor valor → 261,63 Hz, maior → 1046,5 Hz; mês ausente → `null`; modo "a" → voz B toda `null` e voz A com pan 0; amplitude ~0 → altura central.
  - [ ] Descrição lida antes do áudio cita min, max e Hz idênticos aos do score (teste).
  - [ ] `src/features/sonification/components/SonificationPlayer.tsx` não importa `tone`.
  - [ ] Iniciar a comparação durante a imagem para a imagem (e vice-versa), com anúncio de "Stopped" na que parou.

### Etapa 4 — Sincronização de áudio e visualização

- **Objetivo:** o mês ouvido é o mês destacado em todo lugar; navegação temporal com som.
- **Arquivos ou módulos:** `engine/playbackController.ts` (`seek`), `hooks/useComparisonPlayback.ts` (`onStep` → `setCurrentIndex`), `components/SonificationPlayer.tsx` (slider chama `seek`), `visualization/charts/ComparisonChart.tsx` (memoização de `chartData`), `stores/comparisonStore.ts` (ações continuam emitindo `lastAction`).
- **Dependências:** Etapa 3.
- **Resultado esperado:** linha do mês no gráfico, leitura de valores, slider e linha da tabela mudam quando a nota é ouvida (via `Tone.Draw`); pausa, retomada, velocidade e seek mantêm a sincronia.
- **Critérios de aceite:**
  - [ ] Teste do controlador com Transport simulado: `seek(10)` em pausa → `onStep(10)`; `resume` → próximo evento é o índice 10.
  - [ ] Mudança de velocidade durante a reprodução não pula nem repete meses (índice vem de `getTicksAtTime`).
  - [ ] Trocar região, indicador ou período durante a reprodução para o som e anuncia "Stopped" (comportamento atual de `stopForChange`).
  - [ ] Sair da página para o som e libera o motor (sem nós Tone.js vivos; `dispose` chamado).
  - [ ] Com 20 anos (240 meses), a reprodução a 2× não acumula atraso visível em relação ao áudio (verificação manual, Chrome e Safari).

### Etapa 5 — Integração visual com EIC/GIBS

- **Objetivo:** contexto visual da mesma grandeza e fonte; associação ao EIC por links curados.
- **Arquivos ou módulos:** `visualization/map/EarthMap.tsx` (fonte raster GIBS, legenda, data, erro de tile, fallback sem WebGL2), `data/indicators.ts` (`gibsLayer`, `eicLinks`), `comparison/components/ScientificExplanation.tsx` (links EIC), `app/routes/HomePage.tsx` e `components/layout/AppHeader.tsx` (textos de fonte, P-13).
- **Dependências:** Etapas 1 e 4; D-04 (camada por indicador), Q-09 (links EIC), Q-11 (atualização da data do mapa); A-07 (fallback WebGL).
- **Resultado esperado:** o mapa mostra `MERRA2_2m_Air_Temperature_Monthly` do mês selecionado, com legenda acessível em °C; meses sem imagem são informados; links do EIC na metodologia.
- **Critérios de aceite:**
  - [ ] A camada é da mesma grandeza do indicador (nunca LST para `T2M`, AC-11); indicador sem camada (`gibsLayer: null`) não mostra camada.
  - [ ] 404 de tile não gera erro na página e mostra a mensagem de lacuna com a data.
  - [ ] Nenhum número da interface vem da imagem.
  - [ ] Legenda com alternativa textual em °C; atribuição "NASA GIBS · MERRA-2".
  - [ ] Com WebGL2 indisponível, a página continua funcional (mapa substituído por texto).
  - [ ] Links do EIC abrem em nova aba com aviso textual; nenhum iframe.

### Etapa 6 — Acessibilidade, testes e validação

- **Objetivo:** fechar a feature com evidência.
- **Arquivos ou módulos:** `describeSonification.ts`, `ComparisonChart.tsx`, `SonificationPlayer.tsx` (`aria-disabled`, rótulo do slider, A-08/A-10/A-11), `guided-experience/i18n/en.ts` e `README.md`, `docs/accessibility-audit.md`, `docs/PENDENCIAS.md`, `docs/AUDITORIA_COMPARACAO.md`, `README.md`.
- **Dependências:** Etapas 1 a 4 (MVP) e 5.
- **Resultado esperado:** critérios da seção 11 verificados e documentados.
- **Critérios de aceite:**
  - [ ] **(MVP)** Anúncios de carregamento, conclusão e erro (uma mensagem cada), testados com leitor de tela.
  - [ ] **(MVP)** Play nunca fica fora da ordem de Tab sem explicação.
  - [ ] **(MVP)** `npm test` cobre: parse, alinhamento, compatibilidade, diferenças, score, equivalência da imagem, descrição.
  - [ ] Plano da seção 9.3 executado em VoiceOver e NVDA, resultados anexados ao `accessibility-audit.md`.
  - [ ] PENDENCIAS e AUDITORIA_COMPARACAO atualizados: P-01, P-02, P-04, P-06, P-13 (parcial), P-14, P-15, AC-02, AC-05, AC-06, AC-07, AC-08, A-02, A-03, A-04 marcados conforme o que foi resolvido.

### Dependências entre etapas

```
Decisões D-05, D-08, D-09, Q-05
        │
     Etapa 1 ──► Etapa 2 ──► Etapa 3 ──► Etapa 4 ──► Etapa 6 (MVP)
        │                       ▲                        │
        │        trabalho do motor commitado (R-01)      │
        └─────────────────────────────► Etapa 5 ─────────┴──► Etapa 6 (completa)
                                   (A-07, D-04, Q-09, Q-11)
```

---

## 11. Critérios de aceite

A feature está concluída quando **todos** os itens abaixo forem verificáveis. Os marcados **MVP** bastam para a primeira entrega.

**Dados**

- [ ] **MVP** Todo valor exibido, descrito e sonificado vem do NASA POWER, com fonte, produto, versão da API, data de acesso e célula de grade visíveis e lidos pelo leitor de tela.
- [ ] **MVP** `-999` e chaves anuais nunca aparecem como dado; meses não publicados do ano corrente são ausentes.
- [ ] **MVP** As duas séries têm o mesmo indicador, a mesma unidade de exibição, a mesma medida, a mesma frequência e o mesmo período, verificados por `checkCompatibility`.
- [ ] **MVP** A mesma região ou a mesma célula de grade não é apresentada como comparação válida.
- [ ] **MVP** Uma requisição por região por sessão; trocar indicador ou período não gera rede.
- [ ] **MVP** Falha do POWER mostra erro com nova tentativa, sem dados sintéticos.
- [ ] Indicadores além de `T2M` entram só pelo catálogo, com teste de fixture.

**Cálculos**

- [ ] **MVP** Alinhamento por data; séries de tamanhos diferentes não quebram nenhum componente.
- [ ] **MVP** Diferenças e médias só com meses válidos, com contagem exibida.
- [ ] **MVP** Toda frase do resumo pode ser reproduzida a partir da tabela.
- [ ] Anomalia e variação, se implementadas, usam `Measure` e nunca são misturadas com valores absolutos.

**Sonificação e sincronia**

- [ ] **MVP** A comparação toca pelo `PlaybackController`; `SonificationPlayer.tsx` não importa `tone`.
- [ ] **MVP** Altura linear em oitavas, C4–C6, escala comum às duas regiões; descrição com os mesmos números.
- [ ] **MVP** Mês ausente = silêncio na voz, explicado antes do áudio.
- [ ] **MVP** Play, pause, resume, stop, seek, velocidade e volume funcionam; o mês destacado é o mês ouvido.
- [ ] **MVP** Imagem e comparação nunca tocam ao mesmo tempo.
- [ ] **MVP** A sonificação de imagem continua idêntica: 94 testes atuais passando e teste de equivalência.

**Visualização**

- [ ] **MVP** Gráfico com lacunas; tabela com "No data"; selo de origem derivado da proveniência.
- [ ] Camada GIBS da mesma grandeza, com legenda acessível em °C e tratamento de meses sem imagem.
- [ ] Links ao Earth Information Center por indicador, sem iframe.

**Acessibilidade**

- [ ] **MVP** Navegação completa por teclado, sem perda de foco.
- [ ] **MVP** Carregamento, conclusão, erro e transições anunciados uma vez.
- [ ] **MVP** Regiões identificáveis sem cor (letra, padrão de linha, timbre, canal, nome).
- [ ] Validação manual em VoiceOver e NVDA registrada (A-06).

**Engenharia**

- [ ] **MVP** Sem dependências novas, sem backend, sem credenciais.
- [ ] **MVP** `npm test` e `npm run typecheck` passam.
- [ ] Documentação (`SONIFICATION.md`, `README.md`, PENDENCIAS, AUDITORIA_COMPARACAO, About) atualizada.

---

## 12. Riscos técnicos

| ID | Risco | Prob. | Impacto | Mitigação |
| --- | --- | --- | --- | --- |
| R-01 | **Conflito com o trabalho não commitado** no motor (`layers.ts`, `instrumentManager.ts`, `playbackController.ts`, `dataMapper.ts`, `sequencePlayer.ts`) | Alta | Alto | Começar a Etapa 3 só depois do commit dessa frente; Etapas 1 e 2 não tocam o motor e podem começar já |
| R-02 | **Regressão na sonificação de imagem** ao introduzir `playScore` | Média | Alto | `play(analysis)` mantém assinatura; teste de equivalência; 94 testes atuais sem mudança; escuta comparativa antes/depois |
| R-03 | **POWER indisponível ou lento** durante demonstração | Média | Alto | Erro claro com nova tentativa; Q-06 (cache persistente) ou snapshot real gravado (D-09/D-15) para demos offline, sempre rotulado |
| R-04 | **Limites de taxa não documentados** do POWER | Baixa | Médio | Uma requisição por região; cache com promise compartilhada; nenhuma requisição por troca de indicador ou período |
| R-05 | **Interpretação errada de `T2M_MAX`/`T2M_MIN`** ([FC-05](#fc-05)) | Média (se entrarem) | Alto | Fora do MVP; se entrarem, `aggregation: "monthly_extreme_*"` e texto explícito |
| R-06 | **Unidade errada lida da API** ([FC-06](#fc-06)) | Média | Alto | Unidade de exibição no catálogo; `units` da API só verifica; teste com fixture |
| R-07 | **Regiões na mesma célula ou em células vizinhas** comunicadas como cidades ([FC-08](#fc-08)) | Alta (Sorocaba × São Paulo) | Médio | `same_grid_cell`; texto da célula; revisar o catálogo (D-07) |
| R-08 | **Duas vozes simultâneas difíceis de separar** | Média | Médio | Pan ±0,7, timbres distintos, modo A/B isolado, descrição; modo intercalado como opção (Q-07) |
| R-09 | **Mudança na experiência sonora já testada** (Hz linear → oitavas; 130–620 Hz → 262–1047 Hz) | Certa | Médio | Decisão D-11 explícita; texto atualizado em todas as fontes únicas; escuta com usuários |
| R-10 | **Transport global compartilhado** com a imagem | Certa | Médio | `transportOwner` com teste; um dono por vez |
| R-11 | **Lacunas na camada GIBS** e unidade em K ([FC-09](#fc-09)) | Certa | Baixo | Tratar 404; legenda convertida; texto de lacuna |
| R-12 | **Falha de WebGL2 derruba `/explore`** (A-07) | Média | Alto | Pré-requisito da Etapa 5; recomendável já na Etapa 1 com `errorElement` na rota |
| R-13 | **Re-render por passo** pesado com séries longas (até 550+ meses) | Baixa | Baixo | Memoizar `chartData`; só `currentIndex` muda; tabela com `key` estável |
| R-14 | **Timers em aba em segundo plano** afetando o fim da reprodução | Baixa | Baixo | O controlador já usa timer para o fim e Transport para os passos (`playbackController.ts:165-172`) |
| R-15 | **Documentação de API desatualizada** (fim de cobertura "previous year" × dados de 2026) | Certa | Baixo | Cobertura derivada dos dados ([FC-07](#fc-07)); fixture registra a versão (`v2.10.0`) |

---

## 13. Dúvidas e decisões pendentes

As decisões **D-01 a D-15** de [`AUDITORIA_COMPARACAO.md`](AUDITORIA_COMPARACAO.md#14-decisões-que-precisam-ser-tomadas-pelo-time) continuam válidas. A tabela abaixo diz quais bloqueiam cada etapa, com a recomendação deste relatório, e acrescenta as novas.

### 13.1 Decisões existentes que afetam este plano

| ID | Decisão | Bloqueia | Recomendação |
| --- | --- | --- | --- |
| D-05 | O que "comparar" significa | Etapa 1 (MVP) | Valores absolutos no MVP; anomalia e variação como medidas futuras ([6.3](#63-série-temporal-e-medidas)) |
| D-08 | Backend ou proxy | Etapa 1 | Não. POWER e GIBS funcionam do navegador (Fato, API) |
| D-09 | Mock em produção | Etapa 1 | Erro claro; mock só em desenvolvimento ou snapshot real rotulado |
| D-11 | Escala de altura | Etapa 3 | Oitavas, C4–C6 |
| D-12 | Som da diferença | Pós-MVP | Não no MVP |
| D-01, D-02 | Variáveis; precipitação diária ou total | Pós-MVP | `T2M` no MVP; precipitação depois, com `PRECTOTCORR_SUM` em mm/mês |
| D-04 | Camada GIBS por indicador | Etapa 5 | Mesma grandeza e fonte (MERRA-2) |
| D-06, D-07 | Ponto ou área; catálogo | Etapa 2 | Ponto; revisar pares na mesma célula ou em células vizinhas |
| D-10 | Papel da sonificação de imagem na página | Interface | Mover para depois da comparação |
| D-13 | Narração própria | Não bloqueia a comparação | A comparação não usa `speechSynthesis` |

### 13.2 Decisões e dúvidas novas

| ID | Pergunta | Opções | Recomendação | Bloqueia |
| --- | --- | --- | --- | --- |
| D-16 | Identidade de timbre das regiões no motor compartilhado | Manter seno (A) e triângulo (B), acrescentando voz triangular · usar `glass` (seno) e `piano` (sampleado) | Manter as atuais: nenhum texto, guia ou teste de usuário muda | Etapa 3 |
| Q-01 | Período padrão da comparação | 2005–2024 (atual) · últimos 20 anos completos · toda a cobertura | Últimos 20 anos completos (2006–2025 hoje) | Etapa 1 |
| Q-02 | Lista de regiões do MVP | As 5 atuais · trocar Sorocaba ou São Paulo (células vizinhas) | Manter, com aviso de célula; revisar em D-07 | Etapa 2 |
| Q-03 | Timeout e política de nova tentativa | 20 s, nova tentativa manual · tentativas automáticas | 20 s, manual (taxa não documentada) | Etapa 1 |
| Q-04 | Período de referência para anomalias | 1991–2020 · 2001–2025 (o da climatologia POWER) · configurável | Fora do MVP; calcular no cliente ([FC-12](#fc-12)) | Pós-MVP |
| Q-05 | Ano corrente incompleto | Excluir por padrão · incluir com ausentes | Excluir por padrão; permitir escolher | Etapa 1 |
| Q-06 | Cache persistente | Só memória · `localStorage` com validade | Só memória no MVP; persistente se R-03 se confirmar | Etapa 1 |
| Q-07 | Opções de escuta adicionais | Camada cinematográfica · modo intercalado · marcador de janeiro | Nenhuma no MVP; avaliar com usuários | Pós-MVP |
| Q-08 | Domínio da escala | Da comparação (atual) · fixo por indicador | Da comparação | Etapa 3 |
| Q-09 | Quais páginas do EIC associar a cada indicador | Lista curada pelo time | Curadoria do time, com revisão científica | Etapa 5 |
| Q-10 | Indicadores não implementados na interface | Esconder · mostrar como "em breve" | Esconder | Etapa 1 |
| Q-11 | Atualização da data da camada GIBS durante a reprodução | Só em pausa/seek · uma vez por ano · desligada | Pausa, seek e janeiro; desligada com `prefers-reduced-motion` | Etapa 5 |
| Q-12 | Taxa de requisições aceitável no POWER | Consultar a equipe do POWER | — | Não bloqueia |

### 13.3 Informações não confirmadas nesta análise

- **Limite de taxa** do POWER (não documentado nas páginas consultadas).
- **Unidade da legenda** de `MERRA2_Precipitation_Bias_Corrected_Monthly` (só a de temperatura foi verificada, em K).
- **Política de uso** e créditos exigidos para tiles GIBS e conteúdo do earth.gov.
- **Comportamento de VoiceOver e NVDA** com os textos novos (A-06).
- **Efeito de `time_standard: LST`** nas bordas de mês (Externo, considerado pequeno).

---

## Fontes consultadas

**Código e execução local (15/11/2026)**

- Todo o código em `src/` (working tree sobre o commit `343e4d5`), `package.json`, `tsconfig.json`, `vite.config.ts`, `scripts/test-hooks.mjs`.
- `git status` e `git diff` dos arquivos do motor em andamento.
- `npx tsc --noEmit -p .`: sem erros. `npm test`: 94 testes, 94 passando.
- Documentação do repositório: `README.md`, `docs/PENDENCIAS.md`, `docs/AUDITORIA_COMPARACAO.md`, `docs/AUDITORIA_TECNICA_ACESSIBILIDADE.md`, `docs/accessibility-audit.md`, `docs/relatorio-implementacao.md`, `src/features/sonification/SONIFICATION.md`, `src/features/guided-experience/README.md`.

**NASA POWER (chamadas reais, 15/11/2026)**

- Mensal, Manaus, 5 parâmetros, 2023–2024, com cabeçalho `Origin`: `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M&community=AG&longitude=-60.02&latitude=-3.12&start=2023&end=2024&format=JSON`
- Diária, Manaus, 01–15/11/2025: `…/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=-60.02&latitude=-3.12&start=20251101&end=20251115&format=JSON`
- Climatologia, Manaus: `…/temporal/climatology/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=-60.02&latitude=-3.12&format=JSON`
- Ano incompleto: `…/monthly/point?parameters=T2M&community=AG&longitude=-60.02&latitude=-3.12&start=2025&end=2026&format=JSON`
- Início fora da faixa (422): `…&start=1980&end=1981…`
- Comunidades `AG`, `RE`, `SB`, Londres, 2024.
- Células de grade: Sorocaba (−23,5015; −47,4526), São Paulo (−23,5505; −46,6333), (−23,40; −46,70), (−23,60; −46,60).
- Agregação: diária × mensal de `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `PRECTOTCORR_SUM`, Londres, janeiro de 2024.
- Erros: parâmetro inválido; `community` ausente. Formato CSV (cabeçalho com resolução).
- Série completa 1981–2026, 5 parâmetros, Londres (tamanho e tempo).

**NASA POWER (documentação, 15/11/2026)**

- <https://power.larc.nasa.gov/docs/services/api/>
- <https://power.larc.nasa.gov/docs/services/api/temporal/monthly/>
- <https://power.larc.nasa.gov/docs/methodology/>

**NASA GIBS (chamadas reais, 15/11/2026)**

- Capabilities: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml`
- Tile: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MERRA2_2m_Air_Temperature_Monthly/default/2024-07-01/GoogleMapsCompatible_Level6/2/1/1.png` (e as datas `2023-12-01`, `2024-05-01`, `2030-01-01`, todas 404)
- Legenda: `https://gibs.earthdata.nasa.gov/legends/MERRA2_2m_Air_Temperature_Monthly_H.svg`
- Colormap: `https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml`
- Documentação de referência: <https://nasa-gibs.github.io/gibs-api-docs/>

**Earth Information Center e SVS (15/11/2026)**

- <https://earth.gov/> (cabeçalhos, links da página inicial), `https://earth.gov/api` (404), `https://earth.gov/sitemap.xml`, `https://earth.gov/robots.txt`, `https://earth.gov/themes/agriculture`.
- `https://svs.gsfc.nasa.gov/api/40467` (cabeçalho `access-control-allow-origin`).
