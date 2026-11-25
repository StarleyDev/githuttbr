---
title: Pull request sayfası
category: Eşitleme ve çoklu depo
order: 57
summary: Bir deponun tüm pull request’leri tek sayfada — duruma göre, yazar, inceleyen, hedef ve CI ile süzülmüş — ve bir PR’ın içinden süzülmüş listede ilerlemek için ‹ ›.
keywords: pull request’ler liste sayfa merge request pr mr filtre yazar inceleyen benimkiler incelememi bekleyenler benden inceleme istenen ci başarısız hedef dal taslaklar birleştirilen kapalı arama önceliklendirme önceki sonraki alt ok gezinme checkout kaynak dala git hedef dala git dal adını kopyala fetch
source: ced0be4a5d7da5b8c32b15d7fcc8846b79ee9506
---

# Pull request sayfası

Yoğun bir depoda aynı anda yirmi pull request açıktır. Kenar çubuğu onları
listeler, ama her birine bir satır pek bir şey söylemez: hangisi kimin, hangileri
sizi bekliyor, hangileri kırmızıya döndü. Bunu öğrenmek için her birini açmak,
okumak, geri dönmek, sonrakini açmak gerekiyordu. **Pull request sayfası** bu
soruları tek ekranda yanıtlar ve bir pull request’i açtığınızda **‹ ›** geri
dönmeden sizi aynı listenin bir sonrakine götürür.

![“pix” için aranmış pull request sayfası: eşleşmeler vurgulu, sizinkiler “sen” ile işaretli, başarısız bir CI ve bir taslak](../../screenshots/pull-requests.webp)

## Açmak

- Kenar çubuğundaki **PULL REQUEST’LER** başlığında **liste simgesi** (*Tüm pull
  request’leri gör*).
- Komut paletinde (⌘K) *Pull request’ler…* ya da **Araçlar → Pull
  request’ler…**.

Wiki ve [CI çalıştırmaları](ci-runs.md) gibi, sayfa deponun sekmesinde açılır.

## Sekmeler

| Sekme | Ne içerir |
|---|---|
| **Açık** | Taslaklar dahil tüm açık pull request’ler |
| **Taslaklar** | Yalnızca taslak olarak işaretlenmiş açık olanlar |
| **Birleştirilen** | Birleştirilmiş pull request’ler, sekmeyi ilk açtığınızda okunur |
| **Kapalı** | Birleştirilmeden kapatılanlar (reddedilen, bırakılan), Birleştirilen ile birlikte okunur |

Açık ve Taslaklar yanındaki sayılar, kenar çubuğunun zaten tuttuğu listeden
gelir. Birleştirilen ve Kapalı yalnızca birini açtığınızda ve oturum başına bir
kez istenir; **Yenile** yeniden ister.

## Filtreler

| Filtre | Bıraktığı |
|---|---|
| **Ara** | Başlığı, açıklaması, dalları veya numarası yazılan her kelimeyi içeren pull request’ler. `#482` ya da `482` o numarayı bulur; eşleşmeler başlıkta vurgulanır |
| **Yazar** | Tek bir yazar — her biri bu sekmede kaç tane olduğuyla listelenir. **Ben** ilk sıradadır |
| **İnceleyen** | İstenen tek bir inceleyen ya da **Benden inceleme istenen** |
| **Hedef dal** | O dala açılan pull request’ler |
| **Benimkiler** | *Yazar: Ben* için kısayol |
| **İncelememi bekleyenler** | *İnceleyen: benden inceleme istenen* için kısayol |
| **CI başarısız** | Head’inin kontrolleri başarısız olan pull request’ler |

Filtrelerin altındaki satır, sekmedeki pull request’lerin kaçının gösterildiğini
ve hangi filtrelerin açık olduğunu söyler; hepsini kaldırmak için **filtreleri
temizle** vardır.

Filtreler depo başına **uygulama çalıştığı sürece** tutulur — sayfadan çıkın,
geri gelin, bıraktığınız gibidirler. Yeniden başlatmalar arasında bilerek
saklanmazlar: bir hafta sonra sessizce geri gelen “benimkiler, CI başarısız”
filtresi, gizlenmesini istemediğiniz pull request’leri gizlerdi.

### “Ben” kim

“Ben”, bu deponun çağrılarının sunucuda oturum açtığı hesaptır — deponun
[bağlı](profiles.md) olduğu profil, yoksa etkin olan — ve sunucunun kendisine
sorulur. Token kime ait olduğunu söyleyemediğinde (kullanıcı kapsamı yoksa) ya da
token yoksa, **Ben**, **Benimkiler** ve **İncelememi bekleyenler** sunulmaz.

