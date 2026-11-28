---
title: Pull request sayfası
category: Eşitleme ve çoklu depo
order: 57
summary: Bir deponun tüm pull request’leri tek sayfada — duruma göre, yazar, inceleyen, hedef ve CI ile süzülmüş —, bir PR’ın içinden süzülmüş listede ilerlemek için ‹ ›, commit’leri, güncellemeleri (her push, neyi değiştirdiği, son ziyaretinizden beri ne yeni) ve diff’inin bir satırına yorumlar. Konuşma tek bir zaman çizelgesi olarak, son ziyaretinizden beri yeni olanlarla.
keywords: pull request’ler liste sayfa merge request pr mr filtre yazar inceleyen benimkiler incelememi bekleyenler benden inceleme istenen ci başarısız hedef dal taslaklar birleştirilen kapalı arama önceliklendirme önceki sonraki alt ok gezinme checkout kaynak dala git hedef dala git dal adını kopyala fetch satır yorumu satır içi yorum inceleme yorumu diff yorumu satıra yorum yap dosyalar sekmesi kod incelemesi line comment commit sekmesi commit listesi pr commit’leri commit geçmişi commit aç sha kopyala pr dalını getir markdown düzenleyici biçimlendirme çubuğu önizleme bahsetme commits tab commit list open commit copy sha markdown editor toolbar preview mention dosya ağacı klasör ağacı ağaç görünümü yol görünümü görülen dosyalar klasörü görüldü işaretle düzenle sil kaldır düzenlendi yazım hatası file tree viewed files edit delete edited typo referans başlık üzerine gelince kart work item AB# issue numarası ipucu reference title hover card issue number fork pr commit’leri refs/pull head işlenmiş yorumlar görseller izleme pikseli engellenmiş görsel yüklemek için tıkla görev tablo blok rendered comments images blocked image güncellemeler yinelemeler push’lar force push rebase geçmiş yeniden yazıldı diff sürümleri son ziyaretten beri ne değişti yeni rozeti görüldü olarak işaretle güncellemeyi karşılaştır updates iterations history rewritten diff versions what changed since last visit new badge mark as seen compare update konuşma zaman çizelgesi açık başlıklar çözülmüş başlık onayladı değişiklik istedi gönderilen commit’ler inceleyen rolü son ziyaretinizden beri yeni iki commit’i karşılaştır commit tür çipleri commit başına ci diff’i göster sonraki görülmemiş filtre görülmemiş yorumlu inceleme ilerlemesi görüldükten sonra değişti conversation timeline open threads resolved thread approved requested changes pushed commits reviewer role new since last visit compare two commits commit type chips conventional commits ci per commit view diff next unviewed filter unviewed with comments review progress changed since viewed
source: d91d96af92225cb74da274f8d168b07f6110b709
---

# Pull request sayfası

Yoğun bir depoda aynı anda yirmi pull request açıktır. Kenar çubuğu onları
listeler, ama her birine bir satır pek bir şey söylemez: hangisi kimin, hangileri
sizi bekliyor, hangileri kırmızıya döndü. Bunu öğrenmek için her birini açmak,
okumak, geri dönmek, sonrakini açmak gerekiyordu. **Pull request sayfası** bu
soruları tek ekranda yanıtlar ve bir pull request’i açtığınızda **‹ ›** geri
dönmeden sizi aynı listenin bir sonrakine götürür.

![Komuta merkezinden açılmış pull request sayfası: ikisi incelemeni bekliyor, üçü senin, diğerleri katlanmış; her satırda boyutu, her inceleyenin durumu, kontrolleri ve son ziyaretinden bu yana değiştiği yerde bir nokta](../../screenshots/pull-requests.webp)

## Açmak

- Kenar çubuğundaki **PULL REQUEST’LER** başlığında **liste simgesi** (*Tüm pull
  request’leri gör*).
- Komut paletinde (⌘K) *Pull request’ler…* ya da **Araçlar → Pull
  request’ler…**.
- [Komuta merkezinde](mission-control.md) bir deponun satırındaki **pull request
  çipi**. Oradan açıldığında sayfa **← Görev kontrole dön** ile başlar ve pull
  request’lerinden birini açıp **← Pull request’ler** ile geri döndüğünüzde de onu
  korur.

Wiki ve [CI çalıştırmaları](ci-runs.md) gibi, sayfa deponun sekmesinde açılır.

## Durumlar

Aramanın solundaki bölmeli düğme, her birinde kaç tane olduğuyla birlikte dört
durumu tutar.

| Durum | Ne içerir |
|---|---|
| **Açık** | Taslaklar dahil tüm açık pull request’ler |
| **Taslaklar** | Yalnızca taslak olarak işaretlenmiş açık olanlar |
| **Birleştirilen** | Birleştirilmiş pull request’ler, sekmeyi ilk açtığınızda okunur |
| **Kapalı** | Birleştirilmeden kapatılanlar (reddedilen, bırakılan), Birleştirilen ile birlikte okunur |

Açık ve Taslaklar yanındaki sayılar, kenar çubuğunun zaten tuttuğu listeden
gelir. Birleştirilen ve Kapalı yalnızca birini açtığınızda ve oturum başına bir
kez istenir; **Yenile** yeniden ister.

## Filtreler

| Filtre | Bıraktığı |
|---|---|
| **Ara** | Başlığı, açıklaması, yazarı, dalları veya numarası yazılan her kelimeyi içeren pull request’ler. `#482` ya da `482` o numarayı bulur; eşleşmeler başlıkta vurgulanır |
| **Yazar** | Tek bir yazar — her biri bu sekmede kaç tane olduğuyla listelenir. **Ben** ilk sıradadır |
| **İnceleyen** | İstenen tek bir inceleyen ya da **Benden inceleme istenen** |
| **Hedef dal** | O dala açılan pull request’ler |
| **İncelememi bekleyenler** | *İnceleyen: benden inceleme istenen* için kısayol |
| **Benimkiler** | *Yazar: Ben* için kısayol |
| **CI başarısız** | Head’inin kontrolleri başarısız olan pull request’ler |

Arama ve üç çip aynı satırı paylaşır; her çip, geçerli durumdaki pull
request’lerden kaçını bırakacağını söyler. **Yazar**, **İnceleyen** ve **Hedef
dal**, **Diğer filtreler ▾** altında durur; biri ayarlıyken bu düğme vurgulanır.

Herhangi bir filtre açıkken listenin üstündeki bir satır, durumdaki pull
request’lerin kaçının gösterildiğini ve hangi filtrelerin açık olduğunu söyler;
hepsini kaldırmak için **filtreleri temizle** vardır.

Filtreler depo başına **uygulama çalıştığı sürece** tutulur — sayfadan çıkın,
geri gelin, bıraktığınız gibidirler. Yeniden başlatmalar arasında bilerek
saklanmazlar: bir hafta sonra sessizce geri gelen “benimkiler, CI başarısız”
filtresi, gizlenmesini istemediğiniz pull request’leri gizlerdi.

### “Ben” kim

“Ben”, bu deponun çağrılarının sunucuda oturum açtığı hesaptır — deponun
[bağlı](profiles.md) olduğu profil, yoksa etkin olan — ve sunucunun kendisine
sorulur. Token kime ait olduğunu söyleyemediğinde (kullanıcı kapsamı yoksa) ya da
token yoksa, **Ben**, **Benimkiler** ve **İncelememi bekleyenler** sunulmaz.

## Liste

Açık ve Taslaklar, üzerlerinden geçtiğiniz sırayla üç bölüme ayrılır:

| Bölüm | Ne tutar |
|---|---|
| **İncelemeni bekleyenler** | Birinin senden inceleme istediği pull request’ler — başlık sarı |
| **Senin pull request'lerin** | Senin yazdıkların |
| **Diğerleri** | Geri kalan her şey; üstteki iki bölümde bir şey olduğu sürece **göster** arkasında katlıdır, bir arama ya da filtre onu açar |

Sunucu kim olduğunu söyleyemediğinde ayıklanacak bir şey yoktur ve liste tek bir
karttır. Birleştirilen ve Kapalı geçmiştir: tek kart, bölüm yok.

Her satır soldan sağa okunur:

| Parça | Ne gösterir |
|---|---|
| **Nokta** | Pull request, sayfasından son ayrılışından bu yana değişti. Hiç açmadığın birinde nokta yoktur — karşılaştıracak bir şey yoktur |
| **#** | Numara — açıkken yeşil, taslakta gri |
| **Başlık** | Başlık, [Conventional Commits](committing.md) türü renkli bir çip olarak (`feat`, `fix`, `docs`…), bir *taslak* rozeti. Altında: yazar (kendi pull request’lerinde yazılmaz), kaynak → hedef ve **N yorum** — son ziyaretinden bu yana başkaları yazdıysa **N yeni yorum** |
| **Boyut** | `+48 −12 · 4 dosya` — eklenen ve silinen satırlar, dokunulan dosyalar |
| **İnceleme** | Her inceleyenin geçerli kararı — **✓ bruno onayladı**, **✕ ana değişiklik istedi** — ardından kimden hâlâ istendiği, sarı renkte **● seni bekliyor**. Sunucu incelemelerin tamam olduğunu söylüyor ve kontroller başarısız olmadıysa **✓ birleştirmeye hazır**; kimseden istenmediyse ya da kimse yanıt vermediyse **inceleyen yok** |
| **Kontroller** | Head’in kontrolleri — `✓ 6/6`, `✕ 1 başarısız`, `● 2 çalışıyor`; sayılar için üzerine gelin |
| **Güncellendi** | En son ne kadar önce değiştiği; tarih için üzerine gelin |

### Her sunucu ne verir

Boyut, yorumlar ve kararlar her sunucunun listesinde yoktur ve sayfa bunları bulmak
için her pull request’i tek tek açmaz: listenin taşımadığı şey boş kalır, asla sıfır
olmaz.

| Sunucu | Boyut | Yorumlar | İnceleme kararları |
|---|---|---|---|
| **GitHub** | ✓ | ✓, hangilerinin yeni olduğuyla | ✓, ve *birleştirmeye hazır* — tüm liste için tek bir ek GraphQL isteği |
| **GitLab** | — | ✓ (yalnızca sayı) | Kimden istendiği; *birleştirmeye hazır* GitLab’in birleştirme durumundan |
| **Azure DevOps** | — | — | ✓ inceleyenlerin oylarından |
| **Bitbucket Data Center** | — | ✓ (yalnızca sayı) | ✓ |
| **Bitbucket Cloud** | — | ✓ (yalnızca sayı) | — |
| **Forgejo** | ✓ sunucu doldurduğunda | ✓ (yalnızca sayı) | Kimden istendiği |

