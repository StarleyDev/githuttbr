---
title: Rozwiązywanie konfliktów
category: Praca ze zmianami
order: 32
summary: Jeden ekran na cały krok z konfliktem — każdy plik, wspólny przodek, odpowiedź dla każdego konfliktu i meta.
keywords: konflikt konflikty rozwiąż nasze ich twoje przychodzące baza wspólny przodek znaczniki trójstronny usunięty zmiana nazwy zapamiętane rozwiązanie zakończ kontynuuj przerwij conflict resolver merge ours theirs base common ancestor markers three-way modify delete rename rerere reuse recorded resolution replay finish continue abort
---

# Rozwiązywanie konfliktów

Kiedy merge, rebase, cherry-pick albo revert się zatrzyma, edytor konfliktów
zamienia cały krok w jeden ekran. Pasek u góry mówi, **co** się zatrzymało i
**między czym** — „Scalanie `feature` do `main`", a nie po prostu „konflikt" — i
jak daleko jesteś: *2 z 5 plików rozwiązano*, razem z konfliktami, które wciąż
zostały we wszystkich plikach.

![Edytor konfliktów](../../screenshots/conflict-resolver.webp)

## Pasek plików

Pod paskiem jest jeden chip na każdy plik, na którym ten krok się zatrzymał:

| Chip | Oznacza |
|---|---|
| Zielony z ✓ | Rozwiązany — w przechowalni, nic więcej do decydowania |
| Obrysowany | Plik, na którym jesteś |
| Czerwona liczba | Ile bloków konfliktu plik jeszcze zawiera |
| Etykieta | Konflikt bez tekstu do scalenia: *usunięty po jednej stronie*, *zmieniono nazwę po obu stronach*, *dodany po jednej stronie* |

Rozwiązane chipy idą pierwsze, otwarte po nich, każda grupa według nazwy, więc
pasek czyta się jako zrobione po lewej i to, co zostało, po prawej.

**Następny plik →** przeskakuje do następnego wciąż otwartego, a oznaczenie pliku
jako rozwiązanego samo cię tam przenosi. **Kontynuuj** na pasku pozostaje
wyłączone, dopóki każdy chip nie jest zielony; **Przerwij** najpierw pyta i mówi,
co tracisz.

git zapomina o pliku w chwili, gdy trafi do przechowalni, więc „rozwiązany" to
to, co GitHuttBr widział podczas tego kroku, plus pliki, które git wymienił w
swoim komunikacie merge'a. Plik dodany do przechowalni w terminalu, zanim
otworzyłeś edytor, nadal się liczy; po ponownym uruchomieniu w środku rebase'u
rozwiązana połowa tego jednego kroku może się już nie liczyć.

## Dlaczego to jest w konflikcie

**Dlaczego to konfliktuje** w nagłówku pliku wypisuje, dla każdej strony
osobno, commity, które dotknęły tego pliku, odkąd gałęzie się rozeszły — czyli
`git log --merge`, które git ma od zawsze i którego nikt nie znajduje.

![Commity z każdej strony, które dotknęły pliku w konflikcie](../../screenshots/conflict-why.webp)

Znaczniki mówią, co się gryzie. To mówi, kto to zmienił i po co — a to zwykle
przesądza o rozwiązaniu. Pustka w tym miejscu oznacza, że żadna ze stron nie
zacommitowała zmiany dokładnie w tej ścieżce — kolizja wzięła się ze zmiany
nazwy albo przeniesienia.

Nagłówek mówi też, na którym konflikcie jesteś i jakiego rodzaju konflikt ma
plik, odczytany z własnego statusu gita: *obie strony zmieniły te same wiersze*,
*dodany po obu stronach*.

## Trzy panele

| Panel | Jest |
|---|---|
| **Twoja strona** | Strona, na której byłeś, z nagłówkiem najnowszego commita po tej stronie, który dotknął pliku: sha, temat, autor, jak dawno temu |
| **Baza** | Wersja, od której obie strony wyszły — wspólny przodek, a przy picku albo kroku rebase'u rodzic stosowanego commita. Wiersze, które zastąpił każdy konflikt, są zacienione |
| **Przychodzące** | Strona, która przychodzi, z nagłówkiem takim samym jak Twoja strona |

**Pokaż bazę** w nagłówku wyniku ukrywa albo pokazuje panel Baza i pamięta twój
wybór. Jest wyszarzone, gdy bazy nie ma — obie strony dodały plik.

