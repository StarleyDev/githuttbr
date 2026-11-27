---
title: Edite qualquer commit
category: Branches e cirurgia
order: 46
summary: Reescreva os arquivos ou a mensagem de um commit histórico no lugar — com a cascata em prévia antes.
keywords: editar commit edit reescrever rewrite história history amend passado reword corrigir erro de digitação typo cascata cascade replay rebase no lugar cirurgia
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Edite qualquer commit

O erro de digitação está num commit de três semanas atrás. A solução de sempre é
um rebase interativo: parar no commit, editar, continuar, rezar. A solução do
GitHuttBr: clique com o botão direito no commit, **Editar este commit**, mude o
texto, pronto. O botão de caneta no painel de detalhes do commit abre o mesmo
editor.

![Editando um commit histórico](../../screenshots/commit-edit.webp)

## O que ele faz

Escolha qualquer commit que seja ancestral do `HEAD` — com história linear ou
não. O editor mostra os arquivos e a mensagem dele; edite qualquer um dos dois.

A mensagem tem as mesmas ferramentas do [compositor de commit](committing.md): o
resumo com o contador de tamanho e a descrição abaixo dele, a linha de estilo
atrás da seta (tipo e escopo Conventional, chave do ticket, estilo de commit), o
seletor de gitmoji, os coautores e as dicas do linter. A mensagem do commit é
dividida ao carregar — a primeira linha vira o resumo, o resto a descrição — e
juntada de volta com uma linha em branco quando você reescreve. Transformar um
velho `add retry` em `fix: add retry` é escolher um item da lista de tipos.

Editar um arquivo é ler o arquivo, então o editor não se espreme num diálogo:
ele abre no painel central, no lugar do grafo de commits — onde abrem o
resolvedor de conflitos e o visualizador de arquivos — e ocupa toda a largura e
altura da janela. **Esc** ou o **×** no cabeçalho fecha o editor. Suas edições
sobrevivem a trocar de aba de repositório e voltar, e fechar com edições não
salvas pede confirmação antes.

A partir daí acontecem duas coisas:

1. **Prévia da cascata** reaplica cada commit acima do editado *em memória*
   (uma cadeia de cherry-picks via `merge-tree` — sem checkout, sem working
   tree, sem refs). Cada descendente aparece verde ou vermelho, então você sabe
   **antes de qualquer coisa se mover** se a edição se propaga limpa ou colide
   com uma mudança posterior.
2. **Reescrever a história** faz de verdade: a mesma cadeia é construída com
   plumbing, e então a branch se move com `reset --keep` — suas mudanças não
   commitadas são levadas junto, ou o reset aborta e nada aconteceu. Um
   [snapshot de guarda](recovery.md) é tirado antes, e o desfazer restaura a
   cadeia antiga.

Autoria e datas de cada commit reaplicado são preservadas; só os hashes mudam —
é isso que reescrever a história significa.

## Merges no intervalo

![Editando um commit abaixo de dois merges — a cascata os reaplica](../../screenshots/commit-edit-merges.webp)

Um merge entre o commit e o `HEAD` não desabilita mais a edição. A cascata
reaplica um merge aplicando de novo o seu **resultado registrado** — a árvore
que o merge de fato commitou, resoluções de conflito incluídas — sobre o pai
reescrito, então resoluções que alguém fez à mão sobrevivem à reescrita ao pé
da letra. Sem rerere, sem re-merge, sem worktree: o mesmo plumbing em memória
do resto da cascata, e os dois ponteiros de pai são preservados. Uma branch
lateral que também contém o commit editado é reescrita e reapontada; uma que
não contém mantém sua identidade intocada. O banner do editor diz quantos
merges o intervalo carrega, e os passos de merge mostram um ícone de merge na
prévia.

A ressalva honesta: um merge reaplicado é só tão bom quanto o seu resultado
registrado. Se a sua edição colide com linhas que o próprio merge resolveu, a
prévia fica vermelha exatamente como qualquer outro passo em conflito — nada
é adivinhado.

## Quando a cascata conflita

Um commit posterior tocou as mesmas linhas que você está editando. A prévia
marca esse commit em vermelho com os arquivos em conflito e a reescrita se
recusa a rodar — nada fica aplicado pela metade, nunca. Ou edite de outro jeito,
ou encare o conflito de frente com um [rebase interativo](rebase.md).

## Limites

- **O commit precisa ser ancestral do `HEAD`.** Um commit numa branch lateral
  ainda não mergeada não tem caminho até a sua branch atual para ser
  reaplicado.
- Arquivos binários e arquivos com mais de 2 MB são mostrados, mas não são
  editáveis.
- Um commit que já está num remote pode ser editado, mas o seu próximo push terá
  que ser um **force push** — o editor avisa antes de você se comprometer com
  isso.
- Arquivos deletados no commit não podem ser editados (não há conteúdo para
  editar).

**Veja também:** [Rebase interativo](rebase.md) · [Recuperação e o reflog](recovery.md) · [Absorb](absorb.md)
