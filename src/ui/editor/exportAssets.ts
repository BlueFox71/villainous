// Export des fichiers d'un vilain PERSONNALISÉ vers les dossiers SOURCES `assets/`
// (comme les vilains natifs), via l'endpoint DEV `/__save-villain-assets`. Purement
// archivistique : l'app joue les vilains persos depuis IndexedDB (dataURL), ces
// fichiers servent à retrouver le vilain dans l'arborescence `assets/` (decks/<Nom>/,
// portraits/, presentations/, pions/). Sans serveur de dév, l'appel échoue (no-op).

import type { CustomVillain } from '../../data/customVillain'

/** Caractères interdits dans un nom de fichier (Windows). */
const ILLEGAL = /[\\/:*?"<>|]/g

/** Nettoie un nom pour le système de fichiers (Windows) en gardant accents/espaces. */
function safeName(s: string): string {
  return (s || 'vilain').replace(ILLEGAL, ' ').replace(/\s+/g, ' ').trim() || 'vilain'
}

/** Extension de fichier d'après le type MIME d'un dataURL (défaut .png). */
function extOf(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl)
  const t = (m?.[1] ?? 'png').toLowerCase()
  if (t === 'jpeg' || t === 'jpg') return 'jpg'
  if (t === 'webp') return 'webp'
  return 'png'
}

interface AssetFile { path: string; dataUrl: string }

/** Construit la liste des fichiers à écrire (chemins relatifs à `assets/`). */
function buildFiles(v: CustomVillain): AssetFile[] {
  const name = safeName(v.name)
  const deck = `decks/${name}`
  const files: AssetFile[] = []
  const add = (path: string, dataUrl: string | undefined) => {
    if (dataUrl && dataUrl.startsWith('data:')) files.push({ path, dataUrl })
  }

  // Portrait / présentation / pion (dossiers dédiés, comme les natifs).
  add(`portraits/${name}.${extOf(v.portrait ?? '')}`, v.portrait)
  add(`presentations/${name}.${extOf(v.presentation ?? '')}`, v.presentation)
  add(`pions/${name}.${extOf(v.pawnImage ?? '')}`, v.pawnImage)

  // Dossier du deck : plateau + dos + faces de cartes.
  add(`${deck}/Plateau.${extOf(v.boardImage ?? '')}`, v.boardImage)
  add(`${deck}/Card Back mechant.${extOf(v.backVillainImage ?? '')}`, v.backVillainImage)
  add(`${deck}/Card Back fata.${extOf(v.backFateImage ?? '')}`, v.backFateImage)

  // Faces de cartes (une par CardDef), nom = nom de la carte (dédoublonné).
  const used = new Set<string>()
  for (const c of v.cards) {
    if (!c.image?.startsWith('data:')) continue
    const base = safeName(c.name)
    let candidate = base
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})`
    used.add(candidate.toLowerCase())
    add(`${deck}/${candidate}.${extOf(c.image)}`, c.image)
  }
  return files
}

/** Écrit les fichiers du vilain dans `assets/`. Renvoie le nombre écrit, ou une
 *  erreur (ex. serveur de dév absent / endpoint indisponible en .exe). */
export async function exportVillainAssets(
  v: CustomVillain,
): Promise<{ ok: boolean; written: number; error?: string }> {
  const files = buildFiles(v)
  try {
    const res = await fetch('/__save-villain-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    })
    if (!res.ok) return { ok: false, written: 0, error: await res.text() }
    const { written } = (await res.json()) as { written: number }
    return { ok: true, written }
  } catch (e) {
    return { ok: false, written: 0, error: (e as Error)?.message ?? String(e) }
  }
}
