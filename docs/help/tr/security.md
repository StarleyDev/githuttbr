---
title: Güvenlik ve sırlar
category: Güvenlik
order: 70
summary: Maskeleme, korumalar, anahtar zinciri — ve GitHuttBr'nun yapmayı reddettikleri.
keywords: güvenlik sırlar maskeleme anahtar zinciri token korumalı dal büyük dosya gizlilik security secrets masking keychain safeStorage protected branch large file guard privacy okunamayan yedek bölümler yolları çevir başka bilgisayar yeni makine profilleri birleştir profilleri değiştir ne dışa aktarılacağını seç tam yedek ekip için manifest parola şifreleme appimage apparmor sandbox sorun bildir yorumlardaki görseller izleme pikseli ip adresi üçüncü taraf görseller yüklemek için tıkla images in comments tracking pixel third-party images click to load
source: 26f333bbdafd9ab662dc635c22df7456d66b1362
---

# Güvenlik ve sırlar

GitHuttBr'nun **arka ucu yoktur**. Tek ağ çağrıları Git sunucunuza ve, açarsanız,
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
| **Sır dosyası** | Kimlik bilgisine benzeyen bir şeyi commit'lerken — tek tıklamalık *Yok say ve takibi bırak* ile |
| **Büyük dosya** | Aşırı büyük bir blob'u commit'lerken (eşik: Ayarlar → Güvenlik) |
| **Derleme çöpü** | `xcuserdata/`, `DerivedData/` ya da bir `.DS_Store` işlemek — aynı tek tıklık *Yok say ve takibi bırak* ile |
| **Korumalı dal** | Doğrudan `main`/`master`'a commit'lerken ya da birini force push ederken |
| **İzlenen sırlar** | Bir sır dosyasını *izleyen* bir depoyu push ederken — oturum başına bir kez uyarılır |

## Yorumlardaki görseller

Pull request ve issue yorumlarını başkaları yazar ve bunlardan birindeki bir görsel,
bilgisayarınızın yazarın seçtiği siteye yaptığı bir istektir. O site IP adresinizi ve
yorumu ne zaman okuduğunuzu öğrenir — bir izleme pikselinin yorum yapma hakkından
fazlasına ihtiyacı yoktur.

Bu yüzden uygulama kendiliğinden yalnızca sunucunun kendisinden gelen görselleri
yükler: github.com’da ekleri, `*.githubusercontent.com` (GitHub’ın kendi işlemesinde
her dış görselin önüne koyduğu proxy dahil) ve varlıkları; başka herhangi bir
sunucuda, https üzerinden, kendi web adresi. Diğer her görsel alan adını belirten bir
yer tutucu gösterir ve yalnızca ona tıkladığınızda istenir — yalnızca o görsel, bir
kez. İstek asla bir `Referer` göndermez.

| Ayar | Ne yapar |
|---|---|
| **Yorumlarda diğer sitelerden görselleri yükle** (varsayılan olarak kapalı) | Her siteden görseller, sunucunun web sitesindeki gibi tıklamadan yüklenir |

Sınırlar:

- **Sunucu sizi yine de görür.** Sunucunun kendisinden bir görsel — ve GitHub’da
  proxy’si üzerinden geçen her görsel — sunucuya yapılan bir istektir ve sunucu bu
  hesabın pull request’i okuduğunu zaten bilir.
- **`raw.githubusercontent.com` ve `gist.githubusercontent.com` tıklamadan
  yüklenir.** Oraya herkes bir dosya koyabilir, yani görsel onlarındır — ama onu
  GitHub sunar ve yazarı IP adresinizi ya da ne zaman okuduğunuzu görmez.
- **Özel GitHub ekleri süresi dolar.** İmzalı adresleri birkaç dakika geçerlidir;
  sayfadaki **Yenile**, yüklenmeyi bırakmış birini geri getirir.
- Bu sayfalardaki **bir yorum kutusunun önizlemesi** aynı kurala uyar: dışarıdaki bir
  görsele yapıştırılmış bir bağlantı siz yazarken yüklenmez.
- **Yalnızca pull request ve issue sayfaları.** Deponun bir Markdown dosyasındaki, bir
  sürüm notundaki ya da wiki’deki görseller deponuzun kendi içeriğidir ve eskisi gibi
  yüklenir.
- **Bağlantı bir görsel değildir.** Bir yorumdaki bağlantıya tıklamak, uygulamadaki her
  bağlantı gibi onu tarayıcınızda açar.

