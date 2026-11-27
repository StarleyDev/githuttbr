# Backlog

O que ficou para depois, com o contexto para retomar sem reler a conversa. Atualizado em 2026-11-26, na preparação da v4.54.0.

Legenda: 🔴 urgente · 🟠 importante · 🟡 quando der · ⏳ esperando teste ou decisão.

---

## 1. Esperando teste ou decisão

| | Item | O que falta |
|---|---|---|
| ⏳ | **Rollback de verdade** (v4.51.0) | Num build empacotado, voltar da v4.52 para a v4.51: deve aparecer o aviso "Você voltou…", a v4.52 não deve mais ser oferecida e, ao atualizar de novo, deve vir a pergunta "restaurar ou manter". Os ajustes desconhecidos devem ser preservados |
| ⏳ | **Azure Pipelines**: validação de build como check e log do build | Testar num PR do Azure com validação de build que falhou e um token com *Build: Read* |
| ⏳ | **Ajustes de PR do host** (resposta via GraphQL, commits de fork, "seu" no Azure, referências via GraphQL) | Conferir com um PR real: responder numa conversa do GitHub cuja raiz foi apagada; buscar os commits de um PR de fork (GitHub e GitLab); Editar/Excluir num comentário seu no Azure; passar o mouse em `#123` num repositório do GitHub |
| 🟡 | **Ícone `.icns` no macOS**, montado por script | Conferir no Finder e no Dock |
| ⏳ | **Comentários renderizados** (Markdown, imagens de terceiros sob clique) | Conferir num PR real do GitHub (`body_html`: anexo privado, imagem via camo, bloco de código, `#123` com cartão) e num MR do GitLab com `/uploads/` |

---

## 2. Próxima versão

| | Item | Notas |
|---|---|---|
| 🟠 | **Instalador menor**: mover para `devDependencies` as bibliotecas usadas só pela interface (o Vite já as embute no bundle) | Estimativa: 50–70 MB a menos. Depois de mover, conferir o `app.asar` (nada da interface deve faltar), o `check:native` e um teste do AppImage e do .deb. Ver [`decisions.md`](decisions.md) |
| 🟠 | **Mostrar os comentários formatados na conversa do PR.** Hoje aparecem com o markdown cru no app (no site do host aparecem formatados) | Precisa de um render próprio para conteúdo remoto (sem `style`, forms, só `https`/`mailto`), imagens de terceiros só com clique, e no GitHub usar o `body_html` (imagens via camo, anexos privados). Ver a review do editor em `.reviews/` |

---

## 3. Segurança

| | Item | Notas |
|---|---|---|
| 🟠 | **Endurecer a release.** Sem assinatura, quem controlar a conta ou o workflow distribui código para todos pela atualização automática | Fixar as actions por SHA (hoje `@v4`); fuses do Electron (integridade do asar, `RunAsNode` desligado). O painel de testes usa o `RunAsNode` como plano B, então o fuse tem custo. As tags `v*` já estão protegidas |
| 🟡 | **Cofre no `basic_text`** continua gravando no armazenamento básico | Um modo só de sessão exigiria estado novo na tela |
| 🟡 | **`echarts`/`uuid` via `pptx-preview`** (moderadas) | Risco residual: XSS só com `.pptx` com gráfico, mitigado pelo CSP. A correção exige major dentro do `pptx-preview` |
| 🟡 | **`sandbox: false` no renderer** | Um XSS no renderer teria acesso à ponte do app. Mudança grande, para longo prazo |

---

## 4. Qualidade e testes

| | Item | Notas |
|---|---|---|
| 🟡 | **Suíte completa só no Linux.** No Windows e no macOS roda só a suíte portable | Ampliar a portable aos poucos |
| 🟡 | **Integrações testadas só com respostas simuladas** | Um Forgejo real em Docker no CI. O Azure mostrou o risco: o formato da API não está garantido |
| 🟡 | **Revisão de falante nativo** das traduções feitas por agentes | Prioridade para es, de, fr |
| 🟡 | **Termos do manual:** fr "Réglages" → "Paramètres" (23 páginas) e es "caja fuerte" → "bóveda" (6 páginas) | |
| 🟡 | **Falso positivo do `lint:docs`:** imagem com o alt em várias linhas em `repositories.md` | |
| 🟡 | **Cores dos ícones**: excluir o tema Ultra Contrast? O realce da "Cor plena" encosta 1px no rótulo da barra | Só se incomodar |
| 🟡 | **Spinner do "Fetch N stale"** | Só o "Fetch all" mostra o spinner |
| 🟡 | **Pontas de PR de fork ficam para sempre** (`refs/githuttbr/pr/<remote>/<N>`, da aba Commits) | Nada as remove; a limpeza de branches poderia listá-las (por exemplo, as de PRs fechados). Hoje o manual ensina a apagar à mão |

