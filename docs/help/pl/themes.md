---
title: Motywy i wygląd
category: Dostosuj do siebie
order: 100
summary: Wbudowane motywy, jasne i ciemne, plus własne i generowane przez AI, oraz kolorowe ikony.
keywords: motyw motywy ciemny jasny wygląd kolory rozmiar czcionki paleta grafu theme themes dark light appearance colors font size graph palette szukaj wyszukiwanie ustawienia znajdź search settings ikona ikony kolory ikon odcień monochromatyczne icon icons icon colors tint monochrome
---

# Motywy i wygląd

Wbudowane motywy — GitHuttBr, Nord, Dracula, Solarized, GitHub,
Monokai, Midnight, Contrast i Daltonic — każdy w wariancie jasnym i ciemnym.

![Przełączenie z jasnego na ciemny](../../screenshots/clip-themes.webp)

- **Jasny, ciemny albo za systemem**, przełączane na żywo.
- **Własne motywy** oraz te **generowane przez AI** z promptu.
- Regulowany **rozmiar czcionki kodu**.
- **Kolory ikon** na pasku narzędzi i w sekcjach paska bocznego — zobacz niżej.
- **Wygląd grafu** — paleta torów, narożniki, gęstość wierszy i grubość linii, z podglądem na żywo — ma własną stronę, **Ustawienia → Graf**: zobacz [graf commitów](graph.md).

![Ustawienia motywów](../../screenshots/settings-themes.webp)

## Kolory ikon

Rząd szarych ikon sprawia, że Fetch, Push i Stash wyglądają podobnie, dopóki nie
przeczytasz ich etykiet. **Kolory ikon**, w sekcji Wygląd na karcie Motyw,
kolorują każdą ikonę według tego, co robi, żeby oko znalazło akcję przed słowem:

| Rola | Ikony | Kolor motywu, który przyjmuje |
|---|---|---|
| Pobieranie | Fetch, Pull, Zdalne, Worktree | miejsce na cyjan w motywie |
| Wysyłanie, kończenie | Push, Zadania, Zgłoszenia, Wydania | zielony |
| Referencje | Branch, Lokalne, Tagi, Pull requesty, Kamienie milowe, Submoduły | akcent |
| Odkładanie na bok | Stash, Pop, Stashe, Zakładki, Przypięty | miejsce na pomarańczowy w motywie |

Cofnij, Ponów, Narzędzia i Ustawienia zostają szare: to narzędzia pomocnicze,
a pozostawienie ich bez koloru sprawia, że kolorowe się wyróżniają.

Listy, które grupują wiele pozycji, kolorują całą grupę naraz, żeby grupa czytała
się jak jedna rodzina:

- **Menu Narzędzia** — podróż w czasie (Reflog, Migawki WIP, Wehikuł czasu,
  Bisect) na pomarańczowo; narzędzia branchy (Absorb, radary, lokalne CI,
  porównania) w akcencie; i jeden kolor na grupę: Podejrzyj cyjan, Branche
  i historia akcent, Pliki i patche zielony, Repozytorium pomarańczowy, Sekrety
  i udostępnianie czerwony.
- **Strony Ustawień** — Układ i terminal, Przestrzenie robocze i AI w kolorze akcentu; Profil i tożsamość, Analizatory kodu i Środowisko na zielono; Połączone konta, Git i synchronizacja i Dane i kopia zapasowa na cyjanowo; Motywy i Graf na pomarańczowo; Bezpieczeństwo i potwierdzenia na czerwono. Ogólne, Skróty i O programie zostają szare.

Rząd przycisków z samą ikoną robi odwrotnie — każdy przycisk dostaje własny kolor,
żeby dało się je odróżnić. Na [stronie pull requestów](pull-requests.md) przyciski
nagłówka są: odśwież niebieski, recenzja AI w kolorze akcentu, podgląd lokalny
turkusowy, przejście do gałęzi źródłowej zielony i do docelowej pomarańczowy
(otwórz w przeglądarce zostaje szary), a przy twoich komentarzach **Edytuj** bierze
akcent, a **Usuń** czerwień — tam i na stronie issue. Niebieski i turkusowy to
mieszanki kolorów motywu, więc też za nim podążają.

| Opcja | Co widać |
|---|---|
| **Monochromatyczne** | Każda ikona szara, jak przed pojawieniem się tej opcji |
| **Delikatny odcień** (domyślnie) | Kolor zmieszany z szarością; pełny kolor po najechaniu |
| **Pełny kolor** | Sam kolor, na małym tle w tym samym odcieniu |

Kolory pochodzą z motywu — motyw, który przemalowuje swój zielony albo akcent,
przemalowuje razem z nim ikony, także motywy własne i generowane przez AI.

Ograniczenia: kolor dostają tylko główne przyciski paska narzędzi, nagłówki
sekcji paska bocznego, menu Narzędzia, menu kontekstowe commitów, gałęzi i repozytoriów, strony Ustawień oraz przyciski stron pull
requesta i issue; inne menu, wiersze wewnątrz sekcji i graf commitów nie. Wiersz
menu pod kursorem zachowuje zwykły wygląd, razem z ikoną. Kolor nigdy nie jest
jedyną wskazówką — każda ikona zachowuje etykietę.