Bir yorum pencereyi kilitleyemez ya da çökertemez de: 32.000 karakteri aşan ya da
Markdown işleyicisini saniyelerce çalıştıracak biçimde kurulmuş bir yorum düz metin
olarak gösterilir. Bir yorumun geri kalanının nasıl kısıtlandığı
[Pull request’ler](pull-requests.md#yorumlar-nasıl-gösterilir) sayfasındadır.

## AppImage ve ondan uzun yaşayan yollar

Bir AppImage, `/tmp` altındaki bir klasörden (`/tmp/.mount_…`) çalışır; bu klasör
yalnızca uygulama açıkken vardır, her açılışta adı değişir ve her yerel
kullanıcının yazabildiği bir dizinde durur. 4.37.1'e kadar AppImage, bu klasörün
içindeki bir yolu ondan uzun yaşayan iki yere yazabiliyordu: `PATH` içindeki
`githuttbr` bağlantısı ([CLI](cli.md)) ve bir deponun `diff.<name>.textconv`
ayarı ([öznitelikler](attributes.md)). Uygulama kapandıktan sonra aynı
makinedeki başka bir kullanıcı klasörü kendi programıyla yeniden oluşturabilir,
bir sonraki `githuttbr` ya da `git diff` komutunuz da onu çalıştırırdı.

GitHuttBr artık AppImage altında ikisini de reddeder, açılışta eskimiş bir
`githuttbr` bağlantısı için uyarır (onu kaldıran bir palet komutuyla) ve
Öznitelikler penceresinde eskimiş bir dönüştürücüyü bir **Kaldır** düğmesiyle
işaretler. Yalnızca açık olan depoyu görebilir; başka yerlerdeki eskimiş
dönüştürücüleri bulmak için her depoda (ve `--global` ile)
`git config --get-regexp 'diff\..*\.textconv'` çalıştırın ve `/tmp/.mount_`
altındaki her kaydı kaldırın. Tek kullanıcılı bir makine risk altında değildir,
ama eskimiş kayıtlar yine de ölü yüktür.

## İşletim sistemi anahtar zinciri

Token'lar ve [kasa](vault.md) kayıtları, ayarlar dosyasındaki bir anahtarla
değil, işletim sisteminizin anahtar zinciriyle (Electron `safeStorage`)
şifrelenir.

**Siz söyleyene kadar anahtar zincirine hiçbir şey dokunmaz.** Sistemin kendi
izin penceresi belirmeden önce GitHuttBr neyin saklandığını, neyi
yapamayacağını (bir uygulama yalnızca kendi oluşturduğu kaydı geri okur —
diğer parolalarınıza erişilemez) ve hayır demenin sorun olmadığını anlatır:
o zaman token'lar yalnızca oturum boyunca bellekte yaşar, kasa kapalı kalır ve
istediğinizde **Ayarlar → Güvenlik → İşletim sistemi anahtar zinciri**
üzerinden açabilirsiniz.

Yeni bir kurulum, gerçekten saklanması gereken bir şey çıkana kadar **sıfır**
anahtar zinciri çağrısı yapar.

**macOS'ta 4.59'a güncelledikten sonra** sistem *GitHuttBr Safe Storage* öğesi
için bir kez daha sorabilir: uygulamanın bundle id'si `com.huttbr.git` oldu ve
anahtar zinciri tanımadığı bir uygulama için yeniden sorar. **Her Zaman İzin
Ver** token'ları korur; bkz. [güncelleme](upgrading.md).

Kapalıyken Entegrasyonlar’daki token alanı bunu belirtir — *Yalnızca GitHuttBr’yu kapatana kadar saklanır: işletim sistemi anahtarlığı kapalı.* — yanında bir **Etkinleştir** düğmesiyle. Oradan ya da buradan açmak, bu oturumda girdiğiniz token’ları da kaydeder; yeniden yapıştırmanız gerekmez.

![Anahtarlık kapalıyken Entegrasyonlar’daki token alanı: yalnızca kapatana kadar saklanır, bir Etkinleştir düğmesiyle](../../screenshots/token-keychain-notice.webp)

Anahtarlık kapalıyken **kaldırdığınız** bir token hemen gider — artık hiçbir
şeyle gönderilmez — ama yalnızca **bu oturum için**: anahtarlık kapalıyken
şifreli depoya yazılamaz ve silme işlemi bellekte tutulur, asla bir dosyada
değil. Çıkmadan önce anahtarlığı yeniden açın, kayıtlı kopya o zaman silinir;
önce çıkarsanız eski token bir sonraki açılışta geri gelir. O zamana kadar uyarı
bu nedenle görünür kalır. Kayıtlı bir token'ı tek adımda kalıcı olarak silmek
için anahtarlık açıkken onu temizleyin.

Boş bir alan yalnızca GitHuttBr'nun size gösterdiğini temizler. Anahtarlık en
baştan kapalıysa kayıtlı token'lar hiç çözülmez ve hiç gösterilmez — alanlar
boştur —, bu yüzden yalnızca oraya yazıp yeniden temizlediğiniz token silinir;
altındaki kayıtlı token, anahtarlık açıldığında hâlâ oradadır.

Anahtarlık açıklaması ekrandayken pencere yeniden yüklenir ya da çökerse, soru
yanıtlanmamış sayılır — hayır değil — ve bir dahaki sefere bir token'ın
kaydedilmesi gerektiğinde yeniden sorulur. Artık kimsenin yanıtlayamayacağı bir
soruyu hiçbir şey beklemez: ayarlar yeniden normal şekilde yüklenir.

### Anahtarlık olmadan Linux

Linux'ta anahtar zinciri bir gizli bilgi hizmetidir — GNOME Keyring ya da
KWallet. Hiçbiri çalışmıyorsa sistem yine "şifreler", ama her makinede aynı olan
sabit bir parolayla: token'lar ve anahtarlar korunmaz, yalnızca karıştırılır.
Ayarlar → Güvenlik bunu anahtar zinciri durumunun altında söyler — *Çalışan bir
anahtarlık yok…* — böylece *anahtar zinciri* sözcüğü hiçbir zaman var olmayan
bir korumayı temsil etmez.

Herkesin çözebileceği bir depolamaya yeni hiçbir şey düşmesin diye, çalışan bir
anahtarlık yokken yazdığınız bir token **yalnızca uygulamayı kapatana kadar**
tutulur. Token alanı bunu söyler — *Yalnızca GitHuttBr'yu kapatana kadar saklanır:
çalışan bir anahtarlık yok…* — yeniden deneme düğmesi olmadan, çünkü yeniden
denemek işe yaramaz; yalnızca bir anahtarlık yarar. Kimlik bilgileri içeren bir ayarlar dosyasını
içe aktarmak da onları içe aktarmadan önce aynısını söyler. Daha önce kaydedilmiş
token'lar okunabilir kalır — onlara erişiminizi hiç kaybetmezsiniz — ve birini
temizlemek ya da değiştirmek eski değeri yine diskten siler. İki sınır: genel
yapay zekânın anahtarı ortak yerine taşınmaz (her profil kendi anahtarını
okumaya devam eder) ve kasa, oturumluk bir modu olmadığı için temel depolamaya
kaydetmeyi sürdürür. Yeni token'ları yeniden kalıcı olarak saklamak için bir
anahtarlık kurun ya da kilidini açın ve GitHuttBr'yu yeniden başlatın.

GitHuttBr hangi depoyu aldığı konusunda sistemin sözüne güvenmez. Sistem onu öyle
adlandırdığında, onu hiç adlandıramadığında ve şifrelediği şey sabit parolayla
işaretlenmiş olarak geri geldiğinde — sistem ne derse desin — onu temel sayar. Böylece
sessizce geri düşen bir anahtarlık bile yeni token’ları diskten uzak tutar.

Yanıt vermeyi bırakan bir anahtarlık sonsuza kadar beklenmez. Linux’ta anahtarlık bu
oturumda bir kez yanıt verdikten sonra, 10 saniye yanıtsız bıraktığı bir soru
*anahtarlık yok* sayılır: kaydettiğiniz bir token kapatana kadar tutulur ve Kasa kapalı
kalır. Bir oturumun ilk sorusu — anahtarlığın kendi parola isteğini getirebilecek olan
— ve GitHuttBr’nun açıklamasının hemen ardından gelen soru iki dakika alır, böylece bir
iletişim kutusunu okumak asla yarıda kesilmez. Böyle bir zaman aşımından sonraki
yarım dakika boyunca yanıt yeniden sorulmadan *anahtarlık yok* kalır; ardından GitHuttBr
yeniden sorar. macOS ve Windows yerelde yanıt verir ve asla zaman aşımına uğratılmaz.

Sınır yalnızca o soruyu kapsar — *bir anahtarlık var mı?* Onu yanıtlayıp sonra
şifrelerken ya da şifre çözerken takılan bir anahtarlık yine de beklenir: ayarları
kaydetmek ve Kasa, o yanıt verene ya da GitHuttBr yeniden başlayana kadar meşgul kalır.

### Kayıtlı token'lar okunamadığında

Sistemin anahtarlık istemini kapatırsanız, anahtarlık kilitliyse ya da token
deposunu GitHuttBr'nun başka bir kopyası yazdıysa (bir geliştirme derlemesi,
yeniden imzalanmış bir sürüm), GitHuttBr **kayıtlı token'larınızı okuyamaz — ve
onlara dokunmaz**. Ayarlar → Güvenlik *GitHuttBr kayıtlı token'larınızı
okuyamadı* der ve bu arada yazdığınız bir token yalnızca oturum boyunca tutulur
(alan da bunu söyler). Okuyamadığı deponun üzerine asla yazılmaz: bu, her kayıtlı
token'ı az önce yazdığınızla değiştirirdi.

