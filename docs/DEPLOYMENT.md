# Déploiement

Public visé : responsable technique chargé de mettre le back-office en ligne.

Le back-office est une application statique (SPA). Il se déploie sur tout hébergeur statique ; la configuration
fournie vise **Vercel** (`vercel.json`), comme le site public. Domaine conseillé : `https://admin.abs-immo.sn`.

## 1. Prérequis côté backend (une fois)

Dans le projet Supabase partagé (`sasssoloprjakfysajvt`), via `abs-immo-backend` (voir son `docs/DEPLOYMENT.md`) :

1. Migrations et Edge Functions déployées (`db push`, `deploy:functions`).
2. Secret **`BACKOFFICE_ORIGINS`** contenant l'origine exacte du back-office :
   `npx supabase secrets set BACKOFFICE_ORIGINS="https://admin.abs-immo.sn"` (sinon les appels à `admin-users`
   sont refusés par le navigateur).
3. Dashboard → Authentication → URL Configuration :
   * Site URL : `https://admin.abs-immo.sn`
   * Redirect URLs : `https://admin.abs-immo.sn/**` (liens de réinitialisation et d'invitation vers `/reset-password`).
4. Inscription publique **désactivée**, politique de mot de passe (≥ 10, minuscule, majuscule, chiffre), MFA TOTP activé,
   SMTP de l'agence configuré, modèles d'e-mails en français.
5. Premier super administrateur créé (`docs/FIRST_ADMIN.md` du backend).

## 2. Variables d'environnement (hébergeur)

| Variable | Valeur | Secret ? |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://sasssoloprjakfysajvt.supabase.co` | non |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé `sb_publishable_…` (Dashboard → API Keys) | non (publique par conception) |
| `VITE_PUBLIC_SITE_URL` | `https://www.abs-immo.sn` | non |

**Ne jamais** définir de clé `service_role` / `sb_secret_…` : elles seraient intégrées au JavaScript livré.
L'application refuse de démarrer si elle en détecte une.

## 3. Vercel

1. Importer le dépôt `abs-immo-backoffice` ; framework « Vite » (détecté), commande `npm run build`, sortie `dist`.
2. Renseigner les variables ci-dessus pour *Production* (et *Preview* si un projet Supabase de recette existe ; sinon
   ne pas exposer les déploiements de prévisualisation sur la base de production).
3. Ajouter le domaine `admin.abs-immo.sn`.
4. `vercel.json` fournit :
   * la réécriture SPA vers `index.html` ;
   * le cache long des fichiers fingerprintés (`/assets`) ;
   * les en-têtes de sécurité : CSP stricte (scripts du domaine uniquement ; connexions limitées à `*.supabase.co`),
     `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Robots-Tag: noindex`.

Si le projet Supabase utilise un **domaine personnalisé**, l'ajouter aux directives `img-src` et `connect-src` de la CSP.

### Autre hébergeur

Servir `dist/` avec : réécriture de toute route inconnue vers `/index.html`, les mêmes en-têtes que `vercel.json`,
HTTPS obligatoire.

## 4. Mise en production d'une version

1. PR → CI verte (lint, types, tests, build, recherche de clés secrètes).
2. Si le contrat backend a changé : `npm run types:sync`, adaptations, `npm run test:integration` en local.
3. Fusion sur `main` → déploiement automatique.
4. Recette rapide : connexion, tableau de bord, création d'un brouillon avec photo, publication par un responsable,
   confirmation d'une visite, consultation du journal d'audit.

## 5. Retour arrière

Vercel → Deployments → « Promote to Production » sur le déploiement précédent. Le back-office n'a pas d'état propre :
un retour arrière est sans risque tant que le contrat backend reste compatible.
