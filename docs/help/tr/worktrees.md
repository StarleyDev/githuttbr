---
title: Çalışma ağaçları ve alt modüller
category: Eşitleme ve çoklu depo
order: 54
summary: Tek bir deponun birden çok checkout'u; ve depoların içindeki depolar.
keywords: çalışma ağacı worktree worktrees alt modül submodule submodules bağlı checkout init sync eşitle
---

# Çalışma ağaçları ve alt modüller

## Çalışma ağaçları

Bir çalışma ağacı, aynı deponun kendi klasöründeki ikinci bir checkout'udur —
böylece `feature/x` bıraktığınız gibi dururken `main`'e bakabilirsiniz, hiç stash
yapmadan.

- Çalışma ağaçlarını kenar çubuğundan oluşturun ve kaldırın. Birine **çift
  tıklamak** onu kendi sekmesinde açar; sağ tık *Worktree'yi aç*, *Klasörde
  göster* ve kaldırmayı verir.
- Herhangi bir yerel dala sağ tıklayın → **Bir çalışma ağacında aç**; kardeş bir
  klasörde bir tane oluşturulur ve sekme olarak açılır.
- Bir dal aynı anda yalnızca bir çalışma ağacında yaşar; başka bir ağacın tuttuğu
  dala geçmek bu yüzden işleyemez — git *already used by worktree at …* diyerek
  reddeder. GitHuttBr bunun yerine sizi oraya götürür: dalın menüsünde *`x` dalına
  worktree'sinde git* yazar ve satıra çift tıklamak, hata vermek yerine o çalışma
  ağacının sekmesini açar.

### Worktree’lerin bakımı

Geçen ay oluşturulan bir worktree kolayca unutulur ve sorular temizlik sırasında gelir: içinde iş var mı? O klasör hâlâ duruyor mu? Her satır, sormanıza gerek kalmadan yanıt verir.

| Satırda | Anlamı |
|---|---|
| **●3** | O worktree’de commit edilmemiş değişikliği olan üç dosya |
| **↑2 ↓1** | Dalı, upstream’inin iki commit önünde ve bir commit gerisinde |
| 🔒 | Kilitli — kilitlerken verilen nedeni görmek için üzerine gelin |
| **eksik**, adı üstü çizili | Klasör yok; git’te yalnızca kaydı kaldı |

![Çalışma ağaçları bölümü: commit’lenmemiş işi ve öndeki commit’leri olan bir
worktree, eksik bir tane, kilitli bir tane ve başlıktaki silgi](../../screenshots/worktree-care.webp)

Sayılar bölüm açıldığında, o worktree’nin commit’i değiştiğinde ve pencere odağı geri aldığında okunur — her yenilemede değil, çünkü her biri başka bir klasörde çalışan bir `git status`’tur.

Bir satıra sağ tıklayarak:

| Eylem | Ne yapar |
|---|---|
| **Worktree’yi kilitle** | Git’in (ve diğer istemcilerin) onu temizlemesini, taşımasını veya kaldırmasını engeller. Bir neden yazın — *harici diskte* — kilidin üzerinde görünür. Her zaman takılı olmayan ortamlardaki worktree’ler için. |
| **Worktree kilidini aç** | Tersi. Geri almak onu aynı nedenle yeniden kilitler. |
| **Worktree’yi taşı…** | Klasörü taşır ve git bağlantılarını iki yönde günceller. Kilitliyken veya bir sekmede açıkken sunulmaz: sekmeler ve düzenleri yola göre hatırlanır, sekme hiçbir yeri göstermez hâle gelirdi. Önce sekmeyi kapatın. Geri almak onu eski yerine taşır. |
| **Worktree’yi kaldır** | Önce git’e neyin kaybolacağını sorar. Temiz bir worktree normal onayı alır ve geri almak onu aynı dalda, aynı klasörde yeniden oluşturur. Commit edilmemiş değişikliği olan ise dosya sayısını belirten ayrı bir onay, *At ve kaldır*, alır — geri alma yoktur. |
| **Taşınan klasörü yeniden bağla…** | Yalnızca *eksik* bir satırda: klasörün nereye gittiğini gösterin (dosya yöneticisiyle taşıdınız), git onu `git worktree repair` ile yeniden bağlar. |
| **Eksik worktree’leri unut** | Bir satır eksik olduğunda bölüm başlığında görünen silgi düğmesi de budur. `git worktree prune` çalıştırır. |

Bu eylemlerin **yapmadıkları**:

