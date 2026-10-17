/**
 * Copie les types partagés depuis le dépôt backend voisin (contrat d'intégration).
 * Usage : npm run types:sync [-- ../chemin/vers/abs-immo-backend]
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const candidates = [process.argv[2], '../abs-immo-backend', '../abs_immo_backend'].filter(Boolean) as string[]
const backend = candidates.map((c) => resolve(process.cwd(), c)).find((dir) => existsSync(resolve(dir, 'src/types/contracts.ts')))

if (!backend) {
  console.error(`Dépôt backend introuvable (essayé : ${candidates.join(', ')}).`)
  process.exit(1)
}

const target = resolve(process.cwd(), 'src/types/backend')
for (const file of ['database.types.ts', 'contracts.ts', 'index.ts']) {
  copyFileSync(resolve(backend, 'src/types', file), resolve(target, file))
}
const version = /CONTRACT_VERSION = "([^"]+)"/.exec(readFileSync(resolve(target, 'contracts.ts'), 'utf8'))?.[1]
console.log(`Types copiés depuis ${backend} (contrat ${version ?? 'inconnu'}).`)
console.log('Étapes suivantes : npm run typecheck, puis mettre à jour CONTRACT_VERSION_EXPECTED et src/types/backend/README.md.')
