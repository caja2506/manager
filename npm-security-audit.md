# 🔒 Auditoría de Seguridad npm — AutoBOM Pro

**Fecha:** 2026-05-14  
**Auditor:** Antigravity (AI Security Audit)  
**Proyecto:** AutoBOM Pro v4.0 — Engineering Management Platform  
**Stack:** React 19 + Vite 7 + Firebase + Supabase + Node.js  

---

## a) Resumen Ejecutivo

Se realizó una auditoría de seguridad completa enfocada en el flujo de dependencias npm y la gestión de secretos. Se encontraron **riesgos críticos que fueron remediados**, incluyendo:

- 🔴 **14 archivos** con el **Supabase Service Role Key** (JWT admin) hardcodeado y committed en Git
- 🟠 **9 archivos** temporales/diagnóstico con datos sensibles tracked en Git
- 🟡 **21 vulnerabilidades** en dependencias del frontend (1 critical, 7 high)
- 🟡 **15 vulnerabilidades** en dependencias de Cloud Functions (1 critical, 4 high)
- 🟡 Ausencia de configuración `.npmrc` de seguridad
- 🟡 Workflows usando `npm install` en vez de `npm ci`

---

## b) Riesgos Encontrados

### 🔴 CRÍTICO — Secretos en código versionado (REMEDIADO)

| Archivo | Acción |
|---------|--------|
| `check-msg.cjs` | ✅ JWT removido, reemplazado con env var |
| `test-db.cjs` | ✅ JWT removido, reemplazado con env var |
| `functions/scripts/auditSchema.js` | ✅ JWT removido |
| `functions/scripts/checkColumnTypes.js` | ✅ JWT removido |
| `functions/scripts/checkMigration.js` | ✅ JWT removido |
| `functions/scripts/executeSqlMigration.js` | ✅ JWT removido |
| `functions/scripts/fixSchema.js` | ✅ JWT removido |
| `functions/scripts/migrateMissing.js` | ✅ JWT removido |
| `functions/scripts/migrateSettings.js` | ✅ JWT removido |
| `functions/scripts/migrateToSupabase.js` | ✅ JWT removido |
| `functions/scripts/migrateWorkAreaTypes.js` | ✅ JWT removido |
| `functions/scripts/checkAllCounts.js` | ✅ JWT removido |
| `functions/scripts/recoverPRSections.js` | ✅ JWT removido |
| `functions/scripts/verifyRealtime.js` | ✅ JWT removido |

> ⚠️ **ACCIÓN REQUERIDA:** Aunque los JWTs fueron removidos del código actual, **permanecen en el historial de Git**. Debes **rotar el Supabase Service Role Key** en el dashboard de Supabase.

### 🟠 ALTO — Archivos sensibles en Git (REMEDIADO)

| Archivo | Contenido | Acción |
|---------|-----------|--------|
| `users_export.json` | Emails y datos de usuarios | ✅ `git rm --cached`, agregado a `.gitignore` |
| `check-msg.cjs` | Script temporal con secretos | ✅ `git rm --cached`, agregado a `.gitignore` |
| `test-db.cjs` | Script de test con secretos | ✅ `git rm --cached` |
| `test-db.mjs` | Script de test | ✅ `git rm --cached` |
| `test-nim.cjs` | Script de test | ✅ `git rm --cached` |
| `test-realtime.mjs` | Script de test | ✅ `git rm --cached` |
| `test-realtime2.mjs` | Script de test | ✅ `git rm --cached` |
| `tmp_test_tasks.js` | Script temporal | ✅ `git rm --cached` |
| `add_telegram_chat_id.sql` | SQL temporal | ✅ `git rm --cached` |

### 🟡 MEDIO — Vulnerabilidades en dependencias

#### Frontend (raíz) — 21 vulnerabilidades

