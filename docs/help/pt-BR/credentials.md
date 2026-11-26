---
title: Credential helper
category: Segurança
order: 73
summary: O armazenamento de senhas do próprio git — o terceiro — e por que o https fica te perguntando de novo.
keywords: credential helper senha password https pergunta de novo osxkeychain wincred manager libsecret store cache git-credentials texto puro esquecer revogado token 401 token na url do remote senha embutida invalid username or token authentication failed set-url
source: 6c443db6f1d01e52607a4d9a88e70008db4a8801
---

# Credential helper

O Gitcito guarda três tipos diferentes de segredo, e as pessoas razoavelmente supõem
que são uma coisa só:

| | Guardado por |
|---|---|
| Tokens de API do host — PRs, issues, checks de CI | O Gitcito, no [keychain do sistema](security.md) |
| Transporte `git@…` | Sua [chave SSH](ssh-keys.md), via o agente ssh do sistema |
| **Transporte `https://`** | **O credential helper do próprio git** |

O terceiro não é ideia de recurso para ninguém até dar errado, e aí ele produz as
duas reclamações mais comuns do git: *por que ele está me perguntando de novo?* e
*por que ele ainda está mandando o token que eu revoguei?*

`⌘K` → **Credential helper**.

![O helper configurado, as regras por host, e o aviso do arquivo em texto puro](../../screenshots/credentials.webp)

## O que você está olhando

Todo `credential.helper` configurado, no escopo de onde ele vem — `system`,
`global`, e então este repositório. **Os helpers se empilham**: o git pergunta a
cada um por vez, e um no nível do repositório não substitui um global.

Cada um é verificado contra a sua máquina:

| Sinalização | Significa |
|------|-------|
| **pronto** | O programa do helper existe e vai rodar |
| **não instalado** | Configurado, mas o programa está faltando — todo prompt cai de volta em digitar tudo de novo |
| **senhas num arquivo simples** | O helper `store` (veja abaixo) |

**Regras para hosts específicos** lista as seções `credential.<url>.*`. Elas ganham
da configuração simples para as URLs que casarem, e costumam ser a resposta para
"por que este host se comporta diferente".

## Escolhendo um

| Helper | Para onde a senha vai |
|--------|------------------------|
| `osxkeychain` | Keychain do macOS — criptografado, por usuário |
| `manager` | Git Credential Manager (Windows, multiplataforma) |
| `wincred` | Gerenciador de Credenciais do Windows |
| `libsecret` | O serviço de segredos do Linux (GNOME Keyring, KWallet) |
| `cache` | Memória, por 15 minutos. Nada em disco |
| `store` | **Um arquivo simples na sua pasta pessoal. Sem criptografia** |

O Gitcito oferece o que está de fato instalado nesta máquina, marca o que combina
com o seu sistema operacional, e deixa o resto acinzentado.

**O escopo importa.** *Para todo repositório* escreve no seu config global, que é o
que você quase sempre quer; *somente para este repositório* é para aquele repo
esquisito que se autentica contra outra coisa.

## O helper `store` e o `~/.git-credentials`

O `store` escreve linhas `https://user:password@host` em `~/.git-credentials`, em
texto puro, sem criptografia de nenhum tipo. Qualquer coisa que rode como você
consegue ler: um script, o postinstall de uma dependência, qualquer coisa.

Se esse arquivo existir, esta página avisa e conta as entradas. Ela nunca as mostra
— a contagem é o ponto inteiro, e ler o conteúdo para exibi-lo seria cometer o mesmo
erro.

Se você encontrar um e não era a intenção: escolha um helper de verdade aqui, apague
o arquivo e autentique-se de novo uma vez.

## Esquecendo uma credencial guardada

Quando um token é revogado ou rotacionado, o helper continua entregando o antigo e
todo push falha com um 401 que não nomeia nada. **Esquecer** pede ao helper
configurado que apague a entrada dele para aquele host — `git credential reject`,
que é a rota documentada do próprio git.

Nada é lido no caminho: o Gitcito nunca chama `git credential fill`, o comando que
imprimiria uma senha viva na saída padrão.

O próximo push pergunta uma vez, e o helper guarda a nova resposta.

## Qual conta um push usa

Cada URL de push é verificada separadamente. Um escopo de escrita indica uma capacidade do token. A verificação não testa a participação no repositório, as regras da branch nem a permissão para alterar um arquivo específico. A leitura pública pode funcionar sem credenciais.

![Verificação de login do remoto](../../screenshots/remote-sign-in.webp)

Um push pode entrar de várias formas: o token de um perfil, um login do GitHub
CLI vinculado a um perfil, o helper do próprio git, uma senha esquecida na URL
do remote ou uma chave SSH. Quando ele é recusado, primeiro é preciso saber qual
delas foi usada. Clique com o botão direito num remote na sidebar e escolha
**Verificar login…** (ou *Verificar login dos remotes* na paleta de comandos). A
verificação resolve a credencial do mesmo jeito que um push e depois pergunta
ao host sobre ela:

