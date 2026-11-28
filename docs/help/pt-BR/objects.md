---
title: Explorador de objetos
category: Repositório e histórico
order: 16
summary: Caminhe pela camada abaixo do grafo — commits, trees, blobs, tags e as refs que apontam para eles. Nada aqui muda nada.
keywords: objetos objects explorador de objetos blob tree commit tag ref plumbing cat-file ls-tree sha1 internals banco de dados rev-parse HEAD^{tree} loose packed
source: 946d418d5b13af167a16a2f0d3164d813b423ab6
---

# Explorador de objetos

O git tem fama de ser complicado. Quase toda essa fama vem de nunca se ver o
modelo: **quatro tipos de objeto, e ponteiros**. Assim que você consegue clicar num
commit, cair na tree dele, e descobrir que o seu arquivo *é* um blob com um nome
dado a ele por uma tree, a porcelana deixa de ser mágica.

`⌘K` → **Explorador de objetos**. Nada nesta página consegue mudar um byte — toda
chamada por trás dela é uma leitura.

![O commit para o qual main aponta: o caminho desde a branch, para onde ele aponta e onde um commit fica no modelo](../../screenshots/objects.webp)

## Os quatro objetos

| Objeto | É | Sabe |
|--------|----|-------|
| **blob** | O *conteúdo* de um arquivo | Nada. Nem o nome, nem o caminho, nem o histórico |
| **tree** | Uma listagem de diretório | Nomes, modos, e o sha de cada blob ou tree filho |
| **commit** | Um instantâneo | Sua tree, seus pais, autor, committer, mensagem |
| **tag** | Uma tag anotada | O objeto para o qual aponta, quem tagueou, uma mensagem |

A surpresa, para a maioria das pessoas, é a primeira linha. **Um blob não tem
nome.** Dois arquivos com conteúdo idêntico em qualquer ponto do seu histórico são
o mesmo blob, guardado uma vez só. O nome mora na tree que aponta para ele — que é
por que o git rastreia conteúdo em vez de arquivos, e por que renomeações são
detectadas em vez de registradas.

Uma **ref** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — é só um arquivo
contendo um sha. É nisso que consiste todo o "criar branch é barato".

## Caminhando

![Do commit até src/: pastas primeiro, cada modo explicado](../../screenshots/objects-tree.webp)

A coluna da esquerda lista todas as refs, agrupadas como o git agrupa: HEAD
(com `→ main` quando está numa branch), Branches, Tags e Remotas, cada grupo
com sua contagem. Remotas começa recolhido. O marcador quadrado é uma ref para
um commit; o redondo verde, uma tag **anotada**. O filtro estreita todos os
grupos de uma vez. Clique numa ref para cair no objeto que ela nomeia; essa
linha fica acesa enquanto você caminha a partir dela.

Dali em diante, tudo é uma porta:

- Um **commit** mostra para onde **aponta** — a árvore raiz, com quantos itens
  ela tem, e cada pai, com seu assunto — depois autor e committer (*o mesmo que
  o autor* quando coincidem) e a mensagem.
- Uma **árvore** é uma tabela de nome, modo, objeto e tamanho, pastas
  primeiro. Cada modo vem por extenso: *arquivo*, *executável*, *pasta*, *link
  simbólico*, *submódulo*. Uma pasta diz quantos itens tem; um link, para onde
  aponta.
- Um **blob** mostra o texto com números de linha (só o começo, quando é
  grande), ou diz com clareza que é binário. Quando você chega nele por uma
  árvore, uma faixa diz como ele se chama ali — *Chamado de src/app.ts no
  commit 07c6f3d, modo 100644 (arquivo comum)* — com um link para o histórico
  do arquivo.
- Uma **tag anotada** aponta para o objeto que nomeia e registra quem a criou.

![Um blob, o nome que a árvore deu a ele e onde ele fica no modelo](../../screenshots/objects-blob.webp)

### O caminho

A faixa abaixo da caixa de revisão é o **caminho** que você percorreu:
`branch main → commit 07c6f3d → raiz → src/ → app.ts`. A árvore de um commit é
a **raiz**; um arquivo ou pasta recebe o nome da linha em que você clicou.
Clique em qualquer item para voltar até ele. Digitar uma revisão, escolher uma
ref ou um dos exemplos ao lado de **Abrir** começa um caminho novo.

**Voltar** e **Avançar** percorrem tudo o que você abriu, como num navegador:
depois de voltar, Avançar retorna, até você abrir algo novo dali. A caixa de
revisão acompanha a caminhada, então `main:src/app.ts` está sempre lá para copiar.

### Cores

Cada tipo mantém uma cor onde quer que apareça — selo, item do caminho, cartão,
linha: commit na cor de destaque do tema, árvore no amarelo, blob em azul, tag
e ref em verde. Abaixo do cabeçalho do objeto, uma frase diz o que aquele tipo *é*.

### Onde você está no modelo

A faixa no pé do painel é a cadeia do git — **ref → commit → tree → blob**,
com **tag** entre ref e commit numa tag anotada — e o tipo na tela fica aceso
como *você está aqui*.

## Digitando uma revisão

A caixa aceita qualquer coisa que o `git rev-parse` aceite, que é onde isto deixa
de ser um navegador e passa a ser um jeito de aprender:

| Digite isto | Para obter |
|-----------|--------|
| `HEAD` | O commit atual |
| `HEAD~3` | Três commits atrás |
| `HEAD^{tree}` | A tree daquele commit, descascada |
| `HEAD:src/app.ts` | O blob daquele caminho, diretamente |
| `v1.0^{}` | Para o que uma tag anotada aponta, em vez do objeto da tag |
| `a1b2c3d` | Qualquer objeto, pelo sha — abreviações funcionam |

Os dígitos de modo numa listagem de tree valem conhecer: `100644` um arquivo,
`100755` executável, `040000` uma subtree, `120000` um symlink, `160000` um gitlink
de submódulo — sendo este último tudo o que um submódulo guarda.

## Limites que vale conhecer

- **Somente leitura, de propósito.** Não há nada aqui com que escrever. Criar
  objetos na mão é um exercício de `git hash-object`, e pertence a um terminal.
- **Blobs grandes são truncados** depois dos primeiros 200 KB — o suficiente para
  ver o que é, não o suficiente para travar a janela.
- **Os tamanhos são o tamanho do conteúdo do objeto**, como o `git cat-file -s`
  reporta, não o que ele custa em disco depois de empacotado. Para isso, veja
  [manutenção](maintenance.md).
- **Objetos inalcançáveis continuam sendo objetos.** Cole um sha de um relatório de
  dangling do `git fsck` e ele abre, o que muitas vezes é a forma mais rápida de
  ver o que um commit perdido continha antes de decidir se vale recuperá-lo.
- **Uma linha de submódulo não abre.** O gitlink nomeia um commit de outro
  repositório, que este não tem.
- **Contagens e destinos de link têm teto.** Uma árvore com mais de 300
  subpastas lista as pastas sem a contagem de itens, e só os 50 primeiros
  links simbólicos mostram o destino.
- **O caminho acaba com o diálogo.** Feche-o e o próximo recomeça pela branch
  do HEAD.

Veja também: [O grafo](graph.md) · [Manutenção do repositório](maintenance.md) ·
[Recuperação](recovery.md)
