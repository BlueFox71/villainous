/** Affiche « À vous de jouer » au début du tour du joueur (façon HearthStone) :
 *  illustration de présentation du vilain courant AU-DESSUS du libellé doré.
 *  Overlay non bloquant (pointer-events désactivés) qui s'anime puis s'efface en
 *  ~4 s — la disparition est pilotée par l'appelant (montage/démontage). */
export function TurnSplash({ villainName, image }: { villainName: string; image?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="flex flex-col items-center"
        style={{ animation: 'turnSplash 4s ease-in-out both' }}
      >
        {image && (
          <img
            src={image}
            alt=""
            aria-hidden
            className="h-[32rem] w-auto max-w-[55vw] object-contain drop-shadow-[0_16px_44px_rgba(0,0,0,0.85)]"
          />
        )}
        {/* Marge négative + z-10 : le bloc passe par-dessus le bas de l'image
            pour masquer sa découpe. */}
        <div className="relative z-10 -mt-9 rounded-2xl border border-amber-400/40 bg-black/55 px-14 py-7 text-center shadow-[0_0_60px_rgba(251,191,36,0.35)] backdrop-blur-sm">
          <span className="block text-5xl font-black uppercase tracking-[0.18em] text-amber-200 [text-shadow:0_3px_16px_rgba(0,0,0,0.95)]">
            À vous de jouer
          </span>
          <span className="mt-1 block text-lg text-white/75">{villainName}</span>
        </div>
      </div>
    </div>
  )
}
