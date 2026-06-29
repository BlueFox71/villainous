import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import App from './App'
import { MainMenu } from './screens/MainMenu'
import { VillainList } from './screens/VillainList'
import { VillainEditor } from './screens/VillainEditor'
import { VillainSelect } from './screens/VillainSelect'
import { GameLoading } from './screens/GameLoading'
import { GameModeSelect } from './screens/GameModeSelect'
import { NetworkLobby } from './screens/NetworkLobby'
import { Profile } from './screens/Profile'
import { SoundTest } from './screens/SoundTest'
import { MenuMusicPlayer } from './components/MenuMusicPlayer'
import { MenuBackground } from './components/MenuBackground'
import { IntroCinematic } from './components/IntroCinematic'
import { useSettingsStore } from './store/settingsStore'
import { useGameStore, VILLAIN_REGISTRY, type VillainKey } from './store/gameStore'
import { playClick } from './sfx'

/** Chemins des écrans (une route par page). */
const ROUTES = {
  menu: '/',
  modeSelect: '/nouvelle-partie',
  chooseVillains: '/choix-vilains',
  network: '/reseau',
  loading: '/chargement',
  game: '/partie',
  villains: '/vilains',
  editor: '/editeur',
  profile: '/profil',
  sounds: '/sons',
} as const

// --- Écrans câblés à la navigation par URL ---------------------------------

function MenuRoute({ onReplayIntro }: { onReplayIntro: () => void }) {
  const navigate = useNavigate()
  return (
    <MainMenu
      onNewGame={() => navigate(ROUTES.modeSelect)}
      onVillainList={() => navigate(ROUTES.villains)}
      onEditor={() => navigate(ROUTES.editor)}
      onProfile={() => navigate(ROUTES.profile)}
      onReplayIntro={onReplayIntro}
    />
  )
}

function ModeSelectRoute() {
  const navigate = useNavigate()
  return (
    <GameModeSelect
      onChooseVillains={() => navigate(ROUTES.chooseVillains)}
      onNetwork={() => navigate(ROUTES.network)}
      onBack={() => navigate(ROUTES.menu)}
    />
  )
}

function SelectRoute() {
  const navigate = useNavigate()
  return (
    <VillainSelect
      // On passe par l'écran de chargement (préchargement des décors) avant la partie.
      onStart={() => navigate(ROUTES.loading)}
      onBack={() => navigate(ROUTES.menu)}
    />
  )
}

function LoadingRoute() {
  const navigate = useNavigate()
  return (
    <GameLoading
      onReady={() => navigate(ROUTES.game, { replace: true })}
      onBack={() => navigate(ROUTES.menu)}
    />
  )
}

function NetworkRoute() {
  const navigate = useNavigate()
  return (
    <NetworkLobby
      onEnterVillainSelect={() => navigate(ROUTES.chooseVillains)}
      onBack={() => navigate(ROUTES.menu)}
    />
  )
}

function GameRoute() {
  const navigate = useNavigate()
  return <App onExit={() => navigate(ROUTES.menu)} />
}

function VillainListRoute() {
  const navigate = useNavigate()
  return <VillainList onBack={() => navigate(ROUTES.menu)} />
}

function EditorRoute() {
  const navigate = useNavigate()
  return (
    <VillainEditor
      onBack={() => navigate(ROUTES.menu)}
      onPlay={(custom, chosen) => {
        // Adversaire : celui choisi dans l'éditeur, sinon un vilain natif au hasard.
        const keys = Object.keys(VILLAIN_REGISTRY) as VillainKey[]
        const opponent = chosen ?? keys[Math.floor(Math.random() * keys.length)]
        useGameStore.getState().startCustomGame(custom, opponent)
        navigate(ROUTES.game)
      }}
    />
  )
}

function ProfileRoute() {
  const navigate = useNavigate()
  return <Profile onBack={() => navigate(ROUTES.menu)} />
}

function SoundTestRoute() {
  const navigate = useNavigate()
  return <SoundTest onBack={() => navigate(ROUTES.menu)} />
}

