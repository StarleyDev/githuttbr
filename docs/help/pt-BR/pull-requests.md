---
title: Página de pull requests
category: Sincronização e vários repositórios
order: 57
summary: Todos os pull requests de um repositório numa página — por estado, filtrados por autor, revisor, destino e CI — ‹ › para percorrer a lista filtrada de dentro de um PR, e comentários numa linha do diff.
keywords: pull requests lista página merge requests pr mr filtro autor revisor meus aguardando minha revisão revisão pedida ci falhando branch de destino rascunhos mesclados fechados busca triagem anterior próximo alt seta navegação checkout ir para branch de origem destino copiar nome da branch buscar fetch comentário de linha comentário inline comentário de revisão comentar na linha aba arquivos revisão de código
source: d1deab4d48f6f6327673e61daecb55ede0889881
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

## Ir para a branch de um pull request

Para trabalhar num pull request é preciso ter a branch dele em checkout — e
num repositório com milhares de branches, achá-la pelo nome na lista é a parte
lenta. Na página de um pull request, o campo **Branches** faz isso por você:

- **O nome da branch é um link.** Um clique faz o checkout da branch e leva
  você ao grafo do repositório, na ponta dela. A página do pull request
  continua aberta na aba.
- **Uma branch que só existe no servidor** é buscada antes — só essa branch,
  não o remote inteiro — e vira uma branch local que a acompanha. Uma branch
  que você já tem localmente é trocada como está — não é atualizada, então
  faça pull quando quiser os commits mais recentes do pull request.
- **A branch em que você já está** aparece marcada como *atual*. Nada é
  trocado.
- **O botão de copiar** ao lado de cada nome põe o nome na área de
  transferência.
- **Desfazer** (⌘Z) volta para a branch em que você estava e apaga a branch
  local que o checkout criou — a não ser que você tenha feito commit nela
  desde então; nesse caso ela fica.

O cabeçalho tem os mesmos dois caminhos como botões: **Ir para a branch de
origem** e **Ir para a branch de destino**. Eles funcionam também na branch em
que você já está — só levam ao repositório.

Nada é consultado antes do clique: abrir um pull request não lê nem busca
nenhuma branch.

O que não faz:

- **A branch de origem de um fork** fica em outro repositório, então não tem
  link (o botão de copiar fica). **Pré-visualizar o pull request
  localmente…**, oferecido logo abaixo, é o caminho para rodá-la aqui. A
  branch de destino continua com link.
- **Nenhum remote correspondente.** A branch é procurada no remote cuja URL é
  a do repositório do pull request. Quando nenhum remote configurado aponta
  para lá, o link não faz nada e a dica diz por quê.
- **Uma branch apagada.** Um pull request mesclado muitas vezes levou a branch
  junto; a busca então diz que a branch não existe mais no remote, e você
  continua no pull request.
- **Alterações locais.** O checkout não é destrutivo, então não há
  confirmação — e o git recusa o checkout quando as suas alterações não
  commitadas seriam sobrescritas. O erro diz quais arquivos; faça commit ou
  stash e clique de novo.
- **Esta janela.** O checkout acontece na working tree deste repositório.
  Quando a branch já está em checkout em outra [worktree](worktrees.md), a aba
  dessa worktree é aberta no lugar.

## Comentar numa linha

Responder a uma thread de revisão já era possível aqui; começar uma, não — então
uma revisão de verdade ainda mandava você para o navegador. Na aba **Arquivos**
de um pull request, qualquer linha do diff aceita um comentário próprio:

- **Passe o mouse sobre uma linha** e clique no **+** que aparece sobre o
  número dela, ou **clique na própria linha** (um clique que termina uma
  seleção de texto, ou um clique duplo que seleciona uma palavra, não conta —
  isso é leitura). O menu do botão direito — ou a tecla de menu de contexto do
  teclado — também tem *Comentar na linha N*.
- Uma caixa abre **logo abaixo da linha**. Escreva e clique em **Comentar** —
  ou ⌘/Ctrl+Enter. **Cancelar** fecha a caixa; **Esc** também, perguntando antes
  quando algo foi digitado. Nos dois casos o foco volta para a linha.
- Quando dá certo, a nova thread aparece **embaixo da linha** e nas threads de
  revisão da aba Conversa, onde todo mundo vai vê-la.

