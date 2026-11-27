---
title: Hosting e pull requests
category: Sincronização e vários repositórios
order: 56
summary: Crie PRs em qualquer lugar; revise e faça merge deles no GitHub e no GitLab.
keywords: pull request PR merge request GitHub GitLab Bitbucket Azure DevOps revisão review aprovar merge issues
source: 1594d32b11147253f612a4748708d01ba57d465a
---

# Hosting e pull requests

## Criando

Crie um pull (ou merge) request sem sair do app: dropdowns de branch, título e
corpo pré-preenchidos a partir dos commits da branch, um interruptor de rascunho,
e — no GitHub — revisores, labels e responsáveis aplicados na criação.

![Criando um pull request](../../screenshots/create-pr.webp)

Funciona no **GitHub, GitLab, Bitbucket e Azure DevOps**. PRs/MRs abertos dos
quatro são listados na barra lateral.

Comece um pela comparação de branches, pelo grafo, pelo `+` no painel de PRs, ou a
partir de uma issue (que preenche o `Closes #N`).

## Pilhas na lista

Pull requests apoiados uns nos outros se recolhem em uma única linha com ícone
de pilha, o branch em que a cadeia aterrissa e quantos são. Expanda para ver a
cadeia na ordem de leitura — da folha até a base — com uma setinha embaixo de
cada uma dizendo em que ela entra, então a direção fica na tela em vez de ser
deduzida de quatro bases.

Duas coisas formam esse grupo: o número de pilha do próprio GitHub, quando os PRs
pertencem a uma [pilha nativa](stacks.md), e senão as próprias refs — um pull
request cuja base é o head de outro se apoia nele. Essa segunda regra é o que faz
isso funcionar também no GitLab, Bitbucket e Azure DevOps, e com cadeias abertas
antes de tudo isso existir.

![Uma pilha na lista de pull requests](../../screenshots/pr-stack-list.webp)

Cada linha carrega o estado dos **checks** do seu head — passe o mouse para ver as
contagens — e, no GitHub, também os níveis já fechados ou mesclados, que uma lista
de PRs abertos esconderia. Um nível acima de um **fechado** fica marcado como
bloqueado: os checks dele podem estar verdes, mas o branch que ele mira nunca vai
aterrissar. As ações da linha aparecem no hover, para o título manter a largura.

Ler os checks custa uma requisição por pull request, e só quando a lista é
atualizada.

## Os seus pull requests no repositório de origem de um fork

Num fork, os pull requests que importam costumam ser os que você abriu no
repositório de onde fez o fork, e eles moram lá, não no seu fork. Por isso,
quando um repositório tem um remote `upstream` que aponta para um repositório do
GitHub diferente do `origin`, a lista também pergunta ao `upstream` pelos pull
requests abertos e mantém **só os cuja branch vem do seu fork**. Eles aparecem
abaixo dos do seu fork, sob uma legenda com o nome do repositório de origem,
**Em dono/repo**. Um clique abre a mesma tela de detalhes, com checks e review,
no repositório de origem.

![O pull request do próprio fork e, abaixo, os pull requests dele no repositório de origem, em On example/pr-ready-branch](../../screenshots/fork-upstream-prs.webp)

*Limites:* só GitHub, e só um remote chamado `upstream`. Os outros pull requests
do repositório de origem ficam de fora de propósito: aquela é a fila dele, não o
seu trabalho. Pilhas e buscas de branch continuam usando só a lista do `origin`.
Listar o repositório de origem custa mais uma requisição por atualização.

## Revisando — GitHub e GitLab

![Página do pull request com conversa e revisores](../../screenshots/pull-request-page.webp)

Clicar num pull request abre ele como uma **página própria**. Ela fica presa ao
repositório, como o wiki: um ícone com o número do PR na aba do repositório, ou
no chip dele dentro de um grupo. Clique no ícone de novo, ou no nome do
repositório, para voltar. **Abrir em nova aba**, no menu de botão direito do PR,
abre como aba separada. Se o repositório não estiver aberto em nenhuma aba, o PR
abre numa aba própria.