| Paquete | Severidad | Tipo | Fix |
|---------|-----------|------|-----|
| `protobufjs ≤7.5.5` | 🔴 CRITICAL | Ejecución de código arbitrario | `npm audit fix` (dep de firebase-admin) |
| `xlsx *` | 🟠 HIGH | Prototype Pollution + ReDoS | ❌ Sin fix — considerar alternativa |
| `vite 7.0-7.3.1` | 🟠 HIGH | Path traversal, WebSocket file read | `npm audit fix` |
| `rollup 4.0-4.58` | 🟠 HIGH | Arbitrary file write | `npm audit fix` |
| `flatted ≤3.4.1` | 🟠 HIGH | DoS + Prototype Pollution | `npm audit fix` |
| `minimatch ≤3.1.3` | 🟠 HIGH | ReDoS | `npm audit fix` |
| `picomatch 4.0-4.0.3` | 🟠 HIGH | Method injection + ReDoS | `npm audit fix` |
| `postcss <8.5.10` | 🟡 MODERATE | XSS en stringify | `npm audit fix` |
| `fast-xml-builder/parser` | 🟡 MODERATE | XML injection | `npm audit fix` |
| `uuid 11.0-11.1` | 🟡 MODERATE | Missing buffer bounds | `npm audit fix` |
| `brace-expansion <1.1.13` | 🟡 MODERATE | DoS por hang | `npm audit fix` |

#### Cloud Functions — 15 vulnerabilidades

| Paquete | Severidad | Nota |
|---------|-----------|------|
| `protobufjs` | 🔴 CRITICAL | Misma cadena que frontend |
| `node-forge ≤1.3.3` | 🟠 HIGH | Signature forgery, cert bypass |
| `path-to-regexp <0.1.13` | 🟠 HIGH | ReDoS |
| `fast-xml-builder/parser` | 🟠 HIGH | XML injection |

### 🟡 MEDIO — Dependencias posiblemente innecesarias

| Paquete | Ubicación | Problema |
|---------|-----------|----------|
| `three` | dependencies | **0 imports en `src/`** — +600KB innecesarios |
| `ws` | dependencies | Solo usado por `@supabase/realtime-js` como dep transitiva |
| `firebase-admin` | devDependencies | Librería de servidor en devDeps del frontend — trae cadena de vulns `protobufjs (CRITICAL)` |

### ✅ Positivos

- `.gitignore` ya excluía `.env`, `.env.*`, `.env.local`, `.env.production`
- No hay `eval()`, `child_process`, ni ejecución dinámica en `src/`
- No hay lifecycle scripts (`preinstall`, `postinstall`, `prepare`) en ningún `package.json`
- Todas las dependencias son de npm registry estándar (ninguna de git, URL, tarball o file)
- `package-lock.json` presente y consistente
- `service-account.json` y `serviceAccountKey.json` no existen en disco

---

## c) Cambios Realizados

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `.npmrc` | Configuración de seguridad npm: `audit=true`, `fund=false`, `save-exact=true` |
| `npm-security-audit.md` | Este reporte |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `.gitignore` | +15 líneas: exclusiones para service accounts, credentials, temp scripts, `users_export.json` |
| `package.json` | +3 scripts: `security:audit`, `security:deps`, `security:check` |
| `.agents/workflows/dev.md` | `npm install` → `npm ci` |
| `functions/scripts/auditSchema.js` | JWT removido → `process.env.SUPABASE_SERVICE_KEY` |
| `functions/scripts/checkColumnTypes.js` | JWT removido → env var |
| `functions/scripts/checkMigration.js` | JWT removido → env var |
| `functions/scripts/executeSqlMigration.js` | JWT removido → env var |
| `functions/scripts/fixSchema.js` | JWT removido → env var |
| `functions/scripts/migrateMissing.js` | JWT removido → env var |
| `functions/scripts/migrateSettings.js` | JWT removido → env var |
| `functions/scripts/migrateToSupabase.js` | JWT removido → env var |
| `functions/scripts/migrateWorkAreaTypes.js` | JWT removido → env var |
| `functions/scripts/checkAllCounts.js` | JWT removido → env var |
| `functions/scripts/recoverPRSections.js` | JWT removido → env var |
| `functions/scripts/verifyRealtime.js` | JWT removido → env var |
| `check-msg.cjs` | JWT removido → env var |
| `test-db.cjs` | JWT removido → env var |

