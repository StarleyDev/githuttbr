---
title: Sécurité et secrets
category: Sécurité
order: 70
summary: Le masquage, les garde-fous, le trousseau — et ce que GitHuttBr refuse de faire.
keywords: sécurité security secrets masquage masking trousseau keychain safeStorage jetons tokens branche protégée protected branch gros fichier large file garde-fou guard confidentialité privacy illisible sauvegarde parties traduire chemins autre ordinateur nouvelle machine fusionner profils remplacer profils choisir quoi exporter sauvegarde complète pour l'équipe manifeste mot de passe chiffrement appimage apparmor sandbox signaler un problème images dans les commentaires pixel espion adresse ip images tierces cliquer pour charger images in comments tracking pixel third-party images click to load
source: 26f333bbdafd9ab662dc635c22df7456d66b1362
---

# Sécurité et secrets

GitHuttBr n'a **aucun backend**. Les seuls appels réseau vont vers votre hébergeur
Git et, si vous l'activez, vers votre fournisseur d'IA.

![Les paramètres de sécurité](../../screenshots/settings-security.webp)

## Masquage des secrets

Les valeurs contenues dans `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*`
et consorts s'affichent en `KEY=••••••` dans les vues diff, fichier et blame :
un partage d'écran ou une capture ne peut donc pas les faire fuiter.
Le matériel de signature Apple en fait partie : `*.mobileprovision`,
`*.provisionprofile`, `*.p12` et les clés `*.p8` d'App Store Connect. Pas un
`*.cer` — un certificat est public par nature.

C'est **uniquement de l'affichage** : cela ne modifie jamais le fichier et ne
modifie jamais ce que vous indexez. Une bascule en forme d'œil les révèle vue par
vue. `.env.example`, `.sample` et `.template` sont traités comme des modèles, pas
comme des secrets.

![Un .env rendu avec toutes ses valeurs masquées, et la bascule de révélation](../../screenshots/secret-masking.webp)

## Des garde-fous avant les dégâts

| Garde-fou | Quand |
|---|---|
| **Fichier secret** | Vous validez quelque chose qui ressemble à un identifiant — avec un *Ignorer et ne plus suivre* en un clic |
| **Gros fichier** | Vous validez un blob surdimensionné (seuil dans Paramètres → Sécurité) |
| **Bruit de compilation** | Committer `xcuserdata/`, `DerivedData/` ou un `.DS_Store` — avec le même *Ignorer et ne plus suivre* en un clic |
| **Branche protégée** | Vous validez directement sur `main`/`master`, ou vous en poussez une en force |
| **Secrets suivis** | Vous poussez un dépôt qui *suit* un fichier secret — averti une fois par session |

## Les images dans les commentaires

Les commentaires des pull requests et des issues sont écrits par d’autres personnes,
et une image dans l’un d’eux est une requête que votre machine fait au site choisi par
l’auteur. Ce site apprend votre adresse IP et le moment où vous lisez le commentaire —
un pixel espion ne demande rien de plus que le droit de commenter.

L’application ne charge donc d’elle-même que les images de l’hébergeur lui-même : sur
github.com ses pièces jointes, `*.githubusercontent.com` (qui inclut le proxy que
GitHub place devant chaque image extérieure dans son propre rendu) et ses ressources ;
sur tout autre hébergeur, sa propre adresse web, en https. Toute autre image affiche
un espace réservé qui nomme son domaine, et n’est demandée que lorsque vous cliquez
dessus — cette image-là, une fois. La requête n’envoie jamais de `Referer`.

| Réglage | Ce qu’il fait |
|---|---|
| **Charger les images d’autres sites dans les commentaires** (désactivé par défaut) | Les images de n’importe quel site se chargent sans clic, comme sur le site de l’hébergeur |

Les limites :

- **L’hébergeur vous voit quand même.** Une image de l’hébergeur lui-même — et sur
  GitHub, toute image passant par son proxy — est une requête à l’hébergeur, qui sait
  déjà que ce compte lit la pull request.
- **`raw.githubusercontent.com` et `gist.githubusercontent.com` se chargent sans
  clic.** N’importe qui peut y déposer un fichier, l’image est donc la sienne — mais
  c’est GitHub qui la sert, et son auteur ne voit ni votre adresse IP ni le moment où
  vous lisez.
- **Les pièces jointes privées de GitHub expirent.** Leur adresse signée dure quelques
  minutes ; **Actualiser** sur la page ramène celle qui ne se charge plus.
- **L’aperçu d’une zone de commentaire** sur ces pages suit la même règle : un lien
  collé vers une image extérieure n’est pas chargé pendant que vous écrivez.
- **Seulement les pages de pull request et d’issue.** Les images d’un fichier Markdown
  du dépôt, d’une note de version ou du wiki sont le contenu de votre propre dépôt et
  se chargent comme avant.
- **Un lien n’est pas une image.** Cliquer sur un lien dans un commentaire l’ouvre
  dans votre navigateur, comme tout lien de l’application.

