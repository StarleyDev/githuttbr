---
title: Yapay zekâ özellikleri
category: Yapay zekâ
order: 80
summary: İsteğe bağlı, sağlayıcıdan bağımsız ve gerçek kodunuza dayalı.
keywords: yapay zekâ yerel model commit mesajı açıklama inceleme ai openai anthropic ollama local llm commit message explain review wiki grounded hesaplar hesap api anahtarı abonelik cli claude codex gemini modeller
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

Bir profil bunun yerine **kendi yapay zekâsını** kullanabilir — maliyet ya da veri
politikası nedeniyle şirketin hesabından geçmesi gereken bir iş profili gibi. O
profilin **Profil** sayfasında, *Bu profilin yapay zekâsı* altında **Genel**'i
**Kendi** olarak değiştirin: genel yapay zekânın bir kopyası olarak başlar ve o
andan itibaren sağlayıcıları ve anahtarları yalnızca onundur. Yeniden **Genel**'e
geçmek, bir onaydan sonra onları kaldırır ve genel yapay zekâyı olduğu gibi
bırakır.

Her yapay zekâ bu tek sayfada kurulur. Üstteki **Düzenlenen** çubuğu hangisini
seçer: genel yapay zekâyı ya da bir profilin kendisininkini (*İş profilinin kendi
yapay zekâsı*). Profil sayfasındaki **Kendi yapay zekâsını ayarla** ya da profil
listesindeki **Kendi yapay zekâsını düzenle**, sayfayı doğrudan onda açar. Profil
sayfasının kendisi yalnızca profilin hangi yapay zekâyı kullandığını ve neyin
cevap verdiğini gösterir — düzenleyici asla orada değildir.

![Bir profilin yapay zekâsı, Profil sayfasında: Genel ya da Kendi, neyin cevap verdiği ve nasıl kurulacağı](../../screenshots/settings-profile-ai.webp)

Yapay zekânın nasıl **yazdığı** her iki durumda da profile özgü kalır: commit
mesajı stili, açıklama stili, çakışma ve dal adlandırma stilleri, özel
talimatlar, ortak yazar satırı ve depo sohbeti. Bunlar **Profil** sayfasında,
*Yapay zekânın yazım tercihleri* altındadır; böylece bir iş profili `ticket`
commit'leri yazarken kişisel profil `conventional` olanları yazar, ikisi de aynı
yapay zekâyla.

Her profilin kendi yapay zekâsı olan bir sürümden yükseltmek hiçbir şey
kaybettirmez: kullanımdaki profilin yapay zekâsı genel yapay zekâ olur ve yapay
zekâsı farklı olan diğer her profil onu kendisininki olarak korur.

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
CLI** sağlayıcısını seç — `claude`, `gemini` ya da `codex`. Gitcito ikili dosyayı
isteminle çalıştırır ve cevabını okur; yapıştırılacak bir API anahtarı yoktur,
saklanan bir belirteç de.

Gitcito yalnızca hesap olarak senin tanımladığın komutu çalıştırır ve bunu her
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
**Modelleri getir** birini anında tazeler. Listenin altında Gitcito listenin
nereden geldiğini söyler — canlı, önbellekten (tarihiyle) ya da yerleşik yedek
listeden, ve nedenini.

Liste, bir sohbet isteğini yanıtlayabilecek modellere göre süzülür; gömme, konuşma
ve görsel modelleri dışarıda kalır. Her model kutusu serbest metin de kabul eder,
böylece bir önizleme modeli, özel bir dağıtım ya da yeni çekilmiş bir Ollama
etiketi sağlayıcı listelemese bile hep kullanılabilir.

Henüz anahtar vermediğin ya da erişilemeyen bir sağlayıcı, boş bir açılır liste
yerine küçük bir yerleşik listeye düşer.

Hiçbir sağlayıcı sıralanmış ya da seçilmiş bir liste yayımlamaz, dolayısıyla düzenleme Gitcito'nundur: tarihli anlık görüntüler, anlık görüntüsü oldukları modelin içine katlanır (`gpt-4o`, `gpt-4o-2024-08-06`'yı kapsar) ve geri kalanı alfabetik yerine yeniden eskiye sıralanır. Listenin altındaki **Tüm modelleri göster**, sağlayıcının döndürdüğü her şeyi geri getirir.

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
gösterebilir; Gitcito da her etiketi gerçek bir dosya ve satıra çözer. Bir konum
uyduran model **reddedilir ve yeniden sorulur**; böylece bulgular her zaman var
olan bir kodu işaret eder.

Üzerine gelince açıkla, yalnızca token'ın çevresindeki numaralandırılmış bir
pencereyi okur — bir diff'te yalnızca ekranda görünen hunk'ları — bu yüzden bir
tanım başka yerde yaşıyorsa uydurmak yerine bunu söyler. Yanıtlar dosya sürümü
başına önbelleğe alınır.

**Maskelenmiş sır dosyaları asla gönderilmez.** Sır maskeleme kurallarının
kapsadığı dosyalar da gönderilmez.

## Sınırlar

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