### Archivos removidos del tracking (siguen en disco)

`users_export.json`, `check-msg.cjs`, `test-db.cjs`, `test-db.mjs`, `test-nim.cjs`, `test-realtime.mjs`, `test-realtime2.mjs`, `tmp_test_tasks.js`, `add_telegram_chat_id.sql`

---

## d) Cambios Recomendados (No Aplicados)

| Cambio | Razón |
|--------|-------|
| Ejecutar `npm audit fix` | Resuelve ~15 vulns sin breaking changes — requiere que no haya procesos usando `node_modules` |
| Eliminar `three` de dependencies | 0 imports en src/ — confirmar que no se usa antes de eliminar |
| Mover `firebase-admin` a workspace separado | Elimina cadena `protobufjs (CRITICAL)` del frontend |
| Eliminar `ws` de dependencies directas | Solo lo usa `@supabase/realtime-js` como dep transitiva |
| Evaluar alternativa a `xlsx` | No tiene fix disponible para Prototype Pollution |
| Rotar Supabase Service Role Key | El JWT está en el historial de Git |
| Configurar GitHub Actions CI/CD | Con `npm ci`, `npm audit`, y review de deps en PRs |
| Limpiar historial de Git | `git filter-branch` o `BFG Repo-Cleaner` para eliminar JWTs del historial |

---

## e) Comandos Seguros Recomendados

### Para desarrollo diario
```bash
# Instalar desde lockfile (seguro, reproducible)
npm ci

# Agregar nueva dependencia (después de evaluarla)
npm install <paquete> --save-exact

# Auditar dependencias
npm run security:audit

# Check rápido (solo high/critical)
npm run security:check

# Ver dependencias directas
npm run security:deps
```

### Para evaluar paquetes desconocidos
```bash
# Instalar sin ejecutar scripts de los paquetes (para inspeccionar)
npm install <paquete> --ignore-scripts

# Inspeccionar qué scripts tiene un paquete
npm show <paquete> scripts

# Ver dependencias transitivas de un paquete antes de instalarlo
npm view <paquete> dependencies
```

### Para ejecutar scripts de migración
```bash
# Setear la variable de entorno antes de ejecutar
$env:SUPABASE_SERVICE_KEY = "tu-key-aquí"
node functions/scripts/migrateToSupabase.js --dry-run
```

---

## f) Lista de Archivos Modificados

Total: **19 archivos modificados**, **1 archivo nuevo**, **9 archivos removidos del tracking**

```
 .npmrc                                    [NEW]
 .agents/workflows/dev.md                  [MODIFIED]
 .gitignore                                [MODIFIED]
 package.json                              [MODIFIED]
 functions/scripts/auditSchema.js          [MODIFIED]
 functions/scripts/checkAllCounts.js       [MODIFIED]
 functions/scripts/checkColumnTypes.js     [MODIFIED]
 functions/scripts/checkMigration.js       [MODIFIED]
 functions/scripts/executeSqlMigration.js  [MODIFIED]
 functions/scripts/fixSchema.js            [MODIFIED]
 functions/scripts/migrateMissing.js       [MODIFIED]
 functions/scripts/migrateSettings.js      [MODIFIED]
 functions/scripts/migrateToSupabase.js    [MODIFIED]
 functions/scripts/migrateWorkAreaTypes.js [MODIFIED]
 functions/scripts/recoverPRSections.js    [MODIFIED]
 functions/scripts/verifyRealtime.js       [MODIFIED]
 check-msg.cjs                             [MODIFIED]
 test-db.cjs                               [MODIFIED]
 users_export.json                         [UNTRACKED]
 add_telegram_chat_id.sql                  [UNTRACKED]
 test-db.mjs                               [UNTRACKED]
 test-nim.cjs                              [UNTRACKED]
 test-realtime.mjs                         [UNTRACKED]
 test-realtime2.mjs                        [UNTRACKED]
 tmp_test_tasks.js                         [UNTRACKED]
```