| Düğme | Ne yapar |
|--------|--------------|
| **Yeniden dene** | Depoyu yeniden okur — sistem şimdi anahtarlığı isteyebilir. Okunabildiği anda, bu arada yazılan token'lar ona katılır. |
| **Yeni belirteç deposu başlat** | Önce sorar. GitHuttBr eski depoyu beklemeyi bırakır ve yalnızca bu oturumun token'larıyla yenisini başlatır. Eski dosya 30 gün boyunca yedek olarak yanında kalır, sonra silinir. Kalıcı olarak kaybolmuş bir depo içindir, kapattığınız bir istem için değil. |

## Ayarları içe aktarma

**Ayarlar → İçe / Dışa aktar**, ayarları, profilleri ve temaları makineler
arasında taşır. Varsayılan dışa aktarım **hiçbir token ya da API anahtarı
içermez** ve böyle bir dosyayı içe aktarmak kaydettiklerinize asla dokunmaz —
dosyadaki boş bir token "bu dosyada yok" demektir, "benimkini sil" değil.

### Neyin dışa aktarılacağını seçmek

Bir yedek ile bir iş arkadaşına verilecek dosya aynı dosya değildir. Yedek her
şeyi ister; başka bir bilgisayar için dosya orada olmayan klasörleri taşımamalı;
ekip için dosya ne hesaplarınızı ne de yollarınızı taşımalı. Bu yüzden
**Ayarları dışa aktar**, içe aktarmanın sunduğu aynı dört bölümü (aşağıdaki
tablo), her biri bu bilgisayardaki boyutuyla gösteren bir pencere açar ve
yalnızca işaretlediklerinizi yazar. Dışarıda bırakılan bölüm dosyada hiç
yoktur — onu sonradan içe aktarmak, diğer makinenin o bölümünü olduğu gibi
bırakır.

