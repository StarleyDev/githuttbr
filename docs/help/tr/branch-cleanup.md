---
title: Dal temizliği
category: Dallanma ve cerrahi
order: 47
summary: Çalışması zaten başka bir yerde olan yerel dalları — kaybolmuş upstream’ler, birleşmiş dallar — geri alınabilir tek bir adımda silin.
keywords: temizle temizlik prune sil kaldır yerel dallar kaybolmuş birleşmiş squash eskimiş ölü eski pull request düzenle dal listesi clean up cleanup delete remove gone merged stale tidy branch list
source: 701f92f45b9e4dcda7dc560cb20128442fd2da0d
---

# Dal temizliği

Checkout ettiğiniz her pull request geride yerel bir dal bırakır. PR birleştirilir,
sunucu onun dalını siler, yerel olan ise kalır — sonsuza kadar. Birkaç yüz
incelemeden sonra dal listesi çoğunlukla ölü dallardan oluşur ve canlı olanları
bulmak hepsinin yanından kaydırmak demektir.

Dal temizliği, çalışması başka bir yerde zaten güvende olan yerel dalları listeler,
kaybedecek bir şeyi olmayanları işaretler ve onları geri alabileceğiniz tek bir
adımda siler. “Başka bir yer”, son fetch’inizdeki uzak izleme dalları ve varsayılan
dal demektir.

![Temizlik iletişim kutusu: kaybolmuş, birleşmiş ve squash ile birleşmiş dallar işaretli, yalnızca burada olan çalışma geri tutulmuş](../../screenshots/branch-cleanup.webp)

## Nasıl çalışır

1. Araçlar → **Yerel dalları temizle…** (ya da <kbd>⌘K</kbd>).
2. Son fetch eskiyse önce **Fetch ve prune** düğmesine basın. Prune’lu bir fetch
   çalışana kadar sunucunun sildiği bir dal burada hâlâ canlı görünür.
3. Ekibiniz pull request’leri squash ile birleştiriyorsa **Squash birleştirmelerini
   kontrol et** düğmesine basın (aşağıya bakın).
4. İşaretleri kontrol edin, sonra **Sil**. Tek bir onay kaç dalın gideceğini söyler ve
   başka hiçbir yerde bulunmayan commit’ler taşıyan her birini adlandırır.

Silme, tek geri alma kaydı olan tek bir işlemdir: **Geri al** silinen her dalı tam
olarak gösterdiği commit’te, upstream’i (`branch.<name>.remote` ve `.merge`) geri
konmuş olarak yeniden oluşturur. O zamandan beri aynı adlı bir dal başka bir
commit’te ortaya çıktıysa — aynı PR yeniden checkout edildiyse — geri alma ona
dokunmaz, silineni yanına `<name>-restored-<short sha>` olarak geri getirir ve bunu
söyler.

Başarı mesajı ve geri alma kaydı, her dalı gösterdiği commit’le birlikte listeler
(`feature/x (was abc1234)`), tıpkı `git branch -D` çıktısı gibi: geri alma geçmişi
yalnızca uygulama açık kaldığı sürece yaşar ve bu satır bir dalı elle yeniden
oluşturmaya yeter.

## Bir dal neden listelenir

| Çip | Anlamı |
|---|---|
| **Kaybolmuş** | Dal, sunucunun sildiği bir upstream’i izler — birleşmiş bir pull request’in olağan izi. |
| **Birleşmiş** | Üzerindeki her commit zaten varsayılan dalda. İpucu onu tutan kopyayı adlandırır — yalnızca yereliniz tutuyorsa `main (local, not pushed)`. |
| **Squash ile birleşmiş** | **Squash birleştirmelerini kontrol et** tarafından bulunur: içeriği varsayılan dalda, tek tek commit’leri değil. |
| **Eskimiş** | Seçtiğiniz ay sayısı boyunca commit yok (varsayılan 3). Yalnızca **Eskimiş dalları da listele** işaretliyse listelenir. |
| **N commit yalnızca burada var** | Hiçbir uzak izleme dalında ve varsayılan dalda olmayan commit’ler. Dalı silmek onları da siler. |
| **Henüz commit yok** | Tam olarak varsayılan dalın ucunu gösterir — büyük olasılıkla oluşturulmuş ve hiç kullanılmamış. |

“Birleşmiş”, varsayılan dalın uzak kopyasına (`origin/main`) ve ayrıca yerelinize
göre ölçülür — bir aydır kimsenin pull yapmadığı yerel bir `main`, o zamandan beri
yapılan birleştirmeleri gizleyemez.

## Squash birleştirmeleri

Bir squash birleştirmesi bir pull request’in değişikliklerini `main` üzerine tek bir
yeni commit olarak koyar; dalın kendi commit’leri hiç gelmez. Git için böyle bir dal
terk edilmiş çalışma gibi görünür: **Kaybolmuş**, *N commit yalnızca burada var*
ile.

