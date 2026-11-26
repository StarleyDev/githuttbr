---
title: Escrever comentários
category: Sincronização e vários repositórios
order: 57.5
summary: O editor de Markdown por trás de toda caixa de comentário — Escrever / Visualizar, uma barra de formatação com os atalhos do GitHub, listas que continuam no Enter e sugestões de @menção / #referência.
keywords: editor markdown caixa de comentário barra de ferramentas negrito itálico código link citação título lista com marcadores numerada tarefas checklist visualizar escrever atalho menção arroba referência cerquilha número da issue autocompletar resposta descrição do pull request corpo da issue
source: cc7673de22ce745f04a0341c4d263219c432b693
---

# Escrever comentários

Um comentário enviado ao GitHub é Markdown, e uma caixa de texto simples deixa
você digitar cada `**` e `- [ ]` na mão, para depois descobrir no navegador se
a tabela saiu certa. Toda caixa do app que escreve num host agora é o mesmo
editor, com as ferramentas da caixa de comentário do próprio GitHub:

- a caixa de comentário de um pull request, as respostas nas threads e os
  comentários de linha ([Página de pull requests](pull-requests.md));
- a caixa de comentário de uma issue;
- a descrição de um novo pull request e o corpo de uma nova issue
  ([Hosting e pull requests](hosting.md)).

![A caixa de comentário de um pull request, com a barra de formatação e a lista de pessoas para mencionar aberta em "@al"](../../screenshots/comment-editor.webp)

## Escrever e Visualizar

**Visualizar** mostra o texto como ele vai aparecer, desenhado pelo mesmo
renderizador de Markdown do resto do app. É só leitura; **Escrever** traz de
volta o campo com o texto e o cursor onde você deixou, então ⌘/Ctrl+Z ainda
desfaz o que você digitou antes de olhar.

As abas são uma lista de abas: com uma delas em foco, ← e → alternam entre elas.

## A barra de ferramentas

| Ferramenta | Atalho | O que faz |
|---|---|---|
| **Título** | — | Um menu com H1, H2 e H3 para as linhas selecionadas; escolher o nível que a linha já tem remove o título |
| **Negrito** | ⌘/Ctrl+B | `**texto**` |
| **Itálico** | ⌘/Ctrl+I | `_texto_` |
| **Código** | ⌘/Ctrl+E | `` `código` `` dentro de uma linha; um bloco cercado por ```` ``` ```` quando a seleção pega várias linhas |
| **Link** | ⌘/Ctrl+K | `[texto](url)` — uma URL selecionada vira o endereço, outro texto vira o rótulo |
| **Citação** | — | `> ` em cada linha selecionada |
| **Lista com marcadores** | ⌘/Ctrl+Shift+8 | `- ` em cada linha selecionada |
| **Lista numerada** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… em cada linha selecionada |
| **Lista de tarefas** | — | `- [ ] ` em cada linha selecionada |

Toda ferramenta liga e desliga: aplicada a um texto que já tem a formatação,
ela tira. Sem nada selecionado, negrito, itálico, código e link inserem um texto
de exemplo e o selecionam, pronto para você digitar por cima. Uma ferramenta de
lista troca uma lista de outro tipo em vez de empilhar as duas.

As edições passam pela edição do próprio campo de texto, então **⌘/Ctrl+Z
desfaz uma ferramenta** exatamente como uma palavra digitada, e refazer traz de
volta.

A barra é uma parada só para o Tab; ← → andam entre os botões, e ↓ abre o menu
de títulos. Dentro de uma caixa de comentário, ⌘/Ctrl+K cria um link em vez de
abrir a paleta de comandos. No Mac os atalhos usam só o ⌘, então Ctrl+B, Ctrl+E
e Ctrl+K continuam fazendo o que os campos de texto do macOS fazem com eles. Num
layout de teclado cujas letras não são latinas, os atalhos seguem as teclas
físicas B, I, E e K.

## Listas

**Enter** no fim de um item de lista começa o próximo — o mesmo marcador, o
número seguinte, um `- [ ]` vazio para uma tarefa — na mesma indentação. Enter
num item sem nada depois do marcador termina a lista e remove o marcador.
Shift+Enter é uma quebra de linha simples.

## Menções e referências

Digitar **@** abre uma lista curta de pessoas, que vai se estreitando conforme
você digita; **#** lista pull requests e issues por número e título (`#42`, ou
`#busca` para uma palavra do título). ↑ ↓ escolhem, Enter ou Tab inserem, Esc
fecha a lista — só a lista, não a caixa nem o diálogo em volta.

