---
title: Credential helper
category: Bezpieczeństwo
order: 73
summary: Własny magazyn haseł gita — ten trzeci — i dlaczego https ciągle pyta cię od nowa.
keywords: credential helper hasło https pyta znowu osxkeychain wincred manager libsecret store cache git-credentials plaintext zapomnij unieważniony token 401 sprawdź logowanie które konto token w adresie zdalnego repozytorium hasło w url usuń z adresu url token in remote url embedded password invalid username or token authentication failed set-url
source: ec745a4eb35cb3d23b0af6a36d6a540b8254df62
---

# Credential helper

GitHuttBr trzyma trzy różne rodzaje sekretów, a ludzie całkiem rozsądnie zakładają,
że to jedno:

| | Trzymane przez |
|---|---|
| Tokeny API hostingu — PR-y, zgłoszenia, sprawdzenia CI | GitHuttBr, w twoim [pęku kluczy systemu](security.md) |
| Transport `git@…` | Twój [klucz SSH](ssh-keys.md), przez systemowego agenta ssh |
| **Transport `https://`** | **Własny credential helper gita** |

Ten trzeci nie jest w niczyim odczuciu funkcją, dopóki się nie zepsuje — a wtedy
produkuje dwie najczęstsze skargi w gicie: *dlaczego znowu mnie pyta?* i
*dlaczego wciąż wysyła token, który unieważniłem?*

`⌘K` → **Credential helper**.

![Skonfigurowany helper, reguły dla poszczególnych hostów i ostrzeżenie o pliku z hasłami jawnym tekstem](../../screenshots/credentials.webp)

## Na co patrzysz

Każdy skonfigurowany `credential.helper`, w zasięgu, z którego pochodzi —
`system`, `global`, a potem to repozytorium. **Helpery się nakładają**: git pyta
każdy po kolei, a ten na poziomie repozytorium nie zastępuje globalnego.

Każdy jest sprawdzany na twojej maszynie:

| Oznaczenie | Oznacza |
|------|-------|
| **gotowy** | Program helpera istnieje i się uruchomi |
| **niezainstalowany** | Skonfigurowany, ale programu brakuje — każde pytanie kończy się ponownym wpisywaniem |
| **hasła w jawnym pliku** | Helper `store` (patrz niżej) |

**Reguły dla konkretnych hostów** wypisuje sekcje `credential.<url>.*`. Biją one
zwykłe ustawienie dla adresów, do których pasują, i są zwykle odpowiedzią na
„dlaczego akurat ten host zachowuje się inaczej".

## Wybieranie

| Helper | Dokąd trafia hasło |
|--------|------------------------|
| `osxkeychain` | Pęk kluczy macOS — zaszyfrowany, per użytkownik |
| `manager` | Git Credential Manager (Windows, wieloplatformowy) |
| `wincred` | Menedżer poświadczeń Windows |
| `libsecret` | Linuksowa usługa sekretów (GNOME Keyring, KWallet) |
| `cache` | Pamięć, na 15 minut. Nic na dysku |
| `store` | **Zwykły plik w twoim katalogu domowym. Bez szyfrowania** |

GitHuttBr oferuje to, co faktycznie jest na tej maszynie zainstalowane, zaznacza
ten pasujący do twojego systemu i wyszarza resztę.

**Zasięg ma znaczenie.** *Dla każdego repozytorium* zapisuje do twojej globalnej
konfiguracji, i tego prawie zawsze chcesz; *tylko dla tego repozytorium* jest
dla tego jednego dziwnego repozytorium, które uwierzytelnia się gdzie indziej.

## Helper `store` i `~/.git-credentials`

`store` zapisuje linie `https://user:password@host` do `~/.git-credentials`,
jawnym tekstem, bez jakiegokolwiek szyfrowania. Odczyta to wszystko, co działa
z twoimi uprawnieniami: skrypt, postinstall jakiejś zależności, cokolwiek.

Jeśli ten plik istnieje, ta strona mówi o tym i liczy wpisy. Nigdy ich nie
pokazuje — liczba jest tu całym sensem, a odczytanie zawartości po to, żeby ją
wyświetlić, byłoby dokładnie tym samym błędem.

Jeśli taki plik znajdziesz, a nie było to zamierzone: wybierz tutaj prawdziwy
helper, a potem skasuj plik i uwierzytelnij się raz od nowa.

## Zapominanie zapisanego poświadczenia

Kiedy token zostaje unieważniony albo zrotowany, helper dalej podaje stary,
a każdy push wysypuje się z 401, które nic nie nazywa. **Zapomnij** prosi
skonfigurowany helper o wymazanie swojego wpisu dla tego hosta —
`git credential reject`, czyli udokumentowana droga samego gita.

