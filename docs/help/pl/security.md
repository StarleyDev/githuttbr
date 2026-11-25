---
title: Bezpieczeństwo i sekrety
category: Bezpieczeństwo
order: 70
summary: Maskowanie, zabezpieczenia, pęk kluczy — i to, czego Gitcito robić odmawia.
keywords: bezpieczeństwo sekrety maskowanie pęk kluczy tokeny chroniona gałąź duży plik prywatność security secrets masking keychain safeStorage protected branch guard privacy
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
| **Śmieci z budowania** | Commit `xcuserdata/`, `DerivedData/` albo `.DS_Store` — z tym samym *Zignoruj i przestań śledzić* jednym kliknięciem |
| **Chroniona gałąź** | Commit prosto na `main`/`master` albo force push na nią |
| **Śledzone sekrety** | Push repozytorium, które *śledzi* plik z sekretem — ostrzeżenie raz na sesję |

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
pomoże tylko pęk kluczy. Tokeny zapisane wcześniej pozostają czytelne — nigdy
nie tracisz do nich dostępu — a wyczyszczenie lub zastąpienie któregoś nadal
usuwa starą wartość z dysku. Dwa ograniczenia: klucz ogólnej SI nie jest
przenoszony do wspólnego miejsca (każdy profil dalej czyta swój), a sejf nadal
zapisuje w podstawowym magazynie, bo nie ma trybu tylko na sesję. Zainstaluj lub
odblokuj pęk kluczy i uruchom Gitcito ponownie, żeby znów zapisywać nowe tokeny.

## Import ustawień

**Ustawienia → Import / Eksport** przenosi ustawienia, profile i motywy między
maszynami. Domyślny eksport **nie zawiera tokenów ani kluczy API**, a import
takiego pliku nigdy nie rusza tych, które masz zapisane — pusty token w pliku
oznacza „nie ma go w tym pliku”, a nie „usuń mój”.

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
profil jest aktywny, się nie zmienia.

**Zastąp wszystkie** nadal jest dostępne — dla kopii zapasowej, którą chcesz
odzyskać dokładnie taką, jaka była: zostają tylko profile z pliku, a te, które
ma tylko ten komputer, są wymienione jako przekreślone **Usunięty**.
Naciśnięcie **Importuj** pyta wtedy jeszcze raz, wymieniając je z nazwy —
odchodzą razem z zapisanymi danymi logowania i obrazem, i nie da się tego
cofnąć. Przy **Zastąp wszystkie** aktywnym profilem staje się aktywny profil z
pliku.

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
odczytać: wróciłyby, gdy tylko stałoby się to możliwe. **Dodaj do moich** nadal
działa i zachowuje tokeny z pliku na czas sesji.

**Ograniczenie:** dane logowania należą do profilu. Profil, który import usuwa,
zabiera ze sobą swoje zapisane tokeny, cokolwiek wybierzesz.

## Bezpieczne dzielenie się

[Bezpieczne udostępnianie](secure-share.md) eksportuje ustawienia, wpisy sejfu
albo całe przestrzenie robocze jako **zaszyfrowaną paczkę** — sekrety trafiają
do niej wyłącznie wtedy, gdy zaznaczysz checkbox.

**Zobacz też:** [Sejf](vault.md) · [Bezpieczne udostępnianie](secure-share.md)
