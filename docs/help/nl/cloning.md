---
title: Klonen
category: Begin hier
order: 2
summary: Kloon vanaf een URL of rechtstreeks bij je host — en beperk wat er binnenkomt als de repository enorm is.
keywords: clone klonen achtergrond background annuleren cancel abort meerdere several batch veel repository's alles selecteren select all shallow depth partial filter blob none single branch submodules recursive ls-remote branchkiezer branch picker unshallow monorepo
source: 3d8942b1073ef47bd000c7887afb5ea8cdebcdd7
---

# Klonen

**Nieuwe repository → Klonen**, of `⌘K` → *Klonen*. Plak een URL, of log in bij
GitHub, GitLab, Bitbucket of Azure DevOps en kies uit je eigen repository's — het
token van het gekozen [profiel](profiles.md) wordt voor de kloon gebruikt en
daarna losgelaten, nooit in `.git/config` geschreven.

Kies een bovenliggende map en een naam; de regel onder de velden laat precies
zien waar de repository terechtkomt. Een map die al bestaat wordt geweigerd in
plaats van erin samengevoegd.

## Meerdere repository's tegelijk

Een nieuwe machine inrichten, of alle services van een team binnenhalen,
betekende vroeger dit venster één keer per repository openen. Vink in een
hosttabblad het vakje aan bij elke repository die je wilt, of kies **Alles
getoonde selecteren** om alles te nemen wat het filter vindt. Een klik op een rij
(niet op het vakje) kiest nog steeds alleen die ene.

Met meer dan één aangevinkt kloont het venster ze allemaal in dezelfde
bovenliggende map, elk in een map met de naam van de repository. De paden staan
opgesomd voordat je begint. Hebben twee dezelfde naam (`org-a/app` en
`org-b/app`), dan krijgen beide de eigenaar in hun mapnaam (`org-a-app`,
`org-b-app`) in plaats van om één map te strijden.

![Het GitHub-tabblad van het kloonvenster met drie aangevinkte repository's, de mappen waarin ze terechtkomen onder de bovenliggende map, en een knop 3 repository's klonen](../../screenshots/clone-multi-select.webp)

De reeks gaat meteen naar het bakje in de hoek. Er lopen drie klonen tegelijk en
de rest wacht als *In wachtrij*; elk heeft een eigen annuleerknop. Elke
repository opent in een tabblad zodra hij klaar is.

Beperkingen:
- **Uit te checken branch** is verborgen voor een reeks: een branchnaam zegt
  niets over verschillende repository's heen, dus elke krijgt zijn
  standaardbranch. De andere opties onder Geavanceerd (partial, shallow, één
  branch, submodules) gelden voor alle.
- Meervoudige selectie werkt alleen in de hosttabbladen. Het URL-tabblad neemt
  één URL.
- Eén mislukking houdt de andere niet tegen. Een repository waarvan de map al
  bestaat, mislukt met zijn eigen fout en de rest gaat door.

## Geavanceerd — de kloon versmallen

Alles onder **Geavanceerd** staat standaard uit: laat het met rust en je krijgt
een gewone, volledige kloon. Het verdient zijn plek bij repository's waar
"volledig" twintig minuten en meerdere gigabytes betekent.

![Het kloonvenster met Geavanceerd open: partial, shallow, single-branch, submodules en een branchkiezer](../../screenshots/clone-advanced.webp)

| Optie | Wat git doet | Wat het kost |
|--------|---------------|--------------|
| **Partial clone** | `--filter=blob:none` | Volledige geschiedenis, geen bestandsinhoud. Blobs komen op afroep binnen, dus een oud bestand openen vraagt het netwerk. |
| **Shallow clone** | `--depth=N` | Alleen de nieuwste N commits bestaan. Blame, log, bisect en range-diff stoppen bij de snede. |
| **Slechts één branch** | `--single-branch` | De andere branches blijven op de remote tot je ze fetcht. |
| **Submodules klonen** | `--recurse-submodules` | Elke submodule wordt ook uitgecheckt — nu meer tijd, later geen ontbrekende mappen. |
| **Uit te checken branch** | `--branch <name>` | Begint op die branch in plaats van op de standaardbranch van de remote. |

**Partial vóór shallow.** Een partial clone houdt elke commit — de geschiedenis
blijft doorzoekbaar, en alleen bestandsinhoud wordt lui opgehaald. Een shallow
clone gooit de geschiedenis werkelijk weg: `git log` eindigt bij de snede en
blame kan er niet voorbij kijken. Kloon je een monorepo om erin te werken, dan is
partial meestal wat je wilt.

Shallow is terug te draaien: `git fetch --unshallow` in de [terminal](terminal.md)
vult de geschiedenis weer aan.

### De branch kiezen

Typ een branchnaam, of druk op **Branches tonen** om de remote te vragen wat hij
heeft (`git ls-remote --heads`) en kies uit een keuzelijst. Dat is één rondje
over het netwerk, en alleen wanneer jij op de knop drukt — tijdens het typen
wordt er niets bevraagd.

Mislukt de opsomming — een privé-URL zonder token, een typfout, geen netwerk —
dan blijft het veld een gewoon tekstvak en meldt de kloon zelf de echte fout.

### Twee opmerkingen over de vlaggen

- **`--depth` impliceert `--single-branch`.** Bij een shallow clone is *Slechts
  één branch* uitgevinkt laten juist wat de andere branches terugvraagt
  (`--no-single-branch`), en daarom verandert de hint eronder.
- **Een lokale map klonen** negeert `--depth` normaal volledig, omdat git de
  objectopslag hardlinkt in plaats van op te halen. Gitcito kloont via een
  `file://`-URL wanneer je om een shallow kopie van een lokale repository vraagt,
  zodat de diepte die je vroeg de diepte is die je krijgt.

## Voortgang, achtergrond en annuleren

De balk rapporteert wat git rapporteert: tellen, comprimeren, ontvangen,
oplossen, uitchecken. Een fase die geen totaal kan melden toont een onbepaalde
balk in plaats van een nep-percentage.

Een grote kloon duurt minuten, en een verdwaalde klik naast het venster kostte je
vroeger alles. Nu verbergt het sluiten van het venster — **Op de achtergrond
uitvoeren**, `Esc`, het ✕ of een klik ernaast — het alleen: de kloon gaat door en
verhuist naar een kleine kaart in de benedenhoek met dezelfde voortgangsbalk. Je
kunt intussen een andere kloon starten; elke krijgt een eigen kaart.

![Het kloonbakje in de benedenhoek: drie klonen die ontvangen, oplossen en tellen, een vierde in de wachtrij, elk met een eigen annuleerknop](../../screenshots/clone-tray.webp)

De verkeerde repository gekozen? **Kloon annuleren** in het venster, of het ✕ op
de kaart, stopt git en verwijdert de half geschreven map. Verder wordt er niets
aangeraakt — de map bestond niet voordat de kloon begon, en dat wordt vooraf
gecontroleerd. Een geannuleerde kloon kan niet worden hervat; opnieuw starten
begint bij nul.

Als hij klaar is, opent de nieuwe repository in een tabblad, vastgezet aan het
profiel waarmee je kloonde, of het venster nu nog open is of niet.

Klonen lopen binnen de app, dus Gitcito afsluiten stopt ze. Het afsluiten wacht
niet op het opruimen, dus de half geschreven map kan achterblijven — verwijder
hem voordat je daar opnieuw kloont, want het venster weigert een map die bestaat.
