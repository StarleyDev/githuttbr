---
title: Limpeza de branches
category: Branches e cirurgia
order: 47
summary: Apague as branches locais cujo trabalho já está em outro lugar — upstreams removidos, branches mescladas — num único passo desfazível.
keywords: limpar limpeza clean up cleanup prune apagar excluir remover branches locais gone removida mesclada merged parada stale mortas antigas pull request squash organizar lista de branches
source: 0613debf63d14a278234fb18d7d24c796cc743b8
---

# Limpeza de branches

Cada pull request que você abre localmente deixa uma branch para trás. O PR é
mesclado, o servidor apaga a branch dele, e a local fica — para sempre. Depois
de algumas centenas de revisões, a lista de branches é quase só branch morta, e
achar as vivas exige rolar por todas elas.

A limpeza de branches lista as branches locais cujo trabalho já está seguro em
outro lugar, marca as que não têm nada a perder e apaga todas num único passo
que pode ser desfeito.

![A limpeza com as branches removidas e mescladas marcadas, e as mescladas com squash de fora](../../screenshots/branch-cleanup.webp)

## Como funciona

1. Ferramentas → **Limpar branches locais…** (ou <kbd>⌘K</kbd>).
2. Se o último fetch for antigo, aperte antes **Fetch e prune**. Enquanto um
   fetch com prune não roda, uma branch que o servidor apagou ainda parece viva
   aqui.
3. Confira as marcações e clique em **Apagar**. Uma única confirmação diz
   quantas branches vão embora e cita cada uma que guarda commits que não
   existem em nenhum outro lugar.

A exclusão é uma operação só, com uma entrada de desfazer: **Desfazer** recria
cada branch apagada exatamente no commit para o qual apontava, com o upstream
(`branch.<nome>.remote` e `.merge`) de volta.

## Por que uma branch aparece

| Selo | Significa |
|---|---|
| **Removida** | A branch acompanha um upstream que o servidor apagou — o rastro comum de um pull request mesclado. |
| **Mesclada** | Todos os commits dela já estão na branch padrão. |
| **Parada** | Nenhum commit pelo número de meses que você escolher (3 por padrão). Só aparece quando você marca **Listar também branches paradas**. |
| **N commits existem só aqui** | Commits que não estão em nenhuma branch remota nem na branch padrão. Apagar a branch apaga esses commits. |
| **Sem commits ainda** | Ela aponta exatamente para a ponta da branch padrão — provavelmente foi criada e nunca usada. |

"Mesclada" é medido em relação à cópia remota da branch padrão (`origin/main`)
e também em relação à sua cópia local — um `main` local sem pull há um mês não
consegue esconder os merges feitos desde então.

## O que vem marcado, e o que nunca vem

Marcadas ao abrir: branches **removidas ou mescladas** e **sem commits
próprios**. **Selecionar removidas + mescladas** volta a essa seleção.

Nunca marcadas por você: uma branch com commits que só existem aqui, uma branch
apenas parada e uma que está na ponta da branch padrão. Você ainda pode
marcá-las; a confirmação então fica vermelha e lista cada uma com a contagem de
commits.

Nunca listadas, e recusadas pela exclusão mesmo se pedidas:

- a branch atual;
- uma branch em uso em qualquer worktree;
- a branch padrão;
- [branches protegidas](repo-settings.md), inclusive padrões como `release/*`
  vindos da [configuração do repositório](repo-config.md).

Nada muda no remoto. Só branches locais são apagadas.

## Limites

- **Merges com squash são invisíveis para o git.** Os commits de um PR mesclado
  com squash nunca chegam ao `main` — chega um commit novo com o mesmo conteúdo.
  Essa branch aparece como **Removida** com *N commits existem só aqui*, e não
  vem marcada. É a leitura honesta: o git não distingue um merge com squash de
  um trabalho abandonado.
- **Um remoto sem fetch está desatualizado.** "Removida" vem do último fetch.
  Sem **Fetch e prune**, uma branch apagada no servidor há uma hora ainda parece
  viva, e um merge recente ainda não está em `origin/main`.
- **Parada é só uma data.** Três meses sem movimento não dizem se o trabalho
  está seguro, e por isso as linhas paradas nunca vêm marcadas.
- **"Existe só aqui" considera refs remotas, não tags.** Um commit que só uma
  tag guarda conta como único, e um commit que está na branch remota de outra
  pessoa não conta.
- A contagem de commits únicos para em 500 e mostra *500+*.
- Desfazer restaura a branch e o upstream dela, não o reflog nem outras
  configurações `branch.<nome>.*`.
- A janela mostra as primeiras 400 linhas de uma lista longa; o filtro acha o
  resto. A seleção e **Selecionar removidas + mescladas** valem para todas as
  linhas, visíveis ou não.

**Veja também:** [Branches, remotes e a barra lateral](branching.md) · [Fetch, pull e push](syncing.md) · [Pull requests](pull-requests.md)
