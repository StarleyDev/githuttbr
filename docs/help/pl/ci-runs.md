---
title: Uruchomienia CI
category: Synchronizacja i wiele repozytoriów
order: 59
summary: Śledź GitHub Actions, potoki GitLaba, Azure Pipelines i Forgejo Actions z poziomu aplikacji — każdy job, jego kroki i log, z ponownym uruchomieniem i anulowaniem.
keywords: uruchomienia ci przebiegi ci ci runs actions workflow potok pipeline build github actions gitlab pipelines azure pipelines forgejo actions joby kroki steps logi ponów rerun re-run anuluj cancel dispatch workflow_dispatch plakietka badge status graf graph nieudany test odsetek sukcesów postęp
---

# Uruchomienia CI

Zrobiłeś push i teraz czekasz: przejście do przeglądarki, szukanie repozytorium,
otwarcie Actions, znalezienie swojego uruchomienia, otwarcie joba, który zrobił się
czerwony, przewinięcie do końca logu. **Uruchomienia CI** stawiają tę pętlę obok
kodu. Jedna strona mówi, jak ostatnio radził sobie każdy workflow, wymienia
uruchomienia z remote'a od najnowszego i otwiera nieudane uruchomienie od razu na
teście, który się wysypał — z plikiem i linią, jedno kliknięcie od edytora. Przyciski
do ponownego uruchomienia albo zatrzymania są na karcie.

Strona rozmawia z własnym API hostingu, tokenem, który już dałeś GitHuttBr. Nic nie
jest uruchamiane na twoim komputerze — do tego służy [Lokalne CI](local-ci.md).

![Strona uruchomień CI: karta na każdy workflow z jego ostatnimi uruchomieniami, filtry Nieudane i W toku, postęp trwającego uruchomienia oraz nieudane uruchomienie otwarte na teście, który się wysypał, i na jego jobach](../../screenshots/ci-runs.webp)

## Jak ją otworzyć

**Narzędzia → Uruchomienia CI…** albo *Uruchomienia CI* w palecie poleceń (⌘K).
Strona otwiera się w karcie repozytorium, jak wiki i statystyki, i czyta remote o
nazwie `origin` — albo pierwszy remote, gdy nie ma `origin`.

## Co pokazuje strona