Un commentaire ne peut pas non plus bloquer ou faire planter la fenêtre : un
commentaire de plus de 32 000 caractères, ou conçu pour faire travailler le moteur de
rendu Markdown pendant des secondes, s’affiche en texte brut. La façon dont le reste
d’un commentaire est restreint est décrite dans
[Pull requests](pull-requests.md#comment-les-commentaires-sont-affichés).

## L'AppImage et les chemins qui lui survivent

Une AppImage s'exécute depuis un dossier sous `/tmp` (`/tmp/.mount_…`) qui
n'existe que tant que l'application est ouverte, change de nom à chaque
lancement et se trouve dans un répertoire où tout utilisateur local peut écrire.
Jusqu'à la 4.37.1, l'AppImage pouvait écrire un chemin à l'intérieur de ce
dossier à deux endroits qui lui survivent : le lien `githuttbr` dans le `PATH`
([CLI](cli.md)) et le réglage `diff.<name>.textconv` d'un dépôt
([attributs](attributes.md)). Une fois l'application fermée, un autre
utilisateur de la même machine pouvait recréer le dossier avec un programme à
lui, que votre prochain `githuttbr` ou `git diff` exécuterait.

GitHuttBr refuse désormais les deux sous une AppImage, signale au démarrage un
lien `githuttbr` périmé (avec une commande de la palette pour le supprimer) et
marque un convertisseur périmé dans la boîte de dialogue des attributs avec un
bouton **Supprimer**. Il ne voit que le dépôt que vous avez ouvert ; pour
trouver des convertisseurs périmés ailleurs, lancez
`git config --get-regexp 'diff\..*\.textconv'` dans chaque dépôt (et avec
`--global`) et supprimez toute entrée sous `/tmp/.mount_`. Une machine à un seul
utilisateur n'est pas exposée, mais ces entrées périmées restent du poids mort.

## Le trousseau du système

Les jetons et les entrées du [coffre](vault.md) sont chiffrés avec le trousseau
de votre système (le `safeStorage` d'Electron), jamais avec une clé rangée dans
le fichier de paramètres.

**Rien ne touche au trousseau tant que vous ne l'avez pas dit.** Avant même que
la boîte de dialogue d'autorisation du système ne puisse apparaître, GitHuttBr
explique ce qui va être stocké, ce qu'il ne peut pas faire (une application ne
relit jamais que l'entrée qu'elle a créée — vos autres mots de passe sont
inatteignables), et que dire non ne pose aucun problème : les jetons vivent alors
en mémoire pour la durée de la session seulement, le coffre reste fermé, et vous
pouvez activer tout cela plus tard dans **Paramètres → Sécurité → Trousseau du
système**.

Une installation neuve fait **zéro** appel au trousseau tant que rien n'a
réellement besoin d'être stocké.

**Après la mise à jour vers la 4.59 sur macOS**, le système peut redemander une
fois l'accès à l'élément *GitHuttBr Safe Storage* : le bundle id de l'app est
devenu `com.huttbr.git`, et le trousseau redemande pour une app qu'il ne
reconnaît pas. **Toujours autoriser** conserve les jetons ; voir
[la mise à jour](upgrading.md).

Tant qu’il est désactivé, le champ du jeton dans Intégrations le signale — *Conservé seulement jusqu’à la fermeture de GitHuttBr : le trousseau du système est désactivé.* — avec un bouton **Activer** à côté. L’activer, depuis là ou d’ici, enregistre aussi les jetons déjà saisis pendant la session : inutile de les recoller.

![Le champ du jeton dans Intégrations avec le trousseau désactivé : conservé seulement jusqu’à la fermeture, avec un bouton Activer](../../screenshots/token-keychain-notice.webp)

Un jeton que vous **supprimez** pendant que le trousseau est désactivé disparaît
aussitôt — il n'est plus envoyé avec rien —, mais seulement **pour cette
session** : le stockage chiffré ne peut pas être écrit tant que le trousseau est
désactivé, et l'effacement est gardé en mémoire, jamais dans un fichier.
Réactivez le trousseau avant de quitter et la copie enregistrée est alors
supprimée ; quittez d'abord et l'ancien jeton revient au lancement suivant.
D'ici là, l'avertissement reste affiché pour cette raison. Pour supprimer
définitivement un jeton enregistré en une seule étape, videz-le pendant que le
trousseau est activé.

Un champ vide n'efface que ce que GitHuttBr vous a montré. Avec le trousseau
désactivé dès le départ, les jetons enregistrés ne sont jamais déchiffrés ni
affichés — les champs sont vides —, donc seul un jeton que vous saisissez là
puis videz à nouveau est supprimé ; celui enregistré en dessous est toujours là
une fois le trousseau activé.

Si la fenêtre se recharge ou plante pendant que l'explication du trousseau est
à l'écran, la question compte comme sans réponse — pas comme un non — et elle
est reposée la prochaine fois qu'un jeton doit être stocké. Rien n'attend une
question à laquelle plus personne ne peut répondre : les paramètres se chargent
de nouveau normalement.

### Linux sans trousseau

Sous Linux, le trousseau est un service de secrets — GNOME Keyring ou KWallet.
Quand aucun ne tourne, le système « chiffre » quand même, mais avec un mot de
passe fixe, identique sur toutes les machines : les jetons et les clés sont
brouillés, pas protégés. Paramètres → Sécurité le signale sous l'état du
trousseau — *Aucun trousseau n'est actif…* — pour que le mot *trousseau* ne
désigne jamais une protection qui n'existe pas.

Pour que rien de nouveau n'atterrisse dans un stockage que n'importe qui pourrait
débrouiller, un jeton saisi alors qu'aucun trousseau ne tourne n'est conservé
**que jusqu'à ce que vous quittiez l'application**. Le champ du jeton le dit —
*Conservé seulement jusqu'à la fermeture de GitHuttBr : aucun trousseau n'est
actif…* — sans bouton pour réessayer, car réessayer n'y changerait rien ; seul
un trousseau le peut. Importer un fichier de paramètres contenant des
identifiants le signale de la même façon avant de les importer. Les jetons enregistrés auparavant restent lisibles — vous
n'en perdez jamais l'accès — et effacer ou remplacer l'un d'eux supprime
toujours l'ancienne valeur du disque. Deux limites : la clé de l'IA générale
n'est pas déplacée vers son emplacement partagé (chaque profil continue de lire
la sienne), et le coffre enregistre toujours dans le stockage basique, car il
n'a pas de mode limité à la session. Installez ou déverrouillez un trousseau et
redémarrez GitHuttBr pour enregistrer à nouveau de nouveaux jetons.

GitHuttBr ne se fie pas à ce que le système dit du stockage qu’il a obtenu. Il le
compte comme basique quand le système le nomme ainsi, quand il ne peut pas le nommer
du tout, et quand ce qu’il chiffre revient marqué du mot de passe fixe — quoi qu’ait
dit le système. Ainsi, un trousseau qui se replie en silence garde quand même les
nouveaux jetons hors du disque.

