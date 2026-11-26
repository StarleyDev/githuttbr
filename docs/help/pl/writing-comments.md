---
title: Pisanie komentarzy
category: Synchronizacja i wiele repozytoriów
order: 57.5
summary: Edytor Markdown za każdym polem komentarza — Pisz / Podgląd, pasek formatowania ze skrótami GitHuba, listy, które ciągną się po Enterze, i podpowiadanie @wzmianek / #odwołań.
keywords: edytor markdown pole komentarza pasek narzędzi pogrubienie kursywa kod link cytat nagłówek lista punktowana numerowana lista zadań checklista podgląd pisz skrót wzmianka małpa odwołanie krzyżyk numer issue autouzupełnianie odpowiedź opis pull requesta treść issue markdown editor comment box toolbar mention reference autocomplete reply
source: 09bca660ae78b5922c3a7306f4001d893844c75b
---

# Pisanie komentarzy

Komentarz wysłany do GitHuba to Markdown, a gołe pole tekstowe każe ci wpisywać
każde `**` i `- [ ]` ręcznie, a potem sprawdzać w przeglądarce, czy tabela się
dobrze wyświetliła. Każde pole w aplikacji, które pisze do hostingu, jest teraz tym
samym edytorem, z narzędziami, jakie ma pole komentarza samego GitHuba:

- pole komentarza pull requesta, odpowiedzi w jego wątkach i komentarze do wierszy
  ([Strona pull requestów](pull-requests.md));
- pole komentarza issue;
- opis nowego pull requesta i treść nowego issue
  ([Hosting i pull requesty](hosting.md)).

![Pole komentarza pull requesta, z paskiem formatowania i listą osób do wspomnienia otwartą na „@al”](../../screenshots/comment-editor.webp)

## Pisz i Podgląd

**Podgląd** pokazuje tekst tak, jak zostanie wyświetlony, rysowany przez ten sam
renderer Markdown co reszta aplikacji. Jest tylko do odczytu; **Pisz** przywraca
pole z tekstem i kursorem tam, gdzie je zostawiłeś, więc ⌘/Ctrl+Z nadal cofa to,
co wpisałeś przed zerknięciem.

Zakładki tworzą listę zakładek: gdy któraś ma fokus, ← i → przełączają między nimi.

## Pasek narzędzi

| Narzędzie | Skrót | Co robi |
|---|---|---|
| **Nagłówek** | — | Menu z H1, H2 i H3 dla zaznaczonych wierszy; wybranie poziomu, który wiersz już ma, usuwa go |
| **Pogrubienie** | ⌘/Ctrl+B | `**tekst**` |
| **Kursywa** | ⌘/Ctrl+I | `_tekst_` |
| **Kod** | ⌘/Ctrl+E | `` `kod` `` w obrębie wiersza; blok ogrodzony ```` ``` ````, gdy zaznaczenie obejmuje kilka wierszy |
| **Link** | ⌘/Ctrl+K | `[tekst](url)` — zaznaczony URL staje się adresem, inny tekst etykietą |
| **Cytat** | — | `> ` przed każdym zaznaczonym wierszem |
| **Lista punktowana** | ⌘/Ctrl+Shift+8 | `- ` przed każdym zaznaczonym wierszem |
| **Lista numerowana** | ⌘/Ctrl+Shift+7 | `1. `, `2. `… przed każdym zaznaczonym wierszem |
| **Lista zadań** | — | `- [ ] ` przed każdym zaznaczonym wierszem |

Każde narzędzie działa jak przełącznik: użyte na tekście, który już je ma, zdejmuje
je. Bez zaznaczenia pogrubienie, kursywa, kod i link wstawiają tekst zastępczy i go
zaznaczają, gotowy do nadpisania. Narzędzie listy zastępuje listę innego rodzaju,
zamiast się na nią nakładać.

Zmiany przechodzą przez własną edycję pola tekstowego, więc **⌘/Ctrl+Z cofa
narzędzie** dokładnie jak wpisane słowo, a ponów je przywraca.

Pasek to jeden przystanek dla Taba; ← → przechodzą między jego przyciskami, a ↓
otwiera menu nagłówków. W polu komentarza ⌘/Ctrl+K tworzy link, zamiast otwierać
paletę poleceń. Na Macu skróty używają tylko ⌘, więc Ctrl+B, Ctrl+E i Ctrl+K nadal
robią to, co robią z nimi pola tekstowe macOS. Przy układzie klawiatury bez
liter łacińskich skróty idą za fizycznymi klawiszami B, I, E i K.

## Listy

**Enter** na końcu elementu listy zaczyna następny — ten sam punktor, następny
numer, puste `- [ ]` dla zadania — z tym samym wcięciem. Enter na elemencie, który
nie ma nic po znaczniku, kończy listę i usuwa znacznik. Shift+Enter to zwykły nowy
wiersz.

## Wzmianki i odwołania

Wpisanie **@** otwiera krótką listę osób, zawężaną w miarę pisania; **#** wymienia
pull requesty i issues po numerze i tytule (`#42` albo `#szukaj` dla słowa z
tytułu). ↑ ↓ wybierają, Enter lub Tab wstawia, Esc zamyka listę — tylko listę, nie
pole ani okno dialogowe wokół niego.

