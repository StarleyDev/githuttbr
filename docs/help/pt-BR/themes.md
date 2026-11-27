---
title: Temas e aparência
category: Deixe do seu jeito
order: 100
summary: Temas nativos, claros e escuros, mais os personalizados e os gerados por IA.
keywords: tema temas theme themes escuro dark claro light aparência cores tamanho da fonte grafo graph paleta buscar pesquisar configurações encontrar search settings ícone ícones cores dos ícones icon colors tom monocromático
---

# Temas e aparência

Temas nativos — GitHuttBr, Nord, Dracula, Solarized, GitHub, Monokai, Midnight,
Contrast e Daltonic — cada um com uma variante clara e uma escura.

![Trocando do claro para o escuro](../../screenshots/clip-themes.webp)

- **Claro, escuro, ou seguir o sistema**, trocado ao vivo.
- **Temas personalizados**, e temas **gerados por IA** a partir de um prompt.
- **Tamanho da fonte de código** ajustável.
- **Cores dos ícones** da barra de ferramentas e das seções da lateral (veja abaixo).
- A **aparência do grafo** — paleta das faixas, cantos, densidade das linhas e espessura, com uma prévia ao vivo — tem página própria, **Configurações → Grafo**: veja [o grafo de commits](graph.md).

![Configurações de tema](../../screenshots/settings-themes.webp)

## Cores dos ícones

Uma fileira de ícones cinza deixa Fetch, Push e Stash parecidos até você ler o
nome. **Cores dos ícones**, abaixo de Aparência na aba Tema, colore cada ícone
pelo que ele faz, e o olho acha a ação antes da palavra:

| Papel | Ícones | Cor do tema |
|---|---|---|
| Receber | Fetch, Pull, Remotes, Worktrees | o espaço ciano do tema |
| Enviar, concluir | Push, Todos, Issues, Releases | verde |
| Refs | Branch, Locais, Tags, Pull requests, Milestones, Submodules | o destaque (accent) |
| Guardar | Stash, Pop, Stashes, Bookmarks, Fixada | o espaço laranja do tema |

Desfazer, Refazer, Ferramentas e Configurações ficam cinza: são utilitários, e deixá-los neutros
é o que faz os coloridos se destacarem.

Listas que agrupam muitas entradas colorem um grupo inteiro de uma vez, para o
grupo se ler como uma família:

- **Menu Ferramentas**: a volta no tempo (Reflog, Snapshots, Time machine, Bisect) em
  laranja; as ferramentas de branch (Absorb, os radares, Local CI, comparações)
  no destaque; e uma cor por grupo: Inspecionar ciano, Branches e histórico no
  destaque, Arquivos e patches verde, Repositório laranja, Segredos e
  compartilhamento vermelho.
- **Páginas das Configurações** — Layout e terminal, Workspaces e IA na cor de destaque; Perfil e identidade, Analisadores de código e Ambiente em verde; Contas conectadas, Git e sincronização e Dados e backup em ciano; Temas e Grafo em laranja; Segurança e confirmações em vermelho. Geral, Atalhos e Sobre ficam cinza.

Uma fileira de botões só com ícone, sem nome, faz o contrário: cada botão ganha
a sua cor, para se distinguirem. Na [página do pull request](pull-requests.md),
os botões do cabeçalho ficam assim: atualizar azul, revisão com IA no destaque,
pré-visualizar localmente verde-azulado, ir para a branch de origem verde e ir
para a branch de destino laranja (abrir no navegador fica cinza); nos seus
comentários, ali e na página da issue, **Editar** fica no destaque e **Excluir** vermelho. O azul e o
verde-azulado são misturas das cores do tema, então também acompanham o tema.

Os menus de clique direito de commits, branches e repositórios — os commits,
stashes e etiquetas de branch ou tag do grafo, as branches, tags e stashes da
lateral, o seletor de branch, o menu que um arrastar e soltar abre, e o menu de
um repositório na aba, no chip do grupo, na página Repositórios e no lançador —
dão a cada linha um ícone colorido pelo que a ação faz, do mesmo jeito em todos
eles:

| Cor | Ações |
|---|---|
| Referências (destaque) | fazer checkout, criar branch ou tag, merge, rebase, cherry-pick, revert, comparar, renomear, worktree, squash, fixup; o apelido de um repositório e movê-lo para um grupo, pasta ou workspace |
| Saída (verde) | push, criar pull request, abrir no host, ir para a release, exportar patch |
| Entrada (ciano) | pull, fast-forward |
| Guardados (laranja) | aplicar ou tirar um stash, fixar, favoritar, copiar, amend, editar a mensagem |
| Segurança (vermelho) | reset, excluir, descartar, desfazer o commit, mover uma branch, remover da lista, fechar |
| Prévia (verde-azulado) | range-diff, radar de conflitos, Local CI, mostrar worktrees, abrir no terminal, no gerenciador de arquivos ou no editor |

Uma linha destrutiva fica toda vermelha, ícone incluído, como sempre ficou.

| Opção | O que aparece |
|---|---|
| **Monocromático** | Todos os ícones cinza, como antes desta opção |
| **Tom suave** (padrão) | A cor misturada ao cinza; a cor inteira ao passar o mouse |
| **Cor plena** | A própria cor, sobre um fundo pequeno do mesmo tom |

As cores vêm do tema: um tema que muda o verde ou o destaque muda os ícones
junto, inclusive os temas personalizados e os gerados por IA.

**Paleta** escolhe que cor cada função recebe. Cada amostra mostra as suas
cinco cores (entrada, saída, referências, guardados, segurança):

