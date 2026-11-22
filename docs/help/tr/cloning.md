---
title: Klonlama
category: Buradan başlayın
order: 2
summary: Bir URL'den ya da doğrudan barındırma servisinizden klonlayın — depo devasaysa gelen veriyi daraltın.
keywords: klonlama klon clone arka plan background iptal cancel abort çoklu birden fazla toplu batch çok sayıda depo tümünü seç select all shallow sığ depth partial kısmi filter blob none single branch tek dal submodule alt modül recursive ls-remote dal seçici unshallow monorepo
source: 3d8942b1073ef47bd000c7887afb5ea8cdebcdd7
---

# Klonlama

**Yeni depo → Klonla** ya da `⌘K` → *Klonla*. Bir URL yapıştırın veya GitHub,
GitLab, Bitbucket ya da Azure DevOps hesabınıza giriş yapıp kendi depolarınızdan
birini seçin — seçtiğiniz [profilin](profiles.md) belirteci yalnızca klonlama
için kullanılır, sonra bırakılır; hiçbir zaman `.git/config` içine yazılmaz.

Bir üst klasör ve bir ad seçin; alanların altındaki satır deponun tam olarak
nereye ineceğini gösterir. Halihazırda var olan bir klasör içine karıştırılmaz,
reddedilir.

## Birden fazla depoyu aynı anda

Yeni bir makine kurmak ya da bir ekibin sahip olduğu tüm servisleri indirmek,
eskiden bu pencereyi her depo için bir kez açmak demekti. Bir barındırma
sekmesinde istediğiniz her deponun onay kutusunu işaretleyin ya da filtreye
uyan her şeyi almak için **Gösterilenlerin tümünü seç**'e basın. Bir satıra
(onay kutusuna değil) tıklamak hâlâ yalnızca o depoyu seçer.

Birden fazlası işaretliyken pencere hepsini aynı üst klasöre, her birini deponun
adını taşıyan bir klasöre klonlar. Yollar siz başlamadan önce listelenir. İki
deponun adı aynıysa (`org-a/app` ve `org-b/app`), aynı klasör için yarışmak
yerine ikisi de klasör adında sahibini taşır (`org-a-app`, `org-b-app`).

![Klonlama penceresinin GitHub sekmesi: üç depo işaretli, ineceği klasörler üst klasörün altında listelenmiş ve bir 3 depoyu klonla düğmesi](../../screenshots/clone-multi-select.webp)

Toplu iş doğrudan köşedeki tepsiye gider. Aynı anda üç klon çalışır, geri
kalanlar *Sırada* olarak bekler; her birinin kendi iptal düğmesi vardır. Her
depo bittiği anda bir sekmede açılır.

Sınırlar:
- **Checkout edilecek dal** toplu işte gizlenir: bir dal adı farklı depolar
  arasında bir şey ifade etmez, bu yüzden her biri kendi varsayılan dalını alır.
  Diğer Gelişmiş seçenekler (kısmi, sığ, tek dal, alt modüller) hepsine uygulanır.
- Çoklu seçim yalnızca barındırma sekmelerinde çalışır. URL sekmesi tek bir URL
  alır.
- Bir hata diğerlerini durdurmaz. Klasörü zaten var olan bir depo kendi hatasıyla
  başarısız olur, geri kalanlar devam eder.

## Gelişmiş — klonu daraltmak

**Gelişmiş** altındaki her şey varsayılan olarak kapalıdır: dokunmazsanız
sıradan, eksiksiz bir klon alırsınız. Bu bölüm, "eksiksiz"in yirmi dakika ve
birkaç gigabayt anlamına geldiği depolarda hakkını verir.

![Gelişmiş bölümü açık klonlama penceresi: kısmi, sığ, tek dal, alt modüller ve bir dal seçici](../../screenshots/clone-advanced.webp)

