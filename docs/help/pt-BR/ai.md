---
title: Recursos de IA
category: IA
order: 80
summary: Opcionais, agnósticos de provedor, e ancorados no seu código de verdade.
keywords: ia ai openai anthropic ollama llm local mensagem de commit explicar revisão wiki ancorado grounded contas conta chave api assinatura cli claude codex gemini modelos lento timeout demorando continuar aguardando cancelar não está respondendo ollama fechado trocar de conta outra conta
---

# Recursos de IA

Todo recurso de IA é **opcional** e fica desligado até você configurar um provedor.
Nada é enviado para lugar nenhum até você pedir algo específico.

![Configurações de IA](../../screenshots/settings-ai.webp)

## Uma IA para todos os perfis

A IA é configurada uma vez, em **Configurações → IA**, e todos os
[perfis](profiles.md) usam ela: um perfil criado depois já tem IA, sem cadastrar
conta de novo. A página lista cada perfil e se ele segue esta **IA geral**.

Um perfil pode usar **uma IA própria** — um perfil de trabalho que precisa
passar pela conta da empresa, por custo ou política de dados, ou que escreve os
commits de outro jeito. Na página **Perfil** dele, em *IA deste perfil*, troque
**Geral** por **Própria**: ela começa como uma cópia de toda a IA geral —
contas, chaves e preferências — e dali em diante tudo isso é só dele. Voltar
para **Geral** apaga tudo, depois de uma confirmação, e não mexe na IA geral.

Um perfil usa uma IA **inteira**: a geral ou a própria, nunca uma mistura. As
contas e os modelos *e* o jeito como a IA escreve e o que o chat pode fazer vêm
do mesmo lugar, então mudar o estilo de commit na IA geral muda para todo
perfil que segue ela.

Toda IA é configurada nesta página. A barra **Editando** no topo escolhe de
quem: a IA geral ou a própria de um perfil (*IA própria de Trabalho*).
**Configurar a IA própria**, na página Perfil, ou **Editar a IA própria**, na
lista de perfis, abre a página já nela. A página Perfil só mostra qual IA o
perfil usa e o que responde; o editor nunca fica lá, nem opção de IA nenhuma.

![A IA de um perfil na página Perfil: Geral ou Própria, o que responde e o caminho para configurar](../../screenshots/settings-profile-ai.webp)

Abaixo das contas, a mesma página guarda como essa IA **escreve** e o que ela
pode fazer, em seções:

