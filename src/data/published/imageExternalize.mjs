// =============================================================================
// Externalisation des images d'un vilain custom : transforme un vilain COMPLET
// (images en data-URL base64) en un vilain « chemins » + la liste des fichiers à
// écrire sous public/. Fichier PUR (aucune I/O, aucun import) : consommé par
// l'endpoint de publication (vite.config.ts) ET le script de migration.
// =============================================================================

/** MIME → extension de fichier. */
const EXT_BY_MIME = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav',
}

function parseDataUrl(s) {
  if (typeof s !== 'string' || !s.startsWith('data:')) return null
  const m = /^data:([^;]+);base64,(.+)$/s.exec(s)
  return m ? { mime: m[1], base64: m[2] } : null
}

/** Traite UN champ image d'un objet : si data-URL, écrit le fichier et remplace par le chemin. */
function processField(obj, key, base, ctx) {
  const parsed = parseDataUrl(obj[key])
  if (!parsed) return // absent, ou déjà un chemin → idempotent
  const ext = EXT_BY_MIME[parsed.mime] ?? 'bin'
  const filename = `${base}.${ext}`
  const relPath = `cards/${ctx.id}/${filename}`
  ctx.files.push({ path: relPath, base64: parsed.base64, mime: parsed.mime })
  obj[key] = `/cards/${ctx.id}/${filename}?v=${ctx.versionMs}`
}

/**
 * @param {object} villain  Vilain complet (data-URLs).
 * @param {{versionMs?: number}} [opts]  Version pour le cache-bust (défaut : Date.parse(updatedAt)).
 * @returns {{villain: object, files: Array<{path:string, base64:string, mime:string}>}}
 */
export function externalizeVillainImages(villain, opts = {}) {
  const out = JSON.parse(JSON.stringify(villain))
  const versionMs = opts.versionMs ?? (Date.parse(out.updatedAt ?? '') || 0)
  const ctx = { id: out.id, versionMs, files: [] }

  processField(out, 'portrait', 'portrait', ctx)
  processField(out, 'presentation', 'presentation', ctx)
  processField(out, 'portraitRaw', 'portrait-raw', ctx)
  processField(out, 'boardImage', 'board', ctx)
  processField(out, 'boardArt', 'board-art', ctx)
  processField(out, 'altBoardImage', 'board-alt', ctx)
  processField(out, 'pawnImage', 'pawn', ctx)
  processField(out, 'backVillainImage', 'back-villain', ctx)
  processField(out, 'backFateImage', 'back-fate', ctx)
  processField(out, 'backExtraImage', 'back-extra', ctx)
  processField(out, 'audio', 'audio', ctx)

  if (Array.isArray(out.backOverlays)) {
    out.backOverlays.forEach((o, i) => processField(o, 'image', `back-overlay-${i}`, ctx))
  }
  if (out.backExtra && Array.isArray(out.backExtra.overlays)) {
    out.backExtra.overlays.forEach((o, i) => processField(o, 'image', `back-extra-overlay-${i}`, ctx))
  }
  if (Array.isArray(out.locations)) {
    for (const l of out.locations) {
      processField(l, 'image', `loc-${l.id}`, ctx)
      if (l.alt) {
        processField(l.alt, 'image', `loc-${l.id}.alt`, ctx)
        processField(l.alt, 'columnImage', `loc-${l.id}.alt-col`, ctx)
      }
    }
  }
  if (Array.isArray(out.cards)) {
    for (const c of out.cards) {
      processField(c, 'image', `${c.id}`, ctx)
      processField(c, 'artImage', `${c.id}.art`, ctx)
    }
  }
  return { villain: out, files: ctx.files }
}