| Seçenek | git ne yapar | Bedeli nedir |
|--------|---------------|---------------|
| **Kısmi klon** | `--filter=blob:none` | Tüm geçmiş gelir, dosya içerikleri gelmez. Blob'lar istendikçe indirilir, yani eski bir dosyayı açmak ağ bağlantısı ister. |
| **Sığ klon** | `--depth=N` | Yalnızca en yeni N commit vardır. Blame, log, bisect ve range-diff kesim noktasında durur. |
| **Yalnızca tek dal** | `--single-branch` | Diğer dallar siz onları fetch edene kadar uzak depoda kalır. |
| **Alt modülleri klonla** | `--recurse-submodules` | Her alt modül de checkout edilir — şimdi daha uzun sürer, sonra eksik dizin olmaz. |
| **Checkout edilecek dal** | `--branch <name>` | Uzak deponun varsayılan dalı yerine o dalda başlar. |

**Sığ değil, önce kısmi.** Kısmi klon her commit'i saklar — geçmiş aranabilir
kalır, yalnızca dosya içerikleri tembel biçimde indirilir. Sığ klon ise geçmişi
gerçekten atar: `git log` kesim noktasında biter ve blame ötesini göremez. Bir
monorepo'yu içinde çalışmak için klonluyorsanız, genellikle istediğiniz seçenek
kısmi klondur.

Sığ klon geri alınabilir: [terminalde](terminal.md) `git fetch --unshallow`
geçmişi yeniden doldurur.

### Dalı seçmek

Bir dal adı yazın ya da **Dalları listele**'ye basarak uzak depoda ne olduğunu
sorun (`git ls-remote --heads`) ve açılır listeden seçin. Bu tek bir ağ gidiş
dönüşüdür ve yalnızca düğmeye bastığınızda yapılır — siz yazarken hiçbir sorgu
gönderilmez.

Listeleme başarısız olursa — henüz belirteci olmayan özel bir URL, bir yazım
hatası, ağın olmaması — alan düz bir metin kutusu olarak kalır ve gerçek hatayı
klonlamanın kendisi bildirir.

### Bayraklarla ilgili iki not

- **`--depth`, `--single-branch` anlamına gelir.** Sığ bir klonda *Yalnızca tek
  dal* seçeneğini işaretsiz bırakmak, diğer dalları geri istemek demektir
  (`--no-single-branch`); altındaki ipucunun değişmesinin nedeni budur.
- **Yerel bir klasörü klonlarken** git normalde `--depth`'i tamamen yok sayar,
  çünkü nesne deposunu indirmek yerine sabit bağla (hardlink) paylaşır. Yerel bir
  deponun sığ bir kopyasını istediğinizde Gitcito `file://` URL'si üzerinden
  klonlar, böylece istediğiniz derinlik gerçekten elinize geçer.

## İlerleme, arka plan ve iptal

Çubuk, git ne bildiriyorsa onu bildirir: sayma, sıkıştırma, alma, çözümleme,
checkout. Toplam bildiremeyen bir aşama, sahte bir yüzde yerine belirsiz bir
çubuk gösterir.

Büyük bir klon dakikalar sürer ve pencerenin dışına yanlışlıkla bir tıklama
eskiden bunun hepsine mal oluyordu. Artık pencereyi kapatmak — **Arka planda
çalıştır**, `Esc`, ✕ ya da dışarıya bir tıklama — onu yalnızca gizler: klon
devam eder ve aynı ilerleme çubuğuyla alt köşedeki küçük bir karta taşınır. Bu
arada başka bir klon başlatabilirsiniz; her biri kendi kartını alır.

![Alt köşedeki klon tepsisi: alma, çözümleme ve sayma aşamasında üç klon, sırada bir dördüncüsü, her birinin kendi iptal düğmesi](../../screenshots/clone-tray.webp)

Yanlış depoyu mu seçtiniz? Penceredeki **Klonlamayı iptal et** ya da kartındaki
✕, git'i durdurur ve yarım yazılmış klasörü siler. Başka hiçbir şeye
dokunulmaz — klasör klon başlamadan önce yoktu ve bu baştan denetlenir. İptal
edilen bir klon sürdürülemez; yeniden başlatmak sıfırdan başlar.

Bittiğinde yeni depo, pencere hâlâ açık olsun ya da olmasın, bir sekmede açılır
ve klonlarken kullandığınız profile sabitlenir.

Klonlar uygulamanın içinde çalışır, bu yüzden Gitcito'dan çıkmak onları durdurur.
Çıkış temizliği beklemez, dolayısıyla yarım yazılmış klasör geride kalabilir —
oraya yeniden klonlamadan önce onu silin, çünkü pencere var olan bir klasörü
reddeder.
