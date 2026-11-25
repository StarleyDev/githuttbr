---
title: Güvenlik ve sırlar
category: Güvenlik
order: 70
summary: Maskeleme, korumalar, anahtar zinciri — ve Gitcito'nun yapmayı reddettikleri.
keywords: güvenlik sırlar maskeleme anahtar zinciri token korumalı dal büyük dosya gizlilik security secrets masking keychain safeStorage protected branch large file guard privacy
---

# Güvenlik ve sırlar

Gitcito'nun **arka ucu yoktur**. Tek ağ çağrıları Git sunucunuza ve, açarsanız,
yapay zekâ sağlayıcınıza gider.

![Güvenlik ayarları](../../screenshots/settings-security.webp)

## Sır maskeleme

`.env*`, `*.pem`, `*.key`, `id_rsa`, `credentials.*` ve benzerlerindeki
değerler diff, dosya ve blame görünümlerinde `KEY=••••••` olarak çizilir; böylece
bir ekran paylaşımı ya da ekran görüntüsü onları sızdıramaz.
Apple imzalama malzemesi de sayılır: `*.mobileprovision`,
`*.provisionprofile`, `*.p12` ve App Store Connect'in `*.p8` anahtarları. Bir
`*.cer` sayılmaz — sertifika tasarımı gereği geneldir.

Bu yalnızca **görüntüyle ilgilidir**: dosyayı asla değiştirmez, neyi
hazırladığınızı da asla değiştirmez. Bir göz düğmesi onları görünüm başına
açığa çıkarır. `.env.example`, `.sample` ve `.template` sır değil, şablon olarak
kabul edilir.

![Her değeri maskelenmiş bir .env ve açığa çıkarma düğmesi](../../screenshots/secret-masking.webp)

## Zarar vermeden önceki korumalar

| Koruma | Ne zaman |
|---|---|
| **Sır dosyası** | Kimlik bilgisine benzeyen bir şeyi commit'lerken — tek tıklamalık *Yoksay ve izlemeyi bırak* ile |
| **Büyük dosya** | Aşırı büyük bir blob'u commit'lerken (eşik: Ayarlar → Güvenlik) |
| **Derleme çöpü** | `xcuserdata/`, `DerivedData/` ya da bir `.DS_Store` işlemek — aynı tek tıklık *Yoksay ve izlemeyi bırak* ile |
| **Korumalı dal** | Doğrudan `main`/`master`'a commit'lerken ya da birini force push ederken |
| **İzlenen sırlar** | Bir sır dosyasını *izleyen* bir depoyu push ederken — oturum başına bir kez uyarılır |

## İşletim sistemi anahtar zinciri

Token'lar ve [kasa](vault.md) kayıtları, ayarlar dosyasındaki bir anahtarla
değil, işletim sisteminizin anahtar zinciriyle (Electron `safeStorage`)
şifrelenir.

**Siz söyleyene kadar anahtar zincirine hiçbir şey dokunmaz.** Sistemin kendi
izin penceresi belirmeden önce Gitcito neyin saklandığını, neyi
yapamayacağını (bir uygulama yalnızca kendi oluşturduğu kaydı geri okur —
diğer parolalarınıza erişilemez) ve hayır demenin sorun olmadığını anlatır:
o zaman token'lar yalnızca oturum boyunca bellekte yaşar, kasa kapalı kalır ve
istediğinizde **Ayarlar → Güvenlik → İşletim sistemi anahtar zinciri**
üzerinden açabilirsiniz.

Yeni bir kurulum, gerçekten saklanması gereken bir şey çıkana kadar **sıfır**
anahtar zinciri çağrısı yapar.

Kapalıyken Entegrasyonlar’daki token alanı bunu belirtir — *Yalnızca Gitcito’yu kapatana kadar saklanır: işletim sistemi anahtarlığı kapalı.* — yanında bir **Etkinleştir** düğmesiyle. Oradan ya da buradan açmak, bu oturumda girdiğiniz token’ları da kaydeder; yeniden yapıştırmanız gerekmez.

### Anahtarlık olmadan Linux

Linux'ta anahtar zinciri bir gizli bilgi hizmetidir — GNOME Keyring ya da
KWallet. Hiçbiri çalışmıyorsa sistem yine "şifreler", ama her makinede aynı olan
sabit bir parolayla: token'lar ve anahtarlar korunmaz, yalnızca karıştırılır.
Ayarlar → Güvenlik bunu anahtar zinciri durumunun altında söyler — *Çalışan bir
anahtarlık yok…* — böylece *anahtar zinciri* sözcüğü hiçbir zaman var olmayan
bir korumayı temsil etmez.