| Część | Czym jest |
|---|---|
| **Karty workflowów** | Jedna karta na workflow: co go uruchamia, odsetek sukcesów z ostatnich 10 zakończonych uruchomień (zielony od 90 %, bursztynowy od 70 %, czerwony poniżej), te uruchomienia jako kolorowe kwadraty — najstarsze po lewej, więc najnowsze stoi obok „teraz” — średni czas oraz albo najwolniejszy job, albo wynik ostatniego uruchomienia. Kliknij kartę, by wymienić tylko uruchomienia tego workflowu; kliknij ponownie, by pokazać wszystkie |
| **Wszystkie gałęzie / bieżąca gałąź** | Każde uruchomienie na remote albo tylko te z gałęzi, którą masz wybraną |
| **Nieudane / W toku** | Szybkie filtry z liczbą uruchomień, które każdy by zostawił. Liczą to, co zostawiają pozostałe filtry, więc liczba to dokładnie to, co pokaże kliknięcie |
| **Filtr** | Zawęża wczytane uruchomienia po tytule, workflowie, gałęzi, autorze, commicie lub zdarzeniu |
| **Karta uruchomienia** | Tytuł commita (albo nazwa workflowu), potem gałąź, workflow i numer uruchomienia, co je wywołało (push, pull request, harmonogram, ręcznie…), kto je wywołał i commit — kliknij commit, by go skopiować. Gdy uruchomienie należy do pull requesta, **PR #n** otwiera stronę tego pull requesta. Po prawej: jaki ma stan, ile trwało i jak dawno |
| **Trwające uruchomienie** | *W toku · krok 3 z 5*, pasek postępu i dotychczasowy czas. Krok należy do trwającego joba; na hostingu bez kroków (GitLab, Forgejo) liczone są zamiast tego joby |
| **Nieudany test** | Nieudane uruchomienie otwiera się samo, najnowsze pierwsze, z testem, który wskazuje jego log: job, test, pierwsza linia błędu i **ścieżka:linia** — kliknij ją albo *Otwórz w edytorze*, by trafić na tę linię. Ten sam odczyt co [zakładka Checki](hosting.md#zakładka-checki) pull requesta |
| **Joby** | Pod nim każdy job ze stanem i czasem trwania, pogrupowany według etapu tam, gdzie hosting ma etapy (GitLab, Azure). *Pokaż kroki i log* otwiera kroki joba i koniec jego logu — przy nieudanym jobie jest zawsze, przy pozostałych pojawia się po najechaniu na job |
| **Kroki** | Każdy krok joba ze stanem i czasem trwania — zgłaszają je GitHub, Azure i Forgejo; GitLab nie ma kroków |
| **Log** | Koniec logu zakończonego joba, z kolorami. Pobierane jest tylko ostatnie 512 KB — tam, gdzie jest błąd — a strona mówi, gdy początek pominięto |

Dopóki cokolwiek na stronie czeka w kolejce lub trwa, lista pyta hosting ponownie co
15 sekund, a razem z nią joby otwartego uruchomienia i każdego trwającego — stąd
bierze się liczba kroków; czasy trwania tykają co sekundę. Gdy dwie minuty odpowiedzi
nie przynoszą nic nowego — na przykład uruchomienie czeka na zatwierdzenie
wdrożenia — zwalnia do raz na minutę i przyspiesza, gdy tylko coś się ruszy. Lista,
w której wszystko się skończyło, nie pyta o nic, dopóki nie naciśniesz odświeżenia,
i nic nie jest pobierane, gdy okno jest ukryte.

Uruchomienie, które hosting wysyła bez tytułu — każdy potok GitLaba, zaplanowany
build Azure — dostaje nazwę od tematu swojego commita, gdy commit jest w grafie,
odczytanego bez kosztów z lokalnego repozytorium; w przeciwnym razie od numeru.

## Ponawianie, anulowanie, uruchamianie

| Przycisk | Widoczny, gdy | Co się dzieje |
|---|---|---|
| **Ponów nieudane** | Uruchomienie się nie powiodło lub zostało anulowane | Ponownie ruszają tylko joby, które nie przeszły |
| **Ponów** (↻) | Uruchomienie się skończyło, na GitHubie — na karcie po najechaniu | Każdy job rusza ponownie |
| **Otwórz w przeglądarce** | Najeżdżasz na kartę | Uruchomienie na stronie hostingu |
| **Anuluj** | Uruchomienie czeka w kolejce lub trwa | Najpierw pyta: trwające joby zostają przerwane, a ich praca przepada |
| **Uruchom workflow** | Hosting pozwala uruchomić go ręcznie | Wybierz workflow i gałąź; rusza tak, jakby ta gałąź została wypchnięta, i po kilku sekundach pojawia się na liście |

Na co pozwala każdy hosting:

| Hosting | Lista i joby | Kroki | Log | Ponów wszystko | Ponów nieudane | Anuluj | Uruchom ręcznie |
|---|---|---|---|---|---|---|---|
| **GitHub** (i Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — workflow potrzebuje wyzwalacza `workflow_dispatch` |
| **GitLab** (i self-managed) | ✓ — potoki, joby według etapu | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — uruchamia `.gitlab-ci.yml` na gałęzi |
| **Azure DevOps** | ✓ — buildy, joby według etapu | ✓ (zadania) | ✓ | — | ✓ | ✓ | ✓ — dowolna definicja buildu repozytorium |
| **Forgejo / Gitea** | ✓ na serwerach z API uruchomień Actions | ✓ | ✓ gdy serwer udostępnia go tokenowi | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Plakietki w grafie

To samo CI pojawia się jako mała plakietka obok każdego commita w grafie: zielona,
czerwona albo zegar, gdy trwa. Najedź na nią, by zobaczyć joby; kliknij, by otworzyć
stronę hostingu. Plakietki pochodzą z:

| Hosting | Źródło |
|---|---|
| GitHub | Check runs commita — każde CI, które raportuje do GitHuba, nie tylko Actions |
| GitLab | Statusy commita, które obejmują każdy job potoku. Ręczny job (na przykład wdrożenie) nie zostawia plakietki zawieszonej na zegarze |
| Azure DevOps | 100 najnowszych buildów repozytorium, dopasowanych po commicie |
| Forgejo / Gitea | Łączny status commita — Forgejo Actions i każde zewnętrzne CI |
| Bitbucket Data Center | Statusy buildów commita |

Każda odpowiedź jest zapamiętywana — także „tu nie ma CI” — a o commit pyta się
ponownie tylko wtedy, gdy jego odpowiedź mogła się zmienić: co 45 sekund, dopóki
trwa, co 10 minut, gdy się skończył, i coraz rzadziej w przypadku commita, który
nigdy nie miał CI. Dzięki temu ruchliwy graf mieści się w godzinowym limicie
hostingu.

## Ograniczenia

- **Karty znają tylko uruchomienia wymienione przez stronę.** To ostatnie 50
  uruchomień dla aktywnego filtra gałęzi — rzadko uruchamiany workflow może mieć mniej
  niż dziesięć kwadratów, a przełączenie na bieżącą gałąź przelicza każdą kartę.
  Najwolniejszy job pojawia się, gdy strona przeczyta joby jakiegoś zakończonego
  uruchomienia (wystarczy nieudane, które otwiera); do tego czasu karta mówi, jak
  zakończyło się ostatnie uruchomienie.
- **Nieudany test jest odczytywany z tekstu logu.** Rozpoznawane są Vitest, Jest i
  pytest; każdy inny runner, błąd buildu albo ucięty log pokazuje samą listę jobów.
  Ścieżki zapisanej przez runner poza checkoutem nie da się otworzyć.
- **PR #n zależy od tego, co mówi hosting.** GitHub podaje pull request tylko dla
  uruchomień z tego samego repozytorium, nie z forka; GitLab podaje go dla potoków
  merge requestów, a Azure dla buildów PR. Uruchomienia Forgejo nie mają linku.
- **Log to koniec i dopiero po zakończeniu joba.** GitHub i Forgejo wydają log joba
  dopiero, gdy ten się skończy; w trakcie strona pokazuje postępujące kroki, nie jego
  wyjście. GitLab i Azure udostępniają dotychczasowy log trwającego joba — otwórz go
  ponownie, by przeczytać więcej.
- **Token potrzebuje dostępu do CI.** Szczegółowy token GitHuba potrzebuje *Actions:
  read*, by wymieniać, i *Actions: write*, by ponawiać, anulować lub uruchamiać;
  klasyczny potrzebuje `repo`. Token GitLaba potrzebuje `read_api`, by wymieniać, i
  `api` dla przycisków. Token Azure potrzebuje *Build: read* (oraz *Build: read &
  execute* dla przycisków); bez tego strona i plakietki pozostają puste zamiast
  zgłaszać błąd.
- **Plakietki Azure sięgają tylko 100 buildów wstecz.** Starszy commit nie ma
  plakietki, choć strona uruchomień CI nadal wymienia jego build.
- **Ponowienie w Azure to „ponów nieudane”.** Działa na potokach YAML z etapami;
  klasyczny potok może odmówić, a strona pokazuje odpowiedź hostingu.
- **Uruchomienie workflowu nie pyta o jego dane wejściowe.** Workflow GitHuba lub
  potok GitLaba z wymaganymi danymi wejściowymi bez wartości domyślnej zostanie
  odrzucony przez hosting, z jego własnym komunikatem.
- **Forgejo jest tylko do odczytu i tylko na nowych serwerach.** Starsze serwery
  Forgejo i Gitea nie mają API do wymieniania uruchomień; strona mówi, że hosting nie
  jest obsługiwany, a plakietki w grafie nadal działają dzięki statusom commitów.
  Repozytorium, którego token nie widzi, pojawia się jako błąd dostępu, nie jako
  „nieobsługiwane”.
- **Bitbucket nie ma strony uruchomień.** W Data Center CI to zewnętrzny system
  (Jenkins, Bamboo…), który zgłasza tylko status — ten status to plakietka w grafie.
  Pipelines na bitbucket.org nie są obsługiwane.
- **Jeden remote.** Strona czyta `origin`; uruchomienia na innym remote forka nie są
  wymieniane.

**Zobacz też:** [Lokalne CI](local-ci.md) · [Hosting i pull requesty](hosting.md)
