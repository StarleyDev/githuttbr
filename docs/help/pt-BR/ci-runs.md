---
title: Execuções de CI
category: Sincronização e vários repositórios
order: 59
summary: Acompanhe GitHub Actions, pipelines do GitLab, Azure Pipelines e Forgejo Actions pelo app — cada job, seus passos e seu log, com reexecutar e cancelar.
keywords: execuções de ci ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions jobs passos steps logs reexecutar re-run cancelar dispatch workflow_dispatch selo badge status grafo
source: c2212bcfa43b533553085d1fd72c02cd4dea9b4c
---

# Execuções de CI

Você deu push e agora espera: troca para o navegador, acha o repositório, abre
Actions, acha a sua execução, abre o job que ficou vermelho, rola até o fim do
log. **Execuções de CI** traz esse ciclo para perto do código. Uma página mostra
como cada workflow tem se saído, lista as execuções do remoto das mais novas
para as mais antigas e abre uma execução que falhou direto no teste que quebrou
— com o arquivo e a linha, a um clique do seu editor. Os botões para rodar de
novo ou parar ficam no próprio cartão.

Ela conversa com a API do próprio serviço, com o token que você já deu ao
GitHuttBr. Nada roda na sua máquina — para isso, veja [CI local](local-ci.md).

![A página Execuções de CI: um cartão por workflow com as últimas execuções, os filtros Falharam e Rodando, o progresso de uma execução em andamento e uma execução que falhou aberta no teste que quebrou e nos jobs](../../screenshots/ci-runs.webp)

## Como abrir

**Ferramentas → Execuções de CI…**, ou *Execuções de CI* na paleta de comandos
(⌘K). A página fica na aba do repositório, como a wiki e os insights, e lê o
remoto chamado `origin` — ou o primeiro remoto, quando não há `origin`.

## O que a página mostra

