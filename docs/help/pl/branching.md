---
title: Gałęzie, zdalne repozytoria i panel boczny
category: Gałęzie i operacje na historii
order: 40
summary: Wszystko, co robi lewy panel, oraz przypięte gałęzie.
keywords: gałąź gałęzie utwórz przełącz zmień nazwę usuń zdalne przypięte panel boczny branch branches create checkout rename delete remote pinned sidebar presence dodaj remote filtr filter szukaj search kolejność reorder przesuń sekcja szybkie akcje
---

# Gałęzie, zdalne repozytoria i panel boczny

Jeden panel boczny — przestawialny i przeszukiwalny — mieści **gałęzie, zdalne
repozytoria, tagi, stashe, worktree i podmoduły**. Każdą sekcję da się ukryć
albo przestawić (Ustawienia → Układ i terminal), a pole filtra działa na wszystkie naraz.
To, które sekcje i katalogi zostawiasz rozwinięte albo zwinięte, jest
zapamiętywane per repozytorium — także po restarcie.

Aby zmienić kolejność, przeciągnij sekcję za nagłówek — albo, bez myszy, ustaw fokus na nagłówku i naciśnij <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>. Te same pozycje *Przesuń sekcję w górę* i *Przesuń sekcję w dół* są w menu kontekstowym nagłówka (<kbd>Shift</kbd>+<kbd>F10</kbd> otwiera je z klawiatury). Kolejność także jest zapamiętywana dla każdego repozytorium.

Panel boczny to stos paneli, nie długa lista. Otwarta sekcja zajmuje wysokość,
którą zostawiają zwinięte — te siedzą poniżej jako wiersze nagłówka. Otwórz
kilka i dzielą tę wysokość po równo, każda ze swoim scrollem. Sekcja z setkami
tagów przewija się we własnym panelu, a pozostałe nagłówki zostają tam, gdzie
są, więc nic, co chcesz kliknąć, nie ucieka z ekranu. Otwórz więcej, niż się
mieści, i wszystkie panele kurczą się razem do nagłówka — sam panel boczny nigdy
nie przewija.

Tylko **Lokalne** startuje otwarte w repozytorium, którego jeszcze nie
ułożyłeś; każda inna sekcja startuje jako nagłówek. Sekcja zawierająca ponad 300
referencji i tak startuje zwinięta. W repozytorium z tysiącami nigdy
nieusuniętych gałęzi zdalnych wszystkie trafiłyby inaczej na ekran, choć nikt o
to nie prosił; rozwiń ją raz, a ten wybór zostanie zapamiętany jak każdy inny.

![Panel boczny z przypiętymi gałęziami trzymanymi na górze](../../screenshots/pinned-branches.webp)

## Jeden filtr dla wszystkich sekcji

Pole na górze paska bocznego filtruje **wszystkie sekcje naraz**: lokalne i zdalne branche, tagi, stashe, worktree, submoduły, pull requesty, issues, kamienie milowe, wydania, zakładki i zadania. Porównuje nazwy, tytuły i ścieżki bez względu na wielkość liter; pull request pasuje też po `#numerze`, branchu źródłowym i autorze. Wiersz pod polem liczy wyniki ze wszystkich sekcji.

Gdy filtr jest aktywny:

- każdy nagłówek pokazuje **znalezione z całości** — `2 z 10`;
- sekcja bez wyników znika z listy i zwija się do jednego wiersza na dole, żeby wyniki nie przeplatały się z pustymi nagłówkami;
- sekcje i foldery z wynikami otwierają się same, chyba że mają ich ponad 300 — te otwierasz ręcznie. To, co otworzysz lub zamkniesz, obowiązuje tylko do wyczyszczenia filtra; zapisany układ zostaje nietknięty.

<kbd>Esc</kbd> w polu je czyści.

![Pasek boczny przefiltrowany po „pay”: dwie sekcje z wynikami, reszta zwinięta na dole](../../screenshots/sidebar-filter.webp)

**Ograniczenia:** to zwykłe wyszukiwanie podciągu — bez symboli wieloznacznych, bez wyszukiwania przybliżonego, bez wyrażeń regularnych. Przeszukuje to, co pasek boczny już wczytał: pull requesty i issues spoza listy zwróconej przez hosta nie zostaną tu znalezione (strona [pull requestów](pull-requests.md) ma własny filtr). Zdalne branche pasują po pełnej nazwie `remote/branch`, więc wpisanie nazwy remote'a znajduje każdy jego branch.

## Gałęzie

Twórz, przełączaj, zmieniaj nazwy i usuwaj — lokalne i zdalne. Wiersze gałęzi
pokazują:

- **↑przed / ↓za** względem swojego upstreamu,
- **plakietki obecności na poszczególnych zdalnych** (które zdalne mają tę
  gałąź),
- **kropkę ryzyka** po skanie [radaru konfliktów](conflict-radar.md),
- **znacznik ⟳**, gdy zdalne repozytorium
  [przepisało historię](range-diff.md).