Yorum sayısı konuşmanın yorumlarıdır — diff’in bir satırına yazılan yorumlar buna
dahil değildir. Token yoksa GitHub isteği atlanır ve bu sütunlar boş kalır.

Bir bölümün içinde satırlar en son etkinliğe göre sıralanır ve bir pull request’in
içindeki **‹ ›** onları çizildikleri sırayla dolaşır. Tıklamak pull request’in kendi
sayfasını açar ([Sunucular ve pull request’ler](hosting.md)). Bu sayfası olmayan
bir sunucuda satır pull request’i tarayıcıda açar.

Bir [fork checkout’unda](hosting.md#bir-forkun-üst-deposundaki-pull-requestleriniz) üst depodaki pull request’leriniz de
listelenir, *owner/repo üzerinde* olarak işaretlenir.

## Bir pull request’ten listede ilerlemek

![Süzülmüş listeden açılan bir pull request: ‹ 1 / 7 › ve geldiği filtreler](../../screenshots/pull-request-nav.webp)

Sayfadan açılan bir pull request, başlığının üstünde bir şerit gösterir:

- **← Pull request’ler** listeye, filtreler bıraktığınız gibi, geri döner.
- **‹ k / n ›** açtığınız listenin önceki veya sonraki pull request’ine geçer —
  süzülmüş liste, kendi sırasıyla, tıkladığınız andaki hâliyle. İpuçları her
  okun götürdüğü pull request’i adlandırır.
- **Alt+← / Alt+→** aynısını klavyeden yapar. **Ayarlar → Kısayollar** içinde
  yeniden atanabilirler. İmleç bir metin alanındayken (Option+← kelime kelime
  ilerlediğinde) ve odak terminaldeyken devre dışı kalırlar.

Geçiş sayfayı yerinde değiştirir; böylece on pull request’te gezinmek sekmede on
simge bırakmaz; listeden başka bir satır açmak da onu değiştirir.

**Başka herhangi bir yerden** — kenar çubuğundan, bir bildirimden — açılan bir
pull request, deponun açık pull request’lerinde sayfanın varsayılan sırasıyla
(Açık, filtresiz) ilerler. O listede de olmayan biri, örneğin bir stack’in
birleştirilmiş bir katmanı, yalnızca listeye dönüş yolunu gösterir.

## Bir pull request’in dalına gitmek

Bir pull request üzerinde çalışmak için onun dalının checkout edilmiş olması
gerekir — ve binlerce dalı olan bir depoda onu dal listesinde adıyla bulmak işin
yavaş kısmıdır. Bir pull request’in sayfasında **Dallar** alanı bunu sizin için
yapar:

- **Dal adı bir bağlantıdır.** Tıklamak o dalı checkout eder ve sizi deponun
  grafiğine, dalın ucuna götürür. Pull request’in sayfası sekmede açık kalır.
- **Yalnızca sunucuda var olan bir dal** önce fetch edilir — yalnızca o dal,
  bütün remote değil — ve onu izleyen yerel bir dal olarak checkout edilir.
  Zaten yerelde olan bir dala olduğu gibi geçilir — güncellenmez, bu yüzden pull
  request’in en son commit’lerini istediğinizde pull yapın.
- **Zaten üzerinde olduğunuz dal** bunun yerine *geçerli* olarak işaretlenir.
  Hiçbir şey checkout edilmez.
- Her adın yanındaki **kopyala düğmesi** onu panoya koyar.
- **Geri al** (⌘Z) bulunduğunuz dala geri döner ve checkout’un oluşturduğu yerel
  dalı siler — ancak o zamandan beri üzerine commit yaptıysanız dala
  dokunulmaz.

Başlıkta aynı iki hareket düğme olarak vardır: **Kaynak dala git** ve **Hedef
dala git**. Zaten üzerinde olduğunuz dalda da çalışırlar — sizi yalnızca depoya
götürürler. [Simge renkleri](themes.md#simge-renkleri) açıkken başlıktaki her düğmenin kendi rengi olur: yenile mavi, yapay zekâ incelemesi mor, önizleme turkuaz, kaynak dal yeşil, hedef dal turuncu (tarayıcıda aç gri kalır).

Siz tıklayana kadar hiçbir şeye bakılmaz: bir pull request’i açmak hiçbir dalı
okumaz ya da fetch etmez.

Yapmadıkları:

- **Bir fork’un kaynak dalı** başka bir depodadır, bu yüzden bağlantısı yoktur
  (kopyala düğmesi kalır). Hemen altında sunulan **Pull request’i yerelde
  önizle…**, onu burada çalıştırmanın yoludur. Hedef dal yine bağlantıdır.
- **Eşleşen remote yok.** Dal, URL’si pull request’in deposu olan remote’ta
  aranır. Yapılandırılmış hiçbir remote oraya işaret etmiyorsa bağlantı bir şey
  yapmaz ve ipucu nedenini söyler.
- **Silinmiş bir dal.** Birleştirilmiş bir pull request çoğu zaman dalını da
  götürmüştür; fetch bu durumda dalın remote’ta artık olmadığını söyler ve pull
  request’te kalırsınız.
- **Yerel değişiklikler.** Checkout yıkıcı değildir, bu yüzden onay yoktur — ve
  commit edilmemiş değişikliklerinizin üzerine yazılacaksa git checkout’u
  reddeder. Hata hangi dosyalar olduğunu söyler; onları commit edin ya da stash’e
  koyun ve yeniden tıklayın.
- **Bu pencere.** Checkout bu deponun çalışma ağacında gerçekleşir. Dal zaten
  başka bir [çalışma ağacında](worktrees.md) checkout edilmişse, bunun yerine o
  çalışma ağacının sekmesi açılır.

## Commit’ler

Kenar çubuğu bir pull request’te kaç commit olduğunu söylüyordu, hangileri
olduğunu hiç söylemiyordu. Her seferinde bir commit incelemek — çoğu pull
request’in okunması gereken biçim — sizi tarayıcıya gönderiyordu. Konuşma ile Güncellemeler arasındaki **Commit’ler** sekmesi onları listeler:

- En üstte **bir özet satırı**: kaç commit, kaç yazardan, pull request’in
  **+/−** değeri ve her [Conventional Commit](https://www.conventionalcommits.org/)
  türü için sayısıyla birlikte renkli bir çip — *feat 2 · fix 1 · test 1*, bunun ne
  tür bir değişiklik olduğunu daha tek satırını okumadan söyler. Özellikler yeşil,
  düzeltmeler ve geri almalar kırmızı, testler vurgu renginde, performans sarı,
  geri kalanı gri.
- **Önce en eskiler**, uygulandıkları sırayla, yazıldıkları günün altında
  gruplanmış. Tarih sırasının dışında rebase ile gelen bir commit taşınmak yerine
  kendine ait bir gün başlatır.
- Her satırda yazarın resmi (sunucu veriyorsa), konu — Conventional Commits’e
  uyuyorsa türü aynı renkli çip olarak, kapsamı soluk — yazar, ne kadar önce ve bu
  klonda bulunan bir commit için **+/−** değeri ile kaç dosyaya dokunduğu vardır.
  Ardından, sunucu o commit için bir çalıştırma bildiriyorsa bir **CI** noktası
  (yeşil geçti, kırmızı başarısız, sarı çalışıyor), kısa SHA ve **Diff’i göster**
  gelir. Sunucu söylüyorsa, iki ebeveynli bir commit’i bir **birleştirme** rozeti
  işaretler.
- Konudan fazlası olan bir commit, mesajının geri kalanını satırın altında
  gösterir.
- Üzerine gelince **Kopyala** tam SHA’yı panoya koyar ve **Tarayıcıda aç**
  commit’i sunucuda açar — sunucunun böyle bir sayfası varsa pull request’in içinde
  (GitHub, GitLab, Bitbucket Data Center), yoksa deponun commit sayfasında.

![Commit’ler sekmesi: bir pull request’in commit’leri güne göre gruplanmış, birinin tam mesajı açık](../../screenshots/pr-commits.webp)

Pull request’ten en son ayrılmanızdan sonra yapılan commit’ler bir **Son
ziyaretinizden beri yeni** çizgisinin altında durur — Konuşma sekmesindekiyle aynı
işaret, aynı ziyaretten.

**Diff’i göster** — ya da satıra bir tıklama, ya da Tab ile ona gelip Enter —
commit’i uygulamada, grafikte bir tıklamanın yapacağı gibi açar: deponun görünümü,
o commit seçili, ayrıntıları açık. Bu, bu klonda commit **varsa** çalışır. Yoksa
satır *henüz deponuzda değil* der ve düğmesi değişir:

- **Dalı getir** — [dala gitmek](#bir-pull-requestin-dalına-gitmek) ile aynı tek dallık fetch,
  checkout olmadan. Onunla gelen her commit sonra açılabilir; bu gelmediyse (o
  zamandan beri bir force push onu yeniden yazdıysa) bildirim bunu söyler.
- **Pull request’in commit’lerini al**, bir **fork**’tan gelen pull request’te. Dalı
  başka bir depodadır, ama çoğu sunucu bir pull request’in head’ini hedef depoda kendi
  ref’i altında yansıtır — `refs/pull/N/head` (GitHub, GitHub Enterprise Server,
  Forgejo), `refs/merge-requests/N/head` (GitLab), `refs/pull-requests/N/from`
  (Bitbucket Data Center). Uygulama yalnızca o ref’i, etiketler olmadan, kendine ait
  bir ref’e, `refs/githuttbr/pr/<remote>/N`, fetch eder ve commit diğerleri gibi
  açılır: grafik o head’i etiketsiz bir şerit olarak çizer. Yeniden fetch etmek ref’i
  head’in o anki hâline taşır. O zamandan beri bir force push commit’i dışarıda
  bıraktıysa bildirim bunu söyler.
- **Tarayıcıda aç**, fetch bir seçenek olmadığında.

**İki commit’i karşılaştır** iki satırı işaretlemenizi ister, ardından deponun
görünümünde ikisi arasındaki [karşılaştırmayı](merging.md#herhangi-iki-refi-karşılaştırma)
açar: eski olan tabandır, böylece birinden diğerine ne olduğunu görürsünüz —
aradaki commit’ler ve birleşik diff’leri. İkisi de bu klonda olmalıdır; iki tanesi
olana dek düğme soluk kalır.

Liste sayfayla birlikte değil, sekmeyi ilk açtığınızda okunur, ve her **Yenile**’de
yeniden. Gelene kadar sekmedeki sayı, sunucunun pull request için verdiği sayıdır.
Birleştirilmiş ve kapalı pull request’ler commit’lerini aynı şekilde listeler.

Yapmadıkları:

- **En fazla 250 commit.** GitHub’ın kendisi bir pull request için 250’den fazlasını
  listelemez; uygulama her sunucuda aynı sayıda durur ve öyleyse *barındırıcıda daha
  fazlası var* der, pull request’in sunucudaki bağlantısıyla birlikte. Hangi 250
  olduğu, sunucunun onları listeleme sırasına bağlıdır — uygulama önce listelenenleri
  tutar ve listenin üstündeki satır hangileri olduğunu söyler:

  | Sunucu | Daha uzun bir pull request gösterir |
  |---|---|
  | GitHub | **İlk** 250 (GitHub’ın kendi sınırı) |
  | GitLab, Azure DevOps, Bitbucket Data Center, bitbucket.org | **En yeni 250** |
  | Forgejo | Sunucu hangi ucu önce listelerse; sırası belgelenmemiştir |
- **Sunucunun yansıtmadığı yerde bir fork’un head’i.** Azure DevOps yalnızca bir
  birleştirme sonucunu yayımlar, bir pull request’in kendi head’ini asla; bitbucket.org
  ise ikisini de yayımlamaz: orada satır yalnızca tarayıcıyı sunar. Yansıtmadığı
  ortaya çıkan başka bir sunucuda fetch bunu söyler. **Pull request’i yerelde
  önizle…**, ihtiyacınız olan buysa, Azure’un birleştirme sonucunu getirir.
- **Fetch edilen head’ler kalır.** `refs/githuttbr/pr/…` bir dal değildir: checkout
  edilecek ya da push edilecek bir şey yoktur, prune’lu bir fetch ona dokunmaz ve git
  commit’lerini tutar. Onu kaldıran bir şey de yoktur — ne sayfayı kapatmak ne de
  [Dal temizliği](branch-cleanup.md). Onlardan kurtulmak için ref’leri elle silin:
  `git for-each-ref refs/githuttbr/pr` onları listeler, `git update-ref -d <ref>`
  birini siler.
- **Adında `/` olan bir uzak depo** o ref’in adının bir parçası olamaz, bu yüzden
  orada fetch reddedilir.
- **Silinmiş bir dal.** Birleştirilmiş bir pull request çoğu zaman dalını da
  götürmüştür: fetch bunu söyler. bitbucket.org, kaynak dal gidince hiç commit
  listelemez.
- **Squash birleştirmeleri.** Squash ile birleştirilmiş bir pull request’in
  commit’leri hiçbir zaman hedef dala ulaşmamıştır, bu yüzden dalı silindikten sonra
  yalnızca sunucuda bulunurlar.
- **Commit başına sayılar klonunuzdan gelir.** **+/−** ve dosya sayısı git’ten
  okunur, asla sunucuya sorulmaz; bu yüzden henüz getirilmemiş bir commit bunları
  göstermez, bir birleştirme de göstermez (değişikliği iki ebeveyne göredir).
  Bir commit’in dosyaları eksik olan kısmi bir klon, onları indirmek yerine hiçbir
  şey göstermez.
- **Yalnızca en son 40 commit için CI**, sessizce: commit başına bir istek uzun bir
  pull request’te birikir, ve CI genellikle zaten push edilen head’lerde
  çalışmıştır. Sunucu için kimlik bilgisi yoksa nokta da yoktur, asla oturum açma
  istenmez.
- **Tür çipleri konuyu okur.** Conventional Commits yazmayan bir ekip ne çip ne de
  tür sayısı alır — hiçbir şey tahmin edilmez.
- **Yazarlar**, commit’lerinin onları adlandırdığı gibi adlandırılır. GitLab, Azure
  DevOps ve Bitbucket Data Center, bir resmin gönderemeyeceği bir oturum açma
  olmadan resim vermez, bu yüzden bu satırlar baş harfi gösterir.
- **Azure DevOps’taki uzun mesajlar** kısalmış olabilir: Azure’un listesi bir
  commit’in mesajını keser ve uygulama ne gönderiyorsa onu gösterir.
- **bitbucket.org** pull request’leri tarayıcıda açılır — uygulamanın onlar için
  henüz bir sayfası yok —, bu yüzden uygulama listeyi okuyabilse de orada bu
  sekmeye ulaşılmaz.

## Güncellemeler

Pazartesi incelediğiniz bir pull request perşembeye kadar ilerlemiştir. Commit’ler
sekmesi onun şimdi nerede olduğunu gösterir, o zamandan beri ne olduğunu değil: hangi
commit’lerin hangi push ile geldiğini, birinin force push yapıp zaten okuduğunuzu
yeniden yazıp yazmadığını ve kodun *gördüğünüz sürüme kıyasla* nasıl göründüğünü.
Commit’ler ile Dosyalar arasındaki **Güncellemeler** sekmesi bunu yanıtlar — tıpkı
Azure DevOps’un kendi Updates sekmesi gibi.

Pull request’e yapılan her push’u **en yeniden başlayarak** listeler:

- **Güncelleme 1 — açılış**, pull request’in açıldığı push’tur; sonraki her push bir
  sonraki numarayı alır.
- Her biri **ne zaman** olduğunu, **kimin push ettiğini** (sunucu söylüyorsa) ve
  **eklenen commit’leri** gösterir — kısa SHA, konu, yazar. Sunucu bir push’un daldan
  çıkardığı commit’leri bildiriyorsa, bunlar üstü çizili olarak **Kaldırılan
  commit’ler** altında listelenir.
- Bir force push ya da rebase **geçmiş yeniden yazıldı** olarak işaretlenir:
  okuduğunuz commit’ler gitmiş olabilir ve listelenenler eski çalışmanın yeni
  kopyaları olabilir. Azure DevOps’ta pull request’i başka bir hedef dala taşıyan bir
  push **hedef değişti** olarak işaretlenir.

![Güncellemeler sekmesi: en yeniden başlayan push’lar, “geçmiş yeniden yazıldı” olarak işaretli bir force push, Yeni olarak işaretli bir tane](../../screenshots/pr-updates.webp)

### Bir güncellemede ne değişti

**Bu güncellemedeki değişiklikleri göster**, Dosyalar sekmesini yalnızca o push için
açar: önceki güncellemenin head’inden bunun head’ine kadar olan diff — ya da
Güncelleme 1 için, sunucunun o noktayı belirttiği yerde (Azure DevOps, GitLab),
açıldığı hedef daldan itibaren. Aynı dosya ağacı ve görüntüleyici, bir şeritle —
*Güncelleme 3 değişiklikleri (Güncelleme 2 ile karşılaştırmalı)* — ve tüm pull
request’e dönmek için **Tüm değişiklikleri göster**.

![Bir güncellemenin değişikliklerini gösteren Dosyalar sekmesi, dosya ağacının üstünde şeritle](../../screenshots/pr-update-diff.webp)

Diff, mümkün olduğunda her zaman **bu klonda** yapılır: iki head arasında `git diff`,
kesin ve sunucuya sormadan. Head’lerden biri eksikse, uygulama önce ikisini de pull
request’in uzak deposundan **commit kimlikleriyle** fetch eder — hiçbir dal, etiket
ya da ref yazılmaz; bir force push’un yerini aldığı bir head artık hiçbir dalda
değildir ama çoğu sunucu onu kimliğiyle hâlâ sunar — ve burada karşılaştırır. Ancak
bu fetch başarısız olursa sunucuya sorulur:

| Sunucu | Sunucunun karşılaştırması |
|---|---|
| Azure DevOps | `$compareTo` ile yinelemenin değişiklikleri — iki push arasında |
| GitLab | Depo karşılaştırması, doğrudan bir head’den diğerine |
| Bitbucket Data Center | Depo karşılaştırması — iki head’in **ortak tabanından** |
| GitHub | Compare API’si (`base...head`) — iki head’in **ortak tabanından** |
| Forgejo / Gitea | Yok: API’lerinde iki commit arasında diff yok |

Ortak tabandan, bir yeniden yazmanın diff’i push’un yaptığı şey değildir: kaldırdığı
şey gösterilmez ve hedef dalın o zamandan beri aldığı değişiklikler pull request’in
değişiklikleri gibi görünebilir. Geçmişi yeniden yazılmış bir güncelleme böyle
karşılaştırıldığında şerit bunu söyler — *Ortak tabandan karşılaştırıldı: bu push’un
kaldırdıkları gösterilmez.* Hiçbir şey işe yaramazsa şerit bunu söyler ve dalı (ya da
bir fork’tan pull request’in head’ini) fetch edip burada karşılaştırmayı önerir.

Satır yorumları tüm pull request’in diff’ine aittir, bu yüzden tek bir güncelleme
gösterilirken bir satırda **+** yoktur; şerit bunu söyler. Bir dosyayı görüldü olarak
işaretlemek her zamanki gibi çalışır — dosyayı pull request’te işaretler.

### Son ziyaretinizden beri yeni

Sekmeyi son açışınızdan beri push edilen güncellemeler bir **Yeni** rozeti taşır ve
sekmenin kendisi kaç tane olduğunu söyler: *Güncellemeler 5 · 2 yeni*. Sekmeyi açmak
onları görüldü olarak işaretler (hangilerinin yeni olduğunu görebilmeniz için siz
sekmedeyken rozetler kalır); sekme açıkken **Yenile** daha fazlasını getirirse,
**Görüldü olarak işaretle** onları temizler. Yalnızca pull request sayfasını açmak
hiçbir şeyi işaretlemez. Bir pull request’in Güncellemeler sekmesini ilk kez
açtığınızda hiçbir şey yeni değildir — karşılaştırılacak önceki bir ziyaret yoktur.

Güncellemeler o sayı için sayfayla birlikte, ve **Yenile** ile yeniden okunur —
gönderdiğiniz her yorum ya da incelemeden sonra değil.

Görülenler yalnızca bu bilgisayarda, depo ve pull request başına tutulur, sunucuya asla
gönderilmez.

### Sunucuya göre

| Sunucu | Güncellemelerin geldiği yer | Push eden | Kaldırılan commit’ler | Yeniden yazma algılanır |
|---|---|---|---|---|
| Azure DevOps | Pull request’in **yinelemeleri** — Azure’un her push’un kendi kaydı | Evet | Hayır (bildirilmez) | Evet: `forcePush` / `rebase` |
| GitLab | Merge request’in **diff sürümleri**; her sürümün commit’leri head’inden çıkarılır | Hayır (sürümler kimseyi adlandırmaz) | Evet | Evet: artık ulaşılamayan daha önceki bir head |
| Bitbucket Data Center | Pull request’in etkinliği: **OPENED** ve kaynak dalı taşıyan her **RESCOPED** | Evet | Evet, sunucunun toplamlarıyla | Evet: commit kaldıran bir rescope |
| GitHub | Zaman çizelgesinin commit’lerinden ve force push’larından **çıkarılır** — aşağıya bakın | Yalnızca force push’lar | Hayır | Evet: bir force push olayı |
| Forgejo / Gitea | Zaman çizelgesinin **push** kayıtları, ilki pull request’in kendisiyle yazılır | Evet | Hayır | Evet: bir force push kaydı |
| bitbucket.org | Kullanılamaz | — | — | — |

**GitHub sıradan bir push’un kaydını tutmaz** — yalnızca force push’ların —, bu yüzden
güncellemeler **commit zamanlarından çıkarılır**. Bir güncelleme, force push’lar
arasında birbiri üzerine kurulan bir commit dizisidir; bir öncekinin üzerine
kurulmayan ya da ondan on dakikadan fazla sonra gelen bir commit bir sonrakini
başlatır. Pull request açıldıktan sonra yapılmış bir commit açılışta olamaz. Yani bir
saat arayla yapılmış commit’lerin tek bir push’u ikiye **bölünmüş** görünür, birkaç
dakika arayla iki push ise **tek** görünür; sekme gruplamanın yaklaşık olduğunu
söyler. Zaman çizelgesinin force push’undan hemen önce listeleyebileceği bir rebase’in
yeni commit’leri o force push’a sayılır. Bir force push’un öncesi ve sonrası head’leri
kesindir, bu yüzden **Değişiklikleri göster** de kesindir.

### Sınırlar

- **Üst sınırlar.** En yeni 100 güncelleme listelenir. GitHub’ın zaman çizelgesi en
  yeni ucundan 500 öğeye kadar okunur; Bitbucket Data Center’ın etkinliği (o da en
  yeniden başlayarak) 1.000’e kadar; GitLab’in sürümleri ve commit’leri her biri
  300’e kadar; Forgejo’nun zaman çizelgesi 500 kayda kadar, daha uzunsa en yenileri.
  Bir sınır **açılışı** kestiğinde numaralar artık sunucununkiler değildir: sekme bunu
  söyler ve en sondan geriye sayar (*Son güncelleme*, *Güncelleme, sondan 2 önce*).
- **Azure DevOps** kaldırılan commit bildirmez; onun yerine bir force push ya da
  rebase işaretlenir. Azure’un commit listesini kısalttığı bir yineleme ayrıca okunur
  (500 commit’e kadar) ve güncelleme hâlâ eksikse bunu söyler.
- **GitLab** push edeni adlandırmaz. Head’i yeniden yazılarak gitmiş bir sürüm,
  commit’lerini bulmak için ayrıca okunur — bu tür en yeni on sürüm için —, oturum
  başına bir kez: sürümler asla değişmez.
- **Forgejo ve Gitea** bir force push için commit listelemez — yalnızca iki head’ini,
  ki **Değişiklikleri göster** bunları karşılaştırır —, ve bir force push’tan sonra
  açılışın ne içerdiğini hiçbir şey söylemez; bu yüzden sunucu açılışın kendi push’unu
  kaydetmediyse açılış boş kalır. API’lerinde iki commit arasında diff yoktur, bu
  yüzden o karşılaştırma iki commit’in de bu klonda olmasını gerektirir. Zaman
  çizelgesi API’si olmayan bir sunucu tüm commit’leri tek bir güncellemede gösterir.
- **Kimlikle fetch** etmek, bir commit’i kimliğiyle sunan bir sunucu gerektirir.
  GitHub bunu hâlâ tuttuğu her commit için yapar; başka bir sunucu ya da düz bir git
  sunucusu, hiçbir dalın göstermediği bir commit’i reddedebilir — o zaman sunucunun
  karşılaştırması kullanılır. Fetch edilen commit’ler bu klonda ref’siz durur ve git
  zamanla onları toplar.
- **Bitbucket Data Center’ın karşılaştırması** sunucunun yapılandırılmış diff’ini
  okur ve onu birleşik bir diff olarak çizer; çok büyük dosyalar kısaltılmış gelebilir.
- Yeniden yazılmış bir head **sunucudan** kalıcı olarak **gitmiş** olabilir (Azure ve
  GitLab onu tutar; diğerleri toplayabilir). O zaman hiçbir taraf karşılaştıramaz ve
  şerit bunu söyler.
- **bitbucket.org** pull request’leri tarayıcıda açılır ve Güncellemeler sekmeleri
  yoktur.

## Dosyaları okumak

İki yüz dosyalı bir pull request’i iki yüz tam yol olarak okumak zordur, yerinizi
kaybetmeden bitirmek de. Listenin ve diff’in üstünde bir satır sayımı tutar —
*9 dosyadan 4 tanesi görüldü*, bir çubukla — ve **Önceki görülmemiş** / **Sonraki
görülmemiş** yukarı ya da aşağı, henüz işaretlemediğiniz en yakın dosyaya gider,
listenin sonunda başa sarar; listelenen her şey görüldüğünde soluklaşırlar.
**İlerlerken görüldü olarak işaretle** kutusunu işaretlerseniz **Sonraki görülmemiş**
ilerlemeden önce açık dosyayı sizin yerinize işaretler — baştan sona okurken
kutulara hiç dokunmazsınız; seçim hatırlanır. **Göster** listeyi **Görülmemiş**
dosyalara ya da **Yorumlu** dosyalara (üzerinde herhangi bir inceleme konuşması
olan) daraltır, ve yeniden **Tümü**’ne döner.

**Dosyalar** sekmesinin listesinde commit panelindekiyle aynı **Yol / Ağaç** düğmesi
vardır ve seçim uygulamanın her yerinde aynıdır. **Ağaç** görünümünde dosyalar
klasörlerinin altında durur (`src/main/ipc` gibi bir zincir tek satırdır) ve her
klasör toplam **+/−** değerini ve dosyalarından kaçının görüldüğünü (*3/5*) gösterir.
Bir klasörün onay kutusu içindeki her dosyayı görüldü olarak işaretler ya da hepsini
temizler; işaretler yalnızca bu bilgisayarda tutulur, sunucuya asla gönderilmez. Bir
işaret dosyanın diff sürümünü hatırlar: bir push görülmüş bir dosyayı değiştirdiğinde
dosya bir **değişti** etiketiyle (*gördüğünüzden beri değişti*) yeniden görülmemiş sayılır.
Diff’i olmayan bir dosya (ikili, çok büyük) yalnızca durumu ve satır sayılarıyla
karşılaştırılır. İnceleme konuşmaları olan bir dosyanın adının hemen ardından konuşma balonu içinde bir sayı görünür, böylece yorumlu dosyalar uzun bir listede göze çarpar; eskimiş konuşmalar da sayılır, çözülmüş olanlar da — uygulamanın okuduğu sunucu listeleri hangilerinin çözüldüğünü söylemez. Bir klasörü katlamak için ona tıklayın ya da üzerindeyken ←/→ tuşuna
basın; ↑/↓ (veya j/k) ekrandaki dosyalarda ilerler ve her diff’i açar. Katlanmış
klasörler uygulama kapanana kadar pull request başına hatırlanır ve birinin içinde
açılan bir dosya ona giden yolu açar. Ağaç, sunucunun dosyaları listelediği sıraya
göre değil, ada göre sıralanır.

![Ağaç görünümünde Dosyalar sekmesi: toplam değişiklikleri ve görülen sayılarıyla klasörler, biri katlanmış](../../screenshots/pr-files-tree.webp)

**Görseller.** Bir pull request’in eklediği, sildiği veya değiştirdiği bir resmin (png,
jpg, gif, webp, bmp, ico, avif, svg) okunacak bir metin diff’i yoktur, bu yüzden sekme
onun yerine resmi gösterir — bir commit için olan görünümün aynısı: yeni, eski ya da
önce ve sonra yan yana ve bir kaydırıcıyla. Yeniden adlandırılmış bir resim, tabandaki
eski yolu head’deki yeni yolla karşılaştırır; tek bir güncellemenin diff’inde o
güncellemenin iki head’i karşılaştırılır. Baytlar, commit’ler bu klonda varsa
buradan gelir — ücretsiz ve hızlıdır —, yoksa deposunun profiliyle barındırıcıdan.
Sınırlar: 32 MB üzerindeki bir resmin önizlemesi yoktur; satır yorumları bir resme
uygulanmaz (bir SVG, metin diff’ini ve yorumlarını altında tutar); **Git LFS** içinde
tutulan bir resim barındırıcıdan okunur, çünkü klonda yalnızca işaretçisi vardır —
GitLab, Azure DevOps ve Forgejo onu çözer, GitHub’ın API’si yalnızca işaretçiyi verir,
bu yüzden orada sekme seni barındırıcıya gönderir; barındırıcının birleştirme tabanını
bildirmediği yerde (o zaman hedef dalın ucuna geri döner), bir not “önce”nin hedef
daldaki sonraki değişiklikleri içerebileceğini söyler; ve ne klon ne de barındırıcı
baytları veremediğinde sekme bunu söyler ve pull request’in dalını getirmeyi ya da onu
barındırıcıda açmayı önerir.

![Bir pull request’in değiştirdiği resim, önce ve sonra yan yana](../../screenshots/pr-image-diff.webp)

**Yollar ve düzenleyicin.** Diff’in üstündeki çubukta dosyanın yolunu kopyalamak için bir
düğme ve bir **⋯** menüsü vardır; listede bir dosyaya veya klasöre sağ tıklamak aynı
menüyü açar. Menü yolu, yeniden adlandırılmış bir dosyanın eski yolunu ya da klasörün
yolunu kopyalar; dosyayı [düzenleyicinde](editor.md) (veya başka bir uygulamada) açar ya
da dosya yöneticisinde gösterir. Bu son ikisi pull request’in sürümüne değil, **çalışma
kopyana** etki eder: yalnızca orada var olan bir dosya için etkindir (PR’ın sildiği ya
da dalının içermediği bir dosya nedenini söyler), ve çıkış yapılmış dal PR’ın dalı
olmadığında menü hangi dalı açacağını söyler.

**Geri dönmek.** Bir pull request’i depo, başka bir sekme ya da sonraki PR için bırak;
geri döndüğünde onu bıraktığın gibi bulursun: aynı sekme, aynı açık dosya, aynı kaydırma
ve gönderilmemiş her metin — yorum, yanıt, satır yorumu, düzenleme. Bu, pull request’i
kapatana ya da uygulamadan çıkana kadar sürer; yalnızca bellekte, son 50 pull request
için tutulur (bunun ötesinde en eski yer bırakılır ve içindeki metin açtığın sonraki
pull request sayfasına geçer). Gönderilmemiş metni olan bir PR’ı kapatmak önce sorar.
Bir yenileme taslağın yerinin artık olmadığını bulursa — yanıtladığı tartışma,
düzenlediği yorum, ait olduğu dosya —, metin kaybolmaz: kopyalaman ya da atman için
sayfanın üstünde bekler.

### Diff nereden geliyor

Bir inceleme, okuduğu diff kadar iyidir. Barındırıcının API’si bunun için iyi bir kaynak
değildir: Azure DevOps hiç diff göndermez, yalnızca bir dosya listesi gönderir ve her
birinin iki kez indirilip karşılaştırılması gerekir; GitHub 3000 dosyada durur ve büyük
bir dosyanın yamasını atlar; GitLab büyük bir diff’i *çok büyük* olarak işaretler ve
hiçbir şey göndermez. Bu yüzden Dosyalar sekmesi her barındırıcıda **önce bu klonu
okur**:

1. Barındırıcıya pull request’in iki commit’ini sorar — nerede başladığını ve head’ini.
   Azure DevOps, GitLab ve Forgejo birleştirme tabanını bildirir; Bitbucket Data Center,
   satır yorumlarının bağlandığı diff’in tabanını bildirir; GitHub yalnızca hedef dalı
   bildirir, o zaman onun head ile birleştirme tabanı burada hesaplanır (ya da
   commit’ler yoksa GitHub’ın karşılaştırmasıyla). Resim önizlemesi aynı iki commit’i
   kullanır.
2. İkisi de buradaysa aralarındaki bir `git diff` her dosyayı verir, sayılarına bir sınır
   olmadan. Bunlar barındırıcının kendi sayfasının karşılaştırdığı iki commit’in
   aynısıdır, bu yüzden buradaki bir satır numarası oradaki satır numarasıdır ve bir
   satır yorumu koyduğun yere düşer.
3. Burada değillerse pull request’in uzak deposundan **id ile** getirilirler — yalnızca
   nesneler, hiçbir dal oluşturulmaz ya da taşınmaz —, bir kez, sayfa açıldığında (ve
   Yenile’de yine), bu arada listenin üstünde *Pull request’in commit’leri
   getiriliyor…* görünür. Bir commit’i id ile vermeyen bir sunucu (bazı Azure DevOps’lar
   ve düz git sunucuları) sessizce atlanır.
4. Ancak o zaman barındırıcının API’si kullanılır ve onun diff vermediği bir dosya boş
   gibi davranmak yerine nedenini söyler (aşağıda).

Sonradan okunan bir dosya — *henüz yüklenmemişken* açılan ya da **Yeniden dene**’den
sonra — diğerleri gibi listeye katılır: aynı görüntüleyici ve üzerinde satır yorumları.

Azure DevOps’ta API yolu sekme açıldığında ilk yüz dosyayı okur, aynı anda üçer ve
toplamda bir dakika içinde; kalanları her birini açtığında okur. Kısıtlanan bir istek,
sunucunun istediği bekleme süresince tüm okumaları duraklatır; yine de başarısız olan
biri bunu nedeniyle birlikte söyler. Bir dosyanın metin olup olmadığına baytlarından
karar verilir, Azure’un *binary* bayrağından değil — Azure onu UTF-16 dosyalarına ve
ASCII olmayan metnin bir kısmına da koyar. Barındırıcı pull request’in içerdiğinden
daha az dosya listelediğinde (GitHub 3000’de durur), listenin üstündeki bir satır bunu
söyler.

### Bir dosya diff göstermediğinde

| Ne diyor | Neden | Ne yapabilirsin |
|---|---|---|
| **İkili** | Baytları metin değil: bir resim, bir arşiv. UTF-16 ve eski tek baytlık metin metin olarak tanınır. | Barındırıcıda aç. |
| **Gösterilemeyecek kadar büyük** | 20.000’den fazla değişen satır ya da 8 MB diff, veya 4 MB’ı aşan bir sürüm. Klon onu okuduysa **+/−** değeri yine de sayılır. | Barındırıcıda aç. |
| **Henüz yüklenmedi** | Tek bir okumanın tuttuğunun ötesinde (yaklaşık 150.000 diff satırı) ya da Azure DevOps’un API’siyle ilk yüz dosyanın veya dakikanın ötesinde. | Açtığında yüklenir; yüklenmezse **Diff’i yükle**. |
| **Yüklenemedi** | Okuma başarısız oldu — nedeni altında gösterilir. | **Yeniden dene**. |
| **Barındırıcı onu atladı** | Barındırıcının API’si diff göndermedi ve bu klonda pull request’in commit’leri yok. | **Yerelde görmek için pull request’i getir** — id ile commit’ler ya da bir fork’tan pull request’in head’i —, sonra diff burada oluşturulur. |
| **Yalnızca adı ya da kipi değişti** | Bir yeniden adlandırma ya da izin değişikliği: içerik aynı. | İçerikte incelenecek bir şey yok. |
| **Kodlaması değişti** | Aynı metin farklı kaydedilmiş: bir bayt sırası işareti eklenmiş ya da kaldırılmış, UTF-16 UTF-8’e çevrilmiş. | Değişikliğin kasıtlı olduğunu kontrol et — bazı araçlar bunu önemser. |

Listede diff’i okunmamış bir dosya — henüz yüklenmedi, yüklenemedi, barındırıcı atladı
— **+0 −0** yerine **—** gösterir; o, “hiçbir şey değişmedi” diye okunurdu. İkili bir
dosya ve salt bir yeniden adlandırma gerçek **+0 −0** değerlerini gösterir ve
barındırıcı satırları yine de saydığında (GitHub atladığı bir yama için bile sayar), o
sayılar gösterilir.

## Bir satıra yorum yapmak

Burada bir inceleme konuşmasına yanıt vermek mümkündü, ama yenisini başlatmak değil;
bu yüzden gerçek bir inceleme sizi yine tarayıcıya gönderiyordu. Bir pull request’in
**Dosyalar** sekmesinde diff’in her satırı kendi yorumunu alabilir:

- **Bir satırın üzerine gelin** ve numarasının üstünde beliren **+** düğmesine
  basın ya da **satırın kendisine tıklayın** (bir metin seçimini bitiren tıklama ya
  da bir kelimeyi seçen çift tıklama sayılmaz — bu okumaktır). Sağ tık menüsünde —
  ya da klavyenin bağlam menüsü tuşunda — da *N. satıra yorum yap* vardır.
- **O satırın altında** bir kutu açılır. Yazın, ardından **Yorum yap** — ya da
  ⌘/Ctrl+Enter. **Vazgeç** kutuyu kapatır; **Esc** de kapatır, bir şey yazılmışsa
  önce sorar. Her iki durumda da odak o satıra döner.
- Başarılı olursa yeni konuşma **kendi satırının altında** ve herkesin göreceği
  Konuşma sekmesinin inceleme konuşmalarında görünür.

![Değişmiş bir satırın altında yazılan bir yorum ve kendi satırının altında daha eski bir konuşma](../../screenshots/pr-line-comment.webp)

Yorumun hangi tarafa düştüğü satıra bağlıdır:

| Satır | Bağlandığı yer |
|---|---|
| **Eklenen** (yeşil) | Dosyanın yeni sürümü, yeni numarasıyla |
| **Silinen** (kırmızı) | Eski sürüm, eski numarasıyla |
| **Değişmeyen** | Yeni sürüm (GitLab’e, istediği gibi, iki numara da gönderilir) |

Var olan konuşmalar da kendi satırlarının altında gösterilir; sunucu uygulamanın bir
konuşma içinde yanıt vermesine izin veriyorsa yanıt kutusuyla birlikte (Forgejo
izin vermez). Bir konuşma ancak sunucu onun gösterilen diff’e hâlâ ait olduğunu
söylüyorsa bir satırda gösterilir; geri kalanı tahmin edilmiş bir satır yerine
Konuşma sekmesinde kalır:

| Sunucu | Son push’tan önce yazılmış bir konuşma |
|---|---|
| GitHub | Satırı değiştiyse eskimiş: yalnızca Konuşma |
| GitLab | Daha eski bir head’e karşı yazılmış: yalnızca Konuşma |
| Azure DevOps | Azure onu satırının şimdi olduğu yere taşır |
| Bitbucket Data Center | Satırı yok olduysa sahipsiz: yalnızca Konuşma |
| Forgejo | Forgejo bir yorumun eskidiğini söylemez, bu yüzden kayıtlı satır numarasında gösterilir — bir push’tan sonra o satırda artık başka kod olabilir |

Gösterilen hunk’ların dışındaki bir satıra yapılan yorum, her sunucuda yalnızca
Konuşma sekmesindedir.

Yazılmış ama gönderilmemiş bir yorum, ana yorum kutusundaki metin gibi pull request’le
kalır: **‹ ›**, Alt+oklar ya da başka bir sekme onu olduğu yerde bırakır ve geri
döndüğünde kendi satırında yeniden durur (yukarıdaki *Geri dönmek*’e bak). Başka bir
dosyaya göz atmak onu korur; başka bir satırda yorum başlatmak için önce ilkini gönder ya
da iptal et.

Yapmadıkları:

- **Tek satır, hemen gönderilir.** Satır aralığı yoktur; yorumları toplayıp sonra
  göndereceğiniz bekleyen bir inceleme yoktur; önerilen değişiklik yoktur. Her yorum
  gönderdiğiniz anda kendi konuşması olarak yayımlanır (Forgejo’da, tek yorum için
  bir çağrısı olmadığından, yalnızca o yorumu içeren bir inceleme olarak).
- **Baktığınız diff.** Dosyalar sekmesi diff’inin hangi commit’te (Azure DevOps’ta
  hangi yinelemede) okunduğunu hatırlar ve yorum ona göre gönderilir. Pull request o
  zamandan beri ilerlediyse — bir push, yeni bir birleştirme tabanı — yorum şimdi o
  numarayı taşıyan satıra yazılmaz: *bu diff yüklendiğinden beri pull request
  değişti* diyerek reddedilir ve **Yenile** yeni diff’i gösterir. GitHub’da ise yorum
  okuduğunuz commit’e göre gönderilir ve o satır değiştiyse GitHub onu eskimiş
  olarak işaretler. Sunucunun yine de kabul etmediği bir satır, diff’in dışında
  olduğu gerekçesiyle reddedilir.
- **Reddedildi.** Yorum yapma izni olmadan (salt okunur bir token, deponun yorum
  yapmasına izin vermediği bir hesap) sunucu reddeder ve mesaj nedenin bu olduğunu
  söyler.
- **bitbucket.org** pull request’leri tarayıcıda açılır — uygulamanın onlar için
  henüz bir sayfası yok —, bu yüzden orada satır yorumu hâlâ web sitesinde yapılır.
- **Diff’i olmayan bir dosyada** (ikili ya da sunucunun eklemeyeceği kadar büyük)
  yorum yapılacak satır yoktur.

## Konuşma

Bir pull request’in hikâyesi dağınıktır: açıklama en üstte, yorumlar bir listede,
satır başlıkları başka bir listede, kararlar yalnızca kenar çubuğunda, push’lar kendi
sekmesinde. Yetişmek, hepsini okuyup sırayı kafanızda yeniden kurmak demekti.
**Konuşma** sekmesi bunu tek bir **zaman çizelgesi** olarak, bir ray boyunca, olduğu
sırayla anlatır.

![Zaman çizelgesi olarak konuşma: iki push, satırlarıyla hâlâ açık bir satır başlığı, bir değişiklik isteği, son ziyaretten beri yeni olanı işaretleyen çizgi ve bir onay](../../screenshots/pull-request-page.webp)

| Zaman çizelgesinde | Ne gösterir |
|---|---|
| **Açıklama** | Her zaman ilk; pull request’i kimin ve ne zaman açtığıyla |
| **Yorumlar** | Konuşma; her biri yazarının rolüyle: **Yazar** ya da **İnceleyen** |
| **Push’lar** | *sam 2 commit gönderdi*, ardından commit başına bir satır; bir hash’e tıklamak Commit’ler sekmesini açar |
| **Satır başlıkları** | Yerinde, ilk yorumlarının olduğu yerde: dosya ve satır, ilgili diff satırları, yanıtlar ve bir yanıt kutusu. Yol ve **Dosyalar'da görüntüle →** o dosyayı Dosyalar sekmesinde açar |
| **İnceleme kararları** | Yeşil **onayladı**, inceleyenin yazdıklarıyla kırmızı **değişiklik istedi**, ya da bir incelemenin kendi yorumu |

Sunucunun **açık** olarak bildirdiği bir başlık kehribar renkli bir etiket taşır
ve zaman çizelgesinin üstündeki çubuk onları sayar: **1 açık başlık** yalnızca
onları, hâlâ yanıt bekleyenleri gösterir. **Çözülmüş** bir başlık tek satıra
katlanır — *src/palette.tsx:18 içinde çözülmüş başlık · 2 yorum* — ve bir tıklama
onu açar. **Yorumlar · İncelemeler · Commit'ler · Tümü** zaman çizelgesini tek bir
türe daraltır; **Yorumlar** ile açılır, **Tümü** her şeyi geri getirir.

Kenar çubuğundaki **İnceleyenler** her kişinin kararını sözcüklerle söyler —
**✓ onayladı** ya da **değişiklik istedi** — ve henüz yanıt vermemiş biri için bir
saat gösterir.

### Son ziyaretinizden beri yeni

Bir pull request’in sayfasından ayrıldığınızda (başka bir sayfa, başka bir sekme,
kapatma, uygulamadan çıkma ya da onu yeniden yükleme), uygulama zamanı not eder.
Bir dahaki sefere bir çizgi kaldığınız yeri işaretler — **Son ziyaretinizden beri
yeni** — ve çubuk ondan sonra kaç girdi geldiğini söyler. İşaret açarken değil
ayrılırken konur, bu yüzden siz okurken yerinde kalır. Bir pull request’i ilk
açtığınızda hiçbir şey yeni olarak işaretlenmez.

Kendi yazdıklarınız sizin için asla yeni değildir: kendi yorumlarınız,
yanıtlarınız ve incelemeleriniz ne sayılır ne de çizgiyi kaydırır. Ziyaretinizden
önce başlamış ve o zamandan beri başka birinden yanıt almış bir başlık da yeni
sayılır — zaman çizelgesinde başladığı yerde kalır, bu yüzden onu çizginin üstünde
arayın.

Süreler *2g önce* gibi okunur; tam tarih için üzerine gelin.

*Sınırlar:*

- **Bir commit’in ne zaman push edildiğini** sunucular söylemez. Push’lar commit
  listesinden yeniden kurulur: aynı yazarın, her biri bir öncekinden bir saat içinde
  olan ardışık commit’leri tek bir push sayılır ve sonuncunun tarihine yerleştirilir.
  Tarihleri yeniden yazan bir rebase onları kaydırır. Güncellemeler sekmesi, olduğu
  yerde sunucunun kendi kaydıdır.
- **Açık ya da çözülmüş** bilgisi GitHub’dan (her okumada fazladan bir GraphQL
  isteği) ve GitLab’dan gelir. Azure DevOps, Bitbucket Data Center ve Forgejo
  başlıkları etiket göstermez ve sayılmaz.
- **Zaman çizelgesindeki kararlar** bir tarih ister: GitHub, GitLab (bir onay,
  GitLab’ın onun için yazdığı notun tarihiyle) ve Forgejo bir tarih verir. Azure
  DevOps oyları ve Bitbucket Data Center onaylarının tarihi yoktur, bu yüzden yalnızca
  kenar çubuğunda görünürler.
- Kendi metni olmayan bir GitHub incelemesi — her satır yorumu grubunun altında
  dosyalandığı zarf — satır almaz; başlıkları zaten görünür.
- Son ziyaretleriniz en son 300 pull request için, yalnızca bu bilgisayarda
  tutulur. Bir çökme ya da uygulamanın zorla kapatılması ziyaret kaydetmez.
- **Sizinki** olduğu, sunucudaki hesabınızdan anlaşılır. Sunucunun yazarları
  yalnızca görünen adlarıyla andığı ve eşleştirilecek bir kimlik vermediği yerde,
  kendi girdileriniz herkesinki gibi sayılır.

## Yorum yazmak

Sayfadaki her kutu — alttaki yorum, bir konuşmadaki yanıt, bir satıra yorum —
aynı Markdown düzenleyicisidir: **Yaz / Önizleme** sekmeleri, GitHub’ın
kısayollarıyla bir biçimlendirme çubuğu, Enter’da devam eden listeler ve ekranda
zaten olan kişiler ve pull request’lerden **@** / **#** tamamlama. Bir konuşma
yanıtı istisnadır: araç çubuğu olmayan tek satırlık bir alandır; Enter gönderir,
Shift+Enter bir satır ekler. Ayrıntılar ve sınırlar
[Yorum yazmak](writing-comments.md) sayfasında.

## Yorumlar nasıl gösterilir

İnsanlar yorumları Markdown ile yazar, bu yüzden düz metin olarak gösterilen bir yorum
`**`, `- [ ]` ve kod çitleriyle doludur. Açıklama, konuşma ve inceleme konuşmaları
(Konuşma ve Dosyalar sekmelerinde) Markdown olarak çizilir: başlıklar, listeler ve
görev listeleri, tablolar, alıntılar, çitin adlandırdığı dilde vurgulanan kod blokları,
bağlantılar ve görseller. Issue sayfası da metnini aynı biçimde çizer. Metindeki
`#123`, `AB#123`, `!123` ve `@user` hâlâ bağlantıya dönüşür, kartı olduğu yerde
[kartıyla](#bir-123-ya-da-ab123-neyle-ilgili) birlikte.

![İşlenmiş bir yorum: bir tablo, yer tutucusunun arkasında bekletilen başka bir siteden bir görsel ve vurgulanmış bir kod bloğu](../../screenshots/pr-rendered-comment.webp)

Çizimin geldiği yer:

| Sunucu | İşleyen |
|---|---|
| GitHub, GitHub Enterprise Server | GitHub’ın kendisi (`body_html`): bahsetmeler ve referanslar web sitesindeki gibi bağlanır, görseller GitHub’ın görsel proxy’sinden geçer ve özel ekler imzalı adreslerini taşır |
| GitLab, Forgejo, Azure DevOps, Bitbucket Data Center | Uygulama, yorumun Markdown’ından. Göreli bir bağlantı depoyu gösterir; GitLab’de `/uploads/…`, GitLab’in yaptığı gibi projeyi gösterir |

Bir yorum başkalarının içeriğidir, bu yüzden içerebileceği şeyler dardır ve kendi
dosyalarınız için olandan daha dardır: açık bir etiket listesi, yalnızca `https:`,
`http:` ya da `mailto:` üzerindeki bağlantılar ve görseller; betik, çerçeve, form, SVG
ya da satır içi stil yok; ve uygulamanın içinde asla açılmayan bağlantılar (tarayıcınıza
giderler). Bir görev listesindeki onay kutusu gösterilir ama tıklanamaz: burada
işaretlemek sunucuda hiçbir şeyi değiştirmezdi.

**Başka sitelerden görseller bir tıklama bekler.** Bir görseli yüklemek, arkasındaki
sitenin IP adresinizle ve yorumu okuduğunuz anla birlikte izleyebileceği bir istektir
— yorum yapabilen herkes oraya bir izleme pikseli koyabilir. Bu yüzden yalnızca
sunucunun kendisinden gelen görseller kendiliğinden yüklenir: github.com’da ekleri,
`*.githubusercontent.com` (görsel proxy’si dahil) ve varlıkları; başka herhangi bir
sunucuda kendi adresi. Diğer her görsel *example.net kaynaklı görsel — yüklemek için
tıklayın* gösterir ve tıklama yalnızca o görseli yükler. **Ayarlar → Güvenlik →
Yorumlarda diğer sitelerden görselleri yükle** bunu kapatır;
[Güvenlik](security.md#yorumlardaki-görseller) sayfasına bakın.

**Önizleme gönderilecek olanı gösterir.** Bu sayfada ve issue sayfasında, her yorum
kutusunun **Önizleme** sekmesi metni aynı biçimde çizer: aynı profil, aynı satır
sonları, aynı bekletilen görseller — dışarıdaki bir görsele yapıştırılmış bir
bağlantı, siz yazarken onu yüklemez. Yeni pull request ve yeni issue iletişim
kutuları uygulamanın olağan Markdown önizlemesini korur.

**Çok uzun ya da çok karmaşık olan metin olarak gösterilir.** Markdown uygulamanın
penceresinde işlenir ve bazı metinlerin işlenmesi boyutlarının düşündürdüğünden çok
daha pahalıdır. **32.000 karakteri** aşan ya da işleyiciyi kilitleyecek biçimde
kurulmuş bir yorum (bir paragrafta binlerce eşsiz `_` ya da `*`, ya da tek satırda 32
seviyeden fazla `>` veya liste işareti), bağlantılarıyla düz metin olarak, *Uzun yorum
düz metin olarak gösteriliyor.* ya da *Yorum düz metin olarak gösteriliyor: burada
işlenemeyecek kadar karmaşık.* başlığı altında gösterilir. Yine de işlenemeyen bir
yorum kendiliğinden aynı biçimde geri düşer: sayfanın geri kalanı etkilenmez.

Yapmadıkları:

- **Düzenlerken metin yazıldığı gibi görünür.** **Düzenle** hâlâ Markdown’ı açar ve
  kaydedilmiş bir düzenlemeyi, sayfa pull request’i yeniden okuyana kadar uygulama
  çizer (GitHub’da ondan sonra GitHub).
- **Özel GitHub ekleri süresi dolar.** GitHub özel bir görselin adresini birkaç
  dakikalığına imzalar; sayfa bir süre açık kaldıktan sonra artık yüklenmeyen biri
  **Yenile** ile geri gelir.
- **GitHub’da uygulamanın kendisinin çizdiği göreli bir görsel** (sayfa onu yeniden
  okumadan önce uygulamadan gönderilmiş bir yanıt), deponun github.com’daki adresi
  altında aranır; bu, GitHub’ın onu koyacağı yer olmayabilir.
- Bir GitHub yorumundaki **videolar** oynatıcı olarak değil, dosyaya bir bağlantı
  olarak görünür.
- Uygulamanın kendisinin çizdiği (diğer sunucularda) **yalnızca GitHub’a özgü
  uzantılar** yoktur: emoji kısa kodları, Mermaid diyagramları, uyarı biçimleri yok ve
  formüller metin olarak kalır.
- **Kod yalnızca çit dilini adlandırdığında vurgulanır.** Dili tahmin etmek, her
  dilbilgisini sayfadaki her bloğun üzerinden geçirmek demek olurdu.
- Commit’ler sekmesindeki **commit mesajları** düz metin kalır: git Markdown işlemez,
  sunucular da işlemez.

## Yorumlarınızı düzenlemek ve silmek

Gönderilmiş bir yorumdaki yazım hatası ya da artık geçerli olmayan bir not, eskiden
tarayıcıya gitmek demekti. Kendi yorumlarınızın başlığının sonunda artık
**Düzenle** (kalem) ve **Sil** (çöp kutusu) var: konuşma yorumları, inceleme
konuşması yorumları ve yanıtlar, hem Konuşma hem Dosyalar sekmesinde. Issue
sayfasında da, GitHub ve Forgejo’daki yorumları için, bunlar vardır.

![Düzenlendi olarak işaretlenmiş kendi yorumunuz; başlığının sonunda Düzenle ve Sil](../../screenshots/comment-editor.webp)

Neyin “sizin” olduğuna sayfanın kendisi karar verir: her yüklemede sunucuya bu
deponun çağrılarının kim olarak oturum açtığını sorar (o anda etkin olan profili
değil, deponun bağlı profilini). Çoğu sunucu yazarı, büyük/küçük harf ayrımı
gözetmeden karşılaştırılan kullanıcı adıyla belirtir. Azure DevOps yazarları iki kişinin paylaşabileceği görünen adla belirtir; bu yüzden
orada adlar asla karşılaştırılmaz: yazarının kimliği hesabın kimliğiyle eşleştiğinde
**ya da** yazarının benzersiz adı (hesap adı, genellikle bir e-posta adresi),
büyük/küçük harf ayrımı gözetmeden, hesabınkiyle eşleştiğinde yorum sizindir. İkisi
de tek bir kişiye özgüdür; ikincisi, bağlantının bildirdiğinden farklı bir yazar
kimliğini kapsar. Hiçbiri karşılaştırılamadığında hiçbir yorum eylemleri göstermez. Uygulama kim olduğunuzu anlayamadığında (kullanıcı kapsamı
olmayan bir token ya da sunucu yanıt vermedi) hiçbir yorum bunları göstermez;
**Yenile** yeniden sorar. Kararı yine sunucu verir: bir yorumu değiştirmesine izin
vermediği bir hesap reddedilir ve mesaj bunu söyler.

- **Düzenle**, yorumu yerinde, aynı Markdown düzenleyicide, yazıldığı hâliyle açar.
  **Kaydet** (ya da ⌘/Ctrl+Enter) gönderir; **Vazgeç** ya da **Esc** kapatır, bir şey
  değiştirdiyseniz önce sorar. Yalnızca metnin etrafındaki boş satırlar atılır:
  girintili kod ve sondaki iki boşluklu satır sonu yazıldığı gibi kalır. Yeni metin
  hemen görünür ve sayfa pull request’i yeniden okur. Pull request sayfasında kaydedilmemiş bir düzenleme, **‹ ›** ile ilerlediğinde ya da
  sekme değiştirdiğinde pull request’le kalır ve pull request’i kapatmak önce sorar. Bir
  issue sayfası hiçbir şey tutmaz: orada sekmesini kapatmadan önce hiçbir şey sormaz.
- **Sil** her zaman önce sorar ve soru ne olacağını söyler: sunucu yorumu herkes için
  kaldırır ve bu geri alınamaz. Hiçbir şey onu geri getiremeyeceği için geri alma
  kaydı yoktur.

Yanıtları olan bir konuşmanın **ilk yorumunu** silmek (bir inceleme konuşması ya da
başkalarının yanıtladığı bir konuşma yorumu) sunucuya göre değişir ve onay hangisi
olduğunu söyler. Bunlardan ikisi sunucu tarafından belgelenmemiştir ve bu da
söylenir:

| Sunucu | Yanıtları olan bir konuşmanın ilk yorumu |
|---|---|
| GitHub | Yanıtlar kalmalı; GitHub’ın belgeleri bunu söylemez. Konuşma yanıt kutusunu korur: ilk yorumu gidince yanıt, GitHub’ın GraphQL API’si üzerinden, içinde hâlâ duran bir yanıt aracılığıyla bulunan konuşmanın kendisine gönderilir. Bu başarısız olursa (eski bir Enterprise Server, GraphQL’in reddettiği bir token, GitHub’ın bu hesabın yanıt veremeyeceğini söylediği bir konuşma), konuşma bunun yerine **GitHub’da yanıtla** seçeneğini sunar. GitHub’da devam eden bir incelemeniz varsa GitHub yanıtı onun altına koyabilir: bu durumda bildirim bunu söyler ve o incelemeyi orada gönderene kadar yanıtı kimse görmez |
| GitLab | Yalnızca o not gider; konuşma ve yanıtları kalır |
| Azure DevOps | Silindi olarak işaretlenip gizlenmeli, konuşma ve yanıtları korunmalı; Azure’un belgeleri bunu söylemez |
| Bitbucket Data Center | Reddedilir: Data Center yanıtları olan bir yorumu silmez. Önce yanıtları silin ya da onun yerine yorumu düzenleyin |

Bazı sunucular bir yorumu **düzenlendi** olarak işaretler. Yalnızca Azure DevOps
yalnızca metin için bir tarih tutar; GitHub, Bitbucket Data Center ve Forgejo’da
uygulama yorumun ne zaman oluşturulduğunu ve en son ne zaman güncellendiğini
karşılaştırır, bu yüzden orada işaret bir yaklaşıktır (yoruma dokunan başka herhangi
bir şey onu koyabilir). GitLab’in tarihi bir konuşma çözüldüğünde de değişir, bu
yüzden kullanılmaz.

Yapmadıkları:

- **Forgejo inceleme yorumları** (bir satıra yapılan yorumlar) API’si üzerinden
  düzenlenemez ve yalnızca bazı sürümler birini silebilir, bu yüzden iki eylemi de
  göstermezler: onları web sitesinde değiştirin. Konuşma yorumları başka yerlerdeki
  gibi çalışır.
- **Bu arada biri değiştirdi.** Bitbucket Data Center yorumun sürümünü denetler:
  sayfa yüklendiğinden beri değişmiş bir yorumu düzenleme ya da silme reddedilir ve
  **Yenile** güncel olanı gösterir. Diğer sunucular son yazılanı alır.
- **Bulunamadı**: sunucu yorumu bulamadığında mesaj, silinmiş olabileceğini ya da bu
  hesabın onu göremediğini söyler ve sayfa pull request’i yeniden okur. Artık olmayan
  bir yorum üzerinde açık bir düzenleme bırakılır.
- **bitbucket.org** pull request’leri tarayıcıda açılır, bu yüzden uygulama çağrıyı
  yapabilse de yorumlarını düzenleyecek bir sayfa henüz yoktur.
- Pull request’in **açıklaması** ve incelemelerinin özetleri yorum değildir ve
  burada düzenlenmez.

## Bir `#123` ya da `AB#123` neyle ilgili

*fixes AB#4821* diyen bir commit ya da *bkz. #312* diyen bir yorum size bir numara
söyler, neyle ilgili olduğunu değil. Bunu öğrenmek onu açmak demekti. Artık **bir
referansın üzerine gelmek** — ya da Tab ile ona gitmek — sunucunun onun hakkında
söylediklerini içeren küçük bir kart açar:

- türü için bir simge ve referansın yazıldığı hâli;
- **başlığı**;
- **durumu** (açık, kapalı, birleştirilmiş — Azure DevOps’ta work item’ın kendi
  durumu, örneğin *Active* ya da *Resolved*);
- Azure DevOps’ta **work item türü** (Bug, User Story, Task…).

![Bir yorumdaki work item referansının kartı: türü, başlığı ve durumu](../../screenshots/reference-card.webp)

Kartlar pull request sayfasında (açıklama, yorumlar, inceleme konuşmaları ve
**Commit’ler** sekmesindeki bir commit’in tam mesajı), issue sayfasında ve commit
ayrıntıları panelindeki konuda bulunur. Azure DevOps’ta **Commit’ler** sekmesinde,
bir commit’in konusundaki her work item (`AB#123`, ya da orada aynı öğe olan `#123`)
yanında başlığını da gri olarak gösterir. Azure DevOps’ta `!123` kartsız olarak o
pull request’e bağlanır.

| Referans | Sunucu | Okunduğu yer |
|---|---|---|
| `AB#123`, ve bir Azure deposunda `#123` | Azure DevOps | Work item’lar, tek istekte 200’e kadar |
| `#123` | GitHub, GitHub Enterprise Server | Issue’lar ve pull request’ler, tek GraphQL isteğinde 50’ye kadar; GraphQL başarısız olunca her biri için bir REST isteği |
| `#123` / `!123` | GitLab | Issue’lar / merge request’ler, tür başına bir istek |
| `#123` | Forgejo | Issue’lar (pull request’ler de), her biri için bir istek, ikişer ikişer |

Bir `#123` yalnızca kendi başına bir kelime olarak sayılır: `org/repo#123` (başka bir
depo), `&#39;`, `#123abc` gibi bir renk ve bir bağlantının `#issuecomment-…` kısmı
olduğu gibi bırakılır.

Bir kart açılana kadar hiçbir şey sorulmaz. Sonra üzerinde olduğunuz referans ve
sayfada ona en yakın, henüz bilinmeyenler tek çağrıda gider, böylece sonraki kart
genellikle anında gelir. Yanıtlar uygulama çalıştığı sürece bellekte tutulur, asla
diskte değil, beş dakika boyunca; ondan sonra gösterilmeye devam eder ve bir sonraki
üzerine gelişte yeniden okunur. Profil başına tutulurlar: çağrı deponun
[bağlı](profiles.md) olduğu profil olarak yapılır ve başka bir profil başka öğeler
görebilir.

Maliyeti:

- **GitHub**, GraphQL API’si üzerinden tek istekte **50**’ye kadar okur — üzerinde
  olduğunuz ve en yakın komşuları. GraphQL bir hız sınırı dışında başka bir nedenle
  başarısız olduğunda (eski bir Enterprise Server, reddettiği bir token), uygulama her
  istekte bir issue okuyan REST API’sine geri döner: o zaman yalnızca ilk **10** tane,
  GitHub’ın uygulamalardan istediği gibi birbiri ardına sorulur; diğerleri bilinmeden
  kalır ve sonraki bir üzerine gelme onları sorar.
- **Forgejo** birden çok issue’yu tek istekte okuyamaz, bu yüzden her kart bir istek
  tutar: bir üzerine gelme en fazla **10** tane ister, ikişer ikişer.
- GitHub ve Forgejo’da *yavaşla* diyen ilk yanıt (bir 429, bir 403, GraphQL’in kendi
  hız sınırı hatası, ikincil bir sınır ya da sınırın son isteğini harcamış bir yanıt)
  gerisini durdurur — GitHub o zaman REST’e geri dönmez — ve bu referanslar beş dakika
  boyunca yeniden sorulmaz.
- **Azure DevOps** tek istekte 200’e kadar work item okur, GitLab ise tür başına bir
  istek yapar; bu yüzden orada tüm sayfa bir kerede gider.

Yapmadıkları:

- **Bitbucket**’ta kart yoktur: uygulama orada issue okumaz ve bağlantı eskisi gibi
  tarayıcıyı açar.
- **Bulunamadı ya da erişim yok.** Silinmiş bir issue, bu hesabın göremediği bir
  projedeki bir work item ya da *Work Items (Read)* kapsamı olmayan bir Azure token’ı
  aynı görünür: kart bunu söyler ve bağlantı yine çalışır. İstekleri kısan,
  erişilemeyen ya da bu profilde hesabı olmayan bir sunucu kendi mesajını alır.
- **Azure DevOps dışındaki `AB#123`** — Azure Boards’a bağlı bir GitHub deposunda —
  bağlantıya dönüşmez, bu yüzden kartı yoktur: uygulama hangi kuruluşa ait olduğunu
  bilmez.
- Bir pull request’in ne zaman birleştirildiğini göndermeyen **eski GitHub Enterprise
  Server’larda birleştirilmiş durumu**: kapalı olarak görünür.
- **Grafiğin** commit satırları kart göstermez.

## Sınırlar

- **Açık pull request’ler kenar çubuğunun listesidir.** GitHub, GitLab ve
  bitbucket.org ilk 30’u okur; daha fazlası olan bir depo yalnızca bunları
  gösterir ve Açık sayısı **30+** olur. Azure DevOps, Bitbucket Data Center ve
  Forgejo hepsini okur.
- **Birleştirilen ve kapalı olanlar sınırlıdır**, sunucuda daha fazlası olduğunda
  sekme **+** gösterir (sunucunun web sitesi hepsini listeler):

  | Sunucu | Ne okunur |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | En son güncellenen 100 tane, birleştirilen ve kapalı **birlikte** |
  | GitLab | Her birinden en son güncellenen 100 tane |
  | Bitbucket Data Center | Sunucunun *newest* sırasına göre her birinden 100 — API’si bunun açılma mı güncellenme mi olduğunu söylemez |
  | Azure DevOps | **Son bir yılda** sonuçlananlar arasından her birinden 100; API’si bir sıra belirtmez, bu yüzden yüzün ötesinde hangilerinin geleceğini sunucu seçer |

  Kontrolleri okunmaz — bitmiş bir pull request’in CI’ı hiçbir şeye karar
  vermez ve satır başına bir istek maliyeti olurdu — bu yüzden **CI başarısız** bu
  sekmelerde uygulanmaz (çipi orada gizlidir).
- **Hesap yok**: sunucuya ulaşan bir token olmadan Birleştirilen ve Kapalı boş
  bir liste göstermek yerine bunu söyler (GitHub yine de herkese açık bir depoyu
  okuyabilir).
- **Kontroller**: GitHub ve Bitbucket Data Center bunları listede taşır. GitLab,
  Azure DevOps ve Forgejo’ya sayfa açıldığında head başına bir kez, grafiğin CI
  rozetleriyle aynı önbellek üzerinden sorulur. bitbucket.org’da yoktur.
- **İnceleyenler**: GitHub, GitLab, Forgejo, Bitbucket Data Center ve Azure
  DevOps kimden hâlâ istendiğini belirtir (Azure: oy vermemiş bir kişi; ekipler
  dışarıda kalır). bitbucket.org’un listesi bunu söylemez, bu yüzden orada
  İnceleyen filtresi boştur.
- **Açıklamada arama**, sunucunun listesinin açıklamayı taşıdığı yerde çalışır;
  bitbucket.org onu atlayabilir, o zaman yalnızca başlıklar, dallar ve numaralar
  aranır.
- **bitbucket.org ve Azure DevOps’ta “Ben”** görünen ada göre eşleştirilir,
  çünkü listeleri yazarı böyle adlandırır.
- **Azure DevOps’ta Güncellendi**, pull request’in açıldığı (ya da kapandığı)
  zamandır: listesinde son etkinlik zamanı yoktur.
- Gezinme uygulama çalıştığı sürece hatırlanır; yeniden başlatmadan sonra
  listeden açılan bir pull request bunun yerine açık pull request’lerde ilerler.
- **Dosyaları okumak bir kez fetch yapabilir.** Pull request’in commit’leri bu klonda
  olmadığında sayfa onları açılışta ve **Yenile**’de yine uzak deposundan id ile getirir
  — asla bir yorumdan, incelemeden ya da birleştirmeden sonra değil ve bir oturumda pull
  request’in her sürümü için en fazla bir kez (başarısız bir deneme Yenile’yi bekler).
  Yalnızca nesne yazar: dal yok, `FETCH_HEAD` yok, bu yüzden araç çubuğundaki “… önce
  getirildi” değişmez. 20 saniye sonra ya da aktarım 15 saniye boyunca 1 KB/s’nin
  altında süründüğünde vazgeçer ve asla parola sormaz: git’in istemi kapalıdır ve Git
  Credential Manager’a oturum açma penceresi açmaması söylenir, bu yüzden buna ihtiyaç
  duyacak bir uzak depo API’ye geri döner. Bir ssh uzak deposu kendi ssh ayarlarını
  olduğu gibi kullanır; tek fark, ssh’in kendi parola cümlesi penceresinin
  açılmamasıdır. Başka bir git işlemi depoyu (uzun bir push) beş saniyeden uzun süre
  tuttuğunda, fetch o seferlik atlanır ve API kullanılır. O sürerken çalışma ağacında
  yaptığın değişiklikler kaybolmaz: bitince depo yenilenir. Nesneleri eksik olan sığ ya
  da kısmi bir klon barındırıcının API’sine geri döner.
- **Sınırların üstünde** bir dosya sayılarıyla ve diff’siz listelenir: klondan okunan bir
  diff’in 20.000 değişen satırı ya da 8 MB’ı, Azure DevOps’tan okunan sürüm başına 4 MB.
  Tek bir okuma yaklaşık 150.000 satır ya da 48 MB diff tutar; ondan sonraki dosyalar
  **henüz yüklenmedi** olur ve açıldıklarında okunur.
- git’in ikili dediği **UTF-16 dosyaları** metin olarak yeniden okunur, pull request başına
  50’ye ve sürüm başına 2 MB’a kadar; bunun ötesinde ikili olarak görünürler.
- **Yeniden adlandırmalar** `git diff -M`’nin bulduğu gibi bulunur (varsayılan %50
  benzerlik), bu da barındırıcının kendi eşleştirmesinden biraz farklı olabilir.
- **API üzerinden Azure DevOps**, ilk yüz dosyasını toplamda bir dakika içinde okur;
  dakika dolduğunda kalan dosyalar **henüz yüklenmedi** olur. Kısıtlanan bir yanıt, tüm
  okumaları sunucunun Retry-After süresi kadar duraklatır. 20.000’den fazla değişikliği
  olan bir pull request o noktaya kadar listelenir ve sekme bunu söyler.
