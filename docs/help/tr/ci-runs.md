---
title: CI çalıştırmaları
category: Eşitleme ve çoklu depo
order: 59
summary: GitHub Actions, GitLab pipeline'ları, Azure Pipelines ve Forgejo Actions'ı uygulamadan takip edin — her job, adımları ve logu, yeniden çalıştırma ve iptal ile.
keywords: ci çalıştırmaları ci runs actions workflow pipeline derleme build github actions gitlab pipelines azure pipelines forgejo actions job'lar jobs adımlar steps loglar logs yeniden çalıştır rerun re-run iptal cancel dispatch workflow_dispatch rozet badge durum status grafik graph başarısız test başarı oranı ilerleme
---

# CI çalıştırmaları

Push ettiniz ve şimdi bekliyorsunuz: tarayıcıya geçin, depoyu bulun, Actions'ı açın,
çalıştırmanızı bulun, kırmızıya dönen job'u açın, logun sonuna kaydırın. **CI
çalıştırmaları** bu döngüyü kodun yanına koyar. Tek bir sayfa her workflow'un son
zamanlarda nasıl gittiğini söyler, uzak deponun çalıştırmalarını en yeniden başlayarak
listeler ve başarısız bir çalıştırmayı doğrudan bozulan testte açar — dosya ve satırla,
düzenleyicinize bir tık uzaklıkta. Yeniden çalıştırma ya da durdurma düğmeleri kartın
üzerindedir.

Sunucunun kendi API'siyle, GitHuttBr'ye zaten verdiğiniz token ile konuşur. Kendi
makinenizde hiçbir şey çalışmaz — onun için [Yerel CI](local-ci.md)'ya bakın.

