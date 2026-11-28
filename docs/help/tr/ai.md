---
title: Yapay zekâ özellikleri
category: Yapay zekâ
order: 80
summary: İsteğe bağlı, sağlayıcıdan bağımsız ve gerçek kodunuza dayalı.
keywords: yapay zekâ yerel model commit mesajı açıklama inceleme ai openai anthropic ollama local llm commit message explain review wiki grounded hesaplar hesap api anahtarı abonelik cli claude codex gemini modeller yavaş zaman aşımı timeout uzun sürüyor beklemeye devam et iptal yanıt vermiyor ollama kapalı hesap değiştir başka hesap yazım tercihleri commit stili özel yönergeler ortak yazar üzerine gelme açıklama kendi yapay zekâ genel yapay zekâ
---

# Yapay zekâ özellikleri

Her yapay zekâ özelliği **isteğe bağlıdır** ve siz bir sağlayıcı
yapılandırana kadar kapalıdır. Siz belirli bir şey istemeden hiçbir yere
hiçbir şey gönderilmez.

![Yapay zekâ ayarları](../../screenshots/settings-ai.webp)

## Her profil için tek yapay zekâ

Yapay zekâ bir kez, **Ayarlar → Yapay zekâ** içinde kurulur ve her
[profil](profiles.md) onu kullanır: sonradan oluşturduğunuz bir profilde yapay
zekâ zaten vardır, yeniden hesap eklemeniz gerekmez. Sayfa her profili ve bu
**genel yapay zekâyı** izleyip izlemediğini listeler.

Bir profil bunun yerine **kendi yapay zekâsını** kullanabilir — maliyet ya da
veri politikası nedeniyle şirketin hesabından geçmesi gereken ya da
commit'lerini başka türlü yazan bir iş profili gibi. O profilin **Profil**
sayfasında, *Bu profilin yapay zekâsı* altında **Genel**'i **Kendi** olarak
değiştirin: genel yapay zekânın tamamının — hesaplar, anahtarlar ve tercihler —
bir kopyası olarak başlar ve o andan itibaren hepsi yalnızca o profilindir.
Yeniden **Genel**'e geçmek, bir onaydan sonra onu kaldırır ve genel yapay zekâyı
olduğu gibi bırakır.

Bir profil tek bir yapay zekâyı **bütün olarak** kullanır: genel olanı ya da
kendisininkini, asla bir karışımı. Hesaplar ve modeller *ile* yapay zekânın
nasıl yazdığı ve sohbetin neler yapabileceği aynı yerden gelir; bu yüzden genel
yapay zekâda commit stilini değiştirmek, onu izleyen her profil için değiştirir.

Her yapay zekâ bu tek sayfada kurulur. Üstteki **Düzenlenen** çubuğu hangisini
seçer: genel yapay zekâyı ya da bir profilin kendisininkini (*İş profilinin
kendi yapay zekâsı*). Profil sayfasındaki **Kendi yapay zekâsını ayarla** ya da
profil listesindeki **Kendi yapay zekâsını düzenle**, sayfayı doğrudan onda
açar. Profil sayfasının kendisi yalnızca profilin hangi yapay zekâyı
kullandığını ve neyin cevap verdiğini gösterir — düzenleyici asla orada
değildir, kendine ait bir yapay zekâ seçeneği de yoktur.

![Bir profilin yapay zekâsı, Profil sayfasında: Genel ya da Kendi, neyin cevap verdiği ve nasıl kurulacağı](../../screenshots/settings-profile-ai.webp)

Hesapların altında aynı sayfa, o yapay zekânın nasıl **yazdığını** ve neler
yapabileceğini bölümler hâlinde tutar:

