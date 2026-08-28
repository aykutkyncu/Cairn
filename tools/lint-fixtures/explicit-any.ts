// Kasıtlı sözleşme ihlali örneği: explicit any lint hatası vermelidir.
// Bu dosya üretim kodu değildir; scripts/verify-lint-rules.mjs tarafından denetlenir.
export function parsePayload(input: any): string {
  return String(input);
}
