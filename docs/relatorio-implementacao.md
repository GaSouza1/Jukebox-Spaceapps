# Earth Information Jukebox — Relatório de implementação

**Data:** 14/11/2026 · **Branch:** `dev`

## Resumo

As entregas pedidas estão implementadas no código, com build de produção e TypeScript sem erros. Os testes automatizados passam: 71 de 71 no onboarding, e o axe-core não aponta violações WCAG 2.2 AA em nenhuma página. **Não houve teste com VoiceOver nem NVDA reais**, e essa validação é o principal próximo passo.

| Entrega | O que o usuário ganha | Situação |
| --- | --- | --- |
| 1. Motor de sonificação Cinematic + Scientific | A imagem vira uma composição com harmonia de fundo, sem perder a correspondência entre dados e som | Implementado e testado no navegador |
| 2. Auditoria e correção de acessibilidade | 37 problemas corrigidos; descrição para leitor de tela antes de cada áudio; gráfico e mapa com alternativas em texto | Implementado; falta teste com leitores de tela reais |
| 3. Onboarding acessível (Screen Reader First, híbrido) | Orientações contextuais durante a navegação e um guia de 5 etapas consultável a pedido, sem tour visual; escuta de uma região por vez | Implementado e refatorado; falta teste com leitores de tela reais |
| 4. Compatibilidade com a tradução automática do navegador | Conteúdo visível e para leitor de tela continua correto quando o usuário traduz a página; valores não ficam desatualizados após a tradução | Implementado; testado com tradução simulada e uma rodada real; falta Chrome nativo e leitores de tela |

Nada foi commitado. As alterações estão no branch `dev`: as duas primeiras entregas no stage; a terceira, a refatoração do onboarding e a compatibilidade com tradução no working tree.

## Entrega 1 — Motor de sonificação Cinematic + Scientific

A sonificação de imagem agora tem duas camadas independentes:

- **Camada científica:** toca uma nota por fatia da imagem, com valores audíveis e sem ajuste musical.
- **Camada cinematográfica:** cria a ambientação com pad, cordas e piano, sem alterar nenhuma nota de dado.

**Decisão importante: sonificação visual exploratória.** A imagem de demonstração não tem legenda nem escala de cores. Por isso, as cores não são interpretadas como CO₂, temperatura ou outra grandeza física, e a interface avisa isso. O som representa características visuais.

### Como os dados viram som (camada científica)

| Dado da imagem | Som | Transformação |
| --- | --- | --- |
| Luminosidade média da fatia | Altura da nota | 261,6 Hz × 2^(2 · luminosidade): contínua, sem encaixar em escala musical (C4 a C6) |
| Contraste dentro da fatia | Intensidade | 0,3 + 0,6 × contraste ÷ contraste máximo da imagem |
| Família de cor majoritária | Instrumento | Quente → piano com amostras reais; fria → sino suave; neutra (cinza, branco) → tom senoidal |
| Posição horizontal do brilho | Estéreo | De −0,6 (esquerda) a +0,6 (direita) |
| Posição na leitura | Tempo | 96 fatias, 0,3 s cada em velocidade 1× (cerca de 29 s) |

A leitura padrão é de norte para sul (linhas), porque a imagem de demonstração varia sobretudo com a latitude. O usuário pode trocar para oeste → leste.

### Como a camada cinematográfica não mascara os dados

- **Acordes:** um acorde consonante a cada 16 fatias, escolhido pelo brilho relativo do trecho (Am, Em, Dm, F, C, G).
- **Cordas:** abrem mais quando os dados variam mais no trecho.
- **Registro e volume:** tudo fica abaixo da nota mais grave dos dados (C4), 10 dB mais baixo e filtrado em 1,8 kHz.
- **Verificação pelo usuário:** cada camada pode ser desligada na interface para conferir de ouvido que os dados não mudam.

### Arquitetura

O motor fica em `src/features/sonification/engine/`, em módulos com uma responsabilidade cada:

| Módulo | Responsabilidade |
| --- | --- |
| `imageAnalyzer.ts` | Divide a imagem em 96 fatias e calcula luminosidade, contraste, cor e posição |
| `dataMapper.ts` | Único ponto onde dado vira parâmetro sonoro |
| `layers.ts` | Camadas científica e cinematográfica |
| `instrumentManager.ts` | Instrumentos, efeitos, carregamento das amostras e liberação dos recursos |
| `playbackController.ts` | Play, Pause, Resume, Stop, velocidade e volume |
| `synchronization.ts` | Mantém áudio e imagem sincronizados pelo relógio do Tone.js |