![CI çalıştırmaları sayfası: her workflow için son çalıştırmalarıyla bir kart, Başarısız ve Çalışıyor filtreleri, süren bir çalıştırmanın ilerlemesi ve bozulan testte ve job'larında açılmış başarısız bir çalıştırma](../../screenshots/ci-runs.webp)

## Açmak

**Araçlar → CI çalıştırmaları…** ya da komut paletinde (⌘K) *CI çalıştırmaları*.
Sayfa, wiki ve içgörüler gibi deponun sekmesinde açılır ve `origin` adlı uzak depoyu
okur — `origin` yoksa ilk uzak depoyu.

## Sayfanın gösterdikleri

| Parça | Nedir |
|---|---|
| **Workflow kartları** | Her workflow için bir kart: onu neyin tetiklediği, bitmiş son 10 çalıştırmasındaki başarı oranı (%90'dan itibaren yeşil, %70'ten itibaren kehribar, altı kırmızı), bu çalıştırmalar renkli kareler olarak — en eskisi solda, böylece en yenisi "şimdi"nin yanında durur — ortalama süresi ve ya en yavaş job'u ya da son çalıştırmasının nasıl bittiği. Yalnızca o workflow'un çalıştırmalarını listelemek için bir karta tıklayın; hepsini göstermek için yeniden tıklayın |
| **Tüm dallar / geçerli dal** | Uzak depodaki her çalıştırma ya da yalnızca checkout ettiğiniz dalınkiler |
| **Başarısız / Çalışıyor** | Her birinin bırakacağı çalıştırma sayısıyla hızlı filtreler. Diğer filtrelerin bıraktığını sayarlar, yani sayı bir tıklamanın göstereceği şeydir |
| **Filtre** | Yüklenmiş çalıştırmaları başlık, workflow, dal, yazar, commit ya da olaya göre daraltır |
| **Bir çalıştırma kartı** | Commit'in başlığı (ya da workflow'un adı), ardından dal, workflow ve çalıştırma numarası, onu neyin başlattığı (push, pull request, zamanlama, elle…), kimin başlattığı ve commit — kopyalamak için commit'e tıklayın. Çalıştırma bir pull request'e aitse **PR #n** o pull request'in sayfasını açar. Sağda: hangi durumda olduğu, ne kadar sürdüğü ve ne kadar önce olduğu |
| **Süren bir çalıştırma** | *Çalışıyor · adım 3 / 5*, bir ilerleme çubuğu ve şimdiye kadarki süre. Adım, çalışan job'unkidir; adımı olmayan bir sunucuda (GitLab, Forgejo) bunun yerine job'ları sayar |
| **Başarısız test** | Başarısız bir çalıştırma kendiliğinden açılır, en yenisi önce, logunun adını verdiği testle: job, test, hatanın ilk satırı ve **yol:satır** — o satıra gitmek için ona ya da *Düzenleyicide aç*'a tıklayın. Bir pull request'in [Kontroller sekmesi](hosting.md#kontroller-sekmesi) ile aynı okuma |
| **Job'lar** | Altında her job, durumu ve süresiyle; sunucunun aşamaları olduğu yerde (GitLab, Azure) aşamaya göre gruplanır. *Adımları ve logu gör* bir job'un adımlarını ve logunun sonunu açar — başarısız bir job'da her zaman oradadır, diğerlerinde job'un üzerine geldiğinizde belirir |
| **Adımlar** | Bir job'un her adımı, durumu ve süresiyle — GitHub, Azure ve Forgejo bunları bildirir; GitLab'de adım yoktur |
| **Log** | Bitmiş bir job'un logunun sonu, renkleri korunmuş. Yalnızca son 512 KB alınır — hatanın olduğu yer — ve başı atlandığında sayfa bunu söyler |

Sayfada kuyrukta bekleyen ya da çalışan bir şey olduğu sürece liste sunucuya her 15
saniyede bir yeniden sorar, onunla birlikte açık çalıştırmanın ve süren her
çalıştırmanın job'larını da — adım sayısı oradan gelir; süreler her saniye ilerler.
İki dakikalık yanıtlar yeni bir şey getirmediğinde — örneğin bir dağıtım onayı
bekleyen bir çalıştırma — dakikada bire yavaşlar ve bir şey kıpırdar kıpırdamaz yeniden
hızlanır. Her şeyin bittiği bir liste, yenileye basana kadar hiçbir şey sormaz ve
pencere gizliyken hiçbir şey sorulmaz.

Sunucunun başlıksız gönderdiği bir çalıştırma — her GitLab pipeline'ı, zamanlanmış bir
Azure derlemesi — commit grafikteyse commit'inin konu satırıyla adlandırılır, yerel
deponuzdan bedavaya okunur; değilse numarasıyla.

## Yeniden çalıştırma, iptal, başlatma

| Düğme | Ne zaman görünür | Ne olur |
|---|---|---|
| **Başarısızları yinele** | Çalıştırma başarısız oldu ya da iptal edildi | Yalnızca geçmeyen job'lar yeniden çalışır |
| **Yeniden çalıştır** (↻) | Çalıştırma bitti, GitHub'da — üzerine geldiğinizde kartta | Her job yeniden çalışır |
| **Tarayıcıda aç** | Bir kartın üzerine gelindiğinde | Sunucunun sitesindeki çalıştırma |
| **İptal** | Çalıştırma kuyrukta ya da çalışıyor | Önce sorar: süren job'lar kesilir ve yaptıkları iş kaybolur |
| **Workflow çalıştır** | Sunucu elle başlatmaya izin veriyor | Workflow'u ve bir dalı seçin; o dal push edilmiş gibi başlar ve birkaç saniye sonra listede görünür |

Her sunucunun izin verdikleri:

| Sunucu | Liste ve job'lar | Adımlar | Log | Tümünü yinele | Başarısızları yinele | İptal | Elle başlat |
|---|---|---|---|---|---|---|---|
| **GitHub** (ve Enterprise Server) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ — workflow'un bir `workflow_dispatch` tetikleyicisi olmalı |
| **GitLab** (ve self-managed) | ✓ — pipeline'lar, aşamaya göre job'lar | — | ✓ | — | ✓ (*Retry*) | ✓ | ✓ — daldaki `.gitlab-ci.yml`'yi çalıştırır |
| **Azure DevOps** | ✓ — derlemeler, aşamaya göre job'lar | ✓ (görevler) | ✓ | — | ✓ | ✓ | ✓ — deponun herhangi bir derleme tanımı |
| **Forgejo / Gitea** | ✓ Actions runs API'si olan sunucularda | ✓ | ✓ sunucu bunu bir token'a sunduğunda | — | — | — | — |
| **Bitbucket** | — | | | | | | |

## Grafikteki rozetler

Aynı CI, grafikte her commit'in yanında küçük bir rozet olarak da görünür: yeşil,
kırmızı ya da çalışırken bir saat. Job'lar için üzerine gelin; sunucunun sayfası için
tıklayın. Rozetlerin kaynağı:

| Sunucu | Kaynak |
|---|---|
| GitHub | Commit'in check run'ları — yalnızca Actions değil, GitHub'a rapor veren her CI |
| GitLab | Her pipeline job'unu içeren commit durumları. Elle çalıştırılan bir job (örneğin bir dağıtım) rozeti saatte takılı bırakmaz |
| Azure DevOps | Deponun en son 100 derlemesi, commit'e göre eşleştirilmiş |
| Forgejo / Gitea | Commit'in birleşik durumu — Forgejo Actions ve her harici CI |
| Bitbucket Data Center | Commit'in derleme durumları |

Her yanıt hatırlanır — "burada CI yok" dahil — ve bir commit yalnızca yanıtı
değişmiş olabileceğinde yeniden sorulur: çalışırken her 45 saniyede, bittiğinde her 10
dakikada ve hiç CI'ı olmamış bir commit için giderek daha seyrek. Bu, kalabalık bir
grafiği sunucunun saatlik kotası içinde tutar.

## Sınırlar

- **Kartlar yalnızca sayfanın listelediği çalıştırmaları bilir.** Bu, geçerli dal
  filtresinin son 50 çalıştırmasıdır — seyrek çalışan bir workflow ondan az kare
  gösterebilir ve geçerli dala geçmek her kartı yeniden hesaplar. En yavaş job, sayfa
  bitmiş bir çalıştırmanın job'larını okuduğunda belirir (açtığı başarısız çalıştırma
  yeterlidir); o zamana kadar kart son çalıştırmanın nasıl bittiğini söyler.
