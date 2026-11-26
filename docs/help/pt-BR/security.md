---
title: Segurança e segredos
category: Segurança
order: 70
summary: Mascaramento, proteções, o chaveiro do sistema — e o que o GitHuttBr se recusa a fazer.
keywords: segurança security imagens nos comentários pixel de rastreamento endereço ip imagens de terceiros clique para carregar segredos secrets mascaramento masking chaveiro keychain safeStorage tokens branch protegida arquivo grande proteção guard privacidade importar exportar configurações ilegível backup partes traduzir caminhos remapear outro computador máquina nova mesclar perfis substituir perfis escolher o que exportar backup completo outro computador para o time manifesto senha appimage textconv arquivo de configurações danificado credential helper apparmor sandbox
source: 26f333bbdafd9ab662dc635c22df7456d66b1362
---

# Segurança e segredos

O GitHuttBr **não tem backend**. As únicas chamadas de rede são para o seu host Git e,
se você ligar, para o seu provedor de IA.

![Configurações de segurança](../../screenshots/settings-security.webp)

## Mascaramento de segredos

Valores em `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` e companhia são
renderizados como `KEY=••••••` nas visões de diff, arquivo e blame, para que um
compartilhamento de tela ou um print não os vaze. Material de assinatura da Apple
conta: `*.mobileprovision`, `*.provisionprofile`, `*.p12` e as chaves `*.p8` do App
Store Connect. Um `*.cer` não — um certificado é público por definição.

É **só de exibição**: nunca muda o arquivo e nunca muda o que você prepara. Um
interruptor de olho os revela por visão. `.env.example`, `.sample` e `.template` são
tratados como templates, não como segredos.

![Um .env renderizado com todo valor mascarado, e o interruptor de revelar](../../screenshots/secret-masking.webp)

## Proteções antes de você causar dano

| Proteção | Quando |
|---|---|
| **Arquivo de segredo** | Ao commitar algo que parece uma credencial — com um *Ignorar e parar de rastrear* em um clique |
| **Arquivo grande** | Ao commitar um blob acima do tamanho (limite em Configurações → Segurança) |
| **Lixo de build** | Ao commitar `xcuserdata/`, `DerivedData/` ou um `.DS_Store` — com o mesmo *Ignorar e parar de rastrear* em um clique |
| **Branch protegida** | Ao commitar direto na `main`/`master`, ou dar force push numa delas |
| **Segredos rastreados** | Ao dar push num repositório que *rastreia* um arquivo de segredo — avisado uma vez por sessão |

## Imagens nos comentários

Comentários de pull requests e issues são escritos por outras pessoas, e uma
imagem num deles é um pedido que a sua máquina faz ao site que o autor
escolheu. Esse site fica sabendo o seu IP e quando você leu o comentário — um
pixel de rastreamento não precisa de nada além do direito de comentar.

Por isso o app carrega sozinho só as imagens do próprio host: no github.com os
anexos, `*.githubusercontent.com` (que inclui o proxy que o GitHub põe na
frente de toda imagem de fora na renderização dele) e os assets; em qualquer
outro host, o próprio endereço web, por https. Toda outra imagem mostra um aviso
com o domínio dela, e só é pedida quando você clica — aquela imagem, uma vez. O
pedido nunca manda `Referer`.

| Configuração | O que faz |
|---|---|
| **Carregar imagens de outros sites nos comentários** (desligada por padrão) | Imagens de qualquer site carregam sem clique, como no site do host |

Os limites:

- **O host continua vendo você.** Uma imagem do próprio host — e, no GitHub,
  qualquer imagem pelo proxy dele — é um pedido ao host, que já sabe que esta
  conta está lendo o pull request.
- **`raw.githubusercontent.com` e `gist.githubusercontent.com` carregam sem
  clique.** Qualquer pessoa pode pôr um arquivo ali, então a imagem é dela — mas
  quem serve é o GitHub, e o autor não vê o seu IP nem quando você leu.
- **Anexos privados do GitHub expiram.** O endereço assinado dura alguns
  minutos; **Atualizar** na página traz de volta um que parou de carregar.