Najedź na wiersz lokalnego brancha albo dojdź do niego Tabem, aby zobaczyć dwie szybkie akcje: **Checkout** i **Utwórz pull request**. To te same akcje co w menu kontekstowym, które zachowuje całą resztę; bieżący branch pokazuje tylko drugą.

Gałęzie z `/` w nazwie same zwijają się w składane katalogi.
Prefiks z jednym dzieckiem nadal jest folderem — `release/1.2.3` to `release`
z `1.2.3` w środku — więc dodanie `release/1.2.4` później nie przebudowuje drzewa.
Ciąg folderów z jednym dzieckiem zwija się do jednego nagłówka
(`dependabot/npm_and_yarn`). Nagłówki folderów mają znak folderu; ref — znak
brancha, zdalnego albo tagu. **Ustawienia → Układ i terminal → Grupuj refy po prefiksie** wyłącza foldery, dając płaską listę.

Kliknij prawym przyciskiem nagłówek katalogu, by zadziałać na całą grupę: *Usuń
wszystkie branche pod `feature` (4 branchy)* usuwa wszystko w środku po jednym
potwierdzeniu, które wypisuje dokładnie, które gałęzie znikną — gałąź, na
której jesteś, jest wykluczona. To samo menu istnieje na katalogach zdalnych
gałęzi, usuwając wtedy ze zdalnego repozytorium.

Rozwijana lista gałęzi na pasku narzędzi pokazuje gałęzie lokalne i zdalne.
Kliknij prawym przyciskiem dowolną gałąź na tej liście, aby zmienić nazwę
gałęzi lokalnej, skopiować jej nazwę, otworzyć ją w nowym worktree, scalić
ją z aktywną gałęzią lub ją usunąć. Gałęzie zdalne nie oferują zmiany nazwy
i po potwierdzeniu są usuwane ze swojego zdalnego repozytorium. GitHuttBr
pomija scalanie, gdy wybrana referencja jest już zawarta w aktywnej gałęzi,
i wyłącza tworzenie worktree, gdy ta gałąź jest już wyewidencjonowana.

![Akcje gałęzi lokalnej na rozwijanej liście paska narzędzi](../../screenshots/branch-dropdown-local-context-menu.webp)

![Akcje gałęzi zdalnej na rozwijanej liście paska narzędzi](../../screenshots/branch-dropdown-remote-context-menu.webp)

Wiersze zaznacza się grupowo jak pliki: klik z <kbd>⌘/Ctrl</kbd> przełącza
wiersz, klik z <kbd>Shift</kbd> zaznacza zakres, a
<kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> rozszerza zaznaczenie od ostatnio
klikniętego wiersza. Kliknij zaznaczenie prawym przyciskiem, by otworzyć menu
zbiorcze — *Usuń 4 branchy* — które potwierdza pełną listą. Te same gesty
działają na zdalnych gałęziach, tagach i stashach.

![Nazwy gałęzi rozdzielone ukośnikiem zwinięte w drzewo](../../screenshots/branch-grouping.webp)

## Gałąź z work itemu Azure Boards

W repozytorium ze zdalnym w Azure DevOps paleta poleceń ma
**Create branch from Azure work item…**. Wpisz numer work itemu (albo `AB#1234`),
a zobaczysz jego typ, tytuł i stan; **Utwórz gałąź** otwiera zwykłe okno z
wypełnioną nazwą — `bugfix/1234-tytul` dla błędu, `feature/1234-tytul` dla
wszystkiego innego — i `AB#1234 tytuł` jako zadaniem, jeśli wolisz, żeby nazwę
zaproponowała AI.

Wzmianki o work itemach stają się linkami w wiadomościach commitów i tekstach
pull requestów: `AB#1234` wszędzie, gdzie znana jest organizacja Azure, a w
repozytorium Azure także zwykłe `#1234`, bo Azure numeruje work itemy, nie
issues. W repozytorium GitHub połączonym z Azure Boards organizacja nie jest
znana; wpis `links.tickets` w [`.githuttbr.json`](repo-config.md) repozytorium to
załatwia — wzorzec `AB#(\d+)`, URL
`https://dev.azure.com/<org>/_workitems/edit/$1`.

## Zmiana nazwy gałęzi

Gałąź nazwana trzy dni temu `fix` to dziś gałąź, której nikt nie potrafi
umiejscowić. Zmień jej nazwę tam, gdzie zauważysz problem:

| Gdzie | Jak |
|-------|-----|
| Panel boczny | Prawy przycisk na gałęzi → *Zmień nazwę…* |
| Lista gałęzi na pasku narzędzi | Prawy przycisk na gałęzi → *Zmień nazwę…* |
| Graf commitów | Prawy przycisk na plakietce gałęzi przy commicie → *Zmień nazwę…* |
| Paleta poleceń | <kbd>⌘/Ctrl</kbd>+<kbd>K</kbd> → *Zmień nazwę brancha* (działa na bieżącej gałęzi) |

Lokalna zmiana nazwy to `git branch -m`: natychmiastowa i **odwracalna przez
⌘Z** — wpis cofnięcia przywraca starą nazwę. Zmiana nazwy gałęzi, na której
jesteś, pozostawia cię na niej.

