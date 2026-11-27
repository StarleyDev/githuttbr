---
title: Fonctions IA
category: IA
order: 80
summary: Optionnelles, indépendantes du fournisseur, et ancrées dans votre code réel.
keywords: ia ai openai anthropic ollama llm local message de commit expliquer explain revue review wiki ancré grounded comptes compte clé api abonnement cli claude codex gemini modèles lent timeout délai prend plus de temps continuer à attendre annuler ne répond pas ollama fermé changer de compte autre compte préférences d’écriture style de commit instructions personnalisées co-auteur survol expliquer ia propre ia générale
---

# Fonctions IA

Chaque fonction d'IA est **optionnelle** et désactivée tant que vous n'avez pas
configuré de fournisseur. Rien n'est envoyé nulle part tant que vous ne demandez
pas quelque chose de précis.

![Les paramètres d'IA](../../screenshots/settings-ai.webp)

## Une IA pour tous les profils

L'IA se configure une fois, dans **Paramètres → IA**, et tous les [profils](profiles.md)
l'utilisent : un profil créé plus tard a déjà l'IA, sans compte à rajouter. La
page liste chaque profil et indique s'il suit cette **IA générale**.

Un profil peut utiliser **sa propre IA** à la place — un profil professionnel
qui doit passer par le compte de l'entreprise, pour des raisons de coût ou de
politique de données, ou qui écrit ses commits autrement. Sur la page **Profil**
de ce profil, sous *IA de ce profil*, passez de **Générale** à **Propre** : elle
part d'une copie de toute l'IA générale — comptes, clés et préférences — et tout
cela n'appartient ensuite qu'à ce profil. Revenir à **Générale** la supprime,
après confirmation, et laisse l'IA générale telle qu'elle était.

Un profil utilise une IA **entière** : la générale, ou la sienne, jamais un
mélange. Les comptes et les modèles *et* la façon dont l'IA écrit et ce que la
discussion peut faire viennent du même endroit, si bien que changer le style de
commit de l'IA générale le change pour tous les profils qui la suivent.

Toutes les IA se configurent sur cette seule page. La barre **Modification de**
en haut choisit laquelle : l'IA générale, ou celle d'un profil (*IA propre de
Travail*). **Configurer l'IA propre** sur la page Profil, ou **Modifier son IA
propre** dans la liste des profils, ouvre la page sur celle-là. La page Profil
montre seulement quelle IA le profil utilise et ce qui répond — elle n'héberge
jamais l'éditeur, ni aucune option d'IA à elle.

![L'IA d'un profil sur sa page Profil : Générale ou Propre, ce qui répond, et le moyen de la configurer](../../screenshots/settings-profile-ai.webp)

Sous les comptes, la même page contient la façon dont cette IA **écrit** et ce
qu'elle peut faire, en sections :

| Section | Contient |
|---|---|
| **Messages de commit** | Style des messages de commit, *Générer la description du commit*, la ligne de co-auteur |
| **Expliquer et survol** | Style des explications, *Expliquer le code au survol* et sa touche de modification |
| **Conflits et branches** | Style de résolution des conflits, style de nommage des branches |
| **Instructions personnalisées** | Vos propres règles, ajoutées à chaque requête de cette IA |
| **Discussion du dépôt** | Si la discussion est activée, ce qu'elle lit, les actions qu'elle peut proposer — voir [Discussion du dépôt](repo-chat.md#paramètres) |

Le sélecteur de style du compositeur et les sélecteurs de modèle et
d'approbation de la discussion écrivent dans la même IA que celle que lit le
profil : la générale, ou celle du profil.

La mise à jour depuis une version où chaque profil avait sa propre IA ne fait
rien perdre : l'IA du profil en cours d'utilisation devient l'IA générale, et
tout autre profil dont l'IA était différente la garde comme IA propre.

**Mise à jour depuis la 4.59 ou antérieure**, où les préférences d'écriture
étaient propres à chaque profil : une seule fois, les préférences du profil en
cours d'utilisation (ou, s'il a sa propre IA, celles du premier profil sur l'IA
générale) passent sur l'IA générale. Les profils qui ont leur propre IA gardent
les leurs. **La limite :** si deux profils sur l'IA générale écrivaient
différemment — un profil professionnel en `ticket` et un personnel en
`conventional` —, les deux écrivent désormais comme celui qui a été repris. Pour
garder la différence, donnez à l'un d'eux sa propre IA et redéfinissez-y son
style.

## Fournisseurs

Un **compte** est une façon d'atteindre un modèle : un fournisseur, où le
joindre, et comment il s'authentifie. Vous pouvez en configurer plusieurs et ils
coexistent — une clé professionnelle, une personnelle, un modèle local, une CLI
à laquelle vous êtes déjà connecté.

Les préréglages couvrent **OpenAI, Anthropic, Google Gemini, OpenRouter, Groq,
Mistral** et **Ollama** (entièrement local), ainsi que tout point de terminaison
compatible OpenAI.

Anthropic utilise sa propre API `/v1/messages` plutôt qu'un appel de forme
OpenAI : les modèles Claude fonctionnent vraiment au lieu d'en donner
l'apparence. Gemini est joint via le point de terminaison compatible OpenAI de
Google.

### Ajouter et modifier un fournisseur

Un fournisseur enregistré à moitié rempli était un piège discret : une clé vide
pouvait finir par être utilisée, et rien ne répondait. Rien sur cette carte
n'est donc enregistré pendant la saisie.

**Ajouter un fournisseur** ouvre une carte marquée **Brouillon · non enregistré**, au bord en
pointillés. Renseignez le fournisseur, la clé, le point d'accès et le modèle,
puis choisissez **Tester et enregistrer**. GitHuttBr liste d'abord les modèles
du fournisseur avec cette clé — la même requête que **Récupérer les modèles** — et
n'enregistre que s'il répond. Vous voyez **Connecté · N modèles**, et le
fournisseur rejoint la liste comme **Prêt**.

Quand le test échoue, la carte affiche **Connexion impossible** avec la
raison donnée par le fournisseur (une clé refusée, `401` ; un serveur arrêté) et
**Rien n'a été enregistré.** Corrigez le champ et testez à nouveau, choisissez
**Enregistrer quand même** pour le garder tel quel — il apparaît alors comme
**Ne répond pas** — ou **Annuler**, qui ne laisse aucune trace.

Modifier un fournisseur enregistré fonctionne de la même façon. Un bandeau
indique **Modifications non enregistrées — rien ne change tant que vous n'enregistrez pas**, et chaque champ touché est marqué
**· modifié**. **Annuler les modifications** rétablit les valeurs
enregistrées ; **Tester et enregistrer** teste et enregistre. Choisir un autre
fournisseur, en ajouter un ou ouvrir **Utiliser mon abonnement** avec des modifications en
attente demande **Enregistrer les modifications de « … » ?** — **Enregistrer**, **Annuler les modifications**
ou **Continuer à modifier**. Fermer les Paramètres garde le brouillon en
mémoire : il est encore là à votre retour, et n'est jamais écrit sur le disque.

Les clés sont enregistrées exactement comme avant, dans votre trousseau, et
seulement à l'enregistrement. L'erreur d'un fournisseur s'affiche avec la clé et
tout ce qui ressemble à un jeton masqués.

![Ajouter et modifier un fournisseur](../../screenshots/ai-provider-draft.webp)

| Type de fournisseur | Ce que vérifie **Tester et enregistrer** |
| --- | --- |
| Clé d'API ou serveur local (Ollama, point d'accès personnalisé) | Liste les modèles ; un succès signifie que le point d'accès a répondu avec cette clé |
| Abonnement (Codex, Claude Code) | Envoie le court prompt de test décrit plus bas, sur le quota de votre forfait |
| CLI locale | Cherche la commande dans votre `PATH` ; un chemin saisi est enregistré sans vérification |