![Um comentário sendo escrito embaixo de uma linha alterada, com uma thread anterior embaixo da linha dela](../../screenshots/pr-line-comment.webp)

O lado em que o comentário fica segue a linha:

| Linha | Ancorada em |
|---|---|
| **Adicionada** (verde) | A versão nova do arquivo, no número novo |
| **Removida** (vermelha) | A versão antiga, no número antigo |
| **Sem alteração** | A versão nova (o GitLab recebe os dois números, como exige) |

As threads que já existem também aparecem embaixo das linhas delas, com a
caixa de resposta onde o host deixa o app responder dentro de uma thread (o
Forgejo não deixa). Uma thread só aparece numa linha quando o host diz que ela
ainda pertence ao diff mostrado; o resto fica na aba Conversa, em vez de numa
linha adivinhada:

| Host | Uma thread escrita antes do último push |
|---|---|
| GitHub | Desatualizada quando a linha mudou: só na Conversa |
| GitLab | Escrita sobre um head anterior: só na Conversa |
| Azure DevOps | O Azure acompanha a thread até onde a linha está agora |
| Bitbucket Data Center | Órfã quando a linha sumiu: só na Conversa |
| Forgejo | O Forgejo não diz que um comentário está desatualizado, então ele aparece no número de linha gravado — depois de um push, essa linha pode ter outro código |

Um comentário numa linha fora dos trechos mostrados fica só na aba Conversa,
em todos os hosts.

Um comentário digitado e não enviado conta como texto não enviado: **‹ ›** e
Alt+setas perguntam antes de deixá-lo para trás, como fazem com a caixa de
comentário principal. Olhar outro arquivo mantém o texto; para começar um em
outra linha, envie ou cancele o primeiro.

O que não faz:

- **Uma linha, enviada na hora.** Não há intervalo de linhas, nem revisão
  pendente para juntar comentários e enviar depois, nem sugestão de alteração.
  Cada comentário é publicado no momento em que você envia, como uma thread
  própria (no Forgejo, como uma revisão com esse único comentário, já que o
  Forgejo não tem uma chamada para um comentário avulso).
- **O diff que você está vendo.** A aba Arquivos guarda em qual commit (no
  Azure DevOps, em qual iteração) o diff foi lido, e o comentário é enviado
  sobre ele. Quando o pull request andou desde então — um push, uma nova base
  de merge — o comentário não é postado na linha que agora tem aquele número: é
  recusado com *o pull request mudou desde que este diff foi carregado*, e
  **Atualizar** mostra o diff novo. No GitHub o comentário é enviado sobre o
  commit que você leu, e o GitHub o marca como desatualizado se a linha mudou.
  Uma linha que o host ainda assim não aceite é recusada como fora do diff.
- **Recusado.** Sem permissão para comentar (um token só de leitura, uma conta
  que o repositório não deixa comentar), o host recusa e a mensagem diz que o
  motivo é esse.
- **bitbucket.org**: os pull requests abrem no navegador — o app ainda não tem
  página para eles — então um comentário de linha ali continua sendo feito no
  site.
- **Um arquivo sem diff** (binário, ou grande demais para o host incluir) não
  tem linhas para comentar.

## Limites

- **Os pull requests abertos são a lista da barra lateral.** GitHub, GitLab e
  bitbucket.org leem os 30 primeiros; um repositório com mais mostra só esses,
  e a contagem de Abertos fica **30+**. Azure DevOps, Bitbucket Data Center e
  Forgejo leem todos.
- **Mesclados e fechados têm limite**, e a aba mostra **+** quando o host tem
  mais (o site dele lista todos):

  | Host | O que é lido |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | Os 100 atualizados mais recentemente, mesclados e fechados **juntos** |
  | GitLab | Os 100 atualizados mais recentemente de cada |
  | Bitbucket Data Center | 100 de cada na ordem *newest* do servidor — a API dele não diz se é por abertura ou atualização |
  | Azure DevOps | 100 de cada entre os encerrados no **último ano**; a API não define ordem, então, passando de cem, quais vêm é escolha do servidor |

  Os checks deles não são lidos — o CI de um pull request encerrado não decide
  mais nada, e custaria uma requisição por linha —, então **CI falhando** não
  vale nessas abas (o chip some lá).
- **Sem conta**: sem um token que alcance o host, Mesclados e Fechados avisam
  isso em vez de mostrar uma lista vazia (o GitHub ainda lê um repositório
  público).
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