Herkesin çözebileceği bir depolamaya yeni hiçbir şey düşmesin diye, çalışan bir
anahtarlık yokken yazdığınız bir token **yalnızca uygulamayı kapatana kadar**
tutulur. Token alanı bunu söyler — *Yalnızca Gitcito'yu kapatana kadar saklanır:
çalışan bir anahtarlık yok…* — yeniden deneme düğmesi olmadan, çünkü yeniden
denemek işe yaramaz; yalnızca bir anahtarlık yarar. Daha önce kaydedilmiş
token'lar okunabilir kalır — onlara erişiminizi hiç kaybetmezsiniz — ve birini
temizlemek ya da değiştirmek eski değeri yine diskten siler. İki sınır: genel
yapay zekânın anahtarı ortak yerine taşınmaz (her profil kendi anahtarını
okumaya devam eder) ve kasa, oturumluk bir modu olmadığı için temel depolamaya
kaydetmeyi sürdürür. Yeni token'ları yeniden kalıcı olarak saklamak için bir
anahtarlık kurun ya da kilidini açın ve Gitcito'yu yeniden başlatın.

## Ayarları içe aktarma

**Ayarlar → İçe / Dışa aktar**, ayarları, profilleri ve temaları makineler
arasında taşır. Varsayılan dışa aktarım **hiçbir token ya da API anahtarı
içermez** ve böyle bir dosyayı içe aktarmak kaydettiklerinize asla dokunmaz —
dosyadaki boş bir token "bu dosyada yok" demektir, "benimkini sil" değil.

### Neyin içe aktarılacağını seçmek

Bir ayar dosyası iki tür şey taşır: *sizi* izleyenler (profiller, tema,
kısayollar) ve yalnızca onu yazan makinede anlamlı olanlar (depolarınızın
bulunduğu klasörler, terminalinizin yolu). Hepsini yeni bir bilgisayarda
uygulamak kenar çubuğunu hiçbir yeri göstermeyen sekmelerle doldurur. Bu yüzden
dosyayı seçtikten (ve varsa parolasını yazdıktan) sonra bir pencere hangi
bölümlerin getirileceğini sorar. Siz **İçe aktar**'a basana kadar hiçbir şey
uygulanmaz; **Vazgeç** her şeyi olduğu gibi bırakır.

![Ayarlar → Veri → İçe aktar: dört bölüm, klasörlerinin hiçbiri burada olmadığı için işaretsiz depolar ve açık yol çevirisi](../../screenshots/settings-import.webp)

| Bölüm | Ne taşır |
|------|-----------------|
| **Profiller ve hesaplar** | Profiller, Git kimliği, entegrasyon bağlantıları, genel yapay zekâ ayarları ve profil resimleri — dosyada varsa kimlik bilgileri ve [kasa](vault.md) da |
| **Uygulama tercihleri** | Tema, dil, kısayollar, yerleşim, grafik ve simge renkleri |
| **Depolar ve çalışma alanları** | Sekmeler, çalışma alanları, sık kullanılanlar, takma adlar, sekme resimleri, her deponun hangi profili kullandığı, taranan klasörler ve depo başına notlar ve vikiler |
| **Bu bilgisayardaki programlar** | Terminal, harici düzenleyici, varsayılan uygulamalar ve yapay zekâ CLI'lerinin yolu |

Her bölüm, dosyada kendisi için kaç kayıt olduğunu gösterir. İşaretsiz
bıraktığınız bir bölüm bu makinede tam olduğu gibi kalır.

**Profiller sizinkilerle birleşir.** Başka bir bilgisayardan gelen bir dosyada
bu bilgisayardaki her profil nadiren bulunur — Linux dizüstünde eklenmiş bir
hesap, yalnızca Mac'te olan bir müşteri profili. Bu yüzden **Profiller ve
hesaplar** listeyi değiştirmek yerine dosyadaki profilleri sizinkilere ekler.
İçe aktarmadan önce bölüm her profili ve ona ne olacağını listeler:

