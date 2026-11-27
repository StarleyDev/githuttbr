---
title: Centrum dowodzenia
category: Synchronizacja i wiele repozytoriów
order: 51
summary: Każde repozytorium przestrzeni roboczej na jednym ekranie, od najgorszego.
keywords: centrum dowodzenia panel wszystkie repozytoria przegląd status brudne niewypchnięte w tyle mission control dashboard overview dirty unpushed behind workspace ostatni commit ostatni fetch nieaktualne stale pull requesty pull requests ci wydanie release tag interwał odświeżania refresh interval
---

# Centrum dowodzenia

Dwadzieścia repozytoriów i pytanie zawsze to samo: które mnie potrzebuje?

Centrum dowodzenia na nie odpowiada. Każde repozytorium **aktywnej przestrzeni
roboczej** na jednym ekranie, uszeregowane według tego, co naprawdę cię
potrzebuje:

1. **Zablokowane** — rebase albo merge zostawiony w połowie, konflikty,
   repozytorium, którego w ogóle nie da się odczytać.
2. **Do zsynchronizowania** — najpierw commity do pulla, potem commity do
   pusha.
3. **W toku** — niezacommitowana praca, pliki nieśledzone.
4. **Czyste** — te ciche, na dole, gdzie ich miejsce.

![Każde repozytorium na jednym ekranie, od najgorszego](../../screenshots/mission-control.webp)

## Co mówi ci wiersz

Każdy wiersz czyta się od lewej do prawej, a kolumny są wyrównane w całej liście,
więc liczniki porównuje się jak w tabeli:

| Kolumna | Co pokazuje |
|---|---|
| **Repozytorium** | Nazwa, grupa, gałąź i jej upstream — albo **brak upstreamu** na bursztynowo: taka gałąź nigdy nie zostanie wypchnięta przez pomyłkę, ale też nigdy się nie synchronizuje |
| **Ostatni commit** | Temat i autor: czym repozytorium ostatnio się zajmowało, bez otwierania go |
| **Lokalnie** | Konflikty · ↓ do pobrania · ↑ do wypchnięcia · w stage · zmienione · nieśledzone · stashe. Najedź, by zobaczyć, co liczy każdy |
| **Hosting** | Otwarte pull requesty — te czekające na **Twoją** recenzję na bursztynowo — i CI dla HEAD. Kliknij licznik, by otworzyć stronę **Pull requesty** tego repozytorium, albo **CI**, by otworzyć jego uruchomienia |
| **Wydanie** | Najnowszy tag osiągalny z HEAD i ile commitów przyszło po nim — **aktualne**, gdy żaden. Licznik ma kolor zależny od tego, jak daleko w tyle jest wydanie: szary do 5 commitów, żółty do 20, czerwony powyżej, w czterech zakresach, które możesz zmienić — łącznie z własnymi kolorami — w [**Ustawienia → Motywy → Kolory notatki o wydaniu**](themes.md#kolory-notatki-o-wydaniu) |
| **Aktywność** | Sparkline commitów z 14 dni i ich liczba |
| **Czas** | Ile czasu minęło od ostatniego commita i od ostatniego **fetcha** |

Najedź na ikonę stanu, by zobaczyć, dlaczego wiersz jest w tym miejscu —
„2 do wypchnięcia · 1 bez commita”.

Wiek fetcha jest tu, bo czytanie tej strony nigdy nie robi fetcha: licznik „do
pobrania” jest tak świeży jak ostatni fetch. Gdy gałąź z upstreamem nie robiła
fetcha od dnia lub dłużej, albo nigdy, wiek robi się bursztynowy — zrób fetch,
zanim uwierzysz w 0. Czas odczytuje sam git, więc `git fetch` w terminalu też się
liczy.

![Ustawienia → Git i synchronizacja: odświeżanie Mission Control obok automatycznego fetcha](../../screenshots/settings-git-sync.webp)

W wąskim oknie zostają wszystkie kolumny, a tabela przewija się w bok wewnątrz
swojej ramki.

**Otwórz** na końcu wiersza pokazuje samo repozytorium — jego graf — nawet jeśli
jego karta ostatnio pokazywała listę pull requestów otwartą licznikiem PR.

Rozwiń wiersz (strzałką albo <kbd>spacją</kbd>), żeby zobaczyć dokładnie, które
commity czekają na pusha i które pliki są brudne.

## Praca z listą

- Pigułki statusu na górze są **filtrami** — kliknij „3 zablokowane", żeby
  zobaczyć tylko je. **N otwartych PR** i **N CI z błędem** filtrują tak samo,
  podobnie jak **PR czekające na Twoją recenzję: N** w wierszu poniżej.
- Sortuj po **pilności**, **nazwie** albo **aktywności**.
- **Zaznacz kilka repozytoriów**, żeby zrobić na nich fetch, albo pull tylko na
  tych, które są w tyle (przycisk sam je zliczy).
- **Fetch N nieaktualnych** pojawia się, gdy gałęzie z upstreamem nie robiły fetcha od
  dnia lub dłużej, i robi fetch tylko w nich — tych, w których „do pobrania” może być błędne.
- Odświeża się samo co 30 sekund, dopóki jest otwarte — zmienisz to w
  **Ustawienia → Git i synchronizacja → Odświeżanie Mission Control**, co najmniej
  30 sekund. Gdy strona jest zamknięta, nic nie działa.

| Klawisz | Akcja |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> albo <kbd>j</kbd> <kbd>k</kbd> | Chodzenie po liście |
| <kbd>Enter</kbd> | Otwórz to repozytorium |
| <kbd>f</kbd> / <kbd>p</kbd> | Fetch / pull na nim |
| <kbd>space</kbd> | Rozwiń je |
| <kbd>/</kbd> | Skocz do filtra |

## To widok, nie karta

Wskaźnik obok nazwy przestrzeni roboczej go przełącza; kliknięcie dowolnej karty
odsyła cię z powrotem do pracy. Nigdy nie dokłada własnej karty i należy do
przestrzeni, w której jesteś — przełącz przestrzeń, a dostaniesz panel tamtej
przestrzeni.

Strona gita jest **lokalna**: kilka poleceń gita na repozytorium, bez fetcha.
Kolumna **Hosting** to jedyna część, która rozmawia z hostem. Pyta host każdego
repozytorium o jego otwarte pull requesty i CI dla HEAD, jako profil tego
repozytorium, i po cichu: host bez tokena lub połączenia dla tego profilu po
prostu nic nie pokazuje, a okno logowania nigdy się nie otwiera. Repozytorium
otwarte już w karcie nie kosztuje żadnego wywołania, bo panel boczny ma już jego
pull requesty.

Ograniczenia, żeby dobrze czytać liczby:

- Hosty są pytane **najwyżej co 5 minut** dla każdego repozytorium (wcześniej, gdy
  HEAD się przesunie albo uruchomienie CI wciąż trwa), niezależnie od interwału
  odświeżania — limit API hosta jest dzielony z resztą aplikacji. **Odśwież**
  pyta ponownie od razu.
- Licznik pokazuje **30+**, gdy pierwsza strona od hosta wróciła pełna; strona
  listy ma je wszystkie.
- Kolumna wydania to najnowszy tag **osiągalny z HEAD**, nie najnowszy tag w
  repozytorium. Tag utworzony na commicie, który HEAD już ma, pojawia się w ciągu
  dwóch minut.

Fetch zawsze jest czymś, o co poprosiłeś.

**Zobacz też:** [Przestrzenie i karty](workspaces.md) · [Przestrzenie, karty i grupy](workspaces.md)