### Reprodução

- **Controles:** Play, Pause, Resume e Stop; velocidade de 0,5× a 2×; volume.
- **Sincronização:**
  - barra de progresso;
  - cursor percorrendo a imagem;
  - leitura ao vivo de cada valor original ao lado do parâmetro sonoro correspondente.

  A sincronia vem do relógio do Tone.js, então pausa e mudança de velocidade não desalinham áudio e imagem.
- **Samples:** 17 amostras do Salamander Grand Piano (CC-BY 3.0), hospedadas localmente (1,2 MB). Se não carregarem em 15 s, entra um piano sintetizado e a interface avisa.
- **Recursos de áudio:** são liberados ao sair da página.

### Limitações

- Como a altura das notas é contínua, elas às vezes caem entre as notas dos acordes. É audível em trechos sustentados.
- Mapas de cores diferentes para o mesmo fenômeno soam diferente, porque o som descreve a imagem e não o dado físico.
- As cordas são sintetizadas; só o piano usa amostras reais.

## Entrega 2 — Auditoria e correção de acessibilidade

A auditoria encontrou 37 problemas nas três páginas, e todos foram corrigidos no código. O relatório completo, com cada problema, o critério WCAG e o arquivo alterado, está em [`accessibility-audit.md`](accessibility-audit.md).

### Requisito crítico: descrição antes do áudio

Cada player tem um texto que só o leitor de tela lê, ligado ao botão Play por `aria-describedby`. Ele é lido ao focar o botão, antes de qualquer som, e continua disponível durante a interação. O texto é gerado dos dados escolhidos:

- **Comparativo:** variável e unidade, regiões, período, número de meses, duração, faixa de valores, significado de altura, timbre e canal, e o aviso de que os dados são sintéticos.
- **Imagem:** informa que não há variável científica medida (a imagem não tem legenda) e explica cada mapeamento.

### Principais problemas e correções

| Área | Problema encontrado | Correção |
| --- | --- | --- |
| Player comparativo | Ao sair da página e voltar, o áudio recomeçava sozinho | A reprodução para ao sair e os sintetizadores são liberados |
| Player comparativo | Cada região usava uma faixa de notas diferente: valores iguais soavam diferentes | Escala única; Região A no canal esquerdo e B no direito, além do timbre |
| Player comparativo | Play, pausa e fim não eram anunciados; o controle de posição era lido como "0", "1"… | Avisos curtos de estado; a posição é lida com mês e valores ("January 2005: Manaus 24.5 °C, New York 18.2 °C") |
| Gráfico | Os valores eram anunciados a cada 500 ms durante a reprodução | Anúncio removido; só mudanças de estado são anunciadas |
| Gráfico | Linhas diferenciadas só por cor; sem resumo nem tabela | Linha B tracejada; resumo visível com médias, extremos e tendências; tabela com todos os meses |
| Mapa | Marcadores e zoom focáveis, mas escondidos do leitor de tela; marcadores só por cor | Lista em texto com regiões e coordenadas; marcadores com letras A e B e nome acessível |
| Seleção de regiões | Coordenadas e identidade de cada região não ligadas ao menu; período inválido ignorado sem aviso | Descrição ligada ao menu; o outro ano acompanha a escolha e uma mensagem confirma a mudança |
| Imagem | Interface em português numa página em inglês; texto alternativo genérico | Interface em inglês; descrição real da imagem e um perfil em texto calculado da análise |
| Navegação | Todas as páginas com título "Figma Make App"; trocar de página não movia o foco | Título por página; o foco vai para o título principal da nova página |
| Visual | 7 cores de texto abaixo do contraste mínimo (de 3,24:1 a 4,35:1); rolagem horizontal em 320 px; cabeçalho fixo cobrindo o foco | Contraste mínimo agora 5,38:1; layout corrigido; espaço de rolagem sob o cabeçalho |

