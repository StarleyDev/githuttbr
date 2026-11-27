---
title: Profiller
category: Kendinize göre uyarlayın
order: 101
summary: İş ve diğer her şey için ayrı kimlikler ve token'lar.
keywords: profil profiller kimlik git kullanıcı e-posta token hesap geçiş identity
---

# Profiller

Bir profil, bir **Git kimliğini** (ad ve e-posta) kendi **entegrasyon
token'larıyla** bir araya getirir. Profil değiştirdiğinizde ikisi birlikte
değişir — commit'ler doğru kişiye atfedilir ve API çağrıları doğru hesabı
kullanır.

Aynı makinede hem iş hem kişisel depolarla çalışırken ya da iki GitHub hesabınız
olduğunda işe yarar.

![Bir profil: bir yanda git kimliği, diğer yanda entegrasyon token'ları](../../screenshots/settings-profiles.webp)

## Profili düzenlemek, profili kullanmak

Ayarların iki sayfası profille birlikte değişir — **Profil ve kimlik** ve **Bağlı hesaplar**; bunlar, başlığı düzenlenen profilin adını taşıyan **Sen** grubunun en üstündedir. Diğer tüm sayfalar her profilde geçerlidir ve bunu üstte söyler.

**Profil ve kimlik** profil kartıyla açılır: resmi, adı (yerinde düzenlenir), uygulama kullanıyorsa *kullanımda*, seçici ve **Yeni profil**. **Bağlı hesaplar** aynı seçiciyle bir çubukta açılır: *Düzenlenen profil*. Seçici hangi profili **düzenlediğini** belirler; uygulamanın **kullandığını** değiştirmez. İkisi farklı olduğunda kehribar renkli bir şerit bunu söyler ve geçmek için **Bu profili kullan** sunar. Bir hesabın yanlış profile bağlanması en kolay bu anda olur; bu yüzden Bağlı hesaplar profili her kartta ve düğmenin kendisinde de adlandırır, onay da bunu tekrarlar. Profil silmek de aynı yerdedir ve önce sorar.

Kartın altında git kimliği ve commit imzalama gelir. Açık bir depo başkası olarak commit atıyorsa — git yapılandırması başka bir yazar gösteriyorsa — bir satır bunu söyler ve **Kimliği geçerli depoya uygula** sunar; ikisi aynıysa uygulanacak bir şey yoktur ve satır görünmez. Ardından profil resmi, **bağlı hesaplarının** özeti — her sunucu için *Bağlı*, *Token’ın süresi doldu veya hata*, *Ulaşılamadı* ya da *Bağlı değil* ve o sunucuda Bağlı hesaplar sayfasını açan **Bağlan** ya da **Yenile** — ve profilin hangi yapay zekâyı kullandığı gelir.

Özet sessizce, oturum açma penceresi olmadan, sayfa her açıldığında ya da bir token değiştiğinde denetler; asla düzenli aralıklarla sormaz. Bulduğunu kenar menüsü de kullanır: bir token reddedildiğinde ya da denetim başarısız olduğunda **Bağlı hesaplar** küçük bir uyarı sayısı gösterir — yalnızca Ayarların zaten yaptığı denetimler için. Ulaşılamayan bir sunucu sayılmaz; token sağlam olabilir.

![Uygulama başka bir profili kullanırken Work profilini düzenlemek: kehribar şerit ve Work adını taşıyan bağlama düğmesi](../../screenshots/settings-profile-band.webp)

## Yapay zekâ ortaktır

Bir profilin kendi yapay zekâsına ihtiyacı yoktur: tek bir [genel yapay
zekâ](ai.md#her-profil-için-tek-yapay-zekâ) her profile hizmet eder ve bir
profil yalnızca gerektiğinde kendi yapay zekâsına geçer. Bu seçim her şeyi
kapsar: genel yapay zekâdaki bir profil, genel yapay zekâ nasıl ayarlandıysa
öyle yazar — commit stili, commit’ler için ek kurallar, depo sohbeti. Başka bir stile
ihtiyaç duyan profil kendi yapay zekâsını alır: genel olanın, sonradan
değiştirebileceği bir kopyası. Hepsi **Yapay zekâ** sayfasında düzenlenir;
Profil sayfası yalnızca profilin hangi yapay zekâyı kullandığını söyler ve oraya
bağlantı verir.

## Her profilin kendi hesapları

Bir profil, belirtecin yanı sıra makinede zaten bulunan bir oturumu — git'in
credential helper'ından ya da GitHub CLI'dan — Ayarlar → Bağlı hesaplar'da
**bağlayabilir**. Bir bağlantı tek bir profile aittir: yeni bir profil
bağlantısız başlar ve başka bir profilin zaten tuttuğu hesap reddedilir. Böylece
iki profil iki GitHub (ya da Azure DevOps) hesabını yan yana tutabilir. Bkz.
[Barındırma](hosting.md).

## Depo bazında bağlama

Bir depo bir **profile bağlanabilir**; böylece o depodaki arka plan fetch'i her
zaman doğru hesapla kimlik doğrular — siz diğer hesaba ait bir depoya bakarken
bile.

Token'lar [işletim sistemi anahtar zincirinizde](security.md) yaşar, hiçbir
zaman ayarlar dosyasında değil.

**Ayrıca bakınız:** [Güvenlik ve gizli bilgiler](security.md) · [Hosting](hosting.md)