| Bölüm | İçerir |
|---|---|
| **Commit mesajları** | Commit stili — Conventional, Gitmoji ve kayıt no, örnek bir satırla kartlar olarak, geri kalanı *Diğer stiller* altında — *Commit açıklaması üret*, ortak yazar satırı, **Commit’ler için ek kurallar** ve bir önizleme |
| **Açıklama ve üzerine gelme** | Açıklama stili, *İmleç üzerindeyken kodu açıkla* ve değiştirici tuşu |
| **Çakışmalar ve dallar** | Çakışma çözme stili, dal adlandırma stili, her biri sonucun bir örneğiyle |
| **Depo sohbeti** | Sohbetin açık olup olmadığı, neyi okuduğu, önerebileceği eylemler — bkz. [Depo sohbeti](repo-chat.md#ayarlar) |

Bölümlerin üstündeki bir satır, kimin yapay zekâsını düzenlediğinizi ve kime
ulaştığını söyler: *genel yapay zekâ · İş ve Kişisel için geçerli*, ya da tek
bir profilin kendi yapay zekâsı.

**Commit’ler için ek kurallar** — 4.60’a kadar *Özel yönergeler* — yalnızca commit mesajı üretimine eklenir: sohbet, açıklamalar, incelemeler ve dal adları bunları okumaz. Önizleme sabit bir örnektir, model çağrısı değildir: seçilen stilin biçimini gösterir, yapay zekânın sizin değişikliğiniz için ne yazacağını değil.

![Commit mesajları](../../screenshots/settings-ai-commits.webp)

Besteci panelindeki stil değiştirici ve sohbetin model ve onay seçicileri,
profilin okuduğu yapay zekâya yazar: genel olana ya da profilin kendisininkine.

Her profilin kendi yapay zekâsı olan bir sürümden yükseltmek hiçbir şey
kaybettirmez: kullanımdaki profilin yapay zekâsı genel yapay zekâ olur ve yapay
zekâsı farklı olan diğer her profil onu kendisininki olarak korur.

**4.59 veya daha eski bir sürümden yükseltirken**, yazım tercihlerinin her
profilde durduğu dönemden: bir kez, kullanımdaki profilin tercihleri (ya da o
profilin kendi yapay zekâsı varsa, genel yapay zekâdaki ilk profilin tercihleri)
genel yapay zekâya taşınır. Kendi yapay zekâsı olan profiller kendilerininkini
korur. **Sınır:** genel yapay zekâdaki iki profil farklı yazıyorsa — `ticket`
kullanan bir iş profili ve `conventional` kullanan kişisel bir profil — ikisi de
artık taşınan profil gibi yazar. Farkı korumak için birine kendi yapay zekâsını
verin ve stilini orada yeniden ayarlayın.

## Sağlayıcılar

**Hesap**, bir modele ulaşmanın bir yoludur: bir sağlayıcı, ona nereden
erişileceği ve nasıl kimlik doğruladığı. Birden çok hesap kurabilirsin ve bir
arada yaşarlar — bir iş anahtarı, bir kişisel anahtar, yerel bir model, zaten
oturum açtığın bir CLI.

Hazır ayarlar **OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral** ve
**Ollama** (tamamen yerel) ile birlikte OpenAI uyumlu her uç noktayı kapsar.

**Bir anahtar bu makineden asla şifrelenmeden çıkmaz.** Anahtarlı bir hesap uç
noktasına `https://` üzerinden, düz `http://` üzerinden ise yalnızca bu
bilgisayarda (`localhost`, `127.x`, `::1`) ulaşır. Anahtarı `http://` üzerinden
başka bir sunucuya gönderecek bir çağrı, hiçbir şey çıkmadan reddedilir ve bunu
söyler. Anahtarsız bir uç nokta — ağınızdaki başka bir makinede Ollama —
`http://` üzerinden çalışmaya devam eder.

Anthropic, OpenAI biçimli bir çağrı yerine kendi `/v1/messages` API'sini
kullanır; böylece Claude modelleri yalnızca çalışıyor gibi görünmek yerine
gerçekten çalışır. Gemini'ye Google'ın OpenAI uyumlu uç noktası üzerinden
ulaşılır.

### Sağlayıcı listesi

Kaydedilen her sağlayıcı bir karttır: sağlayıcısının harfi, adı ve altında
gerçekte ne kullandığı — böylece aynı sağlayıcının iki hesabı hiçbirini açmadan
ayırt edilir.

| Sağlayıcı türü | İkinci satır |
| --- | --- |
| Abonelik veya yerel CLI | `CLI claude · sonnet` — komut, ardından model |
| Ollama veya özel sunucu | `http://localhost:11434 · qwen3:8b` — adres, ardından model |
| Barındırılan API | `gpt-4o-mini · 41 model` — model ve sağlayıcının listelediği model sayısı |

Model sayısı yalnızca sağlayıcı modellerini listeledikten sonra görünür;
GitHuttBr'ın yedek olarak kullandığı yerleşik liste bir tahmindir, sayım değil.
Durum rozeti sağdadır. Düzenlediğiniz kartın kenarı vurgu rengindedir; yanıt
vermeyen bir kartın kenarı kırmızıdır ve nedeni adının altında, **Yeniden test
et** ile biten bir cümlede yazar. Bir kartı listenin altındaki düzenleyicide
açmak için ona tıklayın.

### Sağlayıcı eklemek ve düzenlemek

Yarım doldurulup kaydedilen bir sağlayıcı sessiz bir tuzaktı: boş bir anahtar
kullanımda kalabiliyor ve hiçbir şey yanıt vermiyordu. Bu yüzden bu kartta
yazarken hiçbir şey kaydedilmez.

**Sağlayıcı ekle**, kesik kenarlı ve **Taslak · kaydedilmedi** işaretli bir kart
açar. Sağlayıcıyı, anahtarı, uç noktayı ve modeli doldurup
**Test et ve kaydet** seçin. GitHuttBr önce bu anahtarla sağlayıcının
modellerini listeler — **Model** yanındaki yenile düğmesi ile aynı istek — ve yalnızca yanıt
gelirse kaydeder. **Bağlandı · N model** görürsünüz ve sağlayıcı listeye
**Hazır** olarak girer.

Test başarısız olursa kart, sağlayıcının nedeniyle birlikte
**Bağlanılamadı** (reddedilen anahtar, `401`; çalışmayan bir
sunucu) ve **Hiçbir şey kaydedilmedi.** gösterir. Alanı düzeltip yeniden test
edin, olduğu gibi tutmak için **Yine de kaydet** seçin — o zaman
**Yanıt vermiyor** görünür — ya da iz bırakmayan **Vazgeç**.

Kayıtlı bir sağlayıcıyı düzenlemek de aynı şekilde çalışır. Bir şerit
**Kaydedilmemiş değişiklikler — kaydedene kadar hiçbir şey değişmez** der ve dokunduğunuz her alan
**· değişti** ile işaretlenir. **Değişiklikleri at** kayıtlı
değerleri geri getirir; **Test et ve kaydet** test edip kaydeder. Bekleyen
değişiklikler varken başka bir sağlayıcı seçmek, yenisini eklemek ya da
**Aboneliğimi kullan** açmak **“…” üzerindeki değişiklikler kaydedilsin mi?** diye sorar — **Kaydet**,
**Değişiklikleri at** veya **Düzenlemeye devam et**. Ayarları kapatmak
taslağı bellekte tutar, döndüğünüzde hâlâ oradadır; diske asla yazılmaz.

Anahtarlar eskisi gibi, anahtarlığınıza ve yalnızca kaydederken kaydedilir. Bir
sağlayıcının hatası, anahtar ve token'a benzeyen her şey maskelenerek
gösterilir.

![Sağlayıcı eklemek ve düzenlemek](../../screenshots/ai-provider-draft.webp)

![Kayıtlı bir sağlayıcıyı düzenlemek: adres değişti, henüz kaydedilmedi](../../screenshots/ai-provider-editing.webp)

| Sağlayıcı türü | **Test et ve kaydet** neyi denetler |
| --- | --- |
| API anahtarı veya yerel sunucu (Ollama, özel uç nokta) | Modelleri listeler; başarı, uç noktanın bu anahtarla yanıt verdiği anlamına gelir |
| Abonelik (Codex, Claude Code) | Aşağıda anlatılan kısa test istemini planınızın kotasından gönderir |
| Yerel CLI | Komutu `PATH` içinde arar; elle yazılan bir yol denetlenmeden kaydedilir |

### Durum rozetleri

Listedeki her sağlayıcının, sayfanın zaten bildiklerinden — son testten ya da
yine de getirdiği model listesinden — çıkarılan bir rozeti vardır. Arka planda
hiçbir şey yoklanmaz.

| Rozet | Anlamı |
| --- | --- |
| **Hazır** | Son test ya da model listesi başarılı oldu |
| **Yanıt vermiyor** | Son deneme başarısız oldu; neden alttaki satırda, **Yeniden test et** ile birlikte |
| **Anahtar yok** | Sağlayıcının bir API anahtarına ihtiyacı var ve yok |
| **Denetlenmedi** | Henüz hiçbir şey sormadı — test edilene kadar bir abonelik ya da getirilmemiş bir liste |

**Sınır:** bir rozet ancak son denetimi kadar tazedir. Bir saat önce yanıt
vermeyi bırakan bir sağlayıcı, bir şey ona yeniden sorana kadar
**Hazır** kalır — emin olmak için kartında **Bağlantıyı test et**
seçin. Elle yazılmış yolu olan bir **yerel CLI** **Denetlenmedi**
kalır, çünkü çalıştığını kanıtlamak bir isteme mal olur.

### Kullanımdaki sağlayıcı

**Göreve göre model** altında kendi sağlayıcısı olmayan her görevi tek bir
sağlayıcı yanıtlar. Onun kartı, diğer kartlarda **Kullan** olan yerde yeşil bir **Kullanımda** ile biter ve listedeki yerinde kalır. Yeşil yalnızca kullanımda demektir: yanıt veren ama kullanımda olmayan bir sağlayıcı sakin bir gri-mavi ile **Hazır** der. Genel yapay zekâ ve
kendi yapay zekâsı olan bir profil, her biri kendi kullanımdaki sağlayıcısına
sahiptir; liste o an düzenlediğini değiştirir.

Kaydedilmiş diğer her sağlayıcının satırının sağında, rozetinin yanında bir
**Kullan** düğmesi vardır. Tek tıklama onu kullanıma alır ve hemen kaydeder:
hangi sağlayıcının yanıtlayacağı bir düzenleme değil, bir seçimdir; bu yüzden
**Test et ve kaydet** beklenmez. O sağlayıcının kartı açılmaz ve kaydedilmemiş
değişiklikleri olan bir kart onları korur.

**Sınır:** **Kullan** hiçbir şeyi test etmez. **Anahtar yok** ya da **Yanıt
vermiyor** olarak işaretli bir sağlayıcı kullanıma alınabilir — bilerek,
anahtarını düzeltmeden önce — ve rozeti bunu söylemeye devam eder; sonraki yapay
zekâ görevi o sağlayıcının gerekçesiyle başarısız olur. Bir taslakta **Kullan**
yoktur: kaydedilene kadar sağlayıcı değildir.

### Kullanılan yapay zekâ, durum çubuğundan

Kendi yapay zekâsı olan bir profil, genel yapay zekânın kullandığı sağlayıcıyı
yok sayar: genel yapay zekâda başka bir sağlayıcıyı kullanıma almak o profil
için hiçbir şey değiştirmez ve Ayarlar dışında bunu söyleyen bir şey yoktu. Bir
deponun altındaki durum çubuğu artık söylüyor. **Yapay zekâ:** _sağlayıcı_
düğmesi, kullanılan profil için yanıt veren sağlayıcıyı durumunu gösteren bir
noktayla adlandırır — yeşil **Hazır**, kırmızı **Yanıt vermiyor**, kehribar
**Anahtar yok**, gri **Denetlenmedi**. Sağlayıcı **Hazır** olduğunda düğmenin
tamamı yeşile döner, böylece çalışan bir yapay zekâ kapalıymış gibi görünmez.

Tıklamak küçük bir panel açar:

| Bölüm | Ne gösterir |
| --- | --- |
| Başlık | Kullanılan profil ve **genel yapay zekâyı izleyip izlemediği** ya da **kendi yapay zekâsı olduğu** |
| Sağlayıcı başına bir satır | O yapay zekânın kayıtlı her sağlayıcısı, modeli ve durumuyla; yanıt vermeyen bir sağlayıcı nedenini ikinci satırda gösterir |
| **Kullanımda** / **Kullan** | Şu an yanıt veren sağlayıcı ve diğerlerinin her birinde tek tıkla geçiş |
| **Yapay zekâyı yapılandır** | **Ayarlar → Yapay zekâ** sayfasını açar |
| **Kullanım ve maliyet** | Depo ayarlarının *Analiz* sekmesini açar |

**Kullan**, profilin yapay zekâsını okuduğu yere yazar. Genel yapay zekâyı
izleyen bir profilde genel yapay zekâyı — dolayısıyla onu izleyen her profili —
değiştirir; kendi yapay zekâsı olan bir profilde yalnızca onunkini. Kendi
sağlayıcısı olan görevler onu korur. **Esc** paneli kapatır; yapay zekâ
kapalıyken düğme gizlenir.

![Durum çubuğundan kullanılan yapay zekâ: profil, yapay zekâsı ve durumuyla her sağlayıcı](../../screenshots/statusbar-ai.webp)

**Sınırlar:** nokta, uygulamanın zaten getirdiği model listesinden (bir güne
kadar saklanır) çıkarılır ve hiçbir şeyi test etmez; yanıt vermeyi bırakmış bir
sağlayıcı hâlâ **Hazır** görünebilir — emin olmanın yolu Ayarlar'da bağlantıyı
test etmektir. Ayarlar açılana kadar pencere anahtarların kendisini tutmaz; bu
yüzden anahtarı olmayan bir sağlayıcı orada **Anahtar yok** yerine
**Denetlenmedi** ya da **Yanıt vermiyor** görünebilir. Ayarlar'daki **Kullan**
gibi, geçiş de kullanıma aldığı sağlayıcıyı test etmez.

### API anahtarı yerine abonelik kullanmak

**Ayarlar → Yapay zekâ** içinde **Aboneliğimi kullan**’ı seçin. [İlk
çalıştırmada](first-run.md), yapay zekâ adımındaki **Aboneliğim** kartı Claude
Code veya Codex’i bulur ve tek adımda test eder; hiçbiri bulunamazsa bu aynı
kuruluma döner. Kullandığınız planı seçin, ardından sağlayıcının kurulum
talimatları için **Belgeler**’i açın. Kurulduktan sonra **ChatGPT (Codex)
bağla** veya **Claude (Claude Code) bağla**’yı seçin. Sağlayıcının CLI’ı
tarayıcınızda giriş sayfasını açar ve kendi oturumunu saklar. Mevcut bir
abonelik oturumu yeniden kullanılır. **Vazgeç** bekleyen bir bağlantıyı
durdurur. Üç dakikadan uzun süren bir giriş durur ve yeniden denenebilir.

| Plan | Gereken CLI | Terminalden giriş |
| --- | --- | --- |
| Codex erişimli ChatGPT | Codex CLI | `codex login` ve ChatGPT’yi seçin |
| Claude Code erişimli Claude | Claude Code | `claude auth login` ve abonelik hesabınızı seçin |

Bağlanmak oturumu da test eder. Terminalden giriş yaptıysanız **Bağlantıyı
sına**’yı seçin. GitHuttBr CLI’ın giriş yöntemini denetler ve boş bir geçici
dizinden kısa bir test istemi gönderir. İstek sağlayıcınızın kotasından düşer.
**Bağlı** göründükten sonra **Sağlayıcı ekle**’yi seçin. Genel yapay zekânın ilk
hesabı **Kullanımda** yapılır. Mevcut bir kurulum için satırındaki **Kullan**’ı
seçin ya da aşağıda tek tek özellikleri atayın. İlk çalıştırmada kurulumu
atlamak için **Atla, yapay zekâ yok**’u seçin ve hazır olduğunuzda Ayarlar’a
dönün.

GitHuttBr CLI’ı bulamazsa onu kurun ya da çalıştırılabilir dosyanın tam yolunu
girip yeniden test edin. Giriş süresi dolduysa ya da CLI bir API anahtarı
kullanıyorsa abonelik hesabıyla giriş yapın. Bir kullanım sınırına ulaşırsanız
sağlayıcının kotasının sıfırlanmasını bekleyin.

![Aboneliğimi kullan](../../screenshots/ai-subscription.webp)

Elle kurulum için, bu makinede zaten kurulu ve oturum açılmış bir ajan CLI’ı ile
yanıt vermek üzere **Yerel CLI** sağlayıcısını seçin — `claude`, `gemini`,
`codex` veya `devin`. GitHuttBr programı isteminizle çalıştırır ve yanıtını
okur; yapıştırılacak bir API anahtarı yoktur ve hiçbir token saklanmaz.

GitHuttBr yalnızca hesap olarak senin tanımladığın komutu çalıştırır ve bunu her
zaman kabuk yerine bir argüman listesiyle yapar; böylece bir diff'teki ya da dal
adındaki hiçbir şey komut olarak yorumlanamaz.

Her çağrı CLI’ı çalışma dizini olarak depoyla başlatır; böylece Devin gibi ajan
CLI’ları körlemesine yanıt vermek yerine sorduğunuz dosyaları açabilir. Deposu
olmayan özellikler (tema oluşturma) onu uygulamanın kendi dizininden çalıştırır.

> **Bu, API anahtarından daha gizli değildir.** İstemlerin yine aynı sağlayıcıya,
> kendi hesabının altında, anahtarla olduğu gibi ulaşır. Değişen şey faturalama
> ve kurulumdur, metnin nereye gittiği değil.

Komut `PATH` üzerinde değilse tam yolunu hesaba yaz.

### Göreve göre model

**Göreve göre model** başlığı altında her özellik — commit mesajları,
sohbet, kodu açıklama, PR incelemesi, çakışma çözümü, wiki, temalar — kendi
hesabını ve modelini gösterebilir. **Kullanımda** olarak işaretli sağlayıcıyı
izlemesi için satırı **Kullanımdaki sağlayıcı** üzerinde bırak. Commit
mesajlarına ucuz, sohbete güçlü bir model en yaygın paylaştırmadır.

### Yükseltme bildirimi

Hesaplardan önceki bir sürümden yükseltirken bu bir kez görünür. Elindeki sağlayıcı ve anahtar ilk hesap olur; elle yeniden yapılandırılacak bir şey yoktur.

![Yükseltme bildirimi](../../screenshots/ai-accounts-notice.webp)

## Modeller

Model listeleri doğrudan sağlayıcıdan gelir ve bir gün önbellekte tutulur;
**Model** yanındaki yenile düğmesi birini anında tazeler. Listenin altında GitHuttBr listenin
nereden geldiğini söyler — canlı, önbellekten (tarihiyle) ya da yerleşik yedek
listeden, ve nedenini.

Liste, bir sohbet isteğini yanıtlayabilecek modellere göre süzülür; gömme, konuşma
ve görsel modelleri dışarıda kalır. Her model kutusu serbest metin de kabul eder,
böylece bir önizleme modeli, özel bir dağıtım ya da yeni çekilmiş bir Ollama
etiketi sağlayıcı listelemese bile hep kullanılabilir.

Henüz anahtar vermediğin ya da erişilemeyen bir sağlayıcı, boş bir açılır liste
yerine küçük bir yerleşik listeye düşer.

Hiçbir sağlayıcı sıralanmış ya da seçilmiş bir liste yayımlamaz, dolayısıyla düzenleme GitHuttBr'nundur: tarihli anlık görüntüler, anlık görüntüsü oldukları modelin içine katlanır (`gpt-4o`, `gpt-4o-2024-08-06`'yı kapsar) ve geri kalanı alfabetik yerine yeniden eskiye sıralanır. Listenin altındaki **Tüm modelleri göster**, sağlayıcının döndürdüğü her şeyi geri getirir.

