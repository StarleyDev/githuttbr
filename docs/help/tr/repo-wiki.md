---
title: Depo wiki'si (Yapay zekâ)
category: Yapay zekâ
order: 81
summary: Her iddianın bir dosyaya kaynak gösterdiği, üretilmiş bir kod tabanı rehberi.
keywords: wiki belgelendirme dokümantasyon üretilmiş kod tabanı genel bakış bağımlılıklar mimari dışa aktarma docs iptal arka plan klasör docs/wiki klasör seç cancel background folder
---

# Depo wiki'si

Bir depoyu gösterin, kod tabanını anlatan kısa bir wiki yazsın.

## Depo kartı

- **Dil dağılımı**, bayt cinsinden.
- **Teknoloji yığını** — rozet olarak gösterilen framework'ler (Next, Angular,
  Electron, Tailwind, Django…).
- **Bağımlılıklar**, doğrudan manifest dosyalarınızdan okunur (`package.json`,
  `Cargo.toml`, `go.mod`, `pyproject.toml`, `pubspec.yaml`, `Gemfile`…) ve
  mimari rollerine göre gruplanır. İskele niteliğindeki paketler — tip
  tanımları, yükleyiciler, lint eklentileri — önce ayıklanır ve yalnızca projenin
  gerçekten bildirdiği paketler listeye girer.
- **Bir modül bağımlılık grafiği**; kaynak koddan ayrıştırılır (JS/TS, Python,
  Go, Rust, Dart, Ruby, C/C++, PHP) ve deponun kendi dosyalarına karşı çözülür,
  böylece bir paket importu asla sahte bir kenara dönüşmez.

## Yazılan sayfalar

GitHuttBr, deponun izlediği dosyalardan bir avuç sayfa planlar — önce belgeler ve
manifest'ler, ardından en çok değişenler — ve her sayfayı kapsadığı dosyalardan
yazar.

**Her ifade, geldiği dosyaya kaynak gösterir**; hiçbir dosyanın desteklemediği
bir iddia yayımlanmak yerine reddedilir. Sayfalar paralel yazılır ve tek seferde
kaydedilir, böylece başarısız bir çalıştırma iyi bir wiki'nin üzerine asla
yazmaz. Wiki daha eski bir commit'te yazılmışsa bunu size söyler.

## Arka planda oluşturma

Bir wiki yazmak biraz zaman alır — sayfa başına bir model çağrısı. Çalıştırma
sayfaya değil uygulamaya aittir: wiki'den başka bir sekmeye ya da depoya geçin,
devam eder. Geri döndüğünüzde sayfa nerede olduğunu gösterir (*Sayfalar
planlanıyor…*, ardından hazır oldukça her sayfa) ve **Wiki oluştur** devre dışı
kalır, böylece ikinci bir tıklama ikinci, rakip bir çalıştırma başlatamaz. *Wiki
oluşturuldu* bildirimi nerede olursanız olun gelir.

**İptal** onu durdurur. Hiçbir şey kaybolmaz: önceki wiki ancak her sayfa
yazıldığında değiştirilir, bu yüzden iptal edilen bir çalıştırma onu tam olduğu
gibi bırakır. İptal, sürmekte olan isteği sonlandırır — HTTP çağrısını ya da bir
CLI hesabı için CLI sürecini — ama sağlayıcı zaten ürettiği token'ları yine de
faturalandırabilir.

Pencereyi kapatmak, o pencerenin başlattığı çalıştırmayı iptal eder.

## Dışa aktarma

**Dışa aktar**, her şeyi `docs/wiki/` altına birbirine bağlı Markdown olarak
yazar — yani commit'lenebilir, bir PR'da incelenebilir ve barındırıcınızda
okunabilir. İpucu, yazacağı klasörün adını verir.

Yanındaki klasör simgesi bu depo için **başka bir klasör** seçer — kök (orada
dışa aktarımın `README.md` dosyası projenin kendi dosyasının yerini alırdı) ve
`.git` dışında, depodaki herhangi bir klasör. `docs/wiki` klasörünü yeniden
seçmek varsayılana döndürür.

### Depoda zaten bulunan bir wiki

Bu makinenin depo için kendine ait bir wiki'si olmadığında — wiki bir ekip
arkadaşının makinesinde ya da yeniden kurulumdan önce oluşturulduysa — sayfa
bunun yerine wiki klasöründekini okur ve bunu belirtir. Wiki, içine damgalanan
commit'e göre değerlendirilir: o commit'te güncel, sonrasında geride.

Klasörden okunan bir wiki'de olamayacaklar: onu yazan model ve bu sürüm
teknoloji yığınını ve sayfa türlerini içine damgalamadan önce yapılmış bir dışa
aktarımdan gelen bu bilgiler — bu sayfalar yığın kartı olmadan düz modüller
olarak görünür. Elle düzenlenmiş bir sayfa düzenlenmiş olarak görünür, ama
**Kaynaklar** listesinde yalnızca hâlâ dışa aktarımın yazdığı biçimde duran
satırlar kalır. **Yeniden oluştur** bu makinede saklanan yeni bir wiki yazar ve
bundan sonra o önceliklidir.

Klasörden okunan bir wiki'de **Sil**, onu depodan siler, bu yüzden önce sorar.
Yalnızca dışa aktarımın yazdığı dosyaları kaldırır — bu dosyalar onun *Generated
by* notunu taşır — ve klasördeki diğer her şeyi bırakır. Commit'lenmiş dosyalar
git ile geri gelir; commit'lenmemiş olanlar gelmez.

Gizli bilgi taşıyor gibi görünen dosyalar hiçbir zaman gönderilmez.

**Ayrıca bakınız:** [Yapay zekâ özellikleri](ai.md)
