// Website chrome in pl. Keys mirror en.mjs; anything missing falls back to English.
export const pl = {
  'nav.handbook': 'Podręcznik',
  'nav.roadmap': 'Plan rozwoju',
  'nav.github': 'GitHub',
  'nav.sponsor': 'Wesprzyj',
  'nav.download': 'Pobierz',

  'foot.license':
    'Na licencji Apache 2.0 · Zrobione przez <a href="https://github.com/StarleyDev">Starley - Mestre Jedi</a> z 💜',
  'foot.source': 'Kod źródłowy',
  'foot.roadmap': 'Plan rozwoju',
  'foot.reportIssue': 'Zgłoś problem',
  'foot.sponsor': 'Wesprzyj',

  'meta.title': 'GitHuttBr — cały git, jak na dłoni',
  'meta.description':
    'Klient Gita napisany w całości vibe codingiem. Za darmo. Graf, przechowalnia z dokładnością do linii, rebase, worktree, podmoduły, LFS — plus kilka rzeczy, których nikt się po gicie nie spodziewa.',

  'hero.title': 'Cały git,<br /><em>jak na dłoni</em>',
  'hero.lede':
    'Graf, przechowalnia z dokładnością do linii, rebase, worktree, podmoduły, LFS.<br />Zwyczajne rzeczy, zrobione porządnie — plus kilka, których nikt się po gicie nie spodziewa.',
  'hero.download': 'Pobierz na swoją platformę',
  'hero.source': 'Zobacz źródła',
  'hero.terms': 'Za darmo · Apache 2.0 · v{version}',
  'hero.graphAlt': 'Graf commitów w GitHuttBr',

  'features.title': 'Kilka rzeczy, których nikt się po gicie nie spodziewa',
  'features.sub':
    'Żadna z nich nie jest powodem, by używać GitHuttBr — jest nim lista powyżej. Istnieją dlatego, że git zna już odpowiedź; GitHuttBr po prostu o nią pyta.',

  'ordinary.title': 'Co dostajesz',
  'ordinary.sub':
    'Kompletny klient, nie wycinek. Wszystko zbudowane, udokumentowane i dostępne w aplikacji już dziś — zwyczajne rzeczy, czyli większość tego, czym naprawdę jest praca z gitem.',
  'ordinary.graph': 'Graf commitów z prawdziwymi torami, okienkowany dla ogromnych historii',
  'ordinary.staging': 'Przechowalnia z dokładnością do pojedynczych linii',
  'ordinary.conflicts': 'Trzypanelowe rozwiązywanie konfliktów, które mówi, która strona jest która',
  'ordinary.rebase': 'Rebase interaktywny przez przeciąganie',
  'ordinary.stacks': 'Gałęzie w stosie z kaskadowym przebudowaniem',
  'ordinary.recovery': 'Reflog, migawki WIP, prowadzony bisect',
  'ordinary.prs': 'Pull requesty w serwisach GitHub, GitLab, Bitbucket i Azure DevOps',
  'ordinary.terminal': 'Wbudowany terminal — prawdziwy PTY',
  'ordinary.launch': 'Uruchamianie i debugowanie prosto z <code>.vscode/launch.json</code>',
  'ordinary.ai': 'Opcjonalne AI, które cytuje linie, jakie przeczytało',
  'ordinary.themes': 'Wbudowane motywy, jasne i ciemne, plus generowane przez AI',
  'ordinary.languages':
    'Przetłumaczone w całości, razem z podręcznikiem — arabski i hebrajski odbijają układ lustrzanie',

  'download.title': 'Pobierz',
  'download.sub': 'Najnowsze wydanie: <strong>v{version}</strong>. Każda kompilacja jest publikowana z CI.',
  'download.cli':
    'Albo otwórz repozytorium z terminala poleceniem <code>githuttbr .</code> — zobacz <a href="{cli}">wiersz poleceń</a>.',
  'download.macNote': 'macOS 13+ · Apple silicon &amp; Intel',
  'download.winNote': 'Instalator (x64)',
  'download.linuxNote': 'AppImage · deb',
  'download.forOs': 'Pobierz na {os}',

  'handbook.title': 'Podręcznik na {pages} stron, wbudowany w aplikację',
  'handbook.sub': 'Każda funkcja wyjaśniona — offline w aplikacji i tutaj.',

  'sponsor.title': 'Wesprzyj GitHuttBr',
  'sponsor.body':
    'Za darmo, na licencji Apache 2.0, bez backendu, bez telemetrii, bez niczego do dosprzedania — więc nie ma tu czego kupować. Wsparcie opłaca certyfikat Apple Developer, którego potrzebują podpisane kompilacje dla macOS, podręcznik i tłumaczenia. Zgłoszenia błędów są warte dokładnie tyle samo.',
  'sponsor.cta': 'Wesprzyj w serwisie GitHub',

  'doc.titleSuffix': 'Podręcznik GitHuttBr',
  'doc.filter': 'Filtruj strony…',
  'doc.filterLabel': 'Filtruj strony',
  'doc.edit': 'Edytuj tę stronę w serwisie GitHub',
  'doc.improve': 'Popraw to tłumaczenie w serwisie GitHub',

  'feature.conflict-radar.title': 'Radar konfliktów',
  'feature.conflict-radar.body':
    'Zobacz, które gałęzie wejdą w konflikt, <strong>zanim</strong> zmergujesz którąkolwiek z nich. Merge’e dzieją się wewnątrz bazy obiektów — bez przełączania, bez zmiany drzewa roboczego, bez sprzątania po fakcie.',
  'feature.recovery.title': 'Migawki pracy w toku',
  'feature.recovery.body':
    'Całe twoje drzewo robocze — łącznie z nieśledzonymi plikami — zapisywane co jakiś czas i <strong>tuż przed każdą destrukcyjną akcją</strong>. Odrzucenie, którego żałujesz, jest o jedno przywrócenie stąd.',
  'feature.commit-edit.title': 'Edytuj dowolny commit',
  'feature.commit-edit.body':
    'Literówka sprzed trzech tygodni? Edytuj plik <strong>wewnątrz starego commita</strong> — wszystko powyżej zostaje odtworzone, a cała kaskada ma podgląd, zanim ruszy się choć jedna referencja.',
  'feature.ai.title': 'Przynieś własne modele',
  'feature.ai.body':
    'Kilka kont AI naraz — klucz OpenAI do opisów commitów, Claude do czatu, lokalna Ollama do reszty. Listy modeli przychodzą na żywo od każdego dostawcy, a CLI, w którym już jesteś zalogowany, działa zamiast klucza API.',
  'feature.semantic-diff.title': 'Diff semantyczny',
  'feature.semantic-diff.body':
    '<code>startServer</code> → <code>bootServer</code>, zamiast czterystulinijkowej czerwono-zielonej ściany. Prawdziwe parsowanie przez tree-sitter, a nie regex.',
  'feature.range-diff.title': 'Co się zmieniło od',
  'feature.range-diff.body':
    'Zrobili force push na gałęzi, którą zrecenzowałeś. Zobacz, które commity zostały przepisane, wyrzucone albo dodane — stare pozycje przychodzą za darmo z reflogu.',
  'feature.repo-chat.title': 'Czat repozytorium',
  'feature.repo-chat.body':
    'Zadaj pytanie temu repozytorium i otrzymaj odpowiedź cytującą przeczytane wiersze. Przypnij pliki i commity, które ma obejrzeć — przeciągnij je z grafu, drzewa plików albo z dowolnego miejsca na dysku.',
  'feature.absorb.title': 'Absorb',
  'feature.absorb.body':
    'Dodaj swoje poprawki z recenzji do przechowalni, a blame skieruje każdy hunk do commita, który go wprowadził, jako <code>fixup!</code>.',
  'feature.time-machine.title': 'Wehikuł czasu',
  'feature.time-machine.body':
    'Przeciągnij suwak i patrz, jak repozytorium się zmienia: pliki się pojawiają, wędrują, wracają. HEAD nigdy się nie rusza, a twoja niezacommitowana praca zostaje nietknięta.',
  'feature.timelapse.title': 'Timelapse',
  'feature.timelapse.body':
    'Odtwórz całe życie repozytorium jako animację — i wyeksportuj je jako wideo, nagrane na stronie, bez instalowania żadnego kodera.',
  'feature.pr-preview.title': 'Podgląd pull requesta',
  'feature.pr-preview.body':
    'Uruchom cudzy pull request — także z forków — nie commitując niczego. Bez tokenu API, bez drugiego remote’a: czubek gałęzi jest pobierany z referencji, którą hosting i tak publikuje, w serwisach GitHub, GitLab, Bitbucket, Azure DevOps albo Gitea.',
  'feature.mission-control.title': 'Centrum dowodzenia',
  'feature.mission-control.body':
    'Każde repozytorium przestrzeni roboczej na jednym ekranie, uszeregowane według tego, co cię potrzebuje: najpierw zablokowane, potem do synchronizacji, potem brudne, potem spokojne.',
  'feature.attributes.title': 'Atrybuty plików, z interfejsem',
  'feature.attributes.body':
    'Najbardziej przydatny plik w gicie, którego nikt nie pisze. Końce linii ustalone raz dla wszystkich, changelog, który przestaje wchodzić w konflikt, fikstury trzymane poza archiwami wydań — i czytelne diffy dla Worda i PDF-a, gdy konwerter jest zainstalowany.',
  'feature.languages.title': 'Twój język, prawdopodobnie',
  'feature.languages.body':
    'Nie zaślepka z tłumaczeniem przycisków — cały interfejs, razem z objaśnieniami. Arabski i hebrajski odbijają układ lustrzanie, podczas gdy graf, diffy, ścieżki i terminal zostają od lewej do prawej, bo w tę stronę czyta się kod.',
  'feature.security.title': 'Twoje sekrety zostają twoje',
  'feature.security.body':
    'Żadnego backendu. Tokeny i wpisy sejfu są szyfrowane pękiem kluczy twojego systemu — a nic nie dotyka tego pęku, dopóki nie usłyszysz po co i się nie zgodzisz.',
  'feature.cli.title': 'Graficzny klient Gita z prawdziwym CLI',
  'feature.cli.body':
    '`githuttbr .` otwiera repozytorium, `githuttbr blame src/api.ts -l 84` otwiera je w tym wierszu, a `githuttbr doctor` nie otwiera żadnego okna — sprawdza, czego wymaga repozytorium, i kończy się kodem, który odczyta twoje CI.',
  'feature.hosting.title': 'Pull requesty na każdym serwerze',
  'feature.hosting.body':
    'Twórz, recenzuj i scalaj na GitHubie, GitLabie, Bitbuckecie, Azure DevOps i Forgejo — także na serwerach własnej firmy: GitHub Enterprise, GitLab i Bitbucket Data Center — z recenzentami, przypisanymi osobami i etykietami wybranymi z repozytorium.',

  // The landing page: stats, showcase, security, disclaimer, downloads.
  'nav.language': 'Język',
  'stat.platforms': 'platformy — macOS, Windows i Linux',
  'stat.languages': 'języków, razem z podręcznikiem',
  'stat.pages': 'stron podręcznika w aplikacji',
  'stat.servers': 'naszych serwerów po drodze',
  'showcase.more': 'Przeczytaj stronę podręcznika',
  'more.title': 'I więcej — zbudowane, opisane i już dziś w aplikacji',
  'hosts.title': 'Działa z Twoim hostingiem',
  'hosts.beta': 'beta',
  'ai.compatible': 'dowolny zgodny endpoint',
  'sec.keychain.title': 'Najpierw pyta o pęk kluczy',
  'sec.keychain.body':
    'Tokeny są szyfrowane pękiem kluczy systemu, a aplikacja pyta, zanim go użyje. Odmów, a nadal będzie działać.',
  'sec.server.title': 'Jeden token, jeden serwer',
  'sec.server.body':
    'Token do github.com, Enterprise, GitLab lub Data Center trafia wyłącznie do serwera, dla którego go zapisano.',
  'sec.plain.title': 'git nigdy nie widzi tokenu jawnie',
  'sec.plain.body':
    'Trafia do gita przez prywatny endpoint, osobny dla każdej operacji — nie przez <code>.git/config</code>, nie przez wiersz poleceń, nie przez zmienne środowiskowe.',
  'sec.confirm.title': 'Destrukcyjne znaczy potwierdzone',
  'sec.confirm.body':
    'Force push, odrzucenie zmian, twardy reset: potwierdzenie mówi dokładnie, co przepadnie, a wcześniej robiona jest migawka.',
  'themes.title': 'Motywy, skróty, profile — i kapibara',
  'themes.body':
    'Jasne i ciemne motywy, także generowane przez AI. Profil na każdą tożsamość, przypisany do repozytorium. Uruchamiaj i debuguj z <code>launch.json</code> i zobacz w panelu na dole, co mówią <code>tsc</code>, ESLint czy Clippy.',
  'honest.title': 'Uczciwe zastrzeżenie',
  'honest.body':
    'GitHuttBr jest młody. <strong>GitHub</strong> to najlepiej sprawdzona ścieżka. GitHub Enterprise Server, samodzielnie hostowany GitLab i Bitbucket Data Center są w wersji <strong>beta</strong> — testowane na symulowanych serwerach, jeszcze nie na prawdziwych. Jeśli coś się zepsuje: cóż, <em>u mnie działa</em>. Zgłoszenia i PR-y mile widziane. 💜',
  'download.yours': 'Twój system',
  'download.macHint':
    'Podpisany identyfikatorem Developer ID i poświadczony przez Apple: otwiera się jak każda inna aplikacja i sam się aktualizuje.',
  'download.autoUpdate': 'Aktualizuje się sam z każdym nowym wydaniem.'
}
