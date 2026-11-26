---
title: Strona pull requestów
category: Synchronizacja i wiele repozytoriów
order: 57
summary: Wszystkie pull requesty repozytorium na jednej stronie — według stanu, filtrowane po autorze, recenzencie, celu i CI —, ‹ ›, by przechodzić przefiltrowaną listę z wnętrza PR, jego commity oraz komentarze do wiersza jego diffa.
keywords: pull requesty lista strona merge requesty pr mr filtr autor recenzent moje czekają na moją recenzję proszą mnie o recenzję ci nie przechodzi gałąź docelowa szkice scalone zamknięte szukaj triage poprzedni następny alt strzałka nawigacja checkout przejdź do gałęzi źródłowej docelowej kopiuj nazwę gałęzi fetch komentarz do wiersza komentarz inline komentarz recenzji komentarz w diffie skomentuj wiersz zakładka pliki code review line comment zakładka commity lista commitów commity pr historia commitów otwórz commit kopiuj sha pobierz gałąź pr edytor markdown pasek narzędzi podgląd wzmianka commits tab commit list open commit copy sha markdown editor toolbar preview mention
source: c269e43eb3dc0b9f86141af27ef39b50e5550953
---

# Strona pull requestów

Ruchliwe repozytorium ma naraz dwadzieścia otwartych pull requestów. Panel boczny
je wymienia, ale jedna linijka na każdy mówi niewiele: czyj jest który, które
czekają na ciebie, które zrobiły się czerwone. Żeby się dowiedzieć, trzeba było
otwierać każdy, czytać, wracać, otwierać następny. **Strona pull requestów**
odpowiada na te pytania na jednym ekranie, a gdy otworzysz pull request,
**‹ ›** przeniosą cię do następnego z tej samej listy bez wracania.

![Strona pull requestów z wyszukiwaniem „pix”: dopasowania podświetlone, twoje oznaczone „ty”, nieprzechodzące CI i szkic](../../screenshots/pull-requests.webp)

## Jak ją otworzyć

- **Ikona listy** w nagłówku **PULL REQUESTY** panelu bocznego (*Zobacz wszystkie
  pull requesty*).
- *Pull requesty…* w palecie poleceń (⌘K) albo **Narzędzia → Pull requesty…**.

Podobnie jak wiki i [przebiegi CI](ci-runs.md), strona otwiera się w karcie
repozytorium.

## Zakładki

| Zakładka | Co zawiera |
|---|---|
| **Otwarte** | Wszystkie otwarte pull requesty, łącznie ze szkicami |
| **Szkice** | Tylko otwarte oznaczone jako szkic |
| **Scalone** | Scalone pull requesty, wczytywane przy pierwszym otwarciu zakładki |
| **Zamknięte** | Zamknięte bez scalenia (odrzucone, porzucone), wczytywane razem ze Scalonymi |

Liczniki przy Otwartych i Szkicach pochodzą z listy, którą panel boczny już ma.
O Scalone i Zamknięte aplikacja pyta dopiero, gdy otworzysz jedną z nich, i raz
na sesję; **Odśwież** pyta ponownie.

## Filtry

| Filtr | Zostawia |
|---|---|
| **Szukaj** | Pull requesty, których tytuł, opis, gałęzie lub numer zawierają każde wpisane słowo. `#482` albo `482` znajduje ten numer; dopasowania są podświetlone w tytule |
| **Autor** | Jednego autora — każdy z liczbą swoich PR w tej zakładce. **Ja** jest na początku |
| **Recenzent** | Jednego poproszonego recenzenta albo **Proszą mnie o recenzję** |
| **Gałąź docelowa** | Pull requesty do tej gałęzi |
| **Moje** | Skrót dla *Autor: Ja* |
| **Czekają na moją recenzję** | Skrót dla *Recenzent: proszą mnie o recenzję* |
| **CI nie przechodzi** | Pull requesty, których testy na headzie nie przeszły |

Linijka pod filtrami mówi, ile pull requestów z zakładki jest widocznych i które
filtry są włączone, z **wyczyść filtry**, by usunąć wszystkie.