| Etiket | Anlamı |
|-----|---------|
| **Güncellenir** | Profil iki tarafta da var: dosyadaki kimlik, yapay zekâ ve resim sizinkilerin yerini alır, sunucuları da sizinkilere eklenir |
| **Yeni** | Yalnızca dosyada var: sizinkilerden sonra eklenir |
| **Kalır** | Yalnızca bu bilgisayarda var: tam olduğu gibi kalır |

İki profil bir kimliği (id) paylaştığında "aynı"dır — her kurulumun ilk profili
paylaşır. Hiçbir id eşleşmediğinde ad eşleşir (büyük/küçük harf ve çevresindeki
boşluklar yok sayılarak) ve profil **bu bilgisayarın id'sini** korur: ona bağlı
depolar, etkin profil, kayıtlı kimlik bilgileri ve resmi bağlı kalır. Hangi
profilin etkin olduğu değişmez.

**Tümünü değiştir** hâlâ orada; tam olduğu gibi geri istediğiniz bir yedek
için: yalnızca dosyadaki profiller kalır, yalnızca bu bilgisayarda olanlar
üstü çizili olarak **Kaldırıldı** diye listelenir. **İçe aktar**'a basınca bir
kez daha, onları adlarıyla sayarak sorulur — kayıtlı kimlik bilgileri ve
resimleriyle birlikte giderler ve bu geri alınamaz. **Tümünü değiştir** ile
dosyanın etkin profili etkin profil olur.

Sınırlar: eşleştirme yalnızca id ya da tam ad ile yapılır — bir tarafta yeniden
adlandırılmış bir profil yeni sayılır ve sonunda ikisi de olur. Eşleşen bir
profil dosyanın alanlarını alır; yalnızca bu bilgisayarda olan hiçbir şey
kaybolmasın diye üç istisnayla: GitHub Enterprise, GitLab ve Bitbucket
sunucuları sizinkilere **eklenir** (iki tarafta da olan bir sunucuda dosyadaki
kayıt kazanır); dosyanın boş getirdiği bir token sizinkini korur — ama yalnızca
aynı örnek için, böylece bir token asla başka bir Forgejo'ya, başka bir GitLab
yayımcısına ya da başka bir Azure kuruluşuna gönderilmez; ve bu makinenin
credential helper'ından ödünç alınan oturum açma bilgileri bu makinenin olarak
kalır.

**Varsayılanlar diskinize dayanan bir tahmindir.** Pencere görünmeden önce
Gitcito dosyadaki depo klasörlerinin burada olup olmadığına bakar. Hiçbiri
yoksa dosya başka bir bilgisayardan gelmiştir: **Depolar** ve **Programlar**
işaretsiz başlar, her biri nedeniyle birlikte — programların yolları listelenir,
böylece başka bir yere ait olduklarını görürsünüz. Varsa aynı bilgisayardır
(örneğin geri yüklenmiş bir yedek), her şey işaretli başlar ve yeşil bir not
bunu söyler. Hiç deposu olmayan bir dosya bunun yerine program yollarına göre
değerlendirilir: **Programlar** yalnızca yolların hepsi burada varsa işaretli
başlar.

Denetimin kendisi başarısız olursa hiçbir şey tahmin edilmez: **Depolar** ve
**Programlar** hükümsüz ve işaretsiz başlar, bir **Yeniden denetle** düğmesi
diske bir kez daha sorar ve bir denetim başarılı olana kadar **Depolar** içe
aktarılamaz. Diğer bölümler aktarılabilir.

**Yolları çevirmek.** Klasörleri eksik olan bir dosyada **Depolar**'ı
işaretleyin; bir **Yolları çevir** kutusu açılır. Solda, dosyadaki depoların
ortak klasörü (`/home/you/code`); sağda, o klasörün bu bilgisayarda nerede
olduğu, ev klasörünüzden önceden doldurulmuş olarak (`/Users/you/code`). İkisi
de düzenlenebilir — tahmin yanlış olabilir ve Gitcito ortak bir klasör
bulamazsa ikisini de sizin yazmanız için boş bırakır. Bir çubuk, siz yazarken
kaç deponun artık burada bir klasörü olduğunu sayar ve birkaçını listeler —
bulunanlar yeşil, hâlâ eksik olanlar kırmızı. Değişim deponun takma adını,
sekme resmini ve profilini, notlarını, vikilerini ve kasa kayıtlarını da
beraberinde götürür; böylece hiçbir şeyi elle yeniden ayarlamanız gerekmez.

