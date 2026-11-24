---
title: Execuções de CI
category: Sincronização e vários repositórios
order: 59
summary: Acompanhe GitHub Actions, pipelines do GitLab, Azure Pipelines e Forgejo Actions pelo app — cada job, seus passos e seu log, com reexecutar e cancelar.
keywords: execuções de ci ci runs actions workflow pipeline build github actions gitlab pipelines azure pipelines forgejo actions jobs passos steps logs reexecutar re-run cancelar dispatch workflow_dispatch selo badge status grafo
source: 65066816cee2f0a2a5fdf96e99fbbe251ff44d26
---

# Execuções de CI

Você deu push e agora espera: troca para o navegador, acha o repositório, abre
Actions, acha a sua execução, abre o job que ficou vermelho, rola até o fim do
log. **Execuções de CI** traz esse ciclo para perto do código. Uma página lista
as execuções do remoto, das mais novas para as mais antigas; um clique abre os
jobs de uma execução, os passos de cada job e o log; e os botões para rodar de
novo ou parar ficam na própria linha.

Ela conversa com a API do próprio serviço, com o token que você já deu ao
Gitcito. Nada roda na sua máquina — para isso, veja [CI local](local-ci.md).

![A página Execuções de CI: uma execução que falhou aberta nos jobs, com o passo que falhou e o log](../../screenshots/ci-runs.webp)

## Como abrir

**Ferramentas → Execuções de CI…**, ou *Execuções de CI* na paleta de comandos
(⌘K). A página fica na aba do repositório, como a wiki e os insights, e lê o
remoto chamado `origin` — ou o primeiro remoto, quando não há `origin`.

## O que a página mostra

| Parte | O que é |
|---|---|
| **Uma linha de execução** | O título do commit (ou o nome do workflow), a branch, o workflow, o número da execução, o que a disparou (push, pull request, agendamento, manual…), quem disparou e o commit. À direita: em que pé está, quanto tempo levou — ou está levando — e há quanto tempo começou |
| **Todas as branches / branch atual** | Todas as execuções do remoto, ou só as da branch em que você está |
| **Filtro** | Reduz as execuções carregadas por título, workflow, branch, autor, commit ou evento |
| **Jobs** | Abra uma execução para listar os jobs, agrupados por estágio onde o serviço tem estágios (GitLab, Azure). Um job que falhou já abre os passos sozinho: o passo que falhou é a notícia |
| **Passos** | Cada passo de um job, com estado e duração — GitHub, Azure e Forgejo informam; o GitLab não tem passos |
| **Log** | O botão 📜 num job terminado mostra o fim do log, com as cores. Só os últimos 512 KB são baixados — onde a falha está — e a página avisa quando o começo ficou de fora |

Enquanto algo na página está na fila ou rodando, a lista pergunta ao serviço de
novo a cada 15 segundos, e os jobs da execução aberta junto; as durações andam
a cada segundo. Quando dois minutos de respostas não trazem nada novo — uma
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
| **Reexecutar** (↻) | A execução terminou, no GitHub | Todos os jobs rodam de novo |
| **Cancelar** (⊘) | A execução está na fila ou rodando | Pergunta antes: os jobs em andamento são interrompidos e o trabalho deles se perde |
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