Filtry są pamiętane dla każdego repozytorium **dopóki aplikacja działa** — wyjdź
ze strony, wróć, są takie, jak je zostawiłeś. Celowo nie są zapisywane między
uruchomieniami: filtr „moje, CI nie przechodzi” przywrócony po cichu tydzień
później ukryłby pull requesty, których nie prosiłeś ukrywać.

### Kim jest „ja”

„Ja” to konto, którym wywołania tego repozytorium logują się na hostingu —
profil, z którym repozytorium jest [powiązane](profiles.md), a w przeciwnym razie
aktywny — ustalone u samego hostingu. Gdy token nie potrafi powiedzieć, czyj
jest (brak zakresu użytkownika), albo nie ma tokenu, **Ja**, **Moje** i **Czekają
na moją recenzję** nie są oferowane.

## Lista

| Kolumna | Co pokazuje |
|---|---|
| **#** | Numer z ikoną: otwarty, szkic, scalony lub zamknięty |
| **Tytuł** | Tytuł, plakietkę *szkic* i kogo nadal poproszono o recenzję — w kolorze akcentu, gdy chodzi o ciebie |
| **Autor** | Obrazek z hostingu, jeśli go podaje, w przeciwnym razie inicjał, oraz **ty** przy twoich |
| **Gałęzie** | Źródło → cel |
| **Testy** | Zbiorczy stan testów heada — `6/6`, `1 błędnych`, `2 w toku`; najedź, by zobaczyć liczby |
| **Zmieniono** | Jak dawno ostatnio się zmienił; najedź, by zobaczyć datę |

Wiersze są posortowane według ostatniej aktywności. Kliknięcie otwiera własną
stronę pull requesta ([Hosting i pull requesty](hosting.md)). Na hostingu bez
takiej strony wiersz otwiera pull request w przeglądarce.

