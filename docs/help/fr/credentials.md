---
title: Assistant d'identifiants
category: Sécurité
order: 73
summary: Le magasin de mots de passe propre à git — le troisième — et pourquoi https vous redemande sans arrêt.
keywords: assistant d'identifiants credential helper mot de passe password https redemande osxkeychain wincred manager libsecret store cache git-credentials texte clair plaintext oublier forget révoqué revoked jeton token 401 vérifier la connexion quel compte jeton dans l’url du distant mot de passe intégré le retirer de l’url token in remote url embedded password invalid username or token authentication failed set-url
source: 1e74bbd13f1cd8ca72fac755ce38a4e43bc11456
---

# Assistant d'identifiants

Gitcito détient trois sortes de secrets différentes, et on suppose
raisonnablement qu'il s'agit d'une seule chose :

| | Détenu par |
|---|---|
| Les jetons d'API de l'hébergeur — PR, tickets, vérifications de CI | Gitcito, dans le [trousseau du système](security.md) |
| Le transport `git@…` | Votre [clé SSH](ssh-keys.md), via l'agent ssh du système |
| **Le transport `https://`** | **L'assistant d'identifiants propre à git** |

Le troisième n'est une fonctionnalité aux yeux de personne jusqu'à ce qu'il
déraille, et il produit alors les deux plaintes les plus courantes de git :
*pourquoi me redemande-t-il ?* et *pourquoi envoie-t-il encore le jeton que j'ai
révoqué ?*

`⌘K` → **Assistant d'identifiants**.

![L'assistant configuré, les règles par hôte, et l'avertissement sur le fichier en clair](../../screenshots/credentials.webp)

## Ce que vous regardez

Chaque `credential.helper` configuré, dans la portée d'où il vient — `system`,
`global`, puis ce dépôt. **Les assistants s'empilent** : git interroge chacun à
son tour, et un assistant au niveau du dépôt ne remplace pas un assistant global.

Chacun est confronté à votre machine :

| Indicateur | Signifie |
|------|-------|
| **prêt** | Le programme assistant existe et s'exécutera |
| **non installé** | Configuré, mais le programme est absent — chaque demande retombe sur une saisie manuelle |
| **mots de passe dans un fichier en clair** | L'assistant `store` (voir ci-dessous) |

**Règles pour des hôtes spécifiques** liste les sections `credential.<url>.*`.
Elles l'emportent sur le réglage simple pour les URL qu'elles couvrent, et sont
généralement la réponse à « pourquoi cet hôte-là se comporte-t-il
différemment ».

## En choisir un

| Assistant | Où va le mot de passe |
|--------|------------------------|
| `osxkeychain` | Le trousseau macOS — chiffré, par utilisateur |
| `manager` | Git Credential Manager (Windows, multiplateforme) |
| `wincred` | Le gestionnaire d'identifiants Windows |
| `libsecret` | Le service de secrets Linux (GNOME Keyring, KWallet) |
| `cache` | La mémoire, pendant 15 minutes. Rien sur le disque |
| `store` | **Un simple fichier dans votre répertoire personnel. Non chiffré** |

Gitcito propose ce qui est réellement installé sur cette machine, marque celui
qui correspond à votre système, et grise le reste.

**La portée compte.** *Pour tous les dépôts* écrit dans votre configuration
globale, ce que vous voulez presque toujours ; *pour ce dépôt uniquement* est
réservé au dépôt inhabituel qui s'authentifie contre autre chose.

## L'assistant `store`, et `~/.git-credentials`

`store` écrit des lignes `https://user:password@host` dans `~/.git-credentials`,
en texte clair, sans chiffrement d'aucune sorte. Tout ce qui s'exécute sous votre
identité peut le lire : un script, le postinstall d'une dépendance, n'importe
quoi.

Si ce fichier existe, cette page le dit et compte les entrées. Elle ne les
affiche jamais — le compteur est tout l'intérêt, et lire le contenu pour
l'afficher serait exactement la même erreur.

Si vous en trouvez un sans l'avoir voulu : choisissez ici un vrai assistant, puis
supprimez le fichier et réauthentifiez-vous une fois.

## Oublier un identifiant stocké

Quand un jeton est révoqué ou changé, l'assistant continue de tendre l'ancien et
chaque push échoue avec un 401 qui ne nomme rien. **Oublier** demande à
l'assistant configuré d'effacer son entrée pour cet hôte — `git credential
reject`, la voie documentée par git lui-même.

