---
title: Segurança e segredos
category: Segurança
order: 70
summary: Mascaramento, proteções, o keychain — e o que o Gitcito se recusa a fazer.
keywords: segurança security segredos secrets mascaramento masking keychain safeStorage tokens branch protegida arquivo grande proteção guard privacidade importar exportar configurações partes traduzir caminhos outro computador mesclar perfis substituir perfis escolher o que exportar backup completo outro computador para o time manifesto
---

# Segurança e segredos

O Gitcito **não tem backend**. As únicas chamadas de rede são para o seu host Git e,
se você ligar, para o seu provedor de IA.

![Configurações de segurança](../../screenshots/settings-security.webp)

## Mascaramento de segredos

Valores em `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` e companhia são
renderizados como `KEY=••••••` nas visões de diff, arquivo e blame, para que um
compartilhamento de tela ou um print não os vaze.
Material de assinatura da Apple conta: `*.mobileprovision`,
`*.provisionprofile`, `*.p12` e as chaves `*.p8` do App Store Connect. Um
`*.cer` não — um certificado é público por definição.

É **só de exibição**: nunca muda o arquivo e nunca muda o que você prepara. Um
interruptor de olho os revela por visão. `.env.example`, `.sample` e `.template` são
tratados como templates, não como segredos.

![Um .env renderizado com todo valor mascarado, e o interruptor de revelar](../../screenshots/secret-masking.webp)

## Proteções antes de você causar dano

| Proteção | Quando |
|---|---|
| **Arquivo de segredo** | Ao commitar algo que parece uma credencial — com um *Ignorar e parar de rastrear* em um clique |
| **Arquivo grande** | Ao commitar um blob acima do tamanho (limite em Configurações → Segurança) |
| **Lixo de build** | Commitar `xcuserdata/`, `DerivedData/` ou um `.DS_Store` — com o mesmo *Ignorar e parar de rastrear* de um clique |
| **Branch protegida** | Ao commitar direto na `main`/`master`, ou dar force push numa delas |
| **Segredos rastreados** | Ao dar push num repositório que *rastreia* um arquivo de segredo — avisado uma vez por sessão |

## O keychain do sistema

Tokens e entradas do [cofre](vault.md) são criptografados com o keychain do seu
sistema (o `safeStorage` do Electron), nunca com uma chave no arquivo de
configurações.

**Nada toca no keychain até você mandar.** Antes que o diálogo de permissão do
próprio sistema possa aparecer, o Gitcito explica o que está sendo guardado, o que
ele não consegue fazer (um app só consegue ler de volta a entrada que ele mesmo
criou — as suas outras senhas são inalcançáveis), e que dizer não está tudo bem: os
tokens então vivem na memória apenas pela sessão, o cofre fica fechado, e você pode
ligar depois em **Configurações → Segurança → Keychain do sistema**.

Uma instalação nova faz **zero** chamadas ao keychain até algo de fato precisar ser
guardado.

Enquanto ele estiver desligado, o campo de token em Integrações avisa — *Guardado só até você fechar o Gitcito: o chaveiro do sistema está desligado.* — com um botão **Ativar** ao lado. Ativar, por ali ou por aqui, também guarda os tokens que você já digitou nesta sessão, então não é preciso colá-los de novo.

### Linux sem chaveiro

No Linux, o chaveiro é um serviço de segredos — GNOME Keyring ou KWallet. Quando
nenhum está rodando, o sistema ainda "criptografa", mas com uma senha fixa, igual
em todas as máquinas: os tokens e as chaves ficam embaralhados, não protegidos.
Configurações → Segurança avisa isso embaixo do status do chaveiro — *Nenhum
chaveiro está rodando…* — para a palavra *chaveiro* nunca prometer uma proteção
que não existe.

Para nada novo cair num armazenamento que qualquer um desembaralha, um token
digitado sem chaveiro rodando fica guardado **só até você fechar o app**. O campo
do token avisa — *Guardado só até você fechar o Gitcito: nenhum chaveiro está
rodando…* — sem botão de tentar de novo, porque tentar de novo não resolve; só um
chaveiro resolve. Importar um arquivo de configurações com credenciais avisa o
mesmo antes de importá-las. Os tokens salvos antes continuam legíveis — você nunca perde o
acesso a eles — e apagar ou trocar um ainda remove o valor antigo do disco. Dois
limites: a chave da IA geral não é movida para o espaço compartilhado (cada perfil
continua lendo a sua), e o Cofre continua salvando no armazenamento básico, porque
não tem modo só de sessão. Instale ou desbloqueie um chaveiro e reinicie o Gitcito
para voltar a guardar tokens novos.

