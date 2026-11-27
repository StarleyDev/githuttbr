---
title: Komuta merkezi
category: Eşitleme ve çoklu depo
order: 51
summary: Çalışma alanındaki her depo tek ekranda, en kötüsü en üstte.
keywords: komuta merkezi kontrol paneli gösterge paneli tüm depolar genel bakış durum kirli push edilmemiş geride çalışma alanı mission control dashboard status dirty unpushed behind workspace son commit son fetch eski stale pull request ci sürüm release etiket tag yenileme aralığı refresh interval
---

# Komuta merkezi

Yirmi depo, ve soru hep aynı: hangisinin bana ihtiyacı var?

Komuta merkezi bunu yanıtlar. **Etkin çalışma alanındaki** her depo tek bir
ekranda, gerçekten sizi bekleyene göre sıralanmış hâlde:

1. **Engellenmiş** — yarım kalmış bir rebase veya merge, çakışmalar, hiç
   okunamayan bir depo.
2. **Eşitlenecek** — önce pull edilecek commit'ler, sonra push edilecekler.
3. **Devam eden** — commit'lenmemiş çalışma, izlenmeyen dosyalar.
4. **Temiz** — sessiz olanlar, en altta, ait oldukları yerde.

![Her depo tek ekranda, en kötüsü en üstte](../../screenshots/mission-control.webp)

## Bir satır size ne anlatır

Her satır soldan sağa okunur ve sütunlar liste boyunca hizalanır; sayılar bir
tablodaki gibi karşılaştırılır:

| Sütun | Ne gösterir |
|---|---|
| **Depo** | Ad, grup, dal ve upstream’i — ya da kehribar renkte **upstream yok**: böyle bir dal yanlışlıkla push’lanmaz ama hiç eşitlenmez de |
| **Son commit** | Konu ve yazar: deponun en son ne yaptığı, açmadan |
| **Yerel** | Çakışmalar · ↓ çekilecek · ↑ push’lanacak · stage’de · değişmiş · izlenmeyen · stash’ler. Neyi saydığını görmek için üzerine gelin |
| **Barındırma** | Açık pull request’ler — **sizin** incelemenizi bekleyenler kehribar renkte — ve HEAD’in CI’ı. O deponun **Pull request’ler** sayfasını açmak için sayıya, çalıştırmalarını açmak için **CI**’a tıklayın |
| **Sürüm** | HEAD’in ulaştığı en yeni etiket ve ondan sonra gelen commit sayısı — hiç yoksa **güncel**. Sayının rengi sürümün ne kadar geride kaldığını gösterir: 5 commit’e kadar gri, 20’ye kadar sarı, ötesi kırmızı; dört aralık, özel renkler dahil, [**Ayarlar → Temalar → Sürüm notu renkleri**](themes.md#sürüm-notu-renkleri) altında değiştirilebilir |
| **Etkinlik** | 14 günlük commit sparkline’ı ve kaç commit olduğu |
| **Zaman** | Son commit’ten ve son **fetch**’ten bu yana geçen süre |

Satırın neden orada olduğunu görmek için durum simgesinin üzerine gelin —
"2 push’lanacak · 1 commit’lenmemiş".

Fetch yaşı orada, çünkü bu sayfayı okumak asla fetch yapmaz: "çekilecek" sayısı en
fazla son fetch kadar tazedir. Upstream’i olan bir dal bir gün veya daha uzun
süredir fetch yapmadıysa, ya da hiç yapmadıysa, yaş kehribar olur — bir 0’a
güvenmeden önce fetch yapın. Zamanı git’in kendisi verir; terminalde bir
`git fetch` de sayılır.

![Ayarlar → Git ve eşitleme: otomatik getirmenin yanında Mission Control yenilemesi](../../screenshots/settings-git-sync.webp)

Dar bir pencerede her sütun kalır ve tablo kendi çerçevesi içinde yana kayar.

Satırın sonundaki **Aç**, deponun kendisini — grafiğini — gösterir; sekmesinde en
son PR sayısının açtığı pull request listesi görünüyor olsa bile.

Bir satırı genişletin (şevron veya <kbd>space</kbd>) ve hangi commit'lerin push
edilmeyi beklediğini, hangi dosyaların kirli olduğunu tam olarak görün.

## Listeyi işlemek

- Üstteki durum rozetleri birer **filtredir** — "3 engellenmiş"e tıklayın,
  yalnızca onları görün. **N açık PR** ve **N CI başarısız** da aynı şekilde
  filtreler, alttaki satırdaki **N PR incelemeni bekliyor** da öyle.
- **Aciliyete**, **ada** veya **etkinliğe** göre sıralayın.
- **Birkaç depoyu işaretleyip** fetch edin ya da yalnızca geride kalanları pull
  edin (düğme sizin için sayar).
- **N eskiyi fetch et**, upstream’i olan dallar bir gün veya daha uzun süredir fetch
  yapmadığında görünür ve yalnızca onları fetch eder — "çekilecek" sayısı yanlış olabilenleri.
- Açık olduğu sürece kendini 30 saniyede bir yeniler — bunu **Ayarlar → Git ve
  eşitleme → Mission Control yenileme** altında değiştirin, en az 30 saniye.
  Sayfa kapalıyken hiçbir şey çalışmaz.

| Tuş | Eylem |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> veya <kbd>j</kbd> <kbd>k</kbd> | Listede gezinin |
| <kbd>Enter</kbd> | O depoyu açın |
| <kbd>f</kbd> / <kbd>p</kbd> | Fetch / pull edin |
| <kbd>space</kbd> | Genişletin |
| <kbd>/</kbd> | Filtreye atlayın |

## Bir sekme değil, bir görünüm

Çalışma alanı adının yanındaki gösterge onu açıp kapatır; herhangi bir sekmeye
tıklamak sizi işinize geri döndürür. Kendine ait bir sekme açmaz ve içinde
bulunduğunuz çalışma alanına aittir — çalışma alanını değiştirin, o çalışma
alanının kontrol panelini alın.

Git tarafı **yereldir**: depo başına birkaç git komutu, fetch yok. Bir
sunucuyla konuşan tek kısım **Barındırma** sütunudur. Her deponun sunucusuna açık
pull request’lerini ve HEAD’in CI’ını o deponun profili olarak ve sessizce sorar:
o profil için token’ı veya bağlantısı olmayan bir sunucu yalnızca hiçbir şey
göstermez ve hiçbir zaman oturum açma penceresi açılmaz. Zaten bir sekmede açık
olan bir depo hiçbir çağrıya mal olmaz, çünkü kenar çubuğunda pull request’leri
zaten vardır.

Sayıların doğru okunması için sınırlar:

- Sunuculara yenileme aralığı ne olursa olsun depo başına **en fazla 5 dakikada
  bir** sorulur (HEAD hareket ettiğinde veya bir CI çalıştırması hâlâ sürüyorsa
  daha erken) — bir sunucunun API kotası uygulamanın geri kalanıyla paylaşılır.
  **Yenile** şimdi yeniden sorar.
- Sunucunun ilk sayfası dolu döndüğünde sayı **30+** gösterir; liste sayfasında
  hepsi vardır.
- Sürüm sütunu, depodaki en yeni etiket değil, **HEAD’den ulaşılabilen** en yeni
  etikettir. HEAD’in zaten sahip olduğu bir commit’e konan etiket iki dakika
  içinde görünür.

Fetch işlemi her zaman sizin istediğiniz bir şeydir.

**Ayrıca bakınız:** [Çalışma alanları ve sekmeler](workspaces.md) · [Çalışma alanları, sekmeler ve gruplar](workspaces.md)
