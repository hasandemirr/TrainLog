# TrainLog — Mimari

Kişisel antrenman takip PWA'sı. Tek kullanıcı, iOS öncelikli, çevrimdışı-öncelikli,
sunucusuz. Bu belge yapıyı tanımlar; kararların gerekçeleri DECISIONS.md'dedir
(madde numaralarıyla referans verilir).

## 1. Dört katman (D4)

| Katman | İçerik | Statü |
|---|---|---|
| 1. Operasyonel durum | Tek `AppState` nesnesi, cihazda, her aksiyonda yazılır | Zorunlu |
| 2. Kalıcılık güçlendirme | Ana ekran kurulumu + `persist()` kontrolü/talebi | Zorunlu, garanti değil |
| 3. Yedek | JSON dışa/içe (birleştirmeli), görünür yedek yaşı | Asıl kurtarma mekanizması |
| 4. Uzak hedef | `SyncPort` — bugün `noop` | Opsiyonel, D11 tetiğine bağlı |

## 2. Desen

Tek depo + tek yönlü akış (D6): `yükle → göç → indeksle → çiz → aksiyon → kaydet → çiz`.
Aksiyonlar (`app/actions.ts`) durumun tek değişim kapısıdır; her aksiyon senkron
kalıcılaştırma tetikler (D24) ve görünümü yeniler.

Bağımlılık yönü kuralı (D7) — ihlali kabul edilmeyen tek yapısal kural:

```
        ┌──────────────  main.ts (kablolama)  ──────────────┐
        │                                                    │
   ┌────▼────┐      ┌──────────┐      ┌──────────────────┐   │
   │   ui/   │ ───► │   app/   │ ───► │     domain/      │   │
   └─────────┘      │ (ports)  │      │ (saf, importsuz) │   │
                    └────▲─────┘      └──────────────────┘   │
                         │ uygular                           │
                    ┌────┴──────┐                            │
                    │ adapters/ │ ◄──────────────────────────┘
                    └───────────┘
```

- `domain/` hiçbir şeyi import etmez: DOM yok, depo yok, tarayıcı API'si yok.
  İlerleme kuralı, birleştirme, göç ve doğrulama burada saf fonksiyondur — test
  yüzeyinin tamamı budur (D34).
- Portlar (`app/ports.ts`): `StoragePort`, `SyncPort`, `BackupPort`. İmza
  değişikliği karar önerisi gerektirir.
- Üç değişmez (D8): türetilmiş veri kalıcılaştırılmaz; UI durumu domain durumundan
  ayrıdır; medya durum nesnesine girmez.

## 3. Veri modeli (şema v2)

```ts
// domain/types.ts — normatif eskiz
type ExerciseId = string & { __brand: "ex" };
type ProgramId  = string & { __brand: "prog" };
type RunId      = string & { __brand: "run" };
type ISODate    = string;                       // "2026-08-13", yerel gün
type SessionId  = `${ISODate}#${number}`;       // D17: gün içi sıra, varsayılan #1
type RecordKey  = `${SessionId}|${number}`;     // D18: slot indeksi; exId kaydın özelliği

interface Exercise   { id: ExerciseId; name: string; kind: "bar"|"db"|"mac"|"time";
                       zone: string; inc: number; media?: string;
                       archived?: true; userModified?: true }        // D39
interface Prescribed { exId: ExerciseId; sets: number; lo: number; hi: number;
                       rir?: [number, number]; rest: number }
interface Program    { id: ProgramId; familyId: string; rev: number; // D15: sürüm zinciri
                       name: string; userModified?: true;
                       days: { dayId: string; label?: string;        // D44: "Gün 1" + etiket
                               items: Prescribed[] }[] }
interface Run        { id: RunId; familyId: string;
                       currentProgId: ProgramId; startDate: ISODate }
interface Session    { id: SessionId; date: ISODate; runId: RunId;
                       progId: ProgramId;                            // açıldığı andaki sürüm
                       dayId: string; week: number;                  // D16: beyan edilen konum
                       finishedAt?: number }                         // D46
interface SetEntry   { kg: number|null; reps: number|null }
interface ExRecord   { exId: ExerciseId;                             // ikame = farklı exId (D47)
                       sets: SetEntry[]; rir?: number; note?: string;
                       updatedAt: number }                           // birleştirme anahtarı