| Mostra | De onde vem |
|--------|-------------|
| A origem, e o [perfil](profiles.md) por trás dela | A mesma precedência de um push — o perfil vinculado ao repositório, senão o ativo, senão o helper do git |
| A conta | A resposta do próprio host (`/user`), não o que foi digitado nas Configurações |
| Os escopos | O cabeçalho `X-OAuth-Scopes` do GitHub; a descrição que o GitLab dá do próprio token |
| O que eles permitem | Fazer push (`repo` no GitHub, `write_repository` no GitLab), e no GitHub se `.github/workflows` pode mudar |

Ela também aponta uma credencial que o host recusa (expirada ou revogada), uma
conta vinculada que não está mais conectada e uma senha guardada em texto puro
na URL do remote.

**Limites.** Um token fine-grained do GitHub não lista as permissões, então se
ele pode fazer push aparece como desconhecido até um push tentar. O Forgejo
informa a conta, mas não as permissões do token. Azure DevOps e Bitbucket
aparecem só com origem e perfil. Remotes SSH não são testados, mas
[Chaves SSH](ssh-keys.md) lista o que o agente tem. A verificação consulta o
helper do git em silêncio: um helper que precisaria abrir uma janela de login
conta como sem credencial.

## Uma senha salva na URL do remote

Um clone antigo, ou uma URL copiada de uma wiki, pode levar a credencial dentro
do endereço: `https://usuario:token@git.example.test/team/app.git`. O git envia
essa senha e não pergunta a nenhum helper — nem ao token do
[perfil](profiles.md) do repositório, nem ao GitHub CLI, nem ao armazenamento do
próprio git. Enquanto o token funciona, ninguém percebe. Quando ele é revogado
ou expira, todo fetch, pull e push daquele repositório falha com *Invalid
username or token* ou *Authentication failed*, enquanto os outros repositórios
do mesmo perfil funcionam. E o token fica em texto puro no `.git/config` do
repositório.

![Removendo um token salvo da URL de um remote](../../screenshots/remote-url-token.webp)

O Gitcito lê as URLs de fetch e de push de cada remote e avisa em três lugares:

| Onde | O que aparece |
|------|---------------|
| Um fetch, pull ou push que falhou | O erro explica que a URL do remote guarda uma senha salva, com **Remover da URL…** |
| A sidebar | Um ícone de chave na linha do remote; a mesma ação está no menu do botão direito |
| **Verificar login…** | O remote mostra a senha como origem, com o mesmo botão |

A ação pergunta antes. Ela tira a senha de todas as URLs daquele remote — a de
fetch e cada URL de push que tiver uma — e não grava nada além do
`.git/config`. Daí em diante o remote entra com o token do perfil do
repositório, ou com o helper do próprio git. Quando ela partiu de uma operação
que falhou, oferece **Tentar de novo**.

**Não há desfazer, de propósito.** Desfazer gravaria o segredo de volta no
arquivo em texto puro, que é justamente o que a ação existe para impedir. Se o
token antigo ainda puder funcionar, revogue-o no servidor: ele esteve legível
para qualquer coisa que pudesse ler a pasta do repositório.

**Limites.**

- O nome de usuário sai junto (`https://git.example.test/…`), como quando você
  roda `git remote set-url` à mão. Um servidor que precisa dele na URL — um
  token do Bitbucket Data Center sem nome de usuário no perfil — precisa que ele
  seja colocado de volta em **Editar remote…**.
- Um nome de usuário sozinho (`https://usuario@host/…`) não é apontado: o git
  continua pedindo ao helper a senha daquele usuário, então nada secreto fica
  guardado.
- URLs SSH ficam como estão: `git@host:…` e `ssh://git@host/…` dão o login que
  o ssh usa, não uma credencial.
- Só o `.git/config` é lido e alterado. Uma URL reescrita por uma regra
  `url.<base>.insteadOf`, ou um remote definido na config global, não é
  inspecionado.
- A senha nunca sai do processo principal: as URLs dos remotes chegam à janela,
  ao menu de copiar URL e ao diálogo de edição sem ela. Salvar o diálogo de
  edição com a URL que ele mostrou mantém a senha; só esta ação a remove.

## Limites que vale conhecer

- **Este é o armazenamento do git, não o do Gitcito.** Mudá-lo muda o que o seu
  terminal faz também — que é o ponto, e vale saber antes de mudar.
- **Helpers em nível de sistema são mostrados, não editáveis.** Eles moram num
  config em que só um administrador pode escrever.
- **O Gitcito não consegue listar o que um helper guarda.** Nenhuma API de
  credenciais expõe isso sem entregar os segredos, então o diálogo reporta
  configuração e apaga sob pedido, e nada mais.
- **Um token que você deu ao Gitcito é separado.** Revogar um não toca no outro; veja
  [segurança](security.md) para o lado do keychain.

Veja também: [Segurança](security.md) · [Chaves SSH](ssh-keys.md) ·
[Sincronização](syncing.md)