Critérios WCAG 2.2 cobertos pelos testes: 1.1.1, 1.3.1, 1.3.3, 1.4.1, 1.4.2, 1.4.3, 1.4.10, 2.1.1, 2.1.2, 2.4.1, 2.4.2, 2.4.3, 2.4.6, 2.4.7, 2.4.11, 2.5.3, 3.1.1, 3.1.2, 3.2.2, 3.3.2, 4.1.2 e 4.1.3.

## Entrega 3 — Onboarding acessível (Screen Reader First, híbrido)

O onboarding foi refatorado para o modelo híbrido. A primeira versão era um painel visual de 5 etapas e foi substituída. Agora as orientações chegam ao leitor de tela de dois modos, e a interface visual voltou a ser a mesma de antes do onboarding.

### A. Navegação natural

Instruções curtas ficam disponíveis enquanto a pessoa navega normalmente, sem precisar iniciar um guia:

- **Página Explore:** logo após o título, um texto só para leitor de tela explica como a página funciona, a ordem das seções e que nada toca antes do Play.
- **Menus de região:** o grupo dos menus tem uma descrição: as regiões são comparadas mês a mês e podem ser ouvidas separadas ou juntas. Cada menu mantém as coordenadas e a identidade sonora.
- **Menu "Listen to" do player:** explica os canais esquerdo e direito, avisa que o estéreo exige fones ou caixas estéreo e indica a alternativa de ouvir uma região de cada vez.
- **Botão Play:** mantém a descrição completa antes do áudio.

### B. Consulta guiada

- **Onde está:** o botão "Start guided experience" fica antes do conteúdo principal, em todas as páginas. É a primeira parada de Tab depois do cabeçalho e aparece como região "Guided experience" na lista de landmarks.
- **Visibilidade:** o botão e o guia ficam visualmente ocultos e só aparecem numa caixa quando recebem foco de teclado, como o skip link. Isso garante foco visível (WCAG 2.4.7) sem criar um painel para quem usa mouse.
- **Etapas:** ao iniciar, o foco vai para "Step 1 of 5: Welcome". "Next step" e "Previous step" movem o foco para o título da etapa seguinte ou anterior. Só o título é anunciado, e o texto é lido no ritmo do usuário.
- **Saída:** "Close guide" ou "Finish guide" fecham o guia e devolvem o foco ao botão. Para consultar de novo, basta ativar o botão outra vez; com o guia aberto, ele se chama "Restart guided experience".
- **Sem efeitos colaterais:** o guia não tem controles próprios além da navegação. Ele aponta para os menus e o player reais com links, nunca altera regiões nem o player, não toca áudio e não rola a página.

### As cinco etapas

1. **Welcome:** para que serve a aplicação, quais são as etapas, e o aviso de que nada toca e de que o guia não altera nada.
2. **Choose two regions:** as regiões selecionadas, com coordenadas, linha, timbre e canal; onde ficam os menus reais (com link); as regiões disponíveis.
3. **How sound is organised:** canais e timbres, o aviso sobre fones e a alternativa sequencial pelo menu "Listen to".
4. **Before you listen:** variável, unidade, período, duração, médias e diferenças, como os valores viram som, timbres e canais, e o aviso de dados sintéticos. O texto vem da mesma função que gera a descrição do botão Play, e há um link para o player.
5. **Ways to explore:** links para o resumo do gráfico, a tabela de dados, o mapa, o player e a sonificação de imagem.

O guia lê as regiões e o período da store, então funciona também na Home e na página About.

### Escuta sequencial (alternativa ao estéreo)

O player ganhou o menu "Listen to": as duas regiões juntas, só a A ou só a B. Uma região tocada sozinha fica centralizada, então funciona com um fone só, caixa de som mono ou audição diferente entre os ouvidos.

O leitor de tela recebe avisos curtos do início e do fim, como "Playing Region A, Manaus, on its own" e "Finished playing Region A, Manaus, on its own". Eles saem de um único ponto do player, para não haver anúncio duplicado.

### Imagens: o que é calculado e o que é descrito por pessoas

A legenda da imagem agora separa a descrição escrita pela equipe do projeto das características que a aplicação calcula. Para imagens enviadas pelo usuário, a legenda informa que não há descrição humana e que a aplicação não reconhece objetos como florestas, cidades ou rios.

## Entrega 4 — Compatibilidade com a tradução automática do navegador

A aplicação continua em inglês. Quem usar "Traduzir para português" no Chrome passa a receber o conteúdo traduzido, inclusive o texto só para leitor de tela. A aplicação não tem tradução própria.