![Ayarlar → Veri → Dışa aktar: «Başka bir bilgisayar» seçili, dosyanın bu makineye ait hiçbir yol taşımadığını söyleyen yeşil not ve içine girenlerin manifesti](../../screenshots/settings-export.webp)

Bölümlerin üstündeki üç kısayol alışılmış birleşimleri işaretler. Bir kutuyu
elle değiştirmek, eşleşen kısayolu yakar ya da hiçbirini:

| Kısayol | Bölümler | Ne için |
|----------|-------|-----|
| **Tam yedek** | Dördü de | Bu bilgisayarı ya da bir kopyasını geri yüklemek — Dışa aktar'ın bölümleri olmadan önce yazdığı dosyanın aynısı |
| **Başka bir bilgisayar** | Profiller ve hesaplar, Uygulama tercihleri | Yeni bir makinede kimliğiniz ve zevkleriniz, bu makinenin klasörleri ve programları olmadan |
| **Ekip için** | Uygulama tercihleri | Paylaşılan bir tema, kısayollar ve grafik düzeni — kişisel hiçbir şey, hiçbir yol yok |

Bölümlerin altında bir not, dosyanın bu bilgisayarın klasörlerini ya da
programlarını adlandırıp adlandırmadığını söyler: **Depolar** ya da
**Programlar** işaretliyken kehribar rengi (başka bir makinedeki içe aktarma bu
yolları çevirir ya da bulamadıklarını dışarıda bırakır), onlar olmadan yeşil.
**Programlar** olmadan **Profiller ve hesaplar**, profillerle birlikte saklanan
ama bu makinenin programlarını gösteren yapay zekâ CLI'larının yolunu da
dışarıda bırakır.

**Kimlik bilgileri yalnızca Profillerle ve yalnızca siz isterseniz.** Token'lar
ve API anahtarları profillere aittir, bu yüzden **API anahtarlarını,
belirteçleri ve Kasa sırlarını dahil et** yalnızca **Profiller ve hesaplar**
işaretliyken kullanılabilir; bölümün işaretini kaldırırsanız seçenek de onunla
birlikte temizlenir. Kimlik bilgileri işaretliyken pencere **Parolayla koru**'yu
(aşağıda) önerir ve onları şifrelemeden dışa aktarmak bir kez daha sorar.

En alttaki bir kutu, **Dışa aktar…**'a basmadan önce dosyanın ne içereceğini
listeler: kaç profil (kimlik bilgileriyle ya da onlarsız), profil resimleri,
tercihler, depo ve program yolları, depo notları ve vikileri ile kasanın girip
girmediği, hangi bölümlerin dışarıda kaldığı ve dosyanın şifreli olup olmadığı.
Hangi bölümle ne gider:

| Ek | Birlikte gittiği | Koşul |
|-------|-----------|-----------|
| Profil resimleri | Profiller ve hesaplar | Resim olarak seçilen görseller |
| Kasa sırları | Profiller ve hesaplar | Yalnızca kimlik bilgileri seçeneğiyle |
| Depo notları ve vikiler | Depolar ve çalışma alanları | Her zaman bölümle birlikte |

Sınırlar: bölümler bütün bir birimdir — tek tek profiller, tek tek depolar ya da
tek tek tercihler seçilemez. **Profiller** olmadan **Programlar** terminali,
düzenleyiciyi ve varsayılan uygulamaları taşır ama yapay zekâ CLI yollarını
taşımaz (onlar profillerin içinde yaşar). Manifest kayıtları sayar; yolların
kendisini göstermez. Ve bir bölümü olmayan dosya onu geri veremez: bir **Ekip
için** dosyasını geri yüklemek yalnızca tercihleri geri yükler.

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
profilin etkin olduğu değişmez, **genel yapay zekâ** da değişmez: bu bilgisayarın
yanıt verdiği motor ve model onun kendisinin kalır.

**Tümünü değiştir** hâlâ orada; tam olduğu gibi geri istediğiniz bir yedek
için: yalnızca dosyadaki profiller kalır, yalnızca bu bilgisayarda olanlar
üstü çizili olarak **Kaldırıldı** diye listelenir. **İçe aktar**'a basınca bir
kez daha, onları adlarıyla sayarak sorulur — kayıtlı kimlik bilgileri ve
resimleriyle birlikte giderler ve bu geri alınamaz. **Tümünü değiştir** ile
dosyanın etkin profili etkin profil olur ve dosyanın genel yapay zekâsı bu
bilgisayarınkinin yerini alır.

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
GitHuttBr dosyadaki depo klasörlerinin burada olup olmadığına bakar. Hiçbiri
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
de düzenlenebilir — tahmin yanlış olabilir ve GitHuttBr ortak bir klasör
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
açılışta geri gelirdi; bu yüzden GitHuttBr reddeder: bunu söyler ve hiçbir şey içe
aktarılmaz. Kayıtlı token'lar okunamadığı sürece de (yukarıya bakın) aynısı geçerlidir: okunabilir
olur olmaz geri gelirlerdi. **Benimkilere ekle** yine çalışır ve dosyadaki
token'ları oturum boyunca tutar.

