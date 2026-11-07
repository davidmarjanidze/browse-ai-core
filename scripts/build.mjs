// Builds the package into dist/browse-ai-core:
//   1. ng-packagr: core ('.') and Angular ('./angular') entries
//   2. Angular application builder: the custom element ('./element')
//   3. tsc: React ('./react') and Vue ('./vue') wrappers
import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync
} from 'node:fs'
import { join } from 'node:path'

const dist = 'dist/browse-ai-core'
const run = (command) => execSync(command, { stdio: 'inherit' })

rmSync('dist', { recursive: true, force: true })

run('npx ng build browse-ai-core')
run('npx ng build element')

mkdirSync(join(dist, 'element'), { recursive: true })
copyFileSync(
  'dist/element-build/main.js',
  join(dist, 'element/browse-ai-core.js')
)
copyFileSync('projects/element/index.d.ts', join(dist, 'element/index.d.ts'))
rmSync('dist/element-build', { recursive: true, force: true })

run('npx tsc -p projects/react/tsconfig.json')
run('npx tsc -p projects/vue/tsconfig.json')

for (const file of ['README.md', 'LICENSE'])
  copyFileSync(file, join(dist, file))

const manifest = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8'))
for (const [subpath, target] of Object.entries(manifest.exports)) {
  for (const file of Object.values(target)) {
    if (!existsSync(join(dist, file))) {
      throw new Error(`exports["${subpath}"] points to a missing file: ${file}`)
    }
  }
}
console.log(`\nBuilt ${manifest.name}@${manifest.version} in ${dist}`)
