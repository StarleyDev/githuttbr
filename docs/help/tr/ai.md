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
| **Commit mesajları** | Commit mesajı stili, *Commit açıklaması üret*, ortak yazar satırı |
| **Açıklama ve üzerine gelme** | Açıklama stili, *İmleç üzerindeyken kodu açıkla* ve değiştirici tuşu |
| **Çakışmalar ve dallar** | Çakışma çözme stili, dal adlandırma stili |
| **Özel yönergeler** | Kendi kurallarınız; bu yapay zekânın yaptığı her isteğe eklenir |
| **Depo sohbeti** | Sohbetin açık olup olmadığı, neyi okuduğu, önerebileceği eylemler — bkz. [Depo sohbeti](repo-chat.md#ayarlar) |

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

Anthropic, OpenAI biçimli bir çağrı yerine kendi `/v1/messages` API'sini
kullanır; böylece Claude modelleri yalnızca çalışıyor gibi görünmek yerine
gerçekten çalışır. Gemini'ye Google'ın OpenAI uyumlu uç noktası üzerinden
ulaşılır.

### API anahtarı yerine abonelik kullanmak

İlk kurulumda veya Ayarlar → Yapay zekâ bölümünde **Aboneliğimi kullan** seçeneğini seçin. ChatGPT veya Claude için ilgili komutu terminalde çalıştırıp oturum açın. Bağlantıyı test edin ve test başarılı olunca hesabı ekleyin. Genel yapay zekânın ilk hesabı varsayılan olur.

CLI kurulduktan sonra sağlayıcının oturum açma sayfasını açmak için Bağlan düğmesine basın. Bekleyen bağlantıyı iptal edebilirsiniz.

- ChatGPT (Codex) — `codex login`
- Claude (Claude Code) — `claude auth login`

Test sağlayıcınıza kısa bir istek gönderir ve plan kotanızı kullanır. Plan sınırına ulaşıldı. Kota yenilendikten sonra tekrar deneyin.

![Aboneliğimi kullan](../../screenshots/ai-subscription.webp)

Bu makinede kurulu ve oturumu açık bir aracı CLI ile cevap almak için **Yerel
CLI** sağlayıcısını seç — `claude`, `gemini` ya da `codex`. GitHuttBr ikili dosyayı
isteminle çalıştırır ve cevabını okur; yapıştırılacak bir API anahtarı yoktur,
saklanan bir belirteç de.

GitHuttBr yalnızca hesap olarak senin tanımladığın komutu çalıştırır ve bunu her
zaman kabuk yerine bir argüman listesiyle yapar; böylece bir diff'teki ya da dal
adındaki hiçbir şey komut olarak yorumlanamaz.

> **Bu, API anahtarından daha gizli değildir.** İstemlerin yine aynı sağlayıcıya,
> kendi hesabının altında, anahtarla olduğu gibi ulaşır. Değişen şey faturalama
> ve kurulumdur, metnin nereye gittiği değil.

Komut `PATH` üzerinde değilse tam yolunu hesaba yaz.

### Göreve göre model

**Göreve göre model** başlığı altında her özellik — commit mesajları,
sohbet, kodu açıklama, PR incelemesi, çakışma çözümü, wiki, temalar — kendi
hesabını ve modelini gösterebilir. Varsayılan hesabı izlemesi için satırı
varsayılanda bırak. Commit mesajlarına ucuz, sohbete güçlü bir model en yaygın
paylaştırmadır.

### Yükseltme bildirimi

Hesaplardan önceki bir sürümden yükseltirken bu bir kez görünür. Elindeki sağlayıcı ve anahtar ilk hesap olur; elle yeniden yapılandırılacak bir şey yoktur.

![Yükseltme bildirimi](../../screenshots/ai-accounts-notice.webp)

## Modeller

Model listeleri doğrudan sağlayıcıdan gelir ve bir gün önbellekte tutulur;
**Modelleri getir** birini anında tazeler. Listenin altında GitHuttBr listenin
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
| **Çakışma çözümü** | Düzenlenebilir çıktıya bir birleştirme önerir — asla kendiliğinden uygulamaz |
| **PR incelemesi** | Bir diff'i özetler ve riskleri işaretler, her biri gerçek bir `path:line` konumuna bağlı |
| **PR açıklaması** · **dal adları** | Dalın commit'lerinden ve diff'inden taslaklanır |
| **Temalar** · **grafik paletleri** | Bir istemden üretilir |
| **Akıllı hazırlama** | Bu commit'e neyin ait olduğuna dair öneriler |
| **Yapay zekâ yapılandırma sihirbazı** | Depo için asistan yapılandırma dosyaları (talimatlar, ajanlar, hook'lar) üretir — sohbet paneli başlığındaki sihirli değnek düğmesi |

## Tahmin değil, dayanaklı

İnceleme diff'i **etiketlenmiş hunk'lar** olarak görür ve yalnızca bu etiketleri
gösterebilir; GitHuttBr da her etiketi gerçek bir dosya ve satıra çözer. Bir konum
uyduran model **reddedilir ve yeniden sorulur**; böylece bulgular her zaman var
olan bir kodu işaret eder.

Üzerine gelince açıkla, yalnızca token'ın çevresindeki numaralandırılmış bir
pencereyi okur — bir diff'te yalnızca ekranda görünen hunk'ları — bu yüzden bir
tanım başka yerde yaşıyorsa uydurmak yerine bunu söyler. Yanıtlar dosya sürümü
başına önbelleğe alınır.

**Maskelenmiş sır dosyaları asla gönderilmez.** Sır maskeleme kurallarının
kapsadığı dosyalar da gönderilmez.

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
- Anahtarlar hesap başına işletim sisteminin anahtarlığında saklanır. Bir hesabı
  silmek anahtarını da siler.
- Genel yapay zekâdan önceki bir sürüme dönmek, genel yapay zekânın anahtarlarını
  kaybettirir: o sürüm anahtarların nerede tutulduğunu bilmez ve kaydederken
  onları atar. Hesaplar kalır; anahtarları yeniden yazın. Bir profilin kendi
  yapay zekâsı bundan etkilenmez.

**Ayrıca bakınız:** [Depo wiki'si](repo-wiki.md) · [Güvenlik ve sırlar](security.md)