O Gitcito não confia só no que o sistema diz sobre o armazenamento que recebeu.
Ele o trata como básico quando o sistema diz que é, quando não sabe dizer qual
é, e quando o que ele criptografa volta marcado com a senha fixa — diga o
sistema o que disser. Assim, um chaveiro que cai para o básico em silêncio
continua mantendo tokens novos fora do disco.

Um chaveiro que para de responder não é esperado para sempre. No Linux, depois
que o chaveiro respondeu uma vez na sessão, uma pergunta sem resposta por 10
segundos conta como *sem chaveiro*: um token salvo fica só até você fechar o
app, e o Cofre fica fechado. A primeira pergunta da sessão — a que pode abrir o
pedido de senha do próprio chaveiro — e a que vem logo depois da explicação do
Gitcito têm dois minutos, para que ler uma janela nunca seja interrompido. Por
meio minuto depois de um desses limites a resposta continua *sem chaveiro* sem
perguntar de novo; depois o Gitcito pergunta outra vez. macOS e Windows
respondem localmente e nunca têm limite de tempo.

## Importando configurações

**Configurações → Dados → Importar configurações** traz perfis, preferências e
repositórios de outra máquina. A exportação padrão **não leva tokens nem chaves
de API**, e importar um arquivo assim nunca mexe nos que você já salvou.

### Escolhendo o que exportar

Um backup e um arquivo para um colega não são o mesmo arquivo. O backup quer
tudo; um arquivo para outro computador não deveria levar pastas que não existem
lá; um arquivo para o time não deveria levar nem as suas contas nem os seus
caminhos. Por isso **Exportar configurações** abre um diálogo com as mesmas
quatro partes que a importação oferece (a tabela abaixo), cada uma com o tamanho
dela neste computador, e grava só as que você marcar. Uma parte deixada de fora
não está no arquivo — importá-lo depois deixa essa parte da outra máquina
exatamente como está.

![Configurações → Dados → Exportar: "Outro computador" escolhido, a nota verde dizendo que o arquivo não leva caminhos desta máquina, e o manifesto do que vai junto](../../screenshots/settings-export.webp)

Três atalhos acima das partes marcam as combinações comuns. Mudar uma caixa à
mão acende o atalho que bate, ou nenhum:

| Atalho | Partes | Para |
|--------|--------|------|
| **Backup completo** | As quatro | Restaurar este computador, ou uma cópia dele — o mesmo arquivo que Exportar gravava antes de ter partes |
| **Outro computador** | Perfis e contas, Preferências do app | Sua identidade e seu gosto numa máquina nova, sem as pastas e os programas desta |
| **Para o time** | Preferências do app | Tema, atalhos e grafo compartilhados — nada pessoal, nenhum caminho |

Abaixo das partes, uma nota diz se o arquivo cita pastas ou programas deste
computador: âmbar com **Repositórios** ou **Programas** marcados (a importação
em outra máquina traduz esses caminhos ou deixa de fora os que não achar), verde
sem eles. **Perfis e contas** sem **Programas** também deixa de fora o caminho
das CLIs de IA, que ficam guardados nos perfis mas apontam para binários desta
máquina.

**Credenciais só com Perfis, e só quando você pede.** Tokens e chaves de API
pertencem aos perfis, então **Incluir chaves de API, tokens e os segredos do
Cofre** só fica disponível com **Perfis e contas** marcado; desmarque a parte e
a opção é desmarcada junto. Com credenciais marcadas, o diálogo recomenda
**Proteger com senha**, e exportá-las sem criptografia pergunta mais uma vez.

Uma caixa no fim lista o que o arquivo vai conter antes de você apertar
**Exportar…**: quantos perfis (com ou sem credenciais), fotos de perfil,
preferências, caminhos de repositórios e de programas, se as notas e wikis dos
repositórios e o Cofre vão junto, quais partes ficam de fora e se o arquivo é
criptografado. O que acompanha cada parte:

| Extra | Vai com | Condição |
|-------|---------|----------|
| Fotos de perfil | Perfis e contas | Fotos escolhidas como imagem |
| Segredos do Cofre | Perfis e contas | Só com a opção de incluir credenciais |
| Notas e wikis dos repositórios | Repositórios e workspaces | Sempre, com a parte |

**Proteger com senha** criptografa o arquivo (scrypt + AES-256-GCM, como o
[compartilhamento seguro](secure-share.md)); você digita a senha duas vezes e
confirma que ela não pode ser recuperada. É opcional, com ou sem credenciais —
mas sem ela, quem tiver o arquivo consegue ler tudo o que ele leva.

