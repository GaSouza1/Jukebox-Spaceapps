# Guided experience — Screen Reader First (híbrido)

Orientações para quem usa leitor de tela, em dois modos que se complementam:

- **A. Navegação natural:** instruções curtas ficam disponíveis enquanto a pessoa navega normalmente, ligadas aos controles reais. Não é preciso iniciar nada para entender a aplicação.
- **B. Consulta guiada:** um guia de cinco etapas, aberto só a pedido, que pode ser consultado de novo a qualquer momento.

Não há painel visual, modal nem tour. A interface visual é a mesma de antes do onboarding.

## Regras

- **O leitor de tela é o único narrador:** a aplicação não tem voz própria (`speechSynthesis`), reconhecimento de voz nem detecção de VoiceOver/NVDA.
- **Nada toca sozinho:** nenhum áudio começa ao carregar a página nem ao abrir ou navegar no guia.
- **Sem leitura longa automática:** o guia só é lido quando pedido. Mudar de etapa anuncia apenas o título da etapa, pelo foco. Não há `aria-live` no guia.
- **Conteúdo oculto continua acessível:** o texto escondido usa o padrão de recorte (`.sr-only` e `.sr-guide`), nunca `display: none`, `visibility: hidden`, `hidden` ou `aria-hidden`.
- **Sem controles duplicados:** o guia não tem menus nem botões de reprodução. Ele aponta para os controles reais com links e nunca altera regiões nem o player.

## A. Navegação natural

| Onde                               | Mecanismo                                 | O que é lido                                                                                                                                                    |
| ---------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Página Explore, logo após o título | Parágrafo `.sr-only`, na ordem de leitura | Como a página funciona, a ordem das seções e o aviso de que nada toca antes do Play                                                                             |
| Grupo dos menus Região A/B         | `role="group"` + `aria-describedby`       | As regiões são comparadas mês a mês e podem ser ouvidas separadas ou juntas                                                                                     |
| Cada menu de região                | `aria-describedby` (já existia)           | Coordenadas e identidade: linha, timbre e canal                                                                                                                 |
| Menu "Listen to" do player         | `aria-describedby`                        | Canais esquerdo e direito; o estéreo exige fones ou caixas estéreo; a alternativa "Region A only", depois "Region B only"; uma região sozinha toca centralizada |
| Botão Play                         | `aria-describedby` (já existia)           | Descrição completa antes do áudio: variável, unidade, período, duração, valores, mapeamento e origem dos dados                                                  |
| Gráfico, mapa e imagem             | Já existiam                               | Resumo e tabela, lista de regiões, distinção entre descrição humana e características calculadas                                                                |

**Ordem de leitura e repetição.** As descrições ficam junto do controle a que se referem.

- **Grupo de regiões:** a dica da Explore é um parágrafo `.sr-only` na ordem de leitura e também é a descrição do grupo. Por isso, quem lê em sequência ouve a dica uma vez no parágrafo e outra ao entrar no grupo com Tab. Isso é o comportamento normal de `aria-describedby` em modos de navegação diferentes, não dois anúncios simultâneos.
- **Menu "Listen to":** a descrição fica num parágrafo `.sr-only` no fim da seção do player.

## B. Consulta guiada

**Onde está:** o componente `ScreenReaderGuide` é montado uma única vez no `RootLayout`, num landmark `<aside aria-label="Guided experience">` entre o cabeçalho e o conteúdo principal. Por isso funciona em `/`, `/explore` e `/about`. Ele lê regiões, variável e período da `comparisonStore`, sem depender da página Explore.

**Como chegar:**

- **Pelo teclado:** é a primeira parada de Tab depois dos controles do cabeçalho: "Start guided experience".
- **Pelos landmarks:** aparece como região complementar "Guided experience".
- **Pela lista de botões ou na leitura linear:** fica antes do conteúdo principal. O skip link pula o guia e vai direto ao conteúdo.

**Visibilidade:**

- Sem foco, o `aside` fica visualmente oculto pelo padrão de recorte.
- Quando algo dentro dele recebe foco (`:focus-within`), ele aparece numa caixa fixa no canto superior, como acontece com o skip link.
- Isso é necessário para que pessoas que enxergam e usam teclado vejam onde está o foco (WCAG 2.4.7). Usuários de mouse nunca veem a caixa.

**Fluxo:**

