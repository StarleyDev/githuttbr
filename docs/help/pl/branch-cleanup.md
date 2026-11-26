---
title: Sprzątanie gałęzi
category: Gałęzie i operacje na historii
order: 47
summary: Usuń lokalne gałęzie, których praca jest już gdzie indziej — zniknięte upstreamy, scalone gałęzie — w jednym kroku, który da się cofnąć.
keywords: sprzątanie porządki prune usuń skasuj lokalne gałęzie zniknięta scalona squash nieaktywna martwe stare pull request porządek lista gałęzi clean up cleanup delete remove gone merged stale tidy branch list
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Sprzątanie gałęzi

Każdy pull request, który wyciągasz, zostawia po sobie lokalną gałąź. PR zostaje
scalony, serwer usuwa jego gałąź, a lokalna zostaje — na zawsze. Po kilkuset
recenzjach lista gałęzi to głównie martwe gałęzie, a znalezienie żywych wymaga
przewinięcia ich wszystkich.

Sprzątanie gałęzi wymienia lokalne gałęzie, których praca jest już bezpieczna gdzie
indziej, zaznacza te, przy których nic się nie traci, i usuwa je w jednym kroku,
który możesz cofnąć. „Gdzie indziej” oznacza gałęzie śledzące zdalne repozytorium
według ostatniego fetcha oraz gałąź domyślną.

![Okno sprzątania: zniknięte, scalone i scalone przez squash gałęzie zaznaczone, praca istniejąca tylko tutaj odłożona na bok](../../screenshots/branch-cleanup.webp)

## Jak to działa

1. Narzędzia → **Posprzątaj lokalne gałęzie…** (albo <kbd>⌘K</kbd>).
2. Najpierw naciśnij **Fetch i prune**, jeśli ostatni fetch jest stary. Dopóki nie
   przejdzie fetch z prune, gałąź usunięta przez serwer wygląda tu na żywą.
3. Jeśli twój zespół scala pull requesty przez squash, naciśnij **Sprawdź scalenia
   squash** (zob. niżej).
4. Sprawdź zaznaczenia, potem **Usuń**. Jedno potwierdzenie mówi, ile gałęzi znika,
   i wymienia każdą, która ma commity niespotykane nigdzie indziej.

Usuwanie to jedna operacja z jednym wpisem cofania: **Cofnij** odtwarza każdą
usuniętą gałąź dokładnie na commicie, na który wskazywała, z przywróconym upstreamem
(`branch.<name>.remote` i `.merge`). Jeśli od tego czasu pojawiła się gałąź o tej
samej nazwie na innym commicie — ten sam PR wyciągnięty ponownie —, cofanie zostawia
ją w spokoju i przywraca usuniętą obok, jako `<name>-restored-<short sha>`, i to
mówi.

Komunikat o sukcesie i wpis cofania wymieniają każdą gałąź z commitem, na który
wskazywała (`feature/x (was abc1234)`), tak jak wypisuje to `git branch -D`: historia
cofania żyje tylko tak długo, jak otwarta jest aplikacja, a ta linijka wystarcza, by
odtworzyć gałąź ręcznie.

## Dlaczego gałąź jest na liście

| Etykieta | Znaczy |
|---|---|
| **Zniknęła** | Gałąź śledzi upstream, który serwer usunął — zwykły ślad scalonego pull requesta. |
| **Scalona** | Każdy jej commit jest już w gałęzi domyślnej. Podpowiedź wskazuje kopię, która go zawiera — `main (local, not pushed)`, gdy ma go tylko twoja lokalna. |
| **Squash** | Znaleziona przez **Sprawdź scalenia squash**: jej zawartość jest w gałęzi domyślnej, jej pojedyncze commity nie. |
| **Nieaktywna** | Bez commita przez wybraną liczbę miesięcy (domyślnie 3). Wymieniana tylko, gdy zaznaczysz **Pokaż też nieaktywne gałęzie**. |
| **Commity istniejące tylko tutaj: N** | Commity, których nie ma na żadnej gałęzi śledzącej zdalne repozytorium ani w gałęzi domyślnej. Usunięcie gałęzi je usuwa. |
| **Jeszcze bez commitów** | Wskazuje dokładnie na czubek gałęzi domyślnej — pewnie utworzona i nigdy nieużyta. |

„Scalona” mierzy się względem zdalnej kopii gałęzi domyślnej (`origin/main`) oraz
względem twojej lokalnej — lokalny `main`, którego nikt nie pullował od miesiąca, nie
ukryje scaleń zrobionych od tego czasu.

## Scalenia squash

Scalenie squash kładzie zmiany pull requesta na `main` jako jeden nowy commit;
własne commity gałęzi nigdy tam nie trafiają. Dla gita taka gałąź wygląda jak
porzucona praca: **Zniknęła**, z *Commity istniejące tylko tutaj: N*.