Rien n'est lu au passage : Gitcito n'appelle jamais `git credential fill`, la
commande qui imprimerait un mot de passe actif sur la sortie standard.

Le push suivant vous demande une fois, et l'assistant stocke la nouvelle réponse.

## Quel compte un push utilise

Chaque URL de push est vérifiée séparément. Un scope d’écriture n’est qu’une capacité du jeton. L’appartenance au dépôt, les règles de branche et le droit de modifier un fichier précis ne sont pas testés. Les lectures publiques peuvent réussir sans identifiants.

![Vérification de la connexion au distant](../../screenshots/remote-sign-in.webp)

Un push peut se connecter de plusieurs façons : le jeton d’un profil, une connexion
GitHub CLI liée à un profil, le helper propre à git, un mot de passe oublié dans l’URL
du distant, ou une clé SSH. Quand il est refusé, il faut d’abord savoir laquelle il a
utilisée. Faites un clic droit sur un distant dans la barre latérale et choisissez
**Vérifier la connexion…** (ou *Vérifier la connexion des dépôts distants* dans la
palette de commandes). La vérification résout l’identifiant comme le ferait un push,
puis interroge l’hébergeur à son sujet :

| Elle montre | D’où cela vient |
|----------|--------------------|
| La source, et le [profil](profiles.md) derrière | La même priorité qu’applique un push — le profil lié au dépôt, sinon l’actif, sinon le helper de git |
| Le compte | La réponse de l’hébergeur lui-même (`/user`), pas ce qui a été saisi dans les Paramètres |
| Les scopes | L’en-tête `X-OAuth-Scopes` de GitHub ; la description que GitLab donne de son propre jeton |
| Ce qu’ils permettent | Les scopes d’écriture du jeton (`repo` sur GitHub, `write_repository` sur GitLab), et sur GitHub si `.github/workflows` peut changer |

Elle signale aussi un identifiant que l’hébergeur refuse (expiré ou révoqué), un compte
lié qui n’est plus connecté, et un mot de passe stocké en clair dans l’URL du distant.

**Limites.** Un jeton GitHub à granularité fine ne liste pas ses permissions, donc la
possibilité de pousser apparaît comme inconnue jusqu’à ce qu’un push essaie. Forgejo
indique le compte mais pas les permissions du jeton. Azure DevOps et Bitbucket ne
sont montrés qu’avec leur source et leur profil. Les distants SSH ne sont pas testés,
mais [Clés SSH](ssh-keys.md) liste ce que détient l’agent. La vérification interroge le
helper de git en silence : un helper qui aurait besoin d’une fenêtre de connexion
compte comme vide.

## Un mot de passe enregistré dans l’URL du distant

Un vieux clone, ou une URL collée depuis un wiki, peut porter son identifiant dans
l’adresse : `https://user:token@git.example.test/team/app.git`. **Un mot de passe dans
l’URL a toujours la priorité :** git l’envoie et ne consulte aucun helper — ni le
jeton du [profil](profiles.md) du dépôt, ni la GitHub CLI, ni le stockage propre à
git. Tant que le jeton marche, tout va bien, et Gitcito n’y touche pas : **il ne retire
jamais un mot de passe d’une URL sans vous le demander.** Dès que le jeton est révoqué
ou expire, chaque fetch, pull et push de ce dépôt échoue avec *Invalid username or
token* ou *Authentication failed*, alors que les autres dépôts du même profil
fonctionnent. Et le jeton se trouve en clair dans le `.git/config` du dépôt.

![Retirer un jeton enregistré de l’URL d’un distant](../../screenshots/remote-url-token.webp)

Gitcito lit les URL de fetch et de push de chaque distant et le signale à trois
endroits :

| Où | Ce que vous voyez |
|-------|--------------|
| Un fetch, pull ou push échoué | L’erreur explique que l’URL du distant contient un mot de passe enregistré, avec **Le retirer de l’URL…** |
| La barre latérale | Une discrète icône de clé sur la ligne du distant : son URL contient un mot de passe qui a priorité sur le jeton du profil. La même action est dans son menu contextuel |
| **Vérifier la connexion…** | Le distant montre le mot de passe comme sa source, avec le même bouton |

L’action demande d’abord. Elle retire le mot de passe de toutes les URL de ce distant —
l’URL de fetch et chaque URL de push qui en contient un — et n’écrit rien d’autre que
`.git/config`. La suite dépend de ce qui peut encore se connecter :