/** Musique de menu : jouée sur les écrans hors-jeu, sauf la banque de sons (qui
 *  doit rester silencieuse) et l'écran de jeu (qui a sa propre musique). La liste
 *  des vilains a sa propre piste. La `key` force le remontage au changement de
 *  piste pour relancer proprement la lecture. */
function MenuMusic() {
  const { pathname } = useLocation()
  if (pathname === ROUTES.game || pathname === ROUTES.sounds) return null
  // La liste des vilains ET l'Atelier des vilains partagent la même piste.
  const onVillains = pathname === ROUTES.villains || pathname === ROUTES.editor
  const src = onVillains ? '/audio/villain-list.mp3' : '/audio/the-magic-mirror.mp3'
  // Piste de la liste des vilains un peu moins forte que la musique du menu.
  const gain = onVillains ? 0.8 : 1
  return <MenuMusicPlayer key={src} src={src} gain={gain} />
}

/** Arrière-plan « menu » partagé et persistant (accueil + nouvelle partie),
 *  visible seulement sur ces écrans mais jamais démonté (orbes continus). */
function MenuBackgroundLayer() {
  const { pathname } = useLocation()
  const visible =
    pathname === ROUTES.menu || pathname === ROUTES.modeSelect || pathname === ROUTES.network
  return <MenuBackground visible={visible} />
}

/**
 * Racine de l'application : une route par écran (menu, choix du vilain, jeu,
 * liste des vilains, profil, banque de sons). Le jeu lui-même vit dans <App/>.
 */
export default function Root() {
  // Cinématique d'intro « Les Méchants Disney se déchaînent » : jouée une seule
  // fois par session (un lancement de l'app de bureau = une session ; un simple
  // rechargement ne la rejoue pas). Tant qu'elle tourne, le menu reste masqué
  // dessous et sa musique est coupée.
  const [introDone, setIntroDone] = useState(
    () => sessionStorage.getItem('introPlayed') === '1',
  )
  const finishIntro = () => {
    sessionStorage.setItem('introPlayed', '1')
    setIntroDone(true)
  }
  // Rejoue la cinématique d'intro à la demande (bouton du menu) : on remasque le
  // menu sous la vidéo ; `finishIntro` la refermera comme au lancement.
  const replayIntro = () => setIntroDone(false)

  // App de bureau : aligne le mode d'affichage du store sur celui réellement
  // appliqué à la fenêtre native au lancement (source de vérité côté Electron),
  // pour que les Options affichent le bon mode sélectionné.
  useEffect(() => {
    const bridge = window.villainous
    if (!bridge) return
    void bridge.getDisplayMode().then((mode) => {
      useSettingsStore.setState({ displayMode: mode })
    })
  }, [])

  // Son de clic sur TOUS les boutons (non désactivés), partout dans l'app —
  // SAUF sur la Banque de sons, où le clic ne doit pas couvrir le son prévisualisé.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (window.location.pathname === ROUTES.sounds) return
      const btn = (e.target as HTMLElement | null)?.closest('button')
      if (btn && !(btn as HTMLButtonElement).disabled) playClick()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <BrowserRouter>
      <MenuBackgroundLayer />
      <Routes>
        <Route path={ROUTES.menu} element={<MenuRoute onReplayIntro={replayIntro} />} />
        <Route path={ROUTES.modeSelect} element={<ModeSelectRoute />} />
        <Route path={ROUTES.chooseVillains} element={<SelectRoute />} />
        <Route path={ROUTES.network} element={<NetworkRoute />} />
        <Route path={ROUTES.loading} element={<LoadingRoute />} />
        <Route path={ROUTES.game} element={<GameRoute />} />
        <Route path={ROUTES.villains} element={<VillainListRoute />} />
        <Route path={ROUTES.editor} element={<EditorRoute />} />
        <Route path={ROUTES.profile} element={<ProfileRoute />} />
        <Route path={ROUTES.sounds} element={<SoundTestRoute />} />
        {/* Route inconnue → menu. */}
        <Route path="*" element={<Navigate to={ROUTES.menu} replace />} />
      </Routes>
      {/* Musique de menu coupée pendant la cinématique d'intro. */}
      {introDone && <MenuMusic />}
      {!introDone && <IntroCinematic onDone={finishIntro} />}
    </BrowserRouter>
  )
}