### Badges d'état

Chaque fournisseur de la liste porte un badge, déduit de ce que la page sait
déjà — le dernier test, ou la liste de modèles récupérée de toute façon. Rien
n'est interrogé en arrière-plan.

| Badge | Signification |
| --- | --- |
| **Prêt** | Le dernier test ou la dernière liste de modèles a réussi |
| **Ne répond pas** | La dernière tentative a échoué ; la raison figure sur la ligne en dessous, avec **Tester à nouveau** |
| **Pas de clé** | Le fournisseur exige une clé d'API et n'en a pas |
| **Non vérifié** | Rien ne l'a encore interrogé — un abonnement tant qu'il n'est pas testé, ou une liste non récupérée |

**La limite :** un badge n'est pas plus récent que sa dernière vérification. Un
fournisseur qui ne répond plus depuis une heure reste **Prêt**
jusqu'à ce que quelque chose l'interroge à nouveau — choisissez
**Tester la connexion** sur sa carte pour en être sûr. Une **CLI locale** avec un
chemin saisi reste **Non vérifié**, car prouver qu'elle marche
coûterait un prompt.

### Le fournisseur utilisé

Un fournisseur répond à toute tâche qui n’a pas son propre fournisseur dans
**Modèle par tâche**. Sa ligne porte la mention **Utilisé** — une pastille pleine
et un bord d’accent — et reste à sa place dans la liste. L’IA générale et un
profil doté de sa propre IA ont chacun leur fournisseur utilisé ; la liste change
celui que vous modifiez.

