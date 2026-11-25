---
title: Cofre
category: Segurança
order: 71
summary: Um armazenamento local e criptografado para os segredos de que um repo precisa — nunca commitados.
keywords: cofre vault segredos secrets env keychain criptografado local por repo global copiar
---

# Cofre

Os valores de `.env` de que um projeto precisa têm que morar em algum lugar. O cofre
é esse lugar, sem que eles acabem dentro do repositório.

![O cofre](../../screenshots/vault.webp)

- **Criptografado em repouso** com o keychain do seu sistema.
- **Dois escopos**: entradas presas a um repositório, e um conjunto **global** que
  você pode referenciar de qualquer lugar.
- **Não é um arquivo, e não tem nada a ver com o seu `.env`.** As entradas são
  *associadas* a um repositório mas nunca escritas dentro dele, nunca commitadas,
  nunca enviadas.
- **Nada nunca sai da sua máquina.** Sem sync, sem nuvem.

## Usando

Abra com <kbd>⌘⇧V</kbd>, pelo menu de ferramentas, pelas Configurações, ou pela
paleta de comandos. Alterne entre qualquer repositório conhecido, revele ou copie um
valor, ou faça **Copiar como .env** de um conjunto inteiro direto para a área de
transferência.

## Quando o cofre não pode ser lido

Se o chaveiro está bloqueado, você recusou o pedido dele, ou o cofre foi salvo
por outra cópia do Gitcito (um build de desenvolvimento, um reassinado), a página
diz *O Gitcito não conseguiu ler o seu cofre* — e **não mexe nele**. Nada pode
ser adicionado ou removido enquanto isso: salvar trocaria todos os segredos dele
pelo que você acabou de digitar. Uma importação ou um bundle do
[compartilhamento seguro](secure-share.md) que entraria nele é recusado do mesmo
jeito, e avisa — antes de gravar qualquer arquivo do bundle. Uma exportação que o
levaria (um backup das configurações, um bundle do compartilhamento seguro) para
e avisa, em vez de levar um cofre vazio.

| Botão | O que faz |
|-------|-----------|
| **Tentar de novo** | Lê o cofre de novo — desbloqueie o chaveiro antes. |
| **Criar um novo cofre** | Pergunta antes. O Gitcito deixa de esperar pelo cofre antigo e cria um vazio. O arquivo antigo fica ao lado como backup, com o nome `githuttbr-vault.enc.bak-<data>`, um por substituição, e o Gitcito nunca o apaga. Para um cofre perdido de vez, não para um pedido que você recusou. |

## Levando de uma máquina para outra

O [compartilhamento seguro](secure-share.md) consegue empacotar o cofre num bundle
criptografado — e só quando você pede explicitamente que os segredos sejam
incluídos.

**Veja também:** [Segurança e segredos](security.md) · [Compartilhamento seguro](secure-share.md)
