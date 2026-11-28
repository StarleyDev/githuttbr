---
title: Edytuj dowolny commit
category: Gałęzie i operacje na historii
order: 46
summary: Przepisz pliki lub wiadomość historycznego commita w miejscu — z podglądem kaskady, zanim cokolwiek się zmieni.
keywords: edytuj commit przepisz historię popraw literówkę zmień wiadomość kaskada odtwarzanie rebase w miejscu chirurgia edit commit rewrite history amend past reword fix typo cascade replay porównaj z oryginałem compare with original dodaj plik add file co się stanie what will happen niezastosowane zmiany unapplied changes
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Edytuj dowolny commit

Literówka siedzi w commicie sprzed trzech tygodni. Zwykła naprawa to rebase
interaktywny: zatrzymaj się na commicie, edytuj, kontynuuj, módl się. Naprawa
w GitHuttBr: kliknij commit prawym przyciskiem, **Edytuj ten commit**, zmień
tekst, gotowe. Przycisk pióra w panelu szczegółów commita otwiera ten sam
edytor.

![Edycja historycznego commita](../../screenshots/commit-edit.webp)

## Co robi

Wybierz dowolny commit będący przodkiem `HEAD` — historia liniowa czy nie.
Edytor otwiera się w środkowym panelu, w miejscu grafu commitów — tam, gdzie
otwierają się rozwiązywanie konfliktów i przeglądarka plików — i zajmuje całą
szerokość i wysokość okna. **Esc** albo **×** w jego nagłówku go zamyka. Twoje
zmiany przetrwają przełączenie na inną kartę repozytorium i powrót, a zamknięcie
z niezastosowanymi zmianami najpierw pyta o potwierdzenie.

Nagłówek pokazuje commit — jego krótki hash, temat, autora i wiek — a gdy coś
zmienisz, żółta plakietka liczy **niezastosowane zmiany**: jedną za wiadomość,
po jednej za każdy edytowany plik.

### Karta wiadomości

Wiadomość ma te same narzędzia co w [kompozytorze commita](committing.md):
przycisk **typ ▾** przed podsumowaniem, podsumowanie z licznikiem długości
(*56/72*) i opis pod nim, wiersz stylu za strzałką (zakres, klucz zgłoszenia,
styl commita), wybór gitmoji, współautorów, generowanie przez AI z własnego diffu
commita i podpowiedzi lintera. Wiadomość commita jest dzielona przy wczytaniu —
pierwszy wiersz trafia do podsumowania, reszta do opisu — i łączona z powrotem
jedną pustą linią przy przepisywaniu. Zamiana starego `add retry` na
`fix: add retry` to jeden wybór z przycisku typu.

Gdy tylko wiadomość różni się od oryginału, karta dostaje oznaczenie
**zmieniona**, stary temat pozostaje widoczny pod opisem jako *przed: …*, a
**Przywróć oryginał** przywraca zarówno podsumowanie, jak i opis.

### Karta plików

Pliki commita są wypisane z literą statusu; kropka oznacza każdy, który
zmieniłeś. Wybierz plik, żeby edytować go w postaci z tego commita; wiersze, które
zmieniasz lub dodajesz, są podbarwiane w trakcie pisania, więc twoja edycja
pozostaje na widoku. Przełącznik
nad edytorem przełącza między **Edytuj** a **Porównaj z oryginałem**, które
pokazuje diff pliku od tego, co zawiera commit, do twojego edytowanego tekstu —
ten sam widok diffu, którego używa reszta aplikacji.

**Dodaj plik** otwiera plik, którego commit nie dotknął, z migawki samego
commita: wpisz część ścieżki i wybierz go. Gdy go zmienisz, przepisany commit
zmieni również ten plik. Na liście jest oznaczony **+**.

![Porównanie edytowanego pliku z oryginałem z commita](../../screenshots/commit-edit-compare.webp)

### Co się stanie

Panel obok kart — pod nimi w wąskim oknie — pokazuje łańcuch, którego dotyka
przepisanie: każdy commit powyżej edytowanego, od `HEAD` w dół, a na samym dole
sam edytowany commit z tym, co się w nim zmienia.

