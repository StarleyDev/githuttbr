---
title: Página de pull requests
category: Sincronização e vários repositórios
order: 57
summary: Todos os pull requests de um repositório numa página — por estado, filtrados por autor, revisor, destino e CI — ‹ › para percorrer a lista filtrada de dentro de um PR, os commits dele, as atualizações (cada push, o que mudou, o que é novo desde a sua última visita), e comentários numa linha do diff. A conversa como uma linha do tempo, com o que é novo desde a sua última visita.
keywords: título referência cartão item de trabalho AB# número de issue dica pull requests lista página merge requests pr mr filtro autor revisor meus aguardando minha revisão revisão pedida ci falhando branch de destino rascunhos mesclados fechados busca triagem anterior próximo alt seta navegação checkout ir para branch de origem destino copiar nome da branch buscar fetch comentário de linha comentário inline comentário de revisão comentar na linha aba arquivos revisão de código aba commits lista de commits commits do pr histórico abrir commit copiar sha buscar branch do pr commits de pr de fork refs/pull head atualizações iterações pushes force push rebase histórico reescrito versões de diff o que mudou desde a última visita selo nova marcar como visto comparar atualização editor markdown barra formatação visualizar menção árvore de arquivos pastas visão em árvore visão de caminhos arquivos vistos marcar pasta como vista editar excluir apagar editado erro digitação renderizado comentários imagens pixel rastreamento imagem bloqueada clique carregar tarefas tabela bloco conversa linha do tempo threads abertas thread resolvida aprovou pediu alterações enviou commits papel revisor novo desde a última visita comparar dois commits selos de tipo ci por commit ver diff próximo não visto filtro não vistos com comentários progresso mudou
source: 20e2f33eb7aed2b165b35b1b91a75cb9c8768317
---

# Página de pull requests

Um repositório movimentado tem vinte pull requests abertos ao mesmo tempo. A
barra lateral lista todos, mas uma linha para cada um diz pouco: de quem é
cada um, quais esperam por você, quais ficaram vermelhos. Descobrir isso
significava abrir cada um, ler, voltar, abrir o próximo. A **página de pull
requests** responde a essas perguntas numa tela só e, depois que você abre um
pull request, **‹ ›** levam ao próximo da mesma lista sem precisar voltar.

![A página de pull requests aberta pelo Mission control: dois aguardando a sua revisão, três seus, os outros recolhidos; cada linha com o tamanho, a situação de cada revisor, os checks e um ponto onde mudou desde a sua última visita](../../screenshots/pull-requests.webp)

## Como abrir

- O **ícone de lista** no cabeçalho **PULL REQUESTS** da barra lateral (*Ver
  todos os pull requests*).
- *Pull requests…* na paleta de comandos (⌘K), ou **Ferramentas → Pull
  requests…**.
- O **chip de pull requests** na linha de um repositório no
  [Mission control](mission-control.md). Aberta por ali, a página começa com
  **← Voltar ao Mission control**.

Como a wiki e as [execuções de CI](ci-runs.md), a página fica presa à aba do
repositório.

## Estados

O controle segmentado à esquerda da busca tem os quatro estados, com quantos cada um tem.

| Estado | O que mostra |
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
| **Buscar** | Pull requests cujo título, descrição, autor, branches ou número contêm todas as palavras digitadas. `#482` ou `482` encontra esse número; os trechos encontrados ficam destacados no título |
| **Autor** | Um autor — cada um com quantos tem nesta aba. **Eu** vem primeiro |
| **Revisor** | Um revisor pedido, ou **Pedem minha revisão** |
| **Branch de destino** | Pull requests para essa branch |
| **Aguardando minha revisão** | Atalho para *Revisor: pedem minha revisão* |
| **Meus** | Atalho para *Autor: Eu* |
| **CI falhando** | Pull requests cujos checks no head falharam |

A busca e os três chips ficam numa linha só; cada chip diz quantos pull
requests do estado atual ele manteria. **Autor**, **Revisor** e **Branch de
destino** ficam em **Mais filtros ▾**, que fica aceso enquanto um deles está
ligado.

Com algum filtro ligado, uma linha acima da lista diz quantos pull requests do
estado aparecem e quais filtros estão ligados, com **limpar filtros** para tirar
todos.

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

Abertos e Rascunhos se dividem em três seções, na ordem em que você trabalha:

| Seção | O que tem |
|---|---|
| **Aguardando sua revisão** | Pull requests em que pediram a sua revisão — o título em amarelo |
| **Seus pull requests** | Os que você escreveu |
| **Outros** | Todo o resto, recolhido atrás de **mostrar** enquanto as duas de cima têm algo; uma busca ou um filtro abre a seção |

Quando o host não sabe dizer quem é você, não há o que separar e a lista é um
cartão só. Mesclados e Fechados são histórico: um cartão, sem seções.

Cada linha se lê da esquerda para a direita:

| Parte | O que mostra |
|---|---|
| **Ponto** | O pull request mudou desde a última vez que você saiu da página dele. Um que você nunca abriu não tem ponto — não há com o que comparar |
| **#** | O número — verde enquanto aberto, cinza num rascunho |
| **Título** | O título, o tipo [Conventional Commits](committing.md) num chip colorido (`feat`, `fix`, `docs`…) e um selo *rascunho*. Embaixo: o autor (omitido nos seus), origem → destino e **N comentários** — ou **N comentários novos** quando outras pessoas escreveram desde a sua última visita |
| **Tamanho** | `+48 −12 · 4 arq.` — linhas adicionadas e removidas, arquivos tocados |
| **Revisão** | O veredito de cada revisor — **✓ bruno aprovou**, **✕ ana pediu alterações** — e depois quem ainda tem revisão pedida, **● esperando você** em amarelo. **✓ pronto para mesclar** quando o host diz que as revisões estão feitas e os checks não falharam; **sem revisores** quando ninguém foi chamado nem respondeu |
| **Checks** | Os checks do head — `✓ 6/6`, `✕ 1 falhando`, `● 2 rodando`; passe o mouse para ver as contagens |
| **Atualizado** | Há quanto tempo mudou pela última vez; passe o mouse para ver a data |

### O que cada host entrega

Tamanho, comentários e vereditos não estão na lista de todo host, e a página
nunca abre cada pull request para buscá-los: o que a lista não traz fica em
branco, nunca zero.

| Host | Tamanho | Comentários | Vereditos |
|---|---|---|---|
| **GitHub** | ✓ | ✓, e quais são novos | ✓, e *pronto para mesclar* — um pedido GraphQL a mais para a lista inteira |
| **GitLab** | — | ✓ (só a contagem) | Quem tem revisão pedida; *pronto para mesclar* pelo status de merge do GitLab |
| **Azure DevOps** | — | — | ✓ pelos votos dos revisores |
| **Bitbucket Data Center** | — | ✓ (só a contagem) | ✓ |
| **Bitbucket Cloud** | — | ✓ (só a contagem) | — |
| **Forgejo** | ✓ quando o servidor preenche | ✓ (só a contagem) | Quem tem revisão pedida |