Gdy gałąź śledzi zdalną, menu oferuje też *Zmień nazwę (także na remote)…*:
zmiana lokalna, wypchnięcie nowej nazwy i usunięcie starej po stronie zdalnej.
Tego **nie da się cofnąć** — stara gałąź zdalna znika, a każdy, kto ją miał
wybraną, musi przestawić się sam. Na plakietce w grafie opcja pojawia się tylko
wtedy, gdy gałąź śledzi dokładnie jedną zdalną; przy kilku wybierz gałąź w
panelu bocznym, żeby upstream był jednoznaczny.

**Ograniczenia:** GitHuttBr nie przepisuje niczego, co odwoływało się do starej
nazwy — otwarte pull requesty nadal wskazują gałąź, wobec której powstały, a
reguły CI dopasowane do wzorca gałęzi przestają pasować. Zmiana nazwy gałęzi
wybranej w innym [worktree](worktrees.md) kończy się błędem, a git to zgłasza.

## Pull i push gałęzi, na której nie jesteś

Kliknij prawym przyciskiem dowolną gałąź lokalną — pozycje **Pobierz** i
**Wypchnij** działają na *tej* gałęzi, a nie na aktualnie przełączonej: bez
objazdu przez checkout, gdy trzeba nadgonić trzy gałęzie. Zobacz
[fetch, pull i push](syncing.md).

## Przypięte gałęzie

Oznacz gwiazdką gałęzie, do których ciągle wracasz — najedź na wiersz i kliknij
★ albo kliknij prawym przyciskiem → *Przypnij gałąź*. Wypływają wtedy do grupy
**Przypięte** na górze sekcji lokalnej, zapamiętywane osobno dla każdego
repozytorium, i jednocześnie zostają na swoim zwykłym miejscu niżej.

## Przełączanie na gałąź zdalną

Kliknij dwukrotnie gałąź zdalną, żeby utworzyć lokalną, która ją śledzi. Jeśli
lokalna gałąź o tej nazwie już istnieje i się **rozeszła**, GitHuttBr zapyta, jak
to pogodzić — rebase, merge czy reset — i zaproponuje wcześniejsze zrobienie
kopii gałęzi.

![Pytanie o rozeszłą gałąź: rebase, merge albo reset, z opcją kopii zapasowej](../../screenshots/diverged-checkout.webp)

### Gdy Twoja lokalna gałąź jest z tyłu

Przy przełączaniu zostaje przewinięta (fast-forward) do wierzchołka zdalnej
gałęzi. Brudne drzewo robocze trafia najpierw do nazwanego stasha i wraca po
aktualizacji, więc lokalne zmiany jej nie przerywają.

### Gdy Twoja lokalna gałąź jest do przodu

Jeśli lokalna gałąź jest do przodu, a zdalna nie ma nic nowego, przełączenie
odpowiedziałoby na prośbę o gałąź *zdalną* Twoją własną, niewypchniętą pracą —
dlatego nic nie zostaje przełączone, dopóki nie powiesz, którą stronę masz na
myśli:

| Wybór | Co się dzieje |
|-------|---------------|
| Przełącz na lokalną | Przechodzi na lokalną gałąź z nienaruszonymi commitami. To, co każdy inny klient robi po cichu. |
| Reset (soft) | Cofa gałąź do wierzchołka zdalnej; zmiany z commitów zostają **w poczekalni**, gotowe do ponownego commita. |
| Reset (mixed) | To samo cofnięcie, zmiany zostają **poza poczekalnią** w drzewie roboczym. |
| Reset (hard) | Odrzuca commity *i* ich zmiany. |

![Okno gałęzi do przodu: przełącz na lokalną albo zresetuj soft, mixed lub hard](../../screenshots/ahead-checkout.webp)

Zostaw zaznaczone *Najpierw utwórz gałąź zapasową*, a wierzchołek lokalnej gałęzi
zostanie zapisany jako `backup/<gałąź>-<znacznik-czasu>`, zanim cokolwiek się
przesunie — nawet reset hard dzieli wtedy od cofnięcia jedno przełączenie. Reset
trafia też na stos cofania (⌘Z), ale tylko do zamknięcia repozytorium; gałąź
zapasowa zostaje dłużej.

**Ograniczenia:** okno porównuje gałąź wyłącznie z właśnie pobraną referencją
śledzącą, więc zdalne repozytorium, które odrzuciło pobranie (brak sieci, złe
dane logowania), zostanie porównane z ostatnio znanym wierzchołkiem. Nie mówi
nic o tym, czy Twoje commity są *dobre* — tylko że są tu, a nie tam.

## Zdalne repozytoria

Sekcja Zdalne w panelu bocznym to miejsce, gdzie dodaje się, edytuje, pobiera
i usuwa remote’y. Fetch, pull lub push na repozytorium, które nie ma żadnego,
otwiera to samo okno **Dodaj remote** — wklej URL albo utwórz repo na hoście —
zamiast nic nie robić. Zobacz [fetch, pull i push](syncing.md).

**Zobacz też:** [Merge i rebase](merging.md) · [Worktree](worktrees.md)