Nic po drodze nie jest odczytywane: GitHuttBr nigdy nie wywołuje
`git credential fill`, polecenia, które wypisałoby żywe hasło na standardowe
wyjście.

Następny push zapyta cię raz, a helper zapamięta nową odpowiedź.

## Którego konta używa push

Każdy adres URL push jest sprawdzany osobno. Zakres zapisu to tylko możliwość tokenu. Członkostwo w repozytorium, reguły gałęzi i uprawnienie do zmiany konkretnego pliku nie są testowane. Publiczny odczyt może się udać bez poświadczeń.

![Sprawdzanie logowania zdalnego repozytorium](../../screenshots/remote-sign-in.webp)

Push może się zalogować na kilka sposobów: tokenem profilu, logowaniem GitHub CLI
powiązanym z profilem, helperem samego gita, hasłem zostawionym w adresie zdalnego
repozytorium albo kluczem SSH. Gdy zostanie odrzucony, najpierw trzeba wiedzieć,
którego z nich użył. Kliknij prawym przyciskiem zdalne repozytorium w panelu bocznym i
wybierz **Sprawdź logowanie…** (albo *Sprawdź logowanie zdalnych repozytoriów* w
palecie poleceń). Sprawdzenie ustala poświadczenie tak samo jak push, a potem pyta o
nie hosting:

| Pokazuje | Skąd pochodzi |
|----------|--------------------|
| Źródło i [profil](profiles.md) za nim | To samo pierwszeństwo, które stosuje push — profil powiązany z repozytorium, inaczej aktywny, inaczej helper gita |
| Konto | Odpowiedź samego hostingu (`/user`), a nie to, co wpisano w Ustawieniach |
| Zakresy | Nagłówek `X-OAuth-Scopes` GitHuba; opis, jaki GitLab podaje dla własnego tokenu |
| Na co pozwalają | Zakresy tokenu związane z zapisem (`repo` na GitHubie, `write_repository` na GitLabie), a na GitHubie, czy `.github/workflows` może się zmienić |

Wskazuje też poświadczenie, które hosting odrzuca (wygasłe lub unieważnione), powiązane
konto, które nie jest już zalogowane, oraz hasło zapisane zwykłym tekstem w adresie
zdalnego repozytorium.

**Ograniczenia.** Szczegółowy token GitHuba nie wymienia swoich uprawnień, więc to, czy
może robić push, pokazuje się jako nieznane, dopóki push nie spróbuje. Forgejo podaje
konto, ale nie uprawnienia tokenu. Azure DevOps i Bitbucket są pokazywane tylko ze
źródłem i profilem. Zdalne repozytoria SSH nie są testowane, ale
[Klucze SSH](ssh-keys.md) wymieniają, co trzyma agent. Sprawdzenie pyta helper gita po
cichu: helper, który potrzebowałby okna logowania, liczy się jako pusty.

## Hasło zapisane w adresie zdalnego repozytorium

Stary klon albo adres URL wklejony z wiki może nieść poświadczenie w samym adresie:
`https://user:token@git.example.test/team/app.git`. **Hasło w adresie URL zawsze ma
pierwszeństwo:** git je wysyła i nie pyta żadnego helpera — ani tokenu
[profilu](profiles.md) repozytorium, ani GitHub CLI, ani magazynu samego gita. Dopóki
token działa, wszystko w porządku i GitHuttBr go nie rusza: **nigdy nie usuwa hasła z
adresu URL bez pytania.** Gdy token zostanie unieważniony albo wygaśnie, każdy fetch,
pull i push tego jednego repozytorium kończy się błędem *Invalid username or token*
albo *Authentication failed*, a pozostałe repozytoria z tym samym profilem działają. A
token leży zwykłym tekstem w `.git/config` repozytorium.

![Usuwanie zapisanego tokenu z adresu zdalnego repozytorium](../../screenshots/remote-url-token.webp)

GitHuttBr czyta adresy fetch i push każdego zdalnego repozytorium i mówi o tym w trzech
miejscach:

| Gdzie | Co widzisz |
|-------|--------------|
| Nieudany fetch, pull lub push | Błąd wyjaśnia, że adres zdalnego repozytorium zawiera zapisane hasło, z **Usuń z adresu URL…** |
| Panel boczny | Dyskretna ikona klucza w wierszu zdalnego repozytorium: jego adres zawiera hasło, które ma pierwszeństwo przed tokenem profilu. Ta sama akcja jest w jego menu kontekstowym |
| **Sprawdź logowanie…** | Zdalne repozytorium pokazuje hasło jako swoje źródło, z tym samym przyciskiem |

Akcja najpierw pyta. Usuwa hasło z każdego adresu tego zdalnego repozytorium — adresu
fetch i każdego adresu push, który je zawiera — i nie zapisuje niczego poza
`.git/config`. Co dzieje się potem, zależy od tego, co jeszcze może się zalogować:

