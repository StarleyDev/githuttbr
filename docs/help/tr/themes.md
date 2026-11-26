---
title: Temalar ve görünüm
category: Kendinize göre uyarlayın
order: 100
summary: Açık ve koyu yerleşik temalar, ayrıca özel ve yapay zekâ üretimi temalar ve renkli simgeler.
keywords: tema temalar theme themes koyu dark açık light görünüm appearance renkler colors yazı tipi boyutu font size grafik graph palet palette arama ayarlar bulmak search settings simge simgeler icon icons simge renkleri icon colors ton tint tek renk monochrome
---

# Temalar ve görünüm

Yerleşik temalar — GitHuttBr, Nord, Dracula, Solarized, GitHub, Monokai,
Midnight, Contrast ve Daltonic — her biri açık ve koyu varyantıyla.

![Açıktan koyuya geçiş](../../screenshots/clip-themes.webp)

- **Açık, koyu ya da işletim sistemini izle**, anında değişir.
- **Özel temalar** ve bir istemden **yapay zekâ üretimi** temalar.
- Ayarlanabilir **kod yazı tipi boyutu**.
- Araç çubuğu ve kenar çubuğu bölümleri için **simge renkleri** — aşağıya bakın.
- Ayrı bir **grafik stili**: şerit paleti, köşe stili, satır yoğunluğu ve çizgi
  kalınlığı — canlı bir mini grafik önizlemesiyle.

![Tema ayarları](../../screenshots/settings-themes.webp)

## Simge renkleri

Bir sıra gri simge, etiketlerini okuyana kadar Getir, Push ve Stash'i birbirine
benzetir. Tema sekmesinde Görünüm'ün altındaki **Simge renkleri**, her simgeyi
yaptığı işe göre renklendirir; böylece göz eylemi kelimeden önce bulur:

| Rol | Simgeler | Aldığı tema rengi |
|---|---|---|
| Alma | Getir, Pull, Uzak sunucular, Worktree'ler | temanın camgöbeği (cyan) yuvası |
| Gönderme, bitirme | Push, Yapılacaklar, Sorunlar, Sürümler | yeşil |
| Ref'ler | Dal, Yerel, Etiketler, Pull request'ler, Kilometre taşları, Alt modüller | vurgu rengi |
| Kenara koyma | Stash, Pop, Stash'ler, Yer imleri, Sabitlenmiş | temanın turuncu yuvası |

Geri al, Yinele, Araçlar ve Ayarlar gri kalır: bunlar yardımcı araçlardır ve
onları sade bırakmak, renkli olanların öne çıkmasını sağlar.

Çok sayıda girişi gruplayan listeler bir grubun tamamını aynı anda renklendirir,
böylece grup tek bir aile gibi okunur:

- **Araçlar menüsü** — zamanda yolculuk (Reflog, Çalışma anlık görüntüleri,
  Zaman makinesi, Bisect) turuncu; dal araçları (Emdirme, radarlar, Yerel CI,
  karşılaştırmalar) vurgu renginde; ve her gruba bir renk: İncele camgöbeği,
  Dallar ve geçmiş vurgu rengi, Dosyalar ve yamalar yeşil, Depo turuncu, Sırlar
  ve paylaşım kırmızı.
- **Ayarlar sayfaları** — Yerleşim, Çalışma alanları ve Yapay zekâ vurgu
  renginde; Profil ve Ortam yeşil; Entegrasyonlar ve Veri camgöbeği; Temalar
  turuncu; Güvenlik kırmızı. Genel ve Kısayollar gri kalır.

