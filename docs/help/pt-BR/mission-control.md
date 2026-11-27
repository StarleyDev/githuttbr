---
title: Mission control
category: Sincronização e vários repositórios
order: 51
summary: Todo repositório do workspace numa tela só, o pior primeiro.
keywords: central de controle mission control painel dashboard todos os repos visão geral status sujo não enviado atrasado workspace
---

# Mission control

Vinte repositórios, e a pergunta é sempre a mesma: qual deles precisa de mim?

A central de controle responde. Todo repositório do **workspace ativo** numa tela
só, ordenado pelo que de fato precisa de você:

1. **Travados** — um rebase ou merge deixado pela metade, conflitos, um repo que
   não consegue nem ser lido.
2. **A sincronizar** — commits para puxar, depois commits para enviar.
3. **Em andamento** — trabalho não commitado, arquivos não rastreados.
4. **Limpos** — os quietinhos, lá embaixo, onde é o lugar deles.

![Todo repositório numa tela só, o pior primeiro](../../screenshots/mission-control.webp)

## O que uma linha te diz

Cada linha se lê da esquerda para a direita, e as colunas se alinham ao longo da
lista, então as contagens se comparam como numa tabela:

| Coluna | O que mostra |
|---|---|
| **Repositório** | Nome, grupo, a branch e seu upstream — ou **sem upstream** em âmbar, já que uma branch assim nunca é enviada por engano, mas também nunca sincroniza |
| **Último commit** | Assunto e autor: o que o repositório estava fazendo, sem abri-lo |
| **Local** | Conflitos · ↓ para baixar · ↑ para enviar · no stage · modificados · não rastreados · stashes. Passe o mouse para ver o que cada uma conta |
| **Hospedagem** | Os pull requests abertos, com os que aguardam a **sua** revisão em âmbar, e o CI do HEAD. Clique no número para abrir a página de **Pull requests** daquele repositório, ou em **CI** para abrir as execuções |
| **Release** | A tag mais recente alcançável do HEAD, e quantos commits vieram depois dela — **em dia** quando nenhum. O número muda de cor conforme a release atrasa: cinza até 5 commits, amarelo até 20, vermelho acima, tudo ajustável em **Configurações → Git e sincronização → Cores da nota de release** |
| **Atividade** | Um sparkline de commits de 14 dias, e quantos commits são |
| **Tempo** | Quanto tempo desde o último commit, e desde o último **fetch** |

Passe o mouse no ícone de status para ver por que a linha está naquela posição —
"2 para enviar · 1 sem commit".

A idade do fetch está ali porque ler esta tela nunca faz fetch: a contagem "para
baixar" é tão recente quanto o último fetch. Quando uma branch com upstream está
sem fetch há um dia ou mais, ou nunca fez, a idade fica âmbar — faça fetch antes
de confiar num 0. O horário vem do próprio git, então um `git fetch` no terminal
também conta.

![Configurações → Git e sincronização: a atualização do Mission Control e as cores da nota de release](../../screenshots/settings-git-sync.webp)

Numa janela estreita todas as colunas ficam, e a tabela rola para o lado dentro da moldura.

**Abrir**, no fim da linha, mostra o próprio repositório — o grafo dele — mesmo que a aba estivesse na lista de pull requests que o número de PRs abriu.

Expanda uma linha (a setinha, ou <kbd>espaço</kbd>) para ver exatamente quais
commits estão esperando para ser enviados e quais arquivos estão sujos.

## Trabalhando a lista

- As pílulas de status no topo são **filtros** — clique em "3 travados" para ver só
  esses. **N PRs abertos** e **N CI falhando** filtram do mesmo jeito, e também
  **N aguardando sua revisão**, na linha de baixo.
- Ordene por **urgência**, **nome** ou **atividade**.
- **Marque vários repos** para buscar neles, ou dê pull só nos que estão atrasados
  (o botão conta para você).
- **Fetch em N desatualizados** aparece quando há branches com upstream sem fetch
  há um dia ou mais, e faz fetch só nelas — as que podem estar com o "para baixar" errado.
- Ela se atualiza sozinha a cada 30 segundos enquanto está aberta — mude em
  **Configurações → Git e sincronização → Atualização do Mission Control**, no
  mínimo 30 segundos. Nada roda com a tela fechada.

| Tecla | Ação |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> ou <kbd>j</kbd> <kbd>k</kbd> | Percorrer a lista |
| <kbd>Enter</kbd> | Abrir aquele repositório |
| <kbd>f</kbd> / <kbd>p</kbd> | Fetch / pull nele |
| <kbd>espaço</kbd> | Expandir |
| <kbd>/</kbd> | Pular para o filtro |

## É uma visão, não uma aba

O medidor ao lado do nome do workspace a liga e desliga; clicar em qualquer aba te
devolve ao seu trabalho. Ela nunca acrescenta uma aba própria, e pertence ao
workspace em que você está — troque de workspace e você recebe o painel daquele
workspace.

A parte do git é **local**: alguns comandos git por repositório, sem fetch. A
coluna **Hospedagem** é a única que fala com um host. Ela pergunta ao host de cada
repositório pelos pull requests abertos e pelo CI do HEAD, com o perfil daquele
repositório, e em silêncio: um host sem token ou vínculo para esse perfil
simplesmente não mostra nada, e nenhuma janela de login abre. Um repositório já
aberto numa aba não custa chamada nenhuma, porque a lateral já tem os pull requests
dele.

Limites, para ler os números certo:

- Cada host é consultado **no máximo a cada 5 minutos** por repositório (antes,
  quando o HEAD muda ou uma execução de CI ainda está rodando), seja qual for o
  intervalo de atualização — a cota da API do host é dividida com o resto do app.
  **Atualizar** consulta de novo na hora.
- A contagem mostra **30+** quando a primeira página do host veio cheia; a página
  da lista tem todos.
- A coluna de release é a tag mais recente **alcançável do HEAD**, não a mais nova
  do repositório. Uma tag criada num commit que o HEAD já tem aparece em até dois
  minutos.

Buscar é sempre algo que você pediu.

**Veja também:** [Workspaces e abas](workspaces.md) · [Workspaces, abas e grupos](workspaces.md)