Limites: a parte é a unidade — não dá para escolher um perfil, um repositório
ou uma preferência sozinhos. **Programas** sem **Perfis** leva terminal, editor
e apps padrão, mas não os caminhos das CLIs de IA (eles moram nos perfis). O
manifesto conta entradas; não mostra os caminhos em si. E um arquivo sem uma
parte não consegue devolvê-la: restaurar um arquivo **Para o time** restaura só
as preferências.

### Escolhendo o que importar

Um arquivo de configurações guarda dois tipos de coisa: o que acompanha *você*
(perfis, tema, atalhos) e o que só faz sentido na máquina que o gravou (as
pastas dos seus repositórios, o caminho do seu terminal). Aplicar tudo num
computador novo enche a barra lateral de abas apontando para o nada. Por isso,
depois de escolher o arquivo (e digitar a senha, se ele tiver), um diálogo
pergunta quais partes trazer. Nada é aplicado antes de **Importar**;
**Cancelar** deixa tudo como estava.

![Configurações → Dados → Importar: quatro partes, os repositórios desmarcados porque nenhuma pasta existe aqui, e a tradução de caminhos aberta](../../screenshots/settings-import.webp)

| Parte | O que leva |
|-------|------------|
| **Perfis e contas** | Perfis, identidade git, vínculos de integração, a IA geral e as imagens dos perfis — e as credenciais e o [cofre](vault.md), quando o arquivo tem |
| **Preferências do app** | Tema, idioma, atalhos, layout, o grafo e as cores dos ícones |
| **Repositórios e workspaces** | Abas, workspaces, favoritos, apelidos, imagens das abas, o perfil de cada repositório, pastas escaneadas e as notas e wikis de cada repositório |
| **Programas deste computador** | Terminal, editor externo, apps padrão e o caminho das CLIs de IA |

Cada parte mostra quantos itens o arquivo tem dela. Uma parte desmarcada fica
exatamente como está nesta máquina.

**Os perfis se mesclam com os seus.** Um arquivo de outro computador raramente
tem todos os perfis deste — uma conta adicionada no notebook Linux, um perfil
de cliente que só existe no Mac. Por isso **Perfis e contas** acrescenta os
perfis do arquivo aos seus em vez de substituir a lista. Antes de importar, a
parte lista cada perfil e o que acontece com ele:

| Etiqueta | Significado |
|----------|-------------|
| **Atualiza** | O perfil está nos dois: identidade, IA e imagem do arquivo substituem as suas, e os servidores dele se somam aos seus |
| **Novo** | Só o arquivo tem: entra depois dos seus |
| **Continua** | Só este computador tem: fica exatamente como está |

Dois perfis são "o mesmo" quando têm o mesmo id — o primeiro perfil de toda
instalação tem. Sem id em comum, vale o nome (sem diferenciar maiúsculas nem
contar espaços nas pontas), e o perfil fica com **o id deste computador**: os
repositórios vinculados a ele, o perfil ativo, as credenciais salvas e a imagem
continuam ligados. O perfil ativo não muda, nem a **IA geral**: o motor e o
modelo com que este computador responde continuam os dele.

**Substituir todos** continua disponível, para um backup que você quer de volta
exatamente como era: ficam só os perfis do arquivo, e os que só este computador
tem aparecem riscados como **Removido**. Ao apertar **Importar**, o diálogo
pergunta mais uma vez, dizendo quais são — eles vão embora com as credenciais
salvas e a imagem, e isso não pode ser desfeito. Com **Substituir todos**, o
perfil ativo passa a ser o do arquivo, e a IA geral do arquivo substitui a deste
computador.

Limites: a correspondência é só por id ou nome exato — um perfil renomeado de
um lado conta como novo, e você fica com os dois. Um perfil correspondido
recebe os campos do arquivo, com três exceções para nada que só este computador
tem se perder: os servidores GitHub Enterprise, GitLab e Bitbucket se **somam**
aos seus (no servidor que os dois têm, vale o do arquivo); um token que vem em
branco no arquivo mantém o seu — mas só para a mesma instância, então um token
nunca é enviado a outro Forgejo, outro emissor GitLab ou outra organização Azure;
e os logins emprestados do gerenciador de credenciais desta máquina continuam
sendo os desta máquina.

**Os padrões são um palpite a partir do seu disco.** Antes de o diálogo
aparecer, o Gitcito confere se as pastas dos repositórios do arquivo existem
aqui. Se nenhuma existe, o arquivo veio de outro computador: **Repositórios** e
**Programas** começam desmarcados, cada um com o motivo — os caminhos dos
programas são listados, para você ver que são de outro lugar. Se existem, é o
mesmo computador (um backup restaurado, por exemplo): tudo começa marcado e uma
nota verde diz isso. Um arquivo sem nenhum repositório é julgado pelos caminhos
dos programas: **Programas** só começa marcado quando todos eles existem aqui.

