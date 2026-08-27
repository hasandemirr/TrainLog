# TrainLog — Karar Kayıt Defteri

> **Statü:** Bu dosya projenin otoriter karar kaydıdır. Mimari tartışmalarda numarayla
> referans verilir. **Claude Code bu dosyayı düzenlemez**; karar değişikliği önerisi
> `docs/proposals/` altına yazılır, mimar + sahibin onayıyla buraya işlenir.
> Son güncelleme: 2026-08-27.

## A. Platform ve dağıtım

1. Biçim: PWA; Safari → Ana Ekrana Ekle ile kurulum. Native iOS, React Native ve low-code reddedildi (maliyet/dağıtım yükü).
2. Barındırma: statik host, sunucu çalışma zamanı yok. Birincil hedef GitHub Pages; Vite `base:'./'` ile uygulama herhangi bir statik hosta taşınabilir kalmalı.
3. Platform tabanı: iOS Safari 16+ (persist, dosyalı Web Share, ES2020); tasarım varsayımı WebKit. Android ve masaüstü aynı koddan çalışır, bonus.

## B. Mimari desen

4. Dört katman: operasyonel durum → kalıcılık güçlendirme → yedek → opsiyonel uzak hedef.
5. Yerel-öncelikli: otorite cihazdadır; bulut hiçbir senaryoda kanonik değildir.
6. Tek depo + tek yönlü akış: `yükle → göç → indeksle → çiz → aksiyon → kaydet → çiz`. Durum yönetimi kütüphanesi yok (~15 aksiyon; desen yeterli).
7. Port/adaptör: `StoragePort`, `SyncPort`, `BackupPort`. Bağımlılık yönü: `domain` hiçbir şeyi import etmez; `app → domain`; `ui → app+domain`; adaptörler portları uygular; `main.ts` kablolar.
D7 ek (S0 içtihadı): Port imzaları, portu ilk uygulayan sprintte tanımlanır (Sync → D11 tetiği geldiğinde, Backup → S3). Uygulanmamış port için imza uydurulmaz.
8. Türetilmiş veri (indeksler, ipuçları, seans özetleri) asla kalıcılaştırılmaz. UI durumu (sekme, seçili gün) domain durumundan ayrıdır, yedek/birleştirme kapsamına girmez. Medya asla durum nesnesine girmez.

## C. Senkron

9. Firebase iptal; varsayılan adaptör `sync.noop.ts`. Uygulama senkronsuz eksiksizdir.
10. Supabase kalıcı ret: JS istemcisinde yerleşik çevrimdışı katman yok; ücretsiz katman duraklatması; ilişkisel model bu ölçekte fazlalık.
11. Gelecek yolu belgeli: tek belge + `rev` koşullu yazma + kayıt düzeyinde son-yazan-kazanır birleştirme (dejenere Firestore). Yeniden açılma tetiği: gereksinimin "hiçbir şey aktarmayayım, her yerde dursun"a terfisi.
12. `meta.rev` ve `deviceId` şemada şimdiden durur (bedava sigorta). `merge.ts` senkronsuz da yaşar — ikinci müşterisi yedek geri yüklemesidir.

## D. Veri modeli (şema v2)

13. Varlıklar: `exercises`, `programs`, `runs`, `sessions`, `records`, `measures`. Tip iskeleti ARCHITECTURE.md'de.
14. Kararlı kimlikler anahtardır, ad özelliktir. TypeScript'te markalı kimlik tipleri.
15. Program değişmezliği sürümlemeyle: programlar sürüm zinciridir (`familyId` + artan `rev`); koşu "güncel sürüm" işaretçisi taşır; düzenleme yeni sürüm yaratıp işaretçiyi ilerletir; her seans açıldığı andaki somut sürüme referans verir. Geçmiş "o gün hedef neydi" her zaman cevaplanabilir.
16. Hafta takvimden türetilmez; kullanıcının beyan ettiği plan konumudur, seans üstünde durur. Varsayılan öneri döngüden türetilir (Gün N bitince artar), elle düzeltilebilir.
17. Seans kimliği `tarih#sıra` (`2026-08-13#1`); varsayılan `#1`, telafi seansı aynı güne `#2`. Seans tarihi *açıldığı anda* sabitlenir; gece yarısı geçişi kayıtları bölemez.
18. Kayıt anahtarı `sessionId|slotIdx`; `exId` kaydın özelliğidir. Aynı hareket bir seansta birden çok slotta meşrudur; ikame bu mekanizmayla temsil edilir.
19. Katalog (hareketler + programlar) durumun içindedir, dolayısıyla yedek/senkron kapsamındadır. Excel'den gelen program yalnızca ilk açılış tohumudur (`content/seed.ts`).
20. Göç disiplini: `v` alanı zorunlu; saf, test edilmiş `vN→vN+1` zinciri; eski JSON yedekleri içe alınırken aynı zincirden geçer. Prototipin v1 biçimi yalnızca içe alma yolunda tanınır ve dönüştürülür.
D20 ek (S5-S6 içtihadı): Salt-eklemeli isteğe bağlı alanlar (Run.endedAt, AppState.profile) şema sürümünü artırmaz; validate güncellenir, eski veri geçerli kalır. Kırıcı değişiklikler vN→vN+1 zincirini kullanır.
21. Güvenilmeyen sınırlarda (içe alma, ileride senkron) elle yazılmış çalışma zamanı doğrulaması; Zod bağımlılığı alınmaz.
22. Tarihler yerel ISO gün, zaman damgaları epoch ms; virgüllü ondalık girişi kabul edilir; birimler metrik; uygulama dili yalnızca Türkçe, i18n katmanı yok.

