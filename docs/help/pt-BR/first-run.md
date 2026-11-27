---
title: Primeira execução
category: Comece por aqui
order: 2
summary: O assistente da primeira abertura — identidade Git, contas de hospedagem, IA, aparência — e o que cada passo salva.
keywords: onboarding primeira execução primeira abertura assistente configuração boas-vindas importar configurações identidade git contas ia assinatura chave api ollama lm studio claude code codex pular first run
source: 5b5992d94b164ac6b9b101283ec044ba376b88de
---

# Primeira execução

Na primeira vez que o GitHuttBr abre, um assistente curto pergunta o pouco que muda o comportamento desde o primeiro commit: quem você é no Git, onde seus repositórios estão hospedados, se quer usar IA e qual aparência prefere. Todo passo pode ficar vazio, e tudo o que ele define pode ser alterado depois em **Configurações**.

![O passo de IA: um CLI de assinatura encontrado neste computador e testado](../../screenshots/onboarding-ai.webp)

## A tela de boas-vindas

Antes dos passos, a tela de boas-vindas oferece **importar um arquivo de configurações** de outro computador. Um arquivo com chaves e tokens tem esses dados removidos, a menos que você marque a caixa para mantê-los, e uma exportação protegida por senha pede a senha ali mesmo. Importar aplica o arquivo e fecha o assistente — veja [Segurança e segredos](security.md) para saber o que uma exportação contém.

## Os passos

A coluna da esquerda lista os passos. Um check verde marca um passo preenchido, um traço um passo que você passou sem preencher, e a linha destacada é onde você está.

| Passo | O que define | Onde mudar depois |
|---|---|---|
| Identidade Git | O nome do perfil, e o nome e o email dos seus commits | Configurações → Perfil e identidade |
| Contas | Tokens do GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo e servidores próprios, e o app de **Abrir com…** | Configurações → Contas conectadas; o app em Configurações → Git e sincronização |
| Inteligência artificial | Uma conta de IA, colocada em uso | Configurações → IA |
| Aparência | Tema e modo claro, escuro ou automático | Configurações → Temas |
| Pronto | Nada novo — um resumo do que foi configurado | — |

**Pular por enquanto** fecha o assistente em qualquer passo e mantém o que você já preencheu.

## O passo de IA

A IA é opcional. Escolha um dos três cartões, ou **Pular, sem IA**, que desliga a IA
até você configurá-la em [Configurações → IA](ai.md):

| Cartão | O que usa | O que precisa |
|---|---|---|
| Minha assinatura | Claude Code ou Codex, logado com o seu plano | O CLI instalado e logado |
| Chave de API | OpenAI, Anthropic, Gemini, Groq, OpenRouter ou Mistral | Uma chave do provedor |
| No meu computador | Ollama ou LM Studio, rodando localmente — nada sai da máquina | O servidor iniciado |

Quando o Claude Code ou o Codex é encontrado neste computador, o cartão de assinatura diz qual e a versão, e escolher o cartão o testa: um prompt curto, depois **Testado: respondeu em N s. Pronto para usar.** Se nenhum for encontrado, ou o CLI não estiver logado, o cartão mostra a mesma configuração de conexão de [Configurações → IA](ai.md).

Para chave de API ou servidor local, **Continuar** testa a conexão listando os modelos do provedor e só salva uma conta que respondeu.

O que o passo salva é uma conta de IA comum, gravada do mesmo jeito que as Configurações gravam e colocada **Em uso**: abra Configurações → IA e ela está lá, pronta para renomear, usar só em alguns recursos ou excluir. Várias contas, um modelo por recurso e como a IA escreve se configuram lá, não no assistente.

## Limites

- **O teste da assinatura custa um prompt.** Ele conta no uso do seu plano, como qualquer requisição. Só roda quando você escolhe o cartão ou clica em **Testar de novo**.
- **Só Claude Code e Codex são detectados.** Gemini CLI e Devin respondem como contas de CLI comuns, que você adiciona em Configurações → IA.
- **Um servidor local precisa já estar rodando.** O assistente não inicia o Ollama nem o LM Studio, e não baixa modelos.
- **O assistente roda uma vez.** Depois que fecha, tudo o que ele definiu fica nas Configurações; não há como abrir o assistente de novo.