**Problema principal encontrado.** O tradutor do navegador troca os textos da página por elementos novos. Depois disso, quando o usuário mudava região ou variável, o React atualizava os textos antigos e a tela continuava mostrando **valores e nomes desatualizados**. Por exemplo, o resumo do gráfico mantinha "New York" depois da troca para Londres.

**Correções:**

- **Componente `StableText`:** cada texto que muda é recriado em vez de editado. A tradução pode processá-lo de novo e o valor exibido é sempre o atual.
- **Nomes de botões, sliders, grupos e landmarks:** passaram de atributos `aria-label` curtos para texto real na página. Na tradução real, "Play sonification" tinha virado "Sonificação de jogo".
- **Frases com dados:** cada uma é montada como uma frase inteira, para o tradutor ter contexto.
- **Notação técnica:** só os símbolos de acorde, fórmulas e o nome do produto ficam fora da tradução. Valores, unidades e regiões são traduzidos normalmente (24.5 °C → 24,5 °C).

**Resultado.** Na tradução simulada localmente, as verificações passaram de 8 de 15 para 15 de 15. Uma rodada com o serviço real de tradução do Google mostrou que conteúdo oculto e atributos são traduzidos. Mostrou também que conteúdo novo ou fora da área visível pode demorar a ser traduzido.

**Limitações:**

- As mensagens de status provavelmente são anunciadas em inglês, antes de a tradução chegar.
- Trechos que permanecem em inglês são lidos com voz em português.
- Não houve teste com o tradutor nativo do Chrome nem com leitores de tela, porque novas chamadas ao serviço de tradução foram bloqueadas pela ferramenta de permissões.

Detalhes e tabelas de resultado estão em [`accessibility-audit.md`](accessibility-audit.md).

## Testes executados

Todos os testes rodaram sobre o build de produção, no Chrome headless controlado por script, e passaram. Os testes com leitores de tela reais não foram feitos.

| Teste | Resultado |
| --- | --- |
| TypeScript (`tsc --noEmit`) e build de produção | Sem erros |
| axe-core, regras WCAG 2.2 A/AA e boas práticas, em `/`, `/explore` e `/about`, com e sem alto contraste e em cada etapa do guia | 0 violações |
| Navegação só por teclado (Tab e Shift+Tab) | Todos os controles alcançáveis, com anel de foco visível; nenhuma armadilha de foco |
| Nomes, descrições e estados expostos ao leitor de tela (árvore de acessibilidade do Chrome) | Corretos nos botões, menus, sliders, mapa e gráfico |
| Onboarding híbrido: tour visual removido, dicas contextuais na árvore de acessibilidade, conteúdo oculto acessível, guia iniciado, navegado, fechado e finalizado em `/`, `/explore` e `/about`, foco, rolagem, regiões e player inalterados | 71 de 71 verificações aprovadas |
| Nenhum áudio automático (nível de saída medido) | Silêncio ao carregar e durante todo o guia, nas três páginas |
| Motor de sonificação: play, pause, resume, stop, velocidade, fim natural, camadas e carregamento dos samples | Funcionando; áudio e imagem sincronizados |
| Layout em 320 px de largura | Sem rolagem horizontal |
| Tradução simulada localmente (textos trocados como o tradutor faz, seguidos de mudanças de estado) | 15 de 15 depois das correções (8 de 15 antes) |
| Tradução real para português (uma rodada, script do Google como aproximação do Chrome) | Conteúdo oculto e atributos traduzidos; conteúdo fora da área visível e conteúdo novo não traduzidos no tempo medido |

**Não executados:**

- **VoiceOver + Safari e NVDA:** o ambiente usado não tinha interface gráfica interativa nem Windows. Não estão declarados como aprovados.
- **Lint e testes unitários:** o projeto não tem linter nem suíte de testes configurados.

O console mostra o erro "Worker failed to load" do mapa (MapLibre) no build de pré-visualização. Ele já existia antes destas entregas.

## Pendências e próximos passos

### Validação manual necessária

1. **VoiceOver + Safari e NVDA + Firefox:** percorrer os 9 cenários da auditoria e o guia completo. Confirmar em especial:
    - se a descrição ligada ao botão Play é lida ao focá-lo;
    - se o título de cada etapa é anunciado ao receber o foco;
    - se não há anúncio duplicado quando Pause vira Resume.
