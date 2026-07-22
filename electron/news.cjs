// Actualités EN LIGNE du launcher. On récupère `news.json` (à la racine du dépôt
// PRIVÉ) via l'API GitHub Contents, avec le jeton LECTURE SEULE déjà embarqué
// (electron/update-config.cjs). Intérêt : publier une actu = éditer news.json +
// `git push`, SANS republier l'exe (tous les launchers voient la nouvelle actu).
//
// En cas d'échec (hors ligne, jeton absent/insuffisant, JSON invalide), on renvoie
// null : le launcher retombe alors sur les notes de version EMBARQUÉES (PATCH_NOTES).

/** Lit le jeton lecture seule embarqué (null si le fichier n'existe pas). */
function loadToken() {
  try {
    const cfg = require('./update-config.cjs')
    return typeof cfg?.token === 'string' && cfg.token ? cfg.token : null
  } catch {
    return null // fichier absent → pas d'actus en ligne (dev sans jeton, build sans jeton)
  }
}

// Fichier d'actualités servi par l'API GitHub (branche main du dépôt).
const NEWS_URL = 'https://api.github.com/repos/BlueFox71/villainous/contents/news.json?ref=main'

/**
 * Récupère les actualités en ligne. Renvoie un tableau d'items (même forme que les
 * notes de version : { version?, date, title, tags?, changes[] }), ou null.
 */
async function fetchNews() {
  const token = loadToken()
  if (!token) return null
  try {
    const res = await fetch(NEWS_URL, {
      headers: {
        Authorization: `token ${token}`,
        // `raw` : renvoie directement le contenu du fichier (pas l'enveloppe base64).
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'villainous-launcher',
      },
      // Ne jamais bloquer le launcher sur un réseau lent.
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    // On accepte soit un tableau nu, soit `{ news: [...] }`.
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.news)) return data.news
    return null
  } catch {
    return null // offline, timeout, JSON invalide…
  }
}

module.exports = { fetchNews }
