---
title: Kimlik bilgisi yardımcısı
category: Güvenlik
order: 73
summary: Git'in kendi parola deposu — üçüncüsü — ve https neden size sürekli yeniden soruyor.
keywords: kimlik bilgisi yardımcısı credential helper parola https tekrar soruyor osxkeychain wincred manager libsecret store cache git-credentials düz metin unut iptal edilmiş token 401 oturumu kontrol et hangi hesap uzak depo url’sinde token gömülü parola url’den kaldır token in remote url embedded password invalid username or token authentication failed set-url
source: 1e74bbd13f1cd8ca72fac755ce38a4e43bc11456
---

# Kimlik bilgisi yardımcısı

Gitcito üç ayrı türde gizli bilgi tutar ve insanlar bunların tek bir şey
olduğunu varsaymakta haksız da değiller:

| | Kimde durur |
|---|---|
| Servis API token'ları — pull request'ler, issue'lar, CI kontrolleri | Gitcito, [işletim sistemi anahtar zincirinizde](security.md) |
| `git@…` taşıması | [SSH anahtarınız](ssh-keys.md), sistemin ssh ajanı üzerinden |
| **`https://` taşıması** | **Git'in kendi kimlik bilgisi yardımcısı** |

Üçüncüsü, ters gidene kadar kimsenin özellik saydığı bir şey değildir; ters
gittiğindeyse git'in en sık duyulan iki şikâyetini üretir: *neden bana yine
soruyor?* ve *iptal ettiğim token'ı neden hâlâ gönderiyor?*

`⌘K` → **Kimlik bilgisi yardımcısı**.

![Yapılandırılmış yardımcı, sunucu bazlı kurallar ve düz metin dosyası uyarısı](../../screenshots/credentials.webp)

## Baktığınız şey

Yapılandırılmış her `credential.helper`, geldiği kapsamla birlikte — `system`,
`global`, ardından bu depo. **Yardımcılar üst üste yığılır**: git her birine
sırayla sorar ve depo düzeyindeki bir yardımcı, genel olanın yerini almaz.

Her biri makinenize karşı denetlenir:

| İşaret | Anlamı |
|------|-------|
| **hazır** | Yardımcı program mevcut ve çalışacak |
| **kurulu değil** | Yapılandırılmış ama program yok — her sorgu, parolayı elle yazmaya düşer |
| **parolalar düz bir dosyada** | `store` yardımcısı (aşağıya bakın) |

**Belirli sunucular için kurallar** bölümü `credential.<url>.*` bloklarını
listeler. Bunlar, eşleştikleri URL'ler için düz ayarı geçersiz kılar ve genelde
"bu tek sunucu neden farklı davranıyor" sorusunun cevabıdır.

## Birini seçmek

| Yardımcı | Parolanın gittiği yer |
|--------|------------------------|
| `osxkeychain` | macOS Keychain — şifreli, kullanıcı bazlı |
| `manager` | Git Credential Manager (Windows, çapraz platform) |
| `wincred` | Windows Credential Manager |
| `libsecret` | Linux gizli bilgi servisi (GNOME Keyring, KWallet) |
| `cache` | Bellek, 15 dakikalığına. Diske hiçbir şey yazılmaz |
| `store` | **Ev dizininizde düz bir dosya. Şifresiz** |

Gitcito bu makinede gerçekten kurulu olanları önerir, işletim sisteminize
uyanı işaretler ve geri kalanını soluklaştırır.

**Kapsam önemlidir.** *Her depo için* seçeneği genel yapılandırmanıza yazar ki
neredeyse her zaman istediğiniz budur; *yalnızca bu depo için* ise başka bir
yere karşı kimlik doğrulayan tuhaf depo içindir.

## `store` yardımcısı ve `~/.git-credentials`

`store`, `~/.git-credentials` dosyasına `https://kullanıcı:parola@sunucu`
satırlarını düz metin olarak, hiçbir şifreleme olmadan yazar. Sizin adınıza
çalışan her şey bunu okuyabilir: bir betik, bir bağımlılığın postinstall'ı,
her şey.

O dosya varsa bu sayfa bunu söyler ve kayıtları sayar. İçeriğini asla
göstermez — sayı zaten meselenin tamamıdır ve içeriği göstermek için okumak da
aynı hatanın kendisi olurdu.

Böyle bir dosya bulduysanız ve niyetiniz bu değildiyse: buradan gerçek bir
yardımcı seçin, sonra dosyayı silin ve bir kez yeniden kimlik doğrulayın.

## Saklanan bir kimlik bilgisini unutturmak

Bir token iptal edildiğinde ya da yenilendiğinde yardımcı eskisini uzatmayı
sürdürür ve her push, hiçbir şeyin adını vermeyen bir 401 ile başarısız olur.
**Unut**, yapılandırılmış yardımcıdan o sunucuya ait kaydı silmesini ister —
git'in kendi belgelenmiş yolu olan `git credential reject`.

