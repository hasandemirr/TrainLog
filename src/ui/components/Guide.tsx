/**
 * Kullanım kılavuzu (F4.4) — kısa, uygulama içi, Türkçe. STATİK İÇERİK:
 * AppState'e girmez, yedeğe/senkrona konu olmaz, hiçbir veri okumaz (D8).
 * Yeri Ayarlar'ın altındadır; dört üst görünüm değişmez (D45).
 */
const SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: 'Antrenman',
    lines: [
      'Uygulama sıradaki günü önerir; gün çipleriyle başka güne geçebilirsin.',
      'Kilo/tekrar kutularına yaz — ondalık için virgül kullan (62,5). Her tuş anında kaydedilir.',
      '“Geçeni al” önceki seansın setlerini kopyalar; “+ Set” fazladan set açar.',
      'Hedef bandı dolunca artır/beklet ipucu çıkar; hacim düşerse uyarı görürsün.',
      'Hareketi o seanslığına değiştirmek için “İkame” — program etkilenmez.',
      'Dinlenme sayacı mutlak bitiş zamanıyla çalışır: telefonu kilitleyip açsan da doğru sayar. Ses çıkmaz, ekranda uyarır.',
      '“Bitir” seansı kapatır ve özetini gösterir. Unutursan yeni seans açılınca kendiliğinden kapanır.',
    ],
  },
  {
    title: 'İlerleme',
    lines: [
      'Hareket: seçtiğin hareketin kg ya da hacim eğrisi + seans listesi.',
      'Takvim: aydaki seanslar; bir güne dokun, o günün özeti açılır.',
      'Ölçüm: tarih seç, kilo/çevre ölçülerini gir; her ölçümün eğilimi altta çizilir.',
    ],
  },
  {
    title: 'Program',
    lines: [
      'Program sekmesi salt-okunur açılır; düzenleme bilinçli bir adımdır.',
      'Düzenle → Kaydet yeni bir sürüm yaratır. Geçmiş seanslar açıldıkları sürümün hedeflerini taşımaya devam eder.',
      '“Yeni koşu” mevcut koşuyu kapatır ve döngüyü Gün 1 / hafta 1’den başlatır.',
      'Katalogda hareket silinmez, arşivlenir: geçmişte yaşar, yeni sürümlere eklenmez.',
    ],
  },
  {
    title: 'Yedek — en önemli bölüm',
    lines: [
      'Veri yalnızca bu cihazda durur; sunucu yok. Tek kurtarma biçimi JSON yedeğidir.',
      'Ayarlar → Dışa aktar → Paylaş sayfası → “Dosyalara Kaydet” (ya da bir buluta gönder).',
      'Geri yükleme EZMEZ, BİRLEŞTİRİR: aynı kaydın yeni olanı kazanır, eksikler eklenir.',
      '21 gündür yedek yoksa Antrenman ekranında hatırlatma çıkar.',
      'CSV yalnızca dışa aktarmadır (tablo programı için); geri yüklenemez.',
    ],
  },
  {
    title: 'Kurulum ve güncelleme',
    lines: [
      'Safari → Paylaş → “Ana Ekrana Ekle”. Kurulu uygulama tam ekran açılır ve çevrimdışı çalışır.',
      'Safari sekmesi ile kurulu uygulama AYRI depolama kullanır: sekmede girdiğin veri kurulu uygulamada görünmez. Geçiş yolu yedekten yüklemektir.',
      'Yeni sürüm hazır olduğunda altta “Güncelleme hazır — Yenile” çubuğu çıkar; kendiliğinden yenilenmez, dokunman gerekir.',
    ],
  },
  {
    title: 'Sınırlar',
    lines: [
      'Uygulama kapalıyken hiçbir şey çalışmaz: sayaç yalnızca uygulama açıkken sayar, bildirim göndermez.',
      'Kalıcı depolama tarayıcının verdiği bir izindir, garanti değildir — düzenli yedek almanın nedeni budur.',
      '“Tüm verileri sil” geri alınamaz; tek gerçek ezme odur.',
    ],
  },
];

export function Guide({ onDone }: { onDone: () => void }) {
  return (
    <section class="view">
      <h1 class="view__title">Kullanım kılavuzu</h1>
      {SECTIONS.map((s) => (
        <div key={s.title} class="card">
          <h2 class="guide__h">{s.title}</h2>
          <ul class="guide__list">
            {s.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
      <div class="exercise__actions">
        <button type="button" class="link" onClick={onDone}>
          Kapat
        </button>
      </div>
    </section>
  );
}