Un trousseau qui ne répond plus n’est pas attendu indéfiniment. Sous Linux, une fois
que le trousseau a répondu une fois pendant la session, une question qu’il laisse sans
réponse 10 secondes compte comme *pas de trousseau* : un jeton enregistré est gardé
jusqu’à la fermeture, et le coffre reste fermé. La première question d’une session —
celle qui peut faire apparaître la propre demande de mot de passe du trousseau — et
celle qui suit juste l’explication de GitHuttBr ont deux minutes, pour que la lecture
d’une boîte de dialogue ne soit jamais écourtée. Pendant une demi-minute après un tel
dépassement, la réponse reste *pas de trousseau* sans redemander ; ensuite GitHuttBr
redemande. macOS et Windows répondent localement et ne sont jamais limités dans le
temps.

La limite ne couvre que cette question-là — *y a-t-il un trousseau ?* Un trousseau qui
y répond puis se bloque en chiffrant ou en déchiffrant est toujours attendu :
l’enregistrement des paramètres, et le coffre, restent occupés jusqu’à ce qu’il réponde
ou que GitHuttBr redémarre.

### Quand les jetons enregistrés ne peuvent pas être lus

Si vous fermez l'invite du trousseau du système, que le trousseau est verrouillé
ou que le stockage des jetons a été écrit par une autre copie de GitHuttBr (une
version de développement, une version re-signée), GitHuttBr **ne peut pas lire
vos jetons enregistrés — et n'y touche pas**. Paramètres → Sécurité indique
*GitHuttBr n'a pas pu lire vos jetons enregistrés*, et un jeton saisi entre-temps
n'est conservé que pour la session (le champ le dit aussi). Il n'est jamais écrit
par-dessus le stockage qu'il n'a pas pu lire : cela remplacerait chaque jeton
enregistré par celui que vous venez de saisir.

| Bouton | Ce qu'il fait |
|--------|--------------|
| **Réessayer** | Relit le stockage — le système peut maintenant demander le trousseau. Dès qu'il est lisible, les jetons saisis entre-temps le rejoignent. |
| **Créer un nouveau coffre à jetons** | Demande d'abord. GitHuttBr cesse d'attendre l'ancien stockage et en commence un nouveau avec les seuls jetons de cette session. L'ancien fichier reste à côté comme sauvegarde pendant 30 jours, puis il est supprimé. Pour un stockage perdu pour de bon, pas pour une invite que vous avez fermée. |

## Importer des paramètres

**Paramètres → Import / Export** transfère paramètres, profils et thèmes d'une
machine à l'autre. L'export par défaut ne contient **aucun jeton ni aucune clé
d'API**, et importer un tel fichier ne touche jamais à ceux que vous avez
enregistrés — un jeton vide dans le fichier signifie « absent de ce fichier »,
pas « supprimer le mien ».

### Choisir ce qu'on exporte

Une sauvegarde et un fichier pour un collègue ne sont pas le même fichier. Une
sauvegarde veut tout ; un fichier pour un autre ordinateur ne devrait pas
contenir de dossiers qui n'y existent pas ; un fichier pour l'équipe ne devrait
contenir ni vos comptes ni vos chemins. **Exporter les paramètres** ouvre donc
une boîte de dialogue avec les mêmes quatre parties que propose l'import (le
tableau plus bas), chacune avec sa taille sur cet ordinateur, et n'écrit que
celles que vous cochez. Une partie laissée de côté n'est pas du tout dans le
fichier — l'importer plus tard laisse cette partie de l'autre machine
exactement comme elle est.

![Paramètres → Données → Exporter : « Autre ordinateur » choisi, la note verte indiquant que le fichier ne contient aucun chemin de cette machine, et le manifeste de ce qui part](../../screenshots/settings-export.webp)

Trois raccourcis au-dessus des parties cochent les combinaisons habituelles.
Modifier une case à la main allume le raccourci qui correspond, ou aucun :

| Raccourci | Parties | Pour |
|----------|-------|-----|
| **Sauvegarde complète** | Les quatre | Restaurer cet ordinateur, ou une copie de celui-ci — le même fichier qu'écrivait Exporter avant d'avoir des parties |
| **Autre ordinateur** | Profils et comptes, Préférences de l'app | Votre identité et vos goûts sur une nouvelle machine, sans les dossiers ni les programmes de celle-ci |
| **Pour l'équipe** | Préférences de l'app | Un thème, des raccourcis et une configuration du graphe partagés — rien de personnel, aucun chemin |

Sous les parties, une note indique si le fichier nomme des dossiers ou des
programmes de cet ordinateur : ambre avec **Dépôts** ou **Programmes** cochés
(l'import sur une autre machine traduit ces chemins ou écarte ceux qu'il ne
trouve pas), verte sans eux. **Profils et comptes** sans **Programmes** écarte
aussi le chemin des CLI d'IA, qui sont stockés avec les profils mais nomment des
binaires de cette machine.

**Les identifiants seulement avec les profils, et seulement si vous le
demandez.** Les jetons et les clés API appartiennent aux profils, donc
**Inclure les clés API, les jetons et les secrets du coffre-fort** n'est
disponible qu'avec **Profils et comptes** coché ; décochez la partie et l'option
est effacée avec elle. Avec les identifiants cochés, la boîte de dialogue
recommande **Protéger par un mot de passe** (plus bas), et les exporter sans
chiffrement demande une confirmation de plus.

Un encadré en bas liste ce que contiendra le fichier avant que vous appuyiez sur
**Exporter…** : combien de profils (avec ou sans identifiants), les images de
profil, les préférences, les chemins des dépôts et des programmes, si les notes
et wikis des dépôts et le coffre en font partie, quelles parties sont écartées,
et si le fichier est chiffré. Ce qui voyage avec quelle partie :

