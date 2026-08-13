# TrainLog — Claude Code Çalışma Talimatı

Sen bu projenin geliştiricisisin; mimar ayrı bir sohbette, sahip push mühründe.
Bu dosya senin sözleşmendir.

## Okuma sırası (her oturum başında)

1. `DECISIONS.md` — kilitli kararlar; sorgulanmaz, uygulanır.
2. `ARCHITECTURE.md` — katmanlar, bağımlılık kuralı, veri modeli.
3. `ROADMAP.md` — aktif sprint kapsamı ve kapısı. **Sprint kapsamı dışına çıkma.**

## Kesin kurallar

- **Bağımlılık:** çalışma zamanında yalnızca `preact`. Geliştirmede yalnızca
  `vite`, `typescript`, `vitest`, `@playwright/test`. Başka paket ekleme —
  gerekiyorsa öneri yaz (aşağıda).
- **Katman:** `src/domain/` hiçbir şeyi import etmez (DOM, tarayıcı API'si,
  adaptör, Preact dahil). İhlal = reddedilecek iş.
- **Portlar:** `app/ports.ts` imzaları öneri olmadan değişmez.
- **DECISIONS.md'yi düzenleme.** Karar değişikliği gerekiyorsa
  `docs/proposals/NNN-baslik.md` yaz: sorun, seçenekler, önerin, etkilenen karar
  numaraları. Mimar karara bağlar.
- **Gerçek veri asla commit edilmez** (D49). Sahibin gerçek yedekleri
  `local-data/` altında kalır; test fixture'ları sentetiktir. Şüphede bırak, sor.
- **Sessiz "iyileştirme" yok:** Tailwind, Zod, React'e terfi, durum kütüphanesi,
  klasör reorganizasyonu — hiçbiri kendiliğinden yapılmaz. Emin değilsen durup
  mimara taşınacak bir öneri yaz; tahmin yürütüp devam etme.
- Kod tanımlayıcıları İngilizce, UI metinleri Türkçe, belgeler Türkçe (D48).
- UI metinlerinde hafta günü adı kullanılmaz (D44).

## Komutlar

```
npm run dev          # yerel geliştirme
npm run typecheck    # tsc --noEmit (strict)
npm test             # vitest — yalnızca domain
npm run test:e2e     # Playwright duman testi
npm run build        # üretim derlemesi + SW dosya listesi
```

## Görev tamamlama tanımı (her commit için)

1. `typecheck` + `test` yeşil.
2. Dokunulan domain davranışının testi var (UI için test yazılmaz, D34).
3. Konsolda hata yok; bütçe aşımı yok (D35).
4. Commit mesajı: `S<sprint>: <ne> — <hangi F/D maddesi>`. Küçük, tek konulu
  commitler; sprint sonunda sahip push'lar — sen push etmezsin.

## Sprint kapanışı

Sprint kapsamı bittiğinde: kapı maddelerinin (ROADMAP) durumunu özetleyen kısa bir
`docs/sprint-notes/S<N>.md` yaz — ne yapıldı, hangi kararlara dokunuldu, mimarın
bakması gereken riskli noktalar, KL-C'de sahibin özellikle denemesi gerekenler.
Bu not mimar incelemesinin girdisidir.

## Bilinen platform tuzakları (tekrarlama)

ARCHITECTURE.md §5'i oku. Özellikle: `navigator.share` jest içinde ve dosya
senkron kurularak çağrılır; `<a download>` iOS standalone'da çalışmaz; SW'de
sessiz otomatik yenileme yasak (D41); sayaç mutlak zamanla (D42); Safari sekmesi
ile kurulu uygulama ayrı depolama bölmesidir — test ederken karıştırma.
