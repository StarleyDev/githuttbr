---
title: Yorum yazmak
category: Eşitleme ve çoklu depo
order: 57.5
summary: Her yorum kutusunun ardındaki Markdown düzenleyici — Yaz / Önizleme, GitHub’ın kısayollarıyla bir biçimlendirme çubuğu, Enter’da devam eden listeler ve @bahsetme / #referans tamamlama.
keywords: markdown düzenleyici yorum kutusu araç çubuğu kalın italik kod bağlantı alıntı başlık madde işaretli numaralı liste görev listesi kontrol listesi önizleme yaz kısayol bahsetme at işareti referans diyez issue numarası otomatik tamamlama yanıt pull request açıklaması issue gövdesi markdown editor comment box toolbar mention reference autocomplete reply
source: cc7673de22ce745f04a0341c4d263219c432b693
---

# Yorum yazmak

GitHub’a gönderilen bir yorum Markdown’dır ve çıplak bir metin kutusu her `**` ve
`- [ ]` işaretini elle yazmanıza, sonra da tablonun düzgün görünüp görünmediğini
tarayıcıda öğrenmenize bırakır. Uygulamada bir sunucuya yazan her kutu artık aynı
düzenleyicidir; GitHub’ın kendi yorum kutusundaki araçlarla:

- bir pull request’in yorum kutusu, konuşma yanıtları ve satır yorumları
  ([Pull request sayfası](pull-requests.md));
- bir issue’nun yorum kutusu;
- yeni bir pull request’in açıklaması ve yeni bir issue’nun gövdesi
  ([Sunucular ve pull request’ler](hosting.md)).

![Bir pull request’in yorum kutusu; biçimlendirme çubuğu ve “@al” üzerinde açılmış, bahsedilecek kişiler listesi](../../screenshots/comment-editor.webp)

## Yaz ve Önizleme

**Önizleme**, metni görüneceği gibi gösterir; uygulamanın geri kalanıyla aynı
Markdown işleyicisiyle çizilir. Salt okunurdur; **Yaz**, alanı metin ve imleç
bıraktığınız yerde olacak şekilde geri getirir, böylece ⌘/Ctrl+Z bakmadan önce
yazdıklarınızı yine geri alır.

Sekmeler bir sekme listesidir: biri odaktayken ← ve → aralarında geçiş yapar.

## Araç çubuğu

| Araç | Kısayol | Ne yapar |
|---|---|---|
| **Başlık** | — | Seçili satırlar için H1, H2 ve H3 menüsü; bir satırın zaten sahip olduğu düzeyi seçmek onu kaldırır |
| **Kalın** | ⌘/Ctrl+B | `**metin**` |
| **İtalik** | ⌘/Ctrl+I | `_metin_` |
| **Kod** | ⌘/Ctrl+E | Satır içinde `` `kod` ``; seçim birden çok satıra yayıldığında ```` ``` ```` ile çevrili bir blok |
| **Bağlantı** | ⌘/Ctrl+K | `[metin](url)` — seçili bir URL adres olur, diğer metin etiket |
| **Alıntı** | — | Seçili her satırın başına `> ` |
| **Madde işaretli liste** | ⌘/Ctrl+Shift+8 | Seçili her satırın başına `- ` |
| **Numaralı liste** | ⌘/Ctrl+Shift+7 | Seçili her satırın başına `1. `, `2. `… |
| **Görev listesi** | — | Seçili her satırın başına `- [ ] ` |

Her araç bir açma/kapama düğmesidir: onu zaten taşıyan metne uygulanırsa kaldırır.
Hiçbir şey seçili değilken kalın, italik, kod ve bağlantı bir yer tutucu ekler ve
üzerine yazmaya hazır olarak seçer. Bir liste aracı, başka türde bir listenin
üstüne binmek yerine onu değiştirir.

Düzenlemeler metin alanının kendi düzenlemesinden geçer, bu yüzden **⌘/Ctrl+Z bir
aracı** tıpkı yazılmış bir kelime gibi **geri alır**, yinele de geri getirir.

Çubuk Tab için tek bir duraktır; ← → düğmeleri arasında gezinir, ↓ başlık menüsünü
açar. Bir yorum kutusunun içinde ⌘/Ctrl+K komut paletini açmak yerine bağlantı
oluşturur. Mac’te kısayollar yalnızca ⌘ kullanır, böylece Ctrl+B, Ctrl+E ve Ctrl+K
macOS metin alanlarında yaptıklarını yapmaya devam eder. Harfleri Latin olmayan bir
klavye düzeninde kısayollar fiziksel B, I, E ve K tuşlarını izler.

## Listeler

Bir liste öğesinin sonunda **Enter** bir sonrakini başlatır — aynı madde işareti,
sonraki numara, görev için boş bir `- [ ]` — aynı girintiyle. İşaretinden sonra
hiçbir şey olmayan bir öğede Enter listeyi bitirir ve işareti kaldırır. Shift+Enter
düz bir yeni satırdır.

## Bahsetmeler ve referanslar

**@** yazmak, siz yazdıkça daralan kısa bir kişi listesi açar; **#**, pull
request’leri ve issue’ları numara ve başlığa göre listeler (`#42`, ya da başlıktaki
bir kelime için `#arama`). ↑ ↓ seçer, Enter veya Tab ekler, Esc listeyi kapatır —
yalnızca listeyi, kutuyu ya da etrafındaki iletişim kutusunu değil.