**Sınır:** kimlik bilgileri bir profile aittir. İçe aktarmanın kaldırdığı bir
profil, ne seçerseniz seçin, kayıtlı token'larını da beraberinde götürür.

### Bir dışa aktarmayı parolayla korumak

Kimlik bilgileri işaretli bir dışa aktarma, dosyayı bulan herkes için token'ların
kendisi kadar değerlidir — eşitlenen bir klasör, unutulmuş bir USB bellek, bir
e-posta eki. Dışa aktarma penceresindeki **Parolayla koru**, dosyayı
[Güvenli paylaşım](secure-share.md) ile aynı şifreyle (scrypt ile türetilen bir
anahtar ve AES-256-GCM) şifreler; böylece içindeki hiçbir şey — kimlik bilgisi
taşıyıp taşımadığı bile — parola olmadan okunamaz.

İsteğe bağlıdır, kimlik bilgileri işaretli olsun ya da olmasın, ve parolanın en
az uzunluğu yoktur. İki kez yazarsınız ve kurtarılamayacağını anladığınızı
işaretlersiniz; dosyayı içe aktarmak onu sorar — Ayarlar'da bir pencerede, ilk
açılışta karşılama adımının içinde — ve yanlış parola yeniden sorulur.

![Ayarlar → Veri → Dışa aktar: parolayla korunan bir dosya, kurtarma olmadığı uyarısı onaylanmış](../../screenshots/settings-export-password.webp)

| | Parola olmadan | Parolayla |
|---|---|---|
| **Kim okuyabilir** | Dosyaya sahip herkes | Yalnızca parolayı bilen |
| **Değişmiş bir bayt** | Olduğu gibi okunur | Yanlış parola gibi reddedilir |
| **Açıldığı yer** | Her sürüm | Şifreli biçimi bilen sürümler |

**Kurtarma yoktur.** Parola hiçbir yerde tutulmaz — ne dosyada ne bu makinede —
ve sorulacak bir sunucu yoktur. Unutursanız dosya kaybolur; ayarlara hâlâ sahip
bir makineden yeniden dışa aktarın.

Sınırlar: eski bir sürüm şifreli bir dışa aktarmayı açamaz ve bunu bilmez de —
ayarları içe aktarılmış olarak bildirir ve hiçbir şeyi değiştirmez. Korunan bir
dosyayı parolasını soran bir sürümle içe aktarın. Kısa bir parola, dosyaya ve
tahmin edecek zamana sahip birine karşı yine zayıftır; scrypt anahtarı her
denemeyi yavaşlatır, imkânsız kılmaz. Parola dosyayı korur, çalışan uygulamayı
değil: kimlik bilgileri dışa aktarma için toplanırken, her zaman olduğu gibi
bellekte çözülür.

## Ayarlar dosyası

Ayarlar dosyası ve şifreli token deposu bütün olarak yazılır: yanında yalnızca
sahibinin okuyabildiği yeni bir dosyaya, sonra yer değiştirilerek; böylece bir
çökme ya da aynı anda iki kaydetme asla yarım bir dosya bırakmaz. Ayarlar
dosyası başka bir yere sembolik bağlantıysa (bir dotfiles deposu), yazma
bağlantının hedefine gider ve bağlantı kalır. GitHuttBr bağlantıyı asla
değiştirmez. Henüz var olmayan bir dosyayı gösteren bağlantının içinden yazılır
ve o dosya oluşturulur — klasörü var olduğu sürece. Klasör de yoksa kaydetme
başarısız olur, bunu söyleyen tek bir mesajla: bağlantı ve gösterdiği yer
dokunulmadan kalır, bu arada yapılan değişiklikler yalnızca GitHuttBr kapanana
kadar sürer. Klasörü geri getirin ya da bağlantıyı var olan bir yere yöneltin,
bir sonraki kaydetme başarılı olur.