- **Başarısız test, logun metninden okunur.** Vitest, Jest ve pytest tanınır; başka
  herhangi bir çalıştırıcı, bir derleme hatası ya da kısa kesilmiş bir log yalnızca job
  listesini gösterir. Çalıştırıcının checkout dışına yazdığı bir yol açılamaz.
- **PR #n, sunucunun söylediğine bağlıdır.** GitHub pull request'i yalnızca aynı
  depodan gelen çalıştırmalar için listeler, fork'tan gelenler için değil; GitLab bunu
  merge request pipeline'ları için, Azure PR derlemeleri için söyler. Forgejo
  çalıştırmaları bağlantı taşımaz.
- **Log sondur, ve ancak bir job bittiğinde.** GitHub ve Forgejo bir job'un logunu o
  bittikten sonra verir; çalışırken sayfa çıktısını değil, ilerleyen adımlarını
  gösterir. GitLab ve Azure süren bir job'un şimdiye kadarki logunu verir — daha
  fazlasını okumak için yeniden açın.
- **Token'ın CI erişimi olmalı.** İnce ayarlı bir GitHub token'ı listelemek için
  *Actions: read*, yeniden çalıştırmak, iptal etmek ya da başlatmak için *Actions:
  write* ister; klasik bir token `repo` ister. Bir GitLab token'ı listelemek için
  `read_api`, düğmeler için `api` ister. Bir Azure token'ı *Build: read* ister
  (düğmeler için *Build: read & execute*); olmadan sayfa ve rozetler hata vermek yerine
  boş kalır.
- **Azure rozetleri yalnızca 100 derleme geriye uzanır.** Daha eski bir commit'in
  rozeti yoktur, ama CI çalıştırmaları sayfası derlemesini yine listeler.
- **Azure'da yeniden çalıştırma "başarısızları yeniden dene"dir.** Aşamaları olan YAML
  pipeline'larında çalışır; klasik bir pipeline bunu reddedebilir ve sayfa sunucunun
  yanıtını gösterir.
- **Bir workflow başlatmak girdilerini sormaz.** Varsayılanı olmayan zorunlu girdileri
  olan bir GitHub workflow'u ya da GitLab pipeline'ı, sunucu tarafından kendi mesajıyla
  reddedilir.
- **Forgejo salt okunurdur, ve yalnızca yeni sunucularda.** Eski Forgejo ve Gitea
  sunucularında çalıştırmaları listeleyecek bir API yoktur; sayfa sunucunun
  desteklenmediğini söyler ve grafik rozetleri commit durumları üzerinden çalışmaya
  devam eder. Token'ın göremediği bir depo "desteklenmiyor" olarak değil, erişim
  hatası olarak görünür.
- **Bitbucket'ın çalıştırmalar sayfası yoktur.** Data Center'da CI yalnızca bir durum
  bildiren harici bir sistemdir (Jenkins, Bamboo…) — o durum grafik rozetidir.
  bitbucket.org Pipelines desteklenmez.
- **Tek uzak depo.** Sayfa `origin`'i okur; bir fork'un diğer uzak deposundaki
  çalıştırmalar listelenmez.

**Ayrıca bakın:** [Yerel CI](local-ci.md) · [Sunucular ve pull request'ler](hosting.md)