## E. Depolama, dayanıklılık, yedek

23. Bugün `localStorage`, `StoragePort` arkasında. IndexedDB'ye geçiş tetiği yalnızca blob/medya ihtiyacıdır.
24. Her aksiyonda senkron kayıt (iOS'un uygulamayı bellekten atmasına karşı).
25. Açılışta `persisted()` kontrolü, gerekirse `persist()` talebi; durum kullanıcıya görünür. Bunlar risk azaltıcıdır, garanti değildir — garanti olmadığı için 3. katman (yedek) vardır.
26. Depo erişilemezse bellek + görünür uyarı ile çalışmaya devam edilir.
27. Yedek: JSON tam sadakatli tek biçimdir. Dışa aktarma zinciri: Share Sheet → indirme → kopyalanabilir metin (iOS standalone `<a download>` kusuru nedeniyle). Geri yükleme ezme değil, birleştirmedir. Kayıt silme = kaydı boşaltıp `updatedAt` ile yerinde bırakma (diriliş problemi kapanır). İlk açılışta veri yoksa kurulum ekranı "Yedekten yükle" sunar (cihaz değişimi + Safari/ana-ekran bölme ayrımının tek kapısı).
28. CSV yalnızca tek yönlü dışa aktarmadır (noktalı virgül + BOM, orijinal Kayıt sayfası düzeni); içe alma biçimi değildir.
29. Yedek yaşı durumda tutulur ve hep görünür. Hatırlatma eşiği 21 gün — ürün politikasıdır; semantiği "21 gündür yedek yok"tur, tahliye tahmini değil.

## F. İçerik ve medya

30. Hareket görselleri uygulama içeriğidir: `public/media/exercises/`, service worker önbelleği; durum, yedek ve senkronun tamamen dışında. Biçim WebP (~50-100 KB) veya SVG; ağır medya günü "baktıkça önbelleğe al".
31. Kullanıcının kendi medyası kapsam dışı; ilke kilitli: asla durum nesnesine girmez.

## G. Araç zinciri ve kalite

32. Vite + TypeScript (strict); npm + Node LTS (≥20).
33. UI: Preact + TSX. React reddedildi (bütçe), vanilla reddedildi (yeniden yapılanma fırsatı).
34. Test: vitest, yalnızca `domain/` hedefli — ilerleme kuralı, göç gidiş-dönüşleri, birleştirme cebiri (idempotenlik, sıra bağımsızlığı) — artı tek Playwright duman testi. UI birim testi yok.
35. Bütçeler: JS paketi gzip ≤ ~150 KB; durum nesnesi < 1 MB (tek-belge senkron tavanıyla hizalı).
36. SW: derleme hash'li app-shell ön-önbelleği; elle sürüm artırma yok. SW sürümü ile şema sürümü bağımsızdır; önbellek temizliği veriye dokunmaz.
37. Klasör yapısı: ARCHITECTURE.md'deki ağaç geçerlidir.
D37 ek (S0 içtihadı): ARCHITECTURE §4 ağacı katmanlama için normatiftir, dosya envanteri için örnekleyicidir. Listeli dizinlere katman kurallarına uyan yeni dosya eklemek öneri gerektirmez; yeni üst-düzey dizin gerektirir.
38. Arka plan yürütme yok (platform sınırı): sayaç ve tüm mantık yalnızca uygulama açıkken çalışır; 42-43 bu sınırın içinde tasarlanmıştır.

## H. Sonradan kilitlenenler

39. Tohum sürümlüdür; yeni sürüm yalnızca yeni girdileri ekler ve `userModified` işaretlenmemiş alanları günceller. Alan-düzeyi birleştirme yapılmaz.
40. Yönlendirme: hash. Disiplin: yalnızca dört üst görünüm `pushState` alır; iç durumlar (gün, hafta, slot) `replaceState` ile yazılır — geri tuşu cehennemi yasak.
41. SW güncelleme akışı: hash'li dosya listesi kendi ~30 satırlık Vite eklentimizle SW'ye gömülür (geri çekilme hattı: yalnızca mimar onayıyla `vite-plugin-pwa`, salt derleme bağımlılığı). Uygulama her ön plana gelişte `registration.update()`. Yeni SW `waiting`a düşünce alt barda "Güncelleme hazır — Yenile" çubuğu; dokununca `skipWaiting` → `controllerchange` → yenile. **Sessiz otomatik yenileme yasak.**
42. Dinlenme sayacı mutlak bitiş zamanıyla (`tEnd`) çalışır ve depoya yazılır: kilit/bellekten atılma sonrası kalan süre doğru gösterilir.
43. Sayaç bitiminde ses yok; uygulama açıkken ekranda belirgin görsel uyarı, kilitliyken dönüşte "dinlenme bitti" durumu.
44. Günler takvime çapalanmaz: program günleri sıralı yuvalardır ("Gün 1", isteğe bağlı etiket: "Pull"). Hafta günü adları UI'da ve tohum veride yer almaz. Önerilen gün = son tamamlanan günün bir sonrası.
45. Alt bar 4 sekme: **Antrenman** (varsayılan), **İlerleme** (ölçüm segmenti içinde), **Program**, **Ayarlar**. Günlük kullanım ilk ikisinde; düzenleme/yönetim son ikisinde saklıdır.
46. Seans bitişi: "Bitir" düğmesi + özet ekranı; unutulursa kendiliğinden kapanış (yeni seans açıldığında ya da uygulama ileri bir tarihte açıldığında). Özet türetilmiş görünümdür (madde 8) — takvimden geçmiş seanslar için de aynı özet açılır.
47. İkame (antrenman sırasında hareket değiştirme) yalnızca o seanslıktır; programa asla dokunmaz. Program değişikliği yalnızca Program sekmesinden, bilinçli yapılır. Pasif "hep T-Bar yapıyorsun, işleyelim mi?" önerisi cila listesindedir, kapsam dışıdır.
48. Depo: `TrainLog`, GitHub'da public. Adlandırma standardı: kod tanımlayıcıları İngilizce, UI metinleri Türkçe, depo belgeleri Türkçe.
49. **Gizlilik (public repo):** gerçek antrenman/ölçüm verisi, gerçek yedek dosyaları depoya asla girmez. Gerçek veri yalnızca yerelde `local-data/` altında yaşar (gitignore'da). Depodaki test fixture'ları sentetiktir; tek istisna, kişisel veri içermediği doğrulanmış anonim yapı örnekleridir.
50. Süreç ve roller: **Sahip** (metha) — push mührü + cihaz kontrol listesi; **Mimar** (ayrı sohbet) — sprint incelemesi, karar onayı; **Geliştirici** (Claude Code) — uygulama; **Tester** (opsiyonel ikinci model) — kapı kontrol listesini bağımsız koşar, diff'e düşman gözüyle bakar. Sprint kapısı altı maddedir (ROADMAP.md); tamamlanmadan sonraki sprint açılmaz.
D50 ek (S0-S6 içtihatları): Sahibin yazdığı, mimar onaylı DECISIONS metnini açık talimatla verbatim ve ayrı commit olarak işlemek geliştirici yasağının ihlali değildir. Kapı raporlarında "hedeflenen" ile "kanıtlanan" ayrılır; push/mühür beyanları origin'den doğrulanır. Sprint sınırı = oturum sınırı. Mimarın peşin kararları ROADMAP kapsamını netleştirir, daraltmaz.

## Bilinçli ertelenenler (tetikleri tanımlı)

- Senkron adaptörü — tetik: "hiçbir şey aktarmayayım" gereksinimi (madde 11).
- IndexedDB adaptörü — tetik: blob/medya ihtiyacı (madde 23).
- Hareket görselleri içeriği — mimari hazır (madde 30), içerik üretimi ayrı iş.
- Kullanıcı medyası — ilke kilitli (madde 31).
- Pasif ikame önerisi — cila (madde 47).
- Çoklu dil — ret değil erteleme (madde 22).