- **A visualização de uma caixa de comentário** nessas páginas segue a mesma
  regra: um link colado para uma imagem de fora não é carregado enquanto você
  escreve.
- **Só as páginas de pull request e de issue.** Imagens num arquivo Markdown do
  repositório, numa nota de release ou na wiki são conteúdo do seu próprio
  repositório e carregam como antes.
- **Um link não é uma imagem.** Clicar num link de um comentário abre o link no
  seu navegador, como qualquer link do app.

Um comentário também não consegue travar nem derrubar a janela: um com mais de
32.000 caracteres, ou montado para fazer o renderizador de Markdown trabalhar
por segundos, aparece como texto simples. Como o resto de um comentário é
restringido está em [Pull requests](pull-requests.md#como-os-comentários-aparecem).

## O AppImage e os caminhos que sobrevivem a ele

Um AppImage roda de uma pasta em `/tmp` (`/tmp/.mount_…`) que só existe enquanto o
app está aberto, muda de nome a cada abertura e fica num diretório em que qualquer
usuário local pode escrever. Até a 4.37.1, o AppImage podia gravar um caminho de
dentro dessa pasta em dois lugares que sobrevivem a ela: o link `githuttbr` no `PATH`
([CLI](cli.md)) e a configuração `diff.<name>.textconv` de um repositório
([atributos](attributes.md)). Depois que o app fecha, outro usuário da mesma máquina
podia recriar a pasta com um programa dele, que o seu próximo `githuttbr` ou `git diff`
executaria.

Agora o GitHuttBr recusa os dois sob um AppImage, avisa na inicialização sobre um link
`githuttbr` obsoleto (com um comando da paleta para removê-lo) e marca um conversor
obsoleto no diálogo de Atributos com um botão **Remover**. Ele só enxerga o
repositório que você tem aberto; para achar conversores obsoletos em outros lugares,
rode `git config --get-regexp 'diff\..*\.textconv'` em cada repositório (e com
`--global`) e apague qualquer entrada sob `/tmp/.mount_`. Uma máquina de um usuário
só não fica exposta, mas as entradas obsoletas continuam sendo peso morto.

## O chaveiro do sistema

Tokens e entradas do [Cofre](vault.md) são criptografados com o chaveiro do seu
sistema (o `safeStorage` do Electron), nunca com uma chave no arquivo de
configurações.

**Nada toca no chaveiro até você mandar.** Antes que o diálogo de permissão do
próprio sistema possa aparecer, o GitHuttBr explica o que está sendo guardado, o que
ele não consegue fazer (um app só consegue ler de volta a entrada que ele mesmo
criou — as suas outras senhas são inalcançáveis), e que dizer não está tudo bem: os
tokens então vivem na memória apenas pela sessão, o Cofre fica fechado, e você pode
ligar depois em **Configurações → Segurança → Chaveiro do sistema**.

Uma instalação nova faz **zero** chamadas ao chaveiro até algo de fato precisar ser
guardado.

**Depois de atualizar para a 4.59 no macOS** o sistema pode perguntar mais uma vez
pelo item *GitHuttBr Safe Storage*: o bundle id do app mudou para `com.huttbr.git`,
e o chaveiro pergunta de novo por um app que ele não reconhece. **Permitir sempre**
mantém os tokens; veja [atualização](upgrading.md).

Enquanto ele estiver desligado, o campo de token em Integrações avisa — *Guardado só até você fechar o GitHuttBr: o chaveiro do sistema está desligado.* — com um botão **Ativar** ao lado. Ativar, por ali ou por aqui, também guarda os tokens que você já digitou nesta sessão, então não é preciso colá-los de novo.

![O campo de token em Integrações com o chaveiro desligado: guardado só até fechar, com o botão Ativar](../../screenshots/token-keychain-notice.webp)

Um token que você **remove** com o chaveiro desligado some na hora — nada mais é
enviado com ele — mas só **nesta sessão**: o armazenamento criptografado não pode
ser gravado com o chaveiro desligado, e a remoção fica na memória, nunca num
arquivo. Ligue o chaveiro de novo antes de fechar e a cópia guardada é apagada nesse
momento; feche antes e o token antigo volta na próxima abertura. Até lá o aviso
continua aparecendo por esse motivo. Para apagar de vez um token guardado num passo
só, limpe-o com o chaveiro ligado.

Um campo em branco só limpa o que o GitHuttBr mostrou a você. Com o chaveiro
desligado desde o início, os tokens salvos nunca são descriptografados nem
mostrados — os campos ficam vazios —, então um token que você digita ali e depois
limpa de novo é o único removido; o salvo por baixo dele continua lá quando o
chaveiro for ligado.

Se a janela recarregar ou travar enquanto a explicação do chaveiro está na tela, a
pergunta conta como não respondida — não como um não — e é feita de novo na
próxima vez que um token precisar ser guardado. Nada fica esperando uma pergunta
que ninguém mais pode responder: as configurações carregam de novo normalmente.

### Linux sem chaveiro

No Linux, o chaveiro é um serviço de segredos — GNOME Keyring ou KWallet. Quando
nenhum está rodando, o sistema ainda "criptografa", mas com uma senha fixa, igual
em todas as máquinas: os tokens e as chaves ficam embaralhados, não protegidos.
Configurações → Segurança avisa isso embaixo do status do chaveiro — *Nenhum
chaveiro está rodando…* — para a palavra *chaveiro* nunca prometer uma proteção
que não existe.

Para nada novo cair num armazenamento que qualquer um desembaralha, um token
digitado sem chaveiro rodando fica guardado **só até você fechar o app**. O campo
do token avisa — *Guardado só até você fechar o GitHuttBr: nenhum chaveiro está
rodando…* — sem botão de tentar de novo, porque tentar de novo não resolve; só um
chaveiro resolve. Importar um arquivo de configurações com credenciais avisa o
mesmo antes de importá-las. Os tokens salvos antes continuam legíveis — você nunca
perde o acesso a eles — e apagar ou trocar um ainda remove o valor antigo do disco.
Dois limites: a chave da IA geral não é movida para o espaço compartilhado (cada
perfil continua lendo a sua), e o Cofre continua salvando no armazenamento básico,
porque não tem modo só de sessão. Instale ou desbloqueie um chaveiro e reinicie o
GitHuttBr para voltar a guardar tokens novos.

O GitHuttBr não confia só no que o sistema diz sobre o armazenamento que recebeu.
Ele o trata como básico quando o sistema diz que é, quando não sabe dizer qual
é, e quando o que ele criptografa volta marcado com a senha fixa — diga o
sistema o que disser. Assim, um chaveiro que cai para o básico em silêncio
continua mantendo tokens novos fora do disco.

Um chaveiro que para de responder não é esperado para sempre. No Linux, depois
que o chaveiro respondeu uma vez na sessão, uma pergunta sem resposta por 10
segundos conta como *sem chaveiro*: um token salvo fica só até você fechar o
app, e o Cofre fica fechado. A primeira pergunta da sessão — a que pode abrir o
pedido de senha do próprio chaveiro — e a que vem logo depois da explicação do
GitHuttBr têm dois minutos, para que ler uma janela nunca seja interrompido. Por
meio minuto depois de um desses limites a resposta continua *sem chaveiro* sem
perguntar de novo; depois o GitHuttBr pergunta outra vez. macOS e Windows
respondem localmente e nunca têm limite de tempo.

O limite vale só para essa pergunta — *há um chaveiro aí?* Um chaveiro que
responde a ela e depois trava ao criptografar ou descriptografar continua sendo
esperado: salvar as configurações, e o Cofre, ficam ocupados até ele responder
ou o GitHuttBr ser reiniciado.

### Quando os tokens salvos não podem ser lidos

Se você fecha o pedido do chaveiro do sistema, o chaveiro está bloqueado ou o
armazenamento de tokens foi gravado por outra cópia do GitHuttBr (um build de
desenvolvimento, uma versão assinada de novo), o GitHuttBr **não consegue ler os seus
tokens salvos — e os deixa intactos**. Configurações → Segurança diz *O GitHuttBr não
conseguiu ler seus tokens salvos*, e um token que você digitar enquanto isso fica só
pela sessão (o campo também avisa). Ele nunca é gravado por cima do armazenamento que
não pôde ser lido: isso trocaria todos os tokens salvos pelo que você acabou de
digitar.

| Botão | O que faz |
|--------|--------------|
| **Tentar de novo** | Lê o armazenamento de novo — o sistema pode pedir o chaveiro agora. Quando ele puder ser lido, os tokens digitados nesse meio-tempo se juntam a ele. |
| **Criar um novo cofre de tokens** | Pergunta antes. O GitHuttBr para de esperar pelo armazenamento antigo e começa um novo só com os tokens desta sessão. O arquivo antigo fica ao lado como backup por 30 dias, e depois é apagado. Serve para um armazenamento perdido de vez, não para um pedido que você fechou. |

## Importando configurações

**Configurações → Importar / Exportar** leva configurações, perfis e temas de uma
máquina para outra. A exportação padrão **não leva tokens nem chaves de API**, e
importar um arquivo assim nunca mexe nos que você já salvou — um token em branco no
arquivo quer dizer "não está neste arquivo", não "apague o meu".

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
**Proteger com senha** (abaixo), e exportá-las sem criptografia pergunta mais uma
vez.

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
| **Perfis e contas** | Perfis, identidade git, vínculos de integração, a IA geral e as imagens dos perfis — e as credenciais e o [Cofre](vault.md), quando o arquivo tem |
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
aparecer, o GitHuttBr confere se as pastas dos repositórios do arquivo existem
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
repositórios do arquivo têm em comum (`/home/you/code`); à direita, onde essa
pasta fica neste computador, já preenchida a partir da sua pasta pessoal
(`/Users/you/code`). Os dois campos são editáveis — o palpite pode errar, e
quando o GitHuttBr não acha uma pasta em comum deixa os dois vazios para você
digitar. Uma barra conta, enquanto você digita, quantos repositórios passam a
ter pasta aqui, com alguns deles listados — verde encontrado, vermelho ainda
faltando. A troca leva junto o apelido, a imagem da aba e o perfil de cada
repositório, e também as notas, wikis e entradas do Cofre, sem refazer nada à
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
falhar — as notas dos repositórios, o Cofre, as imagens dos perfis — o diálogo
continua aberto, diz qual etapa foi, e **Continuar importação** retoma dali sem
gravar de novo as etapas anteriores.

### Credenciais no arquivo

Um arquivo exportado com a opção de incluir credenciais traz credenciais. Mesclar
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
credencial é importada nem removida. Um arquivo exportado sem a opção não tem
nenhuma a oferecer, marque você o que marcar. **Substituir tudo** pergunta mais uma
vez ao apertar **Importar**, dizendo que todo token e chave de API salvos que o
arquivo não tem serão apagados; **Cancelar** ali deixa o diálogo como estava.

**Substituir tudo precisa do chaveiro.** Com o chaveiro desligado ou indisponível,
os tokens antigos ficariam no armazenamento criptografado e voltariam na próxima
abertura, então o GitHuttBr recusa: ele avisa, e nada é importado. O mesmo vale
enquanto os tokens salvos não podem ser lidos (veja acima): eles voltariam assim que
pudessem. **Adicionar às minhas** continua funcionando, guardando os tokens do
arquivo pela sessão.

**O limite:** credenciais pertencem a um perfil. Um perfil que a importação remove
leva os tokens salvos dele junto, qualquer que seja a escolha.

### Protegendo uma exportação com senha

Uma exportação com as credenciais marcadas vale tanto quanto os próprios tokens
para quem achar o arquivo — uma pasta sincronizada, um pendrive esquecido, um
anexo. **Proteger com senha**, no diálogo de exportação, criptografa o arquivo com
a mesma cifra do [compartilhamento seguro](secure-share.md) (uma chave derivada
por scrypt e AES-256-GCM), então nada nele — nem mesmo se ele leva credenciais —
pode ser lido sem a senha.

É opcional, com ou sem as credenciais marcadas, e a senha não tem tamanho mínimo.
Você digita duas vezes e confirma que entende que ela não pode ser recuperada;
importar o arquivo pede a senha — num diálogo em Configurações, dentro da etapa de
boas-vindas na primeira execução — e uma senha errada pede de novo.

![Configurações → Dados → Exportar: um arquivo protegido com senha, o aviso de que não há recuperação confirmado](../../screenshots/settings-export-password.webp)

| | Sem senha | Com senha |
|---|---|---|
| **Quem consegue ler** | Qualquer pessoa com o arquivo | Só quem tem a senha |
| **Um byte alterado** | É lido como está | É recusado, como uma senha errada |
| **Abre em** | Qualquer versão | Versões que conhecem o formato criptografado |

**Não há recuperação.** A senha não fica guardada em lugar nenhum — nem no arquivo,
nem nesta máquina — e não há servidor a quem pedir. Esqueceu, e o arquivo está
perdido; exporte de novo de uma máquina que ainda tenha as configurações.

Limites: uma versão mais antiga não consegue abrir uma exportação criptografada, e
também não sabe disso — ela diz que as configurações foram importadas e não muda
nada. Importe um arquivo protegido com uma versão que peça a senha. Uma senha curta
continua fraca contra alguém que tenha o arquivo e tempo para chutar; a chave scrypt
deixa cada chute lento, não impossível. A senha protege o arquivo, não o app em
execução: as credenciais são descriptografadas na memória enquanto são reunidas
para a exportação, como sempre foram.

## O arquivo de configurações

O arquivo de configurações e o armazenamento criptografado de tokens são gravados
inteiros: num arquivo novo ao lado, só do dono, que depois toma o lugar do antigo,
para que uma queda ou dois salvamentos ao mesmo tempo nunca deixem meio arquivo. Se
o arquivo de configurações for um link simbólico para outro lugar (um repositório de
dotfiles), a gravação vai para o destino do link, e o link fica. O GitHuttBr nunca
substitui o link. Um link que aponta para um arquivo que ainda não existe é gravado
através dele, criando esse arquivo — desde que a pasta dele exista. Quando a pasta
também sumiu, o salvamento falha, com uma mensagem dizendo isso: o link e o destino
dele ficam intactos, e as mudanças feitas enquanto isso só duram até o GitHuttBr
fechar. Restaure a pasta, ou aponte o link para algum lugar que exista, e o próximo
salvamento passa.

Tokens em texto puro que uma versão antiga deixou no arquivo de configurações nunca
são descartados por um salvamento: eles ficam no arquivo até o GitHuttBr carregá-los
no armazenamento criptografado (abrir Configurações faz isso), a não ser que você
mesmo limpe um.

Só duas coisas gravam esses arquivos: um salvamento das suas configurações, e o
GitHuttBr carregando-as (na inicialização, ou quando Configurações abre) — que é quando
um token antigo em texto puro é movido para o armazenamento criptografado, ou um
endereço de servidor com senha dentro é limpo. Uma consulta que ninguém pediu — um
fetch resolvendo o token, uma chamada de IA achando a chave, uma foto de perfil — só
lê, então nunca cai por cima de um salvamento. Um salvamento também é recusado até
as configurações terem sido carregadas ao menos uma vez: antes disso, o app só tem os
valores padrão.

**O custo numa instalação antiga** que ainda tem tokens em texto puro no arquivo de
configurações: até Configurações ser aberto uma vez (ou o app reiniciar e
carregá-los), cada consulta que precisa de um token descriptografa o armazenamento de
novo, e fotos de perfil que precisam de um token guardado esperam. Nada é movido por
uma consulta, então um token que você limpar nesse meio-tempo continua limpo.

Um arquivo que existe mas não pode ser interpretado (uma edição à mão que deu errado,
um disco danificado) **nunca** é substituído pelos padrões: o GitHuttBr diz que o
arquivo está danificado e não segue adiante — nenhum atalho ou comando de menu
consegue salvar por cima dele a partir dessa tela.

![A tela de inicialização para um arquivo de configurações danificado, com Tentar de novo e Mover o arquivo danificado e começar do zero](../../screenshots/settings-damaged.webp)

Você pode consertar o `githuttbr-settings.json` na pasta de dados e apertar **Tentar de
novo**, ou apertar **Mover o arquivo danificado e começar do zero**: o arquivo é
renomeado para `githuttbr-settings.json.corrupt-<date>` (nunca apagado, então você
ainda pode recuperar a partir dele), uma cópia do armazenamento criptografado de
tokens fica ao lado dele, e o GitHuttBr começa como numa primeira execução, com uma
nota dizendo para onde o arquivo foi. Para um arquivo de configurações que é link
simbólico, quem é renomeado é o destino do link, então a cópia danificada fica nos
seus dotfiles, ao lado do arquivo novo que o primeiro salvamento grava através do
link. A cópia é feita primeiro: se ela não puder ser gravada, nada é movido, e a tela
avisa e mostra a pasta de dados para você conferir, porque começar do zero sem a
cópia deixaria o primeiro token que você salvar apagar os tokens dos perfis antigos.
Corrija o que impede a pasta de ser gravada (permissões, disco cheio) e aperte
**Tentar de novo**.

Se o arquivo estragar com o GitHuttBr aberto (editado à mão por baixo dele), os
salvamentos param e o GitHuttBr avisa uma vez: as configurações não podem ser salvas
até ele ser reiniciado, e as mudanças feitas nesse meio-tempo se perdem.

Um arquivo que está lá mas não pode ser *lido* por um instante — outro programa,
como um antivírus, segurando-o — é tentado de novo por cerca de dois segundos. Se
ainda falhar, ou se o carregamento falhar por qualquer outro motivo, o GitHuttBr diz
que não conseguiu iniciar, que o arquivo não foi alterado, e oferece **Tentar de
novo**; ele não chama o arquivo de danificado.

### Limites conhecidos

Estes precisam de condições incomuns, e estão listados para ninguém ser pego de
surpresa:

- **Uma instalação muito antiga com tokens ainda no arquivo de configurações.** Se o
  chaveiro for desligado depois de os tokens salvos terem sido desbloqueados, ou
  recusado enquanto uma chave de IA ainda está guardada no formato antigo em texto
  puro, essa cópia em texto puro pode ser descartada no próximo salvamento, e o token
  some depois de reiniciar. Abra Configurações uma vez com o chaveiro ligado depois
  de atualizar de uma versão assim, e os tokens vão de vez para o armazenamento
  criptografado.
- **Um salvamento e um recarregamento que falha se cruzando na mesma janela.** Um
  token digitado num salvamento que passa na frente de um recarregamento que depois
  falha não pode ser limpo daquela janela até Configurações carregar de novo; reabra
  Configurações e limpe-o.
- **Um arquivo de configurações em link simbólico cuja pasta sumiu.** O armazenamento
  de tokens é gravado antes de o arquivo de configurações falhar, então os dois ficam
  fora de sincronia até a pasta voltar. Restaure-a (monte o disco, clone os dotfiles)
  e salve de novo.

## O token de um perfil enquanto o git roda

Quando um [perfil](profiles.md) autentica um clone, fetch, pull ou push com o token
dele, o token não vai para nenhum lugar onde outro programa poderia lê-lo: nem o
`.git/config`, nem a linha de comando (qualquer usuário local consegue ler a lista
de processos), nem o **ambiente** do comando git — que todo hook, filtro e processo
de LFS que o git inicia herda, junto com todo pacote npm que um script do husky ou do
lefthook roda.

Em vez disso, para cada operação o GitHuttBr abre um ponto de acesso privado próprio —
um socket numa pasta em que só o seu usuário entra (um named pipe com nome aleatório
no Windows) — e registra um credential helper para aquele servidor. Quando o git
pede um login, o helper se conecta, prova que pertence a esta operação com um código
aleatório feito só para ela, diz qual host e repositório o git está perguntando, e
recebe o login. O ponto de acesso responde a todos os pedidos da operação — o git
pode perguntar mais de uma vez, para o LFS, depois de um redirecionamento, para cada
processo que inicia — e é fechado e apagado quando o git termina. Um hook que despeja
o próprio ambiente acha o código, não o token.

O que ele ainda não consegue fazer:

- **Um hook ainda pode perguntar, enquanto a operação roda.** Esse código está no
  ambiente do git, porque o helper é um programa que o git inicia, e o git dá a todo
  programa que inicia o mesmo ambiente. Um hook escrito para falar o protocolo do
  helper pode usar o código para pedir o login até o git terminar — é exatamente
  assim que o hook `pre-push` do git-lfs consegue um. É uma abertura bem menor do que
  um token parado numa variável — nada o lê por acidente, um despejo ou um relatório
  de falha mostra só um código inútil depois que o git termina —, mas é uma abertura.
- **Ele só responde ao servidor para o qual foi aberto.** O ponto de acesso recusa
  qualquer outro host, um pedido `http` simples, um caminho fora da base do servidor
  e um servidor aninhado sob ele (um Data Center em `/bitbucket` ao lado de um GitLab
  na raiz) — mesmo com o código certo. Um push para várias URLs ganha um ponto de
  acesso por servidor, cada um com só o login daquele servidor. Sob um servidor com
  outro aninhado dentro, um caminho que o proxy do servidor aninhado poderia rotear
  para si também é recusado: qualquer `;` nele (o Tomcat descarta `;params`), um
  segmento terminando em ponto, e o nome da base aninhada com outra caixa ou como
  prefixo (`/Bitbucket/`, `/bitbucketx/`) — então um grupo no servidor de fora cujo
  nome começa com o caminho do servidor aninhado também não recebe o token dele.
- **Uma exceção não sobrevive a um redirecionamento do lado do servidor.** A
  verificação é sobre o caminho que o git pergunta. Se o próprio servidor de fora
  redireciona um pedido para o caminho do servidor aninhado, ou um proxy o reescreve
  para lá depois de o git mandar o login, nenhum cliente consegue ver isso.
- **Um login herdado por `git -c` é deixado de lado.** Um credential helper (ou um
  `include` que poderia adicionar um) repassado em `GIT_CONFIG_PARAMETERS` — o app
  iniciado por um alias do git, ou por outro git — é removido durante a operação,
  então ele nunca recebe o token do perfil para guardar, nem é consultado como
  ninguém. Toda outra configuração `-c` herdada é mantida.
- **Um endereço de servidor precisa estar escrito do jeito que o git lê.** O GitHuttBr
  identifica o servidor pelas regras padrão de URL, o git pelas dele: um nome
  internacionalizado (`bücher.example`), uma forma numérica abreviada (`127.1`,
  `0x7f.0.0.1`), um endereço IPv6 comprimido ou mapeado, ou um caractere codificado
  no host são servidores diferentes para cada um. Com um perfil envolvido, um
  endereço assim é recusado com uma mensagem, em vez de ficar entregue ao login da
  própria máquina. Maiúsculas e uma porta padrão explícita (`:443`) não são problema.
- **Git anterior à 2.26** casava uma entrada de credencial só com o endereço exato,
  não com tudo sob a base de um servidor. Perguntando como ninguém, o app então
  desliga os helpers para o host inteiro naquele comando; autenticar com um token
  precisa do git 2.31 de qualquer forma.
- **Não rode hooks em que você não confia** com um perfil autenticado, mesmo assim.
  Um repositório que você acabou de clonar pode trazer hooks por ferramentas como o
  husky, que os instalam no `npm install`; o git roda o que estiver em `.git/hooks`,
  pelo GitHuttBr ou por um terminal, e um hook pode fazer coisa muito pior do que ler
  um token.
- **Restrinja o escopo do token.** Um token que só consegue gravar nos repositórios
  em que você trabalha vale muito menos para quem quer que ponha as mãos nele.
- **Remotes SSH não são afetados** — não há token envolvido; quem responde é o
  [agente SSH](ssh-keys.md).

## Compartilhando com segurança

O [compartilhamento seguro](secure-share.md) exporta configurações, entradas do
Cofre ou workspaces inteiros como um **bundle criptografado** — segredos só são
incluídos quando você marca a caixa.

## Reportar um problema

O **Relatar problema** de um erro abre uma issue já preenchida no GitHub — e abrir
já manda o texto ao GitHub, antes de você decidir publicar. Por isso a mensagem é
limpa antes: uma credencial escrita numa URL, tokens, a sua pasta pessoal (e com
ela o seu nome de usuário), servidores privados e caminhos de repositório, o nome do
perfil a que um repositório está vinculado, e-mails e endereços IP são trocados.
Hosts públicos como `github.com` ficam, e também os nomes de arquivo e a mensagem do
próprio git.

**O limite:** um nome de servidor sozinho numa frase é reconhecido pelo formato —
com pontos, em minúsculas. Um host de uma palavra só (`gitserver`) só é pego nas
mensagens que o próprio GitHuttBr escreve, e um servidor sob um domínio de topo
escrito como uma extensão de arquivo (`.sh`, `.md`) é mantido como nome de arquivo.
Leia a issue antes de publicar mesmo assim: a limpeza reconhece formatos
conhecidos, não tudo o que é privado.

## O que fica no disco

O arquivo de configurações, o log de operações, o cache de avatares e o
armazenamento criptografado de tokens só podem ser lidos pela sua conta (no macOS e
no Linux). Um endereço de servidor salvo com `user:password@` ou `?token=` dentro —
vindo de uma importação ou de uma versão antiga — tem essa parte removida quando é
lido, importado ou salvo. O cache de avatares dos commits não guarda endereços de
e-mail, só hashes com um sal por instalação.

Cada um desses arquivos é gravado inteiro: num arquivo novo ao lado, que depois toma
o lugar do antigo, para que uma queda ou dois salvamentos ao mesmo tempo nunca deixem
meio arquivo — que o GitHuttBr teria de tratar como ilegível. Um backup do
armazenamento de tokens só é apagado antes do prazo quando todo token dele também
está no armazenamento atual; qualquer outro backup é mantido por 30 dias.

## Pacotes Linux: o sandbox e o AppArmor

O sandbox do Chromium precisa de user namespaces sem privilégio. O Ubuntu 24.04 e
posteriores negam isso a qualquer programa sem um perfil AppArmor que permita, e os
dois pacotes Linux lidam com isso de jeitos diferentes:

| Pacote | O que acontece |
|---------|--------------|
| `.deb` | Instala `/etc/apparmor.d/githuttbr`, um perfil para `/opt/GitHuttBr/githuttbr` que permite user namespaces. O app roda com sandbox. |
| AppImage | Não tem perfil. O inicializador dele tenta `unshare -Ur true` e, quando isso falha, abre o app com `--no-sandbox` — no Ubuntu 24.04+, isso é toda abertura. O GitHuttBr escreve um aviso na saída do console quando isso acontece. |

Para rodar o AppImage com sandbox, instale o `.deb` no lugar, ou dê ao AppImage um
perfil AppArmor próprio que permita `userns` (ou, para a máquina toda,
`sysctl kernel.apparmor_restrict_unprivileged_userns=0`, que desliga a restrição
para tudo).

**O limite do perfil do `.deb`.** Ele é `flags=(unconfined)` com `userns`
permitido, e se prende ao caminho do executável. O mesmo executável também roda como
Node puro quando iniciado com `ELECTRON_RUN_AS_NODE=1` — é assim que o comando
`githuttbr`, o conversor de diff embutido e o credential helper do GitHuttBr funcionam,
então essa chave não pode ser desligada sem quebrá-los. Juntando tudo, qualquer
programa local pode usar o executável do GitHuttBr como um interpretador Node com
permissão para criar user namespaces — o mesmo tipo de brecha dos contornos
conhecidos da restrição do Ubuntu por meio de outros programas com perfil. Isso não
dá a ninguém mais do que os direitos da própria conta; enfraquece uma camada de
proteção do kernel que o Ubuntu acrescenta por cima. O AppArmor não consegue
diferenciar os dois modos de um mesmo executável, então um perfil mais estreito não é
possível enquanto a CLI o compartilha; um binário auxiliar separado para a CLI está
no roadmap. Administradores que preferem não ter isso podem acrescentar uma regra de
negação em `/etc/apparmor.d/local/githuttbr`, ao custo do sandbox.

**Veja também:** [Cofre](vault.md) · [Compartilhamento seguro](secure-share.md)
