---
title: Limpeza de branches
category: Branches e cirurgia
order: 47
summary: Apague as branches locais cujo trabalho já está em outro lugar — upstreams removidos, branches mescladas — num único passo desfazível.
keywords: limpar limpeza clean up cleanup prune apagar excluir remover branches locais gone removida mesclada merged squash parada stale mortas antigas pull request organizar lista de branches
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Limpeza de branches

Cada pull request que você abre localmente deixa uma branch para trás. O PR é
mesclado, o servidor apaga a branch dele, e a local fica — para sempre. Depois
de algumas centenas de revisões, a lista de branches é quase só branch morta, e
achar as vivas exige rolar por todas elas.

A limpeza de branches lista as branches locais cujo trabalho já está seguro em
outro lugar, marca as que não têm nada a perder e apaga todas num único passo
que pode ser desfeito. "Outro lugar" quer dizer as branches remotas como
estavam no último fetch, e a branch padrão.

![A limpeza com as branches removidas, mescladas e mescladas com squash marcadas, e o trabalho que só existe aqui de fora](../../screenshots/branch-cleanup.webp)

## Como funciona

1. Ferramentas → **Limpar branches locais…** (ou <kbd>⌘K</kbd>).
2. Se o último fetch for antigo, aperte antes **Fetch e prune**. Enquanto um
   fetch com prune não roda, uma branch que o servidor apagou ainda parece viva
   aqui.
3. Se o seu time mescla pull requests com squash, aperte **Verificar merges com
   squash** (veja abaixo).
4. Confira as marcações e clique em **Apagar**. Uma única confirmação diz
   quantas branches vão embora e cita cada uma que guarda commits que não
   existem em nenhum outro lugar.

A exclusão é uma operação só, com uma entrada de desfazer: **Desfazer** recria
cada branch apagada exatamente no commit para o qual apontava, com o upstream
(`branch.<nome>.remote` e `.merge`) de volta. Se nesse meio-tempo surgiu outra
branch com o mesmo nome em outro commit — o mesmo PR aberto de novo — o
desfazer não mexe nela e traz a apagada ao lado, como
`<nome>-restored-<sha curto>`, e avisa.

A mensagem de sucesso e a entrada de desfazer listam cada branch com o commit
para o qual apontava (`feature/x (era abc1234)`), como o `git branch -D`
imprime: o histórico de desfazer só vive enquanto o app está aberto, e essa
linha basta para recriar uma branch à mão.

## Por que uma branch aparece

| Selo | Significa |
|---|---|
| **Removida** | A branch acompanha um upstream que o servidor apagou — o rastro comum de um pull request mesclado. |
| **Mesclada** | Todos os commits dela já estão na branch padrão. A dica diz qual cópia a contém — `main (local, sem push)` quando só a sua local contém. |
| **Squash** | Achada por **Verificar merges com squash**: o conteúdo dela está na branch padrão, os commits individuais não. |
| **Parada** | Nenhum commit pelo número de meses que você escolher (3 por padrão). Só aparece quando você marca **Listar também branches paradas**. |
| **N commits existem só aqui** | Commits que não estão em nenhuma branch remota nem na branch padrão. Apagar a branch apaga esses commits. |
| **Sem commits ainda** | Ela aponta exatamente para a ponta da branch padrão — provavelmente foi criada e nunca usada. |

"Mesclada" é medido em relação à cópia remota da branch padrão (`origin/main`)
e também em relação à sua cópia local — um `main` local sem pull há um mês não
consegue esconder os merges feitos desde então.

## Merges com squash

Um merge com squash põe as mudanças de um pull request no `main` como um único
commit novo; os commits da própria branch nunca chegam lá. Para o git, essa
branch parece trabalho abandonado: **Removida**, com *N commits existem só
aqui*.

Quando há branches removidas com commits próprios na lista, **Verificar merges
com squash** faz outra pergunta: mesclar esta branch no `main` mudaria alguma
coisa? Ela roda um único `git merge-tree` em memória para todas — sem checkout,
sem índice — e a branch cujo merge deixa a árvore do `main` exatamente como
está ganha o selo **Squash** e vem marcada como uma mesclada. A confirmação diz
que o conteúdo delas está no `main` e os commits não.

A verificação roda de novo, sob o lock, na hora da exclusão: uma branch que não
passa mais nela é recusada, não apagada.

## O que vem marcado, e o que nunca vem

Marcadas ao abrir: branches **removidas ou mescladas** e **sem commits
próprios** — e as mescladas com squash, depois da verificação. **Selecionar
removidas + mescladas** volta a essa seleção.

Nunca marcada por você, e nunca alcançada por **Selecionar todos os exibidos**:
uma branch com commits que só existem aqui. Marque linha por linha; a
confirmação então fica vermelha e a lista com a contagem de commits. Branches
apenas paradas e a que está na ponta da branch padrão também não vêm marcadas.
Quando a seleção inclui linhas que a lista não está mostrando — escondidas pelo
filtro ou além das primeiras 400 — a confirmação diz quantas.

A exclusão aceita, por branch, exatamente o número de commits únicos que a
confirmação mostrou. Se a branch tiver mais até lá — ou, no **Refazer**, tiver
ganhado commits únicos desde o desfazer (por exemplo, um prune removeu a cópia
remota) — ela é recusada e mantida, e o refazer avisa em vez de fingir sucesso.

Nunca listadas, e recusadas pela exclusão mesmo se pedidas:

- a branch atual;
- uma branch em uso em qualquer worktree, ou em rebase em um deles;
- a branch padrão;
- [branches protegidas](repo-settings.md), inclusive padrões como `release/*`
  vindos da [configuração do repositório](repo-config.md).

Nada muda no remoto. Só branches locais são apagadas.

## Limites

- **Merges com squash são invisíveis para o git** até você verificar. Sem
  **Verificar merges com squash**, uma branch mesclada com squash aparece como
  **Removida** com *N commits existem só aqui*, e não vem marcada.
- **A verificação de squash pode deixar passar.** Ela responde "este conteúdo
  já está no `main`?". Quando o `main` depois mudou as mesmas linhas de novo, ou
  o squash foi editado na hora do merge, o merge mudaria algo, e a branch fica
  sem marcar. Ela nunca diz sim de um jeito que perca conteúdo: por definição,
  o conteúdo está no `main`. Como o [radar de conflitos](conflict-radar.md), ela
  grava objetos de árvore soltos, que o `git gc` limpa.
- **Um remoto sem fetch está desatualizado.** "Removida" vem do último fetch.
  Sem **Fetch e prune**, uma branch apagada no servidor há uma hora ainda parece
  viva, e um merge recente ainda não está em `origin/main`.
- **Parada é só uma data.** Três meses sem movimento não dizem se o trabalho
  está seguro, e por isso as linhas paradas nunca vêm marcadas.
- **"Outro lugar" são as refs remotas do último fetch**, não o servidor agora —
  e não as tags. Um commit que só uma tag guarda conta como único, e um commit
  que está na branch remota de outra pessoa não conta.
- A contagem de commits únicos para em 500 e mostra *500+*. O total da
  confirmação é um piso — *pelo menos N* — porque branches empilhadas
  compartilham commits.
- Desfazer restaura a branch e o upstream dela, não o reflog nem outras
  configurações `branch.<nome>.*`.
- A janela mostra as primeiras 400 linhas de uma lista longa; o filtro acha o
  resto. **Selecionar removidas + mescladas** vale para todas as linhas,
  visíveis ou não.

**Veja também:** [Branches, remotes e a barra lateral](branching.md) · [Fetch, pull e push](syncing.md) · [Pull requests](pull-requests.md)
