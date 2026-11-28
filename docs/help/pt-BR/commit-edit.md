---
title: Edite qualquer commit
category: Branches e cirurgia
order: 46
summary: Reescreva os arquivos ou a mensagem de um commit histórico no lugar — com a cascata em prévia antes.
keywords: editar commit edit reescrever rewrite história history amend passado reword corrigir erro de digitação typo cascata cascade replay rebase no lugar cirurgia comparar com o original adicionar arquivo o que vai acontecer alterações não aplicadas
source: 66a1f238c2653a8cb3f921a816c700352e338644
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
não. O editor abre no painel central, no lugar do grafo de commits — onde abrem
o resolvedor de conflitos e o visualizador de arquivos — e ocupa toda a largura
e altura da janela. **Esc** ou o **×** no cabeçalho fecha o editor. Suas edições
sobrevivem a trocar de aba de repositório e voltar, e fechar com alterações não
aplicadas pede confirmação antes.

O cabeçalho identifica o commit — hash curto, assunto, autor e idade — e, assim
que você muda algo, uma pílula amarela conta as **alterações não aplicadas**:
uma para a mensagem e uma para cada arquivo editado.

### O cartão da mensagem

A mensagem tem as mesmas ferramentas do [compositor de commit](committing.md): o
botão **tipo ▾** antes do resumo, o resumo com o contador de tamanho (*56/72*) e
a descrição abaixo dele, a linha de estilo atrás da seta (escopo, chave do
ticket, estilo de commit), o
seletor de gitmoji, os coautores, a geração por IA a partir do diff do próprio
commit e as dicas do linter. A mensagem do commit é dividida ao carregar — a
primeira linha vira o resumo, o resto a descrição — e juntada de volta com uma
linha em branco quando você reescreve. Transformar um velho `add retry` em
`fix: add retry` é escolher um item no botão de tipo.

Assim que a mensagem fica diferente da original, o cartão ganha a marca
**alterada**, o assunto antigo continua visível abaixo da descrição como
*antes: …*, e **Voltar ao original** restaura resumo e descrição.

### O cartão dos arquivos

Os arquivos do commit aparecem com a letra de status; um ponto marca cada um
que você alterou. Escolha um arquivo para editá-lo como ele estava naquele
commit; as linhas que você muda ou acrescenta ficam com um fundo enquanto você
digita, para a sua edição ficar à vista. O seletor acima do editor alterna entre **Editar** e **Comparar com o
original**, que mostra o diff do arquivo entre o que o commit guarda e o texto
editado — a mesma visualização de diff do resto do app.

**Adicionar arquivo** abre um arquivo que o commit não tocou, do snapshot do
próprio commit: digite parte do caminho e escolha. Depois que você o edita, o
commit reescrito passa a alterar esse arquivo também. Ele aparece com um **+**
na lista.

![Comparando um arquivo editado com o original do commit](../../screenshots/commit-edit-compare.webp)

### O que vai acontecer

O painel ao lado dos cartões — embaixo deles numa janela estreita — mostra a
cadeia que a reescrita toca: cada commit acima do editado, do `HEAD` para baixo,
e o próprio commit editado no fim, com o que muda nele.

1. **Prévia da cascata** reaplica cada commit acima do editado *em memória*
   (uma cadeia de cherry-picks via `merge-tree` — sem checkout, sem working
   tree, sem refs). Cada commit da cadeia passa a dizer se **reaplica sem
   conflito** ou tem **conflito** num arquivo nomeado, então você sabe **antes
   de qualquer coisa se mover** se a edição se propaga limpa ou colide com uma
   mudança posterior. Qualquer nova edição limpa os resultados; **Pré-visualizar
   de novo** roda outra vez.
2. **Reescrever histórico** faz de verdade: a mesma cadeia é construída com
   plumbing, e então a branch se move com `reset --keep` — suas mudanças não
   commitadas são levadas junto, ou o reset aborta e nada aconteceu. Um
   [snapshot de guarda](recovery.md) é tirado antes, e o **Desfazer** restaura a
   cadeia antiga.

Quando o commit já está num remoto, um aviso amarelo nomeia a branch remota e
diz o que isso significa: o próximo push precisa ser forçado. Outra nota diz
quantos commits ganham hashes novos.

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
não contém mantém sua identidade intocada. Uma nota no painel lateral diz
quantos merges o intervalo carrega, e os commits de merge mostram um ícone de
merge na cadeia.

A ressalva honesta: um merge reaplicado é só tão bom quanto o seu resultado
registrado. Se a sua edição colide com linhas que o próprio merge resolveu, a
prévia fica vermelha exatamente como qualquer outro passo em conflito — nada
é adivinhado.

## Quando a cascata conflita

Um commit posterior tocou as mesmas linhas que você está editando. A prévia
marca esse commit com o arquivo em conflito, os commits acima dele como não
reaplicados, e **Reescrever histórico** fica desligado — nada fica aplicado pela
metade, nunca. Diferente de um rebase, o editor não para no meio para você
resolver o conflito: ou edite de outro jeito, ou encare o conflito de frente com
um [rebase interativo](rebase.md).

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
- **Adicionar arquivo** alcança arquivos que já existem no snapshot do commit;
  não cria um arquivo novo, não apaga um, nem mexe em symlink ou submódulo.

**Veja também:** [Rebase interativo](rebase.md) · [Recuperação e o reflog](recovery.md) · [Absorb](absorb.md)
