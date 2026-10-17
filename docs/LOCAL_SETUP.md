# Installation locale

Public visé : développeur qui lance le back-office sur son poste.

## 1. Prérequis

* Node.js ≥ 20.19 (testé avec Node 24).
* Pour travailler avec des données : le dépôt `abs-immo-backend` cloné **à côté** de celui-ci
  (`../abs_immo_backend` ou `../abs-immo-backend`) et Docker Desktop.

## 2. Base locale (recommandé)

Dans `abs-immo-backend` :

```bash
npm ci
npm run db:start     # API http://127.0.0.1:54621, e-mails http://127.0.0.1:54624 (Mailpit)
npm run db:reset     # migrations + données de démonstration
npx supabase status  # affiche la clé publishable locale
```

Comptes de démonstration (mot de passe commun `AbsImmo-Local-2026`, **local uniquement**) :

| E-mail | Rôle |
|---|---|
| `superadmin@abs-immo.test` | Super administrateur |
| `admin@abs-immo.test` | Administrateur |
| `manager@abs-immo.test` | Responsable commercial (+ fiche agent) |
| `agent1@abs-immo.test`, `agent2@abs-immo.test` | Agents |

## 3. Back-office

```bash
npm ci
cp .env.example .env.local
```

`.env.local` pour la pile locale :

```env
VITE_SUPABASE_URL=http://127.0.0.1:54621
VITE_SUPABASE_PUBLISHABLE_KEY=<clé "Publishable" affichée par npx supabase status>
VITE_PUBLIC_SITE_URL=http://localhost:5173
```

```bash
npm run dev          # http://localhost:5174
```

Le port **5174** est imposé (`strictPort`) : c'est l'URL de redirection Auth déclarée dans
`abs-immo-backend/supabase/config.toml` (`/reset-password` pour les liens de réinitialisation et d'invitation).
Les e-mails envoyés en local (invitation, réinitialisation) arrivent dans Mailpit : http://127.0.0.1:54624.

Les photos des biens du seed n'ont pas de fichier réel dans Storage : la fiche affiche « Fichier indisponible ».
Envoyez de vraies photos depuis l'écran du bien pour les voir.

## 4. Vérifications

```bash
npm run check              # lint + types + tests + build
npm run test:integration   # nécessite la pile locale démarrée et le seed
```

Les tests d'intégration créent un bien et un prospect de test puis les suppriment. Ils modifient brièvement le slogan
de l'agence et le restaurent. Ils refusent de s'exécuter si `VITE_SUPABASE_URL` n'est pas une adresse locale.

## 5. Mettre à jour les types du backend

À chaque nouvelle version du contrat :

```bash
npm run types:sync    # copie ../abs_immo_backend/src/types → src/types/backend
npm run typecheck
```

Puis mettre à jour `CONTRACT_VERSION_EXPECTED` (`src/config/env.ts`) et `src/types/backend/README.md`.
Ne jamais modifier les fichiers de `src/types/backend` à la main.

## 6. Problèmes courants

| Symptôme | Cause / solution |
|---|---|
| Écran « Configuration incomplète » | `.env.local` absent ou variables vides ; relancer `npm run dev` après modification |
| « Clé Supabase secrète détectée » | Une clé `sb_secret_…`/`service_role` a été mise dans `.env.local` : la remplacer par la clé publishable |
| Connexion OK mais « aucun rôle attribué » | Le compte n'a pas de rôle : l'attribuer depuis « Utilisateurs » (ou `bootstrap_super_admin` pour le premier) |
| Port 5174 occupé | Libérer le port : il est requis par la configuration Auth |
| Invitation : erreur réseau / CORS | En production, l'origine du back-office doit figurer dans le secret `BACKOFFICE_ORIGINS` |
