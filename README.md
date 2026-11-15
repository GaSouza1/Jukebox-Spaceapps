# Earth Information Jukebox

Experiência web acessível, criada para o NASA Space Apps Challenge 2026, que compara dados ambientais de dois lugares da Terra por meio de gráfico, texto, tabela e sonificação.

> **Estado atual:** os dados exibidos e sonificados são **sintéticos** e estão sinalizados como "DEMO DATA" na interface. A integração com as APIs da NASA ainda não foi feita. Veja [Débito técnico e pendências](#débito-técnico-e-pendências).

## Funcionalidades

- **Comparação de regiões** (`/explore`): duas regiões, um indicador (temperatura ou precipitação) e um período, apresentados em gráfico, resumo textual, tabela e mapa.
- **Sonificação da comparação:** cada mês vira uma nota por região, com escala de altura compartilhada, timbre e canal estéreo distintos.
- **Sonificação de imagem:** leitura exploratória de uma imagem (brilho, contraste, família de cor e posição) em camadas científica e cinematográfica.
- **Acessibilidade:** descrições lidas antes de cada áudio, guia para leitores de tela, alto contraste e navegação por teclado.

## Stack

React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router, Zustand, Recharts, MapLibre GL e Tone.js.

## Como executar

```bash
pnpm install
pnpm dev       # servidor de desenvolvimento
pnpm build     # build de produção
pnpm format    # formatação (oxfmt)
```

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
- [`src/features/sonification/SONIFICATION.md`](src/features/sonification/SONIFICATION.md): mapeamentos da sonificação de imagem
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
- **Imagem da sonificação de imagem:** é um PNG local sem proveniência registrada.
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
