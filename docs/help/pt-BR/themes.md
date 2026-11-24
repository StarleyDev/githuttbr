---
title: Temas e aparência
category: Deixe do seu jeito
order: 100
summary: Temas nativos, claros e escuros, mais os personalizados e os gerados por IA.
keywords: tema temas theme themes escuro dark claro light aparência cores tamanho da fonte grafo graph paleta buscar pesquisar configurações encontrar search settings
---

# Temas e aparência

Temas nativos — Gitcito, Nord, Dracula, Solarized, GitHub, Monokai, Midnight,
Contrast e Daltonic — cada um com uma variante clara e uma escura.

![Trocando do claro para o escuro](../../screenshots/clip-themes.webp)

- **Claro, escuro, ou seguir o sistema**, trocado ao vivo.
- **Temas personalizados**, e temas **gerados por IA** a partir de um prompt.
- **Tamanho da fonte de código** ajustável.
- Um **estilo de grafo** à parte: paleta de faixas, estilo de canto, densidade das
  linhas e espessura dos traços, com uma pré-visualização ao vivo em mini-grafo.

![Configurações de tema](../../screenshots/settings-themes.webp)

## Encontrar uma configuração

As Configurações se espalham por muitas páginas, e a opção que você quer raramente está onde
você imagina: você sabe que ela existe, não em qual página fica. O campo de
busca no cabeçalho das Configurações, ao lado do botão de fechar, procura em
todas as páginas de uma vez.

![Buscando “terminal” nas configurações](../../screenshots/settings-search.webp)

Enquanto você digita, o lado direito lista as configurações encontradas,
agrupadas por página — cada uma com o nome, a descrição de uma linha e a página
onde fica. A barra lateral esmaece as páginas sem resultado e mostra a contagem
nas que têm.

- A busca compara com o nome da configuração, a descrição e o nome da página.
  Maiúsculas e acentos não importam (digitar "configuracao" acha
  "configuração"), e toda palavra digitada precisa aparecer, então "fonte
  terminal" restringe às configurações de fonte do terminal.
- Ela procura no idioma da interface e em inglês ao mesmo tempo: com o app em
  português, digitar "token" ou "font" ainda acha a configuração.
- Clique num resultado, ou aperte **Enter** para o primeiro, para abrir a
  página (e a aba certa em Temas — Tema ou Grafo), rolar até a configuração e
  destacá-la por um instante.
- **Esc** limpa a busca; um segundo **Esc** fecha as Configurações.

A busca olha nomes e descrições, não os valores que você definiu. As listas de
servidores por host em Integrações (GitHub Enterprise Server, GitLab
autogerenciado, Bitbucket Data Center) abrem a página Integrações; a aba do host
você escolhe. Atalhos de teclado individuais não são indexados — a busca acha a
página Atalhos, cujo editor lista todos eles.

## Layout

Barra lateral à esquerda ou à direita, painéis redimensionáveis por toda parte, uma
barra lateral colapsável para quando o grafo merece a janela inteira, e posição do
terminal por repositório.

**Veja também:** [O grafo de commits](graph.md) · [Perfis](profiles.md)