---

## 5. Manual (handbook)

| | Item | Notas |
|---|---|---|
| 🟠 | **Páginas só em en e pt-BR, ou atrasadas nos outros 14 idiomas**: `security.md`, `vault.md`, `terminal.md`, `rollback.md`, `worktrees.md`, `branch-cleanup.md`, e `workspaces.md` (faltam seções inteiras: tamanho das abas, ir para um repositório, grupos) | `writing-comments.md` está em dia desde a v4.54. `pull-requests.md` ficou atrasada nos 14 idiomas (fora en e pt-BR) com os ajustes de PR do host: resposta em conversa sem raiz, commits de PR de fork, "seu comentário" no Azure e referências do GitHub via GraphQL |
| 🟡 | **Páginas antigas** (~90 mil palavras) | Inclui os parágrafos de work items e de Azure Pipelines do `hosting.md` |
| 🟡 | **Screenshot do cofre ilegível** (`VaultUnreadableNotice`) | Gerar com um cofre falso, nunca o da máquina |

---

## 6. Funcionalidades

| | Item | Notas |
|---|---|---|
| 🟠 | **Painel de testes v2**: `vitest --changed` / `jest --onlyChanged`, suítes de monorepo, outros runners | Falta saber quais linguagens e runners priorizar |
| 🟡 | **Página de PRs**: a contagem de Abertos para em 30 no GitHub, GitLab e bitbucket.org (mostra "30+") | Paginar sob demanda, se fizer falta |
| 🟡 | **IA geral: voltar a uma versão antiga perde as chaves da IA geral** | Limitação documentada em `ai.md` |
| 🟡 | **Rodar de novo um job que falhou** (Forgejo, Azure, GitHub Actions) | Precisa de token com escrita |
| 🟡 | **Concluir um PR do Azure respeitando as policies** | Conferir antes o que a página de PR já faz |
| 🟡 | **Prévia web**: painel com o dev server | O app já detecta a URL |
| 🟡 | **Assinatura no Windows e no macOS** | Depende de certificado |

---

## 7. Dependências

Em dia com a v4.52.0: Electron 45, React 19, zustand 5, framer-motion 14, lucide 1.x, xterm 6, web-tree-sitter 0.27, vitest 5, vite 8, electron-vite 6, release-it 21, commitlint 21.

| | Item | Notas |
|---|---|---|
| 🔴 | **Electron 46 remove as chamadas síncronas do `safeStorage`** (sai por volta de 2026-12-15) | A v4.52.1 voltou a cifrar e decifrar com a chave síncrona (`openSecret`/`sealSecret` em `src/main/keychain.ts`): no Linux/KDE a API assíncrona do Electron 45 pega a chave pelo portal de segredos do XDG, diferente da chave "Safe Storage" do KWallet que a síncrona usava, e a v4.52.0 deixou todos os tokens salvos até a v4.51 ilegíveis. Os dois produzem `v11`, então o prefixo não distingue. Antes de subir para o 46, planejar a migração de cada store (tokens, backups, cofre) para a chave assíncrona, mantendo um backup na chave legada para o rollback, e testar no Linux KDE (portal de segredos), GNOME, macOS e Windows com dados reais da versão anterior. Os testes com mocks não pegaram isso na v4.52.0: o fake usava uma chave só. Também recompilar o `node-pty` (`npm run check:native`) |
| 🟡 | **TypeScript 7** | Esperar o ecossistema (electron-vite, vitest) |
| 🟡 | **`@tree-sitter-grammars/tree-sitter-kotlin`** declara `npm-check-updates` como dependência por engano | Só registrado |

---

## 8. Testar a nova identidade (4.59, `com.huttbr.git`) numa máquina real

1. **Windows:** instalar a 4.58 (appId antigo), depois o instalador novo. Conferir que sobra **uma** entrada "GitHuttBr" em Aplicativos e que `%APPDATA%\GitHuttBr` (tokens) continua. Repetir com o auto-updater. Repetir com o app original instalado ao lado: a entrada dele não pode sumir. <!-- upstream-name: o app original -->
2. **macOS:** confirmar se o updater da 4.58 recusa o update (designated requirement inclui o bundle id) e se o chaveiro pede a senha para *GitHuttBr Safe Storage*. Ajustar `docs/help/upgrading.md` com o que acontecer de fato.
3. **Linux:** instalar o `.deb` com o pacote do app original instalado: os dois têm que coexistir.

- **Chat com Gemini gasta uma chamada a mais:** o schema de ações (`repoChatActionsSchema`) é complexo demais para o modo estruturado do Gemini ("too many states"). Desde o fix do fallback a resposta sai por JSON no prompt, mas a primeira chamada é sempre recusada. Enxugar o schema para o Google (ou pular o `response_format` direto nesse provedor) economiza essa ida.
