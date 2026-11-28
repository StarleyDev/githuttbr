---
title: Przestrzenie, karty i grupy
category: Zacznij tutaj
order: 3
summary: Wiele repozytoriów bez tonięcia w nich: karty, grupy, foldery i przestrzenie robocze.
keywords: przestrzeń robocza karty grupy foldery wiele repozytoriów układ workspace tabs groups folders multiple repos organise switch layout przejdź do repozytorium przełącznik rozmiar kart go to repository switcher tab sizing
source: 0a7a79bf2fb89d3802683802c172c87da41b1909
---

# Przestrzenie, karty i grupy

Trzy poziomy, od najluźniejszego do najściślejszego.

## Karty

Jedno repozytorium, jedna karta. <kbd>⌘T</kbd> / <kbd>Ctrl+T</kbd> otwiera wybór
nowej karty, a <kbd>⌘W</kbd> / <kbd>Ctrl+W</kbd> zamyka aktywną. Karty można też
przeciągać, żeby zmienić kolejność, zamykać środkowym przyciskiem myszy albo
przywracać ostatnio zamkniętą przez <kbd>⌘⇧T</kbd>. Kliknij kartę repozytorium
(albo chip wewnątrz [grupy](#grupy)) prawym przyciskiem, żeby dostać
[menu kontekstowe repozytorium](repo-menu.md) — alias, worktree, GitHub,
terminal, pokazanie w menedżerze plików, edytor, a na samym dole **Zamknij to
repozytorium** i **Zamknij pozostałe** (chip w grupie oferuje zamiast tego
usuwanie). Zamknij ostatnią
kartę, a <kbd>⌘W</kbd> zamknie zamiast niej okno. Kropka na karcie oznacza
niezacommitowaną pracę; inna kropka oznacza konflikty.

Jeśli pojawi się ostrzeżenie przy zamykaniu, <kbd>Escape</kbd> zawsze anuluje.
<kbd>Enter</kbd> potwierdza tylko wtedy, gdy karta jest czysta — przy
niezacommitowanych zmianach albo konfliktach ostrzeżenie celowo każe ci sięgnąć
po przycisk, żeby przypadkowe uderzenie w klawisz po <kbd>⌘W</kbd> nie zamknęło
pracy, którą wciąż trzymałeś.

### Rozmiar kart

Domyślnie (**Ustawienia → Układ i terminal → Rozmiar kart → Dopasuj**) karty zachowują się
jak w przeglądarce: gdy w pasku brakuje miejsca, kurczą się równo do minimalnej
szerokości, a przewijają dopiero, gdy i ta granica zostanie osiągnięta. **Stały**
przywraca klasyczne zachowanie — każda karta zachowuje szerokość swojej zawartości,
a pasek przewija się, gdy tylko nie mieszczą się wszystkie.

### Przechodzenie do repozytorium

Przy dziesięciu lub więcej otwartych repozytoriach znalezienie jednego w pasku
wymaga przewijania, <kbd>⌘1</kbd>–<kbd>⌘9</kbd> kończą się na dziewiątej karcie, a
[paleta poleceń](search.md) miesza otwarte repozytoria ze wszystkimi akcjami.
Naciśnij <kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd> (albo **Widok → Przejdź do
repozytorium…**) i wpisz kilka liter jego nazwy, folderu lub gałęzi, potem
<kbd>Enter</kbd>.

![Przełącznik repozytoriów, ostatnio używane na początku](../../screenshots/repo-switcher.webp)

Lista zawiera tylko otwarte repozytoria, łącznie z tymi w grupach, w kolejności, w
jakiej ostatnio na nie patrzyłeś. To, które właśnie opuściłeś, jest pierwsze, więc
<kbd>⌘J</kbd> <kbd>Enter</kbd> zabiera cię z powrotem. Każdy wiersz niesie to, co
pokazuje jego karta: gałąź, kropkę niezacommitowanej pracy lub konfliktu, grupę, w
której jest, i klawisz <kbd>⌘1</kbd>–<kbd>⌘9</kbd>, jeśli go ma. Repozytorium na
ekranie jest przygaszone na dole. Za przełącznikiem nic się nie przyciemnia;
kliknięcie obok albo <kbd>Esc</kbd> go zamyka.

Gdy nic otwartego nie pasuje, ostatni wiersz, **Szukaj we wszystkich
repozytoriach**, przenosi wyszukiwanie na stronę [Repozytoria](repositories.md).
Skrót można zmienić w **Ustawienia → Skróty**.

*Ograniczenia:* kolejność jest pamiętana tylko w tej sesji, więc po ponownym
uruchomieniu zaczyna się od kolejności kart. Repozytorium otwarte w dwóch kartach
pojawia się raz, przy pierwszej karcie. Repozytoria z innych
[przestrzeni roboczych](#przestrzenie-robocze) nie są wymienione — najpierw zmień przestrzeń
roboczą albo użyj strony Repozytoria.

## Grupy

Zbierz powiązane repozytoria w nazwaną, oznaczoną kolorem **kartę grupy**.
Wewnątrz grupy dostajesz drugi rząd z jednym chipem na repozytorium, a sama
grupa potrafi za jednym zamachem wykonać **Pobierz wszystko** lub **Pull na
wszystkich**.

Żeby założyć grupę, kliknij prawym przyciskiem kartę repozytorium → *Nowa
grupa…*: karta staje się grupą z tym repozytorium, w tym samym miejscu. Gdy grupa
już istnieje, ta sama pozycja menu brzmi *Dodaj do grupy →* i wymienia otwarte
grupy. Przeciągnięcie karty repozytorium na chip grupy robi to samo.

*Nowa grupa…* pyta jednocześnie o nazwę i kolor. Kolor zaczyna od losowego, którego
nie nosi jeszcze żadna otwarta grupa, żeby grupy nie zaczynały się tak samo.

![Okno Nowa grupa, z nazwą i kolorem wybieranymi razem](../../screenshots/new-group-dialog.webp)

Żeby zmienić kolor grupy, kliknij ją prawym przyciskiem: dziesięć kolorów stoi w
menu jako rząd kropek, z obwódką wokół bieżącego, a jedno kliknięcie go stosuje.
*Własny kolor…* pod rzędem otwiera wybór dowolnego innego koloru. Foldery i sekcje na
stronie Repozytoria używają tego samego rzędu.

![Menu kontekstowe grupy: rząd kolorów, Własny kolor…, Rozgrupuj i Zamknij grupę](../../screenshots/group-color-menu.webp)

Żeby rozwiązać grupę, kliknij ją prawym przyciskiem → **Rozgrupuj**. Każde
repozytorium staje się zwykłą kartą w miejscu grupy i zachowuje otwarte strony.
**Zamknij grupę** zamyka natomiast grupę i każde repozytorium w niej. Foldery nie
przetrwają rozgrupowania: istnieją tylko wewnątrz grupy.

![Karta grupy z kilkoma repozytoriami](../../screenshots/repo-groups.webp)

Grupy mogą zawierać **foldery, zagnieżdżane na dowolną głębokość**: kliknij
grupę prawym przyciskiem → *Nowy folder…*, a potem przeciągnij repozytoria na
chip folderu. Każdy folder dostaje kolor, zwija się do chipa z licznikiem,
agreguje kropki statusu wszystkiego, co w nim siedzi, i potrafi pobrać albo
zrobić pull dla całego swojego poddrzewa.

![Foldery na pasku kart grupy, każdy jako chip z licznikiem — Internal zagnieżdżony w Services](../../screenshots/nested-folders.webp)

> Foldery wyłącznie porządkują. Usunięcie folderu przenosi jego repozytoria do
> rodzica — nigdy nie zamyka repozytorium.

Aby dodać repozytorium, którego grupa jeszcze nie ma, kliknij **+** obok nazwy grupy. Pokazuje on stronę grupy — otwórz folder, sklonuj, utwórz albo wybierz ostatnie repozytorium — nawet gdy jedno z jej repozytoriów jest otwarte; kliknięcie chipa wraca do niego.

## Strony, które należą do repozytorium

Niektóre strony nie są bytem osobnym: [wiki](repo-wiki.md) repozytorium, jego
[statystyki](insights.md), [narzędzia deweloperskie](devtools.md) ogłoszone
przez sesję uruchomienia. Nie zajmują karty — pojawiają się jako małe etykiety na
samym repozytorium: ikona i słowo, które mówi, jaka to strona (*CI*, *PR-y*,
*Wiki*, *#482* dla pull requesta, tag wydania). Pełna nazwa jest w podpowiedzi, a
długi tag lub tytuł jest skracany wielokropkiem.

- **Kliknij ikonę**, żeby pokazać stronę. **Kliknij ponownie — albo kliknij
  nazwę repozytorium** — żeby wrócić do repozytorium. Dopóki strona jest
  otwarta, nazwa dostaje kursor wskaźnika i małą plakietkę pod najechaniem: to
  droga powrotna.
- **Najedź na ikonę**, a obok niej otworzy się ✕, tak jak na samej karcie;
  zamyka tylko tę stronę.
- Dopóki repozytorium ma otwarte strony, **jego własne ✕ jest ukryte**: obok
  ikon stron wyglądało jak zamknięcie strony. Kliknij kartę środkowym
  przyciskiem albo użyj jej menu pod prawym przyciskiem, żeby zamknąć samo
  repozytorium.
- Wewnątrz **grupy** ikony siedzą na plakietce repozytorium, do którego należą,
  i tylko dopóki to repozytorium jest wybrane. Wybranie innego repo pokazuje
  *tamto* repozytorium, nie narzędzie sąsiada.
- Ponowne otwarcie tej samej strony zapala istniejącą ikonę, zamiast dokładać
  drugą.

Repozytorium, które nigdzie nie jest otwarte, nie ma ikony do noszenia — jego
strona otworzy się wtedy we własnej karcie: otwieranie musi zawsze coś otworzyć.

## Przestrzenie robocze

Przestrzeń robocza to **cały zapisany pasek kart**. Przełączenie podmienia
wszystkie karty naraz: `Praca` i `Prywatne` przestają sobie wchodzić w drogę.

Nazwa przestrzeni siedzi w lewym górnym rogu, obok znaku GitHuttBr. Kliknij ją,
żeby przełączyć, utworzyć, zmienić nazwę, przestawić lub usunąć. Obok znajduje
się wskaźnik otwierający [Centrum dowodzenia](mission-control.md) dla
przestrzeni, w której jesteś.

**Zobacz też:** [Centrum dowodzenia](mission-control.md) · [Wiersz poleceń](cli.md)
