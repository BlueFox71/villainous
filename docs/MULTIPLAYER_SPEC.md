# Spec technique — Multijoueur en réseau local (1v1)

> Statut : adoptée. Décisions verrouillées (cf. §0). Implémentation par étapes (§12).

## 0. Décisions retenues

| Sujet | Choix |
|---|---|
| **Transport** | Relais WebSocket bête (`npm run relay`) + **navigateur-hôte autoritaire**. La vérité du jeu ne quitte jamais le navigateur. |
| **Réactions Conditions** | **Incluses en v1** (le joueur distant non-actif peut réagir). |
| **Layout** | **Haut/bas relativisé** : chacun se voit en haut, l'adversaire en bas. Réutilise l'UI existante. |
| **Vilains** | **Chacun choisit le sien** dans le lobby. |

## 1. Objectif & contraintes

- 2 joueurs humains, **même réseau local**, partie 1v1.
- **Point de vue relatif** : chaque joueur se voit en haut, l'adversaire en bas. Le moteur
  reste agnostique ; c'est purement de l'affichage paramétré par `localPlayerIndex`.
- Le mode **vs-bot actuel reste intact** : le multi est additif.
- On exploite l'existant : moteur **pur**, `GameState` **sérialisable**, **déterministe**
  (rng dans l'état). Aucune refonte du moteur n'est nécessaire.

## 2. Principe directeur

> Une seule machine fait autorité et est le **seul endroit où `applyAction` est appelé**.
> Tout le monde envoie des *demandes d'action* ; l'autorité applique, puis **diffuse le
> nouveau `GameState` complet**. Chaque client en fait son rendu selon son point de vue.

C'est l'option la plus sûre :
- `GameState` est petit et sérialisable → `JSON.stringify` après chaque coup, aucun risque de divergence.
- Pas d'« optimistic update » : en LAN, au tour par tour, la latence est négligeable. On garde
  le modèle « 1 action → 1 état » déjà en place.
- `log`, `showcaseEvents`, `floatingFx` étant append-only **dans l'état**, ils voyagent
  gratuitement avec la diffusion ; chaque client garde son curseur local d'animation.

## 3. Architecture réseau (variante A — retenue)

Un navigateur ne peut pas accepter de connexion entrante. On utilise un **relais WebSocket
~40 lignes** (`npm run relay`) qui ne fait que relayer du JSON entre les membres d'un salon,
sans aucune connaissance du jeu. Toute la logique (GameState + applyAction + bot) reste dans le
**navigateur de l'hôte**. L'invité saisit `IP_hôte:port` + code de salon.

## 4. Protocole de messages (`src/net/messages.ts`)

```
Client → autorité
  ACTION_REQUEST   { action: GameAction }     // une demande, pas une mutation
  PASS                                         // décline une fenêtre de réaction
  JOIN             { room, villainKey, name }
  LEAVE / PING

Autorité → clients
  STATE            { state, seats, reaction? }  // diffusé après chaque applyAction
  LOBBY            { seats, villains, ready }
  ASSIGN           { yourSeat: 0 | 1 }          // ton localPlayerIndex
  REJECT           { reason }                    // coup illégal / pas ton tour
```

Boucle de l'autorité à la réception d'`ACTION_REQUEST` :
1. Vérifier que l'émetteur **a le droit de jouer maintenant** (cf. §6).
2. Vérifier la légalité via les fonctions existantes (`rules.ts` / `isActionAvailable`).
3. `state = applyAction(state, action)` puis **diffuser `STATE`**.
4. Si le siège qui doit jouer ensuite est un **bot**, l'hôte enchaîne lui-même
   (logique `botAct`/résolveurs actuelle), en rediffusant à chaque pas.

## 5. Sièges / contrôleurs (remplace `BOTS`/`HUMAN`)

```ts
type SeatController = 'local' | 'remote' | 'bot'
seats: [SeatController, SeatController]
localPlayerIndex: 0 | 1
```

- **Solo (actuel)** : `['local','bot']`, `localPlayerIndex = 0` → identique à aujourd'hui.
- **Multi, hôte** : `['local','remote']`, `localPlayerIndex = 0`.
- **Multi, invité** : `['remote','local']`, `localPlayerIndex = 1`.

`BOTS[i]` → `seats[i] === 'bot'`. `HUMAN` → `localPlayerIndex`.

## 6. Le cœur : « qui le moteur attend-il ? »

Le joueur attendu **n'est pas toujours `activePlayer`** : certaines Fatalités donnent la main au
`chooserIndex`, certains effets à un `playerIndex` précis, et les **Conditions** se jouent par le
joueur **non**-actif. `App.tsx` encode déjà ce routage (`BOTS[pending.playerIndex]`,
`BOTS[pending.chooserIndex]`…). On le centralise dans **un seul helper pur** :

```ts
// src/engine/turn.ts
function pendingOwner(state: GameState): number | null
// → index du joueur attendu pour une résolution de pending (lit playerIndex/chooserIndex
//   du pending actif) ; null si aucun pending bloquant.

function whoseInput(state: GameState): number   // pendingOwner ?? activePlayer
```

Règle d'autorisation **unique**, côté autorité et côté UI :
- Un client peut agir ssi `whoseInput(state) === localPlayerIndex`.
- L'UI active/désactive l'interaction sur cette base (remplace les `activePlayer === HUMAN`
  éparpillés).
- L'hôte n'auto-joue le bot que si `seats[whoseInput(state)] === 'bot'`.

## 7. Miroir UI minimal

Comme on garde haut/bas, c'est une **substitution de référence** :
- Le store expose `localPlayerIndex` ; là où l'UI lit `players[0]` (moi) / `players[1]` (lui),
  lire `players[localPlayerIndex]` / `players[1 - localPlayerIndex]`.
- En solo, `localPlayerIndex = 0` → pixel-identique.
- Chez l'invité, `localPlayerIndex = 1` → il se voit en haut, sans toucher au CSS.
- `canAct` d'un panneau = `seats[i] === 'local' && whoseInput(state) === i`.

## 8. Flux lobby

1. **Hôte** : « Créer une partie » → contacte le relais, obtient un **code de salon**, choisit
   **son** vilain, voit l'IP à communiquer.
2. **Invité** : « Rejoindre » → saisit `IP:port` + code, choisit **son** vilain.
3. Hôte « Démarrer » → `newGame([vHôte, vInvité])` (mélange + seed, déjà existant) → `ASSIGN`
   puis premier `STATE`.

## 9. Synchronisation & files append-only

- Diffusion d'**état complet** à chaque coup : `log`, `showcaseEvents`, `floatingFx` inclus.
  Les curseurs d'animation restent **locaux** à chaque client (aucun changement d'animation).