| Ação                                                     | Resultado                                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Ativar "Start guided experience"                         | O foco vai para o `h2` "Step 1 of 5: Welcome". O botão passa a se chamar "Restart guided experience" e expõe `aria-expanded="true"` |
| "Next step" / "Previous step"                            | O foco vai para o título da nova etapa. Só o título é anunciado; o texto é lido no ritmo do usuário                                 |
| "Close guide" (etapas 1 a 4) ou "Finish guide" (etapa 5) | O guia fecha e o foco volta ao botão de início. Regiões e player ficam como estavam                                                 |
| Seguir um link de uma etapa                              | O foco vai para a seção real. O guia continua aberto, visualmente oculto e disponível ao leitor de tela                             |

A página nunca rola ao abrir ou fechar o guia: os focos programáticos usam `preventScroll`, porque a caixa já fica fixa na tela.

**As cinco etapas:**

1. **Welcome:** propósito da aplicação, a lista das etapas, e o aviso de que nada toca e de que o guia não altera nada.
2. **Choose two regions:** regiões selecionadas, com coordenadas, linha, timbre e canal; onde ficam os menus reais (com link); regiões disponíveis.
3. **How sound is organised:** canais e timbres, o aviso sobre fones e a alternativa sequencial pelo menu "Listen to".
4. **Before you listen:** os 9 fatos de `describeComparisonSonification` (inclui meses sem dado e a fonte NASA POWER), a mesma função usada pela descrição do botão Play, e como ouvir no player (com link). Os dados vêm de `useComparisonData`, o mesmo hook da página Explore, e da mesma requisição em cache: o guia nunca descreve números diferentes dos exibidos nem faz requisições a mais. Enquanto os dados carregam (ou se falharem), a etapa diz isso em vez dos fatos.
5. **Ways to explore:** links para o resumo do gráfico, a tabela, o mapa, o player e a sonificação de imagem. Fora da Explore, os links levam à página Explore.

## Compatibilidade com a tradução automática do navegador

A aplicação continua em inglês (`lang="en"`). Quem quiser outro idioma usa a tradução do próprio navegador, como "Traduzir para português" no Chrome. A aplicação não tem tradução própria, seletor de idioma nem detecção de idioma ou de tradução.

### Regras que o código segue

- **Texto real, não atributo:** nomes e instruções são texto no DOM, inclusive o `.sr-only`.
    - Os botões de ícone levam o nome num `<span className="sr-only">` dentro do botão.
    - O slider de posição usa um `<label>`.
    - Landmarks, grupos e listas usam `aria-labelledby` apontando para um texto.
    - Rótulos ganharam mais contexto ("Play the sonification" em vez de "Play sonification"). Na tradução real, o rótulo curto em `aria-label` virou "Sonificação de jogo".
- **Frases inteiras:** cada frase com dados (resumo do gráfico, descrição do player, legenda do mapa) é uma única string, para o tradutor ver a frase completa e não pedaços soltos.
- **Texto que muda vem com `StableText`:** o componente (`src/components/StableText.tsx`) renderiza cada string que muda num elemento com `key` igual ao texto.
    - O tradutor troca os nós de texto por elementos `<font>`. Se o React atualizasse o nó original, a tela continuaria mostrando o texto antigo, como um nome de região ou valor desatualizado.
    - Com a `key`, o React troca o elemento inteiro, e o texto novo aparece e pode ser traduzido de novo.
    - A tabela de dados troca `<thead>` e `<tbody>` inteiros quando a comparação muda.
    - Ramos condicionais de texto ficam em elementos próprios com `key`.
- **`translate="no"` só em notação:** o nome do produto, os símbolos de acorde ("Am" seria traduzido como palavra), "Rec. 709", "Y′", a fórmula e as notas C4/C6. Nenhuma instrução, nome de região, valor ou unidade fica protegido: o tradutor converte "24.5 °C" em "24,5 °C", o que é correto em português.

### O que vale para o guia e as dicas

- **Textos estáticos** (passos, instruções, dicas): texto real no DOM, traduzível.
- **Textos que dependem da store** (regiões na etapa 2, fatos da etapa 4, nome do botão Start/Restart): usam `StableText`.
- **Título da etapa:** é remontado a cada etapa, então não precisa de `key` extra. Os dados dentro da etapa usam `StableText`, para que uma mudança de região não remonte o título nem mova o foco.

