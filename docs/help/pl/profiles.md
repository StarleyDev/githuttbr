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

Dwie strony Ustawień zmieniają się wraz z profilem — **Profil i tożsamość** i **Połączone konta**, na górze grupy **Ty**, której nagłówek podaje edytowany profil. Wszystkie pozostałe strony obowiązują w każdym profilu i mówią o tym na górze.

**Profil i tożsamość** otwiera karta profilu: obraz, nazwa (edytowana w miejscu), *w użyciu*, gdy aplikacja go używa, wybór profilu i **Nowy profil**. **Połączone konta** otwiera ten sam wybór w pasku, *Edytujesz profil*. Wybór decyduje, który profil **edytujesz**; nie zmienia tego, którego aplikacja **używa**. Gdy się różnią, mówi o tym bursztynowy pas z przyciskiem **Użyj tego profilu**. To moment, w którym najłatwiej połączyć konto z niewłaściwym profilem, więc Połączone konta podaje profil także na każdej karcie i na samym przycisku, a potwierdzenie to powtarza. Usuwanie profilu jest w tym samym miejscu i najpierw pyta.

Pod kartą są tożsamość git i podpisywanie commitów. Gdy otwarte repozytorium commituje jako ktoś inny — jego konfiguracja git podaje innego autora —, mówi o tym wiersz z przyciskiem **Zastosuj tożsamość w bieżącym repozytorium**; gdy się zgadzają, nie ma czego stosować i wiersza nie ma. Dalej są obraz profilu, podsumowanie jego **połączonych kont** — jeden wiersz na host ze stanem *Połączone*, *Token wygasł lub błąd*, *Brak połączenia* lub *Niepołączone* oraz **Połącz** lub **Odnów**, które otwierają Połączone konta na tym hoście — i to, której AI używa profil.

Podsumowanie sprawdza po cichu, bez okna logowania, przy każdym otwarciu strony i każdej zmianie tokenu; nigdy nie odpytuje cyklicznie. To, co znajdzie, wykorzystuje też menu boczne: **Połączone konta** pokazuje małą liczbę ostrzeżeń, gdy token został odrzucony lub zawiódł, i tylko dla sprawdzeń, które Ustawienia już wykonały. Nieosiągalny host się nie liczy — token może być w porządku.

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
z credential helpera gita albo z GitHub CLI — w Ustawienia → Połączone konta.
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
