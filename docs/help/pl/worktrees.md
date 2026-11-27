---
title: Worktree i podmoduły
category: Synchronizacja i wiele repozytoriów
order: 54
summary: Kilka wypakowań jednego repozytorium; oraz repozytoria wewnątrz repozytoriów.
keywords: worktree worktrees podmoduł podmoduły drzewo robocze submodule submodules linked checkout init sync
---

# Worktree i podmoduły

## Worktree

Worktree to drugie wypakowanie tego samego repozytorium, we własnym katalogu —
możesz więc popatrzeć na `main`, a `feature/x` zostaje dokładnie tak, jak je
zostawiłeś, bez stashowania.

- Twórz i usuwaj worktree z panelu bocznego. **Dwuklik** otwiera dany worktree
  jako własną kartę; prawy przycisk daje *Otwórz worktree*, *Pokaż w folderze*
  i usunięcie.
- Kliknij dowolną lokalną gałąź prawym przyciskiem → **Otwórz w worktree**, żeby
  postawić je w katalogu obok i otworzyć jako kartę.
- Gałąź mieszka naraz tylko w jednym worktree, więc przełączenie się na gałąź,
  którą trzyma inny worktree, nie może się udać — git odmawia komunikatem
  *already used by worktree at …*. GitHuttBr zamiast tego cię tam zabiera: menu
  gałęzi mówi *Przejdź do `x` w jej worktree*, a dwuklik na wierszu otwiera kartę
  tego worktree, zamiast się wywalić.

### Dbanie o worktree

O worktree z zeszłego miesiąca łatwo zapomnieć, a pytania pojawiają się przy sprzątaniu: czy jest w nim praca? Czy ten folder jeszcze istnieje? Każdy wiersz odpowiada, zanim musisz zapytać.

| W wierszu | Oznacza |
|---|---|
| **●3** | Trzy pliki z niezatwierdzonymi zmianami w tym worktree |
| **↑2 ↓1** | Jego gałąź ma dwa commity przewagi i jeden zaległości względem upstreamu |
| 🔒 | Zablokowane — najedź, aby zobaczyć powód podany przy blokowaniu |
| **brak**, nazwa przekreślona | Folderu już nie ma; git ma tylko jego wpis |

![Sekcja worktree: jeden worktree z niezacommitowaną pracą i commitami do przodu,
jeden brakujący, jeden zablokowany i gumka w nagłówku](../../screenshots/worktree-care.webp)

Liczby są odczytywane przy otwarciu sekcji, gdy zmienia się commit tego worktree i gdy okno odzyskuje fokus — nie przy każdym odświeżeniu, bo każda to `git status` w innym folderze.

Kliknij wiersz prawym przyciskiem, aby:

| Akcja | Co robi |
|---|---|
| **Zablokuj worktree** | Nie pozwala git (ani żadnemu innemu klientowi) go wyczyścić, przenieść ani usunąć. Podaj powód — *na dysku zewnętrznym* — a pojawi się przy kłódce. Dla worktree na nośnikach, które nie zawsze są podłączone. |
| **Odblokuj worktree** | Odwrotność. Cofnięcie blokuje je ponownie z tym samym powodem. |
| **Przenieś worktree…** | Przenosi folder i aktualizuje powiązania git w obie strony. Niedostępne, gdy jest zablokowane lub otwarte w karcie: karty i ich układ są zapamiętywane po ścieżce, więc karta wskazywałaby na nic. Najpierw ją zamknij. Cofnięcie przenosi je z powrotem. |
| **Usuń worktree** | Najpierw pyta git, co zostałoby utracone. Czyste worktree dostaje zwykłe potwierdzenie, a cofnięcie odtwarza je na tej samej gałęzi w tym samym folderze. Takie z niezatwierdzonymi zmianami dostaje osobne potwierdzenie, *Odrzuć i usuń*, z liczbą plików, bez cofania. |
| **Połącz ponownie przeniesiony folder…** | Tylko w wierszu z *brak*: wskaż, gdzie trafił folder (przeniesiony menedżerem plików), a git połączy go ponownie przez `git worktree repair`. |
| **Zapomnij brakujące worktree** | To także przycisk gumki w nagłówku sekcji, widoczny, gdy któregoś wiersza brakuje. Uruchamia `git worktree prune`. |

Czego te akcje **nie** robią:

