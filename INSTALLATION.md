# Installer Villainous sur un nouveau PC (Windows)

Application **autonome** : aucun navigateur, Node.js ou connexion Internet requis pour
jouer (tout est embarqué dans l'exécutable Electron). Version actuelle : **0.77.0**.

Les fichiers à copier se trouvent dans le dossier **`release/`** après un build
(`npm run electron:build`). Tu n'as besoin que de **l'un** des deux ci-dessous.

## Option A — Installateur (recommandé)

1. Copie **`release/Villainous Setup.exe`** sur le nouveau PC (clé USB, réseau…).
2. Double-clique dessus.
   - Windows SmartScreen peut afficher un avertissement (exécutable non signé) :
     clique **« Informations complémentaires » → « Exécuter quand même »**.
3. Choisis le dossier d'installation (ou garde celui par défaut), puis **Installer**.
4. Un **raccourci « Villainous »** est créé sur le Bureau et dans le menu Démarrer.
5. Lance le jeu depuis le raccourci. Désinstallation possible via « Ajout/Suppression
   de programmes ».

## Option B — Portable (sans installation)

1. Copie **`release/Villainous 0.77.0.exe`** sur le nouveau PC.
2. Double-clique pour lancer directement (aucune installation, rien n'est écrit dans
   le système ; idéal pour une clé USB). Même avertissement SmartScreen possible.

> Les deux exécutables font ~950 Mo (toutes les illustrations, voix et animations sont
> incluses). Prévois assez d'espace.

## (Pour développeurs) Régénérer le setup et l'exé

Sur une machine avec **Node.js 20+** et le dépôt cloné :

```bash
npm install            # dépendances
npm run electron:build # → release/Villainous Setup.exe + release/Villainous <version>.exe
```

La version du fichier portable suit `package.json` (`"version"`). Pense à
l'incrémenter avant un build de distribution.

Autres commandes utiles : `npm run dev` (serveur de dév), `npm run test`,
`npm run lint`, `npm run electron` (lance l'app Electron sur le build courant),
`npm run electron:dev` (dév à chaud **dans** la fenêtre Electron : démarre/réutilise
Vite et ouvre la fenêtre native dessus, avec HMR + DevTools, sans build préalable).
