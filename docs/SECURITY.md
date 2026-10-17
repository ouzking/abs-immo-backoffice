# Sécurité du back-office

Public visé : développeurs et responsable technique.

## 1. Modèle

| Couche | Rôle |
|---|---|
| PostgreSQL (RLS, droits par colonne, déclencheurs) | **Autorité** : qui lit et modifie quoi, transitions de statut, règle de rang, colonnes protégées |
| Storage (politiques par bucket) | Photos et documents privés ; écriture limitée à qui peut modifier le bien |
| Edge Function `admin-users` | Opérations sur les comptes (clé serveur côté Supabase uniquement), droits revérifiés en base |
| Back-office (React) | Confort : masque les actions non autorisées, explique les refus. **Ne protège rien à lui seul.** |

Conséquences concrètes :

* Les droits affichés viennent de `get_my_access`. Modifier une variable React, le stockage local ou un profil ne donne
  aucun droit : la base recalcule tout à chaque requête (test « Accès refusé avec rôle falsifié »).
* Changer un identifiant dans l'URL ne donne accès à rien : la ligne n'est pas renvoyée (RLS), l'écran affiche
  « introuvable ». Vérifié par les tests d'intégration (agent 2 → prospect de l'agent 1).
* Un compte désactivé perd immédiatement ses droits (fonctions d'autorisation) et la connexion est bloquée.
* Les notes internes (`lead_activities`) ne sont lisibles que par qui accède au prospect, ne sont pas modifiables, et
  les types « système » ne peuvent pas être forgés (test d'intégration).
* Les photos des brouillons restent privées : bucket privé + URL signées d'une heure ; `anon` ne peut signer que les
  photos d'annonces publiées.

## 2. Secrets

* Variables `VITE_*` = **publiques** (intégrées au JavaScript). Seule la clé publishable/anon y figure.
* `src/config/env.ts` refuse de démarrer avec une clé `sb_secret_…` ou un JWT `service_role`.
* `.env*` ignorés par Git (sauf `.env.example`). La CI recherche les motifs de clés secrètes dans le dépôt et le build.
* Aucun mot de passe, numéro ou adresse fictifs dans le code ; les données de démonstration sont celles du seed backend
  (pile locale uniquement).

## 3. Navigateur

* Session Supabase dans `localStorage` (clé `abs-immo-backoffice-auth`), rafraîchie automatiquement ; déconnexion
  locale en cas de jeton expiré ou de refus de rafraîchissement.
* CSP stricte (`vercel.json`) : scripts du domaine uniquement, connexions limitées à Supabase, aucun cadre autorisé
  (`frame-ancestors 'none'`, protection contre le clickjacking), `noindex`.
* Aucun contenu utilisateur injecté en HTML brut (pas de `dangerouslySetInnerHTML`) ; le QR code MFA est une image.
* SVG refusé pour le logo (risque XSS), formats contrôlés côté interface puis par les buckets.
* Recherche : caractères réservés de la syntaxe PostgREST `or=(…)` neutralisés (`sanitizeSearch`).

## 4. Liste de vérification avant mise en production

- [ ] `npm run check` vert ; `npm run test:integration` vert contre la version du backend déployée (en local).
- [ ] Variables d'hébergement : URL + clé **publishable** uniquement ; aucune clé secrète (la CI le vérifie aussi).
- [ ] `BACKOFFICE_ORIGINS` contient exactement l'origine du back-office.
- [ ] Supabase Auth : inscription publique désactivée, Site URL et Redirect URLs limitées au domaine du back-office,
      politique de mot de passe, confirmation d'e-mail, SMTP de l'agence.
- [ ] MFA TOTP activé dans Supabase **et utilisé** par chaque super administrateur et administrateur
      (« Mon profil et sécurité »).
- [ ] Deux super administrateurs actifs (le dernier est protégé contre la désactivation).
- [ ] En-têtes de `vercel.json` présents en production (vérifier avec les outils du navigateur) ; CSP adaptée si
      domaine Supabase personnalisé.
- [ ] HTTPS forcé sur le domaine du back-office.
- [ ] Les déploiements de prévisualisation ne pointent pas vers la base de production (ou sont protégés par mot de passe).
- [ ] Revue trimestrielle : comptes actifs (« Utilisateurs »), rôles, journal d'audit.
- [ ] Liste de vérification du backend (`abs-immo-backend/docs/SECURITY.md` § 8) appliquée.