Lista pochodzi z tego, co aplikacja już ma, bez ponownego pytania hostingu:

| Pole | @ proponuje | # proponuje |
|---|---|---|
| Pull request | Jego autora, recenzentów, przypisanych i wszystkich, którzy komentowali | Otwarte pull requesty i issues repozytorium, tak jak wczytał je panel boczny |
| Issue | Jego autora, przypisanych i komentujących | To samo |
| Nowy pull request | Osoby, które czytają jego listy wyboru recenzenta i przypisanego, oraz autorów wczytanych pull requestów | To samo |
| Nowe issue | Autorów wczytanych pull requestów i issues | To samo |

**@** lub **#** wewnątrz słowa (adres e-mail), `#` nagłówka i wszystko wewnątrz
kodu zostają nietknięte.

## Wysyłanie

⌘/Ctrl+Enter wysyła z każdego pola: komentarz do pull requesta lub issue, odpowiedź
w wątku, komentarz do wiersza i opis nowego issue. Działa też z zakładek, paska
narzędzi i podglądu, nie tylko z pola. Esc anuluje komentarz do wiersza, z tych
samych miejsc. **Odpowiedź w wątku** była kiedyś jednowierszowym polem wysyłanym
Enterem; teraz to małe pole tekstowe, więc Enter to nowy wiersz (albo następny
element listy), a ⌘/Ctrl+Enter wysyła. Pole odpowiedzi pokazuje swoje zakładki i
narzędzia, gdy w nie klikniesz, żeby długa rozmowa nie obrastała paskiem narzędzi
pod każdym wątkiem.

## Ściągawka

**Obsługuje Markdown**, pod każdym polem, otwiera na miejscu ściągawkę: każdy
format, co trzeba wpisać i jego skrót. Esc lub kliknięcie gdzie indziej ją zamyka.
Nic z tego, co piszesz, się nie przesuwa.

Na dole **Otwórz pełny przewodnik** otwiera tę stronę. Podręcznik to osobna karta,
więc przejście do niego opuszcza stronę z polem, a niewysłany tekst by przepadł:
gdy jakiś jest — w tym polu albo w dowolnym innym na stronie pull requesta —,
aplikacja najpierw pyta. W oknach nowego pull requesta i nowego issue ściągawka nie
ma tego linku, bo podręcznik otworzyłby się za oknem dialogowym.

## Ograniczenia

- **Bez załączników.** Przeciągnięcie pliku lub wklejenie obrazka do pola niczego
  nie wysyła: GitHub nie ma publicznego API dla załączników komentarzy, więc nie ma
  gdzie umieścić pliku. Wyślij go na stronie i wklej link.
- **Tylko kto i co jest już wczytane.** @ nie przeszukuje użytkowników hostingu, a #
  wszystkich issues — osoba, która nie brała udziału w rozmowie, ani zamknięte
  issue, którego panel boczny nie wczytał, nie są proponowane. Nadal możesz wpisać
  nazwę lub numer w całości.
- **Bez proponowanych zmian, zapisanych odpowiedzi i wyboru emoji.**
- **Podgląd to renderer aplikacji.** Pokazuje Markdown tak, jak rysuje go
  aplikacja; wyświetlanie na hostingu może się różnić w szczegółach (rozszerzenia
  właściwe GitHubowi, wzmianki zamieniane w linki).
- **Opublikowane komentarze nie są formatowane.** Po wysłaniu komentarz pokazuje
  się w rozmowie w aplikacji jako zwykły tekst, z klikalnymi linkami — formatowanie
  Markdown jest rysowane tylko w podglądzie i na stronie hostingu.
- Skróty są stałe: nie ma ich w ustawieniach skrótów i nie podążają za zmianą
  przypisania tam.