Bu yolda hiçbir şey okunmaz: Gitcito, canlı bir parolayı standart çıktıya
yazdıracak olan `git credential fill` komutunu asla çağırmaz.

Sonraki push size bir kez sorar, yardımcı da yeni cevabı saklar.

## Bir push hangi hesabı kullanır

Her push URL’si ayrı ayrı kontrol edilir. Yazma kapsamı yalnızca token’ın bir yeteneğidir. Depo üyeliği, dal kuralları ve belirli bir dosyayı değiştirme izni test edilmez. Herkese açık okumalar kimlik bilgisi olmadan başarılı olabilir.

![Uzak depo oturum kontrolü](../../screenshots/remote-sign-in.webp)

Bir push birkaç şekilde oturum açabilir: bir profilin token’ı, bir profile bağlı bir
GitHub CLI oturumu, git’in kendi helper’ı, uzak depo URL’sinde unutulmuş bir parola ya
da bir SSH anahtarı. Reddedildiğinde önce hangisini kullandığını bilmeniz gerekir. Kenar
çubuğunda bir uzak depoya sağ tıklayıp **Oturumu kontrol et…** seçin (ya da komut
paletinde *Uzak depo oturumlarını kontrol et*). Kontrol kimlik bilgisini bir push’un
yapacağı gibi çözer, sonra sunucuya onu sorar:

| Gösterdiği | Nereden geldiği |
|----------|--------------------|
| Kaynak ve arkasındaki [profil](profiles.md) | Bir push’un uyguladığı aynı öncelik — depoya bağlı profil, yoksa etkin olan, yoksa git’in helper’ı |
| Hesap | Sunucunun kendi yanıtı (`/user`), Ayarlar’a yazılan değil |
| Kapsamlar | GitHub’ın `X-OAuth-Scopes` başlığı; GitLab’in kendi token’ına dair açıklaması |
| Neye izin verdikleri | Yazmayla ilgili token kapsamları (GitHub’da `repo`, GitLab’de `write_repository`) ve GitHub’da `.github/workflows` değiştirilebilir mi |

Ayrıca sunucunun reddettiği bir kimlik bilgisini (süresi dolmuş ya da iptal edilmiş),
artık oturumu açık olmayan bağlı bir hesabı ve uzak depo URL’sinde düz metin olarak
saklanan bir parolayı işaretler.

**Sınırlar.** İnce ayarlı bir GitHub token’ı izinlerini listelemez, bu yüzden push
yapıp yapamayacağı bir push denenene kadar bilinmiyor olarak görünür. Forgejo hesabı
bildirir ama token’ın izinlerini bildirmez. Azure DevOps ve Bitbucket yalnızca kaynak
ve profille gösterilir. SSH uzak depoları test edilmez, ama [SSH anahtarları](ssh-keys.md)
ajanın tuttuklarını listeler. Kontrol git’in helper’ına sessizce sorar: oturum açma
penceresine ihtiyaç duyacak bir helper boş sayılır.

## Uzak depo URL’sine kaydedilmiş bir parola

Eski bir klon ya da bir wiki’den yapıştırılmış bir URL, kimlik bilgisini adresin içinde
taşıyabilir: `https://user:token@git.example.test/team/app.git`. **URL’deki bir parola
her zaman önceliklidir:** git onu gönderir ve hiçbir helper’a sormaz — ne deponun
[profilinin](profiles.md) token’ına, ne GitHub CLI’ya, ne git’in kendi deposuna. Token
çalıştığı sürece sorun yoktur ve Gitcito ona dokunmaz: **size sormadan bir URL’den asla
parola kaldırmaz.** Token iptal edildiğinde ya da süresi dolduğunda, o tek deponun her
fetch, pull ve push’u *Invalid username or token* ya da *Authentication failed* ile
başarısız olur; aynı profildeki diğer depolar ise çalışır. Ve token, deponun
`.git/config` dosyasında düz metin olarak durur.

![Kayıtlı bir token’ı uzak depo URL’sinden kaldırmak](../../screenshots/remote-url-token.webp)

Gitcito her uzak deponun fetch ve push URL’lerini okur ve bunu üç yerde söyler:

| Nerede | Ne görürsünüz |
|-------|--------------|
| Başarısız bir fetch, pull ya da push | Hata, uzak deponun URL’sinin kayıtlı bir parola içerdiğini **URL'den kaldır…** ile birlikte açıklar |
| Kenar çubuğu | Uzak deponun satırında göze batmayan bir anahtar simgesi: URL’si profilin token’ından öncelikli bir parola içerir. Aynı eylem sağ tık menüsündedir |
| **Oturumu kontrol et…** | Uzak depo parolayı kaynağı olarak, aynı düğmeyle gösterir |

Eylem önce sorar. Parolayı o uzak deponun her URL’sinden çıkarır — fetch URL’si ve parola
içeren her push URL’si — ve `.git/config` dışında hiçbir şey yazmaz. Sonra ne olacağı,
başka neyin oturum açabildiğine bağlıdır:

