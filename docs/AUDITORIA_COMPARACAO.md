# Earth Information Jukebox — Auditoria da funcionalidade de comparação

**Data:** 15/11/2026 · **Branch:** `dev` (commit `f5821b3`) mais o working tree observado durante a auditoria · **Escopo:** comparação entre regiões (seleção, dados, gráfico, sonificação, descrições acessíveis) e o que falta para usar dados reais da NASA

Este documento **complementa** o [`docs/PENDENCIAS.md`](PENDENCIAS.md) e não o substitui. As pendências de lá são citadas pelo identificador (`P-01`, `A-03`, seção 5 etc.) e não são repetidas aqui. Os problemas novos recebem o prefixo **`AC-`** (Auditoria da Comparação). Nenhum arquivo da aplicação foi alterado.

**Convenções** (as mesmas do PENDENCIAS, mais uma):

- **Fato (código):** confirmado no código ou no Git, com arquivo e linha.
- **Fato (execução):** confirmado executando código do projeto nesta auditoria (por exemplo, a fórmula das séries sintéticas).
- **Externo (não verificado aqui):** informação sobre uma API ou um produto de dados que vem de conhecimento de domínio e **não foi confirmada na documentação oficial durante esta auditoria**. Deve ser checada antes de virar decisão.
- **Hipótese**, **A verificar** e **Decisão pendente:** como no PENDENCIAS.

