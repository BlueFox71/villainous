// =============================================================================
// desktop.ts — Pont vers la coquille Tauri (exécutable de bureau).
//
// En mode WEB, ces helpers ne servent pas : l'invité charge la page DEPUIS
// l'hôte, donc `location.hostname` suffit à joindre le relais (cf. relayUrl).
// En mode .exe, chaque PC lance sa propre app servie depuis `tauri.localhost` :
// l'hôte doit démarrer un relais embarqué (Rust) et annoncer son IP LAN ; l'invité
// saisit cette IP. Les commandes Tauri sont importées à la demande pour ne pas
// charger `@tauri-apps/api` dans l'environnement de test (Node) ni en pur web.
// =============================================================================

/** Vrai si l'app tourne dans la coquille Tauri (exécutable), faux au navigateur. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Hôte (Tauri) : démarre le relais embarqué (idempotent), renvoie son port. */
export async function ensureRelay(): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<number>('ensure_relay')
}

/** Hôte (Tauri) : adresses IPv4 LAN à communiquer à l'invité. */
export async function lanAddresses(): Promise<string[]> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string[]>('lan_addresses')
}
