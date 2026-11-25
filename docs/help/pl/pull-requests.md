---
title: Strona pull requestów
category: Synchronizacja i wiele repozytoriów
order: 57
summary: Wszystkie pull requesty repozytorium na jednej stronie — według stanu, filtrowane po autorze, recenzencie, celu i CI — oraz ‹ ›, by przechodzić przefiltrowaną listę z wnętrza PR.
keywords: pull requesty lista strona merge requesty pr mr filtr autor recenzent moje czekają na moją recenzję proszą mnie o recenzję ci nie przechodzi gałąź docelowa szkice scalone zamknięte szukaj triage poprzedni następny alt strzałka nawigacja checkout przejdź do gałęzi źródłowej docelowej kopiuj nazwę gałęzi fetch
source: ced0be4a5d7da5b8c32b15d7fcc8846b79ee9506
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