## Jak są ułożone Ustawienia

Menu boczne grupuje strony według tematu:

| Grupa | Strony |
|---|---|
| **Ty** | Profil i tożsamość · Połączone konta · AI — dwie pierwsze edytują profil podany w nagłówku ([profile](profiles.md)) |
| **Wygląd** | Motywy · Graf · Układ i terminal |
| **Zachowanie** | Ogólne · Git i synchronizacja · Bezpieczeństwo i potwierdzenia · Analizatory kodu |
| **System** | Przestrzenie robocze · Skróty · Środowisko · Dane i kopia zapasowa · O programie |

Ogólne trzyma tylko to, co dotyczy aplikacji jako całości — Język, Karty repozytoriów pokazują, Powiadomienia systemowe, Otwieraj changelog po aktualizacji, Ostrzegaj przy zamykaniu. Reszta przeniosła się na stronę, do której należy, a notka na stronie tam prowadzi:

| Opcja | Teraz w |
|---|---|
| Commity wczytywane na start, Commity na jedno „wczytaj więcej”, Doczytuj automatycznie przy przewijaniu, Daty względne, Pokaż awatary, Używaj zdjęć profilowych z GitHuba | **Graf** — razem z Paleta torów, Narożniki linii, Gęstość wierszy, Styl węzła, Fokus grafu, Układ stashy, Grubość linii, które tworzyły kartę Graf w Motywy |
| Automatyczny fetch co (minuty), Zawsze twórz commit merge, Zapamiętuj rozwiązania konfliktów, Zewnętrzne narzędzia diff i merge, Zewnętrzny edytor, Domyślna aplikacja „Otwórz w” | **Git i synchronizacja** |
| Potwierdzaj przed force pushem | **Bezpieczeństwo i potwierdzenia** |
| Analizatory kodu, launch.json | **Analizatory kodu** |
| Podgląd pliku, Animuj awatar profilu, Ukryj ukończone zadania, Grupuj refy po prefiksie | **Układ i terminal** |

Integracje to teraz **Połączone konta**, a Dane to **Dane i kopia zapasowa**. Działanie opcji się nie zmieniło, a zapisane ustawienia zostają, jakie były. Link otwierający stronę pod starą nazwą nadal trafia na właściwą.

## Znajdowanie ustawienia

Ustawienia są rozłożone na wiele stron, a opcja, której szukasz, rzadko jest tam,
gdzie się jej spodziewasz: wiesz, że istnieje, ale nie wiesz, na której stronie.
Pole wyszukiwania w nagłówku Ustawień, obok przycisku zamykania, przeszukuje
wszystkie strony naraz.

![Wyszukiwanie „terminal” w ustawieniach](../../screenshots/settings-search.webp)

W miarę pisania prawa strona pokazuje pasujące ustawienia pogrupowane według
stron — każde z nazwą, jednowierszowym opisem i stroną, na której się znajduje.
Panel boczny przygasza strony bez trafień, a przy pozostałych pokazuje ich
liczbę.

- Porównuje nazwę ustawienia, jego opis i nazwę strony — także strony, na której było przed przegrupowaniem menu: "general fetch" nadal znajduje automatyczny fetch w Git i synchronizacja, a "integrations" znajduje Połączone konta. Wielkość liter i akcenty nie mają znaczenia, a każde wpisane słowo musi wystąpić: "terminal font" zawęża wyniki do ustawień czcionki terminala.
- Wyszukiwanie działa jednocześnie w języku interfejsu i po angielsku: przy
  aplikacji po polsku wpisanie „token” albo „font” i tak znajdzie ustawienie.
- Kliknij wynik albo naciśnij **Enter** dla pierwszego, aby otworzyć jego stronę, przewinąć do ustawienia i na chwilę je wyróżnić.
- **Esc** czyści wyszukiwanie; drugie **Esc** zamyka Ustawienia.

Przeszukiwane są nazwy i opisy, nie ustawione przez ciebie wartości. Listy
serwerów dla poszczególnych hostów w Integracjach (GitHub Enterprise Server,
samodzielnie hostowany GitLab, Bitbucket Data Center) otwierają stronę
Integracje; kartę hosta wybierasz sam. Pojedyncze skróty klawiszowe nie są
indeksowane — wyszukiwanie znajduje stronę Skróty, której edytor je wymienia.

## Układ

Panel boczny po lewej albo po prawej, rozsuwalne panele wszędzie, zwijany panel
boczny na chwile, gdy graf zasługuje na całe okno, oraz rozmieszczenie terminala
osobne dla każdego repozytorium.

Ta sama strona, **Ustawienia → Układ i terminal**, mieści też dodatki paska tytułu i paska bocznego — **Animuj awatar profilu**, **Ukryj ukończone zadania**, **Grupuj refy po prefiksie** — oraz margines zmian i minimapę przeglądarki plików.

**Zobacz też:** [Graf commitów](graph.md) · [Profile](profiles.md)