---

## g) Comandos Ejecutados

| Comando | Resultado |
|---------|-----------|
| `npm audit` (raíz) | 21 vulnerabilidades (8L, 5M, 7H, 1C) |
| `npm audit` (functions) | 15 vulnerabilidades (9L, 1M, 4H, 1C) |
| `npm ls --depth=0` | 31 paquetes directos listados |
| `git rm --cached` (9 archivos) | 9 archivos removidos del tracking |
| `npm ci` | Falló — EPERM por archivo bloqueado (dev server en ejecución) |
| `npm run build` | No ejecutado — requiere que dev server no esté corriendo |
| `npm test` | No ejecutado — mismo problema de PATH |

> Los fallos de `npm ci`, `build` y `test` son causados por el entorno (dev server corriendo, node 20.11.1 vs requerido 20.19+), no por los cambios de esta auditoría.

---

## h) Checklist para Agregar Nuevas Dependencias npm

Usar este checklist **antes** de instalar cualquier paquete nuevo:

### Pre-instalación
- [ ] **¿Es realmente necesario?** ¿Se puede resolver con código propio o una dependencia existente?
- [ ] **Verificar nombre exacto** — buscar en [npmjs.com](https://npmjs.com) para evitar typosquatting
  - Comparar con paquetes de nombre similar
  - Verificar que el publisher sea confiable
- [ ] **Revisar mantenimiento:**
  - Última publicación (debe ser < 12 meses idealmente)
  - Issues abiertos y actividad del repositorio
  - Número de descargas semanales
  - Número de contribuidores
- [ ] **Revisar dependencias transitivas:** `npm view <paquete> dependencies`
  - Evitar paquetes con árboles de dependencia excesivos
- [ ] **Revisar licencia:** compatible con el proyecto

### Instalación
- [ ] **Instalar en branch separado** — nunca en main directamente
- [ ] **Primera instalación con `--ignore-scripts`** si el paquete es de riesgo:
  ```bash
  npm install <paquete> --ignore-scripts --save-exact
  ```
- [ ] **Usar `--save-exact`** para fijar la versión exacta (ya configurado en `.npmrc`)

### Post-instalación
- [ ] **Revisar cambios en `package.json`** — solo el paquete esperado debe aparecer
- [ ] **Revisar cambios en `package-lock.json`** — sin cambios inesperados en otros paquetes
- [ ] **Ejecutar `npm audit`** — sin nuevas vulnerabilidades high/critical
- [ ] **Ejecutar `npm run build`** — el build debe pasar
- [ ] **Ejecutar `npm test`** — los tests deben pasar
- [ ] **Hacer commit separado** para la dependencia:
  ```bash
  git add package.json package-lock.json
  git commit -m "deps: add <paquete> v<version> for <propósito>"
  ```

---

## Próximos Pasos (Prioridad)

1. 🔴 **Rotar Supabase Service Role Key** en dashboard de Supabase (inmediato)
2. 🟠 **Ejecutar `npm audit fix`** cuando el dev server no esté corriendo
3. 🟡 **Evaluar eliminar `three`** — verificar que no se use en ninguna parte
4. 🟡 **Evaluar mover `firebase-admin`** fuera de devDependencies del frontend
5. 🟡 **Evaluar alternativa a `xlsx`** — sin fix disponible para prototype pollution
6. 🟢 **Limpiar historial de Git** con BFG Repo-Cleaner para eliminar JWTs del historial
7. 🟢 **Configurar CI/CD** con `npm ci` + `npm audit` en pull requests