- **Usunięcie worktree kasuje też jego ignorowane pliki** — `.env`, `node_modules`, wyniki builda. Git nie liczy ich jako zmian, więc nawet „czyste” potwierdzenie o tym mówi, a cofnięcie ich nie przywraca.
- **Zapominanie usuwa tylko wpis w git.** Nie ma plików do usunięcia — folderu już nie ma — a zablokowane worktree są pomijane, bo zablokowane na odłączonym dysku wygląda dokładnie jak usunięte.
- Blokada to umowa między klientami git, a nie ochrona plików: nie powstrzyma niczego spoza git przed usunięciem folderu.
- Głównego worktree — samego repozytorium — nie można zablokować, przenieść ani usunąć.
- Usunięcie worktree nigdy nie usuwa jego gałęzi. Usuń ją z listy gałęzi, jeśli skończyłeś.

### Grupowanie worktree w nagłówku

Karty worktree otwierają się z etykietami `root · branch`, co szybko robi się
szerokie.

**Projekt trzymany w grupie przyjmuje swoje worktree.** Gdy repozytorium — albo
jeden z jego worktree — już jest w grupie, nowy worktree otwiera się w tej grupie,
obok niego, bez zaznaczania czegokolwiek: okno dodawania worktree tylko mówi,
która to grupa, a **Otwórz w worktree** z menu gałęzi robi to samo bez pytania.
Worktree otwarty później z **Ostatnich** albo z folderu też do niej dołącza.
Przeciągnij chip poza grupę, jeśli chcesz go osobno.

Dla repozytorium we własnej karcie zaznacz w oknie dodawania worktree **Proponuj
grupowanie worktree’ów współdzielących to samo repozytorium główne** (domyślnie
wyłączone, zapamiętywane jak opcja codegraph): jeśli root jest otwarty jako
samodzielna karta, pojawia się pole **Nazwa grupy** (wstępnie wypełnione nazwą
folderu roota) i oba trafiają do nowej grupy; gdy żaden członek rodziny nie jest
otwarty, okno mówi tylko, że worktree otworzy się we własnej karcie. W grupie
chipy skracają się do samej końcówki (`main`, `feature/x`), bo grupa już mówi, do
którego repozytorium należą — przełącznik **Krótkie nazwy worktree w grupach** w
Ustawienia → Układ i terminal zachowuje pełną nazwę `root · branch`, jeśli wolisz.
Propozycja łączy tylko worktree o tym samym roocie — nigdy nie scala
niepowiązanych repozytoriów.

**Jak odróżnić kartę worktree.** Podpięty worktree to drugi checkout
repozytorium, a jego karta wyglądałaby inaczej dokładnie jak karta samego
repozytorium. Dlatego karta worktree pokazuje zielony **fork** zamiast ikony
folderu — na karcie z obrazkiem mały fork w rogu obrazka — a jej podpowiedź mówi
*Worktree repozytorium …* razem z folderem, w którym leży. Kliknij ją prawym
przyciskiem, by wybrać **Otwórz …, główne repozytorium**, co ustawia fokus na
karcie, która już ma główny checkout, albo go otwiera — w grupie worktree, jeśli
worktree w jakiejś jest. Działa to niezależnie od tego, jak worktree otwarto: z
jego rodziny, przez **Otwórz repozytorium** albo z listy przeskanowanych, a
worktree podmodułu wskazują na podmoduł. Ograniczenia: oznaczenie dotyczy tego,
gdzie leży checkout, a nie jego gałęzi; worktree repozytorium bare nie są
oznaczane, bo nie ma głównego checkoutu do otwarcia; a główne repozytorium otwarte
przez folder będący dowiązaniem symbolicznym nie jest rozpoznawane jako już
otwarte, więc menu otwiera je drugi raz pod prawdziwą ścieżką.

![Karta worktree z zielonym forkiem obok karty głównego repozytorium, z otwartym
menu na Otwórz submodules-worktrees, główne repozytorium](../../screenshots/worktree-tab.webp)

![Sekcje worktree i podmodułów w panelu bocznym, obie wypełnione](../../screenshots/worktrees.webp)

## Podmoduły

Dodawaj, aktualizuj (init i checkout), synchronizuj adresy i usuwaj podmoduły,
z żywym statusem dla każdego:

| Status | Oznacza |
|---|---|
| **Zsynchronizowany** | Wypakowany na commicie, który zapisuje rodzic |
| **Zmodyfikowany** | Wypakowany gdzie indziej albo brudny |
| **Niezainicjowany** | Zapisany, ale nigdy niewypakowany |

![Podmoduły ze swoim statusem, po jednym wierszu na każdy](../../screenshots/submodule-states.webp)

**Zobacz też:** [LFS i sparse-checkout](lfs-sparse.md) · [Fetch, pull i push](syncing.md)