| Po usunięciu | Czego używają fetch i push |
|---------------|-------------------------|
| Profil repozytorium ma token lub powiązane konto dla tego hostingu | Tego tokenu — potwierdzenie nie mówi nic więcej |
| Brak tokenu profilu, ale helper samego gita ma logowanie dla hostingu | Logowania helpera |
| Żadne z nich | Niczego: fetch i push zawodzą, dopóki nie dodasz tokenu. Potwierdzenie mówi to najpierw i proponuje **Najpierw dodaj token**, co otwiera Ustawienia → Integracje |

Gdy została uruchomiona z nieudanej operacji, proponuje **Spróbuj ponownie**.

**Celowo nie ma cofania.** Cofnięcie zapisałoby sekret z powrotem w pliku zwykłym
tekstem, a właśnie temu akcja ma zapobiegać. Jeśli stary token mógłby jeszcze działać,
unieważnij go na serwerze: był czytelny dla wszystkiego, co mogło czytać folder
repozytorium.

**Ograniczenia.**

- Znika też nazwa użytkownika (`https://git.example.test/…`), jak przy ręcznym
  `git remote set-url`; potwierdzenie to mówi. Serwer, który potrzebuje jej w adresie
  — token Bitbucket Data Center bez nazwy użytkownika w profilu — wymaga dodania jej z
  powrotem przez **Edytuj zdalne repozytorium…**.
- Sama nazwa użytkownika (`https://user@host/…`) nie jest oznaczana: git nadal pyta
  helper o hasło tego użytkownika, więc nic tajnego nie jest zapisane.
- Adresy SSH zostają nietknięte: `git@host:…` i `ssh://git@host/…` wskazują login,
  którego używa ssh, a nie poświadczenie.
- Prefiks zdalnego helpera (`persistent-https::https://…`, `gcrypt::…`) jest
  zachowywany; adres za nim jest czytany i czyszczony jak każdy inny.
- **Niejednoznaczne adresy nie są proponowane do usunięcia.** Gdy czytniki nie zgadzają
  się, gdzie zaczyna się host — `@` po `?` lub `#` w adresie albo hasło z niezakodowanym
  `/` —, cięcie przy złym `@` skierowałoby zdalne repozytorium na inny serwer. Taki
  adres jest pokazywany tylko zamaskowany, a ikona klucza otwiera **Edytuj zdalne
  repozytorium…**, żebyś poprawił go ręcznie.
- Czytany i zmieniany jest tylko `.git/config`. Adres przepisany przez regułę
  `url.<base>.insteadOf` albo zdalne repozytorium zdefiniowane w twojej globalnej
  konfiguracji nie są sprawdzane — a zmiana nazwy zdalnego repozytorium nigdy nie
  kopiuje do konfiguracji repozytorium hasła, które dodaje reguła `insteadOf`.
- Hasło nigdy nie opuszcza procesu głównego: adresy zdalnych repozytoriów docierają do
  okna, menu kopiowania adresu i okna edycji bez niego. Zapisanie okna edycji z
  pokazanym adresem niczego nie zmienia i zachowuje hasło; **zmiana hosta lub ścieżki
  je usuwa**, bo wpisany adres jest zapisywany tak, jak jest. Tylko ta akcja usuwa hasło,
  zachowując adres.

## Ograniczenia warte wiedzy

- **To magazyn gita, nie GitHuttBr.** Zmiana tutaj zmienia też to, co robi twój
  terminal — i o to chodzi, ale warto o tym wiedzieć, zanim się coś zmieni.
- **Helpery z poziomu systemu są pokazywane, ale nieedytowalne.** Mieszkają
  w konfiguracji, do której zapisać może tylko administrator.
- **GitHuttBr nie potrafi wypisać tego, co helper trzyma.** Żadne API poświadczeń
  nie wystawia tego bez oddania samych sekretów, więc to okno raportuje
  konfigurację, wymazuje na żądanie i nic poza tym.
- **Token, który dałeś GitHuttBr, jest osobny.** Unieważnienie jednego nie rusza
  drugiego; stronę pęku kluczy opisuje [bezpieczeństwo](security.md).
- **Token profilu pozostaje poza środowiskiem hooków repozytorium.** Hook widzi tylko
  kod do prywatnego punktu dostępu, ważny, dopóki działa to polecenie gita —
  wystarczający dla hooka, który celowo pyta, jak robi to git-lfs. Zob.
  [token profilu podczas działania gita](security.md#token-profilu-podczas-działania-gita).

Zobacz też: [Bezpieczeństwo](security.md) · [Klucze SSH](ssh-keys.md) ·
[Synchronizacja](syncing.md)