1. **Podgląd kaskady** odtwarza każdy commit powyżej edytowanego *w pamięci*
   (łańcuch cherry-picków przez `merge-tree` — bez checkoutu, bez drzewa
   roboczego, bez referencji). Każdy commit w łańcuchu mówi wtedy, czy
   **odtwarza się bez konfliktów**, czy ma **konflikt** we wskazanym pliku, więc
   **zanim cokolwiek się ruszy** wiesz, czy edycja przechodzi czysto, czy
   koliduje z późniejszą zmianą. Po każdej kolejnej edycji werdykty znikają;
   **Podgląd ponownie** uruchamia go jeszcze raz.
2. **Przepisz historię** robi to naprawdę: ten sam łańcuch jest budowany
   poleceniami plumbing, a potem gałąź przesuwa się przez `reset --keep` —
   twoje niezacommitowane zmiany są przenoszone, albo reset się przerywa i nic
   się nie stało. Najpierw wykonywana jest [migawka strażnika](recovery.md),
   a **Cofnij** przywraca stary łańcuch.

Gdy commit jest już na zdalnym repozytorium, żółta notka podaje zdalną gałąź i
mówi, co to oznacza: następny push trzeba będzie wymusić. Inna notka mówi, ile
commitów dostanie nowe hashe.

Autorstwo i daty każdego odtworzonego commita są zachowane; zmieniają się tylko
hashe — na tym właśnie polega przepisywanie historii.

## Merge w zakresie

![Edycja commita poniżej dwóch merge’y — kaskada je odtwarza](../../screenshots/commit-edit-merges.webp)

Merge między commitem a `HEAD` nie wyłącza już edycji. Kaskada odtwarza
merge, nakładając jego **zapisany wynik** — drzewo, które merge faktycznie
zacommitował, wraz z rozwiązaniami konfliktów — na przepisanego rodzica, więc
rozwiązania zrobione ręcznie przeżywają przepisanie co do joty. Bez rerere,
bez ponownego merge'owania, bez drzewa roboczego: to samo plumbing w pamięci
co reszta kaskady, a oba wskaźniki na rodziców są zachowane. Gałąź boczna,
która również zawiera edytowany commit, jest przepisywana i przekierowywana;
ta, która go nie zawiera, zachowuje swoją tożsamość nietkniętą. Notka w
panelu bocznym mówi, ile merge'ów niesie zakres, a commity merge pokazują w
łańcuchu ikonę merge.

Uczciwe zastrzeżenie: odtworzony merge jest tylko tak dobry jak jego zapisany
wynik. Jeśli twoja edycja koliduje z liniami, które rozwiązał sam merge,
podgląd robi się czerwony dokładnie jak każdy inny konfliktujący krok — nic
nie jest zgadywane.

## Gdy kaskada wchodzi w konflikt

Późniejszy commit dotknął tych samych linii, które edytujesz. Podgląd oznacza
ten commit konfliktującym plikiem, commity nad nim jako nieodtworzone, a
**Przepisz historię** pozostaje wyłączone — nic nie jest nigdy zastosowane w
połowie. W przeciwieństwie do rebase'u edytor nie zatrzymuje się w połowie, żeby
pozwolić ci rozwiązać konflikt: albo edytuj inaczej, albo zmierz się z
konfliktem wprost przez [rebase interaktywny](rebase.md).

## Ograniczenia

- **Commit musi być przodkiem `HEAD`.** Commit na niezmergowanej gałęzi
  bocznej nie ma ścieżki do twojej bieżącej gałęzi, po której dałoby się go
  odtworzyć.
- Pliki binarne i pliki powyżej 2 MB są pokazywane, ale nieedytowalne.
- Commit, który jest już na zdalnym repozytorium, można edytować, ale następny
  push będzie musiał być **force pushem** — edytor ostrzega, zanim się na to
  zdecydujesz.
- Plików usuniętych w commicie nie da się edytować (nie ma treści do edycji).
- **Dodaj plik** sięga po pliki, które już istnieją w migawce commita; nie
  utworzy zupełnie nowego pliku, nie usunie pliku ani nie dotknie dowiązania
  symbolicznego czy submodułu.

**Zobacz też:** [Rebase interaktywny](rebase.md) · [Odzyskiwanie i reflog](recovery.md) · [Absorb](absorb.md)