Quando a própria conferência falha, nada é presumido: **Repositórios** e
**Programas** começam desmarcados e sem veredito, um botão **Conferir de novo**
pergunta ao disco outra vez, e **Repositórios** não pode ser importado até uma
conferência dar certo. As outras partes podem.

**Traduzindo caminhos.** Marque **Repositórios** num arquivo cujas pastas não
existem e abre a caixa **Traduzir caminhos**. À esquerda, a pasta que os
repositórios do arquivo têm em comum (`/home/voce/code`); à direita, onde essa
pasta fica neste computador, já preenchida a partir da sua pasta pessoal
(`/Users/voce/code`). Os dois campos são editáveis — o palpite pode errar, e
quando o Gitcito não acha uma pasta em comum deixa os dois vazios para você
digitar. Uma barra conta, enquanto você digita, quantos repositórios passam a
ter pasta aqui, com alguns deles listados — verde encontrado, vermelho ainda
faltando. A troca leva junto o apelido, a imagem da aba e o perfil de cada
repositório, e também as notas, wikis e entradas do cofre, sem refazer nada à
mão.

O rodapé resume — *Importar 3 de 4 partes · 31 pastas* (pastas escaneadas e a
última pasta de clone também contam, por isso diz pastas, não repositórios) — e
**Importar** fica desligado até ao menos uma parte estar marcada.

**Importar também fica desligado quando a tradução não acha nada.** Com
**Repositórios** marcado e nenhuma pasta encontrada no novo prefixo, importar
deixaria seus repositórios vazios; corrija os caminhos ou desmarque a parte.

Limites da tradução:

- É **um prefixo trocado por outro**. Repositórios sob outra pasta no arquivo,
  ou organizados de outro jeito aqui, não são encontrados; não há mapeamento por
  repositório.
- Com uma tradução valendo, **só entram os repositórios que passam a ter
  pasta**. Os outros ficam de fora — não viram abas quebradas — e o diálogo diz
  quantos são.
- Programas nunca são traduzidos: `/usr/bin/code` não tem equivalente confiável
  em outro sistema. Deixe essa parte desmarcada e escolha-os em Configurações.
- Apagar qualquer um dos prefixos importa os caminhos como estão no arquivo.

**Durante a importação** o diálogo não pode ser fechado. Se uma etapa posterior
falhar — as notas dos repositórios, o cofre, as imagens dos perfis — o diálogo
continua aberto, diz qual etapa foi, e **Continuar importação** retoma dali sem
gravar de novo as etapas anteriores.

### Credenciais no arquivo

Um arquivo exportado com a opção de incluir segredos traz credenciais. Mesclar
perfis sempre **adiciona** as credenciais: as do arquivo vão para o perfil
correspondente, substituindo as da mesma conta, e todas as outras salvas ficam
— apagá-las contradiria manter os seus perfis. Com os perfis em **Substituir
todos**, um arquivo assim também mostra a escolha, logo abaixo de **Perfis e
contas**:

| Escolha | Suas credenciais salvas |
|---------|-------------------------|
| **Adicionar às minhas** | As do arquivo entram, substituindo as da mesma conta; todas as outras ficam |
| **Substituir tudo** | Viram exatamente as do arquivo — todo token e chave de API salvos que o arquivo não tem são apagados |

A escolha vale junto com os perfis: com **Perfis e contas** desmarcado, nenhuma
credencial é importada nem removida. **Substituir tudo** pergunta mais uma vez
ao apertar **Importar**, dizendo que todo token e chave de API salvos que o
arquivo não tem serão apagados; **Cancelar** ali deixa o diálogo como estava.
**Substituir tudo** precisa do keychain do sistema; sem ele, o Gitcito recusa e
nada é importado.

## Compartilhando com segurança

O [compartilhamento seguro](secure-share.md) exporta configurações, entradas do
cofre ou workspaces inteiros como um **bundle criptografado** — segredos só são
incluídos quando você marca a caixa.

## Reportar um problema

O **Report issue** de um erro abre uma issue já preenchida no GitHub — e abrir já
manda o texto ao GitHub, antes de você decidir publicar. Por isso a mensagem é
limpa antes: credenciais escritas numa URL, tokens, a sua pasta pessoal (e com
ela o seu usuário), servidores privados e caminhos de repositório, e-mails e
endereços da rede local são trocados. Hosts públicos como `github.com` ficam, e a
mensagem do próprio git continua legível. Mesmo assim, leia a issue antes de
publicar: a limpeza reconhece formatos conhecidos, não tudo o que é privado.

**Veja também:** [Cofre](vault.md) · [Compartilhamento seguro](secure-share.md)
