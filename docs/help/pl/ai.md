---
title: Funkcje AI
category: AI
order: 80
summary: Opcjonalne, niezależne od dostawcy i osadzone w twoim prawdziwym kodzie.
keywords: ai openai anthropic ollama lokalny llm wiadomość commita wyjaśnij recenzja wiki osadzone commit message explain review grounded konta konto klucz api subskrypcja cli claude codex gemini modele
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
przechodzić przez konto firmy ze względu na koszty albo politykę danych. Na
stronie **Profil** tego profilu, w sekcji *AI tego profilu*, przełącz **Ogólna**
na **Własna**: zaczyna jako kopia ogólnej AI, a jej dostawcy i klucze od tej
pory należą tylko do niej. Powrót do **Ogólna** usuwa je, po potwierdzeniu,
i zostawia ogólną AI bez zmian.

Każdą AI konfiguruje się na tej jednej stronie. Pasek **Edytujesz** na górze
wybiera którą: ogólną AI albo własną AI profilu (*Własna AI profilu Praca*).
**Skonfiguruj własną AI** na stronie Profil albo **Edytuj własną AI** na liście
profili otwiera stronę na tej właśnie AI. Sama strona Profil pokazuje tylko,
której AI profil używa i co odpowiada — nigdy nie zawiera edytora.

![AI profilu na jego stronie Profil: Ogólna albo Własna, co odpowiada i jak ją skonfigurować](../../screenshots/settings-profile-ai.webp)

Sposób, w jaki AI **pisze**, w obu przypadkach zostaje osobny dla każdego
profilu: styl opisów commitów, styl wyjaśnień, style rozwiązywania konfliktów
i nazywania branchy, własne instrukcje, wiersz współautora i czat repozytorium.
Są na stronie **Profil**, w sekcji *Preferencje pisania AI*, więc profil służbowy
może pisać commity `ticket`, a prywatny `conventional`, oba na tej samej AI.

Aktualizacja z wersji, w której każdy profil miał własną AI, niczego nie gubi:
AI używanego profilu staje się ogólną AI, a każdy inny profil, którego AI była
inna, zachowuje ją jako własną.

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

## Ograniczenia

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