- Reconnexion : l'autorité renvoie le dernier `STATE` → resynchronisation instantanée.

## 10. Réactions / Conditions (v1)

Les Conditions sont une **fenêtre optionnelle**, pas une attente bloquante. Design :
1. Après application d'une action, l'autorité évalue (logique de détection de `chooseReaction`)
   si le joueur **non-actif** a une Condition jouable.
2. Si oui et que ce siège est humain → diffuser un `STATE` portant une **fenêtre de réaction**
   ouverte pour ce joueur (champ éphémère dans le message `STATE`, **pas** dans `GameState`).
3. Ce joueur voit une UI **« Réagir / Passer »** ; il envoie `PLAY_CONDITION` (déjà dans
   `GameAction`) ou `PASS`.
4. Sur `PASS` (ou délai), l'autorité reprend le fil du tour.

Un **seul** endroit décide « fenêtre ouverte ? », réutilisé par le bot (solo) et l'humain
distant (multi). Extension de `whoseInput` → `pendingInput(state)` renvoyant soit une attente
**bloquante** (pending/tour), soit une fenêtre de réaction **optionnelle**.

## 11. Impact par fichier

- **Neuf** : `src/net/` (transport client WS, `messages.ts`, hook de session), `src/engine/turn.ts`,
  un mini `relay/` (serveur WS) + script npm, écrans `Lobby`/`Join`.
- **Modifié** : `gameStore.ts` (sièges, `localPlayerIndex`, demande vs application locale),
  `App.tsx` (gating via `whoseInput`/`localPlayerIndex`, miroir), sélection de vilain (mode multi),
  menu (entrée « Jouer en réseau »).
- **Inchangé** : tout `engine/` (sauf ajout pur de `turn.ts`), `data/`, l'IA.

## 12. Plan d'implémentation (étapes)

1. **Refactor solo, zéro réseau** — `engine/turn.ts` (`whoseInput` + détection unifiée de fenêtre
   de réaction) ; remplacer `BOTS`/`HUMAN` par `seats`/`localPlayerIndex`. Le solo reste identique
   (tests verts).
2. **Relais + transport** `src/net/` (serveur WS minimal, `messages.ts`, hook client), testé en echo.
3. **Lobby / Join** — salon, IP+code, chacun son vilain, `newGame` par l'hôte, `ASSIGN`.
4. **Boucle autoritaire** — `ACTION_REQUEST` → contrôle d'autorité + légalité → `applyAction` →
   diffusion ; enchaînement bot côté hôte.
5. **Miroir UI + gating** par `localPlayerIndex`.
6. **Fenêtre de réaction** humaine (UI Réagir/Passer + `PASS`) + reconnexion.
