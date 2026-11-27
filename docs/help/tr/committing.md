---
title: Commit almak
category: Değişikliklerle çalışma
order: 31
summary: Mesaj biçemleri, şablonlar, ortak yazarlar ve linter.
keywords: commit mesaj besteci conventional gitmoji ticket amend şablon ortak yazar linter template co-author geri al sıfırla undo reset generate with ai cancel undo
---

# Commit almak

## Mesaj biçemleri

**Ayarlar → Yapay zekâ → Commit mesajları** içinden ya da doğrudan besteci
panelinden birini seçin; besteci paneli ona uyum sağlar. Biçem, profilin
kullandığı yapay zekâya aittir — genel olana ya da profilin kendisininkine.

| Biçem | Nasıl görünür |
|---|---|
| **Conventional** | `feat(api)!: add rate limiting` — tür açılır listesiyle |
| **Gitmoji** | `✨ add rate limiting` — emoji seçiciyle |
| **Gitmoji + Conventional** | `✨ feat(api): add rate limiting` — emoji seçici *ve* tür listesi |
| **Ticket** | `ABC-123: add rate limiting` — dal adından türetilir |
| **Düz** · **Otomatik** | Ne yazarsanız o; Otomatik'te biçime yapay zekâ karar verir |
| **Mağara adamı** · **Haiku** | Tam olarak kulağa geldikleri gibi |

![Bir commit şablonundan önceden doldurulmuş besteci paneli](../../screenshots/commit-template.webp)

### Gitmoji

