---
title: Başlarken
category: Buradan başlayın
order: 1
summary: Bir depo açın, grafiği okuyun, ilk commit'inizi alın.
keywords: giriş ilk adımlar açma klonlama sekmeler grafik commit intro open clone tabs graph
source: 173f891f9f1c5c53ea40cf344baf821e3188344d
---

# Başlarken

Gitcito bir klasörü açar ve size geçmişini gösterir. Siz istemedikçe deponuza
hiçbir şey yazılmaz.

![Henüz hiç commit'i olmayan, yeni açılmış bir depo](../../screenshots/empty-repo.webp)

## Bir depo açın

![Depo aç: açın, klonlayın ya da oluşturun; altında taranan ve son açılan depolar](../../screenshots/open-repository.webp)

- **Bir klasörü sürükleyip** pencereye bırakın ya da karşılama ekranındaki
  **Depo aç** düğmesini kullanın. Seçici aynı anda birkaç klasör alır: ⌘-tık
  ya da Shift-tık ile seçin; her biri kendi sekmesinde açılır (ya da seçiciyi
  açtığınız gruba katılır). Birden çok klasörlük bir seçimde zaten açık olan bir
  depo ya da Git deposu olmayan bir klasör atlanır ve bir mesajda adıyla
  belirtilir, böylece diğerleri yine de açılır. macOS seçicisi açık depoları
  önceden soluklaştıramaz: Electron panelin klasör başına kancasını sunmaz, bu
  yüzden denetim Aç'a tıkladıktan sonra yapılır.
- **Taranan depolar**, üç düğmenin altında, Gitcito'ya taramasını söylediğiniz
  klasörlerdeki her depoyu listeler — birkaçını işaretleyip hepsini birden açın
  ya da birine çift tıklayın. Bu klasörleri eklediğiniz ya da kaldırdığınız yer
  de burasıdır. Bkz. [Depolar](repositories.md#taranan-depolar).
- **Yanlışına mı tıkladınız?** Depo aç'tan açılan Klonla, Oluştur, Grup oluştur
  ve Taranan depolar pencerelerinin başlığının yanında oraya geri dönen bir
  **Geri** oku vardır.
- Bir URL'den veya doğrudan barındırıcınızdan **klonlayın** — devasa bir depoyu
  hızlıca klonlamayı sağlayan seçenekler için [klonlama](cloning.md) sayfasına
  bakın.
- Terminalden `gitcito .` komutu, çalışan uygulamada geçerli klasörü açar —
  bkz. [komut satırı](cli.md).
- Henüz Git deposu olmayan tek bir klasör de açılır; Gitcito onu başlatmayı
  önerir.

## Üç panel

| Panel | Neler var |
|---|---|
| Sol | Dallar, uzak depolar, etiketler, stash'ler, çalışma ağaçları — ve çalışma dizini için **Dosyalar** sekmesi |
| Orta | Commit grafiği ve grafikten seçtiğiniz her şey |
| Sağ | Commit besteci paneli ya da seçili commit'in ayrıntıları |

## Geri kalan her şeyi bulmak

İki yol var ve ikisi de aynı yerlere çıkıyor:

- **`⌘K`** (`Ctrl+K`) — komut paleti. Ne istediğinizi yazın; dallara,
  commit'lere ve dosyalara da atlar.
- Araç çubuğundaki **Araçlar** — aynı depo kapsamlı küme, bu kez menü olarak;
  okunabilir kalsın diye uzun kuyruk gruplara katlanmış durumda.

![Araçlar menüsü: önce sık kullanılan araçlar, gerisi gruplanmış](../../screenshots/tools-menu.webp)

Pencere daraldığında eylem çubuğu yer için yarışmayı bırakır: artık sığmayan düğmeler, çubuktaki sırayla ve kendi alt menüleriyle birlikte sonundaki **Daha** menüsüne katlanır. Pencereyi genişletin, geri çıkarlar.

Birinden ulaşılabilen her şeye diğerinden de ulaşılır; yani yalnızca uzman
kullanıcıların bulabildiği hiçbir şey yok.

## İlk commit'iniz

1. Bir dosyayı düzenleyin. **Hazırlanmamış** başlığı altında görünecektir.
2. Hazırlayın — dosyanın tamamını, tek bir hunk'ı ya da
   [tek tek satırları](staging.md).
3. Bir mesaj yazıp **Commit**'e basın.

Gitcito'daki diğer her şey isteğe bağlıdır.