| Après le retrait | Ce qu’utilisent fetch et push |
|---------------|-------------------------|
| Le profil du dépôt a un jeton ou un compte lié pour cet hébergeur | Ce jeton — la confirmation n’en dit pas plus |
| Pas de jeton de profil, mais le helper propre à git a une connexion pour l’hébergeur | La connexion du helper |
| Ni l’un ni l’autre | Rien : fetch et push échouent jusqu’à ce que vous ajoutiez un jeton. La confirmation le dit d’abord et propose **Ajouter d’abord un jeton**, qui ouvre Paramètres → Intégrations |

Quand elle a été lancée depuis une opération échouée, elle propose **Réessayer**.

**Il n’y a pas d’annulation, exprès.** Annuler réécrirait le secret en clair dans le
fichier, ce que l’action existe justement pour empêcher. Si l’ancien jeton pouvait
encore marcher, révoquez-le sur le serveur : il était lisible par tout ce qui pouvait
lire le dossier du dépôt.

**Limites.**

- Le nom d’utilisateur part aussi (`https://git.example.test/…`), comme quand vous
  lancez `git remote set-url` à la main ; la confirmation le dit. Un serveur qui en a
  besoin dans l’URL — un jeton Bitbucket Data Center sans nom d’utilisateur dans le
  profil — demande de le rajouter avec **Modifier le remote…**.
- Un nom d’utilisateur seul (`https://user@host/…`) n’est pas signalé : git demande
  toujours au helper le mot de passe de cet utilisateur, donc rien de secret n’est
  stocké.
- Les URL SSH ne sont pas touchées : `git@host:…` et `ssh://git@host/…` nomment le
  login qu’utilise ssh, pas un identifiant.
- Le préfixe d’un helper distant (`persistent-https::https://…`, `gcrypt::…`) est
  conservé ; l’URL qui suit est lue et nettoyée comme une autre.
- **Les URL ambiguës ne sont pas proposées au retrait.** Quand les lecteurs ne
  s’accordent pas sur l’endroit où commence l’hôte — un `@` après un `?` ou un `#` dans
  l’adresse, ou un mot de passe contenant un `/` non encodé —, couper au mauvais `@`
  ferait pointer le distant vers un autre serveur. Une telle URL n’est montrée que
  masquée, et l’icône de clé ouvre **Modifier le remote…** pour que vous la corrigiez à
  la main.
- Seul `.git/config` est lu et modifié. Une URL réécrite par une règle
  `url.<base>.insteadOf`, ou un distant défini dans votre configuration globale, n’est
  pas inspecté — et renommer un distant ne copie jamais dans la configuration du dépôt
  un mot de passe qu’une règle `insteadOf` ajoute.
- Le mot de passe ne quitte jamais le processus principal : les URL des distants
  arrivent à la fenêtre, au menu de copie de l’URL et à la boîte de modification sans
  lui. Enregistrer la boîte de modification avec l’URL qu’elle montrait ne change rien
  et garde le mot de passe ; **changer l’hôte ou le chemin le supprime**, puisque l’URL
  saisie est écrite telle quelle. Seule cette action retire un mot de passe en gardant
  l’adresse.

## Limites qu'il vaut mieux connaître

- **C'est le magasin de git, pas celui de Gitcito.** Le modifier modifie aussi ce
  que fait votre terminal — c'est le but, et cela vaut la peine de le savoir
  avant de le modifier.
- **Les assistants au niveau système sont affichés, pas modifiables.** Ils vivent
  dans une configuration que seul un administrateur peut écrire.
- **Gitcito ne peut pas lister ce qu'un assistant détient.** Aucune API
  d'identifiants ne l'expose sans livrer les secrets : la boîte de dialogue
  rapporte donc la configuration et efface sur demande, rien de plus.
- **Un jeton que vous avez confié à Gitcito est séparé.** En révoquer un ne
  touche pas à l'autre ; voir [sécurité](security.md) pour le côté trousseau.
- **Le jeton d’un profil reste hors de l’environnement des hooks du dépôt.** Un hook
  ne voit qu’un code pour un point d’accès privé, valable le temps de cette commande
  git — assez pour un hook qui demande exprès, comme le fait git-lfs. Voir
  [le jeton d’un profil pendant que git tourne](security.md#le-jeton-dun-profil-pendant-que-git-sexécute).

Voir aussi : [Sécurité](security.md) · [Clés SSH](ssh-keys.md) ·
[Synchronisation](syncing.md)
