---
name: environment-setup
description: Cómo usar Node.js, npm, Firebase CLI y Git en este proyecto. Lee esto SIEMPRE antes de ejecutar cualquier comando de terminal.
---

# Entorno de Desarrollo — AutoBOM Pro

## ⚠️ CRÍTICO: Node.js no está en el PATH del sistema

Este proyecto usa un Node.js portátil instalado dentro del repo. **SIEMPRE** debes agregar el PATH antes de ejecutar cualquier comando npm/npx/node:

```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"
```

### Versiones
- **Node.js**: v20.11.1
- **npm**: 10.2.4
- **Shell**: PowerShell (Windows)
- **Package Manager**: npm (NO yarn, NO pnpm)

---

## 📁 Rutas Clave

| Recurso | Ruta |
|---------|------|
| **Proyecto raíz** | `c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro` |
| **Node.js portátil** | `c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64` |
| **Firebase project** | `bom-ame-cr` |
| **Hosting URL** | `https://bom-ame-cr.web.app` |
| **GitHub repo** | `https://github.com/caja2506/manager.git` |
| **Branch** | `main` |

---

## 🔧 Comandos Frecuentes

### Prefijo obligatorio para TODOS los comandos
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"
```

### Instalar dependencias
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npm install
```

### Dev server
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npm run dev
```

### Build producción
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npm run build
```

### Deploy a Firebase Hosting
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx -y firebase-tools deploy --only hosting
```

### Build + Deploy + Git (combo completo)
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npm run build; npx -y firebase-tools deploy --only hosting; git add -A; git commit -m "deploy: descripción del cambio"; git push origin main
```

### Lint (con fix automático)
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx eslint . --fix
```

### Tests
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx vitest run
```

---

## 🔀 Git

### Configuración
- **Remote**: `origin` → `https://github.com/caja2506/manager.git`
- **Branch**: `main`
- **Auth**: Token embebido en la URL del remote (no requiere login interactivo)

### Comandos Git (no requieren el PATH de Node)
```powershell
# Ver estado
git status

# Stage + Commit + Push
git add -A
git commit -m "feat: descripción del cambio"
git push origin main

# Pull últimos cambios
git pull origin main
```

### Convención de Commits
- `feat:` — nueva funcionalidad
- `fix:` — corrección de bug
- `refactor:` — reestructuración sin cambio funcional
- `style:` — cambios de estilo/CSS
- `docs:` — documentación
- `deploy:` — despliegue general

---

## 🔥 Firebase

### Proyecto
- **ID**: `bom-ame-cr`
- **Hosting URL**: `https://bom-ame-cr.web.app`
- **Console**: `https://console.firebase.google.com/project/bom-ame-cr/overview`

### Firebase CLI
Firebase CLI se instala on-the-fly con `npx -y firebase-tools`:
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx -y firebase-tools deploy --only hosting
```

> **NOTA**: Usar `npx -y firebase-tools` (con `-y` para auto-confirmar) en lugar de `firebase` directamente, ya que firebase-tools no está instalado globalmente.

---

## ⚡ Notas Importantes

1. **SIEMPRE SafeToAutoRun = true** — El usuario ha dado permiso permanente para ejecutar comandos sin pedir aprobación.
2. **El build puede reportar exit code 1** incluso cuando es exitoso — esto ocurre por warnings de ESLint. Buscar `✓ built in` en la salida para confirmar éxito.
3. **El CWD para TODOS los comandos debe ser**: `c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro`
4. **No usar `cd`** — Especificar el Cwd directamente en run_command.
5. **Combinar comandos con `;`** en PowerShell para ejecutar en secuencia (ej: `build; deploy; git push`).
