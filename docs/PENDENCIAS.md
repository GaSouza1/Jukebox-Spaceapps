# Earth Information Jukebox — Pendências de integração com dados da NASA

**Data:** 14/11/2026 · **Branch analisado:** `dev` (commit `0a96b35`) · **Escopo:** todo o código em `src/`, histórico do Git e documentação em `docs/`

Este relatório registra o que ainda não vem de fontes oficiais da NASA e o que falta para que venha. Nenhum comportamento da aplicação foi alterado durante o levantamento.

**Convenções usadas no texto:**

- **Fato (código):** confirmado lendo o código ou o histórico do Git, com arquivo e linha.
- **Fato (API):** confirmado na documentação oficial ou em chamada real à API em 14/11/2026.
- **Hipótese:** possibilidade plausível, ainda não confirmada.
- **A verificar:** não foi possível confirmar pelo código nem pela documentação consultada.
- **Decisão pendente:** escolha que cabe ao time e não foi tomada neste relatório.

---

## 1. Resumo executivo

- **Nenhum dado exibido ou sonificado vem da NASA hoje.** Não há nenhuma chamada HTTP a serviços da NASA em `src/`. As únicas URLs externas são as fontes do Google Fonts (`src/index.css:1`), os tiles do OpenStreetMap (`EarthMap.tsx:36`) e os links da página About.
- **As séries históricas são geradas por fórmula** (`createDemoSeries`, `src/features/data/demoData.ts:56-83`). Gráfico, tabela, resumo textual, descrição acessível e sonificação da comparação usam essas séries.
- **As regiões são cinco cidades fixas no código**, com coordenadas pontuais escritas à mão (`demoData.ts:3-27`).
- **A imagem da sonificação de imagem é um PNG local** (`src/assets/refence.png`) sem metadados nem proveniência registrada. A descrição dela foi escrita à mão.
- **Incompatibilidade de unidade confirmada na API real:** o indicador `PRECTOTCORR` está rotulado como `mm/month` (`demoData.ts:41`), mas o NASA POWER devolve esse parâmetro mensal em `mm/day`. O total mensal vem em outro parâmetro (`PRECTOTCORR_SUM`). Ligar a API sem resolver isso produziria valores cerca de 30 vezes menores que o rótulo.
- **A aplicação já informa que os dados são sintéticos** (selo "DEMO DATA", textos e descrições acessíveis). Essa transparência precisa ser mantida e depois atualizada de forma dinâmica quando houver dados reais.
- **Questão de produto em aberto:** a experiência deve partir da seleção de **regiões**, de **imagens** retornadas por uma API da NASA, ou de uma combinação das duas? A [seção 5](#5-pendência-de-esclarecimento-seleção-de-regiões-ou-imagens) detalha as alternativas sem escolher entre elas.
- **Trabalho anterior com dados da NASA foi descartado:** um snapshot JSON da galeria do Earth Information Center (SVS) e um parser (`EIC.json`, `filtrarDescricao.ts`) existiam no histórico. Foram removidos no commit `bad7d11` e nunca chegaram à interface.

## 2. Estado atual da integração com a NASA

| Fonte NASA | Onde aparece no código | Situação real |
| --- | --- | --- |
| NASA POWER | IDs dos indicadores `T2M` e `PRECTOTCORR` (`demoData.ts:29-44`); texto "Intended source: NASA POWER · NOT YET CONNECTED" (`ScientificExplanation.tsx:45-50`); link na About (`AboutPage.tsx:60`) | **Não integrado.** Só os nomes dos parâmetros seguem a nomenclatura do POWER. Nenhuma requisição é feita. |
| NASA GIBS | Texto "NASA GIBS layer integration planned" (`EarthMap.tsx:97`); link na About (`AboutPage.tsx:66-74`) | **Não integrado.** O mapa usa tiles do OpenStreetMap. |
| Earth Information Center (EIC) | Link para `earth.gov` (`AboutPage.tsx:76`); selo "NASA POWER · GIBS · EIC" (`HomePage.tsx:38`) | **Não integrado no `dev`.** Ver detalhes abaixo. |
| NASA SVS (Scientific Visualization Studio) | Nenhuma referência no `dev` | Existia no histórico um snapshot local da galeria EIC (ver abaixo). |

**Histórico relevante (Fato, Git):**

- O commit `e98b3f2` adicionou `Jukebox/EIC.json`, uma resposta JSON da galeria `http://svs.gsfc.nasa.gov/gallery/earth-information-center/` (id `40467`). Ela tem 6 grupos de mídia e 25 itens: dashboards, vídeos, "beauty pieces" e visualizações diárias.
- O commit `745d9c4` adicionou `Jukebox/src/filtrarDescricao.ts`, que extrai título, descrição, legenda, URL, `alt_text`, datas e dimensões desse JSON. O `index.html` daquele protótipo fazia `fetch('EIC.json')`, ou seja, lia o **arquivo local**, não a API do SVS. Na época, o resultado só ia para `console.log` (`App.tsx` do commit `745d9c4`).
- O commit `bad7d11` ("chore: clean node_modules and add core project files") removeu toda a pasta `Jukebox/`, incluindo esses dois arquivos. Eles continuam existindo em `origin/main` (`EIC.json` e `src/filtrarDescricao.ts`, na raiz após o commit `8dc96aa`).
- **A verificar:** se a remoção no `dev` foi intencional e se o time pretende reaproveitar esse trabalho.

## 3. Dados que ainda não vêm de fontes oficiais

| Dado | Onde é definido | Como é obtido hoje | Fonte oficial esperada | Consumido por |
| --- | --- | --- | --- | --- |
| Lista de regiões (nome, país, lat/lon) | `demoData.ts:3-27` | Array fixo com 5 cidades | **Decisão pendente** (seção 5) | `RegionSelector`, `comparisonStore`, `EarthMap`, guia, descrições |
| Regiões iniciais | `comparisonStore.ts:49-50` | `regions[1]` (Manaus) e `regions[3]` (New York) | Depende da decisão da seção 5 | Toda a página Explore |
| Séries mensais de temperatura e precipitação | `demoData.ts:56-83` | Fórmula com seno sazonal, tendência linear e deslocamento por cidade (`regionOffsets`, linhas 48-54) | NASA POWER, endpoint mensal por ponto | Gráfico, tabela, resumo, sonificação, guia |
| Metadados dos indicadores (rótulo, unidade, definição) | `demoData.ts:29-44` | Escritos à mão; a unidade de `PRECTOTCORR` diverge da API | Bloco `parameters` da resposta do POWER (`units`, `longname`), verificado | Controles, gráfico, explicação científica, descrições |
| Período disponível | `ComparisonControls.tsx:42,113,122`; `comparisonStore.ts:52-53` | Fixo em 2005–2024 | Cobertura do POWER: dados meteorológicos de 1981 até o ano anterior (documentação) | Seletores de ano, textos |
| Imagem da sonificação de imagem | `ImageAnalyzer.tsx:3`; `src/assets/refence.png` (2556×1430, 4,2 MB) | PNG local, origem não registrada | **Decisão pendente** (seção 5): GIBS, SVS, EPIC ou outra | `ImageSonification` (análise e som) |
| Descrição e alt text da imagem | `ImageAnalyzer.tsx:55-59` | Texto escrito pelo time para a imagem demo | Metadados da fonte escolhida (por exemplo, `alt_text` e `description` no SVS, `caption` no EPIC) | `<img alt>`, legenda, leitores de tela |
| Data, camada, projeção e escala de cores da imagem | Inexistentes | Não há | Metadados da fonte de imagem | Necessários para calibração e textos |
| Mapa-base | `EarthMap.tsx:31-49` | Tiles do OpenStreetMap | GIBS (planejado, segundo `EarthMap.tsx:97`) | Seção "A planetary view" |
| Proveniência (fonte, versão, data de acesso) | Inexistente nos tipos (`src/types/data.ts`) | Textos fixos dizendo "synthetic" | Cabeçalho da resposta do POWER (`header.sources`, `header.api.version`, `fill_value`, `time_standard`), verificado | Selos, descrições, explicação científica |

## 4. APIs e fontes de dados envolvidas

Verificação feita em 14/11/2026. "Verificado" significa documentação oficial lida ou chamada real executada.

| Fonte | O que fornece (verificado) | Coordenadas/localização | Status de verificação | Uso possível no projeto |
| --- | --- | --- | --- | --- |
| **NASA POWER — Monthly API** `https://power.larc.nasa.gov/api/temporal/monthly/point` | Valores mensais por ponto (`latitude`, `longitude`, `start`/`end` em anos, `community`, até 20 `parameters`). Na chamada real: `T2M` em `C`, `PRECTOTCORR` em `mm/day` (média diária), `PRECTOTCORR_SUM` (total mensal, apesar de o cabeçalho também indicar `mm/day`). Cada parâmetro traz uma chave `AAAA13` com o valor anual. Fonte declarada: `MERRA2`. `fill_value: -999.0`. `time_standard: LST`. | Entrada por lat/lon; a resposta devolve `geometry.coordinates` com elevação | Verificado: documentação e chamada real (Manaus, 2020) | Séries históricas e sonificação da comparação |
| **NASA GIBS** `https://gibs.earthdata.nasa.gov/wmts/...` e `/wms/epsg{code}/best/wms.cgi` | Tiles WMTS e imagens WMS com parâmetro `TIME` (ISO 8601). O WMS aceita `BBOX` arbitrário. Projeções EPSG:4326, 3857, 3413 e 3031. A documentação descreve os produtos como **visualizações**, não dados calibrados. | A imagem é gerada para o BBOX pedido, então a localização é conhecida por construção | Verificado (documentação "Access Basics") | Camada do mapa; imagens recortadas por região e data para a sonificação |
| **NASA SVS — Page/Search API** `https://svs.gsfc.nasa.gov/api/{id}/`, `.../api/search/` | JSON com título, descrição, `keywords`, `release_date`, `update_date`, imagens/vídeos com dimensões e URLs, datasets (`platform`, `sensor`, `date_range`) e `nasa_science_categories` | **Nenhum campo de coordenadas** na documentação consultada nem no snapshot `EIC.json` | Verificado (página de ajuda do SVS e snapshot do histórico). A verificar: se o snapshot veio exatamente da Page API. | Galeria de imagens curadas com texto descritivo e alt text |
| **NASA EPIC API** `https://epic.gsfc.nasa.gov/api/...` | Imagens do disco terrestre inteiro (natural, enhanced, aerosol, cloud) por data. Cada imagem tem `date`, `caption` e `centroid_coordinates`. | Só o centroide do disco visível, não uma região | Verificado (página "About the API") | Hipótese: imagens globais datadas; pouco adequado para comparar regiões |
| **Earth Information Center** (`earth.gov`) | — | — | **A verificar:** não foi encontrada uma API pública documentada. O conteúdo EIC usado no histórico veio da galeria do SVS. | Contexto narrativo |
| Outras fontes NASA (Earthdata CMR, Worldview Snapshots, Earth Imagery API, Giovanni etc.) | — | — | **Não verificadas** neste levantamento | Avaliar se a decisão da seção 5 exigir |
| OpenStreetMap (não NASA) | Mapa-base atual | — | Em uso (`EarthMap.tsx:36`) | Pode continuar como fundo, com GIBS por cima |

## 5. Pendência de esclarecimento: seleção de regiões ou imagens

**Pergunta para o time:** a experiência deve permitir selecionar **regiões geográficas** diretamente ou selecionar **imagens retornadas por uma API da NASA**?

**Hipótese atual (não decidida):** a seleção talvez deva acontecer a partir de imagens disponibilizadas pelas APIs da NASA, em vez de uma escolha manual de regiões. Este relatório **não** adota essa hipótese; apenas documenta as consequências de cada caminho.

**Status:** Aguardando decisão · **Prioridade:** Alta (bloqueia P-05, P-08, P-11 e parte de P-01)

### 5.1 Como a seleção funciona hoje (Fato, código)

- Duas listas suspensas (`RegionSelector.tsx:34-45`) oferecem as mesmas 5 cidades de `demoData.ts:3-27`.
- Cada "região" é um **ponto** (lat/lon do centro da cidade), não uma área.
- A escolha grava `regionA`/`regionB` no store (`comparisonStore.ts:60`). A partir daí são gerados o par de séries (`ExplorePage.tsx:16-25`), os marcadores do mapa (`EarthMap.tsx:67-90`) e todos os textos.
- **A sonificação de imagem é independente da seleção de regiões.** `ImageSonification` (`ExplorePage.tsx:56`) usa uma imagem fixa ou enviada pelo usuário e não lê `regionA`/`regionB`. Hoje, portanto, imagem e região não se relacionam na interface.

### 5.2 APIs que poderiam fornecer imagens e metadados

| API | A imagem tem localização suficiente? | Tem data? | Tem texto descritivo? |
| --- | --- | --- | --- |
| GIBS (WMS com `BBOX`) | Sim, por construção: quem pede define o recorte | Sim (`TIME`) | Não por imagem. Há metadados de camada (A verificar: o que exatamente) |
| SVS | **Não**, nenhum campo de coordenadas encontrado. Muitas imagens são globais ou de eventos | `release_date`, `date_range` dos datasets | Sim (`description`, `alt_text`, `caption`) |
| EPIC | Parcial: só o centroide do disco | Sim | Sim (`caption`) |

### 5.3 Como associar imagens a regiões, coordenadas ou períodos

- **Partindo da região (gerar a imagem):** com a lat/lon da região, montar um BBOX e pedir ao GIBS uma camada em uma data. A localização da imagem fica conhecida e igual à da série do POWER.
- **Partindo da imagem (inferir a região):**
  - Com SVS, seria preciso mapear manualmente cada visualização para coordenadas ou extrair locais do texto e das `keywords`. A verificar: confiabilidade desse caminho.
  - Com EPIC, só há o centroide, inadequado para uma cidade.
- **Período:**
  - GIBS: a data é parâmetro da requisição.
  - SVS: datas de publicação (`release_date`) ou intervalos dos datasets (`date_range`), que não equivalem à data do fenômeno mostrado. A verificar caso a caso.
  - POWER: aceita intervalos de anos.

### 5.4 Diferenças entre selecionar uma imagem, uma região e um período

| Aspecto | Selecionar região | Selecionar imagem | Selecionar período |
| --- | --- | --- | --- |
| O que o usuário escolhe | Um lugar (ponto ou área) | Um produto visual pronto | Um intervalo de tempo |
| Localização | Explícita | Depende da API: explícita no GIBS, ausente no SVS | Não se aplica sozinho |
| Ligação com séries do POWER | Direta (lat/lon) | Só se a imagem tiver coordenadas | Direta (`start`/`end`) |
| Valor científico da imagem | Imagem gerada para o lugar | Visualização curada, geralmente sem escala de cores calibrada | — |
| Situação no código | Já existe com dados fixos | Não existe; há upload manual e imagem fixa | Já existe (2005–2024 fixo) |

Os três eixos não se excluem. Uma experiência pode, por exemplo, combinar região + período (para as séries) com imagem (para contexto ou sonificação). Esta combinação é um exemplo, não uma recomendação.

### 5.5 Impactos de cada alternativa

**Comparação entre dois locais:**

- **Região:** a comparação A × B continua como está: duas séries alinhadas por mês, mesma escala, mesmo indicador.
- **Imagem:**
  - Comparar duas imagens só tem sentido científico se forem da mesma camada, data, escala de cores e resolução.
  - Imagens curadas do SVS geralmente não cumprem isso.
  - Sem coordenadas, não há como buscar séries do POWER para a mesma imagem.

**Sonificação:**

- **Região:** a sonificação da comparação (`SonificationPlayer.tsx`) usa valores físicos com unidade, o que dá rastreabilidade científica.
- **Imagem:**
  - O motor de sonificação de imagem (`engine/`) só mede brilho, contraste, família de cor e posição.
  - Sem legenda calibrada, os valores não representam grandeza física (já declarado em `SONIFICATION.md` e em `ImageAnalyzer.tsx:241-246`).
  - Com GIBS, os mapas de cores das camadas poderiam permitir calibração (A verificar).

### 5.6 Decisões necessárias antes de implementar

1. **Ponto de partida da experiência:** região, imagem, ou combinação? Se for combinação, qual dos dois controla o outro?
2. **Natureza da região:** ponto (como hoje e como o POWER aceita no endpoint de ponto) ou área? Área exige outro endpoint ou agregação (A verificar no POWER).
3. **Catálogo de regiões:** lista curada (quais e quantas) ou busca livre por coordenadas/nome? Busca por nome exige geocodificação, que não é serviço da NASA.
4. **Fonte de imagens:** GIBS (localizável, sem texto), SVS (com texto, sem coordenadas), EPIC ou outra?
5. **Papel da imagem:** é dado sonificado (exige calibração) ou contexto visual (exige só descrição acessível)?
6. **Duas sonificações:** a de imagem e a de comparação continuam separadas ou passam a se relacionar?
7. **Comparação de imagens:** a comparação A × B também deve valer para imagens? Se sim, quais critérios de equivalência (camada, data, escala)?

## 6. Pendências técnicas por funcionalidade

### Séries históricas e indicadores

#### P-01 — Séries históricas geradas por fórmula

- **Descrição:** gráfico, tabela, resumo, descrições e sonificação da comparação usam valores sintéticos.
- **Estado atual:** `createDemoSeries` (`demoData.ts:56-83`) gera 12 valores por ano a partir de seno sazonal, tendência linear e deslocamento por cidade (`regionOffsets`, linhas 48-54). É chamada em `ExplorePage.tsx:16-25` e de novo em `ScreenReaderGuide.tsx:112-113`.
- **Estado esperado:** séries obtidas do NASA POWER (`/api/temporal/monthly/point`) para a lat/lon de cada região, o indicador e o período escolhidos. A sonificação e os textos devem usar exatamente esses valores.
- **Arquivos envolvidos:** `src/features/data/demoData.ts`, `src/app/routes/ExplorePage.tsx`, `src/features/guided-experience/components/ScreenReaderGuide.tsx`, `src/types/data.ts`.
- **Dependências:** P-02, P-03, P-04; seção 5 (origem das coordenadas).
- **Impacto:** sem isso, nenhuma conclusão sobre as regiões é válida. A interface hoje avisa que os dados são sintéticos.
- **Prioridade:** Alta
- **Status:** Não iniciada

#### P-02 — Ausência de camada de acesso a dados

- **Descrição:** não há cliente HTTP, serviço, cache nem estados de carregamento e erro para dados externos.
- **Estado atual:** a geração é síncrona, dentro de `useMemo`. Os tipos `RegionSeries`/`EnvironmentalDataPoint` (`src/types/data.ts:9-19`) não têm campos de proveniência (fonte, versão, data de acesso, valor de preenchimento).
- **Estado esperado:**
  - Módulo de dados com requisição assíncrona e cancelamento ao trocar a seleção.
  - Cache por (lat, lon, parâmetros, período), estados de carregamento e erro na interface.
  - Tipos com proveniência (`header.sources`, `header.api.version`, `time_standard`).
  - `createDemoSeries` mantido como mock de desenvolvimento ou de fallback (**Decisão pendente:** se o fallback pode aparecer em produção, e com que aviso).
- **Arquivos envolvidos:** `src/types/data.ts`, `src/features/data/`, `src/stores/comparisonStore.ts`, `src/app/routes/ExplorePage.tsx`.
- **Dependências:** nenhuma técnica; P-01 depende desta.
- **Impacto:** pré-requisito de qualquer integração real.
- **Prioridade:** Alta
- **Status:** Não iniciada

#### P-03 — Unidade e parâmetro de precipitação incompatíveis com o POWER

- **Descrição:** o indicador `PRECTOTCORR` está declarado como "Monthly accumulated bias-corrected precipitation" em `mm/month`. No POWER mensal, esse parâmetro é a **média diária** em `mm/day`.
- **Estado atual:** `demoData.ts:37-43`. Os valores sintéticos ficam por volta de 106 ± 58 (escala de total mensal). **Fato (API):** em chamada real para Manaus em 2020, `PRECTOTCORR` de janeiro = `6.08` (mm/day) e `PRECTOTCORR_SUM` de janeiro = `188.45` (total do mês).
- **Estado esperado:** escolher entre média diária (`PRECTOTCORR`, mm/day) e total mensal (`PRECTOTCORR_SUM`). Ajustar o id, a unidade e a descrição para ficarem fiéis à resposta da API, preferencialmente lendo `units`/`longname` do bloco `parameters`.
- **Arquivos envolvidos:** `src/features/data/demoData.ts`, `src/features/comparison/components/ScientificExplanation.tsx`, `src/features/sonification/describeSonification.ts`.
- **Dependências:** decisão do time sobre a grandeza.
- **Impacto:** risco direto de erro científico (valor e unidade incompatíveis), propagado para gráfico, tabela, descrições e som.
- **Prioridade:** Alta
- **Status:** Aguardando decisão

#### P-04 — Valores ausentes, valor anual e alinhamento de datas

- **Descrição:** o código assume séries completas e com os mesmos meses nas duas regiões.
- **Estado atual:**
  - O gráfico e a tabela alinham B a A pelo índice (`ComparisonChart.tsx:23-27`).
  - A sonificação lê `seriesB.data[index]` (`SonificationPlayer.tsx:93-94, 160`).
  - `describeSeries` considera os 12 primeiros e os 12 últimos pontos como um ano (`seriesStats.ts:14-15`).
  - Não há tratamento de valores inválidos.
- **Estado esperado:**
  - Descartar a chave anual `AAAA13` que o POWER devolve (Fato, API).
  - Tratar `fill_value` `-999.0` como ausente.
  - Alinhar por data, não por índice.
  - Definir como o ausente aparece no gráfico, na tabela, no resumo e no som (ver A-03).
- **Arquivos envolvidos:** `src/features/visualization/charts/ComparisonChart.tsx`, `src/features/sonification/components/SonificationPlayer.tsx`, `src/features/data/seriesStats.ts`, `src/features/sonification/describeSonification.ts`.
- **Dependências:** P-02.
- **Impacto:** sem isso, um `-999` viraria a nota mais grave e distorceria mínimo, média e escala de altura. Um `13` seria lido como mês extra.
- **Prioridade:** Alta
- **Status:** Não iniciada

#### P-06 — Período fixo em 2005–2024

- **Descrição:** anos disponíveis e textos de período estão fixos no código.
- **Estado atual:** `ComparisonControls.tsx:42` ("Monthly aggregates · 2005–2024"), `:113` e `:122` (20 anos a partir de 2005); `comparisonStore.ts:52-53`; `demoData.ts:69` (tendência ancorada em 2005).
- **Estado esperado:** faixa derivada da cobertura da fonte. O POWER documenta dados meteorológicos de 1981 até o ano anterior. Se o período máximo continuar limitado, a limitação deve ser uma decisão explícita.
- **Arquivos envolvidos:** `src/features/comparison/components/ComparisonControls.tsx`, `src/stores/comparisonStore.ts`.
- **Dependências:** P-02; decisão sobre o período padrão.
- **Impacto:** médio na experiência; baixo na fidelidade, desde que o período exibido corresponda aos dados.
- **Prioridade:** Média
- **Status:** Não iniciada

#### P-07 — Metadados dos indicadores escritos à mão

- **Descrição:** rótulos, unidades e descrições não vêm da fonte.
- **Estado atual:** `demoData.ts:29-44`. A unidade `°C` é exibida, enquanto a API devolve `C`.
- **Estado esperado:** unidade e nome longo validados contra o bloco `parameters` da resposta do POWER. Textos explicativos podem continuar curados pelo time, desde que não contradigam a definição oficial.
- **Arquivos envolvidos:** `src/features/data/demoData.ts`, `src/features/comparison/components/ScientificExplanation.tsx`.
- **Dependências:** P-03.
- **Impacto:** fidelidade científica dos textos e das descrições acessíveis.
- **Prioridade:** Média
- **Status:** Não iniciada

#### P-15 — Série calculada em dois lugares

- **Descrição:** o guia para leitores de tela gera as séries de novo, em vez de reutilizar as da página.
- **Estado atual:** `ScreenReaderGuide.tsx:112-113` chama `createDemoSeries` de forma independente de `ExplorePage.tsx:16-25`.
- **Estado esperado:** uma única origem (store ou cache compartilhado). Com dados remotos, a duplicação causaria requisições repetidas e risco de o guia descrever dados diferentes dos exibidos.
- **Arquivos envolvidos:** `src/features/guided-experience/components/ScreenReaderGuide.tsx`, `src/app/routes/ExplorePage.tsx`.
- **Dependências:** P-02.
- **Impacto:** consistência entre o que é exibido, ouvido e descrito.
- **Prioridade:** Média
- **Status:** Não iniciada

### Seleção e identificação de regiões

#### P-05 — Catálogo fixo de regiões pontuais

- **Descrição:** as regiões são 5 cidades fixas, representadas por um ponto.
- **Estado atual:** `demoData.ts:3-27`; usadas em `RegionSelector.tsx:38-44`, `comparisonStore.ts:49-50` e `ScreenReaderGuide.tsx:172`. Os países aparecem em idiomas misturados ("Brasil", "United States").
- **Estado esperado:** depende da seção 5 (catálogo curado, busca por coordenadas ou derivação a partir de imagens). Em qualquer caso, as coordenadas usadas na requisição de dados devem ser as mesmas exibidas.
- **Arquivos envolvidos:** `src/features/data/demoData.ts`, `src/features/comparison/components/RegionSelector.tsx`, `src/stores/comparisonStore.ts`, `src/features/guided-experience/components/ScreenReaderGuide.tsx`.
- **Dependências:** seção 5.
- **Impacto:** define o que é possível comparar. Uma região pontual em dado de grade de baixa resolução representa uma célula da grade, não a cidade (A verificar: resolução nativa do MERRA-2 no POWER).
- **Prioridade:** Alta
- **Status:** Aguardando decisão

### Imagens e sonificação de imagem

#### P-08 — Imagem de demonstração local e sem proveniência

- **Descrição:** a sonificação de imagem usa um PNG fixo cuja origem não está registrada.
- **Estado atual:**
  - `ImageAnalyzer.tsx:3` importa `src/assets/refence.png`.
  - O alt text e a descrição foram escritos à mão (`ImageAnalyzer.tsx:55-59`).
  - Não há data, camada, projeção nem escala de cores.
  - **A verificar:** se a imagem veio de alguma fonte NASA. A descrição sugere um mapa global em falsa cor, mas isso não está documentado.
- **Estado esperado:** imagem obtida de uma API da NASA escolhida pelo time, com metadados mínimos (fonte, camada ou título, data, recorte geográfico, créditos) exibidos e usados nos textos.
- **Arquivos envolvidos:** `src/features/sonification/components/ImageAnalyzer.tsx`, `src/assets/refence.png`, `src/features/sonification/SONIFICATION.md`.
- **Dependências:** seção 5; P-02.
- **Impacto:** a experiência promete dados da NASA, mas a imagem não tem procedência verificável.
- **Prioridade:** Alta
- **Status:** Aguardando decisão

#### P-09 — Sonificação de imagem sem calibração física

- **Descrição:** o motor sonifica brilho, contraste, família de cor e posição, e não uma grandeza física.
- **Estado atual:** decisão documentada e explícita na interface (`ImageAnalyzer.tsx:241-246`; `SONIFICATION.md:9-22`). `SONIFICATION.md` já indica onde entraria um passo de calibração (entre `imageAnalyzer` e `dataMapper`).
- **Estado esperado:** se a imagem passar a ser tratada como dado, obter a escala de cores (legenda) da camada e converter pixel em valor físico antes do mapeamento sonoro. **A verificar:** se a fonte escolhida publica escalas de cores legíveis por máquina.
- **Arquivos envolvidos:** `src/features/sonification/engine/imageAnalyzer.ts`, `src/features/sonification/engine/dataMapper.ts`.
- **Dependências:** P-08; decisão 5 da seção 5.6.
- **Impacto:** enquanto não for resolvido, a sonificação de imagem é exploratória. A interface já informa isso corretamente.
- **Prioridade:** Média
- **Status:** Bloqueada

#### P-10 — Direções de leitura assumem mapa com norte para cima

- **Descrição:** os rótulos "North → South" e "West → East" só valem para imagens georreferenciadas, com norte para cima e projeção conhecida.
- **Estado atual:** `ImageAnalyzer.tsx:37-44` aplica esses rótulos a qualquer imagem, inclusive às enviadas pelo usuário (`handleUpload`, linhas 175-191).
- **Estado esperado:** usar orientação geográfica só quando os metadados da imagem a confirmarem; caso contrário, "top → bottom" e "left → right".
- **Arquivos envolvidos:** `src/features/sonification/components/ImageAnalyzer.tsx`.
- **Dependências:** P-08.
- **Impacto:** informação geográfica possivelmente incorreta nos textos visíveis e lidos por leitor de tela.
- **Prioridade:** Média
- **Status:** Não iniciada

#### P-12 — Trabalho com o snapshot do EIC/SVS removido e nunca integrado

- **Descrição:** havia um JSON da galeria EIC do SVS e um parser de metadados, removidos do `dev`.
- **Estado atual:** ausentes no `dev` desde `bad7d11`; presentes em `origin/main`. Eram um snapshot local lido via `fetch('EIC.json')`, sem chamada à API do SVS e sem uso na interface.
- **Estado esperado:** **Decisão pendente:**
  - **Opção 1:** descartar.
  - **Opção 2:** reaproveitar como mock de desenvolvimento.
  - **Opção 3:** substituir por chamada à SVS Page API, se o time adotar o SVS na seção 5.
- **Arquivos envolvidos:** `origin/main:EIC.json`, `origin/main:src/filtrarDescricao.ts`.
- **Dependências:** seção 5.
- **Impacto:** evita retrabalho; o parser já extrai `alt_text`, títulos e datas.
- **Prioridade:** Baixa
- **Status:** Aguardando decisão

### Mapa e informação geográfica

#### P-11 — Mapa sem camada GIBS

- **Descrição:** o mapa usa apenas OpenStreetMap; a camada GIBS é só mencionada.
- **Estado atual:** `EarthMap.tsx:31-49` (fonte `osm`), `:96-97` ("NASA GIBS layer integration planned"). Os marcadores são pontos (`EarthMap.tsx:70-79`).
- **Estado esperado:** camada GIBS (WMTS em EPSG:3857, compatível com MapLibre) com camada e data definidas pelo time, atribuição correta e texto do overlay atualizado.
- **Arquivos envolvidos:** `src/features/visualization/map/EarthMap.tsx`.
- **Dependências:** seção 5 (qual camada e data); decisão sobre relação com o indicador escolhido.
- **Impacto:** médio na experiência; a camada seria contexto visual, não dado sonificado.
- **Prioridade:** Média
- **Status:** Não iniciada

### Proveniência, textos e escala sonora

#### P-13 — Textos e selos de proveniência fixos

- **Descrição:** a informação sobre a origem dos dados está escrita diretamente em vários pontos.
- **Estado atual:**
  - **"Synthetic"/"Demo" fixos:** `DataSourceBadge.tsx:4`, `ExplorePage.tsx:49`, `HomePage.tsx:98`, `ComparisonChart.tsx:148`, `describeSonification.ts:105`, `ScientificExplanation.tsx:40, 45-50`, `AboutPage.tsx:12`.
  - **Afirmações de uso de dados da NASA, ainda não verdadeiras:**
    - `HomePage.tsx:20` ("through NASA data")
    - `HomePage.tsx:37-38` ("SCIENTIFIC SOURCES · NASA POWER · GIBS · EIC")
    - `AppHeader.tsx:38` ("NASA OPEN DATA")

  Os selos "DEMO DATA" atenuam o problema.
- **Estado esperado:** proveniência derivada dos dados realmente carregados (real, mock ou fallback), com fonte, versão e data de acesso. Os textos "synthetic" só devem aparecer quando os dados forem de fato sintéticos.
- **Arquivos envolvidos:** os listados acima.
- **Dependências:** P-02.
- **Impacto:** transparência científica. Hoje há leve risco de sugerir dados da NASA; após a integração, o risco se inverte (anunciar como sintético um dado real).
- **Prioridade:** Média
- **Status:** Não iniciada

#### P-14 — Escala de altura com divisor mínimo fixo

- **Descrição:** a altura da nota usa `Math.max(max - min, 1)` como divisor.
- **Estado atual:** `SonificationPlayer.tsx:88-89`. Se a amplitude real da comparação for menor que 1 unidade (por exemplo, `mm/day` em período seco ou temperatura quase constante), a escala não usa toda a faixa de 130–620 Hz. A descrição (`describeSonification.ts:95`) diria que o maior valor soa a 620 Hz, o que não seria verdade.
- **Estado esperado:** **A verificar** com dados reais se o caso ocorre. Se ocorrer, alinhar o cálculo e o texto.
- **Arquivos envolvidos:** `src/features/sonification/components/SonificationPlayer.tsx`, `src/features/sonification/describeSonification.ts`.
- **Dependências:** P-01, P-03.
- **Impacto:** divergência entre o que se ouve e o que se descreve.
- **Prioridade:** Baixa
- **Status:** Não iniciada

## 7. Impactos na experiência e na fidelidade científica

| Pendência | Experiência | Fidelidade científica |
| --- | --- | --- |
| P-01 Séries sintéticas | Padrões plausíveis, mas não informativos sobre os lugares | **Nula**: nenhum valor corresponde a medição ou reanálise |
| P-03 Unidade da precipitação | Valores e eixo incoerentes após a integração | **Erro direto** de unidade e magnitude |
| P-04 Ausentes, anual e alinhamento | Notas e pontos espúrios; tabela desalinhada | Estatísticas e escala sonora distorcidas |
| P-05 Regiões pontuais fixas | Comparações limitadas a 5 cidades | Ponto ≠ região; representatividade A verificar |
| P-08/P-09 Imagem local não calibrada | Experiência sonora rica, porém desconectada da comparação | Exploratória (corretamente declarada) |
| P-10 Rótulos geográficos | Orientação possivelmente errada | Informação geográfica incorreta para imagens não georreferenciadas |
| P-13 Proveniência fixa | Confiança do usuário depende de textos manuais | Risco de atribuição incorreta antes e depois da integração |

**Pontos que já preservam a fidelidade (Fato, código):**

- Os textos descritivos são calculados a partir das séries (`seriesStats.ts:6`, `describeSonification.ts`), portanto continuarão corretos com dados reais, desde que P-04 seja resolvida.
- A sonificação de imagem declara não interpretar cores como grandezas físicas.
- A camada cinematográfica não carrega dados (`SONIFICATION.md`).

## 8. Pendências de acessibilidade relacionadas aos dados

Estas pendências complementam as de `docs/accessibility-audit.md` e `docs/relatorio-implementacao.md`. As funcionalidades atuais de acessibilidade devem ser preservadas.

#### A-01 — Descrições acessíveis para imagens da NASA

- **Descrição:** cada imagem vinda de API precisa de alternativa textual confiável.
- **Estado atual:** só a imagem demo tem descrição humana (`ImageAnalyzer.tsx:55-59`). Imagens enviadas recebem um alt genérico e o perfil calculado (linhas 186-189, 274-278).
- **Estado esperado:**
  - **SVS:** usar `alt_text` e `description` da fonte, com indicação de autoria. O snapshot do histórico mostra que esses campos existem.
  - **GIBS:** a imagem não traz texto, então compor uma descrição a partir dos metadados (camada, data, recorte, unidade da escala) sem inventar conteúdo.
  - **Todas as fontes:** manter o perfil de características medidas.
- **Arquivos envolvidos:** `src/features/sonification/components/ImageAnalyzer.tsx`.
- **Dependências:** seção 5; P-08.
- **Impacto:** sem isso, usuários de leitor de tela não sabem o que a imagem mostra.
- **Prioridade:** Alta
- **Status:** Aguardando decisão

#### A-02 — Anúncio de carregamento e erro de dados

- **Descrição:** dados remotos introduzem espera e falha, que precisam ser comunicadas.
- **Estado atual:** não existem, porque os dados são síncronos. Já há regiões `role="status"` para mudanças de seleção (`ComparisonControls.tsx:130-132`) e para a reprodução.
- **Estado esperado:**
  - Anúncio curto de carregamento e de conclusão.
  - Erro anunciado em `role="alert"`.
  - Botão Play desabilitado com motivo explicado enquanto os dados não chegam.
  - Seguir o padrão atual de uma mensagem por mudança.
- **Arquivos envolvidos:** `src/app/routes/ExplorePage.tsx`, `src/features/sonification/components/SonificationPlayer.tsx`, `src/features/comparison/components/ComparisonControls.tsx`.
- **Dependências:** P-02.
- **Impacto:** evita silêncio ou descrições de dados antigos durante o carregamento.
- **Prioridade:** Alta
- **Status:** Não iniciada

#### A-03 — Representação acessível de valores ausentes

- **Descrição:** valores ausentes precisam de tratamento coerente em todas as modalidades.
- **Estado atual:** inexistente (ver P-04).
- **Estado esperado:** **Decisão pendente** sobre como representar o ausente:
  - **Som:** silêncio ou som distinto?
  - **Tabela:** texto, por exemplo "No data".
  - **Resumo:** quantidade de meses sem dado.
  - **Descrição antes do áudio:** explicar a convenção escolhida.
- **Arquivos envolvidos:** `ComparisonChart.tsx`, `SonificationPlayer.tsx`, `describeSonification.ts`, `seriesStats.ts`.
- **Dependências:** P-04.
- **Impacto:** sem convenção, o ouvinte pode interpretar uma lacuna como valor extremo.
- **Prioridade:** Alta
- **Status:** Aguardando decisão

#### A-04 — Proveniência nas descrições lidas antes do áudio

- **Descrição:** as descrições acessíveis dizem "synthetic demonstration data" de forma fixa.
- **Estado atual:** `describeSonification.ts:105`, `ComparisonChart.tsx:148`.
- **Estado esperado:** texto derivado da proveniência real (fonte, período, versão), igual para o que se vê e o que se ouve.
- **Arquivos envolvidos:** `src/features/sonification/describeSonification.ts`, `src/features/visualization/charts/ComparisonChart.tsx`.
- **Dependências:** P-13.
- **Impacto:** a informação sobre origem dos dados é o que dá sentido à escuta.
- **Prioridade:** Alta
- **Status:** Não iniciada

#### A-05 — Rótulos geográficos e unidades lidos por leitor de tela

- **Descrição:** textos geográficos e unidades precisam ser corretos e pronunciáveis.
- **Estado atual:**
  - Direções "North/West" aplicadas a qualquer imagem (P-10).
  - Países em idiomas misturados (`demoData.ts:4-5`).
  - Unidades como `mm/month` e `°C` lidas diretamente. **A verificar:** a pronúncia dessas unidades em VoiceOver e NVDA.
- **Estado esperado:** orientação geográfica só quando confirmada; nomes em um idioma consistente com a interface; unidades com forma por extenso para leitores de tela, se o teste indicar necessidade.
- **Arquivos envolvidos:** `ImageAnalyzer.tsx`, `demoData.ts`, `RegionSelector.tsx`, `EarthMap.tsx`.
- **Dependências:** P-05, P-10.
- **Impacto:** clareza e correção para usuários de leitor de tela.
- **Prioridade:** Baixa
- **Status:** Não iniciada

#### A-06 — Validação com leitores de tela usando dados reais

- **Descrição:** a validação manual com VoiceOver e NVDA já está pendente (`docs/relatorio-implementacao.md`). Com dados reais, ela precisa cobrir também carregamento, erro e valores ausentes.
- **Estado atual:** não executada.
- **Estado esperado:** repetir os cenários da auditoria com séries reais.
- **Arquivos envolvidos:** —
- **Dependências:** P-01, A-02, A-03.
- **Impacto:** confirma que a experiência acessível continua válida com dados reais.
- **Prioridade:** Média
- **Status:** Não iniciada

## 9. Prioridades e dependências

| ID | Título | Prioridade | Status | Depende de |
| --- | --- | --- | --- | --- |
| Seção 5 | Seleção de regiões ou imagens | Alta | Aguardando decisão | — |
| P-02 | Camada de acesso a dados | Alta | Não iniciada | — |
| P-03 | Unidade da precipitação | Alta | Aguardando decisão | Decisão do time |
| P-04 | Ausentes, valor anual, alinhamento | Alta | Não iniciada | P-02 |
| P-01 | Séries do NASA POWER | Alta | Não iniciada | P-02, P-03, P-04, Seção 5 |
| P-05 | Catálogo de regiões | Alta | Aguardando decisão | Seção 5 |
| P-08 | Imagem de fonte NASA | Alta | Aguardando decisão | Seção 5, P-02 |
| A-01 | Descrições de imagens NASA | Alta | Aguardando decisão | Seção 5, P-08 |
| A-02 | Anúncio de carregamento/erro | Alta | Não iniciada | P-02 |
| A-03 | Ausentes acessíveis | Alta | Aguardando decisão | P-04 |
| A-04 | Proveniência nas descrições | Alta | Não iniciada | P-13 |
| P-06 | Período fixo | Média | Não iniciada | P-02 |
| P-07 | Metadados dos indicadores | Média | Não iniciada | P-03 |
| P-09 | Calibração da imagem | Média | Bloqueada | P-08 |
| P-10 | Rótulos de direção | Média | Não iniciada | P-08 |
| P-11 | Camada GIBS no mapa | Média | Não iniciada | Seção 5 |
| P-13 | Proveniência dinâmica | Média | Não iniciada | P-02 |
| P-15 | Série calculada duas vezes | Média | Não iniciada | P-02 |
| A-06 | Validação com leitores de tela | Média | Não iniciada | P-01, A-02, A-03 |
| P-12 | Snapshot EIC/SVS | Baixa | Aguardando decisão | Seção 5 |
| P-14 | Divisor mínimo da escala sonora | Baixa | Não iniciada | P-01, P-03 |
| A-05 | Rótulos geográficos e unidades | Baixa | Não iniciada | P-05, P-10 |

**Ordem sugerida (sujeita às decisões do time):**

1. Decisões da seção 5 e de P-03.
2. P-02 e P-04, que não dependem da decisão da seção 5.
3. P-01, P-13, A-02, A-03 e A-04.
4. P-05, P-08, A-01 e P-11, conforme a decisão sobre regiões e imagens.
5. Itens de prioridade média e baixa.

## 10. Questões que precisam de decisão do time

1. **Regiões ou imagens:** a experiência parte da seleção de regiões, de imagens de uma API da NASA, ou de uma combinação? (seção 5.6, itens 1 a 7)
2. **Precipitação:** usar média diária (`PRECTOTCORR`, mm/day) ou total mensal (`PRECTOTCORR_SUM`)? (P-03)
3. **Região como ponto ou área**, e catálogo curado ou busca livre? (P-05)
4. **Fonte de imagens:** GIBS, SVS, EPIC ou outra? A imagem é dado sonificado ou contexto? (P-08, P-09)
5. **Mock em produção:** quando a API falhar, a aplicação mostra erro ou volta aos dados sintéticos com aviso? (P-02)
6. **Período:** manter 2005–2024 ou abrir para toda a cobertura do POWER? (P-06)
7. **Valores ausentes:** como representar no som, na tabela e nos textos? (A-03)
8. **Camada GIBS do mapa:** qual camada e qual data? Ela deve acompanhar o indicador selecionado? (P-11)
9. **Trabalho anterior com o EIC:** descartar, usar como mock ou retomar via API do SVS? (P-12)
10. **Textos institucionais:** manter "NASA OPEN DATA" e "through NASA data" enquanto os dados forem sintéticos? (P-13)

## Fontes consultadas

- NASA POWER — Monthly API: <https://power.larc.nasa.gov/docs/services/api/temporal/monthly/>
- NASA POWER — chamada real executada em 14/11/2026: `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,PRECTOTCORR_SUM&community=AG&longitude=-60.02&latitude=-3.12&start=2020&end=2020&format=JSON`
- NASA GIBS — Access Basics: <https://nasa-gibs.github.io/gibs-api-docs/access-basics/>
- NASA SVS — Help (APIs): <https://svs.gsfc.nasa.gov/help/>
- NASA EPIC — API: <https://epic.gsfc.nasa.gov/about/api>
- Histórico do Git: commits `e98b3f2`, `745d9c4`, `bad7d11`, `8dc96aa`