> **Atenção: working tree em mudança.** Durante a auditoria, outra frente de trabalho alterou arquivos do módulo de sonificação de imagem (ver [AC-14](#ac-14--trabalho-não-commitado-antecipa-decisões-em-aberto)). As linhas citadas de `ImageAnalyzer.tsx` referem-se ao commit `f5821b3`, não ao working tree. As demais linhas foram conferidas no working tree em 15/11/2026.

---

## 1. Resumo executivo

- **A comparação está completa na interface e vazia de dados reais.** Seleção, gráfico, tabela, resumo, mapa, sonificação e descrições acessíveis funcionam de ponta a ponta, mas tudo vem de `createDemoSeries` (`src/features/data/demoData.ts:56-83`). Nenhuma requisição a serviços da NASA ou da Meteomatics existe em `src/`, e o projeto não tem variáveis de ambiente (`.env*` inexistentes; `src/vite-env.d.ts` só referencia os tipos do Vite). Isso confirma o PENDENCIAS.
- **As séries sintéticas não são "plausíveis", como o PENDENCIAS afirma (seção 7). Elas ensinam padrões falsos.** Executando a fórmula (Fato, execução): Nova York e Londres têm o mês mais quente em **novembro** e o mais frio em **maio**; São Paulo e Manaus têm o mais quente em **maio**. Todas as regiões têm o **mesmo ciclo de chuva** (pico em maio, mínimo em novembro) e todas **aquecem cerca de 0,7 °C** e ficam mais chuvosas entre 2005 e 2024, porque a tendência está embutida na fórmula. Em uma demonstração, o público ouve e lê conclusões que a fórmula fabricou ([AC-01](#ac-01--séries-sintéticas-com-sazonalidade-errada-e-tendência-embutida)).
- **O que o pedido desta auditoria pressupõe não existe no projeto:** imagens térmicas, imagens ou dados de precipitação do GPM IMERG, MODIS LST e Meteomatics não aparecem no código, no README, no PENDENCIAS nem no histórico do Git. A única imagem é um PNG local que, pela aparência, é **muito provavelmente uma visualização de concentração de CO₂**, não de temperatura (Hipótese, [AC-10](#ac-10--a-imagem-de-demonstração-provavelmente-não-é-térmica)). Esse é o principal sinal de lacuna de comunicação entre o que se espera e o que foi construído ([AC-09](#ac-09--requisitos-de-imagens-térmicas-imerg-modis-e-meteomatics-não-documentados)).
- **A sonificação da comparação usa altura linear em hertz** (`SonificationPlayer.tsx:88-89`). O próprio `SONIFICATION.md` justifica a escala em oitavas na sonificação de imagem por ser perceptivamente proporcional. Na comparação, a mesma diferença de valor soa menor nos valores altos do que nos baixos ([AC-02](#ac-02--altura-linear-em-hertz-distorce-a-percepção-das-diferenças)).
- **Imagem e valor numérico precisam ser fontes separadas.** O NASA GIBS entrega visualizações (o próprio PENDENCIAS registra isso, seção 4). Extrair temperatura ou chuva dos pixels de uma imagem seria um método falho. A comparação deve usar séries numéricas (NASA POWER, já verificado no PENDENCIAS) e tratar imagens como contexto, salvo decisão explícita em contrário.
- **A arquitetura permite trocar o mock sem reescrever os componentes**, porque gráfico, player e descrições recebem `RegionSeries` por props. Mas falta a camada assíncrona (P-02), a série é gerada em dois lugares (P-15), o código acessa os pontos pelo índice e pode quebrar com séries de tamanhos diferentes ([AC-06](#ac-06--acesso-por-índice-quebra-com-séries-de-tamanhos-diferentes)), e não existe backend para guardar credenciais de serviços que as exigem ([AC-13](#ac-13--não-há-onde-guardar-credenciais-nem-contornar-cors)).
- **Não existe definição escrita do que "comparar" significa** (valores absolutos, anomalias, ciclo sazonal ou diferença A − B), nem critérios de aceite para a comparação. Essa é a decisão que mais influencia gráfico, cálculos, som e textos ([AC-16](#ac-16--não-existe-definição-do-que-comparar-significa)).
- **Primeira tarefa recomendada:** uma fatia vertical com temperatura do ar (`T2M`) do NASA POWER nas 5 regiões atuais, precedida de três decisões curtas. Ver a [Recomendação para o próximo ciclo de desenvolvimento](#recomendação-para-o-próximo-ciclo-de-desenvolvimento).

## 2. Estado atual da aplicação

### 2.1 Fluxo da comparação (Fato, código)

```
demoData.regions (5 pontos fixos)
        │  RegionSelector (2 <select>)  →  comparisonStore.setRegion
        ▼
comparisonStore { regionA, regionB, indicator, startYear, endYear }
        │
        ├─ ExplorePage.tsx:16-25 ── createDemoSeries(A) / createDemoSeries(B)  (síncrono, useMemo)
        │        ├─ ComparisonChart   (gráfico, resumo, tabela, diferença A − B)
        │        ├─ SonificationPlayer (Tone.Synth, setTimeout, 1 nota por mês por região)
        │        └─ ScientificExplanation (textos fixos por indicador)
        ├─ EarthMap (OpenStreetMap + 2 marcadores pontuais)
        └─ ScreenReaderGuide.tsx:106-118 ── createDemoSeries de novo (P-15)

ImageSonification (imagem local ou enviada) ── não lê nada do store (PENDENCIAS 5.1)
```

### 2.2 O que mudou desde o PENDENCIAS

O PENDENCIAS analisou o commit `0a96b35`. Desde então:

| Mudança | Onde | Efeito na comparação |
| --- | --- | --- |
| Commit `f5821b3` (README) | `README.md` | Nenhum no código |
| `playbackController.ts` modificado: `prepare()` e `onEnded` | `engine/playbackController.ts:23, 50, 160` (working tree) | Nenhum; serve à sonificação de imagem em sequência |
| Novos arquivos não commitados: `sequencePlayer.ts`, `narrationLayer.ts`, `describeImage.ts`, `collection/`, `hooks/`, `ImageCollectionList.tsx`; `ImageAnalyzer.tsx` e `index.css` modificados | `src/features/sonification/` | Nenhum na comparação. Introduzem coleção de imagens e narração por voz sintetizada ([AC-14](#ac-14--trabalho-não-commitado-antecipa-decisões-em-aberto)) |

| Scripts `test` e `typecheck`, `scripts/test-hooks.mjs` e três arquivos `*.test.ts` (não commitados) | `package.json`; `src/features/sonification/` | Nenhum; os testes cobrem só a sonificação de imagem ([AC-19](#ac-19--nenhum-teste-cobre-a-comparação)) |

O TypeScript compila sem erros com o working tree observado no início da auditoria (`tsc --noEmit`, Fato, execução). O projeto continua sem linter, e nenhum teste cobre a comparação.

## 3. Inventário de funcionalidades da comparação

Classificação: **Real**, **Parcial**, **Mockada**, **Ausente**, **A verificar**.

| Funcionalidade | Classificação | Evidência | Observação |
| --- | --- | --- | --- |
| Seleção de duas regiões | Mockada | `RegionSelector.tsx:34-45`; `demoData.ts:3-27` | Lista fixa de 5 cidades; coordenadas escritas à mão, sem fonte registrada |
| Identidade da região (id, metadados) | Mockada | `src/types/data.ts:1-7` | Só `id`, `name`, `country`, `lat`, `lon`. Sem tipo (ponto ou área), sem fonte |
| Impedir A = B | Ausente | `RegionSelector.tsx:38` | É possível comparar uma região com ela mesma ([AC-07](#ac-07--a-mesma-região-pode-ser-a-e-b)) |
| Indicadores (temperatura, precipitação) | Mockada | `demoData.ts:29-44` | Nomes seguem o POWER; unidade de precipitação errada (P-03) |
| Período | Mockada | `ComparisonControls.tsx:42, 113, 122`; `comparisonStore.ts:52-53` | Fixo em 2005–2024 (P-06) |
| Séries mensais | Mockada | `demoData.ts:56-83` | Fórmula com sazonalidade errada e tendência embutida ([AC-01](#ac-01--séries-sintéticas-com-sazonalidade-errada-e-tendência-embutida)) |
| Consulta independente das duas regiões | Parcial | `ExplorePage.tsx:16-25` | Duas chamadas independentes, mas à fórmula, não a uma API |
| Alinhamento temporal | Mockada | `ComparisonChart.tsx:23-27`; `SonificationPlayer.tsx:93-94` | Pelo índice; só funciona porque a fórmula gera séries idênticas em tamanho (P-04, [AC-06](#ac-06--acesso-por-índice-quebra-com-séries-de-tamanhos-diferentes)) |
| Tratamento de ausentes | Ausente | — | P-04, A-03 |
| Normalização | Parcial | `SonificationPlayer.tsx:55-57, 88-89` | Só para o som: mín–máx conjunto das duas regiões, linear em Hz ([AC-02](#ac-02--altura-linear-em-hertz-distorce-a-percepção-das-diferenças)). Gráfico usa eixo único em unidades físicas |
| Diferença mensal A − B | Parcial | `ComparisonChart.tsx:181` | Calculada de verdade, mas sobre valores sintéticos e só na tabela |
| Diferença média | Parcial | `ComparisonChart.tsx:35`; `describeSonification.ts:62` | Calculada; correta se as duas séries cobrirem os mesmos meses |
| "Variação" do primeiro ao último ano | Parcial | `ComparisonChart.tsx:43-44`; `seriesStats.ts:14-15` | Estatística frágil ([AC-04](#ac-04--variação-entre-o-primeiro-e-o-último-ano-apresentada-como-mudança)) |
| Gráfico de linhas | Parcial | `ComparisonChart.tsx:88-142` | Componente pronto; dados sintéticos |
| Tabela de dados | Parcial | `ComparisonChart.tsx:152-187` | Idem |
| Resumo textual | Parcial | `ComparisonChart.tsx:145-150` | Calculado das séries; frase "synthetic" fixa (A-04) |
| Mapa | Parcial | `EarthMap.tsx:29-56` | OpenStreetMap real; GIBS ausente (P-11); marcadores pontuais |
| Imagens térmicas | Ausente | Nenhuma referência em `src/` ou no Git | [AC-09](#ac-09--requisitos-de-imagens-térmicas-imerg-modis-e-meteomatics-não-documentados) |
| Imagens de precipitação (IMERG) | Ausente | Nenhuma referência em `src/`. O único "IMERG" do histórico está em texto do snapshot `EIC.json` (galeria SVS), nunca usado | [AC-09](#ac-09--requisitos-de-imagens-térmicas-imerg-modis-e-meteomatics-não-documentados) |
| Integração NASA POWER | Ausente | Sem `fetch` em `src/` | P-01, P-02 |
| Integração NASA GIBS | Ausente | `EarthMap.tsx:97` só menciona | P-11 |
| Integração MODIS LST | Ausente | — | — |
| Integração Meteomatics | Ausente | — | — |
| Sonificação da comparação | Parcial | `SonificationPlayer.tsx` | Motor real (Tone.js) alimentado por valores sintéticos |
| Sonificação de imagem | Parcial | `engine/` | Real como sonificação visual; sem relação com regiões nem com grandeza física (P-08, P-09) |
| Descrição acessível antes do áudio | Parcial | `describeSonification.ts:45-109` | Calculada das séries; fonte "synthetic" fixa (A-04) |
| Proveniência (fonte, versão, data de acesso) | Ausente | `src/types/data.ts` | P-02, P-13 |
| Estados de carregamento e erro | Ausente | — | A-02 |
| Validação com leitores de tela reais | A verificar | `docs/relatorio-implementacao.md` | Não executada (A-06) |

## 4. Auditoria da seleção de regiões

**Como funciona (Fato, código):** dois `<select>` com as mesmas 5 cidades (`RegionSelector.tsx:40-44`). Cada região é um ponto (centro da cidade). Os valores iniciais são Manaus e Nova York (`comparisonStore.ts:49-50`). A seleção representa **coordenadas pontuais com rótulo de cidade**, não áreas nem imagens. Nenhum identificador vem de fonte oficial (não há código IBGE, GeoNames ou similar). Os países misturam idiomas (A-05).

**Pontos críticos:**

1. **Ponto ≠ cidade ≠ célula de grade.** O PENDENCIAS já aponta que um ponto em dado de baixa resolução representa uma célula (P-05). O caso concreto: Sorocaba (−47,45°) e São Paulo (−46,63°) estão a cerca de 0,8° de longitude. **Externo (não verificado aqui):** a grade do MERRA-2, fonte declarada pelo POWER, tem 0,5° × 0,625°. Se isso se confirmar, as duas cidades caem em células adjacentes e "Sorocaba × São Paulo" compara duas células vizinhas, não duas cidades. Hoje a diferença entre elas existe só porque `regionOffsets` dá 1,2 a uma e 0,4 à outra (`demoData.ts:48-54`). **A verificar:** se o POWER devolve a célula mais próxima ou interpola. Ver [AC-08](#ac-08--regiões-próximas-podem-cair-em-células-de-grade-vizinhas).
2. **A coordenada é exibida com precisão de 0,01°** (`RegionSelector.tsx:15-19`), o que sugere uma precisão espacial que nenhuma das fontes consideradas entrega. Com dados reais, o texto deveria dizer que o valor representa uma célula de grade e qual a resolução.
3. **A mesma região pode ocupar A e B** ([AC-07](#ac-07--a-mesma-região-pode-ser-a-e-b)).
4. **Seleção por imagem como mecanismo de seleção de regiões.** A hipótese registrada no PENDENCIAS (seção 5) é selecionar a partir de imagens retornadas por APIs da NASA. A crítica:
   - **Abordagem em discussão:** a imagem seria a porta de entrada e a região viria dela.
   - **Por que é limitada:** a imagem é uma *representação* (uma camada, uma data, uma paleta). A região é uma *identidade geográfica*. Imagens curadas (SVS) não têm coordenadas (PENDENCIAS, seção 4). Imagens GIBS têm coordenadas porque quem pede define o recorte, ou seja, a região precisa existir **antes** da imagem. Partir da imagem inverte essa dependência.
   - **Abordagem recomendada:** separar as duas coisas. A região (ponto ou área, com fonte das coordenadas) é a chave. Imagens e séries são consultadas *a partir* dela. A pergunta da seção 5 do PENDENCIAS deixa de ser "regiões **ou** imagens" e passa a ser "qual a identidade geográfica, e quais representações (série numérica, imagem de contexto) são derivadas dela".
   - **Consequência de não corrigir:** sem coordenadas não há série numérica. A comparação vira comparação de aparências visuais, que não tem significado científico quando as imagens não compartilham camada, data e paleta (PENDENCIAS 5.5).

## 5. Auditoria das imagens térmicas e de precipitação

### 5.1 O que existe

| Pergunta | Resposta |
| --- | --- |
| De onde vêm as imagens? | Só existe `src/assets/refence.png` (2556 × 1430), importado em `ImageAnalyzer.tsx:3` (HEAD) e, no working tree, em `collection/useImageCollection.ts`. Mais imagens enviadas pelo usuário. |
| Reais, estáticas, geradas ou placeholders? | Estática, local, sem proveniência registrada (P-08). |
| Consulta por data e localização? | **Ausente.** |
| Integração com GIBS ou outra fonte? | **Ausente.** |
| Representa temperatura da superfície ou do ar? | **Nenhuma das duas, provavelmente.** Ver [AC-10](#ac-10--a-imagem-de-demonstração-provavelmente-não-é-térmica). |
| Os valores da comparação vêm das imagens? | **Não.** A comparação usa só as séries sintéticas. A imagem alimenta outra sonificação, que mede brilho e cor, não grandeza física (`ImageAnalyzer.tsx:241-246`, HEAD). |
| Existe GPM IMERG? | **Ausente.** |
| Taxa ou acumulado? | Não se aplica a imagens. Nas séries: o rótulo diz "acumulado mensal, mm/month", mas o parâmetro `PRECTOTCORR` do POWER é média diária em mm/day (P-03). |
| Diferença entre visual e numérico? | Hoje não há imagem de precipitação. O risco é futuro: ver 5.3. |

### 5.2 O que a imagem de demonstração provavelmente é

Inspecionando a imagem: projeção global equirretangular, norte para cima, com vermelhos intensos em quase todo o hemisfério norte, faixas amarelas e ciano nos trópicos, azul profundo no hemisfério sul e redemoinhos de transporte atmosférico. O texto de interface já menciona CO₂ ao avisar que as cores não são interpretadas (`ImageAnalyzer.tsx:242`, HEAD).

**Hipótese:** é um quadro de uma visualização de concentração de CO₂ simulada por modelo (no estilo das animações GEOS-5 do NASA GMAO). Não é imagem térmica. **A verificar** com quem adicionou a imagem.

Se for CO₂, um usuário que a tome por "imagem térmica" concluiria que o hemisfério norte é mais quente que os trópicos, o contrário da realidade. Isso reforça por que a interface acerta ao não interpretar as cores, e por que **imagens não devem ser fonte de valores**.

### 5.3 GIBS, MODIS LST e IMERG: o que cada um pode e não pode fazer

| Fonte | Serve para | Não serve para | Status |
| --- | --- | --- | --- |
| **GIBS** | Imagem de contexto por recorte (BBOX) e data (`TIME`), já documentado no PENDENCIAS | Valores numéricos. A documentação descreve os produtos como visualizações, não dados calibrados (PENDENCIAS, seção 4) | Verificado no PENDENCIAS |
| **Inverter a paleta de uma imagem GIBS** | — | Recuperar valores confiáveis: a paleta é discreta, as bordas são reamostradas e a compressão altera cores. No máximo, uma faixa de valores por classe de cor | **Externo (não verificado aqui):** a GIBS publica mapas de cores por camada. P-09 está como "A verificar" |
| **MODIS LST** | Temperatura da **superfície** (pele radiativa), não do ar | Comparar com `T2M`. **Externo (não verificado aqui):** produto só em céu claro (muitas lacunas em regiões nubladas como Manaus), horários fixos de passagem do satélite, valores em kelvin com fator de escala, versões diárias, de 8 dias e mensais | — |
| **GPM IMERG** | Precipitação por satélite em grade fina | **Externo (não verificado aqui):** cobertura plena só entre latitudes médias, acesso numérico via GES DISC com login Earthdata, unidade dos produtos mensais em taxa (mm/h), outra armadilha do tipo P-03 | — |
| **NASA POWER** | Séries mensais por ponto: `T2M` (ar a 2 m) e precipitação (`PRECTOTCORR` em mm/day; `PRECTOTCORR_SUM` total) | Imagens; resolução fina | Verificado no PENDENCIAS (chamada real) |

**Conclusão:** GIBS sozinho **não** fornece os números da comparação. Ele pode ser combinado com uma fonte numérica (POWER, ou IMERG e MODIS LST por serviços de dados) para que imagem e série mostrem a mesma variável, no mesmo lugar e no mesmo período. Mas o número sempre vem da fonte numérica.

## 6. Auditoria das séries temporais e dos cálculos

| Pergunta | Resposta | Evidência |
| --- | --- | --- |
| Os gráficos usam dados reais? | Não | `ExplorePage.tsx:16-25` |
| As duas regiões são consultadas independentemente? | Sim, em duas chamadas, mas à fórmula | `ExplorePage.tsx:16-25` |
| Mesma unidade, período e resolução? | Por construção, sim. Com dados reais isso não é garantido, e o código não verifica | `demoData.ts:82`; nenhuma validação |
| Normalização? | Só no som, mín–máx conjunto e linear em Hz | `SonificationPlayer.tsx:55-57, 88-89` |
| Ausentes tratados? | Não | P-04 |
| Diferenças calculadas ou simuladas? | Calculadas de verdade, sobre valores simulados | `ComparisonChart.tsx:35, 181` |

### Problemas encontrados

- **[AC-01](#ac-01--séries-sintéticas-com-sazonalidade-errada-e-tendência-embutida) Sazonalidade errada e tendência embutida.** Resultado da execução da fórmula (média 2005–2024 por mês):

  | Região | Indicador | Mês mais alto (sintético) | Mês mais baixo (sintético) | 2024 − 2005 | Realidade esperada (conhecimento geral) |
  | --- | --- | --- | --- | --- | --- |
  | Nova York | T2M | Novembro (22,0 °C) | Maio (5,9 °C) | +0,69 °C | Mais quente em julho, mais frio em janeiro |
  | Londres | T2M | Novembro (19,5 °C) | Maio (3,5 °C) | +0,78 °C | Mais quente em julho, mais frio em janeiro |
  | São Paulo | T2M | Maio (23,3 °C) | Novembro (14,9 °C) | +0,69 °C | Mais quente em jan./fev., mais frio em jun./jul. |
  | Manaus | T2M | Maio (30,5 °C) | Novembro (22,2 °C) | +0,68 °C | Amplitude anual pequena (poucos graus), não ~8 °C |
  | Todas | Precipitação | Maio | Novembro | +8,7 a +10,9 | Ciclos diferentes por região; em São Paulo o verão é a estação chuvosa |

  Causa: `season = sin(((month - 1) / 12) * 2π)` (`demoData.ts:68`) tem pico no índice 4 (maio) para todas as regiões. Só o sinal da amplitude muda com o hemisfério (`:72`), e a precipitação ignora o hemisfério (`:73`). A tendência `(year - 2005) * 0.035` (ou `0.45`) é igual para todas (`:69`).
- **[AC-04](#ac-04--variação-entre-o-primeiro-e-o-último-ano-apresentada-como-mudança) Comparação do primeiro com o último ano.** O resumo diz "Its 2024 average is +X compared with 2005" (`ComparisonChart.tsx:43-44`). Duas médias anuais isoladas são muito sensíveis à variabilidade de um ano para o outro, e com a fórmula atual o resultado é sempre positivo.
- **[AC-05](#ac-05--unidade-lida-de-duas-fontes-diferentes) Unidade de duas fontes.** O gráfico e a tabela usam `seriesA.unit` (`ComparisonChart.tsx:32`). A descrição lida antes do áudio usa `indicators[...].unit` (`describeSonification.ts:52`). Hoje coincidem. Com unidade vinda da API (como pede P-07), podem divergir.
- **[AC-06](#ac-06--acesso-por-índice-quebra-com-séries-de-tamanhos-diferentes) Acesso por índice.** Amplia P-04: além de desalinhar, o player quebra se B for mais curta que A (`seriesB.data[index].value` em `SonificationPlayer.tsx:94` e `:160` lança `TypeError`). Se A for mais curta, os meses finais de B somem do gráfico e da tabela sem aviso, porque o laço percorre só `seriesA.data` (`ComparisonChart.tsx:23`).
- **Arredondamento e corte do mock.** `Math.max(0, value)` vale também para temperatura (`demoData.ts:77`). Hoje não afeta as 5 cidades, mas impede temperaturas negativas se o mock for usado como fallback para lugares frios ([AC-18](#ac-18--o-mock-corta-temperaturas-negativas)).

## 7. Auditoria da sonificação

### 7.1 Sonificação da comparação (`SonificationPlayer.tsx`)

| Pergunta | Resposta |
| --- | --- |
| O áudio vem dos dados consultados? | Sim, dos mesmos `seriesA`/`seriesB` do gráfico (`SonificationPlayer.tsx:93-94`). Hoje esses dados são sintéticos. |
| Há valores mockados alimentando o Tone.js? | Sim, todos: a única origem é `createDemoSeries`. Não há constantes de dados no player. |
| A relação entre valores e parâmetros sonoros é preservada? | **Parcialmente.** A ordem é preservada (maior valor, nota mais aguda) e a escala é comum às duas regiões. A proporcionalidade não é preservada ([AC-02](#ac-02--altura-linear-em-hertz-distorce-a-percepção-das-diferenças)). |
| A comparação sonora representa as diferenças? | **Indiretamente.** As duas notas tocam juntas e a diferença vira um intervalo entre elas. Não há modo que sonifique A − B ([AC-03](#ac-03--o-som-não-representa-a-diferença-entre-as-regiões)). |

- **[AC-02](#ac-02--altura-linear-em-hertz-distorce-a-percepção-das-diferenças) Altura linear em hertz.** `frequency = lowHz + norm × (highHz − lowHz)`, de 130 a 620 Hz (`SonificationPlayer.tsx:88-89`). A percepção de altura é aproximadamente logarítmica. A metade inferior dos valores ocupa ~1,5 oitava (130 → 375 Hz) e a metade superior ~0,7 oitava (375 → 620 Hz). A mesma diferença de 1 °C soa duas vezes "maior" nos valores baixos. A sonificação de imagem faz o certo (`dataMapper.ts:48-51`), e o `SONIFICATION.md` justifica: "Linear in octaves, so equal luma differences give equal perceived pitch intervals". As duas sonificações seguem regras opostas, e o texto da comparação ("equal values sound at equal pitch", `describeSonification.ts:95`) é verdadeiro mas não cobre a distorção das diferenças.
- **Normalização conjunta.** Com Manaus (temperatura quase constante) contra Londres (amplitude grande), Manaus ocupa uma faixa estreita de altura e a variação dela fica quase inaudível. Isso é consequência legítima de uma escala comum, mas precisa ser uma escolha consciente ([AC-16](#ac-16--não-existe-definição-do-que-comparar-significa)).
- **Temporização por `setTimeout` controlado pelo estado React** (`SonificationPlayer.tsx:99-115`), enquanto a sonificação de imagem usa o relógio do Tone.js. **Externo (não verificado aqui):** navegadores reduzem timers em abas em segundo plano. Impacto baixo; registrar como diferença entre os dois motores.
- **P-14 continua válido** (`SonificationPlayer.tsx:88-89`).

### 7.2 Sonificação de imagem

Sem relação com a comparação (PENDENCIAS 5.1). Declara corretamente que não interpreta cores como grandeza física. O trabalho em andamento acrescenta coleção de imagens e narração por voz sintetizada ([AC-14](#ac-14--trabalho-não-commitado-antecipa-decisões-em-aberto)), sem fonte NASA. O motor é bem modularizado. O ponto de calibração indicado em `SONIFICATION.md` (entre `imageAnalyzer` e `dataMapper`) continua sendo o lugar certo, se um dia houver dado calibrado. Mas, pela seção 5.3, a recomendação é não depender de pixels para valores.

**Risco de experiência ([AC-20](#ac-20--sonificação-de-imagem-no-topo-da-página-de-comparação)):** a sonificação de imagem é a primeira seção da página de comparação (`ExplorePage.tsx:56`, "00 / IMAGE SONIFICATION"), antes da escolha das regiões. Quem chega sem ler o aviso pode supor que a imagem representa as regiões selecionadas.

## 8. Auditoria de acessibilidade

| Pergunta | Resposta | Evidência |
| --- | --- | --- |
| As descrições representam os dados ou são textos fixos? | **Dados**, exceto a frase sobre a fonte | `ComparisonChart.tsx:148`; `describeSonification.ts:66-107` (a fonte "synthetic" em `:105` é fixa, A-04) |
| Acompanham as mudanças de seleção? | Sim: textos recalculados e um anúncio `role="status"` por mudança | `ComparisonControls.tsx:16-19, 130-132`; `SonificationPlayer.tsx:119-135` |
| Gráfico, tabela, imagens e descrições são consistentes? | Gráfico, tabela, resumo e descrição do som, sim (mesmas séries). Ressalvas: unidade de duas fontes ([AC-05](#ac-05--unidade-lida-de-duas-fontes-diferentes)); o guia gera as séries de novo (P-15) | — |
| Metadados científicos disponíveis para pessoas cegas ou com baixa visão? | **Não.** Faltam fonte, produto, versão, resolução espacial (o que o "ponto" representa), padrão de tempo, data de acesso e convenção de ausentes | `src/types/data.ts`; A-04 |

**Pontos novos:**

- **A descrição de "como os valores viram som" precisará mudar** se a escala de altura mudar ([AC-02](#ac-02--altura-linear-em-hertz-distorce-a-percepção-das-diferenças)). Hoje ela é gerada de `COMPARISON_MAPPING` (`describeSonification.ts:12-20`), o que é bom: há uma única fonte de verdade para o mapeamento e para o texto.
- **Os textos tratam a coordenada como lugar exato** ("Region A: Manaus, Brasil, at 3.12° S, 60.02° W", `i18n/en.ts:40-41`). Com dados de grade, o leitor de tela deveria informar que o valor é de uma célula de N km.
- **Conflito de princípio ([AC-14](#ac-14--trabalho-não-commitado-antecipa-decisões-em-aberto)):** o `narrationLayer.ts` usa `speechSynthesis`, e o README do guia define que "o leitor de tela é o único narrador" (`guided-experience/README.md:12`). Esse é um critério de aceite registrado como "Atendido" (`:138`). Duas vozes ao mesmo tempo (leitor de tela e síntese do navegador) é um problema conhecido de acessibilidade. Precisa de decisão.

## 9. Problemas técnicos e possíveis métodos falhos

Cada item segue o formato pedido: abordagem atual, por que é limitada, abordagem recomendada e consequência de não corrigir. As recomendações são propostas, não decisões.

#### AC-01 — Séries sintéticas com sazonalidade errada e tendência embutida

- **Abordagem atual:** `createDemoSeries` com seno de fase única, sinal da amplitude por hemisfério e tendência linear igual para todos (`demoData.ts:68-73`).
- **Por que é limitada:** produz meses quentes e frios trocados, chuva com o mesmo ciclo em todo o planeta e "aquecimento" garantido (Fato, execução, seção 6). O PENDENCIAS classifica as séries como "padrões plausíveis" (`PENDENCIAS.md:354`), o que não se sustenta.
- **Recomendação:** substituir pelo POWER o quanto antes (P-01). Enquanto o mock existir, decidir se ele é corrigido (fase por hemisfério, tendência zero) ou trocado por um snapshot real gravado do POWER. **Decisão pendente.**
- **Consequência:** demos e testes com usuários comunicam conclusões climáticas falsas, inclusive pelo som ("a melodia sobe"). Testes de acessibilidade validam textos sobre padrões inexistentes.

#### AC-02 — Altura linear em hertz distorce a percepção das diferenças

- **Abordagem atual:** mapeamento linear 130–620 Hz (`SonificationPlayer.tsx:88-89`).
- **Por que é limitada:** a percepção de altura é aproximadamente logarítmica. A mesma diferença física soa maior nos valores baixos. O projeto já documenta a regra certa para a outra sonificação (`SONIFICATION.md`; `dataMapper.ts:48-51`).
- **Recomendação:** escala linear em oitavas (`f = f0 · 2^(k·norm)`), atualizando `COMPARISON_MAPPING` e o texto gerado. **Decisão pendente**, porque muda a experiência sonora já testada.
- **Consequência:** ouvintes avaliam errado a magnitude das diferenças entre regiões e entre meses, justamente a tarefa central da comparação.

#### AC-03 — O som não representa a diferença entre as regiões

- **Abordagem atual:** duas notas simultâneas (ou uma região por vez). A diferença A − B existe só na tabela (`ComparisonChart.tsx:181`) e como média no resumo.
- **Por que é limitada:** com valores próximos, as duas notas se fundem ou batem. Com valores distantes, o ouvinte precisa estimar o intervalo. Não há forma auditiva direta de perceber "quanto A supera B neste mês".
- **Recomendação:** avaliar um modo "diferença" (uma voz cuja altura ou cujo sinal representa A − B, com referência audível no zero). **Decisão pendente**, ligada a [AC-16](#ac-16--não-existe-definição-do-que-comparar-significa).
- **Consequência:** a comparação sonora fica mais fraca que a visual e a tabular.

#### AC-04 — "Variação" entre o primeiro e o último ano apresentada como mudança

- **Abordagem atual:** média de `slice(-12)` menos média de `slice(0, 12)` (`seriesStats.ts:14-15`), em frase de resumo (`ComparisonChart.tsx:43-44`).
- **Por que é limitada:** dois anos isolados dependem do acaso de cada ano. Com o POWER, os primeiros 12 itens podem nem ser um ano completo (chave anual `13`, ausentes, P-04).
- **Recomendação:** separar a definição temporal (por data) e escolher uma estatística defensável, como médias de períodos mais longos ou inclinação de regressão com aviso de que não é atribuição de causa. **Decisão pendente.**
- **Consequência:** frase de resumo com aparência de tendência climática, sem base estatística.

#### AC-05 — Unidade lida de duas fontes diferentes

- **Abordagem atual:** `series.unit` no gráfico, `indicators[id].unit` na descrição do som.
- **Recomendação:** uma única fonte (a unidade que acompanha a série, validada contra o catálogo de variáveis).
- **Consequência:** descrição lida antes do áudio com unidade diferente da exibida.

#### AC-06 — Acesso por índice quebra com séries de tamanhos diferentes

- **Abordagem atual:** `seriesB.data[index].value` (`SonificationPlayer.tsx:94, 160`); laço só sobre A (`ComparisonChart.tsx:23`).
- **Recomendação:** alinhar por data em um passo explícito antes de chegar aos componentes. O resultado deve ser uma estrutura `{ date, a: number | null, b: number | null }[]` consumida por gráfico, tabela, som e descrições. Amplia P-04.
- **Consequência:** erro em tempo de execução ao primeiro mês ausente ou período diferente entre fontes.

#### AC-07 — A mesma região pode ser A e B

- **Abordagem atual:** sem restrição (`RegionSelector.tsx:38`).
- **Recomendação:** impedir ou avisar. **Decisão pendente** (pode ser útil para comparar períodos no futuro).
- **Consequência:** comparação vazia, com diferença zero, apresentada como resultado.

#### AC-08 — Regiões próximas podem cair em células de grade vizinhas

- **Abordagem atual:** pontos de centro de cidade (`demoData.ts:3-27`).
- **Por que é limitada:** ver seção 4, item 1. Amplia P-05 com um caso concreto do catálogo atual.
- **Recomendação:** registrar no catálogo de regiões a resolução da fonte e exibi-la. Evitar pares de regiões mais próximos que a resolução, ou declarar o limite.
- **Consequência:** diferenças entre "cidades" que são artefatos da grade.

#### AC-09 — Requisitos de imagens térmicas, IMERG, MODIS e Meteomatics não documentados

- **Abordagem atual:** nenhuma. O código e os documentos tratam de temperatura do ar e precipitação do POWER, de GIBS como mapa e de SVS/EPIC como possíveis fontes de imagem.
- **Por que é limitada:** se o time espera "comparar imagens térmicas e de precipitação" usando MODIS LST, IMERG e Meteomatics, essa expectativa nunca chegou ao README, ao PENDENCIAS nem ao código.
- **Recomendação:** registrar o escopo de variáveis e fontes em um documento de requisitos curto, com critérios de aceite ([seção 14](#14-decisões-que-precisam-ser-tomadas-pelo-time), D-01 a D-04).
- **Consequência:** a implementação segue em uma direção e a expectativa em outra; retrabalho no fim do ciclo.

#### AC-10 — A imagem de demonstração provavelmente não é térmica

- **Abordagem atual:** PNG local sem proveniência (P-08).
- **Por que é limitada:** pela aparência, é uma visualização de CO₂ (Hipótese, seção 5.2). Se alguém a apresentar como imagem térmica, a leitura será errada.
- **Recomendação:** confirmar a origem com quem a adicionou, registrar créditos e não usá-la como exemplo de temperatura.
- **Consequência:** erro científico de apresentação.

#### AC-11 — Risco de confundir temperatura da superfície com temperatura do ar

- **Abordagem atual:** a única temperatura é `T2M`, descrita como "air temperature at 2 meters" (`demoData.ts:35`). Correta.
- **Por que é um risco:** se forem acrescentadas "imagens térmicas" do MODIS LST ao lado das séries `T2M`, a interface vai mostrar duas grandezas diferentes com o mesmo nome popular ("temperatura"). **Externo (não verificado aqui):** a LST pode diferir muito da temperatura do ar, especialmente de dia em superfícies urbanas e secas.
- **Recomendação:** no catálogo de variáveis, `T2M` e LST como variáveis distintas, com nomes, unidades e descrições distintos. Nunca comparar a imagem LST de uma região com a série `T2M` de outra. O texto do POWER deve dizer "temperatura do ar" de forma explícita.
- **Consequência:** conclusões incorretas e descrições acessíveis enganosas.

#### AC-12 — Armadilhas de unidade além do POWER

- **Abordagem atual:** unidade escrita à mão (P-03, P-07).
- **Por que é limitada:** o problema de P-03 se repete em outras fontes. **Externo (não verificado aqui):** IMERG mensal em taxa (mm/h), MODIS LST em kelvin com fator de escala.
- **Recomendação:** um contrato de variável (id, grandeza, unidade de origem, unidade exibida, conversão, agregação temporal) e testes de conversão por fonte.
- **Consequência:** erros de ordem de grandeza (fator 24, 30 ou 730) propagados para gráfico, texto e som.

#### AC-13 — Não há onde guardar credenciais nem contornar CORS

- **Abordagem atual:** aplicação Vite estática (Figma Make), sem backend e sem `.env`.
- **Por que é limitada:** **Externo (não verificado aqui):** a Meteomatics exige credenciais de conta; os dados numéricos de IMERG e MODIS (GES DISC, AppEEARS, OPeNDAP) exigem login Earthdata. Credenciais num bundle de frontend ficam públicas. **A verificar:** se POWER e GIBS aceitam chamadas diretas do navegador (CORS). O GIBS é usado por mapas web, o que sugere que sim, mas isso não foi confirmado.
- **Recomendação:** decidir se o projeto pode ter um proxy (função serverless ou similar) ou se fica restrito a fontes públicas sem autenticação (POWER, GIBS) e a dados pré-processados estáticos. **Decisão pendente**, que define o que é viável.
- **Consequência:** integrar Meteomatics, IMERG numérico ou MODIS numérico sem essa decisão leva a vazamento de credenciais ou a uma integração que não funciona em produção.

#### AC-14 — Trabalho não commitado antecipa decisões em aberto

- **Abordagem atual (working tree, 15/11/2026):** coleção de imagens ordenável com upload (`collection/`, `ImageCollectionList.tsx`), reprodução em sequência (`sequencePlayer.ts`) e narração com `speechSynthesis` (`narrationLayer.ts`). Nenhuma imagem vem de API; a imagem demo segue como item fixo.
- **Por que é um problema de processo, não de código:** o código é cuidadoso, mas (a) caminha na direção "imagens" antes da decisão da seção 5 do PENDENCIAS, e (b) contraria uma regra registrada (`guided-experience/README.md:12, 138`) sem atualizá-la.
- **Recomendação:** antes de commitar, decidir se a narração própria substitui ou complementa a regra "leitor de tela é o único narrador", e registrar o papel da coleção de imagens em relação à comparação. **Decisão pendente.**
- **Consequência:** duas vozes simultâneas para quem usa leitor de tela; documentação de acessibilidade desatualizada; esforço numa experiência paralela à comparação.

#### AC-15 — Relatório de implementação desatualizado

- `docs/relatorio-implementacao.md:16` diz "Nada foi commitado", mas as entregas estão nos commits `0a96b35` e `f5821b3`. Baixo impacto; indica que os documentos não são revisados a cada commit.

#### AC-16 — Não existe definição do que "comparar" significa

- **Abordagem atual:** valores absolutos lado a lado, escala sonora comum, diferença mensal na tabela e diferença média no resumo.
- **Por que é limitada:** "comparar Manaus e Londres" pode significar comparar níveis (Manaus é mais quente), comparar ciclos sazonais (fases opostas e amplitudes diferentes), comparar anomalias (qual aqueceu mais em relação à própria média) ou comparar a diferença ao longo do tempo. Cada leitura pede outra normalização, outro gráfico, outro som e outro texto. Nada disso está escrito.
- **Recomendação:** definir a pergunta principal da comparação (D-05) e os critérios de aceite antes de mexer em gráfico e som.
- **Consequência:** decisões de normalização tomadas no código, sem validação; textos que respondem a uma pergunta que ninguém fez.

#### AC-17 — Variáveis fixas e tipadas como string

- **Abordagem atual:** `indicators` é um objeto `as const` com duas chaves (`demoData.ts:29-44`). O store guarda `indicator: string` (`src/types/data.ts:24`) e os componentes fazem `as IndicatorId` em vários pontos (`ExplorePage.tsx:18, 23, 72, 77`; `ComparisonControls.tsx:20`; `ComparisonChart.tsx:31`; `describeSonification.ts:51`). Os textos de `ScientificExplanation` também são fixos.
- **Recomendação:** catálogo de variáveis tipado e independente de `demoData`, com fonte, unidade e resolução, consumido por controles, textos e serviço de dados.
- **Consequência:** cada nova variável (LST, IMERG) exige mudanças espalhadas e aumenta o risco de rótulos e unidades inconsistentes.

#### AC-18 — O mock corta temperaturas negativas

- `Math.max(0, value)` também para `T2M` (`demoData.ts:77`). Relevante só se o mock virar fallback (P-02). Baixa.

#### AC-19 — Nenhum teste cobre a comparação

- **No commit `f5821b3`:** não há script de teste no `package.json` nem arquivos de teste em `src/`. O relatório de implementação cita 71 verificações e axe-core, mas esses scripts não estão versionados. **A verificar** onde estão.
- **No working tree (15/11/2026, não commitado):** surgiram `"test": "node --import ./scripts/test-hooks.mjs --test \"src/**/*.test.ts\""` e `"typecheck"` no `package.json`, e três arquivos de teste com `node:test` (`describeImage.test.ts`, `narrationLayer.test.ts`, `sequencePlayer.test.ts`). Todos são da sonificação de imagem. **Nenhum teste cobre dados, cálculos, gráfico ou sonificação da comparação.**
- **Recomendação:** reaproveitar essa infraestrutura (sem nova dependência) para os testes da Etapa 11.
- **Consequência:** a integração com dados reais, que muda a forma dos dados, não terá rede de segurança para regressões de acessibilidade e de cálculo.

#### AC-20 — Sonificação de imagem no topo da página de comparação

- Ver seção 7.2. **Decisão pendente** sobre a posição e o papel da seção (ligada a PENDENCIAS 5.6, item 6).

## 10. Lacunas de comunicação e requisitos

| Requisito ou decisão | Documentação atual | Implementação encontrada | Lacuna |
| --- | --- | --- | --- |
| Comparar imagens térmicas entre regiões | Ausente (README, PENDENCIAS, docs) | Ausente | Expectativa não registrada (AC-09) |
| Imagens e dados de precipitação do GPM IMERG | Ausente | Ausente | Idem |
| Meteomatics como fonte | Ausente | Ausente | Papel indefinido; exige credenciais (AC-13) |
| "Temperatura" = temperatura do ar a 2 m | `demoData.ts:35`; implícito no PENDENCIAS (`T2M`) | Mock rotulado como `T2M` | Se "imagens térmicas" = LST, haverá duas grandezas com o mesmo nome (AC-11) |
| Precipitação como acumulado mensal | `demoData.ts:41-42` ("mm/month") | Mock em escala de total mensal | API devolve mm/day nesse parâmetro (P-03) |
| Seleção por regiões ou por imagens | PENDENCIAS seção 5: "Aguardando decisão" | Regiões fixas na comparação; coleção de imagens em andamento no working tree | Implementação avançando antes da decisão (AC-14) |
| Região como ponto ou área | PENDENCIAS 5.6, item 2: pendente | Ponto | Textos tratam o ponto como lugar exato (seção 8) |
| Significado de "comparar" | Ausente | Absoluto + diferença média | AC-16 |
| Critérios de aceite da comparação | Ausentes (existem só para o guia, em `guided-experience/README.md`) | — | Ninguém consegue dizer quando a comparação está "pronta" |
| Leitor de tela como único narrador | `guided-experience/README.md:12, 138` ("Atendido") | `narrationLayer.ts` usa `speechSynthesis` (não commitado) | Regra contrariada sem atualização (AC-14) |
| Escala de altura perceptivamente proporcional | `SONIFICATION.md` (só para a imagem) | Imagem: oitavas. Comparação: linear em Hz | Princípio não aplicado à comparação (AC-02) |
| Padrões do mock "plausíveis" | `PENDENCIAS.md:354` | Sazonalidade trocada e tendência fixa | Avaliação incorreta (AC-01) |
| Dados "from NASA" | `HomePage.tsx:20, 38`; `AppHeader.tsx:38` | Nenhum dado da NASA | Já em P-13; continua |
| Período 2005–2024 | `ComparisonControls.tsx:42` | Fixo | Já em P-06; sem justificativa registrada |
| Estado do trabalho | `relatorio-implementacao.md:16` ("Nada foi commitado") | Commits `0a96b35`, `f5821b3` | Documento desatualizado (AC-15) |
| Testes automatizados | `relatorio-implementacao.md:7` (71 de 71) | Nenhum teste versionado em `f5821b3`; no working tree, testes só da sonificação de imagem | As 71 verificações citadas não são reproduzíveis; a comparação não tem testes (AC-19) |
| Fallback para mock em produção | PENDENCIAS P-02: decisão pendente | — | Continua aberta |

## 11. Comparação com o documento de pendências existente

### 11.1 Já documentados e ainda não resolvidos

Todos os itens do PENDENCIAS continuam abertos. As linhas citadas lá foram conferidas e continuam válidas no working tree, exceto as de `ImageAnalyzer.tsx`, que mudou depois (ver aviso no topo).

| Itens | Situação conferida |
| --- | --- |
| P-01, P-02, P-03, P-04, P-06, P-07, P-15 | Sem mudança no código de dados (`demoData.ts`, `seriesStats.ts`, `ExplorePage.tsx`, `ScreenReaderGuide.tsx:112-113`) |
| P-05, P-11, P-13, P-14 | Sem mudança (`RegionSelector.tsx`, `EarthMap.tsx`, textos, `SonificationPlayer.tsx:88-89`) |
| P-08, P-09, P-10, P-12 | Abertos. O working tree mexe na sonificação de imagem, mas não muda a proveniência, a calibração nem os rótulos de direção (`DIRECTION_LABEL` continua "North → South") |
| A-01 a A-06 | Abertos |

### 11.2 Já documentados, mas aparentemente resolvidos

**Nenhum.** O trabalho em andamento na sonificação de imagem não resolve nenhum item do PENDENCIAS.

### 11.3 Novos problemas identificados

| ID | Título | Prioridade sugerida |
| --- | --- | --- |
| AC-01 | Séries sintéticas com sazonalidade errada e tendência embutida | Alta |
| AC-02 | Altura linear em hertz | Alta |
| AC-06 | Acesso por índice quebra com séries de tamanhos diferentes | Alta |
| AC-09 | Requisitos de imagens térmicas, IMERG, MODIS e Meteomatics não documentados | Alta |
| AC-11 | Risco de confundir LST com temperatura do ar | Alta (preventiva) |
| AC-13 | Sem lugar para credenciais; CORS a verificar | Alta |
| AC-16 | Sem definição do que "comparar" significa | Alta |
| AC-03 | Som não representa a diferença | Média |
| AC-04 | Primeiro ano × último ano | Média |
| AC-08 | Células de grade vizinhas | Média |
| AC-10 | Imagem demo provavelmente não térmica | Média |
| AC-12 | Armadilhas de unidade além do POWER | Média |
| AC-14 | Trabalho não commitado antecipa decisões | Média |
| AC-17 | Variáveis fixas e tipadas como string | Média |
| AC-19 | Nenhum teste cobre a comparação | Média |
| AC-20 | Sonificação de imagem no topo da comparação | Média |
| AC-05 | Unidade de duas fontes | Baixa |
| AC-07 | A = B permitido | Baixa |
| AC-15 | Relatório desatualizado | Baixa |
| AC-18 | Mock corta temperaturas negativas | Baixa |

### 11.4 Pendências que precisam ser reformuladas

| Item | Texto atual | Reformulação proposta | Base |
| --- | --- | --- | --- |
| PENDENCIAS seção 7, linha P-01 | "Padrões plausíveis, mas não informativos sobre os lugares" | "Padrões **incorretos**: sazonalidade trocada e tendência positiva igual para todas as regiões" | AC-01; `demoData.ts:68-73` |
| Seção 5 | "Selecionar regiões **ou** imagens" | "Definir a identidade geográfica (ponto ou área) e quais representações derivam dela (série numérica, imagem de contexto)" | Seção 4 deste relatório |
| P-04 | Desalinhamento e ausentes | Incluir o `TypeError` de `SonificationPlayer.tsx:94, 160` e o corte silencioso de meses de B | AC-06 |
| P-05 | Representatividade "A verificar" | Incluir o caso Sorocaba × São Paulo e a exibição da resolução | AC-08 |
| P-09 | Calibração via escala de cores "A verificar" | Mesmo com legenda, inverter a paleta de imagens renderizadas é impreciso; preferir fonte numérica para valores e usar a imagem como contexto | Seção 5.3 |
| P-03 | Unidade da precipitação no POWER | Generalizar para um contrato de unidade por variável e por fonte | AC-12 |
| P-11 | Camada GIBS "acompanha o indicador?" | Se acompanhar, a camada precisa mostrar a **mesma grandeza** do indicador (por exemplo, não usar LST como imagem de `T2M`) | AC-11 |

### 11.5 Questões que exigem decisão do time

As 10 questões da seção 10 do PENDENCIAS continuam válidas. As novas estão na [seção 14](#14-decisões-que-precisam-ser-tomadas-pelo-time).

## 12. Estratégia recomendada de implementação

Esta seção descreve como a comparação seria concluída. É uma proposta: as escolhas marcadas como dependentes de decisão não estão aprovadas.

**Princípios:**

1. **Identidade geográfica separada da representação.** A região é a chave; série e imagem são consultas derivadas dela.
2. **Número vem de fonte numérica; imagem é contexto.** Nenhum valor exibido, descrito ou sonificado é extraído de pixels de uma imagem de visualização.
3. **Uma série alinhada, uma fonte de verdade.** O gráfico, a tabela, o resumo, o som, o guia e a descrição acessível consomem a mesma estrutura alinhada por data, com ausentes explícitos e proveniência.
4. **Proveniência viaja com o dado.** Os textos de fonte deixam de ser fixos.
5. **Mesma variável, mesma unidade, mesma resolução nas duas regiões.** A comparação só é montada se as duas séries forem equivalentes, e a interface diz quando não forem.

### Etapa 1 — Modelo de seleção de regiões

- **O que fazer:** definir `Region` com tipo de geometria (ponto agora, área opcional), fonte das coordenadas e idioma consistente nos nomes. Manter o catálogo de 5 pontos como ponto de partida. Impedir ou sinalizar A = B.
- **Arquivos:** `src/types/data.ts`, `src/features/data/demoData.ts` (separar o catálogo em módulo próprio), `RegionSelector.tsx`, `comparisonStore.ts`, `ScreenReaderGuide.tsx`.
- **Dependências:** D-06 (ponto ou área), D-07 (catálogo).
- **Complexidade:** baixa (ponto) · alta (área, porque exige agregação espacial).
- **Riscos:** áreas exigem outro endpoint ou agregação (A verificar no POWER); geocodificação não é serviço da NASA.
- **Critérios de aceite:** as coordenadas exibidas são as mesmas usadas na requisição; a resolução da fonte aparece no texto da região; A = B tratado conforme a decisão.

### Etapa 2 — Catálogo de variáveis ambientais

- **O que fazer:** catálogo tipado (id, grandeza física, nome curto e longo, unidade de origem e exibida, conversão, agregação temporal, fonte, resolução espacial e temporal, cobertura). Separar `T2M` (ar) de qualquer LST. Resolver P-03.
- **Arquivos:** novo módulo em `src/features/data/` (sem nova dependência), `ComparisonControls.tsx`, `ScientificExplanation.tsx`, `describeSonification.ts`, `ComparisonChart.tsx`.
- **Dependências:** D-01 (lista de variáveis), D-02 (precipitação diária ou total).
- **Complexidade:** média.
- **Riscos:** variáveis com resoluções incompatíveis entre fontes.
- **Critérios de aceite:** nenhum componente faz `as IndicatorId`; unidade e nome longo batem com o bloco `parameters` do POWER (P-07); só uma fonte de unidade (AC-05).

### Etapa 3 — Integração das fontes de dados

- **O que fazer:** camada assíncrona de dados (P-02) com cancelamento, cache por (fonte, lat, lon, variável, período), estados de carregamento e erro, e proveniência. Começar pelo POWER mensal por ponto (já verificado).
- **Arquivos:** `src/features/data/`, `src/types/data.ts`, `comparisonStore.ts`, `ExplorePage.tsx`, `ScreenReaderGuide.tsx` (P-15).
- **Dependências:** D-08 (proxy ou só fontes públicas, AC-13), D-09 (fallback para mock).
- **Complexidade:** média.
- **Riscos:** CORS (A verificar); limites de taxa do POWER (A verificar); queda do serviço durante a demonstração.
- **Critérios de aceite:** trocar região, variável ou período cancela a requisição anterior; o guia e a página mostram exatamente os mesmos números; nenhuma credencial no bundle.

### Etapa 4 — Consulta de imagens e metadados

- **O que fazer:** se o time decidir usar imagens (D-03, D-04), montar a requisição GIBS a partir da região (BBOX) e da data, com camada da **mesma grandeza** da variável selecionada. Exibir legenda, data, camada e créditos. Atualizar o mapa (P-11).
- **Arquivos:** `EarthMap.tsx`; possivelmente um componente de imagem de contexto por região. A sonificação de imagem só entra se D-10 assim decidir.
- **Dependências:** Etapas 1 e 2; D-03, D-04, D-10.
- **Complexidade:** média.
- **Riscos:** camada sem dado na data escolhida (lacunas de nuvem na LST); camada de grandeza diferente da série (AC-11).
- **Critérios de aceite:** a imagem diz o que é (camada, data, unidade da legenda); nenhum número da interface vem dela; a descrição acessível é composta dos metadados, sem inventar conteúdo (A-01).

### Etapa 5 — Consulta de valores numéricos

- **O que fazer:** POWER para `T2M` e precipitação. Fontes adicionais (IMERG, MODIS LST, Meteomatics) só depois de D-01 e D-08, com serviço de dados próprio de cada uma, e nunca pela imagem.
- **Arquivos:** `src/features/data/`.
- **Dependências:** Etapa 3; D-01, D-08.
- **Complexidade:** baixa (POWER) · alta (IMERG ou MODIS numéricos, que exigem autenticação e processamento assíncrono, segundo informação externa não verificada aqui).
- **Riscos:** unidade e escala (AC-12); lacunas de céu claro na LST.
- **Critérios de aceite:** a resposta é convertida para a unidade do catálogo com teste; `-999` vira ausente; a chave anual `13` é descartada.

### Etapa 6 — Normalização e alinhamento das séries

- **O que fazer:** função pura que recebe duas séries e devolve `{ date, a, b }[]` com `null` para ausentes, mais um relatório de equivalência (mesma variável, unidade, resolução e período). Normalização para o som decidida em D-05 e D-11.
- **Arquivos:** `src/features/data/` (novo módulo puro), `seriesStats.ts`.
- **Dependências:** Etapa 5.
- **Complexidade:** média.
- **Riscos:** fontes com padrões de tempo diferentes (o POWER usa hora local, segundo o PENDENCIAS); efeito pequeno em dados mensais.
- **Critérios de aceite:** nenhum consumidor acessa `series.data[index]` diretamente; séries de tamanhos diferentes não quebram nada (AC-06).

### Etapa 7 — Cálculo das diferenças entre regiões

- **O que fazer:** diferença mensal e média só sobre meses com as duas regiões presentes, com contagem de meses usados. Substituir o "primeiro × último ano" por uma estatística decidida (AC-04). Se D-05 escolher anomalias, calcular cada uma em relação à própria climatologia.
- **Arquivos:** `seriesStats.ts`, `ComparisonChart.tsx`, `describeSonification.ts`.
- **Dependências:** Etapa 6; D-05.
- **Complexidade:** baixa a média.
- **Riscos:** frases que sugerem causa ou tendência.
- **Critérios de aceite:** cada número do resumo pode ser reproduzido a partir da tabela; o resumo informa quantos meses foram excluídos.

### Etapa 8 — Gráficos e indicadores

- **O que fazer:** gráfico com lacunas visíveis nos ausentes, eixo e unidade do catálogo, estados de carregamento e erro, proveniência dinâmica no selo (P-13). Se D-05 pedir, uma visão de diferença ou anomalia.
- **Arquivos:** `ComparisonChart.tsx`, `DataSourceBadge.tsx`, `ExplorePage.tsx`, `ComparisonControls.tsx`, `HomePage.tsx`, `AppHeader.tsx`.
- **Dependências:** Etapas 6 e 7.
- **Complexidade:** média.
- **Riscos:** o selo "DEMO DATA" continuar aparecendo com dados reais, ou o contrário (P-13).
- **Critérios de aceite:** "synthetic" só aparece quando o dado é sintético; tabela mostra "No data" nos ausentes.

### Etapa 9 — Integração com a sonificação

- **O que fazer:** player consome a série alinhada; ausentes seguem a convenção de A-03; escala de altura decidida em D-11 (recomendação: oitavas, AC-02); modo de diferença, se D-12 aprovar (AC-03); P-14 revisado com dados reais.
- **Arquivos:** `SonificationPlayer.tsx`, `describeSonification.ts`.
- **Dependências:** Etapa 6; D-11, D-12, A-03.
- **Complexidade:** média.
- **Riscos:** mudar uma experiência já testada com usuários.
- **Critérios de aceite:** a descrição antes do áudio cita os mesmos mínimo, máximo e frequências usados no som; um mês ausente nunca vira a nota mais grave.

### Etapa 10 — Descrições acessíveis

- **O que fazer:** proveniência real (fonte, produto, versão, data de acesso), resolução espacial, convenção de ausentes, anúncios de carregamento e erro (A-02, A-04). Decidir AC-14 (narração própria).
- **Arquivos:** `describeSonification.ts`, `ComparisonChart.tsx`, `ComparisonControls.tsx`, `SonificationPlayer.tsx`, `guided-experience/i18n/en.ts`, `guided-experience/README.md`.
- **Dependências:** Etapas 3, 6 e 9.
- **Complexidade:** média.
- **Riscos:** anúncios demais durante o carregamento.
- **Critérios de aceite:** nenhuma frase de proveniência fixa; o leitor de tela recebe a mesma informação que a tela.

### Etapa 11 — Testes de integração, consistência científica e acessibilidade

- **O que fazer:** versionar a suíte citada no relatório (AC-19); testes unitários das conversões de unidade, do alinhamento e dos cálculos; teste com uma resposta real gravada do POWER (Manaus 2020, já usada no PENDENCIAS) como fixture; checagem de sanidade climática (mês mais quente de Nova York em jun.–ago.); validação com VoiceOver e NVDA (A-06).
- **Arquivos:** arquivos `*.test.ts` novos junto dos módulos de dados e de sonificação da comparação, usando o script `test` com `node:test` que está surgindo no working tree (AC-19), se ele for commitado.
- **Dependências:** todas as anteriores.
- **Complexidade:** média.
- **Riscos:** testes dependentes da rede; resolver com fixtures gravadas.
- **Critérios de aceite:** testes rodam no CI ou localmente com um comando; a checagem de sanidade falharia com o mock atual (AC-01).

## 13. Plano de execução priorizado

| Ordem | Bloco | Itens | Bloqueado por |
| --- | --- | --- | --- |
| 0 | **Decisões mínimas** | D-01, D-05, D-08, D-09 (ver seção 14) | — |
| 1 | **Fatia vertical `T2M` real** | Etapas 3, 5 (só POWER e `T2M`), 6; P-02, P-04, P-15, AC-06 | D-08, D-09 |
| 2 | **Proveniência e acessibilidade dos dados reais** | Etapas 8 e 10 parciais; P-13, A-02, A-03, A-04, AC-05 | Bloco 1 |
| 3 | **Precipitação** | P-03, AC-12; Etapa 2 | D-02 |
| 4 | **Sonificação** | AC-02, AC-03, P-14; Etapa 9 | D-11, D-12; Bloco 1 |
| 5 | **Cálculos e textos** | AC-04, AC-16; Etapa 7 | D-05 |
| 6 | **Regiões** | P-05, AC-07, AC-08; Etapa 1 | D-06, D-07 |
| 7 | **Imagens de contexto** | P-08, P-11, A-01, AC-10, AC-11; Etapa 4 | D-03, D-04, D-10 |
| 8 | **Fontes adicionais** | IMERG, MODIS LST, Meteomatics | D-01, D-08 e proxy disponível |
| 9 | **Testes e validação** | AC-19, A-06; Etapa 11 | Começa no bloco 1 e acompanha os demais |
| Paralelo | **Processo** | AC-14 (antes do commit), AC-15, AC-01 (se houver demo antes do bloco 1) | — |

## 14. Decisões que precisam ser tomadas pelo time

As decisões do PENDENCIAS (seção 10) continuam abertas. Esta lista as relaciona e acrescenta as novas.

| ID | Decisão | Opções (não exaustivas) | Afeta | Relação com o PENDENCIAS |
| --- | --- | --- | --- | --- |
| D-01 | **Quais variáveis a comparação oferece?** | Só `T2M` e precipitação do POWER · acrescentar LST (MODIS) como variável separada · acrescentar precipitação IMERG | Tudo | Nova (AC-09, AC-11) |
| D-02 | Precipitação diária ou total mensal | `PRECTOTCORR` (mm/day) · `PRECTOTCORR_SUM` | Gráfico, som, textos | Questão 2 |
| D-03 | Imagens fazem parte da comparação? | Não · imagem de contexto por região · comparação de imagens com critérios de equivalência | Etapa 4 | Questões 1 e 4; 5.6, item 7 |
| D-04 | Se houver imagens, qual camada para cada variável? | Mesma grandeza da série · contexto genérico (cor real) | Etapa 4, mapa | Questão 8; P-11 reformulado |
| D-05 | **O que "comparar" significa** | Níveis absolutos · ciclo sazonal · anomalias · diferença A − B ao longo do tempo | Cálculos, gráfico, som, textos | Nova (AC-16) |
| D-06 | Região como ponto ou área | Ponto (como hoje) · área com agregação | Etapa 1 | Questão 3 |
| D-07 | Catálogo de regiões | Lista curada (quais e por quê) · busca livre | Etapa 1 | Questão 3 |
| D-08 | **O projeto pode ter backend ou proxy?** | Não: só fontes públicas sem credencial · sim: função serverless | Viabilidade de Meteomatics, IMERG e MODIS numéricos | Nova (AC-13) |
| D-09 | Mock em produção | Erro claro · fallback sintético com aviso · snapshot real gravado | Etapa 3; AC-01 | Questão 5 |
| D-10 | Papel da sonificação de imagem e da coleção de imagens | Experiência separada · ligada às regiões · fora da página de comparação | AC-14, AC-20 | 5.6, item 6 |
| D-11 | Escala de altura da comparação | Linear em Hz (atual) · em oitavas (recomendada) | Som, descrições | Nova (AC-02) |
| D-12 | Representar a diferença no som | Não · modo "diferença" | Som, descrições | Nova (AC-03) |
| D-13 | Narração própria (`speechSynthesis`) | Manter a regra "leitor de tela é o único narrador" · narração opcional e desligada por padrão · narração substitui a regra | Acessibilidade | Nova (AC-14) |
| D-14 | Papel da Meteomatics | Não usar · complementar (por exemplo, previsão) · principal em algum cenário | Fontes, narrativa "dados da NASA" | Nova (AC-09) |
| D-15 | Até a integração, o que fazer com o mock | Manter · corrigir a sazonalidade · trocar por snapshot do POWER | Demos | Nova (AC-01) |
| — | Período, ausentes, textos institucionais, snapshot EIC | — | — | Questões 6, 7, 10 e 9 do PENDENCIAS |

## 15. Critérios de aceite para considerar a comparação concluída

A comparação só deve ser considerada concluída quando **todos** os itens abaixo forem verdadeiros:

**Dados**

- [ ] Cada valor exibido, descrito e sonificado vem de uma fonte numérica identificada (fonte, produto, versão, data de acesso), visível na tela e disponível ao leitor de tela.
- [ ] As duas regiões usam a mesma variável, unidade, resolução e período, ou a interface explica a diferença.
- [ ] A unidade exibida é a unidade de origem ou uma conversão testada; não existe unidade escrita à mão divergente da fonte.
- [ ] Valores de preenchimento (`-999`) e a chave anual (`13`) nunca aparecem como dados.
- [ ] Nenhum valor numérico é extraído de pixels de imagem de visualização.
- [ ] Uma checagem de sanidade climática passa (por exemplo, o mês mais quente de Nova York está entre junho e agosto).

**Cálculos**

- [ ] As séries são alinhadas por data; séries de tamanhos diferentes não quebram nenhum componente.
- [ ] Diferença mensal e média usam só meses com as duas regiões presentes e informam quantos meses foram excluídos.
- [ ] Toda frase do resumo pode ser reproduzida a partir da tabela.
- [ ] A estatística de "mudança ao longo do tempo", se existir, foi escolhida pelo time e está descrita.

**Visualização e som**

- [ ] O gráfico mostra lacunas onde faltam dados; a tabela mostra "No data".
- [ ] A escala sonora foi escolhida pelo time e está descrita exatamente como implementada.
- [ ] Um mês ausente nunca vira nota; a convenção é explicada antes do áudio.
- [ ] Se houver imagens, cada uma mostra camada, data, legenda e créditos, e representa a mesma grandeza da variável selecionada.

**Acessibilidade**

- [ ] Carregamento e erro são anunciados (uma mensagem por mudança); o Play explica por que está desabilitado.
- [ ] O guia, a página e o player descrevem exatamente os mesmos números.
- [ ] A regra sobre narração própria (D-13) está decidida e refletida no README do guia.
- [ ] Validação com VoiceOver e NVDA executada com dados reais (A-06).

**Engenharia**

- [ ] Nenhuma credencial no bundle do frontend.
- [ ] Testes automatizados de conversão, alinhamento e cálculo versionados e executáveis com um comando.
- [ ] README, PENDENCIAS e este relatório atualizados para refletir o que foi resolvido.

---

## Recomendação para o próximo ciclo de desenvolvimento

**Primeira tarefa: fatia vertical de temperatura do ar (`T2M`) com dados reais do NASA POWER, nas 5 regiões atuais**, cobrindo camada de dados (P-02), série única compartilhada entre página e guia (P-15), alinhamento por data com ausentes (P-04, AC-06) e proveniência real na descrição acessível (A-04).

**Antes de começar, três decisões curtas (uma conversa, não um projeto):**

1. **D-08:** a primeira versão usa só fontes públicas sem credencial? (Recomendação: sim; o POWER já foi testado com chamada real no PENDENCIAS.)
2. **D-09:** se o POWER falhar, mostra erro ou volta ao mock com aviso?
3. **D-05:** nesta fatia, a comparação é de valores absolutos, como hoje? (Permite avançar sem fechar a discussão sobre anomalias.)

**Por que esta tarefa primeiro:**

- **É a única variável verificada de ponta a ponta.** `T2M` existe no POWER com a unidade esperada (°C), confirmada em chamada real (PENDENCIAS, seção 4). A precipitação ainda depende de P-03; LST, IMERG e Meteomatics dependem de decisões e, provavelmente, de backend.
- **Não depende da decisão "regiões ou imagens".** Funciona com os 5 pontos atuais e continua útil qualquer que seja a decisão, porque toda alternativa viável precisa de coordenadas e de uma série numérica.
- **Elimina o problema mais grave para quem usa a aplicação hoje:** as séries sintéticas ensinam padrões falsos (AC-01). Com dados reais, o gráfico, o som e os textos já existentes passam a dizer coisas verdadeiras sem mudar a interface.
- **Expõe cedo os riscos reais:** CORS, latência, ausentes, chave anual e diferenças de tamanho entre séries aparecem já nesta fatia, antes de se investir em imagens e fontes adicionais.
- **Reaproveita o que está bom:** componentes recebem `RegionSeries` por props e as descrições são calculadas das séries, então a troca é localizada.

**Em paralelo, sem bloquear a primeira tarefa:** registrar as decisões D-01 (variáveis), D-13 (narração) e D-10 (papel da coleção de imagens) **antes** de commitar o trabalho em andamento na sonificação de imagem (AC-14).

## Fontes consultadas

- Código em `src/` no commit `f5821b3` e no working tree de 15/11/2026; histórico do Git (`git log --all`, `origin/main:EIC.json`).
- `README.md`, `docs/PENDENCIAS.md`, `docs/relatorio-implementacao.md`, `docs/accessibility-audit.md`, `src/features/sonification/SONIFICATION.md`, `src/features/guided-experience/README.md`.
- Execução local: `tsc --noEmit` e a fórmula de `createDemoSeries` reproduzida em Node.js para calcular os meses de pico e a variação entre 2005 e 2024.
- Inspeção visual de `src/assets/refence.png`.
- **Não foram feitas chamadas a APIs externas nesta auditoria.** As afirmações sobre POWER e GIBS marcadas como verificadas vêm do PENDENCIAS (14/11/2026). As afirmações sobre MODIS LST, GPM IMERG, MERRA-2, Meteomatics, AppEEARS e GES DISC estão marcadas como **Externo (não verificado aqui)** e precisam ser confirmadas na documentação oficial antes de virarem decisão.