Etiketsiz bir simge düğmeleri sırası tersini yapar — her düğme kendi rengini alır,
böylece birbirinden ayırt edilebilirler. [Pull request sayfasında](pull-requests.md)
başlığın düğmeleri şöyledir: yenile mavi, yapay zekâ incelemesi vurgu rengi, yerelde
önizle turkuaz, kaynak dala git yeşil ve hedef dala git turuncu (tarayıcıda aç gri
kalır); kendi yorumlarınızda **Düzenle** vurgu rengini, **Sil** kırmızıyı alır —
orada ve issue sayfasında. Mavi ve turkuaz temanın renklerinin karışımlarıdır, bu
yüzden onlar da temayı izler.

| Seçenek | Ne görürsünüz |
|---|---|
| **Tek renk** | Her simge gri, bu seçenek yokken olduğu gibi |
| **Yumuşak ton** (varsayılan) | Griye karışmış renk; üzerine gelince rengin tamamı |
| **Tam renk** | Rengin kendisi, aynı tonda küçük bir zemin üzerinde |

Renkler temadan gelir — yeşilini ya da vurgu rengini değiştiren bir tema
simgeleri de onunla birlikte boyar; özel ve yapay zekâ üretimi temalar dahil.

Sınırlar: yalnızca araç çubuğunun ana düğmeleri, kenar çubuğu bölüm başlıkları,
Araçlar menüsü, Ayarlar sayfaları ve pull request ile issue sayfalarının düğmeleri
renklenir; diğer menüler, bir bölümün içindeki satırlar ve commit grafiği
renklenmez. Üzerine gelinen menü satırı, simgesi dahil her zamanki görünümünü korur.
Renk asla tek ipucu değildir — her simge etiketini korur.

## Bir ayarı bulmak

Ayarlar birçok sayfaya yayılır ve aradığınız seçenek nadiren tahmin ettiğiniz
yerdedir: var olduğunu bilirsiniz, hangi sayfada olduğunu bilmezsiniz.
Ayarlar'ın başlığında, kapatma düğmesinin yanındaki arama alanı tüm sayfalarda
aynı anda arar.

![Ayarlarda “terminal” araması](../../screenshots/settings-search.webp)

Siz yazdıkça sağ taraf eşleşen ayarları sayfaya göre gruplanmış olarak listeler
— her birinde adı, tek satırlık açıklaması ve bulunduğu sayfa yer alır. Kenar
çubuğu eşleşmesi olmayan sayfaları soluklaştırır, eşleşmesi olanlarda bir sayı
gösterir.

- Ayarın adı, açıklaması ve sayfanın adı karşılaştırılır. Büyük/küçük harf ve
  aksanlar dikkate alınmaz; yazdığınız her sözcük geçmelidir, yani "terminal
  yazı tipi" sonucu terminalin yazı tipi ayarlarına daraltır.
- Arama, arayüz dilinde ve aynı anda İngilizce yapılır: uygulama Türkçe iken
  "token" ya da "font" yazmak da ayarı bulur.
- Bir sonuca tıklayın ya da ilki için **Enter**'a basın; sayfası açılır
  (Temalar'da doğru sekme de — Tema ya da Grafik), ayara kaydırılır ve ayar
  kısa bir süre vurgulanır.
- **Esc** aramayı temizler; ikinci bir **Esc** Ayarlar'ı kapatır.

Adlar ve açıklamalar aranır, ayarladığınız değerler değil. Entegrasyonlar'daki
ana makine başına sunucu listeleri (GitHub Enterprise Server, kendi barındırılan
GitLab, Bitbucket Data Center) Entegrasyonlar sayfasını açar; ana makinenin
sekmesini siz seçersiniz. Tek tek klavye kısayolları dizinlenmez — arama,
düzenleyicisi onları listeleyen Kısayollar sayfasını bulur.

## Yerleşim

Kenar çubuğu solda ya da sağda, her yerde yeniden boyutlandırılabilir paneller,
grafiğin tüm pencereyi hak ettiği anlar için katlanabilir bir kenar çubuğu ve
depo başına terminal konumu.

**Ayrıca bakınız:** [Commit grafiği](graph.md) · [Profiller](profiles.md)
