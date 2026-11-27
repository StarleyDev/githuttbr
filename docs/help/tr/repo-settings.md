---
title: Depo başına ayarlar
category: Çalışma alanı araçları
order: 94
summary: Bir deponun görünen adı, profili, korumalı dalları ve sekme görseli; ayrıca kuralları, kasası ve etkinliği.
keywords: depo ayarları repo settings korumalı dallar protected branches analitik analytics işlem günlüğü operation log geçmiş history bilgi info dişli gear sekme görseli tab image simge logo görünen ad takma ad profil listeden kaldır unut ölçümler proje yapılandırması
source: 6cd23a3db24f4869df7d1b881fb15155bd0a0a8b
---

# Depo başına ayarlar

Araç çubuğundaki araçların yanındaki dişli, uygulamaya değil **bu** depoya ait
ayarları açar.

![Depo başına ayarlar](../../screenshots/repo-settings.webp)

Başlık, değiştirmek üzere olduğunuz depoyu söyler: adı, klasörü, geçerli dal,
barındığı sunucuyla birlikte ana uzak depo (varsa `origin`) ve birkaç sayı. Dal
sayısı zaten yüklenmiş listeden gelir. Kasa sayısı ancak **Kasa**’yı açtıktan
sonra görünür, çünkü kasayı okumak sistem anahtar zincirine sorar ve ayarları
açmak bunu yapmamalı. Commit sayısı yok: uzun bir geçmişi saymak ayrı bir git
çağrısıdır ve bir başlık buna değmez.

Sayfalar yan gezinmede, üç grupta durur:

| Grup | Sayfa | Ne içerir |
|---|---|---|
| Depo | **Genel** | Görünen ad, profil, korumalı dallar, sekme görseli ve Listeden kaldır |
| Depo | **Proje yapılandırması** | Bu deponun `.githuttbr.json` içinde [taşıdığı kurallar](repo-config.md) ve onları denetleyen doctor |
| Depo | **Bilgiler** | Bu depo hakkında serbest notlar ve alanlar, yerelde tutulur |
| Güvenlik | **Kasa** | Bu deponun [kasa](vault.md) girdileri |
| Etkinlik | **Ölçümler** | GitHuttBr içinde yaptıklarınız, yerelde sayılır |
| Etkinlik | **İçgörüler** | [Geçmiş panosu](insights.md) |
| Etkinlik | **İşlem geçmişi** | Açtığınız depolar için zaman içindeki commit’ler ve onları yapanlar |
| Etkinlik | **Kayıtlar** | İşlem günlüğü: GitHuttBr’ın burada çalıştırdığı her git komutu, sonucuyla |

Dürüst olanı işlem günlüğüdür: bir şey tuhaf davrandığında tam komutu ve tam
hatayı gösterir, böylece bir hata raporu sıfat yerine olgu taşıyabilir.

## Genel

Her ayar bir satırdır: solda ne yaptığı, sağda denetimi. **Kaydet**’e basana
kadar hiçbir şey saklanmaz.

| Satır | Ne yapar | Nerede saklanır |
|---|---|---|
| **Görünen ad** | Sekmelerde ve listelerde görünen ad. Diskteki klasör asla yeniden adlandırılmaz; boşsa klasör adı kullanılır | GitHuttBr ayarları, bu bilgisayar |
| **Profil** | Sekmesi etkinken bu deponun geçtiği kimlik, belirteçler ve yapay zekâ. **Otomatik**, etkin profili izler | GitHuttBr ayarları, bu bilgisayar |
| **Korumalı dallar** | Bu dallara doğrudan commit veya force push yapmadan önce uyarır | Deponun git config’i |
| **Sekme görseli** | Sekmede küçük bir resim, aşağıda | GitHuttBr ayarları, bu bilgisayar |

Depoda bir `.githuttbr.json` varsa, Genel’in üstündeki bir bildirim bunu söyler
ve **Proje yapılandırması**’na götürür. O kurallar depoyla birlikte onu
klonlayan herkese gider; bildirimin altındaki satırlar yalnızca sizindir.

**Listeden kaldır…** depoyu [Depolar](repositories.md)’dan çıkarır. Önce sorar
ve soru neyi yapmadığını söyler: diskteki klasöre dokunulmaz, açık bir sekme
açık kalır. Depoyu yeniden açmak onu listeye geri koyar.

## Sekme görseli

On sekme açıkken aynı biçimde başlayan adları — `api`, `api-gateway`,
`api-docs` — ayırt etmek zordur. Sekmedeki küçük bir resim, metinden daha
çabuk bulunur.

**Genel** bölümünde görsel alanına tıklayın. Deponun kendi görsellerini
listeler — PNG, JPEG, GIF, WebP, SVG, ICO, BMP ve AVIF —, her birinin küçük
önizlemesiyle; adı logo ya da simge gibi olan dosyalar önce gelir. Daraltmak
için yazın (`logo dark`, `assets/logo-dark.png` dosyasını bulur), ok
tuşlarıyla gezinin ve seçmek için Enter’a basın; ya da yolu elle yazın. Yol
**depo köküne göre** saklanır, böylece görsel, klasörü nerede olursa olsun
depoyla birlikte gider.

Sekmenin ne gösterdiği uygulama genelinde bir seçimdir: **Ayarlar → Genel →
Depo sekmelerinde gösterilen**:

| Seçenek | Sekme şunu gösterir |
|---|---|
| **Görsel ve ad** (varsayılan) | Klasör simgesi yerine görsel, ardından ad |
| **Yalnızca ad** | Klasör simgesi ve ad, sanki görsel yokmuş gibi |
| **Yalnızca görsel** | Yalnızca görsel; ad ipucuna taşınır |

Bilinmesi gereken sınırlar:

- Liste, git’in gördüğü dosyaları içerir — izlenen ve izlenmeyen, ama yok
  sayılanları değil — ve bir seferde en fazla 40 tane; geri kalanına ulaşmak
  için yazın. Yok sayılan bir görsel yine de elle yazılabilir.
- 1 MB’tan büyük ya da okunamayan görseller soluk görünür ve seçilemez:
  20 piksellik bir simgenin daha fazlasına ihtiyacı yok.
- Görseli **olmayan** bir depo, hangi seçenek seçilirse seçilsin her zaman
  adını gösterir — boş bir sekme tanınamazdı.
- Yol **bozuksa** — dosya silinmiş, yeniden adlandırılmış, görsel değil ya da
  çok büyük —, sekme sessizce ada döner ve bu ayarlar sekmesi yolun altında bir
  uyarı gösterir. Başka hiçbir şey şikâyet etmez.
- Görsel oturum başına bir kez okunur. Dosyayı aynı adla değiştirirseniz,
  yeniden yüklemek için bu ayarlar sekmesini tekrar açın.
- Ayar, bu makinedeki GitHuttBr ayarlarında durur, depoda değil; bu yüzden ekip
  arkadaşlarınıza geçmez.

**Ayrıca bakınız:** [Güvenlik ve sırlar](security.md) · [İçgörüler](insights.md)
