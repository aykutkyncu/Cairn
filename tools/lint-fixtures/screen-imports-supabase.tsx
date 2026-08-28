// Kasıtlı mimari sınır ihlali örneği: src/app altındaki bir ekran veri istemcisini
// doğrudan içe aktaramaz. scripts/verify-lint-rules.mjs bu dosyayı src/app bağlamında
// denetler ve no-restricted-imports hatasını bekler.
import { createClient } from '@supabase/supabase-js';

export default function LeakyScreen() {
  const client = createClient('https://example.invalid', 'anon');
  return client;
}