A contagem é dos comentários da conversa — comentários numa linha do diff não
entram. Sem token, o pedido ao GitHub não é feito e essas colunas ficam vazias.

Dentro de uma seção, as linhas são ordenadas pela atividade mais recente, e
**‹ ›** dentro de um pull request as percorrem na ordem em que aparecem. Um
clique abre a página do próprio pull request ([Hosting e pull
requests](hosting.md)). Num host sem essa página, a linha abre o pull request
no navegador.

Num [checkout de fork](hosting.md#your-pull-requests-on-the-parent-of-a-fork),
os seus pull requests no repositório pai também aparecem, marcados *em
dono/repo*.

## Percorrer a lista a partir de um pull request

![Um pull request aberto da lista filtrada: ‹ 1 de 7 › e os filtros de onde veio](../../screenshots/pull-request-nav.webp)

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
que você já está — só levam ao repositório. Com as [cores dos
ícones](themes.md) ligadas, cada botão do cabeçalho tem a sua:
atualizar azul, revisão com IA violeta, pré-visualizar verde-azulado, branch de
origem verde, branch de destino laranja (abrir no navegador fica cinza).

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

## Commits

A barra lateral dizia quantos commits um pull request tem, nunca quais. Revisar
um commit de cada vez — como a maioria dos pull requests foi feita para ser
lida — mandava você para o navegador. A aba **Commits**, entre Conversa e
Atualizações, lista os commits:

- **Uma linha de resumo** no topo: quantos commits, de quantos autores, o
  **+/−** do pull request, e um selo colorido por tipo de
  [Conventional Commit](https://www.conventionalcommits.org/) com a contagem —
  *feat 2 · fix 1 · test 1* diz que tipo de mudança é essa antes de você ler
  uma linha dela. Features em verde, correções e reverts em vermelho, testes na
  cor de destaque, desempenho em amarelo, o resto em cinza.
- **Do mais antigo para o mais novo**, a ordem em que se aplicam, agrupados
  pelo dia em que foram escritos. Um commit que entrou fora da ordem das datas
  num rebase abre um dia próprio em vez de ser movido.
- Cada linha tem a foto do autor (quando o host dá uma), o assunto — o tipo no
  mesmo selo colorido e o escopo apagado, quando segue Conventional Commits —,
  o autor, há quanto tempo e, para um commit que este clone tem, o **+/−** e
  quantos arquivos ele mexeu. Depois um ponto de **CI** (verde passou, vermelho
  falhou, amarelo rodando) quando o host informa uma execução para aquele
  commit, o SHA curto e **Ver diff**. Um selo **merge** marca um commit com dois
  pais, quando o host informa.
- Um commit com mais que o assunto mostra o resto da mensagem embaixo da linha.
- Ao passar o mouse, **Copiar** põe o SHA completo na área de transferência e
  **Abrir no navegador** abre o commit no host — dentro do pull request quando
  o host tem essa página (GitHub, GitLab, Bitbucket Data Center), senão na
  página do commit no repositório.

![A aba Commits: os commits de um pull request agrupados por dia, um com a mensagem completa aberta](../../screenshots/pr-commits.webp)

Os commits feitos depois que você saiu do pull request pela última vez ficam
abaixo de uma linha **Novo desde a sua última visita** — a mesma marca da aba
Conversa, da mesma visita.

**Ver diff** — ou um clique na linha, ou chegar nela com Tab e apertar Enter —
abre o commit no app, como um clique no grafo faria: a visão do repositório, o
commit selecionado, os detalhes abertos. Isso funciona quando este clone
**tem** o commit. Quando não tem, a linha diz *ainda não está no seu
repositório* e o botão muda:

- **Buscar a branch** — a mesma busca de uma branch só de
  [ir para a branch](#ir-para-a-branch-de-um-pull-request), sem o checkout.
  Todo commit que veio junto passa a abrir; se este não veio (um force push o
  reescreveu depois), o aviso diz isso.
- **Buscar os commits do pull request**, num pull request vindo de um
  **fork**. A branch dele fica em outro repositório, mas a maioria dos hosts
  espelha a ponta do pull request no repositório de destino, numa ref própria —
  `refs/pull/N/head` (GitHub, GitHub Enterprise Server, Forgejo),
  `refs/merge-requests/N/head` (GitLab), `refs/pull-requests/N/from`
  (Bitbucket Data Center). O app busca só essa ref, sem tags, para uma ref
  própria, `refs/githuttbr/pr/<remote>/N`, e o commit abre como qualquer
  outro: o grafo desenha essa ponta como uma faixa sem rótulo. Buscar de novo
  move a ref para a ponta do momento. Se um force push deixou o commit de fora,
  o aviso diz isso.
- **Abrir no navegador**, para quando buscar não é uma opção.

**Comparar dois commits** pede que você marque duas linhas e abre a
[comparação](merging.md#compare-duas-refs-quaisquer) entre elas na visão do
repositório: o mais antigo é a base, então você vê o que aconteceu de um para o
outro — os commits no meio e o diff somado. Os dois precisam estar neste clone;
enquanto não estiverem, o botão fica apagado.

A lista é lida na primeira vez que você abre a aba, não junto com a página, e
de novo a cada **Atualizar**. Até ela chegar, o número da aba é o que o host
informou para o pull request. Pull requests mesclados e fechados listam os
commits do mesmo jeito.

O que não faz:

- **No máximo 250 commits.** O próprio GitHub não lista mais que 250 de um pull
  request; o app para no mesmo número em todos os hosts, e diz *o host tem
  mais* quando tem, com um link para o pull request no host. Quais 250 depende
  da ordem em que o host os lista — o app fica com os listados primeiro, e a
  linha acima da lista diz quais:

  | Host | Um pull request mais longo mostra |
  |---|---|
  | GitHub | Os **primeiros** 250 (o limite do próprio GitHub) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | Os **250 mais recentes** |
  | Forgejo | A ponta que o servidor listar primeiro; a ordem dele não é documentada |
- **A ponta de um fork onde o host não a espelha.** O Azure DevOps publica só
  o resultado do merge, nunca a ponta do próprio pull request, e o
  bitbucket.org não publica nenhum dos dois: ali a linha oferece só o
  navegador. Num outro host que não a espelhe, a busca diz isso.
  **Pré-visualizar o pull request localmente…** traz o resultado do merge do
  Azure, se é disso que você precisa.
- **As pontas buscadas ficam.** `refs/githuttbr/pr/…` não é uma branch: não
  há o que fazer checkout nem push, uma busca com limpeza (prune) não mexe
  nela, e o git guarda os commits. Nada a remove, também — nem fechar a página
  nem [Limpar branches locais](branch-cleanup.md). Para tirá-las, apague as refs
  à mão: `git for-each-ref refs/githuttbr/pr` lista, e `git update-ref -d <ref>`
  apaga uma.
- **Um remoto com `/` no nome** não cabe como uma parte do nome dessa ref, então
  a busca é recusada ali.
- **Uma branch apagada.** Um pull request mesclado muitas vezes levou a branch
  junto: a busca diz isso. O bitbucket.org não lista commit nenhum depois que a
  branch de origem some.
- **Squash merges.** Os commits de um pull request mesclado com squash nunca
  chegaram à branch de destino; depois que a branch dele é apagada, estão só no
  host.
- **Os números de cada commit vêm do seu clone.** O **+/−** e a contagem de
  arquivos são lidos do git, nunca pedidos ao host, então um commit ainda não
  buscado não mostra nenhum, nem um merge (a mudança dele é contra dois pais).
  Um clone parcial sem os arquivos de um commit não mostra nada em vez de
  baixá-los.
- **CI só dos 40 commits mais recentes**, em silêncio: uma requisição por
  commit pesaria num pull request longo, e o CI costuma rodar nas pontas
  enviadas mesmo. Sem credencial para o host, não há pontos, nunca um login.
- **Os selos de tipo leem o assunto.** Um time que não escreve Conventional
  Commits não ganha selos nem contagem por tipo — nada é adivinhado.
- **Autores** aparecem como os commits os nomeiam. GitLab, Azure DevOps e
  Bitbucket Data Center não dão foto sem um login que uma imagem não consegue
  mandar, então essas linhas mostram a inicial.
- **Mensagens longas no Azure DevOps** podem vir cortadas: a lista do Azure
  trunca a mensagem do commit, e o app mostra o que ele manda.
- **bitbucket.org**: os pull requests abrem no navegador — o app ainda não tem
  página para eles —, então esta aba não aparece lá, embora o app consiga ler a
  lista.

## Atualizações

Um pull request que você revisou na segunda já andou até quinta. A aba Commits
mostra onde ele está agora, não o que aconteceu desde então: quais commits
vieram em qual push, se alguém deu force push e reescreveu o que você já tinha
lido, e como o código está *em relação à versão que você viu*. A aba
**Atualizações**, entre Commits e Arquivos, responde isso — como a aba Updates
do próprio Azure DevOps.

Ela lista cada push para o pull request, **do mais recente para o mais
antigo**:

- **Atualização 1 — abertura** é o push com que o pull request foi aberto;
  cada push seguinte é o próximo número.
- Cada uma mostra **quando**, **quem enviou** (quando o host informa) e os
  **commits que adicionou** — SHA curto, assunto, autor. Quando o host informa
  commits que um push tirou da branch, eles aparecem em **Commits removidos**,
  riscados.
- Um force push ou rebase é marcado como **histórico reescrito**: commits que
  você leu podem ter sumido, e os listados podem ser cópias novas de trabalho
  antigo. No Azure DevOps, um push que mudou a branch de destino do pull
  request é marcado como **destino alterado**.

![A aba Atualizações: pushes do mais recente para o mais antigo, um force push marcado como "histórico reescrito", um marcado como Nova](../../screenshots/pr-updates.webp)

### O que mudou em uma atualização

**Ver as mudanças desta atualização** abre a aba Arquivos só com aquele push: o
diff do head da atualização anterior até o desta — ou, na Atualização 1, da
branch de destino contra a qual ela foi aberta, quando o host informa esse
ponto (Azure DevOps, GitLab). A mesma árvore de arquivos e o mesmo
visualizador, com uma faixa — *Mostrando as mudanças da Atualização 3 (em
relação à Atualização 2)* — e **Mostrar todas as mudanças** para voltar ao pull
request inteiro.

![A aba Arquivos mostrando as mudanças de uma atualização, com a faixa acima da árvore de arquivos](../../screenshots/pr-update-diff.webp)

O diff é sempre feito **neste clone** quando dá: `git diff` entre os dois
heads, exato e sem perguntar nada ao host. Quando falta algum head, o app
primeiro busca os dois **pelo id do commit** no remoto do pull request —
nenhuma branch, tag ou ref é gravada; um head substituído por um force push
não está mais em branch nenhuma, mas a maioria dos hosts ainda o entrega pelo
id — e compara aqui. Só quando essa busca falha o host é consultado:

| Host | A comparação do host |
|---|---|
| Azure DevOps | As mudanças da iteração com `$compareTo` — entre os dois pushes |
| GitLab | O compare do repositório, direto de um head ao outro |
| Bitbucket Data Center | O compare do repositório — **a partir da base comum** dos dois heads |
| GitHub | A API de compare (`base...head`) — **a partir da base comum** dos dois heads |
| Forgejo / Gitea | Nenhuma: a API deles não tem diff entre dois commits |

A partir da base comum, o diff de uma reescrita não é o que o push fez: o que
ele removeu não aparece, e mudanças que a branch de destino recebeu nesse meio
tempo podem parecer do pull request. A faixa avisa — *Comparado a partir da
base comum: o que este push removeu não aparece* — quando uma atualização com
histórico reescrito foi comparada assim. Quando nada funciona, a faixa avisa e
oferece buscar a branch (ou, num fork, o head do pull request) para comparar
aqui.

Comentários de linha pertencem ao diff do pull request inteiro, então não há
**+** nas linhas enquanto uma atualização está na tela; a faixa avisa. Marcar
um arquivo como visto funciona como sempre — marca o arquivo no pull request.

### Novas desde a sua última visita

As atualizações enviadas desde a última vez que você abriu a aba levam o selo
**Nova**, e a própria aba diz quantas são: *Atualizações 5 · 2 nova(s)*. Abrir a
aba marca todas como vistas (os selos ficam enquanto você está nela, para você
ver quais eram novas); quando **Atualizar** traz mais com a aba aberta,
**Marcar como visto** limpa os selos. Abrir só a página do pull request não
marca nada. Na primeira vez que você abre a aba Atualizações de um pull
request, nada é novo — não há visita anterior para comparar.

As atualizações são lidas junto com a página, para essa contagem, e de novo
no **Atualizar** — não depois de cada comentário ou revisão que você envia.

O que já foi visto fica só neste computador, por repositório e pull request,
nunca vai para o host.

### Por host

| Host | De onde vêm as atualizações | Quem enviou | Commits removidos | Detecta reescrita |
|---|---|---|---|---|
| Azure DevOps | As **iterações** do pull request — o registro do próprio Azure de cada push | Sim | Não (não informa) | Sim: `forcePush` / `rebase` |
| GitLab | As **versões de diff** do merge request; os commits de cada versão saem do head dela | Não (as versões não nomeiam ninguém) | Sim | Sim: um head anterior que não é mais alcançado |
| Bitbucket Data Center | A atividade do pull request: **OPENED** e cada **RESCOPED** que moveu a branch de origem | Sim | Sim, com os totais do host | Sim: um rescope que removeu commits |
| GitHub | **Deduzidas** a partir dos commits e force pushes da timeline — veja abaixo | Só em force push | Não | Sim: um evento de force push |
| Forgejo / Gitea | As entradas de **push** da timeline, a primeira gravada junto com o próprio pull request | Sim | Não | Sim: uma entrada de force push |
| bitbucket.org | Não disponível | — | — | — |

**O GitHub não registra pushes comuns** — só force pushes —, então as
atualizações são **deduzidas pelos horários dos commits**. Uma atualização é
uma sequência de commits que se apoiam um no outro, entre force pushes; um
commit que não se apoia no anterior, ou que vem mais de dez minutos depois
dele, começa a próxima. Um commit criado depois que o pull request foi aberto
não pode ter estado na abertura. Assim, um push com commits feitos com uma
hora de diferença aparece **dividido** em dois, e dois pushes com poucos
minutos de diferença aparecem como **um**; a aba avisa que o agrupamento é
aproximado. Os commits novos de um rebase, que a timeline pode listar logo
antes do force push, contam como desse force push. Os heads de antes e depois
de um force push são exatos, então o **Ver as mudanças** dele também é.

### Limites

- **Tetos.** São listadas as 100 atualizações mais recentes. A timeline do
  GitHub é lida a partir do fim mais recente, até 500 itens; a atividade do
  Bitbucket Data Center (também da mais recente) até 1.000; as versões e os
  commits do GitLab até 300 cada; a timeline do Forgejo até 500 entradas, as
  mais recentes quando é maior. Quando um teto corta a **abertura**, os
  números deixam de ser os do host: a aba avisa e conta para trás a partir da
  última (*Última atualização*, *Atualização, 2 antes da última*).
- **Azure DevOps** não informa commits removidos; um force push ou rebase é
  marcado no lugar. Uma iteração cuja lista de commits o Azure corta é lida à
  parte (até 500 commits), e a atualização avisa quando ainda está parcial.
- **GitLab** não diz quem enviou. Uma versão cujo head foi reescrito é lida à
  parte para achar os commits dela — nas dez versões assim mais recentes —,
  uma vez por sessão: versões nunca mudam.
- **Forgejo e Gitea** não listam commits de um force push — só os dois heads,
  que é o que **Ver as mudanças** compara — e, depois de um force push, nada
  diz o que a abertura tinha, então ela fica vazia, a menos que o servidor
  tenha registrado o push da própria abertura. A API deles não tem diff entre
  dois commits, então essa comparação precisa dos dois commits neste clone. Um
  servidor sem a API de timeline mostra todos os commits numa só atualização.
- **Buscar pelo id** precisa de um host que entregue um commit pelo id. O
  GitHub entrega qualquer commit que ainda guarda; outro host, ou um servidor
  git simples, pode recusar um para o qual nenhuma branch aponta — aí a
  comparação do host é usada. Os commits buscados ficam neste clone sem ref, e o git os descarta
  com o tempo.
- **O compare do Bitbucket Data Center** lê o diff estruturado do servidor e o
  desenha como unificado; arquivos muito grandes podem vir cortados.
- Um head reescrito pode ter **sumido do host** de vez (Azure e GitLab guardam;
  outros podem descartar). Aí nenhum dos lados consegue comparar, e a faixa
  avisa.
- Pull requests do **bitbucket.org** abrem no navegador e não têm a aba
  Atualizações.

## Ler os arquivos

Um pull request de duzentos arquivos é difícil de ler como duzentos caminhos
completos, e difícil de terminar sem perder o ponto. Acima da lista e do diff,
uma linha faz a conta — *4 de 9 arquivos vistos*, com uma barra — e **Anterior
não visto** / **Próximo não visto** levam ao arquivo mais perto, para cima ou para
baixo, que você ainda não marcou, dando a volta na lista; ficam apagados quando
tudo o que está listado já foi visto. Com **Marcar como visto ao avançar**
ligado, o **Próximo não visto** marca o arquivo aberto antes de seguir — lendo
em sequência, você não precisa mexer nas caixinhas; a escolha fica guardada.
**Mostrar** reduz a lista aos arquivos **Não vistos** ou **Com comentários**
(qualquer conversa de revisão neles), e volta para **Todos**.

A lista da aba **Arquivos** tem a mesma chave **Caminho / Árvore**
do painel de commit, e a escolha vale para o app inteiro. Em **Árvore**, os
arquivos ficam sob as pastas (uma sequência como `src/main/ipc` vira uma linha
só), e cada pasta mostra a soma de **+/−** e quantos dos seus arquivos já foram
vistos (*3/5*). A caixa de uma pasta marca como vistos todos os arquivos dentro
dela, ou desmarca todos; as marcas ficam só neste computador, nunca vão para o
host. Uma marca guarda a versão do diff do arquivo: quando um push muda um
arquivo visto, ele volta a aparecer como não visto, com o selo **mudou**
(*mudou desde que você viu*). Um arquivo sem diff (binário, grande demais) é
comparado só pelo status e pela contagem de linhas. Um arquivo com conversas
de revisão mostra um balão com a contagem logo depois do nome, para os que têm comentários se destacarem numa lista longa; as
conversas desatualizadas também contam, e as resolvidas também — as listas que
o app lê dos hosts não dizem quais estão resolvidas. Clique numa pasta, ou aperte ←/→ nela, para recolhê-la; ↑/↓ (ou j/k)
percorrem os arquivos na tela e abrem o diff de cada um. As pastas recolhidas
são lembradas por pull request até o app fechar, e um arquivo aberto dentro de
uma delas reabre o caminho até ele. A árvore é ordenada por nome, não na ordem
em que o host lista os arquivos.

![A aba Arquivos em Árvore: pastas com a soma das mudanças e quantos arquivos foram vistos, uma recolhida](../../screenshots/pr-files-tree.webp)

**Imagens.** Uma imagem que o pull request adiciona, remove ou muda (png,
jpg, gif, webp, bmp, ico, avif, svg) não tem diff de texto para ler, então a
aba mostra a imagem — a mesma visão da de um commit: a nova, a antiga, ou antes
e depois lado a lado e com um deslizador. Uma imagem renomeada compara o
caminho antigo na base com o novo no head; no diff de uma atualização, os dois
heads dela. Os bytes vêm deste clone quando ele tem os commits, o que é rápido e
de graça, e senão do host, com o perfil do repositório. Limites: uma imagem com
mais de 32 MB não é pré-visualizada; comentários de linha não se aplicam a uma
imagem (um SVG mantém o diff de texto, e os comentários, embaixo dela); uma
imagem guardada no **Git LFS** é lida do host, porque o clone só tem o ponteiro
dela — GitLab, Azure DevOps e Forgejo a resolvem, enquanto a API do GitHub só
devolve o ponteiro, então ali a aba manda você para o host; quando o host não
informa o merge base (e o app usa a ponta da branch de destino), uma nota avisa
que o "antes" pode incluir mudanças posteriores no destino; e quando nem o clone
nem o host conseguem dar os bytes, a aba diz isso e oferece buscar a branch do
pull request ou abri-lo no host.

![Uma imagem que o pull request mudou, antes e depois lado a lado](../../screenshots/pr-image-diff.webp)

**Caminhos e o seu editor.** A barra acima do diff tem um botão para copiar o
caminho do arquivo e um menu **⋯**; o clique direito num arquivo ou pasta da
lista abre o mesmo menu. Ele copia o caminho, o caminho antigo de um arquivo
renomeado ou o da pasta; e abre o arquivo no seu [editor](editor.md) (ou em
outro app) ou o mostra no gerenciador de arquivos. Essas duas ações agem na
**sua cópia de trabalho**, não na versão do pull request: só ficam ativas para
um arquivo que existe nela (um arquivo que o PR exclui, ou que a sua branch não
tem, diz o porquê), e quando a branch em uso não é a do PR, o menu diz qual
branch você abriria.

**Ao voltar.** Saia de um pull request para o repositório, outra aba ou o
próximo PR, e ao voltar ele está onde você deixou: a mesma aba, o mesmo arquivo
aberto, a mesma rolagem, e todo texto que você não tinha enviado — o
comentário, uma resposta, um comentário de linha, uma edição. Isso dura até
você fechar o pull request ou sair do app; fica só na memória, para os 50 pull
requests mais recentes (além disso o lugar mais antigo é liberado, e o texto que
ele guardava vai para a próxima página de pull request que você abrir). Fechar
um PR com texto não enviado pergunta antes. Se uma atualização encontra sumido o lugar de
um rascunho — a conversa que ele respondia, o comentário que editava, o arquivo
em que estava — o texto não é descartado: ele espera no topo da página para ser
copiado ou descartado.

### De onde vem o diff

Uma revisão só é tão boa quanto o diff que ela lê. A API de um host não é uma
boa fonte para ele: o Azure DevOps não manda diff nenhum, só a lista de
arquivos, e cada um precisa ser buscado duas vezes e comparado; o GitHub para
em 3000 arquivos e deixa de fora o patch de um arquivo grande; o GitLab marca um
diff grande como *too large* e não manda nada. Por isso a aba Arquivos lê
**este clone primeiro**, em todo host:

1. Ela pede ao host os dois commits do pull request — onde ele começa e a
   ponta dele. Azure DevOps, GitLab e Forgejo dizem a merge base; o Bitbucket
   Data Center diz a base do diff em que os comentários de linha dele se
   ancoram; o GitHub diz só a branch de destino, e a merge base dela com a
   ponta é calculada aqui (ou, sem os commits, pelo compare do GitHub). A
   prévia de imagens usa os mesmos dois commits.
2. Quando os dois estão aqui, um `git diff` entre eles dá todos os arquivos,
   sem limite de quantidade. São os mesmos dois commits que a página do próprio
   host compara, então o número de uma linha aqui é o número dela lá, e um
   comentário de linha cai onde você o colocou.
3. Quando não estão aqui, eles são buscados **pelos ids** no remote do pull
   request — só objetos, nenhuma branch é criada ou movida — uma vez, quando a
   página abre (e de novo no Atualizar), com *Buscando os commits do pull
   request…* acima da lista enquanto isso. Um servidor que não entrega um
   commit pelo id (alguns Azure DevOps e servidores git simples) é pulado em
   silêncio.
4. Só então a API do host é usada, e um arquivo para o qual ela não dá diff diz
   por quê, em vez de fingir que está vazio (abaixo).

Um arquivo lido depois — aberto enquanto *ainda não carregado*, ou depois de
**Tentar de novo** — entra na lista como os outros: o mesmo visualizador, e
comentários de linha nele.

No Azure DevOps, o caminho pela API lê os cem primeiros arquivos quando a aba
abre, três por vez e em no máximo um minuto ao todo, e o resto quando você abre
cada um. Uma requisição estrangulada (throttling) pausa todas as leituras até a
espera que o servidor pede; uma que ainda falha diz isso, com o motivo. Se um
arquivo é texto é decidido pelos bytes dele, não pela flag *binário* do Azure —
que ele também liga em arquivos UTF-16 e em algum texto que não é ASCII. Quando
o host lista menos arquivos do que o pull request tem (o GitHub para em 3000),
uma linha acima da lista avisa.

### Quando um arquivo não mostra diff

| O que diz | Por quê | O que você pode fazer |
|---|---|---|
| **Binário** | Os bytes não são texto: uma imagem, um arquivo compactado. UTF-16 e texto legado de um byte são reconhecidos como texto. | Abrir no host. |
| **Grande demais para mostrar** | Mais de 20.000 linhas alteradas ou 8 MB de diff, ou uma versão acima de 4 MB. O **+/−** dele ainda é contado quando o clone o leu. | Abrir no host. |
| **Ainda não carregado** | Além do que uma leitura guarda (cerca de 150.000 linhas de diff), ou, pela API do Azure DevOps, depois dos cem primeiros arquivos ou do minuto. | Ele carrega quando você o abre; **Carregar o diff** se não carregou. |
| **Não foi possível carregar** | A leitura falhou — o motivo aparece embaixo. | **Tentar de novo**. |
| **O host deixou de fora** | A API do host não mandou diff e este clone não tem os commits do pull request. | **Buscar o pull request para ver localmente** — os commits pelo id, ou a ponta do pull request de um fork — e então ele é comparado aqui. |
| **Só o nome ou o modo mudou** | Um rename ou uma mudança de permissão: o conteúdo é o mesmo. | Nada a revisar no conteúdo. |
| **Codificação mudou** | O mesmo texto salvo de outro jeito: um BOM adicionado ou removido, UTF-16 virou UTF-8. | Conferir se a mudança é intencional — algumas ferramentas se importam. |

Na lista, um arquivo cujo diff não foi lido — ainda não carregado, não foi
possível carregar, deixado de fora pelo host — mostra **—** em vez de
**+0 −0**, que leria como "nada mudou". Um arquivo binário e um rename puro
mostram o **+0 −0** real, e quando o host conta as linhas mesmo assim (o GitHub
conta, até num patch que ele deixa de fora), as contagens aparecem.

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

Um comentário digitado e não enviado fica com o pull request, como o texto da
caixa de comentário principal: **‹ ›**, Alt+setas ou outra aba o deixam onde
está, e ele volta à linha dele quando você retorna (veja *Ao voltar* acima).
Olhar outro arquivo mantém o texto; para começar um em outra linha, envie ou
cancele o primeiro.

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

## A conversa

A história de um pull request fica espalhada: a descrição no topo, comentários
numa lista, threads de linha em outra, os vereditos só na barra lateral, os
pushes numa aba à parte. Pôr-se em dia era ler tudo e remontar a ordem de
cabeça. A aba **Conversa** conta tudo como uma **linha do tempo**, num trilho,
na ordem em que aconteceu.

![A conversa como linha do tempo: dois pushes, uma thread de linha ainda aberta com as linhas dela, um pedido de alterações, a linha que marca o que é novo desde a última visita e uma aprovação](../../screenshots/pull-request-page.webp)

| Na linha do tempo | O que mostra |
|---|---|
| **A descrição** | Sempre primeiro, com quem abriu o pull request e quando |
| **Comentários** | A conversa, cada um com o papel do autor: **Autor** ou **Revisor** |
| **Pushes** | *sam enviou 2 commits*, depois uma linha por commit; um clique no hash abre a aba Commits |
| **Threads de linha** | No lugar, no horário do primeiro comentário: o arquivo e a linha, as linhas do diff de que ela trata, as respostas e uma caixa de resposta. O caminho e **Ver em Arquivos →** abrem esse arquivo na aba Arquivos |
| **Vereditos de revisão** | **aprovou** em verde, **pediu alterações** em vermelho com o que o revisor escreveu, ou o comentário de uma revisão |

Uma thread que o host diz estar **aberta** leva uma etiqueta âmbar, e a barra
acima da linha do tempo conta essas threads: **1 thread aberta** mostra só elas,
as que ainda esperam resposta. Uma thread **resolvida** se recolhe numa linha —
*Thread resolvida em src/palette.tsx:18 · 2 comentários* — e um clique a abre.
**Comentários · Revisões · Commits · Tudo** reduzem a linha do tempo a um tipo;
**Comentários** é o que abre primeiro, e **Tudo** traz o resto de volta.

Os **Revisores** da barra lateral dizem o veredito de cada pessoa por escrito —
**✓ aprovou** ou **pediu alterações** — e um relógio para quem ainda não
respondeu.

### Novo desde a sua última visita

Quando você sai da página de um pull request (outra página, outra aba, ou
fechando-a), o app anota a hora. Na próxima vez, uma linha marca onde você
parou — **Novo desde a sua última visita** — e a barra diz quantos itens vieram
depois. A marca é feita ao sair, não ao abrir, então ela fica parada enquanto
você lê. Na primeira vez que você abre um pull request, nada aparece como novo.

Os horários aparecem como *há 2d*; passe o mouse para ver a data completa.

*Limites:*

- **Quando um commit foi enviado** é algo que os hosts não dizem. Os pushes são
  remontados a partir da lista de commits: commits seguidos do mesmo autor, cada
  um até uma hora depois do anterior, contam como um push, colocado na data do
  último. Um rebase que reescreveu as datas os desloca. A aba Atualizações é o
  registro do próprio host, onde existe.
- **Aberta ou resolvida** vem do GitHub (uma requisição GraphQL a mais por
  leitura) e do GitLab. Threads do Azure DevOps, do Bitbucket Data Center e do
  Forgejo não mostram etiqueta nem entram na contagem.
- **Vereditos na linha do tempo** precisam de data: GitHub, GitLab (uma
  aprovação, datada pela nota que o GitLab escreve para ela) e Forgejo dão uma.
  Votos do Azure DevOps e aprovações do Bitbucket Data Center não têm, então
  aparecem só na barra lateral.
- Uma revisão do GitHub sem texto próprio — o envelope em que cada lote de
  comentários de linha é arquivado — não ganha linha; as threads dela já
  aparecem.
- Suas últimas visitas ficam guardadas para os 300 pull requests mais recentes,
  só neste computador. Fechar o app com um pull request aberto não conta como
  sair dele.

## Escrever comentários

Toda caixa da página — o comentário no fim, a resposta dentro de uma thread, o
comentário numa linha — é o mesmo editor de Markdown: abas **Escrever /
Visualizar**, uma barra de formatação com os atalhos do GitHub, listas que
continuam no Enter e sugestões de **@** / **#** a partir das pessoas e dos pull
requests que já estão na tela. A resposta de thread é a exceção: um campo de uma
linha, sem barra, em que Enter envia e Shift+Enter quebra a linha.
[Escrever comentários](writing-comments.md) tem os detalhes e os
limites.

## Como os comentários aparecem

As pessoas escrevem comentários em Markdown, então um comentário mostrado como
texto simples fica cheio de `**`, `- [ ]` e blocos de código. A descrição, a
conversa e as threads de revisão (nas abas Conversa e Arquivos) são desenhadas
como Markdown: títulos, listas e listas de tarefas, tabelas, citações, blocos
de código destacados na linguagem que o bloco indica, links e imagens. A página
de issue desenha o texto do mesmo jeito. `#123`, `AB#123`, `!123` e `@usuário`
no texto continuam virando links, com o
[cartão](#do-que-trata-um-123-ou-ab123) onde já tinham.

![Um comentário renderizado: uma tabela, uma imagem de outro site retida atrás
do aviso, e um bloco de código destacado](../../screenshots/pr-rendered-comment.webp)

De onde vem o desenho:

| Host | Renderizado por |
|---|---|
| GitHub, GitHub Enterprise Server | O próprio GitHub (`body_html`): menções e referências ligadas como no site, imagens passam pelo proxy de imagens do GitHub, e anexos privados trazem o endereço assinado |
| GitLab, Forgejo, Azure DevOps, Bitbucket Data Center | O app, a partir do Markdown do comentário. Um link relativo aponta para dentro do repositório; no GitLab, `/uploads/…` aponta para dentro do projeto, como o GitLab faz |

Um comentário é conteúdo de outras pessoas, então o que ele pode conter é
restrito, e mais restrito do que nos seus próprios arquivos: uma lista explícita
de tags, links e imagens só em `https:`, `http:` ou `mailto:`, nada de scripts,
frames, formulários, SVG ou estilo inline, e links que nunca abrem dentro do
app (vão para o seu navegador). A caixa de seleção de uma lista de tarefas
aparece, mas não é clicável: marcá-la aqui não mudaria nada no host.

**Imagens de outro site esperam um clique.** Carregar uma imagem é um pedido
que o site por trás dela pode observar, com o seu IP e o momento em que você
leu o comentário — qualquer pessoa que pode comentar pode pôr ali um pixel de
rastreamento. Por isso só as imagens do próprio host carregam sozinhas: no
github.com os anexos, `*.githubusercontent.com` (que inclui o proxy de imagens)
e os assets dele; em qualquer outro host, o próprio endereço. Toda outra imagem
mostra *Imagem de example.net — clique para carregar*, e o clique carrega só
aquela imagem. **Configurações → Segurança → Carregar imagens de outros sites
nos comentários** desliga isso; veja [Segurança](security.md#imagens-nos-comentários).

**A visualização mostra o que vai ser enviado.** Nesta página e na de issue, a
aba **Visualizar** de toda caixa de comentário desenha o texto do mesmo jeito:
o mesmo perfil, as mesmas quebras de linha, as mesmas imagens retidas — um link
colado para uma imagem de fora não a carrega enquanto você escreve. Os diálogos
de novo pull request e nova issue mantêm a visualização Markdown comum do app.

**Longo ou intrincado demais aparece como texto.** O Markdown é renderizado na
janela do app, e certos textos custam muito mais do que o tamanho sugere. Um
comentário com mais de **32.000 caracteres**, ou montado para travar o
renderizador (milhares de `_` ou `*` sem par num parágrafo, ou mais de 32
níveis de `>` ou de marcadores de lista numa linha), aparece como texto simples
com links, sob *Comentário longo mostrado como texto simples* ou *Comentário
mostrado como texto simples: complexo demais para renderizar aqui*. Um
comentário que ainda assim falhe ao renderizar cai no mesmo texto, sozinho: o
resto da página não é afetado.

O que não faz:

- **Editar mostra o texto como foi escrito.** **Editar** continua abrindo o
  Markdown, e uma edição salva é desenhada pelo app até a página ler o pull
  request de novo (no GitHub, a partir daí, pelo GitHub).
- **Anexos privados do GitHub expiram.** O GitHub assina o endereço de uma
  imagem privada por alguns minutos; uma que parou de carregar depois de a
  página ficar aberta um tempo volta com **Atualizar**.
- **Uma imagem relativa no GitHub** que o próprio app desenha (uma resposta
  enviada pelo app, antes de a página ler de novo) é procurada sob o endereço
  do repositório no github.com, que pode não ser onde o GitHub a poria.
- **Vídeos** num comentário do GitHub aparecem como link para o arquivo, não
  como player.
- **Extensões só do GitHub** que o app desenha sozinho (nos outros hosts) não
  aparecem: sem atalhos de emoji, sem diagramas Mermaid, sem o estilo dos
  alertas, e fórmulas ficam como texto.
- **O código só é destacado quando o bloco indica a linguagem.** Adivinhar a
  linguagem passaria todas as gramáticas por todos os blocos da página.
- **Mensagens de commit** na aba Commits continuam em texto simples: o git não
  renderiza Markdown, e os hosts também não.

## Editar e excluir seus comentários

Um erro de digitação num comentário já enviado, ou uma observação que deixou de
valer, antes exigia ir ao navegador. Agora os seus comentários têm **Editar** (o
lápis) e **Excluir** (a lixeira) no fim do cabeçalho: comentários da conversa,
comentários e respostas de threads de revisão, nas abas Conversa e Arquivos. A
página de issue também tem, para os comentários dela no GitHub e no Forgejo.

![Seu próprio comentário, marcado como editado, com Editar e Excluir no fim do cabeçalho](../../screenshots/comment-editor.webp)

"Seu" é decidido pela própria página, que pergunta ao host, a cada carregamento,
com que conta as chamadas deste repositório entram (o perfil vinculado a ele, não
o perfil ativo). A maioria dos hosts identifica o autor pelo login, comparado sem
diferenciar maiúsculas. O Azure DevOps identifica autores pelo nome de exibição,
que duas pessoas podem ter igual, então ali o app nunca compara nomes: um
comentário é seu quando o id do autor bate com o id da conta, **ou** quando o
nome único do autor (o nome da conta, em geral um e-mail) bate com o da conta,
sem diferenciar maiúsculas. Os dois são únicos por pessoa; o segundo cobre um id
de autor diferente do que a conexão informa. Quando nenhum dos dois pode ser
comparado, nenhum comentário mostra as ações. Quando o
app não consegue saber quem é você (um token sem escopo de usuário, ou o host não
respondeu), nenhum comentário as mostra também; **Atualizar** pergunta de novo.
Quem decide continua sendo o host: uma conta que ele não deixa alterar um
comentário é recusada, e a mensagem diz isso.

- **Editar** abre o comentário no lugar, no mesmo editor de Markdown, com o
  texto como foi escrito. **Salvar** (ou ⌘/Ctrl+Enter) envia; **Cancelar** ou
  **Esc** fecha, perguntando antes quando você mudou algo. Só as linhas em
  branco em volta do texto saem: código indentado e uma quebra de linha com dois
  espaços no fim ficam como foram digitados. O texto novo aparece na hora e a
  página lê o pull request de novo. Na página do pull request, uma edição não
  salva fica com o pull request quando você segue com **‹ ›** ou troca de aba,
  e fechar o pull request pergunta antes. A página de issue não guarda nada:
  nada ali pergunta antes de a aba fechar.
- **Excluir** sempre pergunta antes, e a pergunta diz o que acontece: o
  servidor remove o comentário para todos, e não dá para desfazer. Não há
  entrada de desfazer, porque nada o traz de volta.

Excluir o **primeiro comentário de uma thread** que tem respostas (uma thread de
revisão, ou um comentário da conversa que outros responderam) muda de host para
host, e a confirmação diz qual é o caso. Dois deles o host não documenta, e a
confirmação diz isso:

| Host | Primeiro comentário de uma thread com respostas |
|---|---|
| GitHub | As respostas devem ficar; a documentação do GitHub não diz. A thread continua com a caixa de resposta: sem o primeiro comentário, a resposta vai para a própria thread pela API GraphQL do GitHub, encontrada por uma resposta que ainda está nela. Se isso falhar (um Enterprise Server antigo, um token que o GraphQL recusa, uma thread em que o GitHub diz que esta conta não pode responder), a thread oferece **Responder no GitHub**. Enquanto você tem uma revisão em andamento no GitHub, ele pode colocar a resposta nela: o aviso diz isso, e ninguém vê a resposta até você enviar essa revisão lá |
| GitLab | Só essa nota sai; a thread e as respostas ficam |
| Azure DevOps | Deve ser marcado como excluído e sumir, com a thread e as respostas mantidas; a documentação do Azure não diz |
| Bitbucket Data Center | Recusado: o Data Center não exclui um comentário que tem respostas. Exclua as respostas antes, ou edite o comentário |

Alguns hosts marcam um comentário como **editado**. Só o Azure DevOps guarda uma
data apenas para o texto; no GitHub, no Bitbucket Data Center e no Forgejo o app
compara quando o comentário foi criado e quando foi atualizado pela última vez,
então ali a marca é aproximada (outra coisa que mexa no comentário pode ativá-la).
No GitLab essa data também muda quando uma thread é resolvida, então ela não é
usada.

O que não faz:

- **Comentários de revisão do Forgejo** (comentários numa linha) não podem ser
  editados pela API, e só algumas versões permitem excluir, então eles não
  mostram nenhuma das ações: altere-os no site. Comentários da conversa
  funcionam como nos outros hosts.
- **Alguém mudou no meio tempo.** O Bitbucket Data Center confere a versão do
  comentário: editar ou excluir um comentário que mudou desde que a página
  carregou é recusado, e **Atualizar** mostra o atual. Os outros hosts ficam com
  a última escrita.
- **Não encontrado**: quando o host não encontra o comentário, a mensagem diz
  que ele pode ter sido excluído, ou que esta conta não consegue vê-lo, e a
  página lê o pull request de novo. Uma edição aberta num comentário que sumiu é
  descartada.
- **bitbucket.org**: os pull requests abrem no navegador, então ainda não há
  página para editar os comentários deles, embora o app saiba fazer a chamada.
- **A descrição** do pull request e os resumos das revisões não são
  comentários, e não são editados aqui.

## Do que trata um `#123` ou `AB#123`

Um commit que diz *fixes AB#4821* ou um comentário que diz *veja #312* informa
um número, não do que se trata. Para saber, era preciso abrir. Agora, **ao
apontar para uma referência** — ou chegar nela com Tab — abre um pequeno
cartão com o que o host diz sobre ela:

- um ícone do tipo, e a referência como foi escrita;
- o **título**;
- o **estado** (aberto, fechado, mesclado — no Azure DevOps, o estado do
  próprio item de trabalho, como *Active* ou *Resolved*);
- no Azure DevOps, o **tipo do item de trabalho** (Bug, User Story, Task…).

![O cartão de uma referência a item de trabalho num comentário: tipo, título e estado](../../screenshots/reference-card.webp)

Os cartões estão na página do pull request (descrição, comentários, threads de
revisão e a mensagem completa de um commit na aba **Commits**), na página da
issue e no assunto do painel de detalhes do commit. Na aba **Commits** no Azure
DevOps, cada item de trabalho no assunto de um commit (`AB#123`, ou `#123`, que
ali é o mesmo item) também mostra o título ao lado, em cinza. No Azure DevOps,
`!123` vira link para aquele pull request, sem cartão.

| Referência | Host | Lido de |
|---|---|---|
| `AB#123`, e `#123` num repositório do Azure | Azure DevOps | Itens de trabalho, até 200 numa requisição |
| `#123` | GitHub, GitHub Enterprise Server | Issues e pull requests, até 50 numa requisição GraphQL; uma requisição REST cada quando o GraphQL falha |
| `#123` / `!123` | GitLab | Issues / merge requests, uma requisição por tipo |
| `#123` | Forgejo | Issues (pull requests também), uma requisição cada, duas por vez |

Um `#123` só conta como palavra própria: `org/repo#123` (outro repositório),
`&#39;`, uma cor como `#123abc` e o `#issuecomment-…` de um link ficam de fora.

Nada é consultado antes de um cartão abrir. Aí a referência em que você está e
as mais próximas dela na página, ainda não conhecidas, vão numa só chamada,
então o próximo cartão costuma aparecer na hora. As respostas ficam na memória
enquanto o app roda, nunca em disco, por cinco minutos; depois disso continuam
aparecendo e são lidas de novo no próximo passar de mouse. Ficam guardadas por
perfil: a chamada é feita com o perfil ao qual o repositório está
[vinculado](profiles.md), e outro perfil pode ver outros itens.

O que custa:

- **GitHub** lê até **50** numa requisição, pela API GraphQL — a referência
  em que você está e as vizinhas mais próximas. Quando o GraphQL falha por
  outro motivo que não o limite de requisições (um Enterprise Server antigo, um
  token que ele recusa), o app volta para a API REST, que lê uma issue por
  requisição: aí só as **10** primeiras são pedidas, uma depois da outra, como o
  GitHub pede aos apps; as outras ficam sem resposta, e um próximo passar de
  mouse as pede.
- **Forgejo** não tem como ler várias issues numa requisição, então cada cartão
  custa uma: um passar de mouse pede no máximo **10**, duas por vez.
- No GitHub e no Forgejo, a primeira resposta que diz *mais devagar* (um 429,
  um 403, o erro de limite do próprio GraphQL, um limite secundário, ou uma
  resposta que gastou a última requisição do limite) interrompe o resto — o GitHub
  não volta para o REST nesse caso — e essas referências não são pedidas de novo
  por cinco minutos.
- **Azure DevOps** lê até 200 itens de trabalho numa requisição, e o GitLab
  uma por tipo, então ali a página inteira vai de uma vez.

O que não faz:

- **Bitbucket** não tem cartão: o app não lê issues lá, e o link abre o
  navegador como antes.
- **Não encontrado, ou sem acesso.** Uma issue excluída, um item de trabalho
  num projeto que esta conta não vê, ou um token do Azure sem o escopo *Work
  Items (Read)* aparecem do mesmo jeito: o cartão diz isso, e o link continua
  funcionando. Um host limitando as requisições, fora do ar ou sem conta neste
  perfil tem a sua própria mensagem.
- **`AB#123` fora do Azure DevOps** — num repositório do GitHub ligado ao Azure
  Boards — não vira link, então não tem cartão: o app não sabe a que
  organização ele pertence.
- **Estado mesclado em GitHub Enterprise Servers antigos**, que não informam
  quando um pull request foi mesclado: aparece como fechado.
- **As linhas de commit do grafo** não mostram cartões.

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
- **Ler os arquivos pode buscar — uma vez.** Quando os commits do pull request
  não estão neste clone, a página busca esses commits pelo id no remote dele ao
  abrir, e de novo no **Atualizar** — nunca depois de um comentário, uma revisão
  ou um merge, e no máximo uma vez por versão do pull request por sessão (uma
  tentativa que falhou espera o Atualizar). Grava só objetos: nenhuma branch, e
  não o `FETCH_HEAD`, então o "buscado há …" da barra não muda. Desiste depois
  de 20 segundos, ou quando a transferência fica abaixo de 1 KB/s por 15, e
  nunca pede senha: o prompt do git fica desligado e o Git Credential Manager é
  avisado para não abrir a janela de login, então um remote que precisaria de
  uma cai na API. Um remote ssh usa as suas configurações de ssh como estão,
  exceto que a janela de senha do próprio ssh não é aberta. Quando outra
  operação git segura o repositório (um push longo) por mais de cinco segundos,
  a busca é pulada dessa vez e a API é usada. O que você mudar na árvore de
  trabalho enquanto ela roda não se perde: o repositório atualiza quando ela
  termina. Um clone raso ou parcial sem os objetos cai na API do host.
- **Acima dos limites**, o arquivo aparece com as contagens e sem diff: 20.000
  linhas alteradas ou 8 MB de diff lidos do clone, 4 MB por versão lida do
  Azure DevOps. Uma leitura guarda cerca de 150.000 linhas ou 48 MB de diffs;
  os arquivos depois disso ficam **ainda não carregados** e são lidos quando
  abertos.
- **Arquivos UTF-16** que o git chama de binários são relidos como texto, até
  50 por pull request e 2 MB por versão; além disso aparecem como binários.
- **Renames** são detectados como o `git diff -M` detecta (50% de semelhança
  por padrão), o que pode diferir um pouco do pareamento do próprio host.
- **Azure DevOps pela API** lê os cem primeiros arquivos em no máximo um minuto
  ao todo; os que sobram quando o minuto acaba ficam **ainda não carregados**.
  Uma resposta estrangulada pausa todas as leituras até o Retry-After do
  servidor. Um pull request com mais de 20.000 mudanças é listado até ali, e a
  aba avisa.