O trabalho fica na coluna principal, e a barra lateral diz o que o PR *é*, sem
precisar rolar a tela. Com a IA ligada, o botão ✨ do cabeçalho revisa o diff do
PR como o host o informa, então funciona mesmo para uma branch que você nunca
baixou (um fork, de outra pessoa).

A coluna principal tem três seções:

| Seção | O que tem |
|---|---|
| **Conversa** | A descrição, os comentários e as threads de revisão inline (`file:line`, com respostas). Só a conversa rola: a caixa de comentário com comentar / aprovar / pedir mudanças e a caixa de merge (merge, squash ou rebase) ficam fixas embaixo, então um pull request longo nunca as tira de alcance |
| **Arquivos** | Cada arquivo alterado e, ao lado da lista, o diff do selecionado, com destaque de sintaxe e mudança por palavra (arquivos com cara de segredo mascarados quando a opção está ligada). Um checklist ✓ de "visto" lembra o seu progresso. Um arquivo sem diff enviado pelo host (binário, ou grande demais) tem link para vê-lo no host |
| **Checks** | Execuções de CI (GitHub) ou jobs de pipeline (GitLab), com aprovado/falhou/pendente e links para os logs. Todas as execuções do repositório — não só as deste pull request — estão na página [Execuções de CI](ci-runs.md) |

A barra lateral mostra:

| Linha | Mostra |
|---|---|
| **Autor** | Quem abriu, e quando |
| **Status** | Aberto, rascunho, mesclado (por quem, quando) ou fechado; conflitos com o destino |
| **Revisores** | A decisão mais recente de cada revisor (aprovou, pediu mudanças, comentou) e quem ainda falta revisar, times incluídos |
| **Responsáveis, labels, milestone** | Como estão no host, labels nas próprias cores |
| **Branches** | Origem → destino, e o fork de onde vem |
| **Alterações** | Arquivos alterados, commits, linhas adicionadas e removidas, com uma barra |
| **Checks** | Passaram / falhando / rodando, a um clique da seção Checks |
| **Participantes** | Todo mundo que participou |
| **Atividade** | Quando foi aberto e atualizado pela última vez |

O GitLab não informa o total de linhas de um merge request; ele é somado da
lista de arquivos quando ela carrega. Uma linha que o host não informa fica de
fora.

Se alguém der force-push no meio da revisão, [o que mudou desde](range-diff.md)
mostra exatamente o que se mexeu.

