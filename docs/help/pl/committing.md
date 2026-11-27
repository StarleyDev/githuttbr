---
title: Commitowanie
category: Praca ze zmianami
order: 31
summary: Style wiadomości, szablony, współautorzy i linter.
keywords: commit wiadomość kompozytor szablon współautor linter amend conventional gitmoji ticket template co-author cofnij reset undo generate with ai cancel undo
---

# Commitowanie

## Style wiadomości

Wybierz jeden w **Ustawienia → AI → Komunikaty commitów** albo prosto z
kompozytora; kompozytor się do niego dostosuje. Styl należy do AI, której używa
profil — ogólnej albo własnej AI profilu.

| Styl | Wygląda tak |
|---|---|
| **Conventional** | `feat(api)!: add rate limiting` — z listą typów |
| **Gitmoji** | `✨ add rate limiting` — z wyborem emoji |
| **Gitmoji + Conventional** | `✨ feat(api): add rate limiting` — wybór emoji *i* lista typów |
| **Ticket** | `ABC-123: add rate limiting` — zasiane z nazwy gałęzi |
| **Zwykły** · **Auto** | Cokolwiek napiszesz; Auto pozwala AI zdecydować o kształcie |
| **Jaskiniowiec** · **Haiku** | Dokładnie to, na co wyglądają |

![Kompozytor wypełniony z szablonu commita](../../screenshots/commit-template.webp)

### Gitmoji

