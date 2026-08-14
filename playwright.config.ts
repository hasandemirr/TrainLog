import { defineConfig } from '@playwright/test';

// S0 duman testi (sprint kapısı md.2). Üretim derlemesini önizleme sunucusunda
// koşar; yerelde çalışan sunucu varsa yeniden kullanır.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  // SW bu duman testinin konusu değil (kabuk + yönlendirme); ilk-yük SW
  // controllerchange→reload yarışını elemek için engelle. SW akışı KL-C'de.
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