| Extra | Va avec | Condition |
|-------|-----------|-----------|
| Images de profil | Profils et comptes | Images choisies comme image |
| Secrets du coffre | Profils et comptes | Seulement avec l'option des identifiants |
| Notes et wikis des dépôts | Dépôts et espaces de travail | Toujours avec la partie |

Limites : les parties sont l'unité entière — impossible de choisir des profils,
des dépôts ou des préférences isolés. **Programmes** sans **Profils** emporte le
terminal, l'éditeur et les applications par défaut, mais pas les chemins des
CLI d'IA (ils vivent dans les profils). Le manifeste compte des entrées ; il
n'affiche pas les chemins eux-mêmes. Et un fichier sans une partie ne peut pas
la rendre : restaurer un fichier **Pour l'équipe** ne restaure que les
préférences.

### Choisir ce qu'on importe

Un fichier de paramètres contient deux sortes de choses : ce qui *vous* suit
(profils, thème, raccourcis) et ce qui n'a de sens que sur la machine qui l'a
écrit (les dossiers où vivent vos dépôts, le chemin de votre terminal). Tout
appliquer sur un nouvel ordinateur remplit la barre latérale d'onglets qui ne
pointent nulle part. Donc, après avoir choisi le fichier (et saisi son mot de
passe, s'il en a un), une boîte de dialogue demande quelles parties importer.
Rien n'est appliqué avant que vous appuyiez sur **Importer** ; **Annuler**
laisse tout tel quel.

![Paramètres → Données → Importer : quatre parties, les dépôts décochés car aucun de leurs dossiers n'existe ici, et la traduction des chemins ouverte](../../screenshots/settings-import.webp)

| Partie | Ce qu'elle contient |
|------|-----------------|
| **Profils et comptes** | Profils, identité Git, liens d'intégration, les paramètres généraux d'IA et les images de profil — ainsi que les identifiants et le [coffre](vault.md), quand le fichier les contient |
| **Préférences de l'app** | Thème, langue, raccourcis, disposition, les couleurs du graphe et des icônes |
| **Dépôts et espaces de travail** | Onglets, espaces de travail, favoris, surnoms, images d'onglet, le profil utilisé par chaque dépôt, dossiers analysés, ainsi que les notes et wikis de chaque dépôt |
| **Programmes de cet ordinateur** | Terminal, éditeur externe, applications par défaut et le chemin des CLI d'IA |

Chaque partie indique combien d'entrées le fichier contient pour elle. Une
partie laissée décochée reste exactement telle qu'elle est sur cette machine.

**Les profils fusionnent avec les vôtres.** Un fichier venu d'un autre
ordinateur a rarement tous les profils de celui-ci — un compte ajouté sur le
portable Linux, un profil client qui n'existe que sur le Mac. **Profils et
comptes** ajoute donc les profils du fichier aux vôtres au lieu de remplacer la
liste. Avant l'import, la partie liste chaque profil et ce qui lui arrivera :

| Étiquette | Signification |
|-----|---------|
| **Mis à jour** | Le profil existe des deux côtés : l'identité, l'IA et l'image du fichier remplacent les vôtres, et ses serveurs s'ajoutent aux vôtres |
| **Nouveau** | Seul le fichier l'a : ajouté après les vôtres |
| **Conservé** | Seul cet ordinateur l'a : laissé exactement tel quel |

Deux profils sont « le même » quand ils partagent un id — c'est le cas du
premier profil de chaque installation. Quand aucun id ne correspond, c'est le
nom qui compte (sans tenir compte de la casse ni des espaces autour), et le
profil garde **l'id de cet ordinateur** : les dépôts qui lui sont liés, le
profil actif, ses identifiants enregistrés et son image restent rattachés. Le
profil actif ne change pas, et l'**IA générale** non plus : le moteur et le
modèle avec lesquels cet ordinateur répond restent les siens.

**Tout remplacer** est toujours là, pour une sauvegarde que vous voulez
retrouver exactement telle qu'elle était : seuls les profils du fichier
restent, et ceux que seul cet ordinateur possède sont listés barrés comme
**Supprimé**. Appuyer sur **Importer** demande alors une nouvelle fois, en les
nommant — ils partent avec leurs identifiants enregistrés et leur image, et
c'est irréversible. Avec **Tout remplacer**, le profil actif du fichier devient
le profil actif, et l'IA générale du fichier remplace celle de cet ordinateur.

Limites : la correspondance se fait uniquement par id ou par nom exact — un
profil renommé d'un côté compte comme nouveau, et vous vous retrouvez avec les
deux. Un profil apparié prend les champs du fichier, avec trois exceptions pour
que rien de ce que seul cet ordinateur possède ne soit perdu : ses serveurs
GitHub Enterprise, GitLab et Bitbucket sont **ajoutés** aux vôtres (l'entrée du
fichier l'emporte sur un serveur présent des deux côtés) ; un jeton que le
fichier porte vide garde le vôtre — mais seulement pour la même instance, de
sorte qu'un jeton n'est jamais envoyé à un autre Forgejo, à un autre émetteur
GitLab ou à une autre organisation Azure ; et les identifiants empruntés au
gestionnaire d'identifiants de cette machine restent ceux de cette machine.

**Les choix par défaut sont une supposition tirée de votre disque.** Avant
d'afficher la boîte de dialogue, GitHuttBr vérifie si les dossiers de dépôts du
fichier existent ici. Si aucun n'existe, le fichier vient d'un autre
ordinateur : **Dépôts** et **Programmes** démarrent décochés, chacun avec la
raison — les chemins des programmes sont listés, pour que vous voyiez qu'ils
appartiennent à une autre machine. S'ils existent, c'est le même ordinateur (une
sauvegarde restaurée, par exemple), tout démarre coché et une note verte le dit.
Un fichier sans aucun dépôt est jugé sur les chemins de ses programmes :
**Programmes** démarre coché seulement quand chacun d'eux existe ici.

Quand la vérification elle-même échoue, rien n'est deviné : **Dépôts** et
**Programmes** démarrent décochés sans verdict, un bouton **Vérifier à
nouveau** interroge encore le disque, et **Dépôts** ne peut pas être importé
tant qu'une vérification n'a pas réussi. Les autres parties, si.

**Traduire les chemins.** Cochez **Dépôts** sur un fichier dont les dossiers
manquent et un encadré **Traduire les chemins** s'ouvre. À gauche, le dossier
que les dépôts du fichier ont en commun (`/home/you/code`) ; à droite, où se
trouve ce dossier sur cet ordinateur, prérempli à partir de votre dossier
personnel (`/Users/you/code`). Les deux sont modifiables — la supposition peut
être fausse, et quand GitHuttBr ne trouve aucun dossier commun il les laisse vides
pour que vous les saisissiez. Une barre compte, au fil de la saisie, combien de
dépôts ont désormais un dossier ici, avec quelques-uns listés — en vert ceux
trouvés, en rouge ceux qui manquent encore. L'échange emporte avec lui le
surnom, l'image d'onglet et le profil du dépôt, ainsi que ses notes, ses wikis
et ses entrées du coffre, pour qu'il n'y ait rien à reconfigurer à la main.

Le pied de la boîte résume — *Importer 3 parties sur 4 · 31 dossiers* (les
racines d'analyse et le dernier dossier de clonage comptent aussi, d'où
« dossiers » et non « dépôts ») — et **Importer** reste désactivé tant
qu'aucune partie n'est cochée.

**Importer reste aussi désactivé quand une traduction ne trouve rien.** Avec
**Dépôts** coché et pas un seul dossier trouvé sous le nouveau préfixe,
l'import laisserait vos dépôts vides ; corrigez les chemins ou décochez la
partie.

Limites de la traduction :

- C'est **un préfixe échangé contre un autre**. Les dépôts placés sous un autre
  dossier dans le fichier, ou organisés autrement ici, ne sont pas trouvés ; il
  n'y a pas de correspondance dépôt par dépôt.
- Avec une traduction active, **seuls les dépôts qui ont alors un dossier sont
  importés**. Les autres sont laissés de côté — pas ajoutés comme onglets cassés
  — et la boîte de dialogue vous dit combien.
- Les programmes ne sont jamais traduits : `/usr/bin/code` n'a pas
  d'équivalent fiable sur un autre système. Laissez cette partie décochée et
  choisissez-les dans les Paramètres.
- Vider l'un ou l'autre préfixe importe les chemins tels que le fichier les
  contient.

**Pendant l'import**, la boîte de dialogue ne peut pas être fermée. Si une
étape ultérieure échoue — les notes des dépôts, le coffre, les images de profil
— la boîte reste ouverte, nomme l'étape, et **Poursuivre l'import** reprend à
cet endroit sans réécrire les étapes précédentes.

### Identifiants dans le fichier

Un fichier exporté avec l'option cochée contient des identifiants. Fusionner
les profils les **ajoute** toujours : ceux du fichier sont rangés sous le
profil correspondant, en remplaçant ceux du même compte, et tous les autres
identifiants enregistrés restent — les effacer contredirait le fait de garder
vos profils. Avec les profils sur **Tout remplacer**, un tel fichier affiche
aussi le choix, juste sous **Profils et comptes** :

| Choix | Vos identifiants enregistrés |
|--------|------------------------|
| **Ajouter aux miens** | Ceux du fichier sont ajoutés, en remplaçant ceux du même compte ; tous les autres sont conservés |
| **Tout remplacer** | Deviennent exactement ceux du fichier — chaque jeton et clé d'API enregistré que le fichier n'a pas est supprimé |

Le choix s'applique avec les profils : avec **Profils et comptes** décoché,
aucun identifiant n'est importé ni supprimé. Un fichier exporté sans l'option
n'en a aucun à proposer, quoi que vous cochiez. **Tout remplacer** demande une
nouvelle fois quand vous appuyez sur **Importer**, en précisant que chaque jeton
et clé d'API enregistré que le fichier n'a pas sera supprimé ; **Annuler** à ce
moment-là laisse la boîte de dialogue telle quelle.

**Tout remplacer exige le trousseau.** Avec le trousseau désactivé ou
indisponible, les anciens jetons resteraient dans le stockage chiffré et
reviendraient au prochain lancement ; GitHuttBr refuse donc : il le dit, et rien
n'est importé. Même chose tant que les jetons enregistrés ne peuvent pas être
lus (voir plus haut) : ils reviendraient dès qu'ils pourraient l'être. **Ajouter aux miens**
fonctionne toujours, en gardant les jetons du fichier pour la session.

**La limite :** les identifiants appartiennent à un profil. Un profil que
l'import supprime emporte ses jetons enregistrés, quel que soit votre choix.

### Protéger un export par un mot de passe

Un export avec les identifiants cochés vaut les jetons eux-mêmes pour quiconque
trouve le fichier — un dossier synchronisé, une clé USB oubliée, une pièce
jointe. **Protéger par un mot de passe**, dans la boîte de dialogue d'export,
chiffre le fichier avec le même chiffrement que le [partage
sécurisé](secure-share.md) (une clé dérivée par scrypt et AES-256-GCM), si bien
que rien de son contenu — pas même le fait qu'il contienne des identifiants — ne
peut être lu sans le mot de passe.

C'est facultatif, avec ou sans la case des identifiants, et le mot de passe n'a
pas de longueur minimale. Vous le saisissez deux fois et cochez que vous
comprenez qu'il ne peut pas être récupéré ; l'import du fichier le demande —
dans une boîte de dialogue des Paramètres, dans l'étape de bienvenue au premier
lancement — et un mot de passe erroné est redemandé.

![Paramètres → Données → Exporter : un fichier protégé par un mot de passe, l'avertissement d'absence de récupération accepté](../../screenshots/settings-export-password.webp)

| | Sans mot de passe | Avec mot de passe |
|---|---|---|
| **Qui peut le lire** | Quiconque a le fichier | Seulement qui a le mot de passe |
| **Un octet modifié** | Lu tel quel | Refusé, comme un mauvais mot de passe |
| **S'ouvre dans** | N'importe quelle version | Les versions qui connaissent le format chiffré |

**Il n'y a pas de récupération.** Le mot de passe n'est conservé nulle part — ni
dans le fichier, ni sur cette machine — et il n'y a aucun serveur à qui le
demander. Oubliez-le et le fichier est perdu ; exportez de nouveau depuis une
machine qui a encore les paramètres.

Limites : une version plus ancienne ne peut pas ouvrir un export chiffré, et
elle ne le sait pas non plus — elle annonce les paramètres comme importés et ne
change rien. Importez un fichier protégé avec une version qui demande son mot de
passe. Un mot de passe court reste faible face à quelqu'un qui a le fichier et
le temps de deviner ; la clé scrypt rend chaque essai lent, pas impossible. Le
mot de passe protège le fichier, pas l'application en cours d'exécution : les
identifiants sont déchiffrés en mémoire pendant qu'ils sont rassemblés pour
l'export, comme ils l'ont toujours été.

## Le fichier de paramètres

Le fichier de paramètres et le stockage chiffré des jetons sont écrits d'un
bloc : dans un nouveau fichier à côté, lisible par son seul propriétaire, puis
substitué, si bien qu'un plantage ou deux enregistrements simultanés ne laissent
jamais un demi-fichier. Si le fichier de paramètres est un lien symbolique vers
ailleurs (un dépôt de dotfiles), l'écriture va vers la cible du lien et le lien
reste. GitHuttBr ne remplace jamais le lien. Un lien qui pointe vers un fichier
qui n'existe pas encore est écrit à travers, ce qui crée ce fichier — tant que
son dossier existe. Quand le dossier a disparu lui aussi, l'enregistrement
échoue, avec un seul message qui le dit : le lien et ce vers quoi il pointe
restent intacts, et les modifications faites entre-temps ne durent que jusqu'à
la fermeture de GitHuttBr. Restaurez le dossier, ou faites pointer le lien vers un
endroit qui existe, et l'enregistrement suivant passe.

Les jetons en clair qu'une ancienne version a laissés dans le fichier de
paramètres ne sont jamais perdus lors d'un enregistrement : ils restent dans le
fichier jusqu'à ce que GitHuttBr les charge dans le stockage chiffré (ouvrir les
Paramètres le fait), sauf si vous en effacez un vous-même.

Seules deux choses l'écrivent : un enregistrement de vos paramètres, et
GitHuttBr qui les charge (au démarrage, ou à l'ouverture des Paramètres) — c'est
là qu'un ancien jeton en clair passe dans le stockage chiffré, ou que l'adresse
d'un serveur contenant un mot de passe est nettoyée. Une consultation que
personne n'a demandée — un fetch qui résout son jeton, un appel d'IA qui cherche
sa clé, une image de profil — ne fait que lire, et ne peut donc jamais tomber
par-dessus un enregistrement. Un enregistrement est aussi refusé tant que les
paramètres n'ont pas été chargés au moins une fois : avant cela, l'application
ne détient que les valeurs par défaut.

**Le coût sur une ancienne installation** qui a encore des jetons en clair dans
son fichier de paramètres : tant que les Paramètres n'ont pas été ouverts une
fois (ou que l'application n'a pas redémarré et ne les a pas chargés), chaque
consultation qui a besoin d'un jeton déchiffre de nouveau le stockage, et les
images de profil qui ont besoin d'un jeton enregistré attendent. Une
consultation ne déplace rien, donc un jeton que vous effacez entre-temps reste
effacé.

Un fichier qui existe mais ne peut pas être analysé (une modification à la main
qui a mal tourné, un disque endommagé) n'est **jamais** remplacé par les valeurs
par défaut : GitHuttBr indique que le fichier est endommagé et ne va pas plus loin
— aucun raccourci ni commande de menu ne peut enregistrer par-dessus depuis cet
écran.

![L'écran de démarrage pour un fichier de paramètres endommagé, avec Réessayer et Mettre le fichier endommagé de côté et repartir de zéro](../../screenshots/settings-damaged.webp)

Vous pouvez corriger `githuttbr-settings.json` dans son dossier de données et
appuyer sur **Réessayer**, ou appuyer sur **Mettre le fichier endommagé de côté
et repartir de zéro** : le fichier est renommé en
`githuttbr-settings.json.corrupt-<date>` (jamais supprimé, vous pouvez donc
encore en récupérer quelque chose), une copie du stockage chiffré des jetons est
gardée à côté, et GitHuttBr démarre comme au premier lancement, avec une note
indiquant où est passé le fichier. Pour un fichier de paramètres en lien
symbolique, c'est la cible du lien qui est renommée, si bien que la copie
endommagée reste dans vos dotfiles, à côté du nouveau fichier de paramètres que
le premier enregistrement écrit alors à travers le lien. La copie est faite en
premier : si elle ne peut pas être écrite, rien n'est déplacé, et l'écran le dit
et montre le dossier de données à vérifier, car repartir de zéro sans la copie
laisserait le premier jeton enregistré supprimer les jetons des anciens profils.
Corrigez ce qui empêche d'écrire dans le dossier (permissions, disque plein) et
appuyez sur **Réessayer**.

Si le fichier s'abîme pendant que GitHuttBr tourne (modifié à la main en
dessous), les enregistrements s'arrêtent et GitHuttBr le dit une fois : les
paramètres ne peuvent plus être enregistrés jusqu'au redémarrage, et les
modifications faites entre-temps sont perdues.

Un fichier présent mais qu'on ne peut pas *lire* pendant un instant — un autre
programme, comme un antivirus, le tient ouvert — est réessayé pendant environ
deux secondes. S'il échoue encore, ou si le chargement échoue pour une autre
raison, GitHuttBr indique qu'il n'a pas pu démarrer, que le fichier n'a pas été
modifié, et propose **Réessayer** ; il ne dit pas que le fichier est endommagé.

### Limites connues

Elles demandent des conditions inhabituelles, et sont listées pour que personne
n'en soit surpris :

- **Une très ancienne installation avec des jetons encore dans le fichier de
  paramètres.** Si le trousseau est désactivé après le déverrouillage des jetons
  enregistrés, ou refusé alors qu'une clé d'IA est encore stockée dans l'ancien
  format en clair, cette copie en clair peut être perdue au prochain
  enregistrement et le jeton disparaît après un redémarrage. Ouvrez les
  Paramètres une fois avec le trousseau activé après la mise à jour depuis une
  telle version, et les jetons passent pour de bon dans le stockage chiffré.
- **Un enregistrement et un rechargement raté qui se croisent dans la même
  fenêtre.** Un jeton saisi dans un enregistrement qui double un rechargement
  qui échoue ensuite ne peut pas être effacé depuis cette fenêtre tant que les
  Paramètres ne se rechargent pas ; rouvrez les Paramètres et effacez-le.
- **Un fichier de paramètres en lien symbolique dont le dossier manque.** Le
  stockage des jetons est écrit avant que le fichier de paramètres échoue, si
  bien que les deux sont désynchronisés jusqu'au retour du dossier.
  Restaurez-le (montez le disque, clonez les dotfiles) et enregistrez de
  nouveau.

## Le jeton d'un profil pendant que Git s'exécute

Quand un [profil](profiles.md) authentifie un clone, un fetch, un pull ou un
push avec son jeton, le jeton ne va dans aucun des endroits où un autre
programme pourrait le lire : ni dans `.git/config`, ni sur la ligne de commande
(tout utilisateur local peut lire la liste des processus), ni dans
l'**environnement** de la commande git — dont héritent chaque hook, filtre et
processus LFS que git lance, ainsi que chaque paquet npm qu'exécute un script
husky ou lefthook.

À la place, pour chaque opération, GitHuttBr ouvre un point d'accès privé à lui —
un socket dans un dossier où seul votre utilisateur peut entrer (un tube nommé
au nom aléatoire sous Windows) — et enregistre un assistant d'identification
pour ce seul serveur. Quand git demande un identifiant, l'assistant se connecte,
prouve qu'il appartient à cette opération avec un code aléatoire créé pour elle
seule, indique sur quel hôte et quel dépôt git l'interroge, et reçoit
l'identifiant. Le point d'accès répond à chaque demande de l'opération — git
peut demander plusieurs fois, pour LFS, après une redirection, pour chaque
processus qu'il lance — et il est fermé et supprimé quand git se termine. Un
hook qui affiche son environnement trouve le code, pas le jeton.

Ce qu'il ne peut toujours pas faire :

- **Un hook peut encore demander, pendant que l'opération tourne.** Ce code est
  dans l'environnement de git, parce que l'assistant est un programme que git
  lance et que git donne à chaque programme qu'il lance le même environnement.
  Un hook écrit pour parler le protocole de l'assistant peut utiliser le code
  pour demander l'identifiant jusqu'à ce que git se termine — c'est exactement
  ainsi que le hook `pre-push` de git-lfs en obtient un. C'est une ouverture bien
  plus petite qu'un jeton posé dans une variable — rien ne le lit par accident,
  un dump ou un rapport de plantage ne montre qu'un code inutile une fois git
  terminé —, mais c'est une ouverture.
- **Il ne répond que pour le serveur pour lequel il a été ouvert.** Le point
  d'accès refuse tout autre hôte, une requête `http` en clair, un chemin hors de
  la base du serveur, et un serveur imbriqué sous celle-ci (un Data Center sur
  `/bitbucket` à côté d'un GitLab à la racine) — même avec le bon code. Un push
  vers plusieurs URL reçoit un point d'accès par serveur, chacun ne détenant que
  l'identifiant de ce serveur. Sous un serveur qui en contient un autre, un
  chemin que le proxy du serveur imbriqué pourrait router vers lui-même est
  refusé aussi : tout `;` dedans (Tomcat ignore les `;params`), un segment qui se
  termine par un point, et le nom de la base imbriquée avec une autre casse ou
  comme préfixe (`/Bitbucket/`, `/bitbucketx/`) — si bien qu'un groupe du serveur
  extérieur dont le nom commence par le chemin du serveur imbriqué n'obtient pas
  son jeton non plus.
- **Une exclusion ne survit pas à une redirection côté serveur.** La
  vérification porte sur le chemin que git demande. Si le serveur extérieur
  redirige lui-même une requête vers le chemin du serveur imbriqué, ou si un
  proxy la réécrit là après que git a envoyé son identifiant, aucun client ne
  peut le voir.
- **Un identifiant hérité via `git -c` est mis de côté.** Un assistant
  d'identification (ou un `include` qui pourrait en ajouter un) transmis dans
  `GIT_CONFIG_PARAMETERS` — l'application lancée depuis un alias git, ou par un
  autre git — est retiré pour l'opération : on ne lui propose jamais le jeton du
  profil à stocker, et on ne l'interroge pas au nom de personne. Toutes les autres
  options `-c` héritées sont conservées.
- **L'adresse d'un serveur doit être écrite comme git la lit.** GitHuttBr nomme le
  serveur selon les règles d'URL standard, git selon les siennes : un nom
  internationalisé (`bücher.example`), une forme numérique abrégée (`127.1`,
  `0x7f.0.0.1`), une adresse IPv6 compressée ou mappée, ou un caractère encodé
  dans l'hôte désignent un serveur différent pour chacun. Avec un profil en jeu,
  une telle adresse est refusée avec un message au lieu d'être laissée à
  l'identification propre de la machine. La casse et un port par défaut
  explicite (`:443`) ne posent pas de problème.
- **Git antérieur à 2.26** ne faisait correspondre une entrée d'identifiants
  qu'à l'adresse exacte, pas à tout ce qui se trouve sous la base d'un serveur.
  En interrogeant au nom de personne, l'application désactive alors les
  assistants pour tout l'hôte le temps de cette seule commande ; se connecter
  avec un jeton exige de toute façon git 2.31.
- **N'exécutez pas de hooks auxquels vous ne faites pas confiance**, même avec
  un profil connecté. Un dépôt que vous venez de cloner peut livrer des hooks via
  des outils comme husky, qui les installent lors de `npm install` ; git exécute
  ce qui se trouve dans `.git/hooks`, depuis GitHuttBr comme depuis un terminal, et
  un hook peut faire bien pire que lire un jeton.
- **Réduisez la portée du jeton.** Un jeton qui ne peut écrire que dans les
  dépôts sur lesquels vous travaillez vaut bien moins pour quiconque s'en empare.
- **Les remotes SSH ne sont pas concernés** — aucun jeton n'intervient ; c'est
  l'[agent SSH](ssh-keys.md) qui répond.

## Partager sans risque

Le [partage sécurisé](secure-share.md) exporte les paramètres, les entrées du
coffre ou des espaces de travail entiers sous forme de **bundle chiffré** — les
secrets ne sont inclus que si vous cochez la case.

## Signaler un problème

**Signaler un problème** sur une erreur ouvre une issue GitHub pré-remplie — et
l'ouvrir envoie déjà le texte à GitHub, avant que vous choisissiez de la
publier. Le message est donc nettoyé d'abord : un identifiant écrit dans une
URL, les jetons, votre dossier personnel (et avec lui votre nom d'utilisateur),
les serveurs privés et les chemins de dépôts, le nom du profil auquel un dépôt
est lié, les adresses e-mail et IP sont remplacés. Les hôtes publics comme
`github.com` restent, de même que les noms de fichiers et le message de git
lui-même.

**La limite :** un nom de serveur isolé dans une phrase est reconnu à sa forme
— avec des points, en minuscules. Un hôte d'un seul mot (`gitserver`) n'est
détecté que dans les messages écrits par GitHuttBr lui-même, et un serveur sous un
domaine de premier niveau qui s'écrit comme une extension de fichier (`.sh`,
`.md`) est gardé comme nom de fichier. Relisez l'issue avant de la publier
malgré tout : le nettoyage reconnaît des formes connues, pas tout ce qui est
privé.

## Ce qui reste sur le disque

Le fichier de paramètres, le journal des opérations, le cache des avatars et le
stockage chiffré des jetons ne sont lisibles que par votre compte (sous macOS et
Linux). L'adresse d'un serveur enregistrée avec un `user:password@` ou un
`?token=` — depuis un import ou une ancienne version — perd cette partie
lorsqu'elle est lue, importée ou enregistrée. Le cache des avatars de commits ne
stocke aucune adresse e-mail, seulement des hachages salés propres à chaque
installation.

Chacun de ces fichiers est écrit d'un bloc : dans un nouveau fichier à côté,
puis substitué, si bien qu'un plantage ou deux enregistrements simultanés ne
laissent jamais un demi-fichier — que GitHuttBr devrait sinon traiter comme
illisible. Une sauvegarde du stockage des jetons n'est supprimée plus tôt que
lorsque chaque jeton qu'elle contient est aussi dans le stockage actuel ; toute
autre sauvegarde est gardée 30 jours.

## Paquets Linux : le sandbox et AppArmor

Le sandbox de Chromium a besoin des espaces de noms utilisateur non privilégiés.
Ubuntu 24.04 et suivants les refusent à tout programme sans profil AppArmor qui
les autorise, et les deux paquets Linux gèrent cela différemment :

| Paquet | Ce qui se passe |
|---------|--------------|
| `.deb` | Installe `/etc/apparmor.d/githuttbr`, un profil pour `/opt/GitHuttBr/githuttbr` qui autorise les espaces de noms utilisateur. L'application tourne dans le sandbox. |
| AppImage | N'a pas de profil. Son lanceur essaie `unshare -Ur true`, et en cas d'échec démarre l'application avec `--no-sandbox` — sous Ubuntu 24.04+, c'est à chaque lancement. GitHuttBr écrit un avertissement dans sa sortie console quand cela arrive. |

Pour exécuter l'AppImage dans le sandbox, installez plutôt le `.deb`, ou donnez
à l'AppImage son propre profil AppArmor qui autorise `userns` (ou, pour toute la
machine, `sysctl kernel.apparmor_restrict_unprivileged_userns=0`, qui désactive
la restriction pour tout).

**La limite du profil du `.deb`.** Il est `flags=(unconfined)` avec `userns`
autorisé, et il s'attache au chemin de l'exécutable. Le même exécutable tourne
aussi comme simple Node lorsqu'il est lancé avec `ELECTRON_RUN_AS_NODE=1` —
c'est ainsi que fonctionnent la commande `githuttbr`, le convertisseur de diff
fourni et l'assistant d'identification de GitHuttBr, si bien que cet interrupteur
ne peut pas être désactivé sans les casser. Ensemble, cela signifie que
n'importe quel programme local peut utiliser l'exécutable de GitHuttBr comme un
interpréteur Node autorisé à créer des espaces de noms utilisateur — le même
genre de brèche que les contournements connus de la restriction d'Ubuntu via
d'autres programmes dotés d'un profil. Cela ne donne à personne plus que les
droits de son propre compte ; cela affaiblit une couche de durcissement du noyau
qu'Ubuntu ajoute par-dessus. AppArmor ne sait pas distinguer les deux modes d'un
même exécutable, donc un profil plus étroit n'est pas possible tant que la CLI le
partage ; un binaire auxiliaire séparé pour la CLI est sur la feuille de route.
Les administrateurs qui préfèrent s'en passer peuvent ajouter une règle de refus
dans `/etc/apparmor.d/local/githuttbr`, au prix du sandbox.

**Voir aussi :** [Coffre](vault.md) · [Partage sécurisé](secure-share.md)