interface AppState {
  v: 2;
  meta:     { deviceId: string; rev: number; updatedAt: number;
              lastBackup: number };                                  // D12, D29
  catalog:  { exercises: Record<ExerciseId, Exercise>;
              programs:  Record<ProgramId, Program> };               // D19
  runs:     Record<RunId, Run>;
  sessions: Record<SessionId, Session>;
  records:  Record<RecordKey, ExRecord>;
  measures: Record<ISODate, Partial<Record<string, number|string>>>;
  timer?:   { tEnd: number; label: string };                         // D42
}
```

Model kuralları:
- Silme yok: hareket/program **arşivlenir**; kayıt **boşaltılır** ama `updatedAt` ile
  yerinde kalır (D27 — birleştirmede diriliş problemi böyle kapanır). Tek gerçek
  ezme "Tüm verileri sil"dir.
- Program düzenleme = yeni `rev` + koşu işaretçisi ilerler; geçmiş seanslar eski
  sürüme bağlı kalır (D15).
- Birleştirme (`domain/merge.ts`): anahtar bazında `updatedAt` son-yazan-kazanır;
  idempotent ve sıra bağımsız olmalıdır (testle kanıtlanır). Müşterileri: yedek geri
  yükleme (bugün) + senkron (ileride).
- Serbest yuva: seansa program gününde olmayan slot eklenebilir (slotIdx,
  gün öğe sayısının üstünden devam eder).

## 4. Klasör yapısı (D37)

```
TrainLog/
├─ public/
│  ├─ icons/  manifest.webmanifest
│  └─ media/exercises/          # D30 — durum DIŞI, SW önbelleği İÇİ
├─ src/
│  ├─ domain/                   # saf çekirdek; import: hiçbir şey
│  │  ├─ types.ts  ids.ts
│  │  ├─ progression.ts         # hacim, ilerleme kuralı, düşüş tespiti
│  │  ├─ merge.ts  migrate.ts  validate.ts
│  ├─ app/
│  │  ├─ ports.ts  store.ts  actions.ts
│  │  └─ selectors.ts           # bellek indeksleri: exId→geçmiş, takvim, özetler
│  ├─ adapters/
│  │  ├─ storage.local.ts       # bugün; storage.idb.ts → tetik D23
│  │  ├─ backup.file.ts  backup.csv.ts
│  │  └─ sync.noop.ts           # sync.firestore.ts → tetik D11
│  ├─ ui/
│  │  ├─ views/                 # workout, progress, program, settings
│  │  ├─ components/
│  │  └─ format.ts  router.ts   # hash; push/replace disiplini (D40)
│  ├─ content/seed.ts           # sürümlü tohum (D39)
│  ├─ pwa/sw.ts
│  └─ main.ts
├─ tests/                       # yalnızca domain hedefli + 1 Playwright dumanı
│  └─ fixtures/                 # SENTETİK veri (D49)
├─ docs/proposals/              # Claude Code'un karar önerileri
├─ local-data/                  # gerçek veri; gitignore'da (D49)
├─ index.html  vite.config.ts  tsconfig.json
```

## 5. Platform notları (iOS — bilinen tuzaklar)

- **Depolama bölmeleri:** Safari sekmesi ile ana ekran uygulaması ayrı depolama
  kullanır. Karşı önlem: display-mode algılama + kurulum yönlendirmesi + ilk
  açılışta "Yedekten yükle" (D27).
- **`<a download>` standalone modda sessizce çalışmaz.** Dışa aktarma zinciri:
  `navigator.share({files})` → indirme → kopyalanabilir metin. `share()` kullanıcı
  jestinin geçici aktivasyonu içinde, dosya senkron kurularak çağrılır — araya
  asenkron adım eklenemez.
- **SW güncellemesi:** ön plana gelişte `update()`; `waiting` → görünür çubuk;
  sessiz yenileme yasak (D41).
- **Klavye + sabit alt bar:** `visualViewport` dinlenir; girdi odaktayken alt bar
  gizlenebilir. Cihaz kontrol listesinin kalemi.
- **Sayaç:** mutlak `tEnd`, depoya yazılır (D42); bip yok, görsel uyarı (D43).
  Wake Lock anahtarı ("antrenmanda ekranı açık tut") ekran kilidini erteler.
- **`persist()`:** her açılışta `persisted()` kontrol edilir, değilse talep edilir;
  sonuç UI'da görünür. Risk azaltıcıdır, garanti değildir (D25).

## 6. Bütçeler ve kalite çıtası

- JS paketi gzip ≤ ~150 KB; durum nesnesi < 1 MB (D35).
- Dokunma hedefleri ≥ 44pt; tek başparmak erişimi; safe-area; koyu tema;
  `prefers-reduced-motion` saygısı. Bunlar özellik değil, sprint kapı kalemidir.
- Çalışma zamanı bağımlılığı: yalnızca Preact. Geliştirme: vite, typescript,
  vitest, @playwright/test. Başka bağımlılık = karar önerisi.
