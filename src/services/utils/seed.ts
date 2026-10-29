// Random world seed in the same `worldNNNNNN` shape the Seed panel has always produced.
export function generateRandomSeed(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    const randomNumber = (values[0] as number) % 1_000_000;
    return `world${randomNumber.toString().padStart(6, '0')}`;
  }
  const fallback = Math.floor(Math.random() * 1_000_000);
  return `world${fallback.toString().padStart(6, '0')}`;
}
