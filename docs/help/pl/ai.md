---
title: Funkcje AI
category: AI
order: 80
summary: Opcjonalne, niezależne od dostawcy i osadzone w twoim prawdziwym kodzie.
keywords: ai openai anthropic ollama lokalny llm wiadomość commita wyjaśnij recenzja wiki osadzone commit message explain review grounded konta konto klucz api subskrypcja cli claude codex gemini modele wolno timeout dłużej niż oczekiwano czekaj dalej anuluj nie odpowiada ollama zamknięty zmień konto inne konto preferencje pisania styl commitów własne instrukcje współautor najechanie wyjaśnianie własna ai ogólna ai
---

# Funkcje AI

Każda funkcja AI jest **opcjonalna** i wyłączona, dopóki nie skonfigurujesz
dostawcy. Nic nigdzie nie jest wysyłane, dopóki o coś konkretnego nie
poprosisz.

![Ustawienia AI](../../screenshots/settings-ai.webp)

## Jedna AI dla wszystkich profili

AI konfiguruje się raz, w **Ustawienia → AI**, i każdy [profil](profiles.md) jej
używa: profil utworzony później już ma AI, bez ponownego dodawania konta. Strona
wymienia każdy profil i to, czy korzysta z tej **ogólnej AI**.

Profil może zamiast tego używać **własnej AI** — profil służbowy, który musi
przechodzić przez konto firmy ze względu na koszty albo politykę danych, albo
który pisze commity inaczej. Na stronie **Profil** tego profilu, w sekcji *AI
tego profilu*, przełącz **Ogólna** na **Własna**: zaczyna jako kopia całej
ogólnej AI — kont, kluczy i preferencji — a od tej pory wszystko to należy tylko
do tego profilu. Powrót do **Ogólna** usuwa ją, po potwierdzeniu, i zostawia
ogólną AI bez zmian.

Profil używa jednej AI **w całości**: ogólnej albo własnej, nigdy mieszanki.
Konta i modele *oraz* to, jak AI pisze i co wolno czatowi, pochodzą z tego
samego miejsca, więc zmiana stylu commitów w ogólnej AI zmienia go dla każdego
profilu, który z niej korzysta.

Każdą AI konfiguruje się na tej jednej stronie. Pasek **Edytujesz** na górze
wybiera którą: ogólną AI albo własną AI profilu (*Własna AI profilu Praca*).
**Skonfiguruj własną AI** na stronie Profil albo **Edytuj własną AI** na liście
profili otwiera stronę na tej właśnie AI. Sama strona Profil pokazuje tylko,
której AI profil używa i co odpowiada — nigdy nie zawiera edytora ani żadnej
własnej opcji AI.

![AI profilu na jego stronie Profil: Ogólna albo Własna, co odpowiada i jak ją skonfigurować](../../screenshots/settings-profile-ai.webp)

Pod kontami ta sama strona zawiera to, jak ta AI **pisze** i co może robić, w
sekcjach:

