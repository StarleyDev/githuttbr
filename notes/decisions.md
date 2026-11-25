# Decisões

Cada decisão tem a data e o motivo. Para mudar uma delas, é preciso um fato novo.

## 2026-11-25: v4.52.0

| Decisão | Motivo |
|---|---|
| **Ícones de GitHub e GitLab redesenhados** em `BrandIcons.ts` (desenho do Feather, MIT, via Lucide, ISC), no lugar dos logos oficiais ou de ícones genéricos | O lucide 1.x removeu os ícones de marca. Os redesenhados mantêm o visual da v4.50 sem depender das regras de uso de cada marca |
| **Gramáticas do tree-sitter pelo npm**, sem versionar os `.wasm` | Atualizar uma gramática fica a uma linha do `package.json`. O custo (~424 MB no `node_modules`) é só de quem desenvolve; o app instalado não muda |
| **Redução do instalador numa versão separada** (bibliotecas só da interface → `devDependencies`, ~50–70 MB) | É uma mudança de empacotamento e precisa de review e de teste do instalador só para ela. Ver o backlog |
| **Coluna das páginas de PR com 1420px**, igual na lista e no detalhe | Ajustado olhando o app. Abaixo dessa largura as duas usam a aba inteira com 32px de margem |
| **Release em duas versões**: v4.51.0 (rollback) e depois v4.52.0 (plataforma, token e página de PRs) | O rollback precisava estar publicado antes, para existir uma versão segura para onde voltar |

## 2026-11-25: rollback de versão (v4.51.0)

| Decisão | Motivo |
|---|---|
| **Beta, último recurso, no máximo 3 versões** pelo app; versões mais antigas só pela página de Releases | Voltar de versão é temporário. Quanto mais antiga a versão, maior o risco de ela não entender as configurações atuais |
| **Versões até a v4.50.0 são recusadas** (`LAST_UNSAFE_ROLLBACK_VERSION`) | Elas não preservam os ajustes que não conhecem e apagariam os mais novos |
| **Pedir para abrir uma issue** antes de voltar | Um bug relatado é corrigido; um rollback em silêncio esconde o bug |

## Página de PRs (v4.52.0)

| Decisão | Motivo |
|---|---|
| **Fora do escopo:** sentido do Alt+← em idiomas da direita para a esquerda; abas sem `tabpanel`; o mesmo PR aberto em duas abas | Casos raros ou discutíveis; os navegadores tratam o Alt+← do mesmo jeito |
| **Azure e Bitbucket Server:** a ordem de Mesclados/Fechados não é garantida, e o manual diz isso | A documentação desses servidores não define a ordem do resultado |