Alt bilgi özetler — *4 bölümden 3 tanesini içe aktar · 31 klasör* (tarama kökleri ve
son klonlama klasörü de sayılır, bu yüzden depo değil klasör der) — ve en az
bir bölüm işaretlenene kadar **İçe aktar** kapalı kalır.

**Bir çeviri hiçbir şey bulamadığında da İçe aktar kapalı kalır.** **Depolar**
işaretliyken yeni önekin altında tek bir klasör bile bulunmazsa içe aktarmak
depolarınızı boş bırakırdı; yolları düzeltin ya da bölümün işaretini kaldırın.

Çevirinin sınırları:

- Bu **bir önekin başka bir önekle değiştirilmesidir**. Dosyada farklı bir
  klasörün altında olan ya da burada farklı düzenlenmiş depolar bulunmaz; depo
  başına eşleme yoktur.
- Bir çeviri etkinken **yalnızca o durumda klasörü olan depolar içe aktarılır**.
  Geri kalanlar dışarıda bırakılır — bozuk sekmeler olarak eklenmez — ve pencere
  size kaç tane olduğunu söyler.
- Programlar asla çevrilmez: `/usr/bin/code`'un başka bir sistemde güvenilir
  bir karşılığı yoktur. O bölümü işaretsiz bırakın ve programları Ayarlar'da
  seçin.
- Öneklerden birini temizlemek yolları dosyada oldukları gibi içe aktarır.

**İçe aktarma sürerken** pencere kapatılamaz. Sonraki bir adım başarısız olursa
— depo notları, kasa, profil resimleri — pencere açık kalır, adımı söyler ve
**İçe aktarmayı sürdür** önceki adımları yeniden yazmadan oradan devam eder.

### Dosyadaki kimlik bilgileri

Seçenek işaretlenerek dışa aktarılmış bir dosya kimlik bilgileri taşır.
Profilleri birleştirmek onları her zaman **ekler**: dosyadakiler eşleşen profilin
altına kaydedilir, aynı hesabınkilerin yerini alır ve kayıtlı diğer tüm kimlik
bilgileri kalır — onları silmek profillerinizi korumakla çelişirdi. Profiller
**Tümünü değiştir** konumundayken böyle bir dosya ayrıca seçimi de gösterir,
hemen **Profiller ve hesaplar**'ın altında:

| Seçim | Kayıtlı kimlik bilgileriniz |
|--------|------------------------|
| **Benimkilere ekle** | Dosyadakiler eklenir, aynı hesabınkilerin yerini alır; diğerlerinin hepsi korunur |
| **Tümünü değiştir** | Tam olarak dosyadakiler olur — dosyada olmayan her kayıtlı token ve API anahtarı silinir |

Seçim profillerle birlikte uygulanır: **Profiller ve hesaplar** işaretsizken
hiçbir kimlik bilgisi içe aktarılmaz ya da kaldırılmaz. Seçenek olmadan dışa
aktarılmış bir dosyanın, neyi işaretlerseniz işaretleyin, sunacak hiçbir şeyi
yoktur. **Tümünü değiştir**, **İçe aktar**'a bastığınızda bir kez daha sorar ve
dosyada olmayan her kayıtlı token ve API anahtarının silineceğini söyler; orada
**Vazgeç** pencereyi olduğu gibi bırakır.

**Tümünü değiştir anahtar zincirine ihtiyaç duyar.** Anahtar zinciri kapalıyken
ya da kullanılamazken eski token'lar şifreli depoda kalır ve bir sonraki
açılışta geri gelirdi; bu yüzden Gitcito reddeder: bunu söyler ve hiçbir şey içe
aktarılmaz. Kayıtlı token'lar okunamadığı sürece de aynısı geçerlidir: okunabilir
olur olmaz geri gelirlerdi. **Benimkilere ekle** yine çalışır ve dosyadaki
token'ları oturum boyunca tutar.

**Sınır:** kimlik bilgileri bir profile aittir. İçe aktarmanın kaldırdığı bir
profil, ne seçerseniz seçin, kayıtlı token'larını da beraberinde götürür.

## Güvenle paylaşmak

[Güvenli paylaşım](secure-share.md) ayarları, kasa kayıtlarını veya bütün
çalışma alanlarını **şifreli bir paket** olarak dışa aktarır — sırlar yalnızca
siz kutuyu işaretlediğinizde dâhil edilir.

**Ayrıca bakınız:** [Kasa](vault.md) · [Güvenli paylaşım](secure-share.md)