Wszystkie panele da się rozsuwać, a nagłówek wyniku niesie dwa przełączniki
widoku:

| Przełącznik | Co robi |
|---|---|
| **Zawijaj** | Zawija długie wiersze w panelach bocznych zamiast je przewijać. Widok tekstowy wyniku trzyma jeden rząd na wiersz — od tego zależą jego boczne znaczniki — więc zawsze się przewija |
| **Połącz przewijanie** | Przewija panele i wynik razem, w pionie i w poziomie. Ich liczby wierszy się różnią, więc pozycja pionowa jest dopasowywana proporcjonalnie |

Zawijaj na starcie jest wyłączone, Połącz przewijanie — włączone, a oba
przełączniki pamiętają swój stan.

## Wynik

Wynik to plik w takiej postaci, w jakiej zostanie zapisany. Każdy konflikt
stoi na swoim miejscu jako karta z czterema odpowiedziami:

| Odpowiedź | Co trafia do pliku |
|---|---|
| **Użyj swojego** | Twoje wiersze i tylko twoje |
| **Użyj ich** | Ich wiersze i tylko ich |
| **Oba** | Twoje wiersze, a po nich ich |
| **Edytuj** | Oba, otwarte w edytorze tekstu z zaznaczonym konfliktem, na wypadek gdy odpowiedź brzmi „oba, ale poprawione" |

Karta bez odpowiedzi pokazuje podgląd obu stron, każdy wiersz oznaczony *←
twoje* albo *← ich* i ponumerowany wierszem, na który trafi po wybraniu, więc
możesz zdecydować bez podnoszenia wzroku. W pliku z bardzo długimi wierszami
odpowiedzi zostają na widoku, a kod przewija się pod nimi w poziomie. **Cały
plik: twój | ich** w nagłówku pliku odpowiada na każdy konflikt naraz.

**Edytuj jako tekst** przełącza wynik na zwykły edytor do swobodnego pisania, z
liczbą wierszy pliku w nagłówku. Gdy już coś wpiszesz, karty przestają opisywać
to, co tam jest, więc tekst zostaje, dopóki **Resetuj wybory** nie przywróci
wszystkiego.

Stopka liczy, co zostało w tym pliku; **Oznacz *plik* jako rozwiązany** zapisuje
wynik i dodaje go do przechowalni, i jest wyłączone, dopóki każdy konflikt nie
ma odpowiedzi.

## Poruszanie się

Otwarcie pliku ląduje na jego **pierwszym konflikcie**, a nie na początku
pliku. Strzałki ⌃ / ⌄ w nagłówku wyniku — albo <kbd>Alt+↑</kbd> /
<kbd>Alt+↓</kbd> — przechodzą przez resztę, przewijając każdy panel do każdego z
nich.

## Wybieranie po wierszu

Panele boczne nadal wybierają per **wiersz** i per **fragment**, a pole wyboru w
ich nagłówku bierze **całą stronę** — dla odpowiedzi, której nie oferuje żadna
karta, na przykład dwóch twoich wierszy i jednego ich. Wybory na poziomie
wierszy od razu pojawiają się w kartach.

## Pliki, w których nie ma czego scalać

Niektóre konflikty nie mają wierszy do porównania: jedna strona **usunęła**
plik, który druga zmieniła, albo obie strony **zmieniły jego nazwę** na różne.
Trzy panele, z których jeden jest pusty, niczego by nie wyjaśniły, więc te
dostają zamiast tego kartę — kto co zrobił, z commitem, autorem i wiekiem każdej
strony.

![Plik usunięty po jednej stronie i zmieniony po drugiej](../../screenshots/conflict-deleted.webp)

| Przypadek | Wybory |
|---|---|
| Usunięty po jednej stronie | **Zachowaj plik** (ze zmianami, które wprowadziła druga strona), **Usuń plik** (najpierw pyta) i **Zobacz, co zmieniłeś** — diff od bazy, żebyś wiedział, co usunięcie wyrzuca |
| Zmieniono nazwę po obu stronach | **Zachowaj** jedną nazwę, drugą albo **Zachowaj obie nazwy** |

git nie zapisuje żadnego powiązania między przemianowanym oryginałem a jego
dwiema nowymi nazwami, więc karta paruje je po treści. Gdy nie da się tego
ustalić — kilka zmian nazw naraz, a pliki też zmienione — mówi o tym, a nowe
nazwy pojawiają się jako osobne chipy.

