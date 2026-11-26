---
title: Bezpieczeństwo i sekrety
category: Bezpieczeństwo
order: 70
summary: Maskowanie, zabezpieczenia, pęk kluczy — i to, czego Gitcito robić odmawia.
keywords: bezpieczeństwo sekrety maskowanie pęk kluczy tokeny chroniona gałąź duży plik prywatność security secrets masking keychain safeStorage protected branch guard privacy nieczytelne kopia zapasowa części tłumaczenie ścieżek inny komputer nowa maszyna scalanie profili zastępowanie profili wybór eksportu pełna kopia dla zespołu manifest hasło szyfrowanie appimage apparmor sandbox zgłoś problem obrazy w komentarzach piksel śledzący adres ip obrazy z innych witryn kliknij aby wczytać images in comments tracking pixel third-party images click to load
source: 54e884bf6189103cc1a4deb2c87ddaf5a13e7af4
---

# Bezpieczeństwo i sekrety

Gitcito **nie ma żadnego backendu**. Jedyne wywołania sieciowe idą do twojego
hostingu Gita i — jeśli to włączysz — do twojego dostawcy AI.

![Ustawienia bezpieczeństwa](../../screenshots/settings-security.webp)

## Maskowanie sekretów

Wartości w `.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` i spółce
renderują się jako `KEY=••••••` w widokach diffa, pliku i blame — więc
udostępnienie ekranu albo zrzut ekranu nie mogą ich wypuścić.
Materiał podpisujący Apple też się liczy: `*.mobileprovision`,
`*.provisionprofile`, `*.p12` oraz klucze `*.p8` do App Store Connect. `*.cer`
już nie — certyfikat z założenia jest publiczny.

To działa **wyłącznie na wyświetlanie**: nigdy nie zmienia pliku i nigdy nie
zmienia tego, co dodajesz do przechowalni. Przełącznik z okiem odsłania je
w danym widoku. `.env.example`, `.sample` i `.template` są traktowane jak
szablony, a nie jak sekrety.

![Plik .env wyrenderowany z zamaskowaną każdą wartością i przełącznikiem odsłaniania](../../screenshots/secret-masking.webp)

## Zabezpieczenia, zanim narobisz szkód

| Zabezpieczenie | Kiedy |
|---|---|
| **Plik z sekretem** | Commitowanie czegoś, co wygląda na poświadczenie — z *Ignoruj i przestań śledzić* jednym kliknięciem |
| **Duży plik** | Commitowanie przerośniętego bloba (próg w Ustawienia → Bezpieczeństwo) |
| **Śmieci z budowania** | Commit `xcuserdata/`, `DerivedData/` albo `.DS_Store` — z tym samym *Ignoruj i przestań śledzić* jednym kliknięciem |
| **Chroniona gałąź** | Commit prosto na `main`/`master` albo force push na nią |
| **Śledzone sekrety** | Push repozytorium, które *śledzi* plik z sekretem — ostrzeżenie raz na sesję |

## Obrazy w komentarzach

Komentarze do pull requestów i issues piszą inni ludzie, a obraz w jednym z nich to
zapytanie, które twój komputer wysyła do witryny wybranej przez autora. Ta witryna
poznaje twój adres IP i moment, w którym czytasz komentarz — pikselowi śledzącemu nie
potrzeba nic więcej niż prawa do komentowania.

Dlatego aplikacja sama z siebie wczytuje tylko obrazy z samego hostingu: na github.com
jego załączniki, `*.githubusercontent.com` (łącznie z proxy, które GitHub stawia przed
każdym zewnętrznym obrazem we własnym renderowaniu) i jego zasoby; na każdym innym
hostingu jego własny adres, przez https. Każdy inny obraz pokazuje zastępnik z nazwą
domeny i jest pobierany dopiero po kliknięciu — ten jeden obraz, raz. Zapytanie nigdy
nie wysyła nagłówka `Referer`.

| Ustawienie | Co robi |
|---|---|
| **Wczytuj obrazy z innych witryn w komentarzach** (domyślnie wyłączone) | Obrazy z każdej witryny wczytują się bez kliknięcia, jak na stronie hostingu |

Ograniczenia:

- **Hosting i tak cię widzi.** Obraz z samego hostingu — a na GitHubie każdy obraz
  przez jego proxy — to zapytanie do hostingu, który i tak wie, że to konto czyta pull
  request.
- **`raw.githubusercontent.com` i `gist.githubusercontent.com` wczytują się bez
  kliknięcia.** Każdy może tam umieścić plik, więc obraz jest jego — ale serwuje go
  GitHub, a jego autor nie widzi twojego adresu IP ani tego, kiedy czytasz.
- **Prywatne załączniki GitHuba wygasają.** Ich podpisany adres działa kilka minut;
  **Odśwież** na stronie przywraca taki, który przestał się wczytywać.
- **Podgląd pola komentarza** na tych stronach podlega tej samej regule: wklejony link
  do zewnętrznego obrazu nie jest wczytywany, gdy piszesz.
- **Tylko strony pull requesta i issue.** Obrazy w pliku Markdown repozytorium, w
  notatce do wydania czy w wiki to treść twojego repozytorium i wczytują się jak
  dotąd.
- **Link to nie obraz.** Kliknięcie linku w komentarzu otwiera go w przeglądarce, jak
  każdy link w aplikacji.