| Parte | O que é |
|---|---|
| **Cartões de workflow** | Um cartão por workflow: o que o dispara, a taxa de sucesso nas últimas 10 execuções terminadas (verde a partir de 90 %, âmbar a partir de 70 %, vermelho abaixo), essas execuções como quadradinhos coloridos — a mais antiga à esquerda, então a mais nova fica perto do "agora" —, o tempo médio e a job mais lenta ou como foi a última execução. Clique num cartão para listar só as execuções daquele workflow; clique de novo para ver todas |
| **Todas as branches / branch atual** | Todas as execuções do remoto, ou só as da branch em que você está |
| **Falharam / Rodando** | Filtros rápidos com o número de execuções que cada um deixa. Contam o que os outros filtros deixam, então o número é o que o clique mostra |
| **Filtro** | Reduz as execuções carregadas por título, workflow, branch, autor, commit ou evento |
| **Um cartão de execução** | O título do commit (ou o nome do workflow), depois a branch, o workflow e o número da execução, o que a disparou (push, pull request, agendamento, manual…), quem disparou e o commit — clique no commit para copiá-lo. Quando a execução é de um pull request, **PR #n** abre a página desse pull request. À direita: em que pé está, quanto tempo levou e há quanto tempo |
| **Uma execução rodando** | *Rodando · passo 3 de 5*, uma barra de progresso e o tempo até agora. O passo é o da job que está rodando; num serviço sem passos (GitLab, Forgejo) conta jobs |
| **O teste que falhou** | Uma execução que falhou já abre sozinha, a mais nova, com o teste que o log aponta: a job, o teste, a primeira linha do erro e **caminho:linha** — clique nele, ou em *Abrir no editor*, para cair naquela linha. A mesma leitura da [aba Checks](hosting.md#a-aba-checks) de um pull request |
| **Jobs** | Embaixo, cada job com estado e duração, agrupados por estágio onde o serviço tem estágios (GitLab, Azure). *Ver passos e log* abre os passos de uma job e o fim do log — numa job que falhou ele está sempre visível, nas outras aparece ao passar o mouse |
| **Passos** | Cada passo de um job, com estado e duração — GitHub, Azure e Forgejo informam; o GitLab não tem passos |
| **Log** | O fim do log de um job terminado, com as cores. Só os últimos 512 KB são baixados — onde a falha está — e a página avisa quando o começo ficou de fora |

Enquanto algo na página está na fila ou rodando, a lista pergunta ao serviço de
novo a cada 15 segundos, e junto os jobs da execução aberta e de cada execução
rodando — é daí que vem a contagem de passos; as durações andam a cada segundo. Quando dois minutos de respostas não trazem nada novo — uma
execução esperando aprovação de deploy, por exemplo — a consulta passa a ser
uma vez por minuto, e volta a acelerar assim que algo muda. Uma lista em que
tudo terminou não pergunta nada até você atualizar, e nada é perguntado com a
janela escondida.

Uma execução que o serviço manda sem título — todo pipeline do GitLab, um build
agendado do Azure — recebe o assunto do commit quando ele está no grafo, lido
do seu repositório local sem custo; senão, o número.

## Reexecutar, cancelar, iniciar

| Botão | Aparece quando | O que acontece |
|---|---|---|
| **Reexecutar falhas** | A execução falhou ou foi cancelada | Só os jobs que não passaram rodam de novo |
| **Reexecutar** (↻) | A execução terminou, no GitHub — no cartão, ao passar o mouse | Todos os jobs rodam de novo |
| **Abrir no navegador** | Ao passar o mouse no cartão | A execução no site do serviço |
| **Cancelar** | A execução está na fila ou rodando | Pergunta antes: os jobs em andamento são interrompidos e o trabalho deles se perde |
| **Executar workflow** | O serviço permite iniciar à mão | Escolha o workflow e uma branch; ele começa como se a branch tivesse recebido push, e aparece na lista em alguns segundos |

O que cada serviço permite:

| Serviço | Lista e jobs | Passos | Log | Reexecutar tudo | Reexecutar falhas | Cancelar | Iniciar à mão |
|---|---|---|---|---|---|---|---|
| **GitHub** (e Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — o workflow precisa do gatilho `workflow_dispatch` |
| **GitLab** (e self-managed) | ✓ — pipelines, jobs por estágio | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — roda o `.gitlab-ci.yml` na branch |
| **Azure DevOps** | ✓ — builds, jobs por estágio | ✓ (tarefas) | ✓ | — | ✓ | ✓ | ✓ — qualquer definição de build do repositório |
| **Forgejo / Gitea** | ✓ em servidores com a API de execuções do Actions | ✓ | ✓ quando o servidor o entrega a um token | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Selos no grafo

A mesma CI aparece como um pequeno selo ao lado de cada commit no grafo: verde,
vermelho ou um relógio enquanto roda. Passe o mouse para ver os jobs; clique
para abrir a página do serviço. Os selos vêm de:

| Serviço | Fonte |
|---|---|
| GitHub | Os check runs do commit — qualquer CI que reporte ao GitHub, não só Actions |
| GitLab | Os statuses do commit, que incluem todos os jobs do pipeline. Um job manual (um deploy, por exemplo) não deixa o selo preso no relógio |
| Azure DevOps | Os 100 builds mais recentes do repositório, casados pelo commit |
| Forgejo / Gitea | O status combinado do commit — Forgejo Actions e qualquer CI externa |
| Bitbucket Data Center | Os build statuses do commit |

Toda resposta é lembrada — inclusive "não há CI aqui" — e um commit só é
perguntado de novo quando a resposta pode ter mudado: a cada 45 segundos
enquanto roda, a cada 10 minutos depois que terminou, e cada vez mais
espaçado para um commit que nunca teve CI. Isso mantém um grafo movimentado
dentro da cota por hora do serviço.

## Limites

- **Os cartões só conhecem as execuções que a página listou.** São as últimas
  50 do filtro de branch em vigor — um workflow que roda pouco pode mostrar
  menos de dez quadradinhos, e trocar para a branch atual recalcula todos os
  cartões. A job mais lenta aparece quando a página já leu as jobs de alguma
  execução terminada (a execução que falhou e que ela abre basta); até lá o
  cartão diz como foi a última execução.
- **O teste que falhou é lido do texto do log.** Vitest, Jest e pytest são
  reconhecidos; outro runner, um erro de build ou um log cortado mostram só a
  lista de jobs. Um caminho que o runner escreveu fora do checkout não abre.
- **O PR #n depende do que o serviço informa.** O GitHub só aponta o pull
  request em execuções do mesmo repositório, não de um fork; o GitLab informa
  em pipelines de merge request e o Azure em builds de PR. Execuções do Forgejo
  não trazem o link.
- **O log é o final, e só quando o job termina.** GitHub e Forgejo só entregam
  o log de um job depois que ele acaba; enquanto roda, a página mostra os
  passos andando, não a saída. GitLab e Azure entregam o log parcial de um job
  em andamento — reabra para ler mais.
- **O token precisa de acesso à CI.** Um token fine-grained do GitHub precisa
  de *Actions: read* para listar e *Actions: write* para reexecutar, cancelar
  ou iniciar; um clássico precisa de `repo`. Um token do GitLab precisa de
  `read_api` para listar e `api` para os botões. Um token do Azure precisa de
  *Build: read* (e *Build: read & execute* para os botões); sem ele, a página e
  os selos ficam vazios em vez de dar erro.
- **Os selos do Azure só alcançam 100 builds.** Um commit mais antigo fica sem
  selo, embora a página Execuções de CI ainda liste o build.
- **O reexecutar do Azure é "tentar de novo o que falhou".** Funciona em
  pipelines YAML com estágios; um pipeline clássico pode recusar, e a página
  mostra a resposta do serviço.
- **Iniciar um workflow não pede as entradas dele.** Um workflow do GitHub ou
  um pipeline do GitLab com entradas obrigatórias sem valor padrão é recusado
  pelo serviço, com a mensagem dele.
- **O Forgejo é só leitura, e só em servidores recentes.** Servidores Forgejo e
  Gitea mais antigos não têm API para listar execuções; a página diz que o
  serviço não é suportado, e os selos do grafo continuam funcionando pelos
  statuses de commit. Um repositório que o token não enxerga aparece como erro
  de acesso, não como "não suportado".
- **O Bitbucket não tem página de execuções.** No Data Center, a CI é um
  sistema externo (Jenkins, Bamboo…) que só reporta um status — esse status é
  o selo do grafo. O Pipelines do bitbucket.org não é suportado.
- **Um remoto.** A página lê o `origin`; execuções em outro remoto, de um fork,
  não são listadas.

**Veja também:** [CI local](local-ci.md) · [Hosting e pull requests](hosting.md)