Resultados dos testes e limitações conhecidas estão no relatório de acessibilidade (`docs/accessibility-audit.md`, seção sobre tradução automática).

## Arquivos

```text
src/features/guided-experience/
  components/
    ScreenReaderGuide.tsx   landmark global: botão de início + etapas + navegação (montado no RootLayout)
    GuidedStep.tsx          título da etapa que recebe foco (sem rolar a página)
  hooks/useGuidedExperience.ts   estado, avançar, voltar, fechar, restaurar o foco
  types/guidedExperience.ts      ids das etapas e contratos
  i18n/en.ts                     todos os textos: guia (on demand) e dicas contextuais (hints)
src/components/StableText.tsx    texto que muda, compatível com a tradução do navegador
  README.md
```

Também usam textos de `i18n/en.ts`:

- `ExplorePage.tsx`: dica da página;
- `ComparisonControls.tsx`: dica do grupo de regiões;
- `SonificationPlayer.tsx`: dica do menu "Listen to".

Os fatos científicos vêm de `src/features/sonification/describeSonification.ts`, sem uma segunda implementação. Os dados vêm de `src/features/data/useComparisonData.ts`, o mesmo hook da página Explore.

**Comparação com dados reais (15/11/2026).** A regra "o leitor de tela é o único narrador" continua valendo para a comparação: ela não usa `speechSynthesis`. Estados novos seguem os padrões acima:

- carregamento e conclusão em `role="status"`, uma mensagem cada; erro em `role="alert"`;
- o botão Play da comparação nunca sai da ordem de Tab: enquanto os dados não estão prontos (ou as regiões não são comparáveis), ele fica com `aria-disabled="true"` e `aria-describedby` apontando para o motivo;
- o slider de posição tem rótulo visível ("Playback position").

**Removidos nesta refatoração:**

- `GuidedExperiencePanel.tsx` (painel visual, lista de etapas e menus duplicados);
- `GuidedExperienceButton.tsx` (botões visíveis na Home e na Explore);
- os estilos `.guided-*`;
- a navegação Home → Explore com `focusManagedByPage`.

## Critérios de aceite

| Critério                                             | Status       | Evidência (teste automatizado)                                                                                               |
| ---------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Não existe tour visual nem painel adicional          | Atendido     | Nenhum elemento `.guided-*` no DOM; o guia mede 1×1 px sem foco                                                              |
| A interface visual principal está preservada         | Atendido     | Home e Explore sem os botões visíveis; o guia só aparece com foco de teclado                                                 |
| Orientações contextuais na navegação natural         | Atendido     | Dica da página, descrição do grupo de regiões e do menu "Listen to" na árvore de acessibilidade                              |
| Conteúdo oculto acessível ao leitor de tela          | Atendido     | O guia, mesmo recortado, tem título e conteúdo na árvore; sem `display:none`, `visibility:hidden`, `hidden` ou `aria-hidden` |
| Opção acessível para consultar o guia                | Atendido     | Botão com nome, descrição e `aria-expanded`; landmark "Guided experience"                                                    |
| Iniciar, avançar, voltar, pular e encerrar           | Atendido     | Foco no título correto a cada passo; restauração do foco ao fechar ou finalizar                                              |
| Sem duplicação excessiva de anúncios                 | Atendido     | Nenhuma mensagem de status ao iniciar ou navegar o guia                                                                      |
| Controles originais reutilizados                     | Atendido     | Exatamente 2 menus de região na página; o guia usa links para os controles reais                                             |
| Descrições científicas a partir dos dados existentes | Atendido     | Os 9 fatos da etapa 4 aparecem na descrição do botão Play; com dados reais, os números do guia e da página coincidem (E2E de 15/11/2026) |
| Sem voz própria nem reconhecimento de voz            | Atendido     | Nenhum uso de Speech APIs; contador de `speechSynthesis.speak` igual a 0                                                     |
| Nenhum áudio automático                              | Atendido     | Nível de saída 0 ao carregar e durante todo o guia, em todas as páginas                                                      |
| Melhorias anteriores funcionando                     | Atendido     | Player (modos, avisos), sonificação de imagem, resumo e tabela, mapa e legenda da imagem verificados                         |
| Validação com VoiceOver/NVDA                         | **Pendente** | Não executada: ambiente sem interface gráfica interativa nem Windows                                                         |
