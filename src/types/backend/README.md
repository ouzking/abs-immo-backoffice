# Types partagés du backend

Copie **non modifiée** de `abs-immo-backend/src/types/` (contrat d'intégration **1.1.0**,
commit `554f340`, migration `20261020000100_bilingual_listings`).

- `database.types.ts` : généré depuis le schéma (`npm run types:gen` côté backend).
- `contracts.ts` : alias métier, formes JSON des RPC, corps des Edge Functions, codes d'erreur.

Ne modifiez jamais ces fichiers ici. À chaque nouvelle version du contrat :

```bash
npm run types:sync   # copie depuis ../abs_immo_backend/src/types
npm run typecheck
```

puis mettez à jour la version ci-dessus et `CONTRACT_VERSION_EXPECTED` dans `src/config/env.ts`.