Eski bir sürümün ayarlar dosyasında bıraktığı düz metin token'lar bir kaydetmeyle
asla kaybolmaz: siz birini kendiniz temizlemedikçe, GitHuttBr onları şifreli depoya
yükleyene kadar (Ayarlar'ı açmak bunu yapar) dosyada kalırlar.

Onları yalnızca iki şey yazar: ayarlarınızın kaydedilmesi ve GitHuttBr'nun onları
yüklemesi (açılışta ya da Ayarlar açıldığında) — eski bir düz metin token'ın
şifreli depoya taşındığı ya da içinde parola olan bir sunucu adresinin
temizlendiği an budur. Kimsenin istemediği bir sorgu — token'ını çözen bir
fetch, anahtarını arayan bir yapay zekâ çağrısı, bir profil resmi — yalnızca
okur, bu yüzden asla bir kaydetmenin üzerine düşemez. Ayarlar en az bir kez
yüklenene kadar kaydetme de reddedilir: ondan önce uygulama yalnızca varsayılan
değerleri tutar.

Ayarlar dosyasında hâlâ düz metin token'lar olan **eski bir kurulumdaki
bedel**: Ayarlar bir kez açılana kadar (ya da uygulama yeniden başlayıp onları
yükleyene kadar), token gerektiren her sorgu depoyu yeniden çözer ve kayıtlı bir
token gerektiren profil resimleri bekler. Bir sorgu hiçbir şeyi taşımaz, bu
yüzden bu arada temizlediğiniz bir token temizlenmiş kalır.

Var olan ama ayrıştırılamayan bir dosya (ters giden elle düzenleme, hasarlı bir
disk) **asla** varsayılanlarla değiştirilmez: GitHuttBr dosyanın bozuk olduğunu
söyler ve daha ileri başlamaz — o ekrandan hiçbir kısayol ya da menü komutu onun
üzerine kaydedemez.

![Bozuk bir ayarlar dosyası için açılış ekranı, Yeniden dene ve Bozuk dosyayı kenara al ve sıfırdan başla düğmeleriyle](../../screenshots/settings-damaged.webp)

`githuttbr-settings.json` dosyasını veri klasöründe düzeltip **Yeniden dene**'ye
basabilir ya da **Bozuk dosyayı kenara al ve sıfırdan başla**'ya basabilirsiniz:
dosyanın adı `githuttbr-settings.json.corrupt-<date>` olarak değiştirilir (asla
silinmez, bu yüzden ondan hâlâ bir şeyler kurtarabilirsiniz), şifreli token
deposunun bir kopyası yanında tutulur ve GitHuttBr ilk açılıştaki gibi başlar;
dosyanın nereye gittiğini söyleyen bir notla. Sembolik bağlantılı bir ayarlar
dosyasında adı değiştirilen bağlantının hedefidir; böylece bozuk kopya,
ilk kaydetmenin sonra bağlantı üzerinden yazacağı yeni ayarlar dosyasının
yanında, dotfiles'ınızda kalır. Kopya önce yapılır: yazılamazsa hiçbir şey
taşınmaz, ekran bunu söyler ve denetlenecek veri klasörünü gösterir; çünkü
kopya olmadan sıfırdan başlamak, kaydettiğiniz ilk token'ın eski profillerin
token'larını silmesine yol açardı. Klasöre yazmayı engelleyeni (izinler, dolu
bir disk) düzeltin ve **Yeniden dene**'ye basın.

Dosya GitHuttBr çalışırken bozulursa (altından elle düzenlenirse), kaydetmeler
durur ve GitHuttBr bunu bir kez söyler: ayarlar yeniden başlatılana kadar
kaydedilemez ve bu arada yapılan değişiklikler kaybolur.

Orada olan ama bir anlığına *okunamayan* bir dosya — virüs taraması gibi başka
bir program onu tutuyor — yaklaşık iki saniye boyunca yeniden denenir. Hâlâ
başarısız olursa ya da yükleme başka bir nedenle başarısız olursa, GitHuttBr
başlayamadığını, dosyanın değiştirilmediğini söyler ve **Yeniden dene** sunar;
dosyaya bozuk demez.

### Bilinen sınırlar

Olağandışı koşullar gerektirirler ve kimse şaşırmasın diye listelenmiştir:

- **Token'ları hâlâ ayarlar dosyasında olan çok eski bir kurulum.** Kayıtlı
  token'ların kilidi açıldıktan sonra anahtarlık kapatılırsa ya da bir yapay
  zekâ anahtarı hâlâ eski düz metin biçiminde saklıyken reddedilirse, o düz metin
  kopya bir sonraki kaydetmede kaybolabilir ve token yeniden başlatmadan sonra
  gider. Böyle bir derlemeden yükselttikten sonra Ayarlar'ı anahtarlık açıkken
  bir kez açın; token'lar kalıcı olarak şifreli depoya taşınır.
- **Aynı pencerede kesişen bir kaydetme ve başarısız bir yeniden yükleme.**
  Sonradan başarısız olan bir yeniden yüklemeyi geçen bir kaydetmede yazılmış
  bir token, Ayarlar yeniden yüklenene kadar o pencereden temizlenemez; Ayarlar'ı
  yeniden açın ve temizleyin.
- **Klasörü eksik olan sembolik bağlantılı bir ayarlar dosyası.** Token deposu,
  ayarlar dosyası başarısız olmadan önce yazılır; bu yüzden klasör geri gelene
  kadar ikisi uyumsuz kalır. Klasörü geri getirin (sürücüyü bağlayın, dotfiles'ı
  klonlayın) ve yeniden kaydedin.

## Git çalışırken bir profilin token'ı

Bir [profil](profiles.md) bir clone, fetch, pull ya da push işlemini token'ıyla
oturum açtırdığında, token başka bir programın okuyabileceği yerlerin hiçbirine
gitmez: ne `.git/config`'e, ne komut satırına (her yerel kullanıcı süreç
listesini okuyabilir), ne de git komutunun **ortamına** — git'in başlattığı her
hook, filtre ve LFS süreci, bir husky ya da lefthook betiğinin çalıştırdığı her
npm paketiyle birlikte bu ortamı devralır.

Bunun yerine GitHuttBr her işlem için kendine ait özel bir uç nokta açar —
yalnızca sizin kullanıcınızın girebildiği bir klasörde bir soket (Windows'ta
rastgele adlı bir adlandırılmış kanal) — ve yalnızca o sunucu için bir kimlik
bilgisi yardımcısı kaydeder. Git oturum açma bilgisi istediğinde yardımcı
bağlanır, yalnızca bu işlem için üretilmiş rastgele bir kodla bu işleme ait
olduğunu kanıtlar, git'in hangi ana makine ve depo için sorduğunu söyler ve
oturum açma bilgisini alır. Uç nokta işlemin her isteğini yanıtlar — git birden
fazla kez sorabilir, LFS için, bir yönlendirmeden sonra, başlattığı her süreç
için — ve git çıktığında kapatılıp silinir. Ortamını döken bir hook token'ı
değil, kodu bulur.