| Sekcja | Zawiera |
|---|---|
| **Komunikaty commitów** | Styl commitów — Conventional, Gitmoji i Ticket jako karty z linią przykładu, reszta w *Więcej stylów* — *Generuj opis commita*, linia współautora, **Dodatkowe zasady dla commitów** i podgląd |
| **Wyjaśnianie i najechanie** | Styl wyjaśnień, *Wyjaśniaj kod po najechaniu* i jego klawisz modyfikujący |
| **Konflikty i gałęzie** | Styl rozwiązywania konfliktów, styl nazywania gałęzi, każdy z przykładem wyniku |
| **Czat repozytorium** | Czy czat jest włączony, co czyta, jakie akcje może proponować — zobacz [Czat repozytorium](repo-chat.md#ustawienia) |

**Dodatkowe zasady dla commitów** — do wersji 4.60 *Własne instrukcje* — trafiają tylko do generowania komunikatów commitów: czat, wyjaśnienia, recenzje i nazwy gałęzi ich nie czytają. Podgląd to stały przykład, nie wywołanie modelu: pokazuje kształt wybranego stylu, a nie to, co AI napisze dla twojej zmiany.

![Komunikaty commitów](../../screenshots/settings-ai-commits.webp)

Przełącznik stylu w kompozytorze oraz wybór modelu i trybu zatwierdzania w
czacie zapisują do tej samej AI, którą czyta profil: ogólnej albo własnej AI
profilu.

Aktualizacja z wersji, w której każdy profil miał własną AI, niczego nie gubi:
AI używanego profilu staje się ogólną AI, a każdy inny profil, którego AI była
inna, zachowuje ją jako własną.

**Aktualizacja z 4.59 lub starszej**, gdy preferencje pisania były w każdym
profilu: jednorazowo preferencje używanego profilu (albo, jeśli ma on własną AI,
pierwszego profilu na ogólnej AI) przechodzą do ogólnej AI. Profile z własną AI
zachowują swoje. **Ograniczenie:** jeśli dwa profile na ogólnej AI pisały
inaczej — służbowy w stylu `ticket`, a prywatny w `conventional` — oba piszą
teraz jak ten, którego preferencje przeniesiono. Aby zachować różnicę, daj
jednemu z nich własną AI i ustaw tam ponownie jego styl.

## Dostawcy

**Konto** to jeden sposób dotarcia do modelu: dostawca, adres, pod którym się z
nim łączysz, i sposób uwierzytelnienia. Można skonfigurować kilka i działają
obok siebie — klucz służbowy, prywatny, model lokalny, CLI, do którego już
jesteś zalogowany.

Gotowe ustawienia obejmują **OpenAI, Anthropic, Google Gemini, OpenRouter, Groq,
Mistral** oraz **Ollama** (w pełni lokalnie), a także dowolny endpoint zgodny z
OpenAI.

Anthropic używa własnego API `/v1/messages`, a nie wywołania w kształcie OpenAI,
więc modele Claude naprawdę działają, zamiast tylko na to wyglądać. Gemini jest
osiągane przez zgodny z OpenAI endpoint Google.

### Dodawanie i edycja dostawcy

Dostawca zapisany w połowie był cichą pułapką: pusty klucz mógł zostać
domyślnym i nic nie odpowiadało. Dlatego nic na tej karcie nie zapisuje się
w trakcie pisania.

**Dodaj dostawcę** otwiera kartę oznaczoną **Szkic · niezapisany**, z przerywaną
ramką. Uzupełnij dostawcę, klucz, endpoint i model, a potem wybierz
**Testuj i zapisz**. GitHuttBr najpierw pobiera listę modeli dostawcy
z tym kluczem — to samo żądanie co **Pobierz modele** — i zapisuje dopiero, gdy
dostawca odpowie. Zobaczysz **Połączono · modele: N**, a dostawca trafi na listę
jako **Gotowy**.

Gdy test się nie uda, karta pokazuje **Nie udało się połączyć** z powodem
podanym przez dostawcę (odrzucony klucz, `401`; serwer, który nie działa) oraz
**Nic nie zostało zapisane.** Popraw pole i przetestuj ponownie, wybierz
**Zapisz mimo to**, aby zostawić go tak, jak jest — będzie wtedy
oznaczony **Nie odpowiada** — albo **Anuluj**, które nie zostawia
śladu.

Edycja zapisanego dostawcy działa tak samo. Pasek informuje
**Niezapisane zmiany — nic się nie zmieni, dopóki nie zapiszesz**, a każde zmienione pole jest oznaczone
**· zmieniono**. **Odrzuć zmiany** przywraca zapisane wartości;
**Testuj i zapisz** testuje i zapisuje. Wybranie innego dostawcy, dodanie
nowego lub otwarcie **Użyj mojej subskrypcji** przy niezapisanych zmianach pyta
**Zapisać zmiany w „…”?** — **Zapisz**, **Odrzuć zmiany** lub
**Edytuj dalej**. Zamknięcie Ustawień zachowuje szkic w pamięci, więc
czeka po powrocie; nigdy nie jest zapisywany na dysk.

Klucze zapisują się dokładnie jak dotąd, w pęku kluczy, i tylko przy zapisie.
Błąd dostawcy jest pokazywany z zamaskowanym kluczem i wszystkim, co wygląda na
token.

![Dodawanie i edycja dostawcy](../../screenshots/ai-provider-draft.webp)

| Rodzaj dostawcy | Co sprawdza **Testuj i zapisz** |
| --- | --- |
| Klucz API lub serwer lokalny (Ollama, własny endpoint) | Pobiera listę modeli; sukces oznacza, że endpoint odpowiedział z tym kluczem |
| Subskrypcja (Codex, Claude Code) | Wysyła krótki prompt testowy opisany niżej, z limitu Twojego planu |
| Lokalne CLI | Szuka polecenia w `PATH`; wpisana ścieżka jest zapisywana bez sprawdzania |

### Plakietki stanu

Każdy dostawca na liście ma jedną plakietkę, wyliczoną z tego, co strona już
wie — z ostatniego testu albo z listy modeli pobranej i tak. Nic nie jest
odpytywane w tle.

| Plakietka | Znaczenie |
| --- | --- |
| **Gotowy** | Ostatni test lub pobranie listy modeli się udało |
| **Nie odpowiada** | Ostatnia próba się nie udała; powód jest w wierszu niżej, z **Testuj ponownie** |
| **Brak klucza** | Dostawca wymaga klucza API, a go nie ma |
| **Nie sprawdzono** | Nic go jeszcze nie pytało — subskrypcja do czasu testu albo niepobrana lista |

**Ograniczenie:** plakietka jest tak świeża jak ostatnie sprawdzenie. Dostawca,
który przestał odpowiadać godzinę temu, nadal ma **Gotowy**,
dopóki coś go znowu nie zapyta — wybierz **Testuj połączenie** na jego karcie,
żeby mieć pewność. **Lokalne CLI** z wpisaną ścieżką zostaje
**Nie sprawdzono**, bo udowodnienie, że działa, kosztowałoby prompt.

### Subskrypcja zamiast klucza API

Podczas pierwszej konfiguracji lub w Ustawieniach → AI wybierz **Użyj mojej subskrypcji**. Wybierz ChatGPT lub Claude i zaloguj się w terminalu odpowiednim poleceniem. Przetestuj połączenie, a następnie dodaj konto. Pierwsze konto ogólnej AI staje się domyślnym.

Po zainstalowaniu CLI kliknij Połącz, aby otworzyć stronę logowania dostawcy. Możesz anulować trwające łączenie.

- ChatGPT (Codex) — `codex login`
- Claude (Claude Code) — `claude auth login`

Test wysyła krótką wiadomość do dostawcy i zużywa część limitu planu. Limit wykorzystany. Spróbuj ponownie po jego odnowieniu.

![Użyj mojej subskrypcji](../../screenshots/ai-subscription.webp)

Wybierz dostawcę **Lokalne CLI**, aby odpowiadało CLI agenta już zainstalowane i
zalogowane na tej maszynie — `claude`, `gemini` lub `codex`. GitHuttBr uruchamia
program z twoim zapytaniem i czyta odpowiedź; nie ma klucza API do wklejenia ani
tokenu do przechowania.

GitHuttBr uruchamia wyłącznie polecenie, które sam skonfigurowałeś jako konto, i
zawsze z listą argumentów zamiast powłoki — nic z diffa ani z nazwy gałęzi nie
może zostać wzięte za polecenie.

> **To nie jest bardziej prywatne niż klucz API.** Twoje zapytania i tak trafiają
> do tego samego dostawcy, na twoje własne konto, dokładnie tak jak z kluczem.
> Zmienia się rozliczenie i konfiguracja, a nie to, dokąd idzie tekst.

Jeśli polecenia nie ma w `PATH`, wpisz jego pełną ścieżkę przy koncie.

### Model dla zadania

W sekcji **Model dla zadania** każda funkcja — opisy commitów, czat,
wyjaśnianie kodu, recenzja PR, rozwiązywanie konfliktów, wiki, motywy — może
wskazywać własne konto i model. Zostaw wiersz na wartości domyślnej, aby szedł
za kontem domyślnym. Tani model do opisów commitów i mocny do czatu to typowy
podział.

### Powiadomienie o aktualizacji

Przy aktualizacji z wersji sprzed kont pojawia się to raz. Dotychczasowy dostawca i klucz stają się pierwszym kontem; niczego nie trzeba konfigurować ręcznie.

![Powiadomienie o aktualizacji](../../screenshots/ai-accounts-notice.webp)

## Modele

Listy modeli pochodzą od samego dostawcy i są zapisywane w pamięci podręcznej na
dobę; **Pobierz modele** odświeża jedną natychmiast. Pod listą GitHuttBr mówi,
skąd ona pochodzi — na żywo, z pamięci podręcznej (wraz z datą) albo z wbudowanej
listy zapasowej, i dlaczego.

Lista jest filtrowana do modeli zdolnych odpowiedzieć na zapytanie czatu, więc
modele embeddingów, mowy i obrazu zostają poza nią. Każde pole modelu przyjmuje
też dowolny tekst, więc model w wersji zapoznawczej, prywatne wdrożenie albo
świeżo pobrany tag Ollamy zawsze da się użyć, nawet jeśli dostawca go nie
wymienia.

Dostawca, któremu nie dałeś jeszcze klucza, albo nieosiągalny, cofa się do małej
listy wbudowanej zamiast pokazywać pustą listę rozwijaną.

Żaden dostawca nie publikuje listy uporządkowanej ani wyselekcjonowanej, więc porządkuje ją GitHuttBr: datowane migawki zwijają się do modelu, którego są migawką (`gpt-4o` obejmuje `gpt-4o-2024-08-06`), a reszta idzie od najnowszych, nie alfabetycznie. **Pokaż wszystkie modele** na dole listy przywraca wszystko, co przysłał dostawca.

## Co potrafi

| Funkcja | Co dostajesz |
|---|---|
| **Wiadomość commita** | Podsumowanie (i opcjonalną treść) z twojego diffa z przechowalni, w wybranym przez ciebie stylu |
| **Wyjaśnij ten plik** | Wyjaśnienie zwykłym językiem w panelu bocznym — Normalne, Zwięzłe, ELI5… a nawet Pirackie |
| **Najedź, żeby wyjaśnić** | Przytrzymaj <kbd>⇧</kbd> i wskaż identyfikator, żeby dostać jednolinijkowe wyjaśnienie plus linie, na których się opiera |
| **Rozwiązywanie konfliktów** | Proponuje scalenie w edytowalnym wyniku — nigdy nie stosuje go samo |
| **Recenzja PR-a** | Streszcza diff i wskazuje ryzyka, każde zakotwiczone w prawdziwym `plik:linia` |
| **Opis PR-a** · **nazwy gałęzi** | Naszkicowane z commitów i diffa gałęzi |
| **Motywy** · **palety grafu** | Generowane z promptu |
| **Sprytna przechowalnia** | Sugestie, co należy do tego commita |
| **Kreator konfiguracji AI** | Generuje pliki konfiguracyjne asystenta (instrukcje, agenci, hooki) dla repozytorium — przycisk różdżki w nagłówku panelu czatu |

## Osadzone, nie zgadywane

Recenzja widzi diff jako **oznaczone hunki** i wolno jej cytować wyłącznie te
oznaczenia; GitHuttBr następnie rozwiązuje każde z nich na prawdziwy plik i linię.
Model, który wymyśli lokalizację, zostaje **odrzucony i zapytany ponownie** —
więc ustalenia zawsze wskazują na kod, który istnieje.

Wyjaśnianie po najechaniu czyta wyłącznie ponumerowane okno wokół tokenu —
a w diffie jedynie hunki widoczne na ekranie — więc gdy definicja mieszka gdzie
indziej, mówi o tym, zamiast to zmyślać. Odpowiedzi są cache'owane dla każdej
wersji pliku.

**Zamaskowane pliki z sekretami nigdy nie są wysyłane.** Tak samo pliki objęte
regułami maskowania sekretów.

## Gdy model działa wolno albo przestaje odpowiadać

Lokalny model na laptopie może potrzebować minuty na wiadomość commita, a model,
który „myśli” przed odpowiedzią, jeszcze dłużej — ale serwer zamknięty w trakcie
żądania nie powinien zostawiać cię z kręcącym się kółkiem.

| Co się dzieje | Co widzisz |
|---|---|
| Brak odpowiedzi po 30 sekundach | *„{konto} odpowiada dłużej, niż oczekiwano.”*, z przyciskami **Czekaj dalej**, **Użyj {innego konta}** i **Anuluj**. Czekaj dalej pyta ponownie minutę później, jeśli żądanie wciąż trwa |
| Lokalny serwer (Ollama, LM Studio, llama.cpp…) zostaje zamknięty w trakcie pracy | W ciągu kilku sekund: *„{konto} nie odpowiada. Czy nadal działa?”*, z przyciskiem dla każdego innego konta gotowego do użycia oraz **Anuluj** |
| Serwer był już zamknięty, gdy wysłano prośbę | To samo, od razu |

**Użyj {innego konta}** anuluje żądanie i wysyła to samo do tamtego konta, z
jego domyślnym modelem — wiadomość commita, recenzja albo odpowiedź czatu
przychodzi tak, jakbyś zapytał właśnie tam. Twoje ustawienia się nie zmieniają:
następne żądanie znów trafia do konta wybranego dla tego zadania.

Dotyczy to każdej funkcji AI — wiadomości commitów, czatu, recenzji,
wyjaśniania, konfliktów, motywów, wiki — bo wszystkie przechodzą przez to samo
wywołanie.

## Ograniczenia

- **Tylko lokalne serwery są obserwowane pod kątem zamknięcia.** Dostawca
  chmurowy, który padnie, kończy się własnym błędem; wywołanie chmurowe, które
  jest po prostu wolne, dostaje komunikat *dłużej, niż oczekiwano* jak każde
  inne. Lokalny serwer zajęty, a nie zamknięty, liczy się jako żywy: tylko
  odrzucone lub zerwane połączenie kończy wywołanie wcześniej.

- Wbudowane listy zapasowe starzeją się między wydaniami. Po to właśnie jest
  pobieranie na żywo; zapas obejmuje tylko sytuację, gdy pobranie jest
  niemożliwe.
- Filtrowanie listy dostawcy do modeli czatowych działa po nazwie, więc model
  czatowy o nietypowej nazwie może wypaść. Wtedy wpisz go ręcznie.
- Konto CLI nie zgłosi zużycia tokenów, jeśli nie robi tego samo CLI — liczby
  zużycia i kosztu w ustawieniach będą zaniżać takie wywołania.
- Odpowiedzi przez CLI są wolniejsze niż bezpośrednie wywołanie API: program
  uruchamia całą sesję na każde zapytanie.
- Klucze są przechowywane osobno dla każdego konta w pęku kluczy systemu.
  Usunięcie konta usuwa jego klucz.
- Powrót do wersji sprzed ogólnej AI gubi klucze ogólnej AI: tamta wersja nie
  wie, gdzie są przechowywane, i porzuca je przy zapisie. Konta zostają; wpisz
  klucze ponownie. Własnej AI profilu to nie dotyczy.

**Zobacz też:** [Wiki repozytorium](repo-wiki.md) · [Bezpieczeństwo i sekrety](security.md)