## Kończenie

Gdy ostatni plik jest rozwiązany, obszar roboczy nie każe ci szukać
**Kontynuuj**: karta podsumowuje, jak odpowiedziano na konflikty, pozwala
edytować komunikat merge'a (wstępnie wypełniony tym od gita) i stamtąd kończy.

![Wszystkie konflikty rozwiązane, z komunikatem merge'a i przełącznikiem rerere](../../screenshots/conflict-done.webp)

- Podsumowanie liczy to, co widziało, że wybierasz: twoje, ich, oba, edytowane
  ręcznie. Plik rozwiązany poza edytorem liczy się jako plik, nie jako
  odpowiedź.
- Krok **rebase'u** zachowuje własny komunikat odtwarzanego commita, więc nie
  ma dla niego pola komunikatu.
- **Zapamiętaj te rozwiązania (rerere) na następny raz** to gitowe
  `rerere.enabled`, ten sam przełącznik co w Ustawieniach. git pamięta tylko
  konflikty, które widział, więc włączenie go tutaj działa od następnego.
- **Przejrzyj ponownie** zamyka edytor na wyniku w przechowalni.

## Cofanie

Każde rozwiązanie — plik oznaczony jako rozwiązany, wybrana strona, plik
zachowany albo usunięty, rozstrzygnięta zmiana nazwy — ma wpis cofania. Cofnięcie
przywraca konflikt dokładnie tak, jak git go zostawił: znaczniki, obie strony i
bazę w indeksie, plik na dysku. **Przerwij** to jedyna rzecz, której nie da się
cofnąć, i dlatego najpierw pyta.

## Wsparcie AI

Przy włączonym AI **Rozwiąż z AI** proponuje scalenie w wyniku, jako tekst.
Nigdy nic nie stosuje samo z siebie: czytasz, poprawiasz i dodajesz do
przechowalni. Zobacz [funkcje AI](ai.md).

## Pliki projektu Xcode

`project.pbxproj` konfliktuje częściej niż jakikolwiek inny plik w repozytorium
iOS — i prawie nigdy dlatego, że ktoś się z kimś nie zgadzał. To jeden płaski
słownik obiektów z 24-znakowymi kluczami szesnastkowymi, więc dodanie jednego
pliku zapisuje cztery wpisy: `PBXBuildFile`, `PBXFileReference`, wiersz w
`children` grupy nadrzędnej i wiersz w fazie budowania celu. Dwie osoby dodające
po jednym pliku zapisują osiem wpisów, które lądują w tych samych kilku
wierszach. Git widzi kolizję; nie ma czego rozwiązywać.

Gdy plikiem w konflikcie jest `project.pbxproj`, edytor konfliktów czyta
wszystkie trzy wersje jako projekty, a nie jako tekst, i proponuje **scalenie
według struktury**: dopasować obiekty po identyfikatorze, wziąć każde dodanie z
obu stron, połączyć tablice `children` i `files` i zatrzymać się na tym, co
naprawdę się rozjechało. Pasek nad panelami mówi, co dodała każda strona i co —
jeśli cokolwiek — zostaje dla ciebie.

Tak jak propozycja AI, ląduje w wyniku i niczego nie przygotowuje do
zatwierdzenia. Czytasz to przed zapisaniem.

![Pasek scalania strukturalnego nad panelami konfliktu, na pliku projektu Xcode](../../screenshots/conflict-pbxproj.webp)

### Czego odmawia

**Nigdy nie zgaduje ustawienia, które ruszyliście oboje.** Jeśli ty ustawisz
`MARKETING_VERSION` na `1.1`, a oni na `2.0`, to jest decyzja i jest wymieniona
z nazwy na pasku — ustawienie, twoja wartość, ich — zamiast być rozstrzygnięta za
twoimi plecami. Obiekt, którego nie dało się rozstrzygnąć, zachowuje dokładnie
*twoją* wersję, żeby scalenie zastosowane w połowie nigdy nie trafiło na dysk.

**Odrzuca cały plik, jeśli którakolwiek z trzech wersji się nie parsuje.**
`project.pbxproj`, którego Xcode nie otworzy, kosztuje więcej niż ręczne
scalenie, więc wszystko, czego nie da się odczytać z pewnością, zostaje zwykłym
konfliktem tekstowym — i mówi o tym wprost.

**Nie wykrywa dwóch identyfikatorów nadanych różnym obiektom.** To rzadkie, bo
Xcode losuje je przypadkowo — ale gdy się zdarzy, wybranie którejkolwiek strony
po cichu wyrzuciłoby czyjś plik, więc jest zgłaszane zamiast scalane.

### Nie `merge=union`

Krążącym lekarstwem na to jest `*.pbxproj merge=union` w
[`.gitattributes`](attributes.md). Unikaj go. Union działa, dopóki jedynymi
zmianami są niezależne dodania, a w chwili gdy dwie osoby edytują to samo
ustawienie budowania, wypisuje oba wiersze i tworzy plik, którego Xcode odmawia
otwarcia — dokładnie wtedy, gdy najmniej prawdopodobne jest, że czytasz diff
uważnie. Scalanie strukturalne daje tę samą wygodę bez tej awarii.

## Pliki blokady

`Podfile.lock`, `Package.resolved`, `yarn.lock` i im podobne zapisują graf
zależności, który czyjś resolver już rozwiązał. Połowa jednego rozwiązania
zszyta z połową drugiego to graf, którego nikt nie rozwiązał: może się nie
zainstalować, a jeśli się zainstaluje, zainstaluje coś, czego nie testowała
żadna z gałęzi.

Dlatego gdy plikiem w konflikcie jest plik blokady, pasek nazywa narzędzie,
które nim rządzi, oferuje od razu **Zachowaj nasze** i **Zachowaj ich**, i podaje
polecenie, które wygeneruje go na nowo. Wybór strony nie jest tu kompromisem —
to cała metoda, a poprawnym czyni ją dopiero ponowne wygenerowanie.

![Pasek pliku blokady nad panelami konfliktu](../../screenshots/conflict-lockfile.webp)

Trzy panele pozostają dostępne, bo od czasu do czasu naprawdę chcesz przeczytać,
co się zmieniło: sumę kontrolną, którą rozpoznajesz, wersję, której się
spodziewałeś. To ręczna edycja jest tym, od czego to wszystko ma cię odwieść.

## Jak ich w ogóle uniknąć

[Radar konfliktów](conflict-radar.md) mówi ci, które gałęzie wejdą w konflikt,
zanim którąkolwiek zmerge'ujesz.

## Niech git pamięta (rerere)

Rebase'uj długo żyjącą gałąź, a za każdym razem spotkasz ten sam konflikt.
`rerere` — *reuse recorded resolution* — jest odpowiedzią gita: zapamiętuje, jak
konflikt rozstrzygnąłeś, i odtwarza tę odpowiedź następnym razem, gdy pojawi się
identyczny.

**Ustawienia → Git i synchronizacja → Zapamiętuj rozwiązania konfliktów.** Zapisuje
`rerere.enabled` do twojej globalnej konfiguracji gita, więc wiersz poleceń
zachowuje się tak samo.

Kiedy git odpowiedział za ciebie, edytor mówi to wprost, zamiast pokazywać pusty
ekran „brak znaczników konfliktu", i oferuje **Zapomnij to rozwiązanie** — co
kasuje pamięć *i* przywraca konflikt, żebyś mógł rozstrzygnąć go inaczej.

Dwie rzeczy warte wiedzy:

- **Odtworzone rozwiązanie nie trafia do przechowalni**, chyba że włączysz
  *Automatycznie dodawaj odtworzone rozwiązanie do przechowalni*. Zostaw to
  wyłączone: sens tej pauzy polega na tym, że zapamiętana odpowiedź może być
  błędna dla tego konkretnego merge'a, a dodanie jej bez patrzenia to sposób, w
  jaki trafia ona do commita.

  Właśnie dlatego odtworzony plik **zostaje w Plikach w konflikcie**: git
  zapisał treść, ale indeks wciąż trzyma go jako niescalony i dopiero dodanie do
  przechowalni to zamyka. Ruszy go **Dodaj tak, jak jest** w edytorze albo
  **Oznacz wszystkie jako rozwiązane** na liście.
- **rerere nie rozumie każdego konfliktu.** Konflikty typu dodanie/dodanie
  i usunięcie/zmiana nie dostają preimage'u, więc zawsze wracają surowe. Licznik
  w Ustawieniach pokazuje, ile ich naprawdę trzyma, a **Zapomnij wszystkie**
  go opróżnia.

**Zobacz też:** [Radar konfliktów](conflict-radar.md) · [Merge i rebase](merging.md)