Kendi commit’leri olan kaybolmuş dallar listelendiğinde **Squash birleştirmelerini
kontrol et** başka bir soru sorar: bu dalı `main` içine birleştirmek bir şey
değiştirir mi? Hepsi için bellekte tek bir `git merge-tree` çalıştırır — checkout
yok, index yok — ve birleştirmesi `main` ağacını tam olduğu gibi bırakan bir dal
**Squash ile birleşmiş** çipini alır ve birleşmiş biri gibi işaretlenir. Onay,
içeriklerinin `main` içinde olduğunu, commit’lerinin olmadığını söyler.

Kontrol, silme anında kilit altında yeniden çalışır: artık geçemeyen bir dal
silinmez, reddedilir.

## Ne işaretli gelir, ne asla

İletişim kutusu açıldığında işaretli: **kaybolmuş ya da birleşmiş** olup **kendi
commit’i olmayan** dallar — ve kontrol edildikten sonra squash ile birleşmiş olanlar.
**Kaybolmuş + birleşmiş olanları seç** bu seçimi geri getirir.

Sizin için asla işaretlenmeyen ve **Gösterilenlerin tümünü seç** ile asla
kapsanmayan: yalnızca burada olan commit’leri olan bir dal. Onu satır satır
işaretleyin; onay o zaman kırmızıya döner ve onu commit sayısıyla listeler. Yalnızca
eskimiş dallar ve varsayılan dalın ucunda duran bir dal da işaretlenmez. Seçim,
listenin göstermediği satırları içerdiğinde — filtreyle gizlenmiş ya da ilk 400’ün
ötesinde — onay kaç tane olduğunu söyler.

Silme, her dal için tam olarak onayın gösterdiği sayıda benzersiz commit kabul eder.
O zamana kadar bir dalın daha fazlası olursa — ya da **Yinele** sırasında geri
almadan beri bazıları eklendiyse (diyelim ki bir prune uzak kopyayı kaldırdı) —
reddedilir ve tutulur; yinele de başarı iddia etmek yerine bunu bildirir.

Asla listelenmeyen ve istense bile silme tarafından reddedilenler:

- geçerli dal;
- herhangi bir worktree’de checkout edilmiş ya da birinde rebase edilmekte olan bir
  dal;
- varsayılan dal;
- [korumalı dallar](repo-settings.md), [depo yapılandırmasındaki](repo-config.md)
  `release/*` gibi kalıplar dahil.

Uzak depoda hiçbir şey değişmez. Bu yalnızca yerel dalları siler.

## Sınırlar

- **Squash birleştirmeleri, siz kontrol edene kadar git için görünmezdir.**
  **Squash birleştirmelerini kontrol et** olmadan, squash ile birleşmiş bir dal *N
  commit yalnızca burada var* ile **Kaybolmuş** olarak görünür ve işaretlenmez.
- **Squash kontrolü kaçırabilir.** “Bu içerik zaten `main` içinde mi?” sorusunu
  yanıtlar. `main` daha sonra aynı satırları yeniden değiştirdiyse ya da squash
  birleştirilirken düzenlendiyse, birleştirme bir şey değiştirir ve dal işaretsiz
  kalır. İçerik kaybettirecek biçimde asla yanlışlıkla evet demez: içerik tanım gereği
  `main` içindedir. [Çakışma radarı](conflict-radar.md) gibi, `git gc`’nin
  temizlediği gevşek ağaç nesneleri yazar.
- **Fetch edilmemiş bir uzak depo güncel değildir.** “Kaybolmuş” son fetch’ten gelir.
  **Fetch ve prune** olmadan, bir saat önce sunucuda silinmiş bir dal hâlâ canlı
  görünür ve yeni bir birleştirme henüz `origin/main` içinde değildir.
- **Eskimiş yalnızca bir tarihtir.** Üç sessiz ay, çalışmanın güvende olup olmadığı
  hakkında hiçbir şey söylemez; bu yüzden eskimiş satırlar asla işaretlenmez.
- **“Başka bir yer”, son fetch’teki uzak izleme ref’leridir**, şu andaki sunucu
  değil — ve etiketler değil. Yalnızca bir etiketin tuttuğu bir commit benzersiz
  sayılır, başkasının uzak dalında duran bir commit ise sayılmaz.
- Benzersiz commit sayısı 500’de durur ve *500+* gösterir. Onaydaki toplam bir alt
  sınırdır — *en az N* — çünkü üst üste binen dallar commit paylaşır.
- Geri alma dalı ve upstream’ini geri getirir, reflog’unu ya da diğer
  `branch.<name>.*` ayarlarını değil.
- İletişim kutusu uzun bir listenin ilk 400 satırını gösterir; filtre gerisini bulur.
  **Kaybolmuş + birleşmiş olanları seç** gösterilsin gösterilmesin her satıra
  uygulanır.

**Ayrıca bakın:** [Dallar, uzak depolar ve kenar çubuğu](branching.md) · [Fetch, pull ve push](syncing.md) · [Pull request sayfası](pull-requests.md)