Komentarz nie może też zablokować ani wywrócić okna: taki, który ma ponad 32 000
znaków albo jest zbudowany tak, by renderer Markdownu pracował całymi sekundami, jest
pokazywany jako zwykły tekst. Jak ograniczana jest reszta komentarza, opisuje
[Pull requesty](pull-requests.md#jak-pokazywane-są-komentarze).

## AppImage i ścieżki, które ją przeżywają

AppImage działa z folderu pod `/tmp` (`/tmp/.mount_…`), który istnieje tylko
wtedy, gdy aplikacja jest otwarta, przy każdym uruchomieniu ma inną nazwę i
leży w katalogu, do którego może pisać każdy lokalny użytkownik. Do wersji
4.37.1 AppImage mogła zapisać ścieżkę wewnątrz tego folderu w dwóch miejscach,
które ją przeżywają: w linku `gitcito` w `PATH` ([CLI](cli.md)) i w ustawieniu
`diff.<name>.textconv` repozytorium ([atrybuty](attributes.md)). Po zamknięciu
aplikacji inny użytkownik tej samej maszyny mógł odtworzyć folder z własnym
programem, który uruchomiłoby twoje następne `gitcito` albo `git diff`.

Teraz Gitcito odmawia obu rzeczy pod AppImage, ostrzega przy starcie o
nieaktualnym linku `gitcito` (z poleceniem w palecie, które go usuwa) i
oznacza nieaktualny konwerter w oknie atrybutów przyciskiem **Usuń**. Widzi
tylko repozytorium, które masz otwarte; żeby znaleźć nieaktualne konwertery
gdzie indziej, uruchom `git config --get-regexp 'diff\..*\.textconv'` w każdym
repozytorium (i z `--global`) i usuń każdy wpis pod `/tmp/.mount_`. Maszyna z
jednym użytkownikiem nie jest narażona, ale nieaktualne wpisy to i tak martwy
balast.

## Pęk kluczy systemu

Tokeny i wpisy [sejfu](vault.md) są szyfrowane pękiem kluczy twojego systemu
(`safeStorage` z Electrona), nigdy kluczem trzymanym w pliku ustawień.

**Nic nie dotyka pęku kluczy, dopóki tego nie powiesz.** Zanim zdąży pojawić się
systemowe okno uprawnień, Gitcito wyjaśnia, co zostanie zapisane, czego nie
potrafi (aplikacja zawsze odczyta wyłącznie wpis, który sama utworzyła — twoje
pozostałe hasła są nieosiągalne) i że odmowa jest w porządku: tokeny żyją wtedy
w pamięci tylko na czas sesji, sejf zostaje zamknięty, a włączyć to możesz
później w **Ustawienia → Bezpieczeństwo → Pęk kluczy systemu**.

Świeża instalacja wykonuje **zero** wywołań do pęku kluczy, dopóki coś naprawdę
nie wymaga zapisania.

Dopóki jest wyłączony, pole tokenu w Integracjach o tym mówi — *Zapisany tylko do zamknięcia Gitcito: systemowy pęk kluczy jest wyłączony.* — z przyciskiem **Włącz** obok. Włączenie go, stamtąd lub stąd, zapisuje też tokeny wpisane już w tej sesji, więc nie trzeba ich wklejać ponownie.

![Pole tokenu w Integracjach przy wyłączonym pęku kluczy: zapisany tylko do zamknięcia, z przyciskiem Włącz](../../screenshots/token-keychain-notice.webp)

Token, który **usuniesz** przy wyłączonym pęku kluczy, znika od razu — nie jest
już z niczym wysyłany — ale tylko **na tę sesję**: zaszyfrowanego magazynu nie
da się zapisać, gdy pęk kluczy jest wyłączony, a usunięcie jest trzymane w
pamięci, nigdy w pliku. Włącz pęk kluczy z powrotem przed zamknięciem, a zapisana
kopia zostanie wtedy usunięta; zamknij wcześniej, a stary token wróci przy
następnym uruchomieniu. Do tego czasu komunikat zostaje widoczny właśnie z tego
powodu. Żeby usunąć zapisany token na dobre w jednym kroku, wyczyść go przy
włączonym pęku kluczy.

Puste pole czyści tylko to, co Gitcito ci pokazał. Gdy pęk kluczy jest wyłączony
od początku, zapisane tokeny nigdy nie są odszyfrowywane ani pokazywane — pola są
puste — więc usuwany jest tylko token, który tam wpiszesz i znowu wyczyścisz;
zapisany pod spodem nadal tam jest po włączeniu pęku kluczy.

Jeśli okno przeładuje się albo ulegnie awarii, gdy objaśnienie pęku kluczy jest
na ekranie, pytanie liczy się jako bez odpowiedzi — nie jako „nie” — i pada
ponownie, gdy następnym razem trzeba będzie zapisać token. Nic nie czeka na
pytanie, na które nikt już nie może odpowiedzieć: ustawienia ładują się znowu
normalnie.

### Linux bez pęku kluczy

Na Linuksie pęk kluczy to usługa sekretów — GNOME Keyring albo KWallet. Gdy żadna
nie działa, system nadal „szyfruje”, ale stałym hasłem, takim samym na każdej
maszynie: tokeny i klucze są zaciemnione, a nie chronione. Ustawienia →
Bezpieczeństwo mówią o tym pod stanem pęku kluczy — *Nie działa żaden pęk
kluczy…* — żeby słowo *pęk kluczy* nigdy nie oznaczało ochrony, której nie ma.

Żeby nic nowego nie trafiło do magazynu, który każdy mógłby odczytać, token
wpisany, gdy nie działa żaden pęk kluczy, jest trzymany **tylko do zamknięcia
aplikacji**. Pole tokenu o tym mówi — *Zapisane tylko do zamknięcia Gitcito: nie
działa żaden pęk kluczy…* — bez przycisku ponowienia, bo ponawianie nic nie da;
pomoże tylko pęk kluczy. Import pliku ustawień z danymi logowania mówi to samo,
zanim je zaimportuje. Tokeny zapisane wcześniej pozostają czytelne — nigdy
nie tracisz do nich dostępu — a wyczyszczenie lub zastąpienie któregoś nadal
usuwa starą wartość z dysku. Dwa ograniczenia: klucz ogólnej SI nie jest
przenoszony do wspólnego miejsca (każdy profil dalej czyta swój), a sejf nadal
zapisuje w podstawowym magazynie, bo nie ma trybu tylko na sesję. Zainstaluj lub
odblokuj pęk kluczy i uruchom Gitcito ponownie, żeby znów zapisywać nowe tokeny.

Gitcito nie wierzy na słowo systemowi, jaki magazyn dostało. Liczy go jako
podstawowy, gdy system tak go nazywa, gdy w ogóle nie potrafi go nazwać i gdy to, co
szyfruje, wraca oznaczone stałym hasłem — cokolwiek powiedział system. Dzięki temu
pęk kluczy, który po cichu się wycofa, i tak trzyma nowe tokeny poza dyskiem.

Na pęk kluczy, który przestaje odpowiadać, nie czeka się w nieskończoność. Na Linuksie,
gdy pęk kluczy raz odpowiedział w tej sesji, pytanie, które zostawi bez odpowiedzi
przez 10 sekund, liczy się jako *brak pęku kluczy*: zapisany token jest trzymany do
zamknięcia, a Sejf zostaje zamknięty. Pierwsze pytanie sesji — to, które może wywołać
własną prośbę pęku kluczy o hasło — i to tuż po wyjaśnieniu Gitcito dostają dwie
minuty, żeby czytanie okna nigdy nie zostało przerwane. Przez pół minuty po takim
przekroczeniu czasu odpowiedź pozostaje *brak pęku kluczy* bez ponownego pytania;
potem Gitcito pyta od nowa. macOS i Windows odpowiadają lokalnie i nigdy nie mają
limitu czasu.

Ten limit dotyczy tylko tego jednego pytania — *czy jest pęk kluczy?* Na pęk kluczy,
który na nie odpowie, a potem zawiesi się przy szyfrowaniu lub odszyfrowaniu, nadal
się czeka: zapisywanie ustawień i Sejf pozostają zajęte, dopóki nie odpowie albo
Gitcito się nie uruchomi ponownie.

### Gdy zapisanych tokenów nie da się odczytać

Jeśli zamkniesz systemowe pytanie o pęk kluczy, pęk kluczy jest zablokowany
albo magazyn tokenów zapisała inna kopia Gitcito (wersja deweloperska,
podpisana na nowo), Gitcito **nie może odczytać twoich zapisanych tokenów — i
zostawia je nietknięte**. Ustawienia → Bezpieczeństwo mówią *Gitcito nie mógł
odczytać twoich zapisanych tokenów*, a token wpisany w międzyczasie jest
trzymany tylko na czas sesji (pole też o tym mówi). Nigdy nie jest zapisywany
na magazyn, którego nie dało się odczytać: zastąpiłoby to każdy zapisany token
tym, który właśnie wpisałeś.

| Przycisk | Co robi |
|--------|--------------|
| **Spróbuj ponownie** | Czyta magazyn jeszcze raz — system może teraz zapytać o pęk kluczy. Gdy da się go odczytać, tokeny wpisane w międzyczasie do niego dołączają. |
| **Utwórz nowy magazyn tokenów** | Najpierw pyta. Gitcito przestaje czekać na stary magazyn i zaczyna nowy tylko z tokenami z tej sesji. Stary plik zostaje obok jako kopia zapasowa przez 30 dni, potem jest usuwany. Dla magazynu utraconego na dobre, nie dla zamkniętego pytania. |

## Import ustawień

**Ustawienia → Import / Eksport** przenosi ustawienia, profile i motywy między
maszynami. Domyślny eksport **nie zawiera tokenów ani kluczy API**, a import
takiego pliku nigdy nie rusza tych, które masz zapisane — pusty token w pliku
oznacza „nie ma go w tym pliku”, a nie „usuń mój”.

### Wybór, co wyeksportować

Kopia zapasowa i plik dla kolegi to nie ten sam plik. Kopia zapasowa chce
wszystkiego; plik dla innego komputera nie powinien zawierać folderów, których
tam nie ma; plik dla zespołu nie powinien zawierać ani twoich kont, ani twoich
ścieżek. Dlatego **Eksportuj ustawienia** otwiera okno z tymi samymi czterema
częściami, które oferuje import (tabela niżej), każdą z jej rozmiarem na tym
komputerze, i zapisuje tylko te, które zaznaczysz. Pominiętej części w ogóle nie
ma w pliku — późniejszy import zostawia tę część drugiej maszyny dokładnie taką,
jaka jest.

![Ustawienia → Dane → Eksport: wybrany „Inny komputer”, zielona uwaga, że plik nie zawiera żadnej ścieżki tej maszyny, i manifest tego, co trafia do pliku](../../screenshots/settings-export.webp)

Trzy skróty nad częściami zaznaczają typowe zestawy. Zmiana pola wyboru ręcznie
podświetla pasujący skrót albo żaden:

| Skrót | Części | Do czego |
|----------|-------|-----|
| **Pełna kopia** | Wszystkie cztery | Odtworzenie tego komputera albo jego kopii — ten sam plik, który Eksport zapisywał, zanim miał części |
| **Inny komputer** | Profile i konta, Preferencje aplikacji | Twoja tożsamość i upodobania na nowej maszynie, bez folderów i programów tej |
| **Dla zespołu** | Preferencje aplikacji | Wspólny motyw, skróty i ustawienia grafu — nic osobistego, żadnych ścieżek |

Pod częściami uwaga mówi, czy plik wymienia foldery lub programy tego
komputera: bursztynowa przy zaznaczonych **Repozytoriach** lub **Programach**
(import na innej maszynie tłumaczy te ścieżki albo pomija te, których nie
znajdzie), zielona bez nich. **Profile i konta** bez **Programów** pomija też
ścieżkę CLI SI, które są zapisane przy profilach, ale wskazują programy tej
maszyny.

**Dane logowania tylko z Profilami i tylko na życzenie.** Tokeny i klucze API
należą do profili, więc **Dołącz klucze API, tokeny i sekrety Sejfu** jest
dostępne tylko przy zaznaczonych **Profile i konta**; odznacz część, a opcja
zostaje wyczyszczona razem z nią. Przy zaznaczonych danych logowania okno
zaleca **Chroń hasłem** (niżej), a eksport bez szyfrowania pyta jeszcze raz.

Ramka na dole wymienia, co będzie zawierał plik, zanim naciśniesz
**Eksportuj…**: ile profili (z danymi logowania lub bez), obrazy profili,
preferencje, ścieżki repozytoriów i programów, czy trafiają tam notatki i wiki
repozytoriów oraz sejf, które części są pominięte i czy plik jest zaszyfrowany.
Co idzie z którą częścią:

| Dodatek | Idzie z | Warunek |
|-------|-----------|-----------|
| Obrazy profili | Profile i konta | Obrazy wybrane jako obraz |
| Sekrety sejfu | Profile i konta | Tylko z opcją danych logowania |
| Notatki i wiki repozytoriów | Repozytoria i obszary robocze | Zawsze z tą częścią |

Ograniczenia: części są całą jednostką — nie da się wybrać pojedynczych
profili, repozytoriów ani preferencji. **Programy** bez **Profili** zabierają
terminal, edytor i domyślne aplikacje, ale nie ścieżki CLI SI (te są w
profilach). Manifest liczy wpisy; nie pokazuje samych ścieżek. A plik bez danej
części nie może jej oddać: odtworzenie pliku **Dla zespołu** przywraca tylko
preferencje.

### Wybór, co zaimportować

Plik ustawień zawiera dwa rodzaje rzeczy: to, co podąża za *tobą* (profile,
motyw, skróty), i to, co ma sens tylko na maszynie, która go zapisała (foldery,
w których leżą twoje repozytoria, ścieżka do terminala). Zastosowanie
wszystkiego na nowym komputerze zapełnia pasek boczny kartami, które nigdzie
nie prowadzą. Dlatego po wybraniu pliku (i wpisaniu hasła, jeśli je ma) okno
pyta, które części przenieść. Nic nie jest stosowane, dopóki nie naciśniesz
**Importuj**; **Anuluj** zostawia wszystko tak, jak było.

![Ustawienia → Dane → Import: cztery części, repozytoria odznaczone, bo żaden z ich folderów tu nie istnieje, i otwarte tłumaczenie ścieżek](../../screenshots/settings-import.webp)

| Część | Co zawiera |
|------|-----------------|
| **Profile i konta** | Profile, tożsamość Gita, powiązania integracji, ogólne ustawienia SI i obrazy profili — a także dane logowania i [sejf](vault.md), jeśli plik je ma |
| **Preferencje aplikacji** | Motyw, język, skróty, układ, kolory grafu i ikon |
| **Repozytoria i obszary robocze** | Karty, obszary robocze, ulubione, przezwiska, obrazki kart, którego profilu używa każde repozytorium, skanowane foldery oraz notatki i wiki poszczególnych repozytoriów |
| **Programy na tym komputerze** | Terminal, zewnętrzny edytor, domyślne aplikacje i ścieżka do CLI SI |

Każda część pokazuje, ile wpisów ma dla niej plik. Część, której nie zaznaczysz,
zostaje dokładnie taka, jaka jest na tej maszynie.

**Profile łączą się z twoimi.** Plik z innego komputera rzadko ma każdy profil,
który ma ten — konto dodane na laptopie z Linuksem, profil klienta, który
istnieje tylko na Macu. Dlatego **Profile i konta** dodaje profile z pliku do
twoich, zamiast zastępować listę. Przed importem część wymienia każdy profil i
to, co się z nim stanie:

| Znacznik | Znaczenie |
|-----|---------|
| **Aktualizacja** | Profil jest w obu miejscach: tożsamość, SI i obraz z pliku zastępują twoje, a jego serwery dochodzą do twoich |
| **Nowy** | Ma go tylko plik: dodany po twoich |
| **Zostaje** | Ma go tylko ten komputer: zostaje dokładnie taki, jaki jest |

Dwa profile są „tym samym”, gdy mają wspólny identyfikator — tak jest z
pierwszym profilem każdej instalacji. Gdy żaden identyfikator się nie zgadza,
liczy się nazwa (bez względu na wielkość liter i otaczające spacje), a profil
zachowuje **identyfikator tego komputera**: powiązane z nim repozytoria, aktywny
profil, jego zapisane dane logowania i obraz pozostają przypięte. To, który
profil jest aktywny, się nie zmienia, i tak samo **ogólna SI**: silnik i model,
którymi odpowiada ten komputer, zostają jego własne.

**Zastąp wszystkie** nadal jest dostępne — dla kopii zapasowej, którą chcesz
odzyskać dokładnie taką, jaka była: zostają tylko profile z pliku, a te, które
ma tylko ten komputer, są wymienione jako przekreślone **Usunięty**.
Naciśnięcie **Importuj** pyta wtedy jeszcze raz, wymieniając je z nazwy —
odchodzą razem z zapisanymi danymi logowania i obrazem, i nie da się tego
cofnąć. Przy **Zastąp wszystkie** aktywnym profilem staje się aktywny profil z
pliku, a ogólna SI z pliku zastępuje tę z tego komputera.

Ograniczenia: dopasowanie odbywa się tylko po identyfikatorze lub dokładnej
nazwie — profil przemianowany po jednej stronie liczy się jako nowy i kończysz z
oboma. Dopasowany profil przejmuje pola z pliku, z trzema wyjątkami, żeby nie
zginęło nic, co ma tylko ten komputer: jego serwery GitHub Enterprise, GitLab i
Bitbucket są **dodawane** do twoich (przy serwerze, który mają oba, wygrywa wpis
z pliku); token, który plik przynosi pusty, zachowuje twój — ale tylko dla tej
samej instancji, więc token nigdy nie trafia do innego Forgejo, innego wystawcy
GitLab ani innej organizacji Azure; a loginy pożyczone z credential helpera tej
maszyny pozostają loginami tej maszyny.

**Domyślne ustawienia to przypuszczenie na podstawie dysku.** Zanim okno się
pokaże, Gitcito sprawdza, czy foldery repozytoriów z pliku istnieją tutaj. Jeśli
nie istnieje żaden, plik pochodzi z innego komputera: **Repozytoria** i
**Programy** startują odznaczone, każda z powodem — ścieżki programów są
wymienione, żebyś widział, że należą gdzie indziej. Jeśli istnieją, to ten sam
komputer (na przykład przywrócona kopia zapasowa), wszystko startuje
zaznaczone, a zielona notka to mówi. Plik bez żadnych repozytoriów jest oceniany
po ścieżkach programów: **Programy** startują zaznaczone tylko wtedy, gdy każda
z nich istnieje tutaj.

Gdy samo sprawdzenie się nie powiedzie, nic nie jest zgadywane: **Repozytoria** i
**Programy** startują odznaczone bez werdyktu, przycisk **Sprawdź ponownie**
pyta dysk jeszcze raz, a **Repozytoriów** nie da się zaimportować, dopóki
sprawdzenie się nie uda. Pozostałe części tak.

**Tłumaczenie ścieżek.** Zaznacz **Repozytoria** dla pliku, którego folderów
brakuje, a otworzy się pole **Tłumacz ścieżki**. Po lewej folder wspólny dla
repozytoriów z pliku (`/home/you/code`); po prawej miejsce, w którym ten folder
jest na tym komputerze, wstępnie wypełnione na podstawie twojego folderu
domowego (`/Users/you/code`). Oba da się edytować — przypuszczenie może być
błędne, a gdy Gitcito nie znajdzie wspólnego folderu, zostawia oba puste do
wpisania. Pasek liczy w trakcie pisania, ile repozytoriów ma teraz tutaj folder,
i wymienia kilka z nich — na zielono znalezione, na czerwono wciąż brakujące.
Zamiana przenosi przezwisko, obrazek karty i profil repozytorium, a także jego
notatki, wiki i wpisy sejfu, więc niczego nie trzeba ustawiać ręcznie od nowa.

Stopka to podsumowuje — *Importuj części: 3 z 4 · foldery: 31* (liczą się też
skanowane katalogi główne i ostatni folder klonowania, dlatego mowa o folderach,
nie o repozytoriach) — a **Importuj** pozostaje wyłączone, dopóki nie zaznaczysz
co najmniej jednej części.

**Importuj pozostaje wyłączone także wtedy, gdy tłumaczenie niczego nie
znajduje.** Przy zaznaczonych **Repozytoriach** i ani jednym folderze
znalezionym pod nowym prefiksem import zostawiłby twoje repozytoria puste; popraw
ścieżki albo odznacz tę część.

Ograniczenia tłumaczenia:

- To **jeden prefiks zamieniony na inny**. Repozytoria, które w pliku leżą pod
  innym folderem albo są tu inaczej rozłożone, nie zostaną znalezione; nie ma
  mapowania dla pojedynczych repozytoriów.
- Przy aktywnym tłumaczeniu **importowane są tylko repozytoria, które wtedy mają
  folder**. Reszta zostaje pominięta — nie jest dodawana jako zepsute karty — a
  okno mówi, ile ich jest.
- Programy nigdy nie są tłumaczone: `/usr/bin/code` nie ma pewnego odpowiednika
  w innym systemie. Zostaw tę część odznaczoną i wybierz je w Ustawieniach.
- Wyczyszczenie któregokolwiek z prefiksów importuje ścieżki tak, jak są w
  pliku.

**W trakcie importu** okna nie da się zamknąć. Jeśli późniejszy krok się nie
powiedzie — notatki repozytoriów, sejf, obrazy profili — okno zostaje
otwarte, nazywa krok, a **Kontynuuj import** wznawia od tego miejsca bez
ponownego zapisywania wcześniejszych kroków.

### Dane logowania w pliku

Plik wyeksportowany z zaznaczoną opcją zawiera dane logowania. Łączenie profili
zawsze je **dodaje**: te z pliku trafiają do pasującego profilu, zastępując te
dla tego samego konta, a wszystkie inne zapisane dane logowania zostają — ich
wyczyszczenie przeczyłoby zachowaniu twoich profili. Gdy profile są ustawione na
**Zastąp wszystkie**, taki plik pokazuje też wybór, tuż pod **Profile i konta**:

| Wybór | Twoje zapisane dane logowania |
|--------|------------------------|
| **Dodaj do moich** | Te z pliku są dodawane, zastępując te dla tego samego konta; wszystkie pozostałe zostają |
| **Zastąp wszystko** | Stają się dokładnie tymi z pliku — każdy zapisany token i klucz API, którego plik nie ma, zostaje usunięty |

Wybór działa razem z profilami: przy odznaczonym **Profile i konta** żadne dane
logowania nie są importowane ani usuwane. Plik wyeksportowany bez tej opcji nie
ma ich do zaoferowania, cokolwiek zaznaczysz. **Zastąp wszystko** pyta jeszcze
raz po naciśnięciu **Importuj**, mówiąc, że każdy zapisany token i klucz API,
którego plik nie ma, zostanie usunięty; **Anuluj** w tym miejscu zostawia okno
tak, jak było.

**Zastąp wszystko wymaga pęku kluczy.** Przy wyłączonym lub niedostępnym pęku
kluczy stare tokeny zostałyby w zaszyfrowanym magazynie i wróciłyby przy
następnym uruchomieniu, więc Gitcito odmawia: mówi o tym i nic nie jest
importowane. To samo dotyczy sytuacji, gdy zapisanych tokenów nie da się
odczytać (zob. wyżej): wróciłyby, gdy tylko stałoby się to możliwe. **Dodaj do moich** nadal
działa i zachowuje tokeny z pliku na czas sesji.

**Ograniczenie:** dane logowania należą do profilu. Profil, który import usuwa,
zabiera ze sobą swoje zapisane tokeny, cokolwiek wybierzesz.

### Ochrona eksportu hasłem

Eksport z zaznaczonymi danymi logowania jest dla każdego, kto znajdzie plik,
wart tyle co same tokeny — zsynchronizowany folder, zapomniany pendrive,
załącznik. **Chroń hasłem** w oknie eksportu szyfruje plik tym samym szyfrem co
[Bezpieczne udostępnianie](secure-share.md) (klucz wyprowadzony przez scrypt i
AES-256-GCM), więc nic w nim — nawet to, czy zawiera dane logowania — nie da się
odczytać bez hasła.

To opcja, z zaznaczonymi danymi logowania lub bez, a hasło nie ma minimalnej
długości. Wpisujesz je dwa razy i zaznaczasz, że rozumiesz, że nie da się go
odzyskać; import pliku o nie prosi — w oknie w Ustawieniach, w kroku powitalnym
przy pierwszym uruchomieniu — a przy błędnym pyta znowu.

![Ustawienia → Dane → Eksport: plik chroniony hasłem, ostrzeżenie o braku możliwości odzyskania potwierdzone](../../screenshots/settings-export-password.webp)

| | Bez hasła | Z hasłem |
|---|---|---|
| **Kto może go odczytać** | Każdy, kto ma plik | Tylko ten, kto zna hasło |
| **Zmieniony bajt** | Odczytany tak, jak jest | Odrzucony, jak błędne hasło |
| **Otwiera się w** | Każdej wersji | Wersjach, które znają format zaszyfrowany |

**Nie ma odzyskiwania.** Hasło nie jest nigdzie przechowywane — ani w pliku, ani
na tej maszynie — i nie ma serwera, którego można by zapytać. Zapomnisz je, a
plik przepada; wyeksportuj ponownie z maszyny, która wciąż ma ustawienia.

Ograniczenia: starsza wersja nie otworzy zaszyfrowanego eksportu, i nawet o tym
nie wie — zgłasza ustawienia jako zaimportowane i niczego nie zmienia.
Importuj chroniony plik wersją, która pyta o hasło. Krótkie hasło pozostaje
słabe wobec kogoś, kto ma plik i czas na zgadywanie; klucz scrypt sprawia, że
każda próba jest wolna, nie niemożliwa. Hasło chroni plik, nie działającą
aplikację: dane logowania są odszyfrowywane w pamięci, gdy są zbierane do
eksportu, jak zawsze.

## Plik ustawień

Plik ustawień i zaszyfrowany magazyn tokenów są zapisywane w całości: do nowego
pliku obok, czytelnego tylko dla właściciela, który potem jest podmieniany, więc
awaria ani dwa zapisy naraz nigdy nie zostawiają połowy pliku. Jeśli plik
ustawień jest dowiązaniem symbolicznym gdzie indziej (repozytorium dotfiles),
zapis trafia do celu dowiązania, a dowiązanie zostaje. Gitcito nigdy nie zastępuje
dowiązania. Takie, które wskazuje plik, którego jeszcze nie ma, jest zapisywane
na wskroś i tworzy ten plik — o ile istnieje jego folder. Gdy folderu też nie
ma, zapis się nie udaje, z jednym komunikatem o tym: dowiązanie i to, na co
wskazuje, zostają nietknięte, a zmiany wprowadzone w międzyczasie trwają tylko do
zamknięcia Gitcito. Przywróć folder albo skieruj dowiązanie w istniejące
miejsce, a następny zapis się powiedzie.

Tokeny w postaci jawnej, które starsza wersja zostawiła w pliku ustawień, nigdy
nie giną przy zapisie: zostają w pliku, dopóki Gitcito nie wczyta ich do
zaszyfrowanego magazynu (robi to otwarcie Ustawień), chyba że sam któryś
wyczyścisz.

Zapisują je tylko dwie rzeczy: zapis twoich ustawień i ich wczytanie przez
Gitcito (przy starcie albo przy otwarciu Ustawień) — wtedy stary token w postaci
jawnej trafia do zaszyfrowanego magazynu albo adres serwera z hasłem w środku
zostaje oczyszczony. Odczyt, o który nikt nie prosił — fetch ustalający swój
token, wywołanie SI szukające swojego klucza, obraz profilu — tylko czyta, więc
nigdy nie może nadpisać zapisu. Zapis jest też odrzucany, dopóki ustawienia nie
zostały wczytane przynajmniej raz: wcześniej aplikacja ma tylko wartości
domyślne.

**Koszt na starej instalacji**, która wciąż ma tokeny w postaci jawnej w pliku
ustawień: dopóki Ustawienia nie zostaną raz otwarte (albo aplikacja nie
uruchomi się ponownie i ich nie wczyta), każdy odczyt, który potrzebuje tokenu,
odszyfrowuje magazyn od nowa, a obrazy profili, które potrzebują zapisanego
tokenu, czekają. Odczyt niczego nie przenosi, więc token wyczyszczony w
międzyczasie pozostaje wyczyszczony.

Plik, który istnieje, ale nie da się go sparsować (nieudana ręczna edycja,
uszkodzony dysk), **nigdy** nie jest zastępowany wartościami domyślnymi: Gitcito
mówi, że plik jest uszkodzony, i nie uruchamia się dalej — żaden skrót ani
polecenie menu nie może z tego ekranu zapisać na nim.

![Ekran startowy dla uszkodzonego pliku ustawień, z przyciskami Spróbuj ponownie oraz Odłóż uszkodzony plik i zacznij od nowa](../../screenshots/settings-damaged.webp)

Możesz poprawić `gitcito-settings.json` w jego folderze danych i nacisnąć
**Spróbuj ponownie** albo nacisnąć **Odłóż uszkodzony plik i zacznij od nowa**:
plik zostaje przemianowany na `gitcito-settings.json.corrupt-<date>` (nigdy nie
jest usuwany, więc wciąż możesz coś z niego odzyskać), obok zostaje kopia
zaszyfrowanego magazynu tokenów, a Gitcito startuje jak za pierwszym razem, z
uwagą, gdzie trafił plik. Przy pliku ustawień będącym dowiązaniem przemianowany
zostaje cel dowiązania, więc uszkodzona kopia zostaje w twoich dotfiles, obok
nowego pliku ustawień, który pierwszy zapis zapisuje potem przez dowiązanie.
Kopia powstaje najpierw: jeśli nie da się jej zapisać, nic nie jest
przenoszone, a ekran o tym mówi i pokazuje folder danych do sprawdzenia, bo
start od nowa bez kopii pozwoliłby pierwszemu zapisanemu tokenowi usunąć tokeny
starych profili. Napraw to, co blokuje zapis do folderu (uprawnienia, pełny
dysk), i naciśnij **Spróbuj ponownie**.

Jeśli plik zepsuje się w trakcie działania Gitcito (edytowany ręcznie pod
spodem), zapisy się zatrzymują i Gitcito mówi o tym raz: ustawień nie da się
zapisać do ponownego uruchomienia, a zmiany wprowadzone w międzyczasie przepadają.

Plik, który jest na miejscu, ale przez chwilę nie da się go *odczytać* — inny
program, na przykład antywirus, go trzyma — jest ponawiany przez około dwie
sekundy. Jeśli nadal się nie udaje albo wczytanie zawodzi z innego powodu,
Gitcito mówi, że nie mógł się uruchomić, że plik nie został zmieniony, i
proponuje **Spróbuj ponownie**; nie nazywa pliku uszkodzonym.

### Znane ograniczenia

Wymagają nietypowych warunków i są wymienione, żeby nikogo nie zaskoczyły:

- **Bardzo stara instalacja z tokenami wciąż w pliku ustawień.** Jeśli pęk
  kluczy zostanie wyłączony po odblokowaniu zapisanych tokenów albo odrzucony,
  gdy klucz SI wciąż jest zapisany w starym formacie jawnym, ta jawna kopia może
  zniknąć przy następnym zapisie, a token przepada po ponownym uruchomieniu. Po
  aktualizacji z takiej wersji otwórz raz Ustawienia przy włączonym pęku kluczy,
  a tokeny na dobre trafią do zaszyfrowanego magazynu.
- **Zapis i nieudane przeładowanie mijające się w tym samym oknie.** Tokenu
  wpisanego w zapisie, który wyprzedza przeładowanie, które potem się nie
  udaje, nie da się wyczyścić z tego okna, dopóki Ustawienia nie wczytają się
  ponownie; otwórz Ustawienia jeszcze raz i go wyczyść.
- **Plik ustawień jako dowiązanie, którego folderu brakuje.** Magazyn tokenów
  jest zapisywany, zanim zapis pliku ustawień się nie uda, więc oba są
  rozsynchronizowane, dopóki folder nie wróci. Przywróć go (zamontuj dysk,
  sklonuj dotfiles) i zapisz ponownie.

## Token profilu podczas działania Gita

Gdy [profil](profiles.md) loguje swoim tokenem clone, fetch, pull albo push,
token nie trafia do żadnego miejsca, z którego mógłby go odczytać inny program:
ani do `.git/config`, ani do wiersza poleceń (każdy lokalny użytkownik może
czytać listę procesów), ani do **środowiska** polecenia git — które dziedziczy
każdy hook, filtr i proces LFS uruchamiany przez git, razem z każdym pakietem
npm, który uruchamia skrypt husky albo lefthook.

Zamiast tego dla każdej operacji Gitcito otwiera własny prywatny punkt końcowy —
gniazdo w folderze, do którego może wejść tylko twój użytkownik (na Windows
nazwany potok z losową nazwą) — i rejestruje pomocnika poświadczeń dla tego
jednego serwera. Gdy git prosi o login, pomocnik się łączy, dowodzi, że należy do
tej operacji, losowym kodem stworzonym tylko dla niej, mówi, o który host i
repozytorium pyta git, i otrzymuje login. Punkt końcowy odpowiada na każde
żądanie operacji — git może pytać więcej niż raz, dla LFS, po przekierowaniu,
dla każdego procesu, który uruchamia — i jest zamykany i usuwany, gdy git
kończy. Hook, który zrzuca swoje środowisko, znajduje kod, nie token.

Czego nadal nie potrafi:

- **Hook nadal może pytać, póki operacja trwa.** Ten kod jest w środowisku gita,
  bo pomocnik to program, który git uruchamia, a git daje każdemu
  uruchamianemu programowi to samo środowisko. Hook napisany tak, by mówić
  protokołem pomocnika, może użyć kodu, by prosić o login, dopóki git nie
  skończy — dokładnie tak hook `pre-push` z git-lfs go dostaje. To dużo mniejsza
  szczelina niż token leżący w zmiennej — nic go nie przeczyta przypadkiem, zrzut
  albo raport awarii pokazuje tylko kod bezużyteczny po zakończeniu gita — ale to
  szczelina.
- **Odpowiada tylko dla serwera, dla którego został otwarty.** Punkt końcowy
  odrzuca każdy inny host, zwykłe żądanie `http`, ścieżkę poza bazą serwera i
  serwer zagnieżdżony pod nią (Data Center pod `/bitbucket` obok GitLaba w
  katalogu głównym) — nawet z właściwym kodem. Push do wielu URL-i dostaje jeden
  punkt końcowy na serwer, każdy z loginem tylko tego serwera. Pod serwerem z
  innym zagnieżdżonym w środku odrzucana jest też ścieżka, którą proxy
  zagnieżdżonego serwera mogłoby skierować do siebie: każdy `;` w niej (Tomcat
  odrzuca `;params`), segment kończący się kropką i nazwa zagnieżdżonej bazy
  inną wielkością liter albo jako przedrostek (`/Bitbucket/`, `/bitbucketx/`) —
  więc grupa na serwerze zewnętrznym, której nazwa zaczyna się od ścieżki
  zagnieżdżonego serwera, też nie dostaje jego tokenu.
- **Wyłączenie nie przetrwa przekierowania po stronie samego serwera.**
  Sprawdzana jest ścieżka, o którą pyta git. Jeśli serwer zewnętrzny sam
  przekieruje żądanie na ścieżkę zagnieżdżonego serwera albo proxy przepisze je
  tam po wysłaniu loginu przez gita, żaden klient tego nie zobaczy.
- **Login odziedziczony przez `git -c` jest odkładany na bok.** Pomocnik
  poświadczeń (albo `include`, który mógłby go dodać) przekazany w
  `GIT_CONFIG_PARAMETERS` — aplikacja uruchomiona z aliasu gita albo przez inny
  git — jest usuwany na czas operacji, więc nigdy nie dostaje tokenu profilu do
  zapisania ani nie jest pytany w niczyim imieniu. Każde inne odziedziczone
  ustawienie `-c` zostaje.
- **Adres serwera trzeba zapisać tak, jak czyta go git.** Gitcito nazywa serwer
  według standardowych reguł URL, git według własnych: nazwa
  umiędzynarodowiona (`bücher.example`), skrót liczbowy (`127.1`, `0x7f.0.0.1`),
  skompresowany albo zmapowany adres IPv6 czy zakodowany znak w hoście to dla
  każdego z nich inny serwer. Gdy w grę wchodzi profil, taki adres jest
  odrzucany z komunikatem, zamiast zostawić go logowaniu samej maszyny.
  Wielkość liter i jawny port domyślny (`:443`) są w porządku.
- **Git starszy niż 2.26** dopasowywał wpis poświadczeń tylko do dokładnego
  adresu, nie do wszystkiego pod bazą serwera. Pytając w niczyim imieniu,
  aplikacja wyłącza wtedy pomocników dla całego hosta na to jedno polecenie;
  logowanie tokenem i tak wymaga gita 2.31.
- **Nie uruchamiaj hooków, którym nie ufasz**, nawet z zalogowanym profilem.
  Świeżo sklonowane repozytorium może przynieść hooki przez narzędzia takie jak
  husky, które instalują je przy `npm install`; git uruchamia to, co leży w
  `.git/hooks`, z Gitcito tak samo jak z terminala, a hook może zrobić dużo
  gorsze rzeczy niż odczytać token.
- **Zawęź zakres tokenu.** Token, który może pisać tylko do repozytoriów, nad
  którymi pracujesz, jest wart dużo mniej dla każdego, kto go przejmie.
- **Zdalne SSH nie są objęte** — żaden token nie jest używany; zamiast tego
  odpowiada [agent SSH](ssh-keys.md).

## Bezpieczne dzielenie się

[Bezpieczne udostępnianie](secure-share.md) eksportuje ustawienia, wpisy sejfu
albo całe przestrzenie robocze jako **zaszyfrowaną paczkę** — sekrety trafiają
do niej wyłącznie wtedy, gdy zaznaczysz checkbox.

## Zgłaszanie problemu

**Zgłoś problem** przy błędzie otwiera wstępnie wypełnione zgłoszenie na
GitHubie — i już samo otwarcie wysyła tekst do GitHuba, zanim zdecydujesz się
je opublikować. Dlatego komunikat jest najpierw czyszczony: zastępowane są dane
logowania wpisane w URL, tokeny, twój folder domowy (a z nim nazwa
użytkownika), prywatne serwery i ścieżki repozytoriów, nazwa profilu, do którego
przypięte jest repozytorium, adresy e-mail i IP. Publiczne hosty, takie jak
`github.com`, zostają, tak samo nazwy plików i własny komunikat gita.

**Ograniczenie:** nazwa serwera stojąca samotnie w zdaniu jest rozpoznawana po
kształcie — z kropkami, małymi literami. Jednowyrazowy host (`gitserver`) jest
wyłapywany tylko w komunikatach pisanych przez samo Gitcito, a serwer w domenie
najwyższego poziomu pisanej jak rozszerzenie pliku (`.sh`, `.md`) zostaje jako
nazwa pliku. I tak przeczytaj zgłoszenie przed publikacją: czyszczenie
rozpoznaje znane kształty, nie wszystko, co prywatne.

## Co zostaje na dysku

Plik ustawień, dziennik operacji, pamięć podręczna awatarów i zaszyfrowany
magazyn tokenów są czytelne tylko dla twojego konta (na macOS i Linuksie).
Adres serwera zapisany z `user:password@` albo `?token=` w środku — z importu
albo starszej wersji — traci tę część przy odczycie, imporcie lub zapisie.
Pamięć podręczna awatarów commitów nie przechowuje adresów e-mail, tylko hasze
solone osobno dla każdej instalacji.

Każdy z tych plików jest zapisywany w całości: do nowego pliku obok, który potem
jest podmieniany, więc awaria ani dwa zapisy naraz nigdy nie zostawiają połowy
pliku — który Gitcito musiałby inaczej uznać za nieczytelny. Kopia zapasowa
magazynu tokenów jest usuwana wcześniej tylko wtedy, gdy każdy token w niej jest
też w bieżącym magazynie; każda inna kopia jest przechowywana 30 dni.

## Pakiety dla Linuksa: sandbox i AppArmor

Sandbox Chromium potrzebuje nieuprzywilejowanych przestrzeni nazw użytkownika.
Ubuntu 24.04 i nowsze odmawiają ich każdemu programowi bez profilu AppArmor,
który na nie pozwala, a oba pakiety dla Linuksa radzą sobie z tym inaczej:

| Pakiet | Co się dzieje |
|---------|--------------|
| `.deb` | Instaluje `/etc/apparmor.d/gitcito`, profil dla `/opt/GitHuttBr/gitcito`, który pozwala na przestrzenie nazw użytkownika. Aplikacja działa w sandboksie. |
| AppImage | Nie ma profilu. Jej program startowy próbuje `unshare -Ur true`, a gdy to się nie uda, uruchamia aplikację z `--no-sandbox` — na Ubuntu 24.04+ to każde uruchomienie. Gitcito wypisuje wtedy ostrzeżenie na wyjście konsoli. |

Żeby uruchomić AppImage w sandboksie, zainstaluj zamiast niej `.deb` albo daj
AppImage własny profil AppArmor, który pozwala na `userns` (albo, dla całej
maszyny, `sysctl kernel.apparmor_restrict_unprivileged_userns=0`, co wyłącza to
ograniczenie dla wszystkiego).

**Ograniczenie profilu `.deb`.** Ma `flags=(unconfined)` z dozwolonym `userns` i
jest przypięty do ścieżki pliku wykonywalnego. Ten sam plik wykonywalny działa
też jako zwykły Node, gdy uruchomi się go z `ELECTRON_RUN_AS_NODE=1` — tak
działają polecenie `gitcito`, dołączony konwerter diffów i pomocnik poświadczeń
Gitcito, więc tego przełącznika nie da się wyłączyć bez ich zepsucia. Razem
oznacza to, że dowolny lokalny program może użyć pliku wykonywalnego Gitcito
jako interpretera Node z prawem tworzenia przestrzeni nazw użytkownika — ten sam
rodzaj luki co znane obejścia ograniczenia Ubuntu przez inne programy z
profilem. Nikomu nie daje to więcej niż prawa jego własnego konta; osłabia
warstwę utwardzenia jądra, którą Ubuntu dokłada na wierzch. AppArmor nie potrafi
rozróżnić dwóch trybów jednego pliku wykonywalnego, więc węższy profil nie jest
możliwy, dopóki CLI go współdzieli; osobny program pomocniczy dla CLI jest na
mapie drogowej. Administratorzy, którzy woleliby tego nie mieć, mogą dodać
regułę deny w `/etc/apparmor.d/local/gitcito`, kosztem sandboksa.

**Zobacz też:** [Sejf](vault.md) · [Bezpieczne udostępnianie](secure-share.md)
