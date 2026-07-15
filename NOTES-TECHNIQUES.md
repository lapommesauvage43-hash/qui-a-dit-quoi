# Qui a dit quoi ? — notes techniques (usage interne, non destinées au public)

## Choix effectués et pourquoi

- **Site statique** (HTML + CSS + JS, sans framework, sans étape de build). Aucun
  `npm install` n'est nécessaire pour déployer : Vercel sert les fichiers tels
  quels. Ce choix élimine toute la classe de pannes liée aux dépendances qui
  vieillissent mal — le risque principal pour un projet destiné à durer des
  années sans mainteneur technique dédié.
- **Supabase** (Postgres + Storage + Auth), offre gratuite. Une seule table
  (`posts`), un seul bucket public (`posts-images`), un seul compte
  administrateur (pas d'inscription publique).
- **Vercel**, offre gratuite, déploiement automatique à chaque mise à jour du
  dépôt GitHub. HTTPS géré automatiquement.
- Le client Supabase JS est chargé depuis `esm.sh` (CDN), version figée
  (`@2.45.4`) pour éviter toute rupture silencieuse.

## Structure

```
index.html        écran public (le chemin)
admin.html        administration privée
css/style.css     tous les styles de l'écran public + identité
js/public.js      logique de l'écran public
js/admin.js       logique de l'administration
js/zoom.js        zoom pincé + déplacement réutilisable
js/supabase-config.js   URL + clé publique du projet Supabase
manifest.json     PWA (icônes, nom, couleur)
sw.js             service worker (cache la coquille de l'app)
icons/            icônes + logo (à remplacer par les fichiers officiels)
supabase/schema.sql   schéma complet, à exécuter une fois dans Supabase
```

## Modèle de données (`posts`)

- `id` (uuid) — identifiant immuable.
- `created_at`, `updated_at` — horodatage automatique.
- `display_order` (double precision) — ordre d'affichage, indépendant de la date.
- `published` (boolean) — permet dès aujourd'hui d'ajouter plus tard un statut
  brouillon sans changer le schéma. L'admin V1 ne l'utilise pas explicitement :
  chaque ajout est publié immédiatement.
- `image_path` (text) — chemin dans le bucket `posts-images` (pas l'URL
  complète, pour rester indépendant du nom de domaine).

Toute évolution future (recherche, export, statistiques, collections...) peut
s'appuyer sur cette table sans la modifier : ajouter des colonnes ou des
tables annexes ne casse rien de l'existant.

## Sécurité

- Row Level Security activée sur `posts` et sur `storage.objects`.
- Lecture publique limitée aux lignes `published = true`.
- Écriture (ajout/suppression/réorganisation) réservée à un utilisateur
  authentifié — il n'y a qu'un seul compte admin, créé manuellement dans le
  tableau de bord Supabase (Authentication > Users), jamais via un formulaire
  d'inscription public.

## Pour remplacer le logo / les couleurs plus tard

Remplacer les fichiers dans `icons/` (mêmes noms, mêmes dimensions) et les
variables CSS en tête de `css/style.css` (`--ink`, `--cream`, `--accent`).
Un nouveau déploiement se déclenche automatiquement après un `git push`.