## Neler yapabilir

| Özellik | Ne elde edersiniz |
|---|---|
| **Commit mesajı** | Hazırlanmış diff'inizden, seçtiğiniz üslupta bir özet (ve isteğe bağlı gövde) |
| **Bu dosyayı açıkla** | Yan panelde sade dille açıklama — Normal, Kısa, ELI5… hatta Korsan |
| **Üzerine gelince açıkla** | <kbd>⇧</kbd> tuşunu basılı tutup bir tanımlayıcıyı gösterin: tek satırlık açıklama ve dayandığı satırlar |
| **Seçimi yapay zekâyla düzenleme** | Bir dosyada satırları seçin, değişikliği tarif edin; model yalnızca o satırları düzenleyici taslağında yeniden yazar |
| **Çakışma çözümü** | Düzenlenebilir çıktıya bir birleştirme önerir — asla kendiliğinden uygulamaz |
| **PR incelemesi** | Bir diff'i özetler ve riskleri işaretler, her biri gerçek bir `path:line` konumuna bağlı |
| **PR açıklaması** · **dal adları** | Dalın commit'lerinden ve diff'inden taslaklanır |
| **Temalar** · **grafik paletleri** | Bir istemden üretilir |
| **Akıllı hazırlama** | Bu commit'e neyin ait olduğuna dair öneriler |
| **[Depo sohbeti](repo-chat.md)** | Dayanaklı sorular ve incelenmiş dosya değişiklikleri, ardından doğrulanmış Git eylemleri |
| **Yapay zekâ yapılandırma sihirbazı** | Depo için asistan yapılandırma dosyaları (talimatlar, ajanlar, hook'lar) üretir — sohbet paneli başlığındaki sihirli değnek düğmesi |

### Yalnızca seçtiğiniz satırları düzenleyin

Dosya görünümünde değişmesini istediğiniz satırların üzerinden sürükleyin ve
**AI düzenleme…**’ye basın (ya da bir satıra sağ tıklayıp menüden seçin).
Alttaki bir çubuk seçili aralığı gösterir ve talimatınızı alır — “bu değişkeni
yeniden adlandır”, “null denetimleri ekle”, “bu metinleri çevir”. Model seçili
satırları ve çevresinden biraz bağlamı görür ve yalnızca o aralığın yerine
geçecek metni döndürür; bu metin diske değil **düzenleyici taslağına** gider.
Onu orada inceler, normal düzenleme akışıyla kaydeder ya da atarsınız; yani siz
söyleyene kadar hiçbir şey yazılmaz. Yanıt bir araç çağrısı değil metin olduğu
için yalnızca ajan CLI’larında değil, yapılandırılmış her arka uçta çalışır.
Sınırlar: bir seferde tek bir bitişik aralığı yeniden yazar, bütün dosya
oluşturamaz ya da silemez ve diff hunk’larını aşan bir seçim reddedilir — onun
yerine dosya görünümünde seçin.

## Tahmin değil, dayanaklı

İnceleme diff'i **etiketlenmiş hunk'lar** olarak görür ve yalnızca bu etiketleri
gösterebilir; GitHuttBr da her etiketi gerçek bir dosya ve satıra çözer. Bir konum
uyduran model **reddedilir ve yeniden sorulur**; böylece bulgular her zaman var
olan bir kodu işaret eder.

Üzerine gelince açıkla, yalnızca token'ın çevresindeki numaralandırılmış bir
pencereyi okur — bir diff'te yalnızca ekranda görünen hunk'ları — bu yüzden bir
tanım başka yerde yaşıyorsa uydurmak yerine bunu söyler. Yanıtlar dosya sürümü
başına önbelleğe alınır.

[Depo sohbeti](repo-chat.md) de aynı şekilde çalışır: yalnızca kendisine verilen
alıntıları gösterebilir ve iki aşamalı istek bunları modelin yazdığı herhangi
bir şeyden değil, Git’in kendi izlenen dosya listesinden seçer. Bir değişiklik
önerdiğinde GitHuttBr kesin dosya eylemlerini doğrular, diff’lerini yerelde
hesaplar, ardından sonraki Git eylemlerini ayarlanmış onay politikasına göre
çalıştırır.

**Maskelenmiş gizli dosyalar asla gönderilmez.** Gizli bilgi maskeleme
kurallarının kapsadığı dosyalar da gönderilmez — sohbete elle sabitlediğiniz bir
dosya dahil; okunmak yerine bir gerekçeyle reddedilir.

## Bir model yavaşladığında ya da yanıt vermeyi bıraktığında

Dizüstü bilgisayardaki yerel bir model bir commit mesajı için bir dakika
harcayabilir, yanıt vermeden önce "düşünen" bir model daha da uzun sürer — ama
isteğin ortasında kapatılan bir sunucu sizi dönen bir göstergeye bakar halde
bırakmamalı.

| Ne olur | Ne görürsünüz |
|---|---|
| 30 saniye sonra yanıt yok | *"{hesap} yanıt vermek için beklenenden uzun sürüyor."*, **Beklemeye devam et**, **{başka hesap} kullan** ve **İptal** düğmeleriyle. Beklemeye devam et, hâlâ sürüyorsa bir dakika sonra yeniden sorar |
| Yerel bir sunucu (Ollama, LM Studio, llama.cpp…) çalışırken kapatılır | Birkaç saniye içinde: *"{hesap} yanıt vermiyor. Hâlâ çalışıyor mu?"*, kullanıma hazır diğer her hesap için bir düğme ve **İptal** ile |
| Siz sorduğunuzda sunucu zaten kapalıydı | Aynısı, hemen |

**{başka hesap} kullan** isteği iptal eder ve aynısını o hesaba, onun varsayılan
modeliyle gönderir — commit mesajı, inceleme ya da sohbet yanıtı oraya
sormuşsunuz gibi gelir. Ayarlarınızı değiştirmez: sonraki istek yine o görev
için seçtiğiniz hesaba gider.

Bu, her yapay zekâ özelliğini kapsar — commit mesajları, sohbet, inceleme,
açıklama, çakışmalar, temalar, wiki — çünkü hepsi aynı çağrıdan geçer.

## Sınırlar

- **Kapatılıp kapatılmadığı yalnızca yerel sunucularda izlenir.** Çöken bir
  bulut sağlayıcısı kendi hatasıyla başarısız olur; yalnızca yavaş olan bir
  bulut çağrısı da diğerleri gibi *uzun sürüyor* uyarısını alır. Kapalı değil de
  meşgul olan yerel bir sunucu canlı sayılır: çağrıyı erken bitiren yalnızca
  reddedilen ya da kopan bir bağlantıdır.

- Yerleşik yedek listeler sürümler arasında eskir. Canlı getirme tam da bunun
  içindir; yedek yalnızca getirmenin mümkün olmadığı durumu kapsar.
- Sağlayıcının listesini sohbete uygun modellere süzmek ada göre yapılır, bu
  yüzden alışılmadık adlı bir sohbet modeli elenebilir. O zaman kendin yaz.
- Bir CLI hesabı, CLI bildirmediği sürece belirteç kullanımını raporlayamaz;
  Ayarlar'daki kullanım ve maliyet rakamları bu çağrıları eksik sayar.
- CLI cevapları doğrudan API çağrısından yavaştır: ikili dosya her istek için
  baştan bir oturum başlatır.
- Anahtarlar hesap başına işletim sisteminizin anahtar zincirinde saklanır. Bir
  hesabı silmek anahtarını da siler — önce sorar ve geri alınamaz.
- **Tek** hesap da silinebilir — yanıt vermeyi bırakan bir sağlayıcı, önce
  ikinci bir hesap uydurmanızı gerektirmemeli. Siz yenisini kurana kadar yerini
  boş bir hesap alır ve onay iletisi bunu söyler. Silinecek bir şeyi olmayan tek
  hesap, o dokunulmamış boş hesaptır.
- Genel yapay zekâdan önceki bir sürüme dönmek, genel yapay zekânın anahtarlarını
  kaybettirir: o sürüm anahtarların nerede tutulduğunu bilmez ve kaydederken
  onları atar. Hesaplar kalır; anahtarları yeniden yazın. Bir profilin kendi
  yapay zekâsı bundan etkilenmez.

**Ayrıca bakınız:** [Depo sohbeti](repo-chat.md) · [Depo wiki'si](repo-wiki.md) · [Güvenlik ve sırlar](security.md)
