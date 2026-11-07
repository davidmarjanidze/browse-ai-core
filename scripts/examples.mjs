// Installs browse-ai-core into copies of the example apps and builds them.
//
//   node scripts/examples.mjs <package> <work-dir>
//
// <package> is anything `npm install` accepts: a version from npm
// ("browse-ai-core@0.1.0") or a tarball made with `npm pack`.
import { execSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'

const [spec, workDirArg] = process.argv.slice(2)
if (!spec || !workDirArg) {
  console.error('Usage: node scripts/examples.mjs <package> <work-dir>')
  process.exit(1)
}

const workDir = resolve(workDirArg)
const source = existsSync(spec) ? resolve(spec) : spec
const run = (command, cwd) => execSync(command, { cwd, stdio: 'inherit' })

mkdirSync(workDir, { recursive: true })

for (const name of ['angular', 'react', 'vue']) {
  const dir = join(workDir, name)
  rmSync(dir, { recursive: true, force: true })
  cpSync(join('examples', name), dir, { recursive: true })

  const manifestPath = join(dir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  delete manifest.dependencies['browse-ai-core']
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`\n=== ${name} ===`)
  run('npm install --no-audit --no-fund', dir)
  run(`npm install --no-audit --no-fund ${JSON.stringify(source)}`, dir)
  run('npm run build', dir)
}

// Plain HTML: load the installed element bundle the same way the CDN would.
const bundle = join(
  workDir,
  'react/node_modules/browse-ai-core/element/browse-ai-core.js'
)
console.log('\n=== html ===')
run(
  `node ${JSON.stringify(resolve('scripts/smoke-element.mjs'))} ${JSON.stringify(bundle)}`
)

console.log('\nAll examples built.')