| Paleta | Entrada · Saída · Referências · Guardados · Segurança |
|---|---|
| **Do tema** (padrão) | ciano · verde · destaque · laranja · vermelho — a tabela acima |
| **Fria** | destaque · verde-azulado · roxo · lavanda · vinho |
| **Quente** | laranja · amarelo · magenta · oliva · vermelho |
| **Natureza** | verde-azulado · verde · lima · amarelo · vermelho |
| **Pôr do sol** | roxo · laranja · magenta · amarelo · vermelho |
| **Uma cor** | tudo no destaque; segurança continua vermelha |

Toda paleta é feita das cores do próprio tema e de misturas delas, então muda
junto com o tema e mantém o contraste no claro e no escuro. A fileira de botões
da página de pull request também segue a paleta, cada botão com a função mais
próxima dele. Segurança continua vermelha na maioria das paletas porque é um
aviso; com **Monocromático** a paleta não tem o que colorir.

Limites: só os botões principais da barra, os cabeçalhos das seções da lateral,
o menu Ferramentas, os menus de clique direito de commits, branches e repositórios, as páginas das Configurações e das configurações do repositório e os botões das páginas de pull
request e de issue ganham cor; os outros menus, as
linhas dentro das seções e o grafo não. Uma linha de menu sob o mouse mantém o
visual de sempre, ícone incluído. A cor nunca é a
única pista: todo ícone mantém o nome.

## Como as Configurações se organizam

O menu lateral agrupa as páginas pelo assunto:

| Grupo | Páginas |
|---|---|
| **Você** | Perfil e identidade · Contas conectadas · IA — as duas primeiras editam o perfil nomeado no título ([perfis](profiles.md)) |
| **Aparência** | Temas · Grafo · Layout e terminal |
| **Comportamento** | Geral · Git e sincronização · Segurança e confirmações · Analisadores de código |
| **Sistema** | Workspaces · Atalhos · Ambiente · Dados e backup · Sobre |

Geral guarda só o que é do app como um todo — Idioma, As abas de repositório mostram, Notificações do sistema, Abrir o changelog depois das atualizações, Avisar ao fechar. O resto que ficava ali foi para a página a que pertence, e a nota da própria página leva até lá:

| Opção | Agora em |
|---|---|
| Commits carregados no início, Commits por “carregar mais”, Carregar mais automaticamente ao rolar, Datas relativas, Mostrar avatares, Usar fotos de perfil do GitHub | **Grafo** — junto com Paleta das faixas, Cantos das linhas, Densidade das linhas, Estilo dos nós, Foco do grafo, Layout dos stashes, Espessura das linhas, que eram a aba Grafo de Temas |
| Fetch automático a cada (minutos), Sempre criar um commit de merge, Lembrar resoluções de conflito, Ferramentas externas de diff e merge, Editor externo, App padrão do “Abrir com” | **Git e sincronização** |
| Confirmar antes de um force push | **Segurança e confirmações** |
| Analisadores de código, launch.json | **Analisadores de código** |
| Visualizador de arquivos, Animar o avatar do perfil, Ocultar tarefas concluídas, Agrupar refs por prefixo | **Layout e terminal** |

Integrações agora é **Contas conectadas** e Dados é **Dados e backup**. Nada mudou no que cada opção faz, e as configurações salvas continuam como estão. Um link que abre uma página pelo nome antigo ainda chega à página certa.

## Encontrar uma configuração

As Configurações se espalham por muitas páginas, e a opção que você quer raramente está onde
você imagina: você sabe que ela existe, não em qual página fica. O campo de
busca no cabeçalho das Configurações, ao lado do botão de fechar, procura em
todas as páginas de uma vez.

![Buscando “terminal” nas configurações](../../screenshots/settings-search.webp)

Enquanto você digita, o lado direito lista as configurações encontradas,
agrupadas por página — cada uma com o nome, a descrição de uma linha e a página
onde fica. A barra lateral esmaece as páginas sem resultado e mostra a contagem
nas que têm.

- Ela compara o nome da opção, a descrição e o nome da página — também a página em que a opção ficava antes de o menu ser reagrupado, então "general fetch" ainda acha a busca automática em Git e sincronização, e "integrations" acha Contas conectadas. Maiúsculas e acentos são ignorados, e cada palavra digitada precisa aparecer, então "terminal font" se reduz às opções de fonte do terminal.
- Ela procura no idioma da interface e em inglês ao mesmo tempo: com o app em
  português, digitar "token" ou "font" ainda acha a configuração.
- Clique num resultado, ou tecle **Enter** para o primeiro, para abrir a página, rolar até a opção e destacá-la por um instante.
- **Esc** limpa a busca; um segundo **Esc** fecha as Configurações.

A busca olha nomes e descrições, não os valores que você definiu. As listas de
servidores por host em Integrações (GitHub Enterprise Server, GitLab
autogerenciado, Bitbucket Data Center) abrem a página Integrações; a aba do host
você escolhe. Atalhos de teclado individuais não são indexados — a busca acha a
página Atalhos, cujo editor lista todos eles.

## Layout

Barra lateral à esquerda ou à direita, painéis redimensionáveis por toda parte, uma
barra lateral colapsável para quando o grafo merece a janela inteira, e posição do
terminal por repositório.

A mesma página, **Configurações → Layout e terminal**, também guarda os extras da barra de título e da barra lateral — **Animar o avatar do perfil**, **Ocultar tarefas concluídas**, **Agrupar refs por prefixo** — e a margem de alterações e o minimapa do visualizador de arquivos.

**Veja também:** [O grafo de commits](graph.md) · [Perfis](profiles.md)
