---
title: Página de pull requests
category: Sincronização e vários repositórios
order: 57
summary: Todos os pull requests de um repositório numa página — por estado, filtrados por autor, revisor, destino e CI — e ‹ › para percorrer a lista filtrada de dentro de um PR.
keywords: pull requests lista página merge requests pr mr filtro autor revisor meus aguardando minha revisão revisão pedida ci falhando branch de destino rascunhos mesclados fechados busca triagem anterior próximo alt seta navegação
source: b44a68b542915dbac197b918b6b89d1e7de48c21
---

# Página de pull requests

Um repositório movimentado tem vinte pull requests abertos ao mesmo tempo. A
barra lateral lista todos, mas uma linha para cada um diz pouco: de quem é
cada um, quais esperam por você, quais ficaram vermelhos. Descobrir isso
significava abrir cada um, ler, voltar, abrir o próximo. A **página de pull
requests** responde a essas perguntas numa tela só e, depois que você abre um
pull request, **‹ ›** levam ao próximo da mesma lista sem precisar voltar.

![A página de pull requests buscando "pix": os trechos encontrados destacados, os seus marcados com "você", um CI falhando e um rascunho](../../screenshots/pull-requests.webp)

## Como abrir

- O **ícone de lista** no cabeçalho **PULL REQUESTS** da barra lateral (*Ver
  todos os pull requests*).
- *Pull requests…* na paleta de comandos (⌘K), ou **Ferramentas → Pull
  requests…**.

Como a wiki e as [execuções de CI](ci-runs.md), a página fica presa à aba do
repositório.

## Abas

| Aba | O que mostra |
|---|---|
| **Abertos** | Todos os pull requests abertos, rascunhos incluídos |
| **Rascunhos** | Só os abertos marcados como rascunho |
| **Mesclados** | Pull requests mesclados, lidos quando você abre a aba pela primeira vez |
| **Fechados** | Fechados sem mesclar (recusados, abandonados), lidos junto com os Mesclados |

As contagens de Abertos e Rascunhos vêm da lista que a barra lateral já tem.
Mesclados e Fechados só são pedidos quando você abre uma dessas abas, e uma vez
por sessão; **Atualizar** pede de novo.

## Filtros

| Filtro | Mantém |
|---|---|
| **Buscar** | Pull requests cujo título, descrição, branches ou número contêm todas as palavras digitadas. `#482` ou `482` encontra esse número; os trechos encontrados ficam destacados no título |
| **Autor** | Um autor — cada um com quantos tem nesta aba. **Eu** vem primeiro |
| **Revisor** | Um revisor pedido, ou **Pedem minha revisão** |
| **Branch de destino** | Pull requests para essa branch |
| **Meus** | Atalho para *Autor: Eu* |
| **Aguardando minha revisão** | Atalho para *Revisor: pedem minha revisão* |
| **CI falhando** | Pull requests cujos checks no head falharam |

A linha abaixo dos filtros diz quantos pull requests da aba aparecem e quais
filtros estão ligados, com **limpar filtros** para tirar todos.

Os filtros ficam guardados por repositório **enquanto o app está aberto** — saia
da página, volte, e estão como você deixou. Eles não são salvos entre
reinícios de propósito: um filtro "meus, CI falhando" restaurado em silêncio uma
semana depois esconderia pull requests que você não pediu para esconder.

### Quem é "eu"

"Eu" é a conta com que as chamadas deste repositório entram no host — o perfil
a que o repositório está [vinculado](profiles.md), senão o ativo — perguntada
ao próprio host. Quando o token não sabe dizer quem é (sem escopo de usuário),
ou não há token, **Eu**, **Meus** e **Aguardando minha revisão** não aparecem.

## A lista

| Coluna | O que mostra |
|---|---|
| **#** | O número, com um ícone de aberto, rascunho, mesclado ou fechado |
| **Título** | O título, um selo *rascunho* e quem ainda tem revisão pedida — na cor de destaque quando é você |
| **Autor** | A foto do host, quando ele dá uma, senão a inicial, e **você** nos seus |
| **Branches** | Origem → destino |
| **Checks** | Os checks do head resumidos — `6/6`, `1 falhou`, `2 rodando`; passe o mouse para ver as contagens |
| **Atualizado** | Há quanto tempo mudou pela última vez; passe o mouse para ver a data |

As linhas são ordenadas pela atividade mais recente. Um clique abre a página do
próprio pull request ([Hosting e pull requests](hosting.md)). Num host sem essa
página, a linha abre o pull request no navegador.

Num [checkout de fork](hosting.md#your-pull-requests-on-the-parent-of-a-fork),
os seus pull requests no repositório pai também aparecem, marcados *em
dono/repo*.

## Percorrer a lista a partir de um pull request

![Um pull request aberto da lista filtrada: ‹ 1 de 4 › e os filtros de onde veio](../../screenshots/pull-request-nav.webp)

Um pull request aberto pela página mostra uma faixa acima do título:

- **← Pull requests** volta para a lista, com os filtros como você deixou.
- **‹ k de n ›** vai para o pull request anterior ou seguinte da lista de onde
  você o abriu — a lista filtrada, na ordem dela, como estava no clique. As
  dicas dizem para qual pull request cada seta leva.
- **Alt+← / Alt+→** fazem o mesmo pelo teclado. Dá para trocar os atalhos em
  **Configurações → Atalhos**. Eles ficam de lado enquanto o cursor está num
  campo de texto (onde Option+← pula palavras) e enquanto o terminal tem o foco.

Andar substitui a página no lugar, então passar por dez pull requests não deixa
dez ícones na aba; abrir outra linha da lista também a substitui.

Um pull request aberto **de qualquer outro lugar** — a barra lateral, uma
notificação — percorre os pull requests abertos do repositório na ordem padrão
da página (Abertos, sem filtros). Um que também não está nessa lista, como um
nível mesclado de uma pilha, mostra só o caminho de volta para a lista.

## Limites

- **Os pull requests abertos são a lista da barra lateral.** GitHub, GitLab e
  bitbucket.org leem os 30 primeiros; um repositório com mais mostra só esses.
  Azure DevOps, Bitbucket Data Center e Forgejo leem todos.
- **Mesclados e fechados são os 100 com atividade mais recente de cada** (no
  GitHub, dos dois juntos). A aba avisa quando o host tem mais; o site dele lista
  todos. Os checks deles não são lidos — o CI de um pull request encerrado não
  decide mais nada, e custaria uma requisição por linha.
- **Checks**: GitHub e Bitbucket Data Center já os trazem na lista. GitLab,
  Azure DevOps e Forgejo são consultados uma vez por head quando a página abre,
  pelo mesmo cache dos selos de CI do grafo. bitbucket.org não tem.
- **Revisores**: GitHub, GitLab, Forgejo, Bitbucket Data Center e Azure DevOps
  dizem quem ainda tem revisão pedida (Azure: uma pessoa que ainda não votou;
  equipes ficam de fora). A lista do bitbucket.org não diz, então o filtro de
  Revisor fica vazio lá.
- **A busca na descrição** funciona quando a lista do host traz a descrição;
  o bitbucket.org pode deixá-la de fora, e aí só títulos, branches e números
  entram na busca.
- **"Eu" no bitbucket.org e no Azure DevOps** é comparado pelo nome de
  exibição, porque é assim que as listas deles nomeiam o autor.
- **Atualizado no Azure DevOps** é quando o pull request foi aberto (ou
  fechado): a lista dele não tem hora da última atividade.
- O percurso fica guardado enquanto o app está aberto; depois de reiniciar, um
  pull request aberto da lista percorre os pull requests abertos.
