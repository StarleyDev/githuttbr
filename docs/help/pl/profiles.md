---
title: Profile
category: Dostosuj do siebie
order: 101
summary: Osobne tożsamości i tokeny do pracy i do całej reszty.
keywords: profil profile tożsamość git użytkownik e-mail tokeny konta przełączanie identity user email accounts switch
---

# Profile

Profil wiąże **tożsamość Gita** (imię i adres e-mail) z jej **tokenami
integracji**. Przełącz profil, a zmieniają się oba naraz — commity są
podpisywane właściwym autorem, a wywołania API korzystają z właściwego konta.

Przydatne, gdy ta sama maszyna obsługuje repozytoria służbowe i prywatne albo
gdy masz dwa konta GitHub.

![Profil: tożsamość gita z jednej strony, jej tokeny integracji z drugiej](../../screenshots/settings-profiles.webp)

## Edytowanie profilu, używanie profilu

Ustawienia dzielą swoje strony na dwie części. **Ten profil** zawiera strony,
które zmieniają się razem z profilem — **Profil** i **Integracje**. **Aplikacja**
zawiera całą resztę, która działa w każdym profilu i mówi o tym na górze strony.

Obie strony profilu otwierają się paskiem: *Edytujesz profil* i wybierakiem.
Wybierak decyduje, który profil **edytujesz**; nie zmienia tego, którego aplikacja
**używa**. Gdy się różnią, mówi o tym bursztynowy pasek — *Edytujesz profil
Praca. Aplikacja używa profilu Prywatny* — z przyciskiem **Użyj tego profilu**,
żeby się przełączyć. To moment, w którym najłatwiej połączyć konto z niewłaściwym
profilem, dlatego strona Integracje nazywa profil także na każdej karcie i na
samym przycisku: **Połącz z profilem Praca**, a potwierdzenie to powtarza. Nowy
i usuwanie są na tym samym pasku; usunięcie najpierw pyta.

![Edytowanie profilu Praca, gdy aplikacja używa innego: bursztynowy pasek i przycisk łączenia, który nazywa Praca](../../screenshots/settings-profile-band.webp)

## AI jest wspólna

Profil nie potrzebuje własnej AI: jedna [ogólna
AI](ai.md#jedna-ai-dla-wszystkich-profili) obsługuje każdy profil, a profil
wybiera własną tylko wtedy, gdy musi. Ten wybór obejmuje wszystko: profil na
ogólnej AI pisze też tak, jak ustawiono ogólną AI — styl commitów, dodatkowe
zasady dla commitów, czat repozytorium. Profil, który potrzebuje innego stylu, dostaje
własną AI, kopię ogólnej, którą może potem zmienić. Wszystko to edytuje się na
stronie **AI**; strona Profil mówi tylko, której AI profil używa, i prowadzi
tam.

## Każdy profil ze swoimi kontami

Oprócz tokenu profil może **powiązać** logowanie, które już jest na komputerze —
z credential helpera gita albo z GitHub CLI — w Ustawienia → Integracje.
Powiązanie należy do jednego profilu: nowy profil zaczyna niepołączony, a konto,
które ma już inny profil, zostaje odrzucone, więc dwa profile mogą mieć obok
siebie dwa konta GitHub (lub Azure DevOps). Zobacz [Hosting](hosting.md).

## Powiązanie z repozytorium

Repozytorium da się **przypiąć do profilu**, dzięki czemu fetch w tle zawsze
uwierzytelnia się na właściwym koncie — nawet gdy właśnie patrzysz na
repozytorium należące do tego drugiego.

Tokeny mieszkają w twoim [pęku kluczy systemu](security.md), nigdy w pliku
ustawień.

**Zobacz też:** [Bezpieczeństwo i sekrety](security.md) · [Hosting](hosting.md)
