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

Ayarlar sayfalarını ikiye ayırır. **Bu profil**, profille birlikte değişen
sayfaları tutar — **Profil** ve **Entegrasyonlar**. **Uygulama** geri kalan her
şeyi tutar; bunlar her profilde geçerlidir ve sayfanın başında bunu söyler.

İki profil sayfası bir çubukla açılır: *Düzenlenen profil* ve bir seçici. Seçici
hangi profili **düzenlediğinizi** belirler; uygulamanın **kullandığı** profili
değiştirmez. İkisi farklı olduğunda kehribar renkli bir şerit bunu söyler —
*İş profilini düzenliyorsunuz. Uygulama Kişisel profilini kullanıyor* — ve geçiş
için **Bu profili kullan** sunar. Bir hesabın en kolay yanlış profile bağlandığı
an budur; bu yüzden Entegrasyonlar sayfası da her kartta ve düğmenin kendisinde
profilin adını verir: **İş profiline bağla**, onay da bunu tekrarlar. Yeni ve
silme aynı çubuktadır; silmeden önce sorar.

![Uygulama başka bir profili kullanırken Work profilini düzenlemek: kehribar şerit ve Work adını taşıyan bağlama düğmesi](../../screenshots/settings-profile-band.webp)

## Yapay zekâ ortaktır

Bir profilin kendi yapay zekâsına ihtiyacı yoktur: tek bir
[genel yapay zekâ](ai.md#her-profil-için-tek-yapay-zekâ) her profile hizmet eder
ve bir profil yalnızca gerektiğinde kendi yapay zekâsına geçer. Bir profilin her
zaman koruduğu şey, yapay zekânın onun için nasıl yazdığıdır — commit stili, özel
talimatlar ve *Yapay zekânın yazım tercihleri* bölümünün geri kalanı.

## Her profilin kendi hesapları

Bir profil, belirtecin yanı sıra makinede zaten bulunan bir oturumu — git'in
credential helper'ından ya da GitHub CLI'dan — Ayarlar → Entegrasyonlar'da
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