W [checkoucie forka](hosting.md#twoje-pull-requesty-w-repozytorium-nadrzędnym-forka) wymienione są też twoje pull requesty w
repozytorium nadrzędnym, oznaczone *w owner/repo*.

## Przechodzenie listy z poziomu pull requesta

![Pull request otwarty z przefiltrowanej listy: ‹ 1 z 4 › i filtry, z których pochodzi](../../screenshots/pull-request-nav.webp)

Pull request otwarty ze strony pokazuje pasek nad swoim tytułem:

- **← Pull requesty** wraca do listy, z filtrami takimi, jak je zostawiłeś.
- **‹ k z n ›** przechodzi do poprzedniego lub następnego pull requesta z listy,
  z której go otworzyłeś — przefiltrowanej, w jej kolejności, takiej jak w chwili
  kliknięcia. Podpowiedzi podają pull request, do którego prowadzi każda
  strzałka.
- **Alt+← / Alt+→** robią to samo z klawiatury. Można je zmienić w **Ustawienia →
  Skróty**. Ustępują, gdy kursor jest w polu tekstowym (gdzie Option+← przeskakuje
  o słowo) i gdy terminal ma fokus.

Przejście podmienia stronę w miejscu, więc przejrzenie dziesięciu pull requestów
nie zostawia dziesięciu ikon na karcie; otwarcie innego wiersza z listy również
ją podmienia.

Pull request otwarty **z dowolnego innego miejsca** — z panelu bocznego, z
powiadomienia — przechodzi przez otwarte pull requesty repozytorium w domyślnej
kolejności strony (Otwarte, bez filtrów). Taki, którego nie ma też na tej liście,
na przykład scalony poziom stosu, pokazuje tylko drogę powrotną do listy.

## Przejście do gałęzi pull requesta

Żeby pracować nad pull requestem, potrzebujesz jego gałęzi w checkoucie — a w
repozytorium z tysiącami gałęzi znalezienie jej po nazwie na liście gałęzi to
najwolniejsza część. Na stronie pull requesta pole **Gałęzie** robi to za ciebie:

- **Nazwa gałęzi jest linkiem.** Kliknięcie robi checkout tej gałęzi i przenosi
  cię do grafu repozytorium, na czubek gałęzi. Strona pull requesta zostaje
  otwarta na karcie.
- **Gałąź, która istnieje tylko na serwerze**, jest najpierw pobierana — tylko ta
  jedna gałąź, nie cały remote — i wyciągana jako gałąź lokalna, która ją śledzi.
  Na gałąź, którą masz już lokalnie, następuje przełączenie bez zmian — nie jest
  aktualizowana, więc zrób pull, gdy chcesz najnowszych commitów pull requesta.
- **Gałąź, na której już jesteś**, jest zamiast tego oznaczona jako *bieżąca*.
  Nic nie jest wyciągane.
- **Przycisk kopiowania** obok każdej nazwy kopiuje ją do schowka.
- **Cofnij** (⌘Z) wraca na gałąź, na której byłeś, i usuwa gałąź lokalną
  utworzoną przez checkout — chyba że od tego czasu coś na niej zacommitowałeś;
  wtedy zostaje nietknięta.

Nagłówek ma te same dwa ruchy jako przyciski: **Przejdź do gałęzi źródłowej** i
**Przejdź do gałęzi docelowej**. Działają też dla gałęzi, na której już jesteś —
po prostu przenoszą cię do repozytorium.

Nic nie jest sprawdzane, dopóki nie klikniesz: otwarcie pull requesta nie czyta
ani nie pobiera żadnej gałęzi.

Czego to nie robi:

- **Gałąź źródłowa forka** jest w innym repozytorium, więc nie ma linku (przycisk
  kopiowania zostaje). **Podejrzyj pull requesta lokalnie…**, oferowane tuż pod
  nią, to sposób na uruchomienie go tutaj. Gałąź docelowa nadal jest linkiem.
- **Brak pasującego remote.** Gałąź jest szukana na remote, którego URL to
  repozytorium pull requesta. Gdy żaden skonfigurowany remote tam nie wskazuje,
  link nic nie robi, a jego podpowiedź mówi dlaczego.
- **Usunięta gałąź.** Scalony pull request często zabrał ze sobą swoją gałąź;
  fetch mówi wtedy, że gałąź już nie istnieje na remote, a ty zostajesz przy pull
  requeście.
- **Lokalne zmiany.** Checkout nie jest destrukcyjny, więc nie ma potwierdzenia —
  a git odmawia checkoutu, gdy twoje niezacommitowane zmiany zostałyby
  nadpisane. Błąd podaje, które pliki; zacommituj je lub odłóż do stasha i kliknij
  ponownie.
- **To okno.** Checkout odbywa się w katalogu roboczym tego repozytorium. Gdy
  gałąź jest już wyciągnięta w innym [worktree](worktrees.md), zamiast tego
  otwiera się karta tego worktree.

## Commity

Panel boczny mówił, ile commitów ma pull request, nigdy które. Recenzowanie po
jednym commicie — tak, jak większość pull requestów powinna być czytana —
odsyłało cię do przeglądarki. Zakładka **Commity**, między Rozmową a Plikami, je
wymienia:

- **Najstarsze najpierw**, w kolejności, w jakiej się nakładają, pogrupowane pod
  dniem, w którym je napisano. Commit wciągnięty rebase’em poza kolejnością dat
  zaczyna własny dzień, zamiast zostać przesunięty.
- Każdy wiersz ma obrazek autora (jeśli hosting go podaje), temat, autora, jak
  dawno temu i krótki SHA. Plakietka **merge** oznacza commit z dwoma rodzicami,
  jeśli hosting to podaje.
- **▸** obok commita, który ma coś więcej niż temat, pokazuje resztę jego opisu.
- **Kopiuj** umieszcza pełny SHA w schowku; **Otwórz w przeglądarce** otwiera
  commit na hostingu — w pull requeście, jeśli hosting ma taką stronę (GitHub,
  GitLab, Bitbucket Data Center), a w przeciwnym razie na stronie commita w
  repozytorium.

![Zakładka Commity: commity pull requesta pogrupowane według dni, jeden z otwartym pełnym opisem](../../screenshots/pr-commits.webp)

**Kliknij wiersz** — albo dojdź do niego Tabem i naciśnij Enter — żeby otworzyć
commit w aplikacji, jak zrobiłoby to kliknięcie w grafie: widok repozytorium, ten
commit zaznaczony, jego szczegóły otwarte. To działa, gdy ten klon **ma** commit.
Gdy go nie ma, wiersz to mówi, zamiast po cichu zawieść, i proponuje:

- **Pobierz gałąź PR, aby go zobaczyć** — ten sam fetch jednej gałęzi co przy
  [przejściu do gałęzi](#przejście-do-gałęzi-pull-requesta), bez checkoutu. Jeśli commit przyszedł razem z
  nią, otwiera się; jeśli nie (force push go od tego czasu przepisał), mówi to
  powiadomienie.
- **Otwórz w przeglądarce**, gdy pobieranie nie wchodzi w grę.

Lista jest wczytywana przy pierwszym otwarciu zakładki, nie razem ze stroną, i
ponownie przy każdym **Odśwież**. Dopóki nie dotrze, licznik zakładki to ten, który
hosting podał dla pull requesta. Scalone i zamknięte pull requesty wymieniają swoje
commity tak samo.

Czego to nie robi:

- **Najwyżej 250 commitów.** Sam GitHub nie wymienia ich dla pull requesta więcej
  niż 250; aplikacja zatrzymuje się na tej samej liczbie na każdym hostingu i mówi
  *host ma ich więcej*, gdy tak jest, z linkiem do pull requesta na hostingu. Które
  250 to będą, zależy od kolejności, w jakiej hosting je wymienia — aplikacja
  zostawia pierwsze wymienione, a linijka nad listą mówi które:

  | Hosting | Dłuższy pull request pokazuje |
  |---|---|
  | GitHub | **Pierwsze** 250 (własny limit GitHuba) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | **250 najnowszych** |
  | Forgejo | Ten koniec, który serwer wymienia najpierw; jego kolejność nie jest udokumentowana |
- **Gałęzi forka** nie da się stąd pobrać — jest w innym repozytorium —, więc
  commit obecny tylko w forku proponuje wyłącznie przeglądarkę. **Podejrzyj pull
  requesta lokalnie…** to sposób, żeby go ściągnąć.
- **Usunięta gałąź.** Scalony pull request często zabrał ze sobą swoją gałąź: fetch
  to mówi. bitbucket.org nie wymienia żadnych commitów, gdy gałęzi źródłowej już nie
  ma.
- **Scalenia squash.** Commity pull requesta scalonego przez squash nigdy nie
  trafiły do gałęzi docelowej, więc po usunięciu jego gałęzi są już tylko na
  hostingu.
- **Autorzy** są nazywani tak, jak nazywają ich commity. GitLab, Azure DevOps i
  Bitbucket Data Center nie dają obrazka bez logowania, którego obrazek nie może
  wysłać, więc te wiersze pokazują inicjał.
- **Długie opisy na Azure DevOps** mogą być przycięte: lista Azure obcina opis
  commita, a aplikacja pokazuje to, co dostaje.
- Pull requesty z **bitbucket.org** otwierają się w przeglądarce — aplikacja nie ma
  jeszcze dla nich strony —, więc do tej zakładki się tam nie dochodzi, choć
  aplikacja potrafi odczytać listę.

## Komentowanie wiersza

Odpowiadać na wątek recenzji dało się tu już wcześniej; zaczynać nowego nie, więc
prawdziwa recenzja wciąż odsyłała cię do przeglądarki. W zakładce **Pliki** pull
requesta każdy wiersz diffa przyjmuje własny komentarz:

- **Najedź na wiersz** i naciśnij **+**, który pojawia się nad jego numerem, albo
  **kliknij sam wiersz** (kliknięcie kończące zaznaczenie tekstu albo podwójne
  kliknięcie zaznaczające słowo się nie liczy — to czytanie). Menu prawego
  przycisku — lub klawisz menu kontekstowego — też ma *Skomentuj wiersz N*.
- **Pod tym wierszem** otwiera się pole. Napisz, potem **Skomentuj** — albo
  ⌘/Ctrl+Enter. **Anuluj** je zamyka; **Esc** też, pytając najpierw, jeśli coś już
  wpisano. Tak czy inaczej fokus wraca na ten wiersz.
- Po powodzeniu nowy wątek pojawia się **pod swoim wierszem** oraz w wątkach
  recenzji zakładki Rozmowa, gdzie zobaczą go wszyscy inni.

![Komentarz pisany pod zmienionym wierszem, z wcześniejszym wątkiem pod jego własnym wierszem](../../screenshots/pr-line-comment.webp)

Strona, po której ląduje komentarz, wynika z wiersza:

| Wiersz | Zakotwiczony w |
|---|---|
| **Dodany** (zielony) | Nowej wersji pliku, pod jej nowym numerem |
| **Usunięty** (czerwony) | Starej wersji, pod jej starym numerem |
| **Niezmieniony** | Nowej wersji (GitLab dostaje oba numery, bo tego wymaga) |

Istniejące wątki również są rysowane pod swoimi wierszami, z polem odpowiedzi tam,
gdzie hosting pozwala aplikacji odpowiadać w wątku (Forgejo nie). Wątek trafia na
wiersz tylko wtedy, gdy hosting mówi, że nadal należy do pokazanego diffa; wszystko
inne zostaje w zakładce Rozmowa, zamiast lądować na zgadniętym wierszu:

| Hosting | Wątek napisany przed ostatnim pushem |
|---|---|
| GitHub | Nieaktualny, gdy jego wiersz się zmienił: tylko Rozmowa |
| GitLab | Napisany do starszego heada: tylko Rozmowa |
| Azure DevOps | Azure przenosi go tam, gdzie jest teraz jego wiersz |
| Bitbucket Data Center | Osierocony, gdy jego wiersza już nie ma: tylko Rozmowa |
| Forgejo | Forgejo nie mówi, że komentarz jest nieaktualny, więc jest rysowany pod zapisanym numerem wiersza — po pushu w tym wierszu może być teraz inny kod |

Komentarz do wiersza spoza pokazanych hunków jest na każdym hostingu tylko w
zakładce Rozmowa.

Komentarz wpisany i niewysłany liczy się jako niewysłany tekst: **‹ ›** i
Alt+strzałki pytają, zanim go opuszczą, tak jak przy głównym polu komentarza.
Przejrzenie innego pliku go zachowuje; żeby zacząć komentarz w innym wierszu, wyślij
lub anuluj pierwszy.

Czego to nie robi:

- **Jeden wiersz, wysłany od razu.** Nie ma zakresu wierszy, oczekującej recenzji, w
  której zbiera się komentarze do późniejszego wysłania, ani proponowanych zmian.
  Każdy komentarz jest publikowany w chwili wysłania, jako osobny wątek (na Forgejo
  jako recenzja z tym jednym komentarzem, bo Forgejo nie ma wywołania dla
  pojedynczego komentarza).
- **Diff, który oglądasz.** Zakładka Pliki pamięta, przy którym commicie (na Azure
  DevOps: przy której iteracji) wczytano jej diff, i komentarz jest wysyłany
  względem niego. Gdy pull request od tego czasu poszedł dalej — push, nowa baza
  scalenia —, komentarz nie trafia na wiersz, który ma teraz ten numer: zostaje
  odrzucony z komunikatem *pull request zmienił się od załadowania tego diffa*, a
  **Odśwież** pokazuje nowy diff. Na GitHubie komentarz jest zamiast tego
  publikowany względem commita, który czytałeś, a GitHub oznacza go jako
  nieaktualny, jeśli ten wiersz się zmienił. Wiersz, którego hosting nadal nie
  przyjmuje, jest odrzucany jako leżący poza diffem.
- **Odrzucony.** Bez uprawnienia do komentowania (token tylko do odczytu, konto,
  któremu repozytorium nie pozwala komentować) hosting odmawia, a komunikat podaje,
  że to jest powód.
- Pull requesty z **bitbucket.org** otwierają się w przeglądarce — aplikacja nie ma
  jeszcze dla nich strony —, więc komentarz do wiersza nadal dodaje się tam na
  stronie.
- **Plik bez diffa** (binarny albo zbyt duży, by hosting go dołączył) nie ma
  wierszy do skomentowania.

## Pisanie komentarzy

Każde pole na stronie — komentarz na dole, odpowiedź w wątku, komentarz do wiersza
— to ten sam edytor Markdown: zakładki **Pisz / Podgląd**, pasek formatowania ze
skrótami GitHuba, listy, które ciągną się po Enterze, i podpowiadanie po **@** /
**#** spośród osób i pull requestów, które są już na ekranie. Pole odpowiedzi
pokazuje swoje narzędzia, gdy w nie klikniesz, i wysyła przez ⌘/Ctrl+Enter, bo
Enter zaczyna teraz nowy wiersz. [Pisanie komentarzy](writing-comments.md) opisuje
szczegóły i ograniczenia.

## Ograniczenia

- **Otwarte pull requesty to lista z panelu bocznego.** GitHub, GitLab i
  bitbucket.org czytają pierwsze 30; repozytorium z większą liczbą pokazuje tylko
  te, a licznik Otwartych brzmi **30+**. Azure DevOps, Bitbucket Data Center i
  Forgejo czytają wszystkie.
- **Scalone i zamknięte mają limit**, a zakładka pokazuje **+**, gdy hosting ma
  ich więcej (jego strona wymienia wszystkie):

  | Hosting | Co jest czytane |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | 100 ostatnio zaktualizowanych, scalone i zamknięte **razem** |
  | GitLab | 100 ostatnio zaktualizowanych z każdej grupy |
  | Bitbucket Data Center | Po 100 z każdej grupy w kolejności *newest* serwera — jego API nie mówi, czy chodzi o otwarcie, czy aktualizację |
  | Azure DevOps | Po 100 z każdej grupy spośród zakończonych w **ostatnim roku**; jego API nie podaje kolejności, więc powyżej setki o tym, które trafią, decyduje serwer |

  Ich testy nie są czytane — CI zakończonego pull requesta niczego nie rozstrzyga,
  a kosztowałoby jedno zapytanie na wiersz — więc **CI nie przechodzi** nie działa
  w tych zakładkach (jego przycisk jest tam ukryty).
- **Brak konta**: bez tokenu, który sięga hostingu, Scalone i Zamknięte mówią to,
  zamiast pokazywać pustą listę (GitHub nadal może odczytać repozytorium
  publiczne).
- **Testy**: GitHub i Bitbucket Data Center podają je w liście. GitLab, Azure
  DevOps i Forgejo są pytane raz na head przy otwarciu strony, przez ten sam
  cache co plakietki CI w grafie. bitbucket.org ich nie ma.
- **Recenzenci**: GitHub, GitLab, Forgejo, Bitbucket Data Center i Azure DevOps
  podają, kogo nadal poproszono (Azure: osoba, która nie zagłosowała; zespół jest
  pomijany). Lista bitbucket.org tego nie mówi, więc filtr Recenzent jest tam
  pusty.
- **Wyszukiwanie w opisie** działa tam, gdzie lista hostingu zawiera opis;
  bitbucket.org może go pomijać, i wtedy przeszukiwane są tylko tytuły, gałęzie i
  numery.
- **„Ja” na bitbucket.org i Azure DevOps** jest dopasowywane po nazwie
  wyświetlanej, bo tak ich listy nazywają autora.
- **Zmieniono na Azure DevOps** to moment otwarcia (lub zamknięcia) pull
  requesta: jego lista nie ma czasu ostatniej aktywności.
- Przechodzenie jest pamiętane, dopóki aplikacja działa; po ponownym
  uruchomieniu pull request otwarty z listy przechodzi zamiast tego przez otwarte
  pull requesty.
