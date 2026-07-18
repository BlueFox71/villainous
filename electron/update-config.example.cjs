// MODÈLE — copie ce fichier en « update-config.cjs » (même dossier) et colle-y ton
// jeton GitHub LECTURE SEULE pour activer la mise à jour automatique.
//
// « update-config.cjs » est GITIGNORÉ (jamais poussé) mais EMBARQUÉ dans l'exe au
// build : c'est ce jeton qui permet à l'app de télécharger les releases du dépôt privé.
//
// Comment créer le jeton (à faire UNE fois) :
//   GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
//   → Generate new token
//     • Resource owner : BlueFox71
//     • Repository access : Only select repositories → villainous
//     • Permissions → Repository permissions → Contents : Read-only
//   → Generate → copie le jeton (github_pat_...) ci-dessous.
module.exports = {
  token: 'github_pat_colle_ton_jeton_lecture_seule_ici',
}