As diferenças do GitLab, ditas com clareza: o GitLab não tem uma chamada única
de "enviar revisão", então **aprovar** usa o endpoint de aprovação dele e
**pedir mudanças** remove a sua aprovação e publica o seu comentário. O
**rebase-merge** não é oferecido — o GitLab decide entre merge-commit e
fast-forward pelas configurações do projeto, então o menu de merge mostra só
merge e squash. Threads inline mostram o arquivo e a linha, mas não o hunk de
diff ao redor, que a API do GitLab não retorna. Revisar e fazer merge funciona
no gitlab.com e num [GitLab self-managed](#gitlab-self-managed). O Bitbucket
ainda abre no navegador para revisão.

Diferenças do Azure DevOps: aprovar registra o seu voto (*Approved*); **pedir
mudanças** vota *Waiting for author*. Concluir o PR aceita merge, squash ou
rebase. O Azure lista os arquivos alterados mas não manda o diff, então o app
busca as duas versões de cada arquivo e calcula o diff — para os primeiros 200
arquivos; um arquivo binário, ou uma mudança grande demais para calcular aqui,
tem link para o host. As pessoas aparecem com as iniciais, porque as fotos de
perfil do Azure exigem um navegador com login.

A barra lateral também lista os **work items vinculados ao PR** — número,
título, tipo e estado — cada um abrindo no navegador. Ler esses itens exige um
token com leitura de work items (*Work Items: Read*); sem isso a linha
simplesmente não aparece.

Os **checks** incluem a **validação de build** da branch — o pipeline que a
policy exige, que o Azure registra como resultado de policy e não como status —
ao lado de qualquer status que um pipeline ou CI externo publique. Um check que
é um build do Azure Pipelines desta organização mostra o log embaixo da linha:
as tasks que falharam, cada uma com o nome, ou o log inteiro de cada job quando
nada falhou, começando pelo fim. O token só vai para builds da própria
organização do PR. O painel lê até três logs, compartilhando um limite de 512 KB
do final dos logs. Ler logs exige *Build: Read*; sem isso a linha oferece o
navegador. Um token sem algum escopo é só recusado — o app nunca trata isso como
login revogado nem apaga a credencial que o git usa.

## GitLab self-managed

O GitLab de uma empresa fica num endereço próprio. Informe esse endereço a um
perfil em **Configurações → Contas conectadas → GitLab → Endereço do GitLab**, por
exemplo `git.example.org`, ou `https://example.net/gitlab` para um servido
dentro de um caminho. A partir daí, os remotes nesse host são GitLab: os merge
requests são listados, abertos, revisados e mesclados, o navegador de clone e o
*criar repositório* falam com ele, e push e fetch entram com o token desse
perfil.

**Um token do GitLab pertence a uma instância.** O token de um perfil só é
enviado ao endereço que o perfil informa. Endereço vazio quer dizer gitlab.com.
Um token do gitlab.com nunca chega ao servidor da empresa, e um token da empresa
nunca chega ao gitlab.com. Se a conta do trabalho e a pessoal estão em
instâncias diferentes, cada uma precisa de um perfil. Um repositório vinculado a
um perfil usa a instância desse perfil.

**Criar token** abre a página de tokens da sua instância com `api` e
`write_repository` já marcados. Um token só de leitura conecta normalmente e
depois falha no primeiro push.

Limites:

- **Só https.** Um endereço `http://` é recusado, porque o token passaria pela
  rede em texto puro.
- **Uma instância de GitLab por perfil.** Crie outro perfil para outra
  instância.
- No ssh compara-se o host, não o caminho. Duas instâncias no mesmo host, em
  caminhos diferentes, não se distinguem num remote ssh.
- Avatares de remote só são desenhados para gitlab.com e github.com. Um remote
  self-managed recebe o ícone simples, para que nomes de grupos nunca sejam
  enviados a um host público.

## Forgejo

Defina o endereço da instância antes de inserir o token. Alterar o endereço remove a credencial anterior.
O campo do token fica bloqueado até o endereço acima dele ser um endereço https válido, e diz isso
logo abaixo do campo; o que está errado no endereço aparece em vermelho abaixo do próprio endereço.

![Um endereço do Forgejo que não é https, e o campo do token abaixo dizendo por que está bloqueado](../../screenshots/forgejo-address-needed.webp)

![Configurações de integração do Forgejo](../../screenshots/forgejo-integration.webp)

O Forgejo, e o Gitea, que usa a mesma API, sempre roda num endereço escolhido
pelo dono: o seu próprio servidor ou um público, como o codeberg.org. Informe
esse endereço a um perfil em **Configurações → Contas conectadas → Forgejo**, junto
com um token de acesso. **Criar token** abre a página de tokens desse servidor.
Dê ao token permissão de leitura e escrita em *repository*, *issue* e
*notification*, e de leitura em *user* e *organization*. As permissões de um
token não mudam depois: um token criado sem *issue* ou *notification* não lista
issues nem notificações, e a solução é criar um novo.

A partir daí, os remotes nesse servidor são Forgejo:

| Funciona | Como |
|----------|------|
| Push e fetch | Login com o token do perfil |
| Pull requests abertos | Listados na sidebar, e abrem na [página do pull request](#revisando--github-e-gitlab): conversa, diff de cada arquivo, checks (status de commit, incluindo o Forgejo Actions), comentar, aprovar, pedir mudanças, e merge / squash / rebase |
| Criar pull request | Pelo app; um rascunho leva o prefixo `WIP:` que o Forgejo usa |
| Navegador de clone, criar repositório | Nesse servidor, na sua conta ou numa organização |

Uma check que é um job do **Forgejo Actions** mostra o log embaixo da linha,
com cores, começando pelo fim, onde fica a falha. O Forgejo não tem API para
logs de job, então o app pede a mesma página que o visualizador de log da web
baixa, enviando o token só quando o link é um job deste mesmo servidor; um status
de CI externa nunca o recebe. Um servidor que só entrega logs a um navegador com
login responde com a tela de login, e a linha avisa isso e oferece o navegador.
Logs muito longos mostram as últimas milhares de linhas.


![O log de um job do Forgejo Actions aberto embaixo da linha da check](../../screenshots/pr-check-log.webp)

Como no GitLab, **um token do Forgejo só vai para o servidor que o emitiu**. Um
perfil sem endereço do Forgejo não tem credencial do Forgejo, e não existe
servidor padrão para onde cair.

Limites:

- As threads de comentário de linha aparecem, mas não dá para responder pelo
  app: o Forgejo não tem API para responder dentro de uma thread existente.
  Responda no servidor.
- Só https, um servidor Forgejo por perfil.
- As listas param depois de vinte requisições: 1.000 pull requests ou
  repositórios no tamanho de página padrão do servidor.

## Issues, milestones, releases — GitHub e Forgejo

Navegue pelas issues e abra uma aba de issue completa: corpo, comentários, labels,
responsáveis, milestone, campos do Projects v2, fechar/reabrir, e **criar uma
branch para esta issue** (com nomeação por IA). Milestones mostram progresso e as
issues delas. Releases são navegáveis com uma página de changelog.

**Pull requests vinculados** responde "alguém já está corrigindo isso?": os PRs
que vão fechar a issue, ou que a fecharam — uma palavra-chave no estilo
`Closes #N` ou um vínculo manual na caixa *Development* do GitHub — primeiro os
abertos, depois os mesclados, depois os fechados. Um PR que só *menciona* a issue
fica de fora de propósito, assim como tudo além dos primeiros 50. Um deste
repositório abre numa aba de PR; um de outro repositório abre no navegador. Um
token que não consegue ler os pull requests do repositório (um token
fine-grained sem *Pull requests: read*) recebe um discreto "não foi possível
carregar" em vez de um "nenhum" errado.

Num servidor [Forgejo](#forgejo), as mesmas listas e páginas funcionam, com o
token Forgejo do perfil. Duas coisas são só do GitHub: os campos do Projects v2
ficam vazios, e a seção de pull requests vinculados não aparece. Releases
listam as mais recentes, não o histórico inteiro.

## Aguardando a sua revisão

Na lista de pull requests da sidebar, um 👁 marca os PRs em que **você** é
revisor e ainda não respondeu — no GitHub, no GitLab e no Forgejo. Quem é
"você" é perguntado ao host com a credencial do perfil e lembrado por dez
minutos. Um token que não consegue ler o próprio usuário (sem `read:user` no
Forgejo, por exemplo) não marca nada.


![Pull requests aguardando a sua revisão, marcados com um olho](../../screenshots/pr-awaiting-review.webp)

Com **Configurações → Geral → Notificações do sistema** ligado, um pull request do GitLab
ou do Forgejo que *passa* a esperar por você dispara uma; clicar nela abre a
página do PR. A primeira olhada num repositório só registra o que já está
esperando, então abrir o app não repete o acúmulo. Os pedidos de review do GitHub
ficam com a caixa de notificações dele, mais abaixo, que já avisa.

## Notificações — GitHub e Forgejo

Sua caixa de entrada inteira — pedidos de revisão, menções, atividade de CI — em
todos os repositórios, com filtros de não lidas/todas e marcar como lida. O sino da
barra de ferramentas carrega um selo de não lidas, e notificações de desktop
opcionais disparam quando uma revisão é pedida ou o CI termina.

Se o perfil ativo tem um servidor Forgejo, as notificações dele entram na mesma
lista, das mais novas para as mais antigas, e são marcadas como lidas naquele
servidor. O Forgejo não diz *por que* você foi notificado, então essas linhas não
têm motivo, e nunca disparam notificação de desktop — isso é decidido pelo motivo.

## Tokens

Tokens por perfil para várias contas ou organizações, guardados no keychain do seu
sistema. O GitHuttBr também pode pegar emprestado o que o seu **credential helper do
git** já guarda, então uma organização em que você já se autenticou muitas vezes
não precisa de configuração nenhuma. Veja [Segurança e segredos](security.md).

Cada perfil **vincula a sua própria conta**. Em Configurações → Contas conectadas,
**Vincular ao perfil** procura um login que já esteja na máquina — o credential
helper do git, depois a conta ativa do **GitHub CLI**, depois a janela de login
do próprio helper — e liga essa conta ao perfil. Nada é compartilhado
implicitamente: um perfil novo começa desconectado, e uma conta que outro perfil
já vinculou é recusada. Para vincular uma segunda conta do GitHub, adicione-a ao
gh (`gh auth login`), deixe-a ativa (`gh auth switch`) e entre pelo outro perfil
— ou cole o token dessa conta. O git nunca pede usuário e senha num terminal.

A página mostra se a conexão é o token do perfil, o vínculo com o helper do git
ou o vínculo com o GitHub CLI, e **Desconectar** desfaz isso só para este perfil:
um token é apagado (continua válido no serviço até você revogá-lo lá), um vínculo
é removido (o login continua no gh ou no helper).

### Verificando um token

Todo token que você digita — na aba de um serviço ou na linha de um servidor
(GitHub Enterprise Server, GitLab self-managed, Bitbucket Data Center) — é
verificado perguntando ao serviço a quem ele pertence. A resposta é uma de três,
e cada uma quer dizer uma coisa diferente:

| O que aparece | O que aconteceu | O que fazer |
|---------------|-----------------|-------------|
| A conta, com a foto | O serviço aceitou o token | Nada |
| **Vermelho** — *… recusou este token* | O serviço respondeu e recusou (401 ou 403): o token está errado, expirou ou não tem um escopo de que precisa | Crie um token novo e cole por cima do antigo |
| **Âmbar** — *Não foi possível acessar … para verificar este token* | Sem veredito: sem rede, falha de DNS, TLS ou proxy, tempo esgotado, o servidor respondeu 5xx ou o serviço limitou a taxa de requisições | **Tentar de novo** quando a rede ou o servidor voltar |

![O aviso âmbar quando não foi possível acessar o servidor para verificar um token](../../screenshots/token-check-unreachable.webp)

**Um token recusado continua salvo.** A verificação nunca apaga o que você
digitou: um token pode ser recusado por um motivo passageiro (uma sessão de SSO
a reautorizar, um escopo acrescentado no serviço um minuto depois), e apagá-lo
perderia o token de vez. Até você substituí-lo, tudo o que o usa — fetch, push,
a lista de pull requests — falha do mesmo jeito. O aviso âmbar não diz nada
sobre o token; ele pode muito bem estar correto.

Os limites: a verificação lê só a conta (e, quando o serviço oferece, as
organizações dela). Um token que entra mas não tem o escopo de que uma ação
posterior precisa — criar um pull request, ler o CI — só é descoberto por essa
ação. O GitHub também responde a um limite de taxa com 403; o app distingue isso
de uma recusa pelos cabeçalhos de limite do GitHub, então um limite sem eles
apareceria como recusa.

A API do serviço — pull requests, issues, CI — e o fetch, pull e push do próprio
git por https usam o token ou a conta vinculada do perfil. A credencial chega ao
git só para aquele comando, restrita ao host do remote, e nunca é gravada no
`.git/config`. Um perfil sem nenhum dos dois deixa o git com o credential helper
dele. Azure DevOps, GitLab e Bitbucket se vinculam pelo credential helper do git
— o Git Credential Manager guarda várias contas por serviço — ou usam um token
por perfil. Um vínculo nomeia uma conta por serviço, então organizações que
exigem contas diferentes pedem um perfil para cada uma.

**Veja também:** [Branches empilhadas](stacks.md) · [Recursos de IA](ai.md)
