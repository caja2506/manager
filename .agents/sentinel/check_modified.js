import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file === '.agents' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }
    if (stat.isDirectory()) {
      getFiles(fullPath, files);
    } else {
      files.push({ path: fullPath, mtime: stat.mtime });
    }
  }
  return files;
}

const allFiles = getFiles(path.resolve(__dirname, '../..'));
allFiles.sort((a, b) => b.mtime - a.mtime);
const top5 = allFiles.slice(0, 5);
top5.forEach(f => console.log(f.path));
