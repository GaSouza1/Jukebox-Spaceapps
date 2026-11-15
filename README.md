# Earth Information Jukebox

Experiência web acessível, criada para o NASA Space Apps Challenge 2026, que compara dados ambientais de dois lugares da Terra por meio de gráfico, texto, tabela e sonificação.

> **Estado atual:** os dados exibidos e sonificados são **sintéticos** e estão sinalizados como "DEMO DATA" na interface. A integração com as APIs da NASA ainda não foi feita. Veja [Débito técnico e pendências](#débito-técnico-e-pendências).

## Funcionalidades

- **Comparação de regiões** (`/explore`): duas regiões, um indicador (temperatura ou precipitação) e um período, apresentados em gráfico, resumo textual, tabela e mapa.
- **Sonificação da comparação:** cada mês vira uma nota por região, com escala de altura compartilhada, timbre e canal estéreo distintos.
- **Sonificação de imagens:** leitura exploratória de uma coleção de imagens (brilho, contraste, família de cor e posição), tocadas em sequência ou em loop, com três camadas: científica, cinematográfica e narração. Veja [Sonificação de imagens](#sonificação-de-imagens).
- **Acessibilidade:** descrições lidas antes de cada áudio, guia para leitores de tela, alto contraste e navegação por teclado.

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

| Camada     | Responsabilidade                                                                                                                                      | Tecnologia                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Scientific | Dados visuais medidos: brilho → altura, contraste → intensidade, família de cor → instrumento, posição horizontal → estéreo, ordem das fatias → tempo | Tone.js                            |
| Cinematic  | Acordes, cordas e piano de fundo; só ambientação, abaixo do registro e do volume da camada científica                                                 | Tone.js                            |
| Narration  | Descrição falada da imagem, antes da composição dela                                                                                                  | Web Speech API (`speechSynthesis`) |

Os mapeamentos das camadas científica e cinematográfica não mudaram. As três camadas podem ser ligadas e desligadas de forma independente e em qualquer combinação. Desligar uma camada não interrompe as outras.

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

Detalhes técnicos, mapeamentos e testes: [`src/features/sonification/SONIFICATION.md`](src/features/sonification/SONIFICATION.md).

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/app/` | Rotas e páginas (Home, Explore, About) |
| `src/features/data/` | Dados de demonstração e estatísticas das séries |
| `src/features/comparison/` | Seleção de regiões, indicador e período |
| `src/features/visualization/` | Gráfico e mapa |
| `src/features/sonification/` | Players e motor de sonificação |
| `src/features/guided-experience/` | Guia para leitores de tela |
| `docs/` | Relatórios do projeto |

## Documentação

- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md): pendências de integração com dados da NASA
- [`docs/relatorio-implementacao.md`](docs/relatorio-implementacao.md): relatório de implementação
- [`docs/accessibility-audit.md`](docs/accessibility-audit.md): auditoria de acessibilidade
- [`src/features/sonification/SONIFICATION.md`](src/features/sonification/SONIFICATION.md): mapeamentos, coleção, sequência e narração da sonificação de imagens
- [`src/features/guided-experience/README.md`](src/features/guided-experience/README.md): guia para leitores de tela

## Débito técnico e pendências

Resumo do levantamento de 14/11/2026. O relatório completo, com arquivos, prioridades e status, está em [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md).

### Principais débitos técnicos

- **Não existe camada de acesso a dados.** Não há cliente HTTP, cache, estados de carregamento e erro, nem campos de proveniência nos tipos.
- **Séries geradas por fórmula** (`createDemoSeries` em `src/features/data/demoData.ts`) alimentam gráfico, tabela, textos e som. Essa geração acontece em dois lugares: a página Explore e o guia.
- **Período (2005–2024) e textos de proveniência estão fixos no código**, em vários componentes.
- **O código pressupõe séries completas e alinhadas pelo índice.** Valores ausentes, o valor de preenchimento (`-999`) e a chave anual (`13`) que o NASA POWER devolve não são tratados.

### Integração com as APIs da NASA

- **Nenhuma chamada a serviços da NASA existe hoje.** NASA POWER, GIBS e EIC aparecem apenas em textos e links.
- **NASA POWER (séries mensais):** é a fonte planejada para os dados; ainda não está conectada.
- **NASA GIBS (camadas do mapa):** o mapa usa OpenStreetMap.
- **Imagem de demonstração da sonificação de imagens:** é um PNG local sem proveniência registrada.
- **Trabalho anterior com a galeria EIC/SVS foi removido do `dev`:** um snapshot JSON e um parser, que nunca chegaram à interface.

### Questão em aberto: regiões ou imagens

Ainda não foi decidido se a experiência deve permitir selecionar **regiões geográficas** diretamente ou selecionar **imagens retornadas por uma API da NASA**, ou combinar as duas.

- A seleção atual usa 5 cidades fixas, representadas por um ponto.
- Há uma hipótese de partir de imagens da NASA, mas ela **não é uma decisão**.
- A escolha afeta a comparação entre dois locais, a sonificação e a fonte de imagens.
- As alternativas e as decisões necessárias estão na seção 5 do relatório.

### Fidelidade científica

- **Unidade da precipitação incompatível com a API real:** o código rotula `PRECTOTCORR` como `mm/month`, mas o POWER mensal devolve `mm/day`. O total mensal vem em `PRECTOTCORR_SUM`.
- **Regiões pontuais:** um ponto não representa necessariamente uma região inteira.
- **Sonificação de imagem exploratória:** sem escala de cores calibrada, ela não representa grandezas físicas (a interface já informa isso).
- **Direções de leitura:** "North → South" e "West → East" são aplicadas a qualquer imagem, mesmo sem georreferência.

### Acessibilidade relacionada aos dados

- **Imagens vindas de APIs:** precisam de descrições confiáveis. O SVS oferece `alt_text`; o GIBS não traz texto.
- **Carregamento e erro:** precisam ser anunciados quando os dados forem remotos.
- **Valores ausentes:** é preciso definir uma convenção para som, tabela e textos.
- **Descrições lidas antes do áudio:** devem refletir a proveniência real dos dados, em vez do texto fixo "synthetic".
- **Validação com VoiceOver e NVDA:** continua pendente e deve ser refeita com dados reais.