Chaque autre fournisseur enregistré a un bouton **Utiliser** à droite de sa
ligne, à côté de son badge. Un clic le rend utilisé et enregistre aussitôt : le
fournisseur qui répond est un choix, pas une modification, il n’attend donc pas
**Tester et enregistrer**. La fiche de ce fournisseur ne s’ouvre pas, et une
fiche avec des modifications non enregistrées les garde.

**La limite :** **Utiliser** ne teste rien. Un fournisseur marqué **Pas de clé**
ou **Ne répond pas** peut être utilisé — exprès, avant de corriger sa clé — et
son badge continue de le dire ; la tâche IA suivante échoue avec la raison de ce
fournisseur. Un brouillon n’a pas de bouton **Utiliser** : ce n’est un
fournisseur qu’une fois enregistré.

### L'IA utilisée, depuis la barre d'état

Un profil qui a sa propre IA ignore le fournisseur utilisé par l'IA générale :
en utiliser un autre sur l'IA générale ne change rien pour ce profil, et hors
des paramètres rien ne le disait. La barre d'état, en bas d'un dépôt, le dit
désormais. Son bouton **IA :** _fournisseur_ nomme le fournisseur qui répond
pour le profil actif, avec un point pour son état — vert **Prêt**, rouge **Ne
répond pas**, ambre **Pas de clé**, gris **Non vérifié**.

Un clic ouvre un petit panneau :

| Partie | Ce qu'elle montre |
| --- | --- |
| En-tête | Le profil actif, et s'il **suit l'IA générale** ou **a sa propre IA** |
| Une ligne par fournisseur | Chaque fournisseur enregistré de cette IA, avec son modèle et son état ; celui qui ne répond pas affiche la raison sur une deuxième ligne |
| **Utilisé** / **Utiliser** | Le fournisseur qui répond maintenant, et un changement en un clic sur chacun des autres |
| **Configurer l'IA** | Ouvre **Paramètres → IA** |
| **Utilisation et coût** | Ouvre l'onglet *Statistiques* des paramètres du dépôt |

**Utiliser** écrit là où le profil lit son IA. Sur un profil qui suit l'IA
générale, il modifie l'IA générale — donc chaque profil qui la suit ; sur un
profil qui a sa propre IA, il ne modifie que la sienne. Les tâches qui ont leur
propre fournisseur le gardent. **Échap** ferme le panneau, et le bouton est
masqué tant que l'IA est désactivée.

![L'IA utilisée depuis la barre d'état : le profil, son IA et chaque fournisseur avec son état](../../screenshots/statusbar-ai.webp)

