# Intégration avec le backend

Public visé : développeurs du back-office et de `abs-immo-backend`.
Contrat consommé : **1.1.0** (`src/types/backend`, copie non modifiée de `abs-immo-backend/src/types`).

## 1. Principes

* Un seul client Supabase (`src/lib/supabase/client.ts`), clé publique, session persistée (`abs-immo-backoffice-auth`).
* Flux d'authentification **implicit** (valeur par défaut) : les invitations envoyées côté serveur par `admin-users`
  reviennent avec des jetons dans le fragment d'URL, ce qu'un client PKCE refuse.
* Droits d'interface : uniquement `get_my_access` (rôles et permissions calculés par la base, recalculés à chaque
  connexion et retour sur l'onglet). Aucun rôle n'est lu depuis le profil ou une variable modifiable.
* Écritures : toujours suivies de `.select()` ; 0 ligne renvoyée = refus RLS → message « non autorisé »
  (`expectRow`, `src/lib/errors.ts`).
* Mises à jour : seules les colonnes accordées par `GRANT UPDATE` sont envoyées (`pickUpdatable`, listes par table).
* Erreurs : SQLSTATE (`42501`, `23514` + `hint`, `23505`, `PGRST116`, `PGRST301`…) et corps `{ error }` des Edge
  Functions convertis en messages français (`src/lib/errors.ts`). Une session expirée déclenche une déconnexion locale
  et le message « Session expirée » sur l'écran de connexion.

## 2. Correspondance écran → contrat

| Écran | Ressources |
|---|---|
| Session / droits | `auth.signInWithPassword`, `resetPasswordForEmail` (→ `/reset-password`), `updateUser`, `mfa.*`, RPC `get_my_access` |
| Tableau de bord | RPC `get_dashboard_stats`, `get_inquiry_timeseries`, `get_agent_performance` ; `properties` et `inquiries` (derniers éléments) |
| Liste des biens | `properties` + jointures `agents!properties_agent_id_fkey`, `localities!properties_city_id_fkey`, `localities!properties_neighborhood_id_fkey`, `property_media` (filtre `is_cover`) ; `count: exact`, `range` |
| Formulaire du bien | `properties` (insert / update colonnes accordées), RPC `set_property_amenities`, `property_features` (CRUD), référentiels `property_types`, `amenities`, `localities` |
| Photos | Storage `property-images` (privé, chemin `<property_id>/<uuid>.<ext>` via `propertyFilePath`), `property_media`, RPC `reorder_property_media`, `createSignedUrls` (1 h) |
| Workflow | `properties.publication_status`, `commercial_status`, `is_featured` ; refus `23514` avec `PUBLISH_REQUIRES_COVER`, `PUBLISH_REQUIRES_SHORT_DESCRIPTION` ; `LAST_MEDIA_OF_PUBLISHED_PROPERTY` |
| Documents | Storage `property-documents` (privé), `property_documents`, URL signée de téléchargement (60 s) |
| Demandes / visites / prospects | `inquiries`, `viewing_requests`, `leads`, `lead_activities` (types manuels), RPC `assign_lead` |
| Agents | `agents` (+ `profiles`), Storage public `agent-photos` (`<profile_id>/…`) |
| Utilisateurs | RPC `list_users`, `assign_role`, `revoke_role` ; Edge Function `admin-users` (`invite`, `create`, `deactivate`, `reactivate`, `send_password_reset`) |
| Paramètres | `agency_settings` (colonnes accordées), Storage public `site-assets` (`branding/…`), `app_settings` |
| Audit | `audit_logs` (lecture), `profiles` pour le nom des auteurs |

Envois avec progression : `XMLHttpRequest` sur `POST /storage/v1/object/<bucket>/<chemin>` avec le jeton de session
(mêmes politiques que `supabase.storage.upload`, qui n'expose pas la progression). En cas d'échec de l'enregistrement en
base après l'envoi, le fichier est supprimé (pas d'orphelin).

## 3. Choix d'interface liés au modèle

**Version anglaise (1.1.0).** Section « Version anglaise » du formulaire : `title_en` (5–160 caractères si renseigné),
`short_description_en`, `description_en`, `seo_title_en`, `seo_description_en`. Champ vide envoyé comme `null` : le site
anglais (/en) affiche alors le français avec « not translated yet ». État de traduction affiché dans la fiche (badge),
marqueur « EN » dans la liste, aperçu bascule Français / English avec le même repli que le site.

**Consignes d'affichage du site public.** Rappelées dans l'interface sans être bloquantes : photos en paysage d'au moins
1600 px (avertissement par photo), texte alternatif (champ signalé s'il est vide), 6 annonces « à la une » au maximum
sur l'accueil (compteur et confirmation au-delà). Statut `reserved` libellé « Sous option », comme sur le site.

**Statuts des prospects.** Le cahier des charges cite « Nouveau, À contacter, En cours, Visite programmée, Converti,
Non abouti ». Le backend (source d'autorité) définit `new, contacted, qualified, visit_scheduled, negotiation, won, lost`.
Libellés retenus : Nouveau, Contacté, En cours (`qualified`), Visite programmée, En négociation, Converti (`won`),
Non abouti (`lost`). « À contacter » correspond à « Nouveau » (prospect pas encore contacté).

**Visites.** « Confirmée » exige une date (`scheduled_at`) : contrôle côté interface **et** contrainte en base ; le
statut affiché provient de la ligne relue après écriture. Les dates sont saisies et affichées à l'heure de Dakar (UTC+0).

**Biens vendus / loués.** Le statut commercial est distinct de la publication : une annonce vendue reste visible sur le
site avec le badge « Vendu » (comportement du backend et du site public), jamais comme disponible ; le back-office
propose alors de la retirer du site.

## 4. Écarts et besoins backend (à arbitrer)

| Sujet | Situation | Proposition |
|---|---|---|
| Évolution des statuts commerciaux dans le temps | Aucune série temporelle des changements de `commercial_status` (seulement l'état actuel et `sold/rented_in_period`). Le tableau de bord affiche donc la répartition actuelle et les ventes/locations de la période. | RPC `get_commercial_status_timeseries(p_from, p_to, p_interval)` fondée sur `audit_logs` ou une table d'historique |
| MFA obligatoire pour les administrateurs | Le back-office demande le code TOTP si un facteur est activé, mais la base n'exige pas `aal2` | Politique RLS ou garde dans `private.has_permission` exigeant `auth.jwt()->>'aal' = 'aal2'` pour les permissions d'administration |
| Notification du prospect | Confirmer une visite ne prévient pas le prospect (l'interface le rappelle) | Edge Function d'envoi (e-mail/WhatsApp) déclenchée à la confirmation |
| Référentiels | Le backend permet `catalog.manage` (types, équipements, localités) ; l'écran correspondant n'est pas encore construit côté back-office | Écran « Référentiels » (activation / ajout de quartiers) — évolution du back-office, aucun besoin backend |
| Effacement d'un compte | Désactivation seulement (choix du backend : conserver biens et prospects) | Conforme ; suppression par l'éditeur SQL si nécessaire |
| Photos du seed | Chemins `…/demo-1.jpg` sans fichier dans Storage | Ajouter des fichiers de démonstration au seed (confort local uniquement) |

## 5. Évolution du contrat

Mineure (ajout) : `npm run types:sync`, aucune adaptation obligatoire. Majeure : adapter les services concernés
(`features/*/api.ts`), relancer `npm run check` et `npm run test:integration` sur la nouvelle version locale du backend.