A lista vem do que o app já tem, sem perguntar de novo ao host:

| Caixa | @ oferece | # oferece |
|---|---|---|
| Pull request | O autor, os revisores, os responsáveis e todo mundo que comentou | Os pull requests e issues abertos do repositório, como carregados na barra lateral |
| Issue | O autor, os responsáveis e quem comentou | O mesmo |
| Novo pull request | As pessoas que os seletores de revisores e responsáveis leram, e os autores dos pull requests carregados | O mesmo |
| Nova issue | Os autores dos pull requests e issues carregados | O mesmo |

Um **@** ou **#** no meio de uma palavra (um endereço de e-mail), o `#` de um
título e qualquer coisa dentro de código ficam de fora.

## Enviar

⌘/Ctrl+Enter envia de qualquer caixa: um comentário de pull request ou de
issue, uma resposta de thread, um comentário de linha e a descrição de uma nova
issue. Funciona também a partir das abas, da barra e da visualização, não só do
campo. Esc cancela um comentário de linha, dos mesmos lugares. Uma **resposta
de thread** era um campo de uma linha enviado com Enter; agora é uma caixa de
texto pequena, então Enter é uma linha nova (ou o próximo item da lista) e
⌘/Ctrl+Enter envia. A caixa de resposta mostra as abas e as ferramentas quando
você clica nela, para que uma conversa longa não ganhe uma barra embaixo de
cada thread.

## O guia rápido

**Markdown suportado**, embaixo de cada caixa, abre um guia rápido ali mesmo:
cada formato, o que digitar para ele e o atalho. Esc ou um clique fora fecha o
guia. Nada do que você está escrevendo sai do lugar.

No rodapé, **Abrir o guia completo** abre esta página. O manual é uma aba
própria, então ir até ele sai da página onde a caixa está, e o texto não
enviado dela se perderia: quando há algum — nesta caixa ou em qualquer outra da
página do pull request — o app pergunta antes. Nos diálogos de novo pull
request e nova issue o guia rápido não tem esse link, já que o manual abriria
atrás do diálogo.

## Limites

- **Sem anexos.** Arrastar um arquivo ou colar uma imagem na caixa não faz
  upload: o GitHub não tem API pública para anexos de comentário, então não há
  onde colocar o arquivo. Envie pelo site e cole o link.
- **Só quem e o que já está carregado.** O @ não busca os usuários do host, e o
  # não busca todas as issues — uma pessoa que não participou da conversa, ou
  uma issue fechada que a barra lateral não leu, não aparece. Você ainda pode
  digitar o nome ou o número inteiro.
- **Sem sugestão de alteração, respostas salvas ou seletor de emoji.**
- **A visualização é o renderizador do app.** Mostra o Markdown como o app
  desenha; a renderização do host pode diferir em detalhes (extensões próprias
  do GitHub, menções viradas em links).
- **A visualização é o desenho do app, não o do host.** Nas páginas de pull
  request e de issue, a visualização desenha o texto como o comentário enviado
  vai aparecer no app ([como os comentários aparecem](pull-requests.md#como-os-comentários-aparecem)):
  o mesmo perfil restrito, as quebras de linha mantidas, e uma imagem de outro
  site esperando um clique. No GitHub o comentário enviado passa a ser desenhado
  pelo GitHub, então uma extensão que o app não conhece pode aparecer
  diferente. Os diálogos de novo pull request e nova issue usam a visualização
  Markdown comum do app.
- Os atalhos são fixos: não aparecem nas configurações de atalhos e não seguem
  uma troca feita lá.
