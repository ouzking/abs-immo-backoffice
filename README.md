# abs-immo-backoffice

Back-office d'**ABS IMMO & SERVICES** : l'outil interne des administrateurs, responsables commerciaux et agents
pour gérer les annonces, les photos, la publication, les prospects, les demandes, les visites, les agents, les comptes,
les paramètres publics de l'agence et le journal d'audit.

* React 19, TypeScript strict, Vite, Tailwind CSS 4, React Router 7
* Supabase (Auth, PostgreSQL + RLS, Storage, Edge Functions) — **projet partagé** avec le site public
* TanStack Query (données), TanStack Table (tableaux), Recharts (graphiques), React Hook Form + Zod (formulaires),
  dnd-kit (ordre des photos), Lucide (icônes), Sonner (notifications)

Dépôts liés : [`abs-immo-backend`](https://github.com/ouzking/abs-immo-backend) (schéma, RLS, fonctions — **unique
source du schéma**) et `abs-immo-frontend` (site public).

> Le back-office ne crée ni table, ni vue, ni politique, ni bucket. Il consomme le
> [contrat d'intégration](../abs_immo_backend/docs/INTEGRATION_CONTRACT.md) **v1.0.0** du backend.

## Démarrage rapide

```bash
npm ci
cp .env.example .env.local      # puis renseigner l'URL et la clé PUBLIQUE Supabase
npm run dev                     # http://localhost:5174
```

Développement complet avec la base locale et les comptes de démonstration : [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (port **5174**, URL de redirection Auth prévue par le backend) |
| `npm run build` | Vérification TypeScript + build de production (`dist/`) |
| `npm run preview` | Sert le build localement |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Tests unitaires et de composants (Vitest + Testing Library) |
| `npm run test:integration` | Tests d'intégration contre la pile Supabase **locale** (voir ci-dessous) |
| `npm run check` | lint + types + tests + build |
| `npm run types:sync` | Recopie les types du contrat depuis `../abs_immo_backend/src/types` |
| `npm run demo:photos` | Ajoute de vraies photos aux biens de démonstration (pile **locale** uniquement) |

## Fonctionnalités

| Espace | Contenu | Permissions (vérifiées par la base) |
|---|---|---|
| Tableau de bord | Indicateurs réels (`get_dashboard_stats`), évolution des demandes, catégories, vente/location, statuts commerciaux, pipeline, dernières annonces et demandes, performance par agent ; filtres période et agent | `stats.read_own` (périmètre personnel) / `stats.read_all` |
| Biens | Liste filtrable/triée/paginée (titre, référence, type, transaction, ville, publication, statut commercial, agent) ; formulaire en 11 sections avec brouillon ; fiche ; aperçu public | `properties.*` |
| Photos | Envoi multiple avec progression, aperçu, photo principale, réordonnancement (glisser-déposer + clavier), description, suppression ; bucket **privé** + URL signées | modification du bien |
| Workflow | Brouillon → validation → publication → retrait / archive ; statut commercial séparé ; mise en avant ; suppression définitive | `properties.publish`, `properties.delete` |
| Documents internes | Titres, mandats, contrats (bucket privé), téléchargement par lien signé de 60 s | modification du bien |
| Demandes | Boîte de réception par statut, filtres, détail, changement de statut, réaffectation | `leads.access_assigned` / `leads.read_all` / `leads.assign` |
| Visites | À confirmer / à venir / passées ; confirmation **avec date obligatoire**, réalisation, absence, annulation, reprogrammation | idem |
| Prospects | Liste, création manuelle, fiche, étapes, affectation, notes internes et actions de suivi, historique, effacement | `leads.*` |
| Agents | Annuaire, fiche commerciale et photo, performance, prospects en cours | lecture : personnel ; écriture : soi-même ou `agents.manage` |
| Utilisateurs | Invitation / création, rôles (règle de rang), désactivation immédiate, réinitialisation du mot de passe | `users.read`, `users.manage`, `roles.assign` |
| Paramètres | Informations publiques, logo, horaires, réseaux sociaux, aperçu ; réglages anti-abus et affectation automatique | `settings.manage` |
| Journal d'audit | Opérations sensibles (lecture seule), filtres, détail avant/après | `audit.read` |
| Profil | Nom, téléphone, mot de passe, **double authentification TOTP**, sa fiche agent | tout membre actif |

Authentification : connexion, déconnexion, mot de passe oublié, lien de réinitialisation et d'invitation, MFA,
session expirée détectée (déconnexion + message), compte désactivé ou sans rôle bloqué, pages « accès refusé ».

## Sécurité en bref

La sécurité est appliquée **par PostgreSQL** (RLS, droits par colonne, déclencheurs garde-fous), **Storage** (politiques
par bucket) et **l'Edge Function `admin-users`** (opérations sur les comptes). Les gardes de routes et le masquage des
boutons ne sont que du confort d'interface ; l'interface se fonde exclusivement sur `get_my_access` (calculé par la base).
Seule la clé **publique** est utilisée ; l'application refuse de démarrer avec une clé secrète.
Détails et liste de vérification : [docs/SECURITY.md](docs/SECURITY.md).

## Architecture

```
src/
  app/                 App, routeur (écrans chargés à la demande), QueryClient, écran de configuration
  components/ui/       Boutons, champs, tableaux, dialogues, confirmations, états vides/erreur/chargement…
  components/layout/   Coque : barre latérale rétractable, barre supérieure, menu utilisateur, navigation
  features/
    auth/              Session, droits, gardes, connexion, mot de passe, MFA
    dashboard/         Statistiques et graphiques
    properties/        Biens : services, schéma de formulaire, photos, workflow, documents, pages
    leads/             Prospects, demandes, historique, affectation
    viewings/          Visites et actions de visite
    agents/            Agents, utilisateurs et rôles
    settings/          Paramètres de l'agence et de fonctionnement
    audit/             Journal d'audit
    profile/           Profil personnel et sécurité
    reference/         Référentiels (types, équipements, localités, agents)
  hooks/               Filtres dans l'URL, garde de modifications non enregistrées
  lib/                 Client Supabase, Storage, erreurs, formats, libellés
  types/backend/       Copie NON MODIFIÉE des types du contrat backend
  pages/               404, erreur de route
tests/integration/     Parcours réels contre Supabase local
docs/                  Installation, déploiement, intégration backend, sécurité
```

Les composants n'appellent jamais Supabase directement : chaque domaine expose ses services dans `features/<domaine>/api.ts`.

## Tests

* `npm test` : 57 tests unitaires et de composants (erreurs, permissions, conversion formulaire → colonnes autorisées,
  règles de prix/loyer/statut, formats, gardes de routes, navigation selon le rôle, connexion, confirmation de visite).
* `npm run test:integration` : 16 parcours exécutés avec la couche de services réelle contre la pile Supabase locale
  (création par un agent, refus de publication, envoi de photo dans le bucket privé, conditions de publication,
  protection de la dernière photo, cloisonnement des prospects, notes internes, confirmation de visite, périmètre des
  statistiques, audit, paramètres, règle de rang des comptes). Refusent de s'exécuter sur une URL non locale.

## Documentation

* [Installation locale](docs/LOCAL_SETUP.md)
* [Déploiement](docs/DEPLOYMENT.md)
* [Intégration avec le backend](docs/BACKEND_INTEGRATION.md) (correspondances, écarts et besoins backend)
* [Sécurité et liste de vérification](docs/SECURITY.md)

## Historique

| Version | Date | Changements |
|---|---|---|
| 1.0.0 | 2026-10-17 | Version initiale, contrat backend 1.0.0 |
