---
title: Herhangi bir commit'i düzenleyin
category: Dallanma ve cerrahi
order: 46
summary: Geçmiş bir commit'in dosyalarını veya mesajını yerinde yeniden yazın — zincirleme etki önce önizlenir.
keywords: commit düzenleme geçmişi yeniden yazma eski commit mesaj düzeltme yazım hatası zincirleme yeniden oynatma yerinde rebase cerrahi edit commit rewrite history amend past reword fix typo cascade replay rebase in place surgery
source: 2860ac7978e6b9b1b8a469abadf313971d0140c6
---

# Herhangi bir commit'i düzenleyin

Yazım hatası üç hafta önceki bir commit'te. Alışıldık çözüm etkileşimli bir
rebase'tir: commit'te dur, düzenle, devam et, dua et. GitHuttBr'nun çözümü ise
şu: commit'e sağ tıklayın, **Bu commit'i düzenle**, metni değiştirin, bitti.
Commit ayrıntıları panelindeki kalem düğmesi de aynı düzenleyiciyi açar.

![Geçmiş bir commit'i düzenleme](../../screenshots/commit-edit.webp)

## Ne yapar

`HEAD`'in atası olan herhangi bir commit'i seçin — geçmiş doğrusal olsun ya da
olmasın. Düzenleyici dosyalarını ve mesajını gösterir; ikisinden birini
düzenleyin.

Mesaj, [commit düzenleyicisindeki](committing.md) araçların aynısına sahiptir:
uzunluk sayacıyla özet ve altında açıklama, okun arkasındaki stil satırı
(Conventional türü ve kapsamı, bilet anahtarı, commit stili), gitmoji seçici,
ortak yazarlar ve linter ipuçları. Commit mesajı yüklenirken bölünür — ilk satır
özet, geri kalanı açıklama olur — ve yeniden yazarken tek bir boş satırla tekrar
birleştirilir. Eski bir `add retry` mesajını `fix: add retry` yapmak, tür
listesinden tek bir seçimdir.

Bir dosyayı düzenlemek onu okumak demektir; bu yüzden düzenleyici bir iletişim
kutusuna sıkıştırılmaz: commit grafiğinin yerine, orta bölmede açılır — çakışma
çözücünün ve dosya görüntüleyicinin açıldığı yerde — ve pencerenin tüm
genişliğini ve yüksekliğini kullanır. **Esc** ya da başlığındaki **×** onu
kapatır. Başka bir depo sekmesine geçip geri döndüğünüzde düzenlemeleriniz
kaybolmaz; kaydedilmemiş düzenlemelerle kapatmak ise önce onay ister.

Oradan itibaren iki şey olur:

1. **Zincirleme önizleme**, düzenlenen commit'in üzerindeki her commit'i
   *bellekte* yeniden oynatır (`merge-tree` cherry-pick'lerinden oluşan bir
   zincir — checkout yok, çalışma ağacı yok, ref yok). Her ardıl yeşil ya da
   kırmızı görünür; böylece düzenlemenin temiz yayılıp yayılmadığını veya
   sonraki bir değişiklikle çarpışıp çarpışmadığını **daha hiçbir şey
   kımıldamadan** bilirsiniz.
2. **Geçmişi yeniden yaz** bunu gerçekten yapar: aynı zincir plumbing
   komutlarıyla kurulur, ardından dal `reset --keep` ile taşınır —
   commit'lenmemiş değişiklikleriniz beraberinde taşınır ya da reset iptal
   edilir ve hiçbir şey olmamış olur. Önce bir
   [koruma anlık görüntüsü](recovery.md) alınır ve geri al eski zinciri geri
   getirir.

Yeniden oynatılan her commit'in yazarı ve tarihleri korunur; yalnızca
hash'ler değişir — geçmişi yeniden yazmak zaten budur.

## Aralıktaki merge'ler

![İki merge’in altındaki bir commit’i düzenleme — zincir onları yeniden oynatır](../../screenshots/commit-edit-merges.webp)

Commit ile `HEAD` arasında bir merge olması artık düzenlemeyi devre dışı
bırakmaz. Zincir, bir merge'i **kaydedilmiş sonucunu** — merge'in gerçekten
commit'lediği ağacı, çakışma çözümleri dahil — yeniden yazılmış ebeveynin
üzerine uygulayarak yeniden oynatır; böylece birinin elle yaptığı çözümler
yeniden yazmayı harfi harfine atlatır. rerere yok, yeniden merge yok, çalışma
ağacı yok: zincirin geri kalanıyla aynı bellek içi plumbing komutları, üstelik
her iki ebeveyn işaretçisi de korunur. Düzenlenen commit'i kendisi de içeren
bir yan dal yeniden yazılır ve yeniden yönlendirilir; içermeyen dalın
kimliğine ise hiç dokunulmaz. Düzenleyicideki şerit aralığın kaç merge taşıdığını
söyler ve merge adımları önizlemede bir merge simgesi gösterir.

Dürüst uyarı: yeniden oynatılan bir merge ancak kaydedilmiş sonucu kadar
iyidir. Düzenlemeniz merge'in kendisinin çözdüğü satırlarla çarpışırsa,
önizleme diğer her çakışan adım gibi kırmızıya döner — hiçbir şey tahmin
edilmez.

## Zincir çakıştığında

Sonraki bir commit, düzenlediğiniz satırlara dokunmuş. Önizleme o commit'i
çakışan dosyalarla birlikte kırmızıyla işaretler ve yeniden yazma çalışmayı
reddeder — hiçbir şey asla yarım uygulanmaz. Ya farklı düzenleyin ya da
çakışmayı [etkileşimli rebase](rebase.md) ile göğüsleyin.

## Sınırlar

- **Commit, `HEAD`'in atası olmalıdır.** Merge edilmemiş bir yan daldaki
  commit'in, yeniden oynatılabileceği şu anki dalınıza giden bir yolu yoktur.
- İkili dosyalar ve 2 MB'ın üzerindeki dosyalar gösterilir ama düzenlenemez.
- Zaten bir uzak depoda olan bir commit düzenlenebilir, ancak bir sonraki
  push'unuz bir **force push** olmak zorundadır — düzenleyici buna karar vermeden
  önce sizi uyarır.
- Commit'te silinmiş dosyalar düzenlenemez (düzenlenecek içerik yoktur).

**Ayrıca bkz.:** [Etkileşimli rebase](rebase.md) · [Kurtarma ve reflog](recovery.md) · [Absorb](absorb.md)