Hâlâ yapamadıkları:

- **İşlem sürerken bir hook yine de sorabilir.** O kod git'in ortamındadır,
  çünkü yardımcı git'in başlattığı bir programdır ve git başlattığı her programa
  aynı ortamı verir. Yardımcının protokolünü konuşacak şekilde yazılmış bir hook,
  git çıkana kadar kodu kullanarak oturum açma bilgisini isteyebilir —
  git-lfs'nin `pre-push` hook'u tam olarak böyle bir tane alır. Bir değişkende
  duran bir token'dan çok daha küçük bir açıklıktır — hiçbir şey onu yanlışlıkla
  okumaz, bir döküm ya da çökme raporu yalnızca git çıktıktan sonra işe yaramayan
  bir kod gösterir — ama bir açıklıktır.
- **Yalnızca açıldığı sunucu için yanıt verir.** Uç nokta başka her ana makineyi,
  düz bir `http` isteğini, sunucunun tabanı dışındaki bir yolu ve onun altına
  iç içe geçmiş bir sunucuyu (kökteki bir GitLab'ın yanında `/bitbucket`
  altındaki bir Data Center) reddeder — doğru kodla bile. Birden çok URL'ye
  yapılan bir push, sunucu başına bir uç nokta alır; her biri yalnızca o sunucunun
  oturum açma bilgisini tutar. İçinde başka bir sunucu iç içe geçmiş bir sunucu
  altında, iç içe sunucunun proxy'sinin kendine yönlendirebileceği bir yol da
  reddedilir: içindeki her `;` (Tomcat `;params` kısmını atar), noktayla biten bir
  bölüm ve iç içe tabanın adının farklı büyük/küçük harfle ya da önek olarak
  yazılmışı (`/Bitbucket/`, `/bitbucketx/`) — böylece adı iç içe sunucunun yoluyla
  başlayan dış sunucudaki bir grup da onun token'ını alamaz.
- **Bir istisna, sunucunun kendi tarafındaki bir yönlendirmeden sağ çıkmaz.**
  Denetim, git'in sorduğu yol üzerindedir. Dış sunucu bir isteği kendisi iç içe
  sunucunun yoluna yönlendirirse ya da bir proxy, git oturum açma bilgisini
  gönderdikten sonra onu oraya yeniden yazarsa, hiçbir istemci bunu göremez.
- **`git -c` ile devralınan bir oturum açma kenara konur.**
  `GIT_CONFIG_PARAMETERS` içinde aktarılan bir kimlik bilgisi yardımcısı (ya da
  bir tane ekleyebilecek bir `include`) — uygulama bir git takma adından ya da
  başka bir git tarafından başlatılmışsa — işlem süresince kaldırılır; böylece ona
  saklaması için profilin token'ı asla sunulmaz ve kimse adına sorulmaz. Devralınan
  diğer her `-c` ayarı korunur.
- **Bir sunucu adresi git'in okuduğu şekilde yazılmalıdır.** GitHuttBr sunucuyu
  standart URL kurallarına göre, git ise kendi kurallarına göre adlandırır:
  uluslararasılaştırılmış bir ad (`bücher.example`), sayısal bir kısaltma
  (`127.1`, `0x7f.0.0.1`), sıkıştırılmış ya da eşlenmiş bir IPv6 adresi veya ana
  makine adında kodlanmış bir karakter, her biri için farklı bir sunucudur. İşin
  içinde bir profil varsa böyle bir adres, makinenin kendi oturum açmasına
  bırakılmak yerine bir mesajla reddedilir. Büyük/küçük harf ve açıkça yazılmış
  bir varsayılan bağlantı noktası (`:443`) sorun değildir.
- **2.26'dan eski Git**, bir kimlik bilgisi kaydını bir sunucunun tabanı
  altındaki her şeyle değil, yalnızca tam adresle eşleştiriyordu. Kimse adına
  sorarken uygulama o tek komut için yardımcıları tüm ana makinede kapatır;
  token ile oturum açmak zaten git 2.31 gerektirir.
- **Güvenmediğiniz hook'ları çalıştırmayın**, oturum açmış bir profille bile.
  Az önce klonladığınız bir depo, onları `npm install` sırasında kuran husky gibi
  araçlarla hook'lar getirebilir; git, `.git/hooks` içinde ne varsa onu
  GitHuttBr'dan da bir terminalden de aynı şekilde çalıştırır ve bir hook bir
  token'ı okumaktan çok daha kötüsünü yapabilir.
- **Token'ın kapsamını daraltın.** Yalnızca üzerinde çalıştığınız depolara
  yazabilen bir token, onu ele geçiren herkes için çok daha az değerlidir.
- **SSH uzak depoları etkilenmez** — işin içinde token yoktur; bunun yerine
  [SSH ajanı](ssh-keys.md) yanıt verir.

## Güvenle paylaşmak

[Güvenli paylaşım](secure-share.md) ayarları, kasa kayıtlarını veya bütün
çalışma alanlarını **şifreli bir paket** olarak dışa aktarır — sırlar yalnızca
siz kutuyu işaretlediğinizde dâhil edilir.