Gdy na liście są zniknięte gałęzie z własnymi commitami, **Sprawdź scalenia squash**
zadaje inne pytanie: czy scalenie tej gałęzi do `main` cokolwiek by zmieniło?
Uruchamia jeden `git merge-tree` w pamięci dla wszystkich — bez checkoutu, bez
indeksu —, a gałąź, której scalenie zostawia drzewo `main` dokładnie takim, jakie
jest, dostaje etykietę **Squash** i jest zaznaczana jak scalona. Potwierdzenie mówi,
że ich zawartość jest w `main`, a commity nie.

Sprawdzenie jest powtarzane, pod blokadą, w chwili usuwania: gałąź, która już go nie
przechodzi, jest odrzucana, a nie usuwana.

## Co jest zaznaczone, a co nigdy

Zaznaczone przy otwarciu okna: gałęzie **zniknięte lub scalone** bez **własnych
commitów** — oraz scalone przez squash po sprawdzeniu. **Zaznacz zniknięte +
scalone** przywraca to zaznaczenie.

Nigdy nie zaznaczana za ciebie i nigdy nie obejmowana przez **Zaznacz wszystkie
widoczne**: gałąź z commitami istniejącymi tylko tutaj. Zaznacz ją wiersz po
wierszu; potwierdzenie robi się wtedy czerwone i wymienia ją z liczbą commitów.
Gałęzie tylko nieaktywne i taka, która stoi na czubku gałęzi domyślnej, też nie są
zaznaczane. Gdy zaznaczenie obejmuje wiersze, których lista nie pokazuje — ukryte
filtrem albo poza pierwszymi 400 —, potwierdzenie mówi ile.

Usuwanie przyjmuje, dla każdej gałęzi, dokładnie tyle unikalnych commitów, ile
pokazało potwierdzenie. Jeśli gałąź ma ich już więcej — albo przy **Ponów** zyskała
jakieś od cofnięcia (np. bo prune usunął zdalną kopię) —, jest odrzucana i
zachowywana, a ponowienie to zgłasza, zamiast ogłaszać sukces.

Nigdy niewymieniane i odrzucane przy usuwaniu nawet na żądanie:

- bieżąca gałąź;
- gałąź wyciągnięta w dowolnym worktree albo w trakcie rebase w jednym z nich;
- gałąź domyślna;
- [chronione gałęzie](repo-settings.md), łącznie z wzorcami jak `release/*` z
  [konfiguracji repozytorium](repo-config.md).

Na zdalnym repozytorium nic się nie zmienia. To usuwa tylko lokalne gałęzie.

## Ograniczenia

- **Scalenia squash są dla gita niewidoczne**, dopóki nie sprawdzisz. Bez **Sprawdź
  scalenia squash** gałąź scalona przez squash wygląda jak **Zniknęła** z *Commity
  istniejące tylko tutaj: N* i nie jest zaznaczona.
- **Sprawdzenie squash może chybić.** Odpowiada na pytanie „czy ta zawartość jest
  już w `main`?”. Gdy `main` potem jeszcze raz zmienił te same wiersze albo squash
  edytowano przy scalaniu, scalenie coś by zmieniło i gałąź zostaje niezaznaczona.
  Nigdy nie mówi błędnie „tak” w sposób, który traci zawartość: zawartość z
  definicji jest w `main`. Jak [radar konfliktów](conflict-radar.md) zapisuje luźne
  obiekty drzewa, które sprząta `git gc`.
- **Niepobrane zdalne repozytorium jest nieaktualne.** „Zniknęła” pochodzi z
  ostatniego fetcha. Bez **Fetch i prune** gałąź usunięta na serwerze godzinę temu
  wciąż wygląda na żywą, a świeże scalenie nie jest jeszcze w `origin/main`.
- **Nieaktywna to tylko data.** Trzy spokojne miesiące nie mówią nic o tym, czy
  praca jest bezpieczna, dlatego nieaktywne wiersze nigdy nie są zaznaczane.
- **„Gdzie indziej” to refy śledzące zdalne repozytorium z ostatniego fetcha**, a nie
  serwer w tej chwili — i nie tagi. Commit trzymany tylko przez tag liczy się jako
  unikalny, a commit na zdalnej gałęzi kogoś innego nie.
- Licznik unikalnych commitów zatrzymuje się na 500 i pokazuje *500+*. Suma w
  potwierdzeniu to dolna granica — *co najmniej N* — bo gałęzie piętrowe dzielą
  commity.
- Cofanie przywraca gałąź i jej upstream, a nie jej reflog ani inne ustawienia
  `branch.<name>.*`.
- Okno pokazuje pierwsze 400 wierszy długiej listy; filtr znajduje resztę.
  **Zaznacz zniknięte + scalone** dotyczy każdego wiersza, pokazanego czy nie.

**Zobacz też:** [Gałęzie, zdalne repozytoria i panel boczny](branching.md) · [Fetch, pull i push](syncing.md) · [Strona pull requestów](pull-requests.md)
