# Backlog

O que ficou para depois, com o contexto para retomar sem reler a conversa. Atualizado em 2026-11-25, na preparação da v4.52.0.

Legenda: 🔴 urgente · 🟠 importante · 🟡 quando der · ⏳ esperando teste ou decisão.

---

## 1. Esperando teste ou decisão

| | Item | O que falta |
|---|---|---|
| ⏳ | **Rollback de verdade** (v4.51.0) | Num build empacotado, voltar da v4.52 para a v4.51: deve aparecer o aviso "Você voltou…", a v4.52 não deve mais ser oferecida e, ao atualizar de novo, deve vir a pergunta "restaurar ou manter". Os ajustes desconhecidos devem ser preservados |
| ⏳ | **Azure Pipelines**: validação de build como check e log do build | Testar num PR do Azure com validação de build que falhou e um token com *Build: Read* |
| 🟡 | **Ícone `.icns` no macOS**, montado por script | Conferir no Finder e no Dock |

---

## 2. Próxima versão

| | Item | Notas |
|---|---|---|
| 🟠 | **Instalador menor**: mover para `devDependencies` as bibliotecas usadas só pela interface (o Vite já as embute no bundle) | Estimativa: 50–70 MB a menos. Depois de mover, conferir o `app.asar` (nada da interface deve faltar), o `check:native` e um teste do AppImage e do .deb. Ver [`decisions.md`](decisions.md) |
| 🟡 | **Detalhe do PR apertado em larguras médias.** A media query de 860px olha a janela, não o painel. Com a barra lateral aberta, entre ~860 e ~1000px de painel, sobram ~200px para a conversa (`.prp-side` fixo em 270px) | Trocar por `container-type: inline-size` no pai e `@container`. Já acontecia antes da v4.52 |
| 🟡 | **5 screenshots gerados e não usados** por nenhuma página: `diff-wrap`, `gitmoji-picker`, `profile-avatar`, `token-keychain-notice`, `worktree-care` | Cada um tem entrada no `examples/screenshots/shots.config.mjs`. Usar numa página do manual ou tirar a entrada |

---

## 3. Segurança

| | Item | Notas |
|---|---|---|
| 🟠 | **Endurecer a release.** Sem assinatura, quem controlar a conta ou o workflow distribui código para todos pela atualização automática | Fixar as actions por SHA (hoje `@v4`); fuses do Electron (integridade do asar, `RunAsNode` desligado). O painel de testes usa o `RunAsNode` como plano B, então o fuse tem custo. As tags `v*` já estão protegidas |
| 🟡 | **Imagens remotas em PRs e issues** revelam IP e horário a terceiros (`img-src https:`) | Proxy ou carregar sob demanda |
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

---

## 5. Manual (handbook)

| | Item | Notas |
|---|---|---|
| 🟠 | **Páginas novas só em en e pt-BR**: `security.md`, `vault.md`, `terminal.md`, `rollback.md`, `worktrees.md`, `pull-requests.md` | Traduzir para os outros 14 idiomas |
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
| 🟠 | **Electron 46** (sai por volta de 2026-12-15) | O `safeStorage` já é assíncrono, então a parte que quebraria está pronta. Recompilar o `node-pty` (`npm run check:native`) |
| 🟡 | **TypeScript 7** | Esperar o ecossistema (electron-vite, vitest) |
| 🟡 | **`@tree-sitter-grammars/tree-sitter-kotlin`** declara `npm-check-updates` como dependência por engano | Só registrado |

---

## 8. Sincronizar com o upstream (MyAppDesk/gitcito)

1. Fazer o merge à mão, com mensagem no padrão (o `--no-edit` do script é recusado pelo commitlint).
2. Em `issueReport.ts`, manter `APP_ISSUES_NEW_URL` (issues no repositório do fork).
3. Na release seguinte, escrever à mão as notas do que chegou pelo merge: o changelog é first-parent e não vê esses commits.
