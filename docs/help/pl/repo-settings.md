---
title: Ustawienia repozytorium
category: Narzędzia środowiska pracy
order: 94
summary: Nazwa wyświetlana, profil, chronione gałęzie i obraz karty jednego repozytorium, a także jego reguły, sejf i aktywność.
keywords: ustawienia repozytorium chronione gałęzie analityka dziennik operacji historia koło zębate repo settings protected branches analytics operation log info gear obraz karty tab image ikona logo nazwa wyświetlana alias profil usuń z listy zapomnij statystyki konfiguracja projektu
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Ustawienia repozytorium

Koło zębate obok narzędzi na pasku otwiera ustawienia należące do **tego**
repozytorium, a nie do aplikacji.

![Ustawienia repozytorium](../../screenshots/repo-settings.webp)

Nagłówek mówi, które repozytorium zaraz zmienisz: nazwę, folder, bieżącą gałąź,
główne repozytorium zdalne (`origin`, jeśli istnieje) z hostem, na którym jest,
i kilka liczników. Liczba gałęzi pochodzi z już wczytanej listy. Liczba w sejfie
pojawia się dopiero po otwarciu **Sejfu**, bo odczyt sejfu pyta pęk kluczy
systemu, a otwarcie ustawień nie powinno. Nie ma liczby commitów: policzenie
długiej historii to osobne wywołanie git, a nagłówek nie jest tego wart.

Strony są w bocznej nawigacji, w trzech grupach:

| Grupa | Strona | Co zawiera |
|---|---|---|
| Repozytorium | **Ogólne** | Nazwa wyświetlana, profil, chronione gałęzie, obraz karty i Usuń z listy |
| Repozytorium | **Konfiguracja projektu** | [Reguły, które niesie to repozytorium](repo-config.md), w `.githuttbr.json`, i doctor, który je sprawdza |
| Repozytorium | **Informacje** | Dowolne notatki i pola o tym repozytorium, przechowywane lokalnie |
| Bezpieczeństwo | **Sejf** | Wpisy [sejfu](vault.md) tego repozytorium |
| Aktywność | **Analityka** | Co zrobiłeś w GitHuttBr, liczone lokalnie |
| Aktywność | **Statystyki** | [Pulpit historii](insights.md) |
| Aktywność | **Historia operacji** | Commity w czasie i ich autorzy, dla repozytoriów, które otworzyłeś |
| Aktywność | **Dziennik** | Dziennik operacji: każde polecenie git uruchomione tu przez GitHuttBr, z wynikiem |

Dziennik operacji jest tym uczciwym: gdy coś zachowuje się dziwnie, pokazuje
dokładne polecenie i dokładny błąd, więc zgłoszenie błędu może nieść fakty,
a nie przymiotniki.

## Ogólne

Każde ustawienie to wiersz: po lewej, co robi, po prawej kontrolka. Nic nie
jest zapisywane, dopóki nie klikniesz **Zapisz**.

| Wiersz | Co robi | Gdzie jest zapisane |
|---|---|---|
| **Nazwa wyświetlana** | Nazwa na kartach i listach. Folder na dysku nigdy nie zmienia nazwy; puste oznacza nazwę folderu | Ustawienia GitHuttBr, ten komputer |
| **Profil** | Tożsamość, tokeny i AI, na które przełącza się to repozytorium, gdy jego karta jest aktywna. **Auto** podąża za aktywnym profilem | Ustawienia GitHuttBr, ten komputer |
| **Chronione gałęzie** | Ostrzega przed commitem lub force pushem bezpośrednio na te gałęzie | git config repozytorium |
| **Obraz karty** | Mały obrazek na karcie, poniżej | Ustawienia GitHuttBr, ten komputer |

Gdy repozytorium ma plik `.githuttbr.json`, komunikat na górze strony Ogólne o
tym mówi i prowadzi do **Konfiguracji projektu**. Te reguły jadą z
repozytorium do każdego, kto je sklonuje; wiersze pod komunikatem są tylko twoje.

**Usuń z listy…** usuwa repozytorium z [Repozytoriów](repositories.md). Najpierw
pyta, a pytanie mówi, czego nie robi: folder na dysku pozostaje nietknięty, a
otwarta karta zostaje otwarta. Ponowne otwarcie repozytorium przywraca je na listę.

## Obraz karty

Przy dziesięciu otwartych kartach nazwy zaczynające się tak samo — `api`,
`api-gateway`, `api-docs` — trudno odróżnić. Mały obrazek na karcie znajduje
się szybciej niż tekst.

W **Ogólne** kliknij pole obrazu. Wyświetla obrazy z samego repozytorium —
PNG, JPEG, GIF, WebP, SVG, ICO, BMP i AVIF — każdy z miniaturą, najpierw pliki
nazwane jak logo lub ikona. Pisz, aby zawęzić (`logo dark` znajduje
`assets/logo-dark.png`), poruszaj się strzałkami i wybierz Enterem; albo wpisz
ścieżkę ręcznie. Ścieżka jest zapisywana **względem katalogu głównego
repozytorium**, więc obraz podąża za repozytorium, gdziekolwiek leży jego
folder.

To, co pokazuje karta, ustawia się dla całej aplikacji w **Ustawienia → Ogólne
→ Karty repozytoriów pokazują**:

| Opcja | Karta pokazuje |
|---|---|
| **Obraz i nazwę** (domyślnie) | Obraz zamiast ikony folderu, potem nazwę |
| **Tylko nazwę** | Ikonę folderu i nazwę, jakby obrazu nie było |
| **Tylko obraz** | Sam obraz; nazwa trafia do podpowiedzi |

Ograniczenia, o których warto wiedzieć:

- Lista obejmuje pliki widoczne dla gita — śledzone i nieśledzone, bez
  ignorowanych — i najwyżej 40 naraz; pisz, aby dotrzeć do reszty. Ignorowany
  obraz nadal można wpisać ręcznie.
- Obrazy powyżej 1 MB lub nieczytelne są wyszarzone i nie da się ich wybrać:
  ikona 20-pikselowa nie potrzebuje więcej.
- Repozytorium **bez** obrazu zawsze pokazuje nazwę, niezależnie od opcji —
  pustej karty nie dałoby się rozpoznać.
- Jeśli ścieżka jest **zepsuta** — plik usunięty, przemianowany, nie jest
  obrazem albo jest za duży — karta po cichu wraca do nazwy, a ta karta
  ustawień pokazuje ostrzeżenie pod ścieżką. Nic poza tym nie protestuje.
- Obraz jest wczytywany raz na sesję. Jeśli podmienisz plik pod tą samą nazwą,
  otwórz ponownie tę kartę ustawień, aby go przeładować.
- Ustawienie żyje w ustawieniach GitHuttBr na tym komputerze, nie w repozytorium,
  więc współpracownicy go nie dziedziczą.

**Zobacz też:** [Bezpieczeństwo i sekrety](security.md) · [Statystyki](insights.md)
