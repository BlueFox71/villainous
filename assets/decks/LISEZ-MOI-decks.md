# Lire un deck depuis le classeur source

Les decks « collaborateurs » sont saisis dans un classeur OpenDocument :
**`assets/decks/Villainous Template_Jules.ods`**.

Chaque **feuille = un vilain**. Les images de cartes correspondantes vivent dans
`assets/decks/<NomDuVilain>/` (ex. `assets/decks/Bowser/`), nommées d'après la
colonne **B** (`nom fichier`).

## Comment lire une feuille (sans LibreOffice)

Un script Node autonome (zéro dépendance) lit directement le `.ods` :

```bash
# Lister les feuilles (= les vilains) du classeur
node scripts/read-ods-sheet.mjs "assets/decks/Villainous Template_Jules.ods"

# Dumper une feuille, colonnes A,B,C… alignées (lecture humaine)
node scripts/read-ods-sheet.mjs "assets/decks/Villainous Template_Jules.ods" Bowser

# Même chose en JSON (lignes = tableaux de cellules), pour traiter en script
node scripts/read-ods-sheet.mjs "assets/decks/Villainous Template_Jules.ods" Bowser --json
```

Feuilles présentes au moment de l'écriture : `Stitch`, `Team_Rocket`,
`La_bonne_fée`, `Tabbou`, `Bowser`, `Flagelleur_Mental`,
`Malédiction_des_Madrigal`, `La_faucheuse`, `Tom_Nooks`. (Relancer la commande
de liste pour l'état réel.)

## Convention de colonnes

| Col. | Contenu | Notes |
|------|---------|-------|
| **A** | Nombre d'exemplaires de la carte | Quantité dans le paquet. |
| **B** | Nom de fichier image | À retrouver dans `assets/decks/<Vilain>/` (sans extension). |
| **C** | Nom de la carte | |
| **D** | Coût | Vide si la carte n'a pas de coût (héros, événement…). |
| **E** | Force | Peut être `"+1"` (bonus d'Objet associé) ou vide. |
| **F** | Description / capacité | Texte FR = source de vérité. Sauts de ligne préservés. |
| **G** | Type | `Héros`, `Allié`, `Objet`, `Condition`, `Événement` (valeurs vues sur Bowser). |
| **H** | « Activer une capacité » | Description de la capacité activable **si non vide**. Parfois juste un nombre (≈ pouvoir gagné / coût implicite — à interpréter au cas par cas). |
| **I** | Coût pour « activer une capacité » | En jetons Pouvoir, s'il y en a un. |
| **J** | — | Séparateur, vide. |
| **K** | Camp | `0` ou `Villain` = paquet Méchant ; `1` ou `Fate` = paquet **Fatalité**. |
| **L** | Action supplémentaire | Symbole d'action ajouté par la carte : `Activate`, `PlayCard`, `Move`, `MoveHeld`, `Vanquish`, `Fate`, `Discard`, `Power`, `Unique`. |
| **M** | `Auto` | Drapeau de mise en page auto du gabarit — ignorer pour la donnée de jeu. |

### Structure des lignes

- **Ligne 1** : en-têtes (le texte exact y rappelle la convention ci-dessus).
- **Ligne 2** : bannière au nom du vilain (uniquement la colonne A remplie).
- **Lignes suivantes** : une carte par ligne.
- Des cellules parasites peuvent traîner au-delà de la colonne M (ex. un compteur
  « Fatalités / 15 » en colonnes O/P) : **ignorer tout ce qui dépasse M**.

## Rappel : où va la donnée ensuite

Une fois la feuille lue, l'intégration suit `CLAUDE.md` (section « Ajouter du
contenu ») : créer `data/villains/<vilain>.ts` + `.cards.ts`, câbler le registre
et l'UI, puis ajouter un test d'intégrité du paquet. La colonne **F** alimente le
`text` de la `CardDef` ; les `effects` en sont la traduction machine, ajoutée au
fil de l'eau.
