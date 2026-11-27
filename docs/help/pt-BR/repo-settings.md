---
title: Configurações por repositório
category: Ferramentas de workspace
order: 94
summary: Nome de exibição, perfil, branches protegidas e imagem da aba de um repositório, mais as regras, o cofre e a atividade dele.
keywords: configurações do repo repo settings branches protegidas protected branches analytics log de operações operation log histórico informações engrenagem imagem da aba tab image ícone logo nome de exibição alias perfil remover da lista esquecer métricas configuração do projeto
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Configurações por repositório

A engrenagem ao lado das ferramentas da barra abre as configurações que pertencem a
**este** repositório, não ao app.

![Configurações por repositório](../../screenshots/repo-settings.webp)

O cabeçalho diz qual repositório você está prestes a alterar: o nome, a pasta,
a branch atual, o remoto principal (`origin` quando existe) com o host onde ele
fica, e algumas contagens. A contagem de branches vem da lista já carregada. A
do cofre só aparece depois que você abre **Cofre**, porque ler o cofre consulta
o chaveiro do sistema, e abrir as configurações não deveria. Não há contagem de
commits: contar um histórico longo é uma chamada git à parte, e um cabeçalho não
vale isso.

As páginas ficam numa navegação lateral, em três grupos:

| Grupo | Página | O que contém |
|---|---|---|
| Repositório | **Geral** | Nome de exibição, perfil, branches protegidas, a imagem da aba e Remover da lista |
| Repositório | **Configuração do projeto** | As [regras que este repositório carrega](repo-config.md) em `.githuttbr.json`, e o doctor que as verifica |
| Repositório | **Informações** | Notas e campos livres sobre este repositório, mantidos localmente |
| Segurança | **Cofre** | As entradas do [cofre](vault.md) deste repositório |
| Atividade | **Métricas** | O que você fez no GitHuttBr, contado localmente |
| Atividade | **Insights** | O [painel de histórico](insights.md) |
| Atividade | **Histórico de operações** | Commits ao longo do tempo e quem os fez, nos repositórios que você abriu |
| Atividade | **Logs** | O log de operações: todo comando git que o GitHuttBr rodou aqui, com o resultado |

O log de operações é o honesto: quando algo se comporta de forma estranha, ele
mostra o comando exato e o erro exato, para que um relato de bug possa carregar
fatos em vez de adjetivos.

## Geral

Cada configuração é uma linha: o que ela faz à esquerda, o controle à direita.
Nada é gravado até você clicar em **Salvar**.

| Linha | O que faz | Onde fica |
|---|---|---|
| **Nome de exibição** | O nome nas abas e listas. A pasta no disco nunca é renomeada; vazio, usa o nome da pasta | Configurações do GitHuttBr, nesta máquina |
| **Perfil** | A identidade, os tokens e a IA que este repositório ativa quando a aba dele está ativa. **Automático** segue o perfil ativo | Configurações do GitHuttBr, nesta máquina |
| **Branches protegidas** | Avisa antes de commitar ou fazer force push direto nessas branches | O git config do repositório |
| **Imagem da aba** | Uma imagem pequena na aba, abaixo | Configurações do GitHuttBr, nesta máquina |

Quando o repositório tem um `.githuttbr.json`, um aviso no topo de Geral diz
isso e leva a **Configuração do projeto**. Essas regras vão com o repositório
para todos que o clonam; as linhas abaixo do aviso são só suas.

**Remover da lista…** tira o repositório de [Repositórios](repositories.md).
Pergunta antes, e a pergunta diz o que não faz: a pasta no disco não é tocada, e
uma aba aberta continua aberta. Abrir o repositório de novo o devolve à lista.

## Imagem da aba

Com dez abas abertas, nomes que começam igual — `api`, `api-gateway`,
`api-docs` — são difíceis de distinguir. Uma imagem pequena na aba se encontra
mais rápido que um texto.

Em **Geral**, clique no campo da imagem. Ele lista as imagens do próprio
repositório — PNG, JPEG, GIF, WebP, SVG, ICO, BMP e AVIF —, cada uma com sua
miniatura, primeiro os arquivos com nome de logo ou ícone. Digite para filtrar
(`logo dark` encontra `assets/logo-dark.png`), navegue com as setas e
pressione Enter para escolher; ou digite um caminho à mão. O caminho é salvo
**relativo à raiz do repositório**, então a imagem acompanha o repositório onde
quer que a pasta dele esteja.

O que a aba mostra é uma escolha do app inteiro, em **Configurações → Geral →
As abas de repositório mostram**:

| Opção | A aba mostra |
|---|---|
| **Imagem e nome** (padrão) | A imagem no lugar do ícone de pasta, depois o nome |
| **Só o nome** | O ícone de pasta e o nome, como se não houvesse imagem |
| **Só a imagem** | Apenas a imagem; o nome vai para o tooltip |

Limites que vale conhecer:

- A lista traz os arquivos que o git enxerga — versionados e não versionados,
  não os ignorados — e no máximo 40 por vez; digite para chegar ao resto. Uma
  imagem ignorada ainda pode ser digitada à mão.
- Imagens acima de 1 MB, ou ilegíveis, aparecem esmaecidas e não podem ser
  escolhidas: um ícone de 20 pixels não precisa de mais.
- Um repositório **sem** imagem sempre mostra o nome, seja qual for a opção:
  uma aba vazia seria impossível de identificar.
- Se o caminho estiver **quebrado** — arquivo apagado, renomeado, não é imagem
  ou é grande demais —, a aba volta discretamente ao nome, e esta aba de
  configurações mostra um aviso abaixo do caminho. Nada mais reclama.
- A imagem é lida uma vez por sessão. Se você substituir o arquivo com o mesmo
  nome, abra esta aba de configurações de novo para recarregá-la.
- A configuração fica nas configurações do GitHuttBr nesta máquina, não no
  repositório, então os colegas não a herdam.

**Veja também:** [Segurança e segredos](security.md) · [Insights](insights.md)
