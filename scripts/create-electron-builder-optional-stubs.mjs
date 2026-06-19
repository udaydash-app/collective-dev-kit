import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lockPath = path.join(root, 'package-lock.json');
const nodeModulesPath = path.join(root, 'node_modules');

if (!fs.existsSync(lockPath) || !fs.existsSync(nodeModulesPath)) {
  process.exit(0);
}

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const packages = lock.packages || {};
let created = 0;

const cleanVersion = (value) => String(value || '0.0.0').replace(/^[~^<>=\s]+/, '') || '0.0.0';

for (const [packagePath, meta] of Object.entries(packages)) {
  if (!packagePath.startsWith('node_modules/') || !meta?.optionalDependencies) continue;

  for (const [dependencyName, dependencyRange] of Object.entries(meta.optionalDependencies)) {
    const dependencyLockPath = `node_modules/${dependencyName}`;
    if (!packages[dependencyLockPath]) continue;

    const dependencyDir = path.join(root, dependencyLockPath);
    if (fs.existsSync(dependencyDir)) continue;

    fs.mkdirSync(dependencyDir, { recursive: true });
    fs.writeFileSync(
      path.join(dependencyDir, 'package.json'),
      JSON.stringify(
        {
          name: dependencyName,
          version: cleanVersion(packages[dependencyLockPath]?.version || dependencyRange),
          private: true,
          optional: true,
          electronBuilderStub: true,
        },
        null,
        2,
      ) + '\n',
    );
    created += 1;
  }
}

if (created > 0) {
  console.log(`Created ${created} missing optional native dependency stub(s) for electron-builder.`);
} else {
  console.log('No missing optional native dependency stubs needed.');
}