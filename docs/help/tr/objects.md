---
title: Nesne gezgini
category: Depo ve geçmiş
order: 16
summary: Grafiğin altındaki katmanda dolaşın — commit'ler, ağaçlar, blob'lar, etiketler ve onlara işaret eden ref'ler. Burada hiçbir şey bir şeyi değiştirmez.
keywords: nesneler objects nesne gezgini object explorer blob tree ağaç commit tag etiket ref plumbing cat-file ls-tree sha1 iç yapı internals veritabanı rev-parse HEAD^{tree} loose packed
---

# Nesne gezgini

Git'in karmaşık olduğu yönünde bir ünü vardır. Bunun neredeyse tamamı modeli hiç
görmemekten gelir: **dört tür nesne ve işaretçiler**. Bir commit'e tıklayıp
ağacına indiğinizde ve dosyanızın aslında bir ağaç tarafından ad verilmiş bir
blob *olduğunu* gördüğünüzde, üst düzey komutlar sihir olmaktan çıkar.

`⌘K` → **Nesne gezgini**. Bu sayfadaki hiçbir şey tek bir bayt değiştiremez —
arkasındaki her çağrı bir okumadır.

![main’in gösterdiği commit: daldan gelen yol, neyi gösterdiği ve bir commit’in modeldeki yeri](../../screenshots/objects.webp)

## Dört nesne

| Nesne | Nedir | Ne bilir |
|--------|----|-------|
| **blob** | Bir dosyanın *içeriği* | Hiçbir şey. Ne adını, ne yolunu, ne geçmişini |
| **tree** | Bir dizin listesi | Adlar, modlar ve her alt blob ya da ağacın sha'sı |
| **commit** | Tek bir anlık görüntü | Ağacı, ebeveynleri, yazar, commit'leyen, mesaj |
| **tag** | Açıklamalı bir etiket | İşaret ettiği nesne, etiketleyen, bir mesaj |

Çoğu kişi için sürpriz olan ilk satırdır. **Bir blob'un adı yoktur.** Geçmişinizin
herhangi bir yerinde içeriği aynı olan iki dosya, bir kez saklanan aynı blob'dur.
Ad, ona işaret eden ağaçta yaşar — git'in dosyaları değil içeriği izlemesinin ve
yeniden adlandırmaların kaydedilmek yerine tespit edilmesinin sebebi budur.

Bir **ref** — `refs/heads/main`, `refs/tags/v1.0`, `HEAD` — bir sha içeren bir
dosyadan ibarettir. "Dallanma ucuzdur" cümlesinin tamamı budur.

## Dolaşmak

![Commit’ten src/ klasörüne: önce klasörler, her mod açıkça yazılı](../../screenshots/objects-tree.webp)

Sol sütun her ref’i git’in grupladığı gibi listeler: HEAD (bir daldayken
`→ main` ile), Dallar, Etiketler ve Uzaklar; her grubun bir sayısı vardır.
Uzaklar kapalı başlar. Kare işaret bir commit’e giden ref’tir, yuvarlak yeşil
olan **açıklamalı** bir etiket. Filtre tüm grupları aynı anda daraltır. Bir
ref’e tıklayınca adlandırdığı nesneye gidersiniz; oradan yürüdüğünüz sürece o
satır vurgulu kalır.

Oradan itibaren her şey bir kapıdır:

- Bir **commit** neyi **gösterdiğini** gösterir — kök ağacını, kaç öğe tuttuğuyla,
  ve her üst commit’i konusuyla — sonra yazar ve commit’leyeni (*yazarla aynı*,
  eşleştiklerinde) ve mesajı.
- Bir **ağaç** ad, mod, nesne ve boyut tablosudur, önce klasörler. Her mod
  yazıyla belirtilir: *dosya*, *çalıştırılabilir*, *klasör*, *sembolik bağ*,
  *alt modül*. Bir klasör kaç öğe tuttuğunu, bir sembolik bağ nereyi gösterdiğini söyler.
- Bir **blob** metnini satır numaralarıyla gösterir (büyükse yalnızca başını) ya
  da ikili olduğunu açıkça söyler. Bir ağaç üzerinden gelindiğinde bir şerit
  orada ne ad taşıdığını söyler — *07c6f3d commit’inde src/app.ts adıyla, mod
  100644 (normal dosya)* — ve dosyanın geçmişine bir bağlantı verir.
