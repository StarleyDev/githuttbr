---
title: Premier lancement
category: Pour commencer
order: 2
summary: L’assistant du premier lancement — identité Git, comptes d’hébergement, IA, apparence — et ce que chaque étape enregistre.
keywords: onboarding premier lancement première utilisation assistant configuration bienvenue importer paramètres identité git comptes ia abonnement clé api ollama lm studio claude code codex passer first run
source: e8fa4f58f0acd79a07a40066c813a2ab49312255
---

# Premier lancement

Au premier lancement de GitHuttBr, un court assistant demande le peu qui change son comportement dès le premier commit : qui vous êtes dans Git, où sont hébergés vos dépôts, si vous voulez l’IA, et quelle apparence. Chaque étape peut rester vide, et tout ce qu’il règle se modifie plus tard dans les **Paramètres**.

![L’étape IA : un CLI d’abonnement trouvé sur cet ordinateur et testé](../../screenshots/onboarding-ai.webp)

## L’écran d’accueil

Avant les étapes, l’écran d’accueil propose d’**importer un fichier de paramètres** depuis un autre ordinateur. Les clés et jetons d’un fichier en sont retirés sauf si vous cochez la case pour les garder, et un export protégé par mot de passe le demande sur place. L’import applique le fichier et ferme l’assistant — voir [Sécurité et secrets](security.md) pour ce que contient un export.

## Les étapes

La colonne de gauche liste les étapes. Une coche verte marque une étape remplie, un tiret une étape passée sans la remplir, et la ligne en surbrillance est celle où vous êtes.

| Étape | Ce qu’elle règle | Où la modifier ensuite |
|---|---|---|
| Identité Git | Le nom du profil, et le nom et l’email de vos commits | Paramètres → Profil et identité |
| Comptes | Jetons GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo et serveurs auto-hébergés, et l’application de **Ouvrir avec…** | Paramètres → Comptes connectés ; l’application dans Paramètres → Git et synchronisation |
| Intelligence artificielle | Un compte IA, mis en service | Paramètres → IA |
| Apparence | Thème et mode clair, sombre ou automatique | Paramètres → Thèmes |
| Terminé | Rien de nouveau — un résumé de ce qui a été réglé | — |

**Passer pour l’instant** ferme l’assistant à n’importe quelle étape et garde ce que vous avez saisi.

## L’étape IA

L’IA est facultative. Choisissez une des trois cartes, ou **Passer, sans IA**, qui désactive l’IA
jusqu’à ce que vous la configuriez dans [Paramètres → IA](ai.md) :

| Carte | Ce qu’elle utilise | Ce qu’il faut |
|---|---|---|
| Mon abonnement | Claude Code ou Codex, connecté avec votre forfait | Le CLI installé et connecté |
| Clé d’API | OpenAI, Anthropic, Gemini, Groq, OpenRouter ou Mistral | Une clé du fournisseur |
| Sur mon ordinateur | Ollama ou LM Studio, en local — rien ne quitte la machine | Le serveur démarré |

Quand Claude Code ou Codex est trouvé sur cet ordinateur, la carte d’abonnement dit lequel et sa version, et la choisir le teste : un prompt court, puis **Testé : réponse en N s. Prêt à l’emploi.** Si aucun n’est trouvé, ou si le CLI n’est pas connecté, la carte affiche la même configuration de connexion que [Paramètres → IA](ai.md).

Pour une clé d’API ou un serveur local, **Continuer** teste la connexion en listant les modèles du fournisseur et n’enregistre qu’un compte qui a répondu.

L’étape enregistre un compte IA ordinaire, écrit comme les Paramètres l’écrivent et marqué **Utilisé** : ouvrez Paramètres → IA, il y est, prêt à être renommé, réservé à certaines fonctions ou supprimé. Plusieurs comptes, un modèle par fonction et la façon d’écrire de l’IA se règlent là, pas dans l’assistant.

## Limites

- **Le test d’abonnement coûte un prompt.** Il est décompté de votre forfait, comme toute requête. Il ne s’exécute que si vous choisissez la carte ou cliquez **Tester à nouveau**.
- **Seuls Claude Code et Codex sont détectés.** Gemini CLI et Devin répondent comme comptes CLI ordinaires, à ajouter dans Paramètres → IA.
- **Un serveur local doit déjà tourner.** L’assistant ne démarre ni Ollama ni LM Studio, et ne télécharge pas de modèles.
- **L’assistant ne s’exécute qu’une fois.** Une fois fermé, tout ce qu’il a réglé vit dans les Paramètres ; on ne peut pas le rouvrir.
