---
title: Perfis
category: Deixe do seu jeito
order: 101
summary: Identidades e tokens separados para o trabalho e para todo o resto.
keywords: perfil perfis profile profiles identidade git usuário user e-mail email tokens contas alternar
---

# Perfis

Um perfil junta uma **identidade Git** (nome e e-mail) com os **tokens de
integração** dela. Troque de perfil e os dois mudam juntos — os commits são
atribuídos corretamente e as chamadas de API usam a conta certa.

Útil quando a mesma máquina cuida de repositórios de trabalho e pessoais, ou quando
você tem duas contas no GitHub.

![Um perfil: a identidade git de um lado, os tokens de integração dela do outro](../../screenshots/settings-profiles.webp)

## Editar um perfil, usar um perfil

Duas páginas das Configurações mudam com o perfil — **Perfil e identidade** e **Contas conectadas**, no topo do grupo **Você**, cujo título nomeia o perfil que elas editam. Todas as outras páginas valem em qualquer perfil e dizem isso no topo.

**Perfil e identidade** abre com o cartão do perfil: a foto, o nome (editado ali mesmo), *em uso* quando o app o está usando, o seletor e **Novo perfil**. **Contas conectadas** abre com o mesmo seletor numa barra, *Editando o perfil*. O seletor escolhe qual perfil você está **editando**; não muda o que o app está **usando**. Quando os dois diferem, uma faixa âmbar avisa, com **Usar este perfil** para trocar. É nesse momento que uma conta é vinculada ao perfil errado com mais facilidade, então Contas conectadas também nomeia o perfil em cada cartão e no próprio botão, e a confirmação repete. Apagar um perfil fica no mesmo lugar, e pergunta antes.

Abaixo do cartão vêm a identidade git e a assinatura de commits. Quando um repositório está aberto e faz commits como outra pessoa — o git config dele nomeia outro autor —, uma linha avisa, com **Aplicar a identidade ao repositório atual**; quando os dois batem, não há nada a aplicar e a linha não aparece. Depois vêm a foto do perfil, um resumo das **contas conectadas** — uma linha por host com *Conectada*, *Token expirado ou com erro*, *Sem acesso ao servidor* ou *Não conectada*, e **Conectar** ou **Renovar**, que abrem Contas conectadas naquele host — e qual IA o perfil usa.

O resumo verifica em silêncio, sem janela de login, cada vez que a página abre ou um token muda; nunca fica consultando. O que ele encontra é o que o menu lateral usa: **Contas conectadas** mostra uma pequena contagem de alerta quando um token foi recusado ou falhou, e só para verificações que as Configurações já fizeram. Um host inalcançável não conta — o token pode estar bom.

![Editando o perfil Work enquanto o app usa outro: a faixa amarela e o botão de vincular com o nome Work](../../screenshots/settings-profile-band.webp)

## A IA é compartilhada

Um perfil não precisa de IA própria: uma [IA geral](ai.md#uma-ia-para-todos-os-perfis)
atende todos os perfis, e um perfil só usa uma própria quando precisa. A escolha
vale para tudo: um perfil na IA geral também escreve do jeito que a IA geral está
configurada — estilo de commit, regras extras para commits, chat do repositório.
Um perfil que precisa de outro estilo ganha uma IA própria, uma cópia da geral
que ele pode mudar. Tudo isso se edita na página **IA**; a página Perfil só diz
qual IA o perfil usa e leva até lá.

## Cada perfil com as suas contas

Além de um token, um perfil pode **vincular** um login que já esteja na máquina —
do credential helper do git ou do GitHub CLI — em Configurações → Contas conectadas.
Um vínculo pertence a um só perfil: um perfil novo começa desconectado, e uma
conta que outro perfil já tem é recusada. Assim, dois perfis podem ter duas
contas do GitHub (ou do Azure DevOps) lado a lado. Veja [Hospedagem](hosting.md).

## Vínculo por repositório

Um repositório pode ser **vinculado a um perfil**, para que um fetch em segundo
plano nele sempre se autentique como a conta certa — mesmo enquanto você está
olhando um repositório que pertence à outra.

Os tokens vivem no [keychain do seu sistema](security.md), nunca no arquivo de
configurações.

**Veja também:** [Segurança e segredos](security.md) · [Hosting](hosting.md)
