---
title: İlk çalıştırma
category: Buradan başlayın
order: 2
summary: İlk açılıştaki kurulum sihirbazı — Git kimliği, barındırma hesapları, yapay zekâ, görünüm — ve her adımın kaydettikleri.
keywords: onboarding ilk çalıştırma ilk açılış kurulum sihirbazı hoş geldiniz ayarları içe aktar git kimliği hesaplar yapay zekâ abonelik api anahtarı ollama lm studio claude code codex atla first run
source: 5b5992d94b164ac6b9b101283ec044ba376b88de
---

# İlk çalıştırma

GitHuttBr ilk açıldığında kısa bir sihirbaz, ilk commit’ten itibaren davranışını değiştiren birkaç şeyi sorar: Git’te kim olduğunuz, depolarınızın nerede barındırıldığı, yapay zekâ kullanıp kullanmayacağınız ve görünüm. Her adım boş bırakılabilir; ayarladığı her şey daha sonra **Ayarlar**’dan değiştirilebilir.

![Yapay zekâ adımı: bu bilgisayarda bulunan ve test edilen bir abonelik CLI’ı](../../screenshots/onboarding-ai.webp)

## Hoş geldiniz ekranı

Adımlardan önce hoş geldiniz ekranı, başka bir bilgisayardan **ayar dosyası içe aktarmayı** önerir. Anahtar ve token içeren bir dosyadan bunlar, saklamak için kutuyu işaretlemezseniz çıkarılır; parola korumalı bir dışa aktarım parolayı orada ister. İçe aktarma dosyayı uygular ve sihirbazı kapatır — dışa aktarımın içeriği için [Güvenlik ve sırlar](security.md) sayfasına bakın.

## Adımlar

Sol sütun adımları listeler. Yeşil onay doldurduğunuz adımı, çizgi doldurmadan geçtiğiniz adımı, vurgulu satır ise bulunduğunuz yeri gösterir.

| Adım | Ne ayarlar | Sonra nereden değişir |
|---|---|---|
| Git kimliği | Profil adı ile commit’lerinizdeki ad ve e-posta | Ayarlar → Profil ve kimlik |
| Hesaplar | GitHub, GitLab, Azure DevOps, Bitbucket, Forgejo ve kendi sunucularınız için tokenlar, ve **Birlikte aç…** uygulaması | Ayarlar → Bağlı hesaplar; uygulama Ayarlar → Git ve eşitleme’de |
| Yapay zekâ | Kullanıma alınmış bir yapay zekâ hesabı | Ayarlar → Yapay zekâ |
| Görünüm | Tema ve açık, koyu ya da otomatik mod | Ayarlar → Temalar |
| Bitti | Yeni bir şey yok — kurulanların özeti | — |

**Şimdilik atla** sihirbazı her adımda kapatır ve girdiklerinizi korur.

## Yapay zekâ adımı

Yapay zekâ isteğe bağlıdır. Üç karttan birini ya da **Atla, yapay zekâ yok** seçeneğini seçin:

| Kart | Ne kullanır | Ne gerekir |
|---|---|---|
| Aboneliğim | Planınızla oturum açılmış Claude Code veya Codex | Kurulu ve oturum açılmış CLI |
| API anahtarı | OpenAI, Anthropic, Gemini, Groq, OpenRouter veya Mistral | Sağlayıcıdan bir anahtar |
| Bilgisayarımda | Yerelde çalışan Ollama veya LM Studio — hiçbir şey makineden çıkmaz | Başlatılmış sunucu |

Bu bilgisayarda Claude Code veya Codex bulunduğunda abonelik kartı hangisi olduğunu ve sürümünü söyler; kartı seçmek onu test eder: kısa bir istem, ardından **Test edildi: N sn içinde yanıt verdi. Kullanıma hazır.** Hiçbiri bulunamazsa ya da CLI’da oturum açık değilse kart, [Ayarlar → Yapay zekâ](ai.md) ile aynı bağlantı kurulumunu gösterir.

API anahtarı veya yerel sunucu için **Devam**, sağlayıcının modellerini listeleyerek bağlantıyı test eder ve yalnızca yanıt veren hesabı kaydeder.

Adımın kaydettiği, Ayarlar’ın yazdığı şekilde yazılmış ve **Kullanımda** yapılmış sıradan bir yapay zekâ hesabıdır: Ayarlar → Yapay zekâ’yı açın, orada; yeniden adlandırmaya, yalnızca bazı özelliklerde kullanmaya veya silmeye hazır. Birden çok hesap, özellik başına model ve yapay zekânın yazış biçimi sihirbazda değil, orada ayarlanır.

## Sınırlar

- **Abonelik testi bir isteme mal olur.** Her istek gibi planınızdan sayılır. Yalnızca kartı seçtiğinizde ya da **Yeniden test et**’e bastığınızda çalışır.
- **Yalnızca Claude Code ve Codex algılanır.** Gemini CLI ve Devin, Ayarlar → Yapay zekâ’dan eklediğiniz sıradan CLI hesapları olarak yanıt verir.
- **Yerel sunucu zaten çalışıyor olmalı.** Sihirbaz Ollama’yı veya LM Studio’yu başlatmaz, model indirmez.
- **Sihirbaz bir kez çalışır.** Kapandıktan sonra ayarladığı her şey Ayarlar’da durur; sihirbazı yeniden açmanın yolu yoktur.