| Seção | Guarda |
|---|---|
| **Mensagens de commit** | O estilo de commit — Conventional, Gitmoji e Ticket como cartões com uma linha de exemplo, o resto em *Mais estilos* — *Gerar a descrição do commit*, a linha de coautor, **Regras extras para commits** e uma prévia |
| **Explicar e passar o mouse** | Estilo das explicações, *Explicar código ao passar o mouse* e a tecla dele |
| **Conflitos e branches** | Estilo de resolução de conflitos, estilo de nome de branch, cada um com um exemplo do resultado |
| **Chat do repositório** | Se o chat está ligado, o que ele lê, as ações que pode propor — veja [Chat do repositório](repo-chat.md#configurações) |

**Regras extras para commits** — *Instruções personalizadas* até a 4.60 — entram só na geração de mensagens de commit: o chat, as explicações, as revisões e os nomes de branch não as leem. A prévia é um exemplo fixo, não uma chamada ao modelo: mostra o formato do estilo escolhido, não o que a IA vai escrever para a sua alteração.

![Mensagens de commit](../../screenshots/settings-ai-commits.webp)

A troca de estilo no compositor e os seletores de modelo e de aprovação do chat
gravam na mesma IA que o perfil lê: a geral ou a própria do perfil.

Quem atualiza de uma versão em que cada perfil tinha a sua IA não perde nada:
a IA do perfil em uso vira a IA geral, e qualquer outro perfil com uma IA
diferente fica com ela como própria.

**Quem atualiza da 4.59 ou anterior**, quando as preferências de escrita
ficavam em cada perfil: uma única vez, as preferências do perfil em uso (ou, se
ele tiver IA própria, do primeiro perfil na IA geral) passam para a IA geral.
Perfis com IA própria ficam com as suas. **O limite:** se dois perfis na IA
geral escreviam diferente — um de trabalho em `ticket` e um pessoal em
`conventional` — os dois passam a escrever como o que foi copiado. Para manter
a diferença, dê a um deles uma IA própria e escolha o estilo de novo lá.

## Provedores

Uma **conta** é um jeito de alcançar um modelo: um provedor, onde encontrá-lo e
como ele se autentica. Você pode configurar várias e elas convivem — uma chave
do trabalho, uma pessoal, um modelo local, uma CLI em que você já entrou.

As predefinições cobrem **OpenAI, Anthropic, Google Gemini, OpenRouter, Groq,
Mistral** e **Ollama** (inteiramente local), além de qualquer endpoint
compatível com OpenAI.

**Uma chave nunca sai desta máquina sem criptografia.** Uma conta com chave
chega ao endpoint por `https://`, ou por `http://` simples só neste computador
(`localhost`, `127.x`, `::1`). Uma chamada que mandaria a chave por `http://`
para outro host é recusada antes de qualquer envio, com o motivo. Um endpoint
sem chave — o Ollama em outra máquina da sua rede — continua funcionando por
`http://`.

A Anthropic usa a própria API `/v1/messages` em vez de uma chamada no formato
OpenAI, então os modelos Claude funcionam de fato em vez de apenas parecer.
O Gemini é alcançado pelo endpoint compatível com OpenAI do Google.

### Adicionar e editar um provedor

Um provedor salvo pela metade era uma armadilha silenciosa: uma chave vazia
podia acabar em uso, e nada respondia. Por isso nada neste cartão é salvo
enquanto você digita.

**Adicionar provedor** abre um cartão marcado **Rascunho · não salvo**, com borda
tracejada. Preencha provedor, chave, endpoint e modelo e escolha
**Testar e salvar**. O GitHuttBr primeiro lista os modelos do provedor
com essa chave — a mesma requisição de **Buscar modelos** — e só salva quando
ele responde. Você vê **Conectado · N modelos**, e o provedor entra na lista como
**Pronto**.

Quando o teste falha, o cartão diz **Não foi possível conectar** com o motivo
do provedor (uma chave recusada, `401`; um servidor que não está rodando) e
**Nada foi salvo.** Corrija o campo e teste de novo, escolha
**Salvar mesmo assim** para mantê-lo como está — ele passa a aparecer como
**Não responde** — ou **Cancelar**, que não deixa rastro.

Editar um provedor salvo funciona do mesmo jeito. Uma faixa diz
**Alterações não salvas — nada muda até você salvar**, e cada campo que você mexeu fica marcado
**· alterado**. **Descartar alterações** devolve os valores salvos;
**Testar e salvar** testa e salva. Escolher outro provedor, adicionar um
ou abrir **Usar minha assinatura** com alterações pendentes pergunta
**Salvar alterações em “…”?** — **Salvar**, **Descartar alterações** ou
**Continuar editando**. Fechar as Configurações mantém o rascunho na
memória, então ele continua lá quando você volta; ele nunca é gravado em disco.

As chaves são salvas exatamente como antes, no seu chaveiro, e só na hora de
salvar. O erro de um provedor aparece com a chave e qualquer coisa com cara de
token mascaradas.

![Adicionar e editar um provedor](../../screenshots/ai-provider-draft.webp)

| Tipo de provedor | O que **Testar e salvar** verifica |
| --- | --- |
| Chave de API ou servidor local (Ollama, endpoint próprio) | Lista os modelos; sucesso quer dizer que o endpoint respondeu com essa chave |
| Assinatura (Codex, Claude Code) | Envia o prompt curto de teste descrito abaixo, da franquia do seu plano |
| CLI local | Procura o comando no seu `PATH`; um caminho digitado é salvo sem verificação |

### Selos de status

Cada provedor da lista tem um selo, calculado com o que a página já sabe — o
último teste, ou a lista de modelos que ela buscou de qualquer forma. Nada é
consultado em segundo plano.

| Selo | Significado |
| --- | --- |
| **Pronto** | O último teste ou listagem de modelos deu certo |
| **Não responde** | A última tentativa falhou; o motivo está na linha de baixo, com **Testar de novo** |
| **Sem chave** | O provedor precisa de uma chave de API e não tem |
| **Não verificado** | Nada perguntou a ele ainda — uma assinatura até ser testada, ou uma lista não buscada |

**O limite:** um selo é tão recente quanto a última verificação. Um provedor que
parou de responder há uma hora continua **Pronto** até algo
perguntar de novo — escolha **Testar conexão** no cartão dele para ter certeza.
Uma **CLI local** com caminho digitado fica **Não verificado**,
porque provar que funciona custaria um prompt.

### O provedor em uso

Um provedor responde a toda tarefa que não tem um provedor próprio em
**Modelo por tarefa**. A linha dele é marcada **Em uso** — um selo preenchido e
uma borda de destaque — e fica onde está na lista. A IA geral e um perfil com IA
própria têm, cada um, o seu provedor em uso; a lista muda o que você está
editando.

Todo outro provedor salvo tem um botão **Usar** à direita da linha, ao lado do
selo. Um clique o coloca em uso e salva na hora: qual provedor responde é uma
escolha, não uma edição, então não espera **Testar e salvar**. O cartão desse
provedor não é aberto, e um cartão com alterações não salvas continua com elas.

**O limite:** **Usar** não testa nada. Um provedor marcado **Sem chave** ou
**Não responde** pode ser colocado em uso — de propósito, antes de corrigir a
chave — e o selo continua dizendo isso; a próxima tarefa de IA falha com o motivo
desse provedor. Um rascunho não tem **Usar**: só vira provedor depois de salvo.

### Usar uma assinatura em vez de uma chave de API

Na configuração inicial ou em Configurações → IA, escolha **Usar minha assinatura**. Selecione ChatGPT ou Claude e entre pelo terminal com o comando correspondente. Teste a conexão e adicione a conta após a confirmação.

Depois de instalar a CLI, clique em Conectar para abrir a página de login do provedor. Você pode cancelar a conexão pendente.

- ChatGPT (Codex) — `codex login`
- Claude (Claude Code) — `claude auth login`

O teste envia uma mensagem curta ao provedor e consome a cota do plano. Limite atingido. Tente novamente quando a cota for renovada.

![Usar minha assinatura](../../screenshots/ai-subscription.webp)

Escolha o provedor **CLI local** para responder com uma CLI de agente já
instalada e autenticada nesta máquina — `claude`, `gemini` ou `codex`. O GitHuttBr
executa o binário com o seu prompt e lê a resposta; não há chave de API para
colar nem token guardado.

O GitHuttBr só executa um comando que você configurou como conta, e sempre com uma
lista de argumentos em vez de um shell, de modo que nada em um diff ou em um nome
de branch pode ser interpretado como comando.

> **Isso não é mais privado que uma chave de API.** Seus prompts continuam
> chegando ao mesmo fornecedor, na sua própria conta, exatamente como
> chegariam com uma chave. O que muda é a cobrança e a configuração, não para
> onde o texto vai.

Se o comando não estiver no seu `PATH`, digite o caminho completo na conta.

### Modelo por tarefa

Em **Modelo por tarefa**, cada recurso — mensagens de commit, chat,
explicar, revisão de PR, resolução de conflitos, wiki, temas — pode apontar para
a própria conta e o próprio modelo. Deixe uma linha em **Provedor em uso** para
seguir o provedor marcado **Em uso**. Modelo barato para mensagens de commit e um
forte para o chat é a divisão mais comum.

### Aviso de atualização

Ao atualizar de uma versão anterior às contas, isto aparece uma vez. O provedor e a chave que você tinha viram a primeira conta; nada precisa ser reconfigurado à mão.

![Aviso de atualização](../../screenshots/ai-accounts-notice.webp)

## Modelos

As listas de modelos vêm do próprio provedor e ficam em cache por um dia;
**Buscar modelos** atualiza uma na hora. Abaixo da lista o GitHuttBr diz de onde
ela veio — ao vivo, do cache (com a data) ou da lista embutida de reserva, e por
quê.

A lista é filtrada para modelos capazes de responder a um pedido de chat, então
embeddings, fala e imagem ficam de fora. Todo campo de modelo também aceita texto
livre, de modo que um modelo em prévia, uma implantação privada ou uma tag do
Ollama recém-baixada continua utilizável mesmo que o provedor não a liste.

Um provedor a quem você ainda não deu uma chave, ou que esteja inacessível,
recorre a uma pequena lista embutida em vez de a um menu vazio.

Nenhum provedor publica uma lista ordenada ou curada, então o recorte é do GitHuttBr: instantâneos datados se dobram no modelo do qual são um instantâneo (`gpt-4o` cobre `gpt-4o-2024-08-06`), e o que sobra vem do mais novo para o mais antigo em vez de alfabético. **Mostrar todos os modelos**, no fim da lista, traz de volta tudo o que o provedor devolveu.

## O que ela consegue fazer

| Recurso | O que você ganha |
|---|---|
| **Mensagem de commit** | Resumo (e corpo opcional) a partir do seu diff preparado, no estilo que você escolheu |
| **Explicar este arquivo** | Explicação em linguagem simples num painel lateral — Normal, Conciso, Para leigos… até Pirata |
| **Passar o mouse para explicar** | Segure <kbd>⇧</kbd> e aponte para um identificador para uma explicação de uma linha, mais as linhas em que ela se baseou |
| **Editar seleção com IA** | Selecione linhas num arquivo, descreva a mudança, e o modelo reescreve só aquelas linhas no rascunho do editor |
| **Resolução de conflitos** | Propõe um merge na saída editável — nunca aplica sozinha |
| **Revisão de PR** | Resume um diff e aponta riscos, cada um ancorado num `caminho:linha` real |
| **Descrição de PR** · **nomes de branch** | Rascunhados a partir dos commits e do diff da branch |
| **Temas** · **paletas do grafo** | Gerados a partir de um prompt |
| **Staging inteligente** | Sugestões do que pertence a este commit |
| **[Chat do repositório](repo-chat.md)** | Perguntas ancoradas no código, mais mudanças de arquivo revisadas seguidas de ações Git validadas |
| **Assistente de configuração de IA** | Gera arquivos de configuração de assistente (instruções, agentes, hooks) para o repositório — o botão de varinha no cabeçalho do painel de chat |

### Edite só as linhas que você selecionar

Na visão de arquivo, arraste sobre as linhas que quer mudar e aperte **Editar
com IA…** (ou clique com o botão direito numa linha e escolha no menu). Uma
barra embaixo mostra o intervalo selecionado e recebe a sua instrução —
"renomeie esta variável", "adicione verificações de nulo", "traduza estas
strings". O modelo vê as linhas selecionadas e um pouco do contexto em volta, e
devolve só a substituição daquele intervalo, que vai para o **rascunho do
editor**, não para o disco. Você revisa ali e salva ou descarta pelo fluxo normal
de edição, então nada é gravado até você mandar. Funciona em todos os backends
configurados, não só nas CLIs de agente, porque a resposta é texto, não uma
chamada de ferramenta. Os limites: reescreve um intervalo contínuo por vez, não
cria nem apaga arquivos inteiros, e uma seleção que atravessa hunks de diff é
recusada — selecione na visão de arquivo.

## Ancorada, não chutando

A revisão vê o diff como **hunks rotulados** e só pode citar esses rótulos; o
GitHuttBr então resolve cada rótulo num arquivo e numa linha reais. Um modelo que
inventa uma localização é **rejeitado e consultado de novo**, então os achados
sempre apontam para código que existe.

O passar o mouse para explicar lê só uma janela numerada em volta do token —
num diff, só os hunks visíveis na tela —, então quando uma definição mora em
outro lugar ele diz isso em vez de inventar. As respostas ficam em cache por
versão do arquivo.

O [chat do repositório](repo-chat.md) funciona do mesmo jeito: só pode citar os
trechos que recebeu, e a requisição em duas etapas escolhe esses trechos a partir
da lista de arquivos rastreados do próprio Git, não de algo que o modelo escreve.
Quando ele propõe uma mudança, o GitHuttBr valida as ações exatas de arquivo,
calcula os diffs localmente, e depois roda as ações Git seguintes sob a política
de aprovação configurada.

**Arquivos secretos mascarados nunca são enviados.** Nem arquivos cobertos pelas
regras de mascaramento de segredos — inclusive um arquivo que você fixa no chat à
mão, que é recusado com um motivo em vez de lido.

## Quando um modelo está lento, ou para de responder

Um modelo local num notebook pode levar um minuto para uma mensagem de commit, e
um modelo que "pensa" antes de responder demora ainda mais — mas um servidor
fechado no meio de um pedido não deveria deixar você olhando para um indicador
girando.

| O que acontece | O que você vê |
|---|---|
| Nenhuma resposta após 30 segundos | *"{conta} está demorando mais que o esperado para responder."*, com **Continuar aguardando**, **Usar {outra conta}** e **Cancelar**. Continuar aguardando pergunta de novo um minuto depois, se ainda estiver rodando |
| Um servidor local (Ollama, LM Studio, llama.cpp…) é fechado enquanto trabalha | Em poucos segundos: *"{conta} não está respondendo. Ele ainda está em execução?"*, com um botão para cada outra conta pronta para uso, e **Cancelar** |
| O servidor já estava fechado quando você pediu | O mesmo, na hora |

**Usar {outra conta}** cancela o pedido e envia o mesmo para essa conta, com o
modelo padrão dela — a mensagem de commit, a revisão ou a resposta do chat chega
como se você tivesse pedido lá. Isso não muda suas configurações: o próximo
pedido vai de novo para a conta que você escolheu para aquela tarefa.

Isso vale para todo recurso de IA — mensagens de commit, chat, revisão,
explicar, conflitos, temas, a wiki — porque todos passam pela mesma chamada.

## Limites

- **Só servidores locais são vigiados para saber se foram fechados.** Um
  provedor na nuvem que cai falha com o próprio erro; uma chamada na nuvem que
  só está lenta recebe o aviso de *demorando mais* como qualquer outra. Um
  servidor local ocupado, e não fechado, conta como vivo: só uma conexão
  recusada ou derrubada encerra a chamada antes da hora.

- As listas de reserva ficam desatualizadas entre versões. É para isso que serve
  a busca ao vivo; a reserva só cobre o caso em que buscar não é possível.
- Filtrar a lista de um provedor para modelos de chat é feito pelo nome, então um
  modelo de chat com nome incomum pode ficar de fora. Digite-o você mesmo.
- Uma conta de CLI não consegue informar o uso de tokens a menos que a CLI o
  faça, então os números de uso e custo nas configurações vão subestimar essas
  chamadas.
- Voltar para uma versão anterior à IA geral perde as chaves da IA geral: essa
  versão não sabe onde elas ficam e as descarta ao salvar. As contas continuam;
  basta digitar as chaves de novo. A IA própria de um perfil não é afetada.
- Respostas por CLI são mais lentas que uma chamada direta à API: o binário
  inicia uma sessão inteira a cada pedido.
- As chaves ficam guardadas por conta no chaveiro do seu sistema. Excluir uma
  conta exclui a chave dela.

**Veja também:** [Wiki do repo](repo-wiki.md) · [Segurança e segredos](security.md)