## Liste

| Sütun | Ne gösterir |
|---|---|
| **#** | Numara; açık, taslak, birleştirilmiş veya kapalı için bir simgeyle |
| **Başlık** | Başlık, bir *taslak* rozeti ve kimden hâlâ inceleme istendiği — siz olduğunuzda vurgu renginde |
| **Yazar** | Sunucu veriyorsa onun resmi, yoksa baş harf; kendi pull request’lerinizde **sen** |
| **Dallar** | Kaynak → hedef |
| **Kontroller** | Head’in kontrollerinin özeti — `6/6`, `1 başarısız`, `2 çalışıyor`; sayılar için üzerine gelin |
| **Güncellendi** | En son ne kadar önce değiştiği; tarih için üzerine gelin |

Satırlar en son etkinliğe göre sıralanır. Tıklamak pull request’in kendi
sayfasını açar ([Sunucular ve pull request’ler](hosting.md)). Bu sayfası olmayan
bir sunucuda satır pull request’i tarayıcıda açar.

Bir [fork checkout’unda](hosting.md#bir-forkun-üst-deposundaki-pull-requestleriniz) üst depodaki pull request’leriniz de
listelenir, *owner/repo üzerinde* olarak işaretlenir.

## Bir pull request’ten listede ilerlemek

![Süzülmüş listeden açılan bir pull request: ‹ 1 / 4 › ve geldiği filtreler](../../screenshots/pull-request-nav.webp)

Sayfadan açılan bir pull request, başlığının üstünde bir şerit gösterir:

- **← Pull request’ler** listeye, filtreler bıraktığınız gibi, geri döner.
- **‹ k / n ›** açtığınız listenin önceki veya sonraki pull request’ine geçer —
  süzülmüş liste, kendi sırasıyla, tıkladığınız andaki hâliyle. İpuçları her
  okun götürdüğü pull request’i adlandırır.
- **Alt+← / Alt+→** aynısını klavyeden yapar. **Ayarlar → Kısayollar** içinde
  yeniden atanabilirler. İmleç bir metin alanındayken (Option+← kelime kelime
  ilerlediğinde) ve odak terminaldeyken devre dışı kalırlar.

Geçiş sayfayı yerinde değiştirir; böylece on pull request’te gezinmek sekmede on
simge bırakmaz; listeden başka bir satır açmak da onu değiştirir.

**Başka herhangi bir yerden** — kenar çubuğundan, bir bildirimden — açılan bir
pull request, deponun açık pull request’lerinde sayfanın varsayılan sırasıyla
(Açık, filtresiz) ilerler. O listede de olmayan biri, örneğin bir stack’in
birleştirilmiş bir katmanı, yalnızca listeye dönüş yolunu gösterir.

## Bir pull request’in dalına gitmek

Bir pull request üzerinde çalışmak için onun dalının checkout edilmiş olması
gerekir — ve binlerce dalı olan bir depoda onu dal listesinde adıyla bulmak işin
yavaş kısmıdır. Bir pull request’in sayfasında **Dallar** alanı bunu sizin için
yapar:

- **Dal adı bir bağlantıdır.** Tıklamak o dalı checkout eder ve sizi deponun
  grafiğine, dalın ucuna götürür. Pull request’in sayfası sekmede açık kalır.
- **Yalnızca sunucuda var olan bir dal** önce fetch edilir — yalnızca o dal,
  bütün remote değil — ve onu izleyen yerel bir dal olarak checkout edilir.
  Zaten yerelde olan bir dala olduğu gibi geçilir — güncellenmez, bu yüzden pull
  request’in en son commit’lerini istediğinizde pull yapın.
- **Zaten üzerinde olduğunuz dal** bunun yerine *geçerli* olarak işaretlenir.
  Hiçbir şey checkout edilmez.
- Her adın yanındaki **kopyala düğmesi** onu panoya koyar.

Başlıkta aynı iki hareket düğme olarak vardır: **Kaynak dala git** ve **Hedef
dala git**. Zaten üzerinde olduğunuz dalda da çalışırlar — sizi yalnızca depoya
götürürler.

Siz tıklayana kadar hiçbir şeye bakılmaz: bir pull request’i açmak hiçbir dalı
okumaz ya da fetch etmez.

Yapmadıkları:

- **Bir fork’un kaynak dalı** başka bir depodadır, bu yüzden bağlantısı yoktur
  (kopyala düğmesi kalır). Hemen altında sunulan **Pull request’i yerelde
  önizle…**, onu burada çalıştırmanın yoludur. Hedef dal yine bağlantıdır.
- **Eşleşen remote yok.** Dal, URL’si pull request’in deposu olan remote’ta
  aranır. Yapılandırılmış hiçbir remote oraya işaret etmiyorsa bağlantı bir şey
  yapmaz ve ipucu nedenini söyler.
- **Silinmiş bir dal.** Birleştirilmiş bir pull request çoğu zaman dalını da
  götürmüştür; fetch bu durumda dalın remote’ta artık olmadığını söyler ve pull
  request’te kalırsınız.
- **Yerel değişiklikler.** Checkout yıkıcı değildir, bu yüzden onay yoktur — ve
  commit edilmemiş değişikliklerinizin üzerine yazılacaksa git checkout’u
  reddeder. Hata hangi dosyalar olduğunu söyler; onları commit edin ya da stash’e
  koyun ve yeniden tıklayın.
- **Bu pencere.** Checkout bu deponun çalışma ağacında gerçekleşir. Dal zaten
  başka bir [çalışma ağacında](worktrees.md) checkout edilmişse, bunun yerine o
  çalışma ağacının sekmesi açılır.

## Sınırlar

- **Açık pull request’ler kenar çubuğunun listesidir.** GitHub, GitLab ve
  bitbucket.org ilk 30’u okur; daha fazlası olan bir depo yalnızca bunları
  gösterir ve Açık sayısı **30+** olur. Azure DevOps, Bitbucket Data Center ve
  Forgejo hepsini okur.
- **Birleştirilen ve kapalı olanlar sınırlıdır**, sunucuda daha fazlası olduğunda
  sekme **+** gösterir (sunucunun web sitesi hepsini listeler):

  | Sunucu | Ne okunur |
  |---|---|
  | GitHub, bitbucket.org, Forgejo | En son güncellenen 100 tane, birleştirilen ve kapalı **birlikte** |
  | GitLab | Her birinden en son güncellenen 100 tane |
  | Bitbucket Data Center | Sunucunun *newest* sırasına göre her birinden 100 — API’si bunun açılma mı güncellenme mi olduğunu söylemez |
  | Azure DevOps | **Son bir yılda** sonuçlananlar arasından her birinden 100; API’si bir sıra belirtmez, bu yüzden yüzün ötesinde hangilerinin geleceğini sunucu seçer |

  Kontrolleri okunmaz — bitmiş bir pull request’in CI’ı hiçbir şeye karar
  vermez ve satır başına bir istek maliyeti olurdu — bu yüzden **CI başarısız** bu
  sekmelerde uygulanmaz (çipi orada gizlidir).
- **Hesap yok**: sunucuya ulaşan bir token olmadan Birleştirilen ve Kapalı boş
  bir liste göstermek yerine bunu söyler (GitHub yine de herkese açık bir depoyu
  okuyabilir).
- **Kontroller**: GitHub ve Bitbucket Data Center bunları listede taşır. GitLab,
  Azure DevOps ve Forgejo’ya sayfa açıldığında head başına bir kez, grafiğin CI
  rozetleriyle aynı önbellek üzerinden sorulur. bitbucket.org’da yoktur.
- **İnceleyenler**: GitHub, GitLab, Forgejo, Bitbucket Data Center ve Azure
  DevOps kimden hâlâ istendiğini belirtir (Azure: oy vermemiş bir kişi; ekipler
  dışarıda kalır). bitbucket.org’un listesi bunu söylemez, bu yüzden orada
  İnceleyen filtresi boştur.
- **Açıklamada arama**, sunucunun listesinin açıklamayı taşıdığı yerde çalışır;
  bitbucket.org onu atlayabilir, o zaman yalnızca başlıklar, dallar ve numaralar
  aranır.
- **bitbucket.org ve Azure DevOps’ta “Ben”** görünen ada göre eşleştirilir,
  çünkü listeleri yazarı böyle adlandırır.
- **Azure DevOps’ta Güncellendi**, pull request’in açıldığı (ya da kapandığı)
  zamandır: listesinde son etkinlik zamanı yoktur.
- Gezinme uygulama çalıştığı sürece hatırlanır; yeniden başlatmadan sonra
  listeden açılan bir pull request bunun yerine açık pull request’lerde ilerler.
