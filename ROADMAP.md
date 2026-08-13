# TrainLog — Yol Haritası

## Roller (D50)

- **Sahip (metha):** push mührü; her sprint sonunda cihaz kontrol listesini (KL-C)
  gerçek iPhone'da koşar; karar onayının son mercii.
- **Mimar (ayrı sohbet):** sprint diff incelemesi, karar önerilerinin
  değerlendirilmesi, sürüklenme denetimi (gizli bağımlılık, katman ihlali).
- **Geliştirici (Claude Code):** uygulama; CLAUDE.md'ye tabidir.
- **Tester (opsiyonel, ikinci model):** KL-C'yi bağımsız yorumlar, diff'e düşman
  gözüyle bakar (özellikle domain testlerinin şartnameyi gerçekten kapsayıp
  kapsamadığı). Sahibin yükünü azaltır, mührünü devralmaz.

## İlk kurulum (Sahip — manuel, bir kez)

1. GitHub'da `hasandemirr/TrainLog` public deposunu oluştur.
2. Bu beş dosyayı (`DECISIONS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CLAUDE.md`,
   `.gitignore`) klasöre koy; ilk commit + push.
3. Repo Settings → Pages → Source: **GitHub Actions** olarak işaretle
   (workflow dosyasını S0'da Claude Code yazacak).
4. Node LTS (≥20) kurulu olduğunu doğrula; Claude Code'u klasörde başlat.

## Sprint kapısı (her sprint için aynı altı madde)

1. `npm run typecheck` + `npm test` yeşil; domain testleri sprintin şartnamesini kapsıyor.
2. `npm run build` + Playwright dumanı yeşil; bütçeler aşılmamış (D35).
3. GitHub Pages önizlemesi dağıtılmış.
4. **KL-C** ilgili kalemleri gerçek cihazda geçmiş (aşağıda).
5. Mimar incelemesi tamam; varsa karar önerileri karara bağlanmış.
6. DECISIONS.md güncel; sahip mührü (push) atılmış.

## KL-C — Cihaz kontrol listesi (otomasyonun kör noktaları)

- [ ] Ana ekrana kurulum: ikon, tam ekran, safe-area doğru
- [ ] Uçak modunda açılış (çevrimdışı kabuk)
- [ ] Kurulu modda persist durumu "açık" görünüyor
- [ ] Set girişinde klavye/alt bar davranışı kabul edilebilir
- [ ] Dışa aktarma → paylaşım sayfası → Dosyalara Kaydet çalışıyor
- [ ] "Yedekten yükle" birleştirmeli geri yükleme çalışıyor
- [ ] Sayaç: kilitle → aç → kalan süre doğru; bitişte görsel uyarı
- [ ] Yeni dağıtımda güncelleme çubuğu görünüyor; yenileme veri kaybettirmiyor
- [ ] Safari sekmesi ↔ kurulu uygulama bölme ayrımı ilk-açılış yoluyla aşılabiliyor

## Sprintler

### S0 — Yürüyen iskelet
**Kapsam:** Vite+TS+Preact iskeleti, klasör ağacı, hash router (D40), boş dört sekme,
SW ön-önbellek + güncelleme çubuğu (D41), StoragePort + local adaptör, persist
kontrolü (D25), Pages dağıtım workflow'u.
**Kapı odağı:** KL-C 1-3, 8. İskelet iPhone'a kurulu ve çevrimdışı açılıyor.
*Gerekçe: dağıtım/SW/persist zinciri en riskli bilinmeyenler — ilk gün çözülür.*

### S1 — Domain çekirdeği
**Kapsam:** `types`, `ids`, `progression` (hacim, artır/beklet ipucu, düşüş),
`merge` (idempotenlik + sıra bağımsızlığı testleriyle), `migrate` v1→v2,
`validate`; sentetik fixture'lar; vitest paketi.
**Kapı odağı:** madde 1. Ek şart: v1 göçü sahibin **gerçek prototip verisiyle
yerelde** (`local-data/`, D49) doğrulanır — depoya sentetik türevi girer.

### S2 — Kayıt döngüsü (F1.1-F1.6)
**Kapsam:** önerilen gün kartı (D44), seansın ilk kayıtla doğması (D17), hareket
kartı (hedef, geçen seans, "geçeni al"), iri sayısal set girişi + set ekle, hedef
bandı + ilerleme ipucu + düşüş uyarısı, RIR/not. Tohum ekimi (D39, v1).
**Kapı odağı:** KL-C 4. Gerçek bir antrenman uçtan uca cihazda kaydedilebiliyor.

### S3 — Antrenman tamamlama + ilk açılış (F1.7-F1.11, F0)
**Kapsam:** dinlenme sayacı (D42-43), Wake Lock anahtarı, ikame + yerinde yeni
hareket (D47), serbest yuva + `#2` telafi seansı, "Bitir" + özet + otomatik kapanış
(D46); ilk açılış: "Yedekten yükle" (D27), kurulum yönlendirmesi, yedek
dışa/içe aktarma zinciri (paylaşım → indirme → metin).
**Kapı odağı:** KL-C 5-7, 9. Salon simülasyonu ikame dahil uçtan uca.

### S4 — İlerleme (F2)
**Kapsam:** hareket bazlı kg/hacim eğrisi + seans listesi, takvim ay görünümü +
gün özeti (D46'nın türetilmiş özeti), genel istatistikler, ölçüm segmenti
(giriş + geçmiş + eğilim).
**Kapı odağı:** grafikler fixture'a karşı doğrulanır; takvim özeti kayıtlarla tutarlı.

### S5 — Program yönetimi (F3)
**Kapsam:** aktif program görünümü, düzenleme → yeni sürüm + işaretçi ilerletme
(D15), yeni program + koşu başlatma, hareket kataloğu (oluştur/düzenle/arşivle).
**Kapı odağı:** domain testi kanıtlar: koşu ortası düzenleme geçmiş seansların
hedeflerini değiştirmiyor.

### S6 — Ayarlar + yayın cilası (F4)
**Kapsam:** yedek yaşı + 21 gün hatırlatması (D29), CSV dışa aktarma (D28),
kişisel bilgiler (asgari), kullanım kılavuzu, "tüm verileri sil" (çift onay),
erişilebilirlik/bütçe son geçişi.
**Kapı odağı:** KL-C tamamı + bütçeler → **1.0 mührü**.

## Sprint sonrası (tetikli, planlanmamış)

Hareket görselleri içeriği (D30), senkron adaptörü (D11), IndexedDB (D23),
pasif ikame önerisi (D47). Tetik gerçekleşmeden açılmaz.