## Sorun bildirmek

Bir hatadaki **Sorun bildir**, önceden doldurulmuş bir GitHub issue'su açar — ve
onu açmak bile, siz göndermeye karar vermeden önce metni GitHub'a gönderir. Bu
yüzden mesaj önce temizlenir: bir URL'ye yazılmış kimlik bilgisi, token'lar, ana
klasörünüz (ve onunla kullanıcı adınız), özel sunucular ve depo yolları, bir
deponun bağlı olduğu profilin adı, e-posta ve IP adresleri değiştirilir.
`github.com` gibi genel ana makineler kalır; dosya adları ve git'in kendi mesajı
da öyle.

**Sınır:** bir cümlede tek başına duran bir sunucu adı şeklinden tanınır —
noktalı, küçük harfli. Tek kelimelik bir ana makine (`gitserver`) yalnızca
GitHuttBr'nun kendi yazdığı mesajlarda yakalanır ve dosya uzantısı gibi yazılan
bir üst düzey alan adı (`.sh`, `.md`) altındaki bir sunucu dosya adı olarak
bırakılır. Yine de issue'yu göndermeden önce okuyun: temizleme bilinen şekilleri
tanır, özel olan her şeyi değil.

## Diskte kalanlar

Ayarlar dosyası, işlem günlüğü, avatar önbelleği ve şifreli token deposu
yalnızca hesabınız tarafından okunabilir (macOS ve Linux'ta). İçinde bir
`user:password@` ya da `?token=` ile kaydedilmiş bir sunucu adresinden — bir içe
aktarmadan ya da eski bir sürümden — o kısım okunduğunda, içe aktarıldığında ya
da kaydedildiğinde kaldırılır. Commit avatar önbelleği e-posta adresi saklamaz,
yalnızca her kuruluma özel tuzlanmış hash'ler saklar.

Bu dosyaların her biri bütün olarak yazılır: yanında yeni bir dosyaya, sonra yer
değiştirilerek; böylece bir çökme ya da aynı anda iki kaydetme asla yarım bir
dosya bırakmaz — GitHuttBr'nun aksi hâlde okunamaz sayması gereken bir dosya. Token
deposunun bir yedeği, yalnızca içindeki her token mevcut depoda da varsa erken
silinir; diğer her yedek 30 gün tutulur.

## Linux paketleri: sandbox ve AppArmor

Chromium'un sandbox'ı ayrıcalıksız kullanıcı ad alanlarına ihtiyaç duyar. Ubuntu
24.04 ve sonrası, bunlara izin veren bir AppArmor profili olmayan her programa
bunları yasaklar ve iki Linux paketi bunu farklı şekilde ele alır:

| Paket | Ne olur |
|---------|--------------|
| `.deb` | Kullanıcı ad alanlarına izin veren, `/opt/GitHuttBr/githuttbr` için bir profil olan `/etc/apparmor.d/githuttbr` dosyasını kurar. Uygulama sandbox içinde çalışır. |
| AppImage | Profili yoktur. Başlatıcısı `unshare -Ur true` dener ve bu başarısız olursa uygulamayı `--no-sandbox` ile başlatır — Ubuntu 24.04+ üzerinde bu her açılış demektir. Bu olduğunda GitHuttBr konsol çıktısına bir uyarı yazar. |

AppImage'ı sandbox içinde çalıştırmak için onun yerine `.deb` paketini kurun ya
da AppImage'a `userns` izni veren kendi AppArmor profilini verin (ya da makine
genelinde, kısıtlamayı her şey için kapatan
`sysctl kernel.apparmor_restrict_unprivileged_userns=0`).

**`.deb` profilinin sınırı.** `userns` izinli `flags=(unconfined)` profilidir ve
yürütülebilir dosyanın yoluna bağlanır. Aynı yürütülebilir dosya
`ELECTRON_RUN_AS_NODE=1` ile başlatıldığında düz Node olarak da çalışır —
`githuttbr` komutu, birlikte gelen diff dönüştürücüsü ve GitHuttBr'nun kimlik bilgisi
yardımcısı böyle çalışır, bu yüzden bu anahtar onları bozmadan kapatılamaz.
Birlikte bu, herhangi bir yerel programın GitHuttBr'nun yürütülebilir dosyasını
kullanıcı ad alanı oluşturmasına izin verilen bir Node yorumlayıcısı olarak
kullanabileceği anlamına gelir — Ubuntu kısıtlamasının profilli başka programlar
üzerinden bilinen atlatma yollarıyla aynı türden bir açık. Kimseye kendi
hesabının haklarından fazlasını vermez; Ubuntu'nun üstüne eklediği bir çekirdek
sağlamlaştırma katmanını zayıflatır. AppArmor tek bir yürütülebilir dosyanın iki
kipini birbirinden ayıramaz, bu yüzden CLI onu paylaştığı sürece daha dar bir
profil mümkün değildir; CLI için ayrı bir yardımcı ikili yol haritasındadır. Bunu
istemeyen yöneticiler, sandbox pahasına `/etc/apparmor.d/local/githuttbr` içine bir
deny kuralı ekleyebilir.

**Ayrıca bakınız:** [Kasa](vault.md) · [Güvenli paylaşım](secure-share.md)