| Kaldırdıktan sonra | Fetch ve push neyi kullanır |
|---------------|-------------------------|
| Deponun profilinin o sunucu için bir token’ı ya da bağlı hesabı var | O token’ı — onay başka bir şey söylemez |
| Profil token’ı yok ama git’in kendi helper’ının sunucu için bir oturumu var | Helper’ın oturumunu |
| İkisi de yok | Hiçbir şeyi: bir token ekleyene kadar fetch ve push başarısız olur. Onay bunu önceden söyler ve Ayarlar → Entegrasyonlar’ı açan **Önce bir token ekle** seçeneğini sunar |

Başarısız bir işlemden başlatıldıysa **Yeniden dene** sunar.

**Geri alma bilerek yoktur.** Geri almak sırrı dosyaya düz metin olarak yeniden yazardı;
eylemin var olma nedeni de tam olarak bunu önlemektir. Eski token hâlâ çalışabilirse onu
sunucuda iptal edin: depo klasörünü okuyabilen her şey onu okuyabiliyordu.

**Sınırlar.**

- Kullanıcı adı da gider (`https://git.example.test/…`), tıpkı `git remote set-url`’i
  elle çalıştırdığınızdaki gibi; onay bunu söyler. Onu URL’de isteyen bir sunucu —
  profilde kullanıcı adı olmayan bir Bitbucket Data Center token’ı — **Uzak depoyu
  düzenle…** ile yeniden eklenmesini gerektirir.
- Tek başına bir kullanıcı adı (`https://user@host/…`) işaretlenmez: git o kullanıcının
  parolasını hâlâ helper’a sorar, yani gizli bir şey saklanmaz.
- SSH URL’lerine dokunulmaz: `git@host:…` ve `ssh://git@host/…` bir kimlik bilgisini
  değil, ssh’nin kullandığı oturumu adlandırır.
- Bir uzak helper’ın öneki (`persistent-https::https://…`, `gcrypt::…`) korunur;
  ardından gelen URL diğerleri gibi okunur ve temizlenir.
- **Belirsiz URL’ler kaldırma için sunulmaz.** Okuyucular sunucunun nerede başladığı
  konusunda anlaşamadığında — adreste bir `?` ya da `#` sonrasında bir `@`, ya da
  kodlanmamış bir `/` içeren bir parola — yanlış `@`’dan kesmek uzak depoyu başka bir
  sunucuya yönlendirirdi. Böyle bir URL yalnızca gizlenmiş olarak gösterilir ve anahtar
  simgesi, onu elle düzeltmeniz için **Uzak depoyu düzenle…**’yi açar.
- Yalnızca `.git/config` okunur ve değiştirilir. Bir `url.<base>.insteadOf` kuralıyla
  yeniden yazılan bir URL ya da genel yapılandırmanızda tanımlı bir uzak depo
  incelenmez — ve bir uzak depoyu yeniden adlandırmak, bir `insteadOf` kuralının
  eklediği parolayı asla deponun yapılandırmasına kopyalamaz.
- Parola ana süreçten asla çıkmaz: uzak depo URL’leri pencereye, URL kopyalama menüsüne
  ve düzenleme iletişim kutusuna parolasız ulaşır. Düzenleme kutusunu gösterdiği URL ile
  kaydetmek hiçbir şeyi değiştirmez ve parolayı korur; **sunucuyu ya da yolu değiştirmek
  onu düşürür**, çünkü yazdığınız URL olduğu gibi yazılır. Adresi koruyarak bir parolayı
  kaldıran yalnızca bu eylemdir.

## Bilmeye değer sınırlar

- **Burası git'in deposu, Gitcito'nunki değil.** Burayı değiştirmek
  terminalinizin davranışını da değiştirir — zaten mesele bu, ama
  değiştirmeden önce bilmekte fayda var.
- **Sistem düzeyindeki yardımcılar gösterilir, düzenlenemez.** Yalnızca bir
  yöneticinin yazabileceği bir yapılandırmada dururlar.
- **Gitcito bir yardımcının neler tuttuğunu listeleyemez.** Hiçbir kimlik
  bilgisi API'si bunu gizli bilgileri teslim etmeden açığa vurmaz; bu yüzden
  pencere yalnızca yapılandırmayı bildirir ve istendiğinde siler, başka bir şey
  yapmaz.
- **Gitcito'ya verdiğiniz bir token ayrıdır.** Birini iptal etmek diğerine
  dokunmaz; anahtar zinciri tarafı için [güvenlik](security.md) sayfasına bakın.
- **Bir profilin token’ı deponun hook’larının ortamına girmez.** Bir hook yalnızca o git
  komutu çalıştığı sürece geçerli, özel bir uç noktaya ait bir kod görür — git-lfs’in
  yaptığı gibi bilerek soran bir hook için yeterli.
  [git çalışırken bir profilin token’ı](security.md#git-çalışırken-bir-profilin-tokenı) sayfasına bakın.

Ayrıca bakınız: [Güvenlik](security.md) · [SSH anahtarları](ssh-keys.md) ·
[Eşitleme](syncing.md)