- **Bir worktree’yi kaldırmak yok sayılan dosyalarını da siler** — `.env`, `node_modules`, derleme çıktısı. Git bunları değişiklik saymaz; bu yüzden "temiz" onay bile bunu belirtir ve geri alma bunları geri getirmez.
- **Unutmak yalnızca git’teki kaydı siler.** Silinecek dosya yoktur — klasör zaten gitmiştir — ve kilitli worktree’ler atlanır, çünkü takılı olmayan bir diskteki kilitli worktree silinmiş olanla tıpatıp aynı görünür.
- Kilit, git istemcileri arasında bir anlaşmadır, dosya koruması değildir: git dışındaki hiçbir şeyin klasörü silmesini engellemez.
- Ana worktree — deponun kendisi — kilitlenemez, taşınamaz ve kaldırılamaz.
- Bir worktree’yi kaldırmak dalını asla silmez. İşiniz bittiyse dalı dal listesinden silin.

### Başlıkta worktree’leri gruplamak

Worktree sekmeleri `root · branch` etiketleriyle açılır ve bu hızla genişler.

**Bir grupta tutulan proje kendi worktree’lerini içine alır.** Depo — ya da
worktree’lerinden biri — zaten bir gruptaysa, yeni bir worktree hiçbir şey
işaretlemeden o grubun içinde, yanında açılır: worktree ekleme penceresi yalnızca
hangi grup olduğunu söyler ve bir dalın menüsündeki **worktree içinde aç** da
sormadan aynısını yapar. Daha sonra **Son kullanılanlar**’dan ya da bir klasörden
açılan bir worktree de gruba katılır. Ayrı durmasını istiyorsanız çipi gruptan
dışarı sürükleyin.

Kendi sekmesindeki bir depo için worktree ekleme penceresinde **Aynı kök depoyu
paylaşan worktree’leri gruplamayı öner**’i işaretleyin (varsayılan olarak kapalı,
codegraph seçeneği gibi hatırlanır): kök bağımsız bir sekme olarak açıksa bir
**Grup adı** alanı görünür (kökün klasör adıyla önceden doldurulmuş) ve ikisi de
yeni bir gruba girer; ailenin hiçbir üyesi açık değilse yalnızca worktree’nin
kendi sekmesinde açılacağını söyler. Grubun içinde çipler yalnızca son parçaya
(`main`, `feature/x`) kısalır, çünkü hangi depoya ait oldukları zaten grupta
yazar — tam `root · branch` adını tercih ederseniz Ayarlar → Yerleşim ve terminal
altındaki **Gruplarda kısa worktree adları** anahtarı onu korur. Öneri yalnızca
aynı kökü paylaşan worktree’leri birleştirir — ilgisiz depoları asla birleştirmez.

**Worktree sekmesini ayırt etmek.** Bağlı bir worktree bir deponun ikinci
checkout’udur ve sekmesi aksi hâlde deponun kendi sekmesiyle tıpatıp aynı
görünürdü. Bu yüzden bir worktree sekmesi klasör simgesi yerine yeşil bir **çatal**
gösterir — resimli bir sekmede resmin köşesinde küçük bir çatal — ve ipucu,
bulunduğu klasörle birlikte *… deposunun worktree’i* der. Sağ tıklayıp **Ana
depoyu (…) aç**’ı seçin: ana checkout’un zaten açık olduğu sekmeye odaklanır ya da
onu açar — worktree bir gruptaysa o grubun içinde. Worktree nasıl açılmış olursa
olsun çalışır: ailesinden, **Depo aç** ile ya da taranan listeden; bir alt modülün
worktree’leri alt modülü gösterir. Sınırlar: işaret checkout’un nerede durduğuyla
ilgilidir, dalıyla değil; çıplak (bare) bir deponun worktree’leri işaretlenmez,
çünkü açılacak bir ana checkout yoktur; sembolik bağlantılı bir klasör üzerinden
açılmış bir ana depo zaten açık olarak tanınmaz, bu yüzden menü onu gerçek yolu
altında ikinci kez açar.

![Ana deponun sekmesinin yanında yeşil çatal simgeli bir worktree sekmesi, menüsü
Ana depoyu (submodules-worktrees) aç üzerinde açık](../../screenshots/worktree-tab.webp)

![Kenar çubuğunun çalışma ağacı ve alt modül bölümleri, ikisi de dolu](../../screenshots/worktrees.webp)

## Alt modüller

Alt modülleri ekleyin, güncelleyin (init ve checkout), URL'lerini eşitleyin ve
kaldırın; her biri için canlı durum bilgisiyle:

| Durum | Anlamı |
|---|---|
| **Eşitlenmiş** | Üst deponun kaydettiği commit'te checkout edilmiş |
| **Değiştirilmiş** | Başka bir yerde checkout edilmiş ya da kirli |
| **Başlatılmamış** | Kayıtlı, ama hiç checkout edilmemiş |

![Her satırda bir alt modül, durumlarıyla birlikte](../../screenshots/submodule-states.webp)

**Ayrıca bakınız:** [LFS ve sparse-checkout](lfs-sparse.md) · [Fetch, pull ve push](syncing.md)