2. **Escuta com usuários:** testar com fones, com um fone só e com caixa de som mono se as regiões são distinguíveis pelo timbre e pela escuta sequencial.
3. **Guia oculto:** verificar com VoiceOver e NVDA se o botão "Start guided experience" é encontrado com facilidade (Tab, landmarks, lista de botões). Verificar também se o foco no título "Step N of 5" é anunciado sem leitura longa automática.
4. **Repetição das dicas:** avaliar com usuários se ouvir a dica das regiões no parágrafo e de novo ao entrar no grupo com Tab é útil ou incômodo.
5. **Tradução nativa do Chrome:** com "Traduzir para português", testar a página aberta já traduzida, a tradução pedida depois de carregar, e mudanças de região e variável depois de traduzir. Repetir com NVDA e VoiceOver, anotando à parte erros de tradução e de pronúncia.
6. **Baixa visão:**
    - zoom de 200 % e 400 %;
    - contraste das bordas dos campos;
    - tamanho dos botões em telas de toque (o botão Stop tem 36 px).

### Limitações conhecidas

- **Gráfico:** não é navegável por teclado. Os dados ficam acessíveis pela tabela, pelo resumo e pelo controle de posição do player.
- **Imagens enviadas:** não têm descrição automática do conteúdo, só o perfil das características visuais medidas.
- **Dados:** são sintéticos (a aplicação informa isso). Quando as APIs da NASA forem conectadas, os textos continuarão válidos, porque são calculados das séries.

### Próximos passos sugeridos

- Agendar a sessão de teste com VoiceOver e NVDA, de preferência com pessoas cegas e com baixa visão.
- Configurar linter e uma suíte de testes no projeto, aproveitando os cenários automatizados usados nesta validação.

## Arquivos e documentação técnica

### Documentação no repositório

| Documento | Conteúdo |
| --- | --- |
| [`docs/accessibility-audit.md`](accessibility-audit.md) | Relatório completo da auditoria: 37 problemas, critérios WCAG, testes e pendências |
| [`src/features/sonification/SONIFICATION.md`](../src/features/sonification/SONIFICATION.md) | Decisões e mapeamentos da sonificação de imagem |
| [`src/features/guided-experience/README.md`](../src/features/guided-experience/README.md) | Arquitetura, fluxo e critérios de aceite do onboarding |
| [`public/samples/piano/README.md`](../public/samples/piano/README.md) | Origem e licença das amostras de piano |

### Arquivos criados

- `src/features/sonification/engine/`: `imageAnalyzer.ts`, `dataMapper.ts`, `layers.ts`, `instrumentManager.ts`, `playbackController.ts` e `synchronization.ts`
- `src/features/sonification/describeSonification.ts`
- `src/features/data/seriesStats.ts`
- `src/components/StableText.tsx`
- `src/features/guided-experience/`: `ScreenReaderGuide.tsx`, `GuidedStep.tsx`, hook, tipos e textos (`i18n/en.ts`)
- `public/samples/piano/`: 17 amostras de piano
- `docs/accessibility-audit.md` e este relatório

### Arquivos removidos (refatoração do onboarding)

- `src/features/guided-experience/components/GuidedExperiencePanel.tsx` (painel visual de 5 etapas)
- `src/features/guided-experience/components/GuidedExperienceButton.tsx` (botões visíveis na Home e na Explore)

### Arquivos modificados

- **Páginas e layout:**
    - `src/app/routes/HomePage.tsx`, `ExplorePage.tsx` e `AboutPage.tsx`
    - `src/components/layout/AppHeader.tsx` e `RootLayout.tsx`
- **Sonificação:**
    - `src/features/sonification/components/ImageAnalyzer.tsx`
    - `src/features/sonification/components/SonificationPlayer.tsx`
- **Comparação:** `src/features/comparison/components/ComparisonControls.tsx`, `RegionSelector.tsx` e `ScientificExplanation.tsx`
- **Gráfico e mapa:**
    - `src/features/visualization/charts/ComparisonChart.tsx`
    - `src/features/visualization/map/EarthMap.tsx`
- **Estado e estilos:** `src/stores/comparisonStore.ts` e `src/index.css`
- **Configuração:** `.figma/make/site.json` (título e idioma do site)
