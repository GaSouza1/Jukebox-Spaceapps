# Earth Information Jukebox

Experiência web acessível, criada para o NASA Space Apps Challenge 2026, que compara dados ambientais de dois lugares da Terra por meio de gráfico, texto, tabela e sonificação.

**Aplicação publicada:** <https://earth-information-jukebox-jet.vercel.app/>

> **Estado atual (15/11/2026):** a comparação usa **dados reais do NASA POWER** (temperatura média mensal do ar a 2 m, `T2M`, reanálise MERRA-2), consultados diretamente da API da NASA pelo navegador. O mapa mostra a camada correspondente do NASA GIBS como contexto visual. Não há dados sintéticos nem fallback silencioso: se a NASA não responder, a página mostra o erro e permite tentar de novo. Veja [APIs e serviços da NASA](#apis-e-serviços-da-nasa), [Comparação com dados da NASA](#comparação-com-dados-da-nasa) e [Acessibilidade](#acessibilidade).

## Páginas

| Rota       | Conteúdo                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------- |
| `/`        | Home: apresentação do projeto e acesso à exploração e à metodologia                          |
| `/explore` | Sonificação de imagens ("Listen to an image") e comparação de duas regiões com dados da NASA |
| `/about`   | Metodologia: projeto, fontes de dados, sonificação, acessibilidade e aviso científico        |

## Funcionalidades

- **Comparação de regiões** (`/explore`): duas regiões, temperatura média mensal do NASA POWER e um período (por padrão, os últimos 20 anos completos), apresentados em gráfico, resumo textual, tabela e mapa com a camada MERRA-2 do NASA GIBS. Regiões disponíveis: Sorocaba, São Paulo, Manaus, Nova York, Londres e Cidade do Cabo (`src/features/data/regions.ts`).
- **Sonificação da comparação:** cada mês vira uma nota por região, numa escala de altura compartilhada e uniforme em oitavas, com timbre e canal estéreo distintos. Toca no mesmo motor da sonificação de imagens, sincronizada com gráfico, tabela e linha do tempo; mês sem dado é silêncio.
- **Sonificação de imagens:** leitura exploratória de uma coleção de imagens (brilho, contraste, família de cor e posição), tocadas em sequência ou em loop, com três camadas: científica, cinematográfica e narração. Veja [Sonificação de imagens](#sonificação-de-imagens).
- **Acessibilidade:** link "Skip to content", landmarks semânticos, navegação por teclado com foco visível, alternância de alto contraste no cabeçalho, resumos textuais e tabelas de dados, descrições lidas antes de cada áudio e guia para leitores de tela (Screen Reader First). Som e cor reforçam a informação, mas nunca a carregam sozinhos. Veja [Acessibilidade](#acessibilidade).

## APIs e serviços da NASA

| Serviço                                  | Uso no projeto                                                                                                                                                                                       | Endpoint / referência                                                                                | Onde no código                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **NASA POWER** — Monthly & Annual API    | Fonte de todos os números da comparação: série mensal de `T2M` (temperatura média do ar a 2 m, reanálise MERRA-2), `community=AG`, por ponto. Sem chave, CORS liberado, chamada direto do navegador. | `https://power.larc.nasa.gov/api/temporal/monthly/point` ([docs](https://power.larc.nasa.gov/docs/)) | [`powerClient.ts`](src/features/data/power/powerClient.ts), [`powerParse.ts`](src/features/data/power/powerParse.ts)         |
| **NASA GIBS** — WMTS                     | Camada raster `MERRA2_2m_Air_Temperature_Monthly` no mapa, no mesmo mês e na mesma grandeza da comparação. Contexto visual apenas.                                                                   | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best`                                                 | [`gibsLayer.ts`](src/features/visualization/map/gibsLayer.ts), [`EarthMap.tsx`](src/features/visualization/map/EarthMap.tsx) |
| **NASA GIBS** — colormaps                | Legenda do mapa, convertida de kelvin para °C.                                                                                                                                                       | `https://gibs.earthdata.nasa.gov/colormaps/v1.3/MERRA2_2m_Air_Temperature_Monthly.xml`               | [`gibsLayer.ts`](src/features/visualization/map/gibsLayer.ts)                                                                |
| **Earth Information Center** (earth.gov) | Sem API pública nem incorporação: links curados na metodologia e no indicador (início, Agriculture, Energy).                                                                                         | `https://earth.gov/`                                                                                 | [`indicators.ts`](src/features/data/indicators.ts), [`AboutPage.tsx`](src/app/routes/AboutPage.tsx)                          |
| **NASA SVS** — Hometown Dashboard        | Link curado associado ao indicador de temperatura.                                                                                                                                                   | `https://svs.gsfc.nasa.gov/webapps/hometown-dashboard/`                                              | [`indicators.ts`](src/features/data/indicators.ts)                                                                           |

Serviços de terceiros, fora da NASA: mapa base do **OpenStreetMap** (`tile.openstreetmap.org`) e a **Web Speech API** do navegador para a narração.

## Stack

React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router, Zustand, Recharts, MapLibre GL e Tone.js.

## Como executar

```bash
pnpm install
pnpm dev       # servidor de desenvolvimento
pnpm build     # build de produção
pnpm test      # testes unitários (test runner nativo do Node)
pnpm typecheck # verificação de tipos (TypeScript)
pnpm format    # formatação (oxfmt)
```

## Comparação com dados da NASA

Especificação técnica: [`docs/FEATURE_COMPARISON_IMPLEMENTATION_REPORT.md`](docs/FEATURE_COMPARISON_IMPLEMENTATION_REPORT.md).

### Fonte e fluxo dos dados

```text
comparisonStore (regiões, indicador, período)
  └─ useComparisonData ........ usado pela Explore E pelo guia (mesmos números)
      ├─ powerClient .......... 1 requisição por região e sessão (cache com a promessa compartilhada),
      │                         histórico mensal completo de 1981 até hoje, timeout de 20 s
      ├─ powerParse ........... −999 → null; descarta AAAA13; meses não publicados → null
      └─ comparison.ts ........ selectSeries → alignByDate → ComparisonData (linhas por data)
          ├─ ComparisonChart .. gráfico com lacunas, resumo, tabela com "No data"
          ├─ comparisonScore .. partitura (SonificationScore) → PlaybackController
          ├─ describeSonification  texto lido antes do áudio (mesmos números da partitura)
          └─ EarthMap ......... marcadores + camada GIBS do mesmo mês e da mesma grandeza
```

- **NASA POWER** (`/api/temporal/monthly/point`, `community=AG`, `parameters=T2M`): CORS liberado, sem chave, sem backend. O valor é o da célula MERRA-2 de 0,5° × 0,625° mais próxima do ponto (cerca de 55 × 60–70 km), não da cidade.
- **Período:** derivado dos dados. Só anos completos para as duas regiões aparecem nos seletores; o ano corrente, ainda incompleto, fica de fora.
- **Comparabilidade:** `checkCompatibility` impede comparar a mesma região, a mesma célula de grade, indicadores, unidades, medidas ou frequências diferentes, ou séries sem meses em comum. A interface explica o motivo.
- **Diferenças:** calculadas só nos meses com valor nas duas regiões; a média anual usa só anos completos.
- **NASA GIBS:** camada `MERRA2_2m_Air_Temperature_Monthly`, legenda em °C (o colormap original é em kelvin). É contexto visual: nenhum número da página vem da imagem. Meses que o GIBS não publica são informados.
- **Earth Information Center:** sem API pública nem incorporação; a metodologia traz links curados.

### Sonificação

- Altura = temperatura, de 261,6 Hz (menor valor da comparação) a 1046,5 Hz (maior), linear em oitavas e sem quantização: mesmo valor, mesma nota; diferenças iguais, intervalos iguais.
- Região A: seno suave à esquerda. Região B: triângulo à direita. Uma região sozinha toca centralizada.
- Um mês a cada 0,5 s em 1×; intensidade constante; mês sem dado = silêncio; sem camada cinematográfica.
- O relógio é o `Tone.Transport`: o mês destacado no gráfico, na tabela e no slider é o mês que está soando (`Tone.Draw`). Play, pause, stop, navegação pelo slider, velocidade e volume.
- Imagem e comparação nunca tocam juntas: começar uma para a outra (`transportOwner.ts`).

## Sonificação de imagens

Seção "Listen to an image" da página `/explore`. Cada imagem é lida em 96 fatias (de cima para baixo ou da esquerda para a direita), e cada fatia vira uma nota. A leitura é **exploratória**: sem legenda ou escala de cores, as cores não são interpretadas como grandezas físicas.

### Coleção de imagens

- **Imagem inicial:** a imagem de demonstração (`src/assets/refence.png`) é sempre o primeiro item e já vem selecionada. Ela pode mudar de posição, mas não pode ser removida, então a coleção nunca fica vazia.
- **Adicionar:** o campo "Add image files" aceita vários arquivos de uma vez, nos mesmos formatos de antes (`image/*`). Arquivos que não são imagem são recusados e listados em um alerta. Imagens que não podem ser decodificadas ficam marcadas como "could not be read", são puladas na reprodução e podem ser removidas.
- **Ver uma imagem:** cada item da faixa de miniaturas é um botão. Selecionar uma imagem mostra a imagem, a descrição, o perfil textual e o roteiro da narração dela. A seleção não inicia nem interrompe a reprodução.
- **Ordem:** botões "Move earlier" e "Move later" em cada item, operáveis por teclado; não é preciso arrastar e soltar. O foco permanece no item movido, e a nova posição é anunciada.
- **Remover:** botão "Remove" em cada imagem enviada. A URL temporária (`URL.createObjectURL`) é revogada na hora; as demais são revogadas quando o componente é desmontado.
- **Descrição opcional:** para imagens enviadas, um campo permite escrever uma descrição. Ela aparece na legenda e na narração como "fornecida por quem adicionou a imagem, não verificada pelo app" e nunca altera o som.

### Reprodução sequencial e loop

- **Play:** começa na imagem selecionada e segue a ordem da coleção. Para cada imagem: narração (se ativa), depois a composição (camadas científica e cinematográfica), uma pausa de 1,2 s e a próxima imagem.
- **Cada imagem** passa pelo mesmo motor de antes, com a mesma duração (≈29 s em 1×) e a mesma sincronização. A imagem exibida acompanha a reprodução.
- **Pause / Resume** funcionam em qualquer fase (narração, composição ou entre imagens). **Stop** interrompe tudo na hora, inclusive o loop e a voz.
- **Previous / Next** trocam de imagem imediatamente e mantêm o estado de pausa.
- **Loop** (botão com `aria-pressed`) repete a coleção inteira, na ordem definida. Com uma só imagem, ela se repete. Sem loop, a reprodução termina após a última imagem.
- **Remover a imagem em reprodução** interrompe o som dela e passa para a imagem seguinte; se era a última e o loop está desligado, a reprodução termina.

### Camadas de áudio

| Camada     | Responsabilidade                                                                                                                                                                                                                                         | Tecnologia                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Scientific | Dados visuais medidos: brilho → altura, contraste → intensidade, família de cor → instrumento, posição horizontal → estéreo, ordem das fatias → tempo                                                                                                    | Tone.js                            |
| Cinematic  | Ambientação: composição de fundo com dois perfis contrastantes. **Energético** (imagens claras): ritmo mais denso, registro mais agudo, timbre claro. **Contemplativo** (imagens escuras): lento, grave, escuro. Imagens intermediárias misturam os dois | Tone.js                            |
| Narration  | Descrição falada da imagem, antes da composição dela                                                                                                                                                                                                     | Web Speech API (`speechSynthesis`) |

A camada científica é a única que representa dados. A cinematográfica recebe da imagem **um único número**, a "energia", calculada do brilho médio, da distribuição de luminosidade e do contraste globais. Ele escolhe o perfil musical, como **escolha artística de ambientação**, e não indica temperatura, vegetação ou qualquer fenômeno físico. Acordes e notas não dependem dos valores da imagem. Numa sequência, a tonalidade se mantém e o perfil passa gradualmente de uma imagem para a seguinte. A camada fica sempre fora da faixa de notas e abaixo do volume da científica. Detalhes em [`SONIFICATION.md`](src/features/sonification/SONIFICATION.md#cinematic-layer-mood-only). As três camadas podem ser ligadas e desligadas de forma independente e em qualquer combinação. Desligar uma camada não interrompe as outras.

### Narração

- **Origem da descrição, nesta ordem:**
  1. a descrição escrita e validada pela equipe (imagem de demonstração);
  2. a descrição digitada por quem enviou a imagem, sempre identificada como não verificada;
  3. sem descrição: a narração avisa que a imagem não tem descrição validada e explica o que o sistema mede.
- **Características medidas:** em seguida, a narração apresenta as características calculadas para aquela imagem: brilho médio, proporção de tons quentes, frios e neutros, terço mais claro e mais escuro, contraste e posição das áreas claras.
- **Voz e idioma:** a voz do navegador. Cada frase é lida da própria página antes de ser falada, então, se o Chrome traduzir a página, a narração fala o texto traduzido, no idioma traduzido. Uma tradução feita no meio da narração vale a partir da frase seguinte, sem reiniciar. O idioma vem, nesta ordem: do texto não traduzido (inglês), do `lang` da página, do detector de idioma do próprio Chrome (`LanguageDetector`) ou, por último, do idioma do navegador, indicado na tela como suposição. O seletor "Narration voice" permite trocar o modo automático por uma voz específica. O volume segue o controle "Volume", e a velocidade da fala tem um controle próprio, "Narration voice speed".
- **Limitação da tradução:** nenhum navegador informa em qual idioma a página foi traduzida, então a detecção automática é a melhor estimativa possível, não uma garantia. Quando ela errar, use a seleção manual de voz.
- **Início:** a narração só começa pelo botão Play. Ela respeita Pause, Resume e Stop e é falada de novo a cada imagem.
- **Sem síntese de voz:** a camada fica desativada, com o motivo explicado; o restante funciona normalmente. Se a voz falhar durante a reprodução, aparece um aviso e a composição continua.
- **Leitor de tela:** a narração é independente dele. O texto narrado não vai para regiões `aria-live`; o leitor de tela recebe apenas anúncios curtos, como a imagem em reprodução, pausa e fim.
- **Onboarding:** o guia Screen Reader First continua sem voz própria.

### Limitações do reconhecimento de imagens

O motor **não reconhece objetos nem elementos geográficos**. Ele mede brilho, contraste, cor e posição. A narração e os textos gerados nunca afirmam que uma imagem mostra floresta, cidade, rio, oceano, incêndio ou outro fenômeno. Esses termos só aparecem quando uma pessoa os escreveu na descrição, e o texto sempre indica quem o escreveu. Um teste automatizado verifica isso.

### Arquitetura do player

```text
ImageSonification (components/ImageAnalyzer.tsx)
 ├─ ImageCollectionList ......... miniaturas, seleção, ordem, remoção
 ├─ useImageCollection .......... imagens, URLs temporárias, análise por imagem
 └─ useImageSequence
     └─ SequencePlayer .......... coleção: narração → composição → próxima imagem, loop
         ├─ NarrationLayer ...... Web Speech API, frase a frase
         └─ PlaybackController .. motor existente (Tone.js): Scientific + Cinematic
```

O mesmo `PlaybackController` toca a comparação. As duas experiências produzem uma partitura neutra (`engine/score.ts`):

```text
ImageAnalysis ── imageToScore() ──────┐
                                      ├─► SonificationScore ─► PlaybackController.playScore()
ComparisonData ─ comparisonToScore() ─┘        └─ ScientificLayer (uma voz por canal) ─ InstrumentManager ─ Tone.Transport
```

`play(analysis)` continua existindo e delega a `playScore`, então a sequência de imagens não mudou.

Detalhes técnicos, mapeamentos e testes: [`src/features/sonification/SONIFICATION.md`](src/features/sonification/SONIFICATION.md).

## Acessibilidade

### Notas das ferramentas automatizadas

Avaliação feita em 15/11/2026 nas três páginas da aplicação.

| Página     | Lighthouse (Accessibility) | AccessMonitor (WCAG 2.1) |
| ---------- | :------------------------: | :----------------------: |
| `/` Home   |       **100** / 100        |       **10** / 10        |
| `/explore` |       **100** / 100        |       **9,2** / 10       |
| `/about`   |       **100** / 100        |       **10** / 10        |

- **Lighthouse:** auditoria de acessibilidade do Chrome DevTools. A Home foi avaliada na versão publicada; Explore e About, no servidor local (`localhost:8443`) com o mesmo código.
- **AccessMonitor:** extensão de navegador que gera o "Relatório de práticas de acessibilidade Web (WCAG 2.1 do W3C)", com nota de 1 a 10. Avaliado na versão publicada.
- Ferramentas automatizadas detectam só parte dos problemas. Os 10 itens de verificação manual listados pelo Lighthouse (ordem de tabulação, foco, landmarks, rótulos de controles customizados etc.) e a validação com leitores de tela (VoiceOver e NVDA) continuam necessários.

Capturas de tela das avaliações:

| Página  | Lighthouse                                                              | AccessMonitor                                                               |
| ------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Home    | [lighthouse-score-home.png](src/assets/lighthouse-score-home.png)       | [acessmonitor-score-home.png](src/assets/acessmonitor-score-home.png)       |
| Explore | [lighthouse-score-explore.png](src/assets/lighthouse-score-explore.png) | [acessmonitor-score-explore.png](src/assets/acessmonitor-score-explore.png) |
| About   | [lighthouse-score-about.png](src/assets/lighthouse-score-about.png)     | [acessmonitor-acore-about.png](src/assets/acessmonitor-acore-about.png)     |

### Recursos implementados

- Link "Skip to content" para o conteúdo principal e landmarks semânticos (`header`, `nav`, `main`, `footer`).
- Todos os controles operáveis por teclado, com foco visível; reordenação da coleção de imagens por botões, sem arrastar e soltar.
- Alternância de alto contraste no cabeçalho.
- Tamanho mínimo de texto de 12px (`0.75rem` com a fonte padrão do navegador), inclusive em rótulos, legendas e `<small>`. Por usar `rem`, o texto acompanha o tamanho de fonte escolhido no navegador.
- Gráfico acompanhado de resumo textual e tabela; valores ausentes aparecem como "No data", lacuna no gráfico e silêncio no som.
- Descrição falada/lida antes de cada sonificação, com controles separados de play, pause, stop, velocidade e volume.
- Carregamento e erros anunciados (`role="status"` e `role="alert"`), com "Try again" que mantém o foco.
- Guia Screen Reader First para quem usa leitor de tela ([`src/features/guided-experience/README.md`](src/features/guided-experience/README.md)).
- Sem WebGL2, o mapa vira texto e a página continua funcionando.

Auditorias detalhadas: [`docs/accessibility-audit.md`](docs/accessibility-audit.md) e [`docs/AUDITORIA_TECNICA_ACESSIBILIDADE.md`](docs/AUDITORIA_TECNICA_ACESSIBILIDADE.md).

## Estrutura

| Caminho                           | Conteúdo                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                        | Rotas e páginas (Home, Explore, About)                                                                                                      |
| `src/components/`                 | Layout (cabeçalho com alto contraste, rodapé) e componentes compartilhados                                                                  |
| `src/stores/`                     | Estado da comparação (Zustand)                                                                                                              |
| `src/assets/`                     | Imagem de demonstração e capturas das avaliações de acessibilidade                                                                          |
| `src/features/data/`              | Cliente e parser do NASA POWER (com fixtures de respostas reais), catálogos de indicadores e regiões, alinhamento e estatísticas das séries |
| `src/features/comparison/`        | Seleção de regiões, indicador e período                                                                                                     |
| `src/features/visualization/`     | Gráfico (Recharts) e mapa (MapLibre + camada GIBS)                                                                                          |
| `src/features/sonification/`      | Players e motor de sonificação                                                                                                              |
| `src/features/guided-experience/` | Guia para leitores de tela                                                                                                                  |
| `docs/`                           | Relatórios do projeto                                                                                                                       |

## Documentação

- [`docs/FEATURE_COMPARISON_IMPLEMENTATION_REPORT.md`](docs/FEATURE_COMPARISON_IMPLEMENTATION_REPORT.md): especificação técnica da comparação com dados da NASA
- [`docs/AUDITORIA_COMPARACAO.md`](docs/AUDITORIA_COMPARACAO.md): auditoria da comparação (problemas `AC-` e decisões `D-`), com a situação após a implementação
- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md): pendências de integração com dados da NASA
- [`docs/relatorio-implementacao.md`](docs/relatorio-implementacao.md): relatório de implementação
- [`docs/accessibility-audit.md`](docs/accessibility-audit.md): auditoria de acessibilidade
- [`docs/AUDITORIA_TECNICA_ACESSIBILIDADE.md`](docs/AUDITORIA_TECNICA_ACESSIBILIDADE.md): cruzamento do relatório automatizado `eval.csv` com o código, achados novos e plano de correção
- [`src/features/sonification/SONIFICATION.md`](src/features/sonification/SONIFICATION.md): mapeamentos, coleção, sequência e narração da sonificação de imagens
- [`src/features/guided-experience/README.md`](src/features/guided-experience/README.md): guia para leitores de tela

<!-- ## Débito técnico e pendências

Levantamento de 14/11/2026, atualizado em 15/11/2026 após a implementação da comparação com dados reais. O relatório completo, com arquivos, prioridades e status, está em [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md) (seção 12 para a situação atual).

### Resolvido na comparação (15/11/2026)

- Camada de dados com cache, cancelamento de respostas obsoletas, timeout, erros tipados e proveniência; séries reais do NASA POWER; uma única fonte de dados para a página e o guia.
- Alinhamento por data, ausentes explícitos, `-999` e chave anual tratados; período derivado dos dados.
- Sonificação da comparação no motor compartilhado, com escala em oitavas e silêncio nos ausentes.
- Camada GIBS no mapa; sem WebGL2, o mapa vira texto e a página continua funcionando.

### Principais débitos técnicos que continuam

- **Só `T2M` está disponível.** Precipitação depende da decisão sobre média diária (`PRECTOTCORR`, mm/dia) ou total mensal (`PRECTOTCORR_SUM`, cuja unidade a API declara errado).
- **Validação manual com VoiceOver e NVDA não foi executada.**
- **O worker do MapLibre falha ao carregar** (no build e no servidor de desenvolvimento). Os tiles raster funcionam; o problema é anterior à comparação e não foi investigado.

### Integração com as APIs da NASA

- **NASA POWER:** integrado (série mensal por ponto).
- **NASA GIBS:** integrado como camada do mapa (`MERRA2_2m_Air_Temperature_Monthly`).
- **Earth Information Center:** sem API nem incorporação; associado por links curados na metodologia.
- **Imagem de demonstração da sonificação de imagens:** é um PNG local sem proveniência registrada.
- **Trabalho anterior com a galeria EIC/SVS foi removido do `dev`:** um snapshot JSON e um parser, que nunca chegaram à interface.

### Questão em aberto: regiões ou imagens

Ainda não foi decidido se a experiência deve permitir selecionar **regiões geográficas** diretamente ou selecionar **imagens retornadas por uma API da NASA**, ou combinar as duas.

- A seleção atual usa 6 cidades fixas, representadas por um ponto.
- Há uma hipótese de partir de imagens da NASA, mas ela **não é uma decisão**.
- A escolha afeta a comparação entre dois locais, a sonificação e a fonte de imagens.
- As alternativas e as decisões necessárias estão na seção 5 do relatório.

### Fidelidade científica

- **Precipitação ainda fora da comparação:** o POWER mensal devolve `PRECTOTCORR` em `mm/day`; o total mensal vem em `PRECTOTCORR_SUM`, que a API declara, por engano, como `mm/day`.
- **Regiões pontuais:** o valor é o da célula de grade MERRA-2 mais próxima. A interface informa o tamanho da célula e impede comparar dois pontos na mesma célula.
- **Sonificação de imagem exploratória:** sem escala de cores calibrada, ela não representa grandezas físicas (a interface já informa isso).
- **Direções de leitura:** "North → South" e "West → East" são aplicadas a qualquer imagem, mesmo sem georreferência.

### Acessibilidade relacionada aos dados

- **Imagens vindas de APIs:** precisam de descrições confiáveis. O SVS oferece `alt_text`; o GIBS não traz texto.
- **Carregamento e erro:** anunciados (uma mensagem por mudança; erro em `role="alert"` com "Try again" que mantém o foco).
- **Valores ausentes:** silêncio no som, "No data" na tabela, lacuna no gráfico e contagem nos textos.
- **Descrições lidas antes do áudio:** usam a proveniência real (NASA POWER, MERRA-2, versão da API, data da consulta).
- **Validação com VoiceOver e NVDA:** continua pendente e deve ser feita com os dados reais. -->