Liste, sunucuya yeniden sormadan uygulamanın zaten tuttuklarından gelir:

| Kutu | @ sunar | # sunar |
|---|---|---|
| Pull request | Yazarını, inceleyenlerini, atananlarını ve yorum yapan herkesi | Deponun açık pull request’leri ve issue’ları, kenar çubuğuna yüklendiği hâliyle |
| Issue | Yazarını, atananlarını ve yorum yapanları | Aynısı |
| Yeni pull request | İnceleyen ve atanan seçicilerinin okuduğu kişileri ve yüklü pull request’lerin yazarlarını | Aynısı |
| Yeni issue | Yüklü pull request’lerin ve issue’ların yazarlarını | Aynısı |

Bir kelimenin içindeki **@** ya da **#** (bir e-posta adresi), bir başlığın `#`
işareti ve kod içindeki her şey olduğu gibi bırakılır.

## Göndermek

⌘/Ctrl+Enter her kutudan gönderir: bir pull request ya da issue yorumu, bir konuşma
yanıtı, bir satır yorumu ve yeni bir issue’nun açıklaması. Yalnızca alandan değil,
sekmelerden, araç çubuğundan ve önizlemeden de çalışır. Esc bir satır yorumunu aynı
yerlerden iptal eder. Bir **konuşma yanıtı** eskiden Enter ile gönderilen tek
satırlık bir alandı; artık küçük bir metin kutusu, bu yüzden Enter yeni bir satır
(ya da sonraki liste öğesi) ve ⌘/Ctrl+Enter gönderir. Bir yanıt kutusu, uzun bir
konuşmada her konuşmanın altında bir araç çubuğu birikmesin diye, sekmelerini ve
araçlarını ancak içine tıkladığınızda gösterir.

## Kopya kâğıdı

Her kutunun altındaki **Markdown desteklenir**, yerinde bir kopya kâğıdı açar: her
biçim, onun için ne yazılacağı ve kısayolu. Esc ya da başka bir yere tıklamak onu
kapatır. Yazdığınız hiçbir şey yerinden oynamaz.

Altında **Tam kılavuzu aç** bu sayfayı açar. El kitabı kendi sekmesidir, bu yüzden
oraya gitmek kutunun bulunduğu sayfadan ayrılmak demektir ve gönderilmemiş metin
kaybolurdu: varsa — bu kutuda ya da pull request sayfasındaki başka bir kutuda —
uygulama önce sorar. Yeni pull request ve yeni issue iletişim kutularında kâğıtta bu
bağlantı yoktur, çünkü el kitabı iletişim kutusunun arkasında açılırdı.

## Sınırlar

- **Ek yok.** Kutuya bir dosya sürüklemek ya da bir resim yapıştırmak onu yüklemez:
  GitHub’ın yorum ekleri için herkese açık bir API’si yoktur, bu yüzden dosyayı
  koyacak bir yer yoktur. Web sitesinde yükleyin ve bağlantıyı yapıştırın.
- **Yalnızca zaten yüklü olan kişiler ve öğeler.** @ sunucunun kullanıcılarında, #
  da tüm issue’larda arama yapmaz — konuşmaya katılmamış bir kişi ya da kenar
  çubuğunun okumadığı kapalı bir issue sunulmaz. Adı ya da numarayı yine de tam
  olarak yazabilirsiniz.
- **Önerilen değişiklik, kayıtlı yanıt ya da emoji seçici yok.**
- **Önizleme uygulamanın işleyicisidir.** Markdown’ı uygulamanın çizdiği gibi
  gösterir; sunucunun kendi görüntülemesi ayrıntılarda farklı olabilir (GitHub’a
  özgü uzantılar, bağlantıya dönüşen bahsetmeler).
- **Önizleme uygulamanın çizimidir, sunucunun değil.** Pull request ve issue
  sayfalarında önizleme, metni gönderilen yorumun uygulamada gösterileceği gibi çizer
  ([yorumlar nasıl gösterilir](pull-requests.md#yorumlar-nasıl-gösterilir)): aynı katı profil, korunan
  satır sonları ve bir tıklama bekleyen başka bir siteden bir görsel. GitHub’da
  gönderilen yorumu ardından GitHub çizer, bu yüzden uygulamanın bilmediği bir uzantı
  farklı görünebilir. Yeni pull request ve yeni issue iletişim kutuları uygulamanın
  olağan Markdown önizlemesini kullanır.
- Kısayollar sabittir: kısayol ayarlarında yer almazlar ve oradaki bir yeniden
  atamayı izlemezler.