[Gitmoji](https://gitmoji.dev) dodaje emoji przed tematem, żeby historię dało
się przeczytać jednym spojrzeniem: 🐛 poprawki, ✨ funkcje, 🔥 usunięcia. W obu
stylach gitmoji przycisk emoji jest tuż obok pola tematu. Otwiera **wszystkie 75
oficjalnych gitmoji**, z wyszukiwaniem po emoji, po `:kodzie:` (to, co wpisują
użytkownicy gitmoji-cli) albo po znaczeniu w twoim języku.

**Gitmoji + Conventional** utrzymuje typ i emoji w zgodzie. Wybierz typ, a jego
emoji pójdzie za nim; zmień typ, a emoji też się zmieni — chyba że wybrałeś je
ręcznie (na przykład 🚑️ przy `fix`). Takie emoji nigdy nie jest nadpisywane.

| Typ | Emoji | Typ | Emoji |
|---|---|---|---|
| `feat` | ✨ | `test` | ✅ |
| `fix` | 🐛 | `build` | 📦️ |
| `docs` | 📝 | `ci` | 👷 |
| `style` | 🎨 | `chore` | 🔧 |
| `refactor` | ♻️ | `revert` | ⏪️ |
| `perf` | ⚡️ | | |

AI pisze w tym samym kształcie. Jeśli model zapomni o emoji albo odpowie
`:shortcode:`, temat zostaje poprawiony, zanim trafi do pola.

Commity zapisane przez inne narzędzia jako `:sparkles: add login` są
**wyświetlane** jako `✨ add login` w grafie, w szczegółach commita i w widokach
historii.

Ograniczenia:

- Wybór zawsze zapisuje emoji **unicode**, nigdy `:shortcode:`.
- Shortcode'y są zamieniane tylko przy wyświetlaniu. Sam commit nie jest
  przepisywany, a wyszukiwanie w historii dopasowuje tekst w takiej postaci, w
  jakiej został zacommitowany.
- Liczą się tylko gitmoji: temat zaczynający się od innego emoji zostaje bez zmian.
- Repozytorium, którego hook `commit-msg` uruchamia commitlint ze standardowym
  presetem Conventional, odrzuca emoji na początku. To reguła hooka, nie
  GitHuttBr — skonfiguruj commitlint pod gitmoji albo używaj tam czystego
  Conventional.

## Pisanie wiadomości z AI

Gdy AI jest włączone, przycisk **✦** (*Wygeneruj z AI* po najechaniu) znajduje
się pod opisem. Czyta diff zmian w stage i pisze podsumowanie oraz opis w stylu
wybranym wyżej. Obok wiersz mówi, kto odpowie — *konto · model*, para wybrana
dla wiadomości commitów w **Ustawienia → AI → Model dla zadania** — więc wolny
model lokalny czy drogi model nigdy nie zaskakuje.

- **▾** obok nazwy pokazuje zapisane konta, każde z kilkoma swoimi modelami.
  Wybór obowiązuje **tylko dla tego jednego generowania**; Ustawienia się nie
  zmieniają.
- W trakcie ✦ się obraca, a ten sam wiersz pokazuje dotychczasowe sekundy i
  **Anuluj**, które zatrzymuje samo żądanie, nie tylko wskaźnik. Podsumowanie i
  opis są w tym czasie tylko do odczytu, więc odpowiedź nie nadpisze tego, co
  wpiszesz. Po 30 sekundach ogólnoaplikacyjny komunikat *trwa dłużej niż
  oczekiwano* ([AI](ai.md)) proponuje dalsze czekanie albo przeniesienie tego
  samego generowania na inne gotowe konto; **Wygeneruj ponownie** używa potem
  tego konta.
- Nowy tekst **zastępuje** poprzedni, a stary zostaje zachowany: **Cofnij** i
  **Wygeneruj ponownie** pojawiają się w tym samym wierszu (po najechaniu
  *Wygenerowane przez konto · model w 7 s*). Cofnij przywraca twoje podsumowanie
  i opis. Oba znikają, gdy tylko edytujesz tekst lub zrobisz commit.
- Opis, który wpisujesz, albo ten napisany przez AI, zostaje, gdy przełączysz
  się na inną kartę i wrócisz, tak jak podsumowanie — a po generowaniu także
  **Cofnij** i **Wygeneruj ponownie**.

![Wygeneruj z AI i menu kont](../../screenshots/commit-ai-generate.webp)

![Wygenerowana wiadomość z Cofnij i Wygeneruj ponownie obok konta](../../screenshots/commit-ai-generated.webp)

[Edycja commita](commit-edit.md) ma ten sam przycisk, na podstawie diffu tego
commita.

Ograniczenia:

- Wysyłany jest tylko diff ze stage, przycięty, gdy jest bardzo duży — nigdy
  zmiany spoza stage ani inne pliki.
- Cofnij pamięta jeden krok: tekst sprzed pierwszego generowania z serii. Gdy
  Cofnij zniknie, znika też ta kopia.
- Anulowanie nie zwraca tokenów, które dostawca już zużył.
- Lista ▾ pokazuje wszystkie zapisane konta, także konto bez klucza; wybranie
  go kończy się błędem tego konta.

## Co kompozytor robi za ciebie

- <kbd>↑</kbd> <kbd>↓</kbd> przywołuje twoje **ostatnie wiadomości**.
- **Wybór współautora** dodaje stopki `Co-authored-by:` na podstawie osób, które
  faktycznie współtworzyły to repozytorium.
- `commit.template` / `.gitmessage` **wypełnia** wiadomość wstępnie, z pominięciem
  linii komentarza.
- W trakcie merge'a, cherry-picka czy reverta wiadomość jest **wypełniona
  wstępnie** tak, jak zrobiłby to git.
- Szkice **zostają zapamiętane** dla każdego repozytorium z osobna, więc
  przełączenie karty nigdy nie gubi wiadomości.

## Linter

Sprawdzenie na żywo, które niczego nie blokuje: długość tematu (z licznikiem
znaków), kropka na końcu, temat nie w trybie rozkazującym albo z małej litery,
zbyt szerokie linie w treści. Podpowiedzi, nigdy bramka — nie powstrzyma cię
przed zacommitowaniem.

## Amend

Amend przepisuje ostatni commit tym, co jest w przechowalni. GitHuttBr pokazuje ci
najpierw istniejącą wiadomość, żebyś ją edytował, a nie przepisywał od nowa.

**Popraw commit…** na wierszu grafu robi to samo dla HEAD: wczytuje pełną
wiadomość, przełącza kompozytor w tryb amend i ustawia na nim fokus. HEAD, który
został już wypchnięty, wciąż da się poprawić, ale GitHuttBr ostrzega, że
zaktualizowanie zdalnego będzie wymagało force pusha.

**Cofnij commit…** to bliźniacza akcja dla niewypchniętego HEAD: mixed reset do
rodzica, zmiany w drzewie roboczym zachowane, wiadomość przywrócona do
kompozytora. Pierwszy commit ma dedykowaną ścieżkę, która zostawia nienarodzoną
gałąź, zamiast niszczyć pliki.

**Zobacz też:** [Przechowalnia](staging.md) · [Absorb](absorb.md) · [Generator changelogu](changelog.md)