[Gitmoji](https://gitmoji.dev), geçmişin bir bakışta okunabilmesi için konunun
önüne bir emoji koyar: 🐛 düzeltmeler, ✨ özellikler, 🔥 kaldırmalar. İki gitmoji
biçeminde de emoji düğmesi konu alanının hemen yanındadır. **75 resmî gitmojinin
tamamını** açar; emojiye, `:koda:` (gitmoji-cli kullananların yazdığı) ya da
kendi dilinizdeki anlamına göre aranabilir.

**Gitmoji + Conventional**, türü ve emojiyi uyumlu tutar. Bir tür seçin, emojisi
de gelsin; türü değiştirin, emoji de değişsin — emojiyi kendiniz seçmediyseniz
(örneğin bir `fix` için 🚑️). Elle seçilen emoji asla üzerine yazılmaz.

| Tür | Emoji | Tür | Emoji |
|---|---|---|---|
| `feat` | ✨ | `test` | ✅ |
| `fix` | 🐛 | `build` | 📦️ |
| `docs` | 📝 | `ci` | 👷 |
| `style` | 🎨 | `chore` | 🔧 |
| `refactor` | ♻️ | `revert` | ⏪️ |
| `perf` | ⚡️ | | |

Yapay zekâ da aynı biçimde yazar. Bir model emojiyi unutursa ya da
`:shortcode:` ile yanıt verirse, konu alana ulaşmadan düzeltilir.

Başka araçların `:sparkles: add login` olarak yazdığı commit'ler grafikte,
commit ayrıntılarında ve geçmiş görünümlerinde `✨ add login` olarak
**gösterilir**.

Sınırlar:

- Seçici her zaman **unicode** emojiyi yazar, asla `:shortcode:` yazmaz.
- Shortcode'lar yalnızca görüntülemede dönüştürülür. Commit'in kendisi yeniden
  yazılmaz ve geçmişte arama, metni commit edildiği hâliyle eşleştirir.
- Yalnızca gitmojiler sayılır: başka bir emojiyle başlayan konu olduğu gibi kalır.
- `commit-msg` hook'u commitlint'i standart Conventional ön ayarıyla çalıştıran
  bir depo, baştaki emojiyi reddeder. Bu GitHuttBr'nun değil, hook'un kuralıdır:
  commitlint'i gitmoji için yapılandırın ya da orada saf Conventional kullanın.

## Mesajı yapay zekâyla yazmak

Yapay zekâ açıkken **Yapay zekâyla oluştur** açıklamanın altında durur.
Hazırlanmış (staged) diff’i okur ve özeti ile açıklamayı yukarıdaki stilde
yazar. Düğme kimin yanıt vereceğini söyler — *hesap · model*, **Ayarlar →
Yapay zekâ → Görev başına model** altında commit mesajları için seçilen çift —
böylece yavaş bir yerel model ya da pahalı bir model hiç sürpriz olmaz.

- Adın yanındaki **▾** kayıtlı hesaplarınızı, her birinin birkaç modeliyle
  listeler. Seçim **yalnızca o oluşturma için** geçerlidir; Ayarlar değişmez.
- Çalışırken kutu *hesap · model ile oluşturuluyor… 12 sn* ve isteğin kendisini
  durduran **İptal**’i gösterir; yalnızca göstergeyi değil. 30 saniye sonra
  ayrıca başka hazır bir hesabı **Kullan** seçeneği çıkar; aynı oluşturma orada
  çalışır. Uygulama genelindeki *beklenenden uzun sürüyor* uyarısı
  ([Yapay zekâ](ai.md)) yine de görünür.
- Yeni metin eskisinin **yerine geçer** ve eskisi saklanır: bir şerit *hesap ·
  model tarafından 7 sn içinde oluşturuldu* der ve özetinizi ile açıklamanızı
  geri getiren **Geri al** ile **Yeniden oluştur** sunar. Metni düzenlediğiniz
  ya da commit ettiğiniz anda kaybolur.

![Yapay zekâyla oluştur ve hesap menüsü](../../screenshots/commit-ai-generate.webp)

![Hesabın yanında Geri al ve Yeniden oluştur ile oluşturulmuş bir mesaj](../../screenshots/commit-ai-generated.webp)

[Commit düzenleme](commit-edit.md) aynı düğmeye sahiptir; o commit’in kendi
diff’inden çalışır.

Sınırlar:

- Yalnızca hazırlanmış diff gönderilir, çok büyükse kırpılır — hazırlanmamış
  değişiklikler veya başka dosyalar asla.
- Geri al tek adım tutar: art arda ilk oluşturmadan önceki metin. Şerit
  gidince o kopya da gider.
- İptal, sağlayıcının istek için harcadığı token’ları geri getirmez.
- ▾ listesi, henüz anahtarı olmayanlar dahil tüm kayıtlı hesapları gösterir;
  böyle birini seçmek o hesabın kendi hatasıyla başarısız olur.

## Besteci panelinin sizin için yaptıkları

- <kbd>↑</kbd> <kbd>↓</kbd> **son mesajlarınızı** geri çağırır.
- Bir **ortak yazar seçici**, deponun kendi katkıcılarından
  `Co-authored-by:` alt bilgileri ekler.
- `commit.template` / `.gitmessage` mesajı **önceden doldurur**, yorum
  satırları ayıklanmış olarak.
- Bir merge, cherry-pick ya da revert sırasında mesaj, git'in yapacağı gibi
  **önceden doldurulur**.
- Taslaklar depo başına **kalıcıdır**, böylece sekme değiştirmek bir mesajı
  asla kaybettirmez.

## Linter

Canlı, engellemeyen bir denetim: konu satırının uzunluğu (karakter sayacıyla),
sondaki nokta, emir kipinde olmayan ya da küçük harfle başlayan konu, aşırı
geniş gövde satırları. Bunlar ipucudur, kapı değil — commit almanızı
engellemez.

## Amend

Amend, son commit'i hazırlanmış olan neyse onunla yeniden yazar. GitHuttBr size
önce mevcut mesajı gösterir; böylece baştan yazmak yerine düzenlemiş olursunuz.

**Commit’i düzelt…** grafikteki bir satırda HEAD için aynı şeyi yapar: mesajın
tamamını yükler, besteci panelini amend kipine alır ve ona odaklanır. Zaten
push edilmiş bir HEAD yine de düzeltilebilir; ama GitHuttBr, uzak depoyu
güncellemenin bir force push gerektireceği konusunda uyarır.

**Commit’i geri al…** ise push edilmemiş bir HEAD için olan kardeşidir: üst
commit'e mixed reset, çalışma ağacındaki değişiklikler korunur, mesaj besteci
paneline geri gelir. İlk commit'in, dosyaları yok etmek yerine geride doğmamış
bir dal bırakan kendine özgü bir yolu vardır.

**Ayrıca bakınız:** [Hazırlama](staging.md) · [Absorb](absorb.md) · [Changelog üreteci](changelog.md)