**Les limites :** le point est déduit de la liste de modèles que l'app a
récupérée de toute façon (conservée jusqu'à un jour) et ne teste jamais rien ;
un fournisseur qui ne répond plus peut donc encore afficher **Prêt** — tester la
connexion dans les paramètres est le moyen d'en être sûr. Tant que les
paramètres n'ont pas été ouverts, la fenêtre ne détient pas les clés
elles-mêmes, si bien qu'un fournisseur sans clé peut y afficher **Non vérifié**
ou **Ne répond pas** au lieu de **Pas de clé**. Comme **Utiliser** dans les
paramètres, ce changement ne teste pas le fournisseur qu'il met en service.

### Utiliser un abonnement plutôt qu'une clé d'API

Lors de la configuration initiale ou dans Paramètres → IA, choisissez **Utiliser mon abonnement**. Sélectionnez ChatGPT ou Claude et connectez-vous dans un terminal avec la commande correspondante. Testez la connexion, puis ajoutez le compte. Le premier compte de l'IA générale devient le compte **Utilisé**.

Après avoir installé la CLI, cliquez sur Connecter pour ouvrir la page de connexion du fournisseur. Vous pouvez annuler la connexion en cours.

- ChatGPT (Codex) — `codex login`
- Claude (Claude Code) — `claude auth login`

Le test envoie un court message au fournisseur et utilise votre quota. Quota atteint. Réessayez après son renouvellement.

![Utiliser mon abonnement](../../screenshots/ai-subscription.webp)

Choisissez le fournisseur **CLI locale** pour répondre avec une CLI d'agent déjà
installée et connectée sur cette machine — `claude`, `gemini` ou `codex`.
GitHuttBr lance le binaire avec votre requête et lit sa réponse ; aucune clé d'API
à coller, aucun jeton stocké.

GitHuttBr n'exécute qu'une commande que vous avez configurée comme compte, et
toujours avec une liste d'arguments plutôt qu'un shell : rien dans un diff ou un
nom de branche ne peut être interprété comme une commande.

> **Ce n'est pas plus privé qu'une clé d'API.** Vos requêtes atteignent toujours
> le même fournisseur, sous votre propre compte, exactement comme avec une clé.
> Ce qui change, c'est la facturation et la configuration, pas la destination du
> texte.

Si la commande n'est pas dans votre `PATH`, saisissez son chemin complet sur le
compte.

### Modèle par tâche

Sous **Modèle par tâche**, chaque fonction — messages de commit, chat,
expliquer, revue de PR, résolution de conflits, wiki, thèmes — peut viser son
propre compte et son propre modèle. Laissez une ligne sur **Fournisseur utilisé**
pour suivre le fournisseur marqué **Utilisé**. Un modèle économique pour les
messages de commit et un modèle puissant pour le chat est le partage habituel.

### Avis de mise à jour

En venant d'une version antérieure aux comptes, ceci s'affiche une fois. Le fournisseur et la clé que vous aviez deviennent le premier compte ; rien n'est à reconfigurer à la main.

![Avis de mise à jour](../../screenshots/ai-accounts-notice.webp)

## Modèles

Les listes de modèles viennent du fournisseur lui-même et sont mises en cache un
jour ; **Récupérer les modèles** en actualise une immédiatement. Sous la liste,
GitHuttBr indique d'où elle vient : en direct, depuis le cache (avec la date), ou
la liste intégrée de repli et pourquoi.

La liste est filtrée aux modèles capables de répondre à une requête de chat : les
modèles d'embeddings, de parole et d'image en sont exclus. Chaque champ de modèle
accepte aussi du texte libre, si bien qu'un modèle en préversion, un déploiement
privé ou une étiquette Ollama fraîchement téléchargée reste utilisable même si le
fournisseur ne l'annonce pas.

Un fournisseur auquel vous n'avez pas encore donné de clé, ou injoignable, se
rabat sur une petite liste intégrée plutôt que sur une liste déroulante vide.

Aucun fournisseur ne publie de liste classée ou triée sur le volet ; la mise en forme est donc celle de GitHuttBr : les instantanés datés sont repliés sur le modèle dont ils sont un instantané (`gpt-4o` couvre `gpt-4o-2024-08-06`), et le reste est trié du plus récent au plus ancien plutôt qu'alphabétiquement. **Afficher tous les modèles**, en bas de la liste, ramène tout ce que le fournisseur a renvoyé.

## Ce que cela sait faire

| Fonction | Ce que vous obtenez |
|---|---|
| **Message de commit** | Un résumé (et un corps optionnel) à partir de votre diff indexé, dans le style que vous avez choisi |
| **Expliquer ce fichier** | Une explication en langage clair dans un panneau latéral — Normal, Concis, ELI5… et même Pirate |
| **Survoler pour comprendre** | Maintenez <kbd>⇧</kbd> et pointez un identifiant pour une explication d'une ligne, plus les lignes dont elle s'inspire |
| **Résolution de conflit** | Propose une fusion dans la sortie éditable — n'applique jamais automatiquement |
| **Revue de PR** | Résume un diff et signale les risques, chacun ancré à un vrai `path:line` |
| **Description de PR** · **noms de branche** | Rédigés à partir des commits et du diff de la branche |
| **Thèmes** · **palettes de graphe** | Générés à partir d'une consigne |
| **Indexation intelligente** | Des suggestions sur ce qui a sa place dans ce commit |
| **Assistant de configuration IA** | Génère des fichiers de configuration d'assistant (instructions, agents, hooks) pour le dépôt — le bouton baguette dans l'en-tête du panneau de discussion |

## Ancré, pas devinant

La revue voit le diff comme des **sections étiquetées** et ne peut citer que ces
étiquettes ; GitHuttBr résout ensuite chaque étiquette vers un fichier et une ligne
réels. Un modèle qui invente un emplacement est **rejeté et réinterrogé** : les
observations pointent donc toujours vers du code qui existe.

Le survol pour comprendre ne lit qu'une fenêtre numérotée autour du jeton — dans
un diff, uniquement les sections visibles à l'écran — si bien que, lorsqu'une
définition vit ailleurs, il le dit au lieu de l'inventer. Les réponses sont mises
en cache par version de fichier.

**Les fichiers de secrets masqués ne sont jamais envoyés.** Les fichiers couverts
par les règles de masquage des secrets non plus.

## Quand un modèle est lent, ou ne répond plus

Un modèle local sur un portable peut mettre une minute pour un message de
commit, et un modèle qui « réfléchit » avant de répondre met plus longtemps
encore — mais un serveur fermé en pleine requête ne devrait pas vous laisser
fixer une roue qui tourne.

| Ce qui se passe | Ce que vous voyez |
|---|---|
| Aucune réponse après 30 secondes | *« {compte} met plus de temps que prévu à répondre. »*, avec **Continuer à attendre**, **Utiliser {autre compte}** et **Annuler**. Continuer à attendre redemande une minute plus tard si la requête tourne encore |
| Un serveur local (Ollama, LM Studio, llama.cpp…) est fermé pendant qu'il travaille | En quelques secondes : *« {compte} ne répond pas. Est-il toujours en cours d’exécution ? »*, avec un bouton pour chaque autre compte prêt à l'emploi, et **Annuler** |
| Le serveur était déjà fermé au moment de la demande | La même chose, tout de suite |

**Utiliser {autre compte}** annule la requête et envoie la même à ce compte,
avec son modèle par défaut — le message de commit, la revue ou la réponse de la
discussion arrive comme si vous l'aviez demandée là. Vos réglages ne changent
pas : la requête suivante repart vers le compte choisi pour cette tâche.

Cela couvre toutes les fonctions d'IA — messages de commit, discussion, revue,
explication, conflits, thèmes, le wiki — parce qu'elles passent toutes par le
même appel.

## Limites

- **Seuls les serveurs locaux sont surveillés pour savoir s'ils ont été
  fermés.** Un fournisseur cloud en panne échoue avec sa propre erreur ; un
  appel cloud simplement lent reçoit l'invite *plus de temps que prévu* comme
  n'importe quel autre. Un serveur local occupé, mais pas fermé, compte comme
  vivant : seule une connexion refusée ou coupée met fin à l'appel plus tôt.

- Les listes de modèles de repli vieillissent entre deux versions. C'est à cela
  que sert la récupération en direct ; le repli ne couvre que le cas où elle est
  impossible.
- Le filtrage de la liste d'un fournisseur vers les modèles de chat se fait par
  nom : un modèle de chat au nom inhabituel peut être écarté. Saisissez-le
  vous-même.
- Un compte CLI ne peut pas rapporter la consommation de jetons si la CLI ne le
  fait pas ; les chiffres d'usage et de coût dans les paramètres sous-estimeront
  donc ces appels.
- Les réponses via CLI sont plus lentes qu'un appel direct à l'API : le binaire
  démarre une session entière à chaque requête.
- Les clés sont stockées par compte dans le trousseau de votre système.
  Supprimer un compte supprime sa clé.
- Revenir à une version antérieure à l'IA générale perd les clés de l'IA
  générale : cette version ne sait pas où elles sont conservées et les abandonne
  en enregistrant. Les comptes restent ; saisissez à nouveau les clés. L'IA
  propre d'un profil n'est pas touchée.

**Voir aussi :** [Wiki du dépôt](repo-wiki.md) · [Sécurité et secrets](security.md)