- **Açıklamalı bir etiket** adlandırdığı nesneyi gösterir ve etiketleyeni kaydeder.

![Bir blob, ağacının ona verdiği ad ve modeldeki yeri](../../screenshots/objects-blob.webp)

### Yol

Revizyon kutusunun altındaki şerit, yürüdüğünüz **yol**dur:
`dal main → commit 07c6f3d → kök → src/ → app.ts`. Bir commit’in ağacı **kök**tür;
bir dosya ya da klasör tıkladığınız satırın adını alır. Geri dönmek için
herhangi bir öğeye tıklayın. Bir revizyon yazmak, bir ref ya da **Aç**
düğmesinin yanındaki örneklerden birini seçmek yeni bir yol başlatır.

**Geri** ve **İleri**, açtığınız her şeyde bir tarayıcıdaki gibi gezinir: geri
gittikten sonra İleri sizi geri getirir, ta ki oradan yeni bir şey açana dek.
Revizyon kutusu yürüyüşü izler; `main:src/app.ts` her zaman kopyalanmaya hazırdır.

### Renkler

Her tür göründüğü her yerde tek bir renk taşır — rozet, yol öğesi, kart, satır:
commit temanın vurgu renginde, ağaç onun sarısında, blob mavide, etiket ve ref
yeşilde. Nesnenin başlığının altında tek bir cümle o türün ne *olduğunu* söyler.

### Modelde neredesiniz

Bölmenin altındaki şerit git’in zinciridir — **ref → commit → tree → blob**,
açıklamalı etikette ref ile commit arasında **tag** ile — ve ekrandaki tür
*buradasınız* olarak yanar.

## Bir revizyon yazmak

Kutu, `git rev-parse` kabul eden her şeyi alır; işte bu, onu bir gezgin olmaktan
çıkarıp öğrenme aracına dönüştüren yerdir:

| Şunu yazın | Şunu alın |
|-----------|--------|
| `HEAD` | Geçerli commit |
| `HEAD~3` | Üç commit geri |
| `HEAD^{tree}` | O commit'in ağacı, soyulmuş hâlde |
| `HEAD:src/app.ts` | O yola ait blob, doğrudan |
| `v1.0^{}` | Etiket nesnesi yerine açıklamalı bir etiketin işaret ettiği şey |
| `a1b2c3d` | Sha ile herhangi bir nesne — kısaltmalar çalışır |

Bir ağaç listesindeki mod rakamlarını bilmek işe yarar: `100644` bir dosya,
`100755` çalıştırılabilir, `040000` bir alt ağaç, `120000` bir sembolik bağ,
`160000` bir alt modül gitlink'i — ki bu sonuncusu, bir alt modülün sakladığı
şeyin tamamıdır.

## Bilmeye değer sınırlar

- **Bilerek salt okunur.** Burada yazacak bir şey yok. Elle nesne üretmek bir
  `git hash-object` alıştırmasıdır ve yeri terminaldir.
- **Büyük blob'lar** ilk 200 KB'den sonra kesilir — ne olduğunu görmeye yetecek
  kadar, pencereyi kilitlemeyecek kadar.
- **Boyutlar, `git cat-file -s` bildirdiği hâliyle nesnenin içerik boyutudur**;
  paketlendikten sonra diskte tuttuğu yer değil. Onun için
  [bakım](maintenance.md) sayfasına bakın.
- **Erişilemeyen nesneler de nesnedir.** Bir `git fsck` sarkan nesne raporundan
  bir sha yapıştırın, açılır; kaybolan bir commit'in ne içerdiğini kurtarmaya
  karar vermeden önce görmenin en hızlı yolu genellikle budur.
- **Bir alt modül satırı açılmaz.** Gitlink’i başka bir deponun commit’ini
  adlandırır; bu depoda o yoktur.
- **Sayıların ve bağ hedeflerinin bir tavanı vardır.** 300’den fazla alt klasörü
  olan bir ağaç bunları sayısız listeler ve yalnızca ilk 50 sembolik bağ hedefini gösterir.
- **Yol iletişim kutusuyla biter.** Kapatın; sonraki HEAD’in dalından yeniden başlar.

Ayrıca bakınız: [Grafik](graph.md) · [Depo bakımı](maintenance.md) ·
[Kurtarma](recovery.md)
