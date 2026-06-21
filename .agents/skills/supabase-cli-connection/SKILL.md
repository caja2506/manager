---
name: supabase-cli-connection
description: Instrucciones y comandos para interactuar con la base de datos Supabase usando Supabase CLI (npx supabase).
---

# Skill: Supabase CLI Connection

Esta guía define las instrucciones de uso de Supabase CLI en este proyecto para interactuar directamente con la base de datos remota (`bom-ame-cr`).

## ⚠️ Prefijo de Node Obligatorio

Al igual que con otros comandos del proyecto, **SIEMPRE** debes anteponer el PATH de Node.js portátil antes de ejecutar cualquier comando de Supabase CLI:

```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"
```

## 🔧 Comandos Clave de Supabase CLI

### 1. Listar Migraciones (Local vs Remote)
Muestra qué migraciones se han aplicado localmente en el repo y cuáles están presentes en la base de datos remota.
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx supabase migration list
```

### 2. Ejecutar Consultas SQL Directas (Query)
Puedes ejecutar queries de selección o actualización directamente desde la consola usando `db query`. Esto es útil para auditar datos, verificar migraciones o actualizar registros de prueba.
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx supabase db query "SELECT count(*), status FROM tasks GROUP BY status;"
```

### 3. Crear una Nueva Migración Local
Para generar una plantilla de migración vacía:
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx supabase migration new <nombre_de_migracion>
```

### 4. Aplicar Cambios SQL a la Base de Datos Remota (Push)
Aplica todas las migraciones locales pendientes a la base de datos de producción:
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx supabase db push
```

### 5. Comparar Estructuras (Schema Diff)
Compara la estructura de base de datos actual con la del repositorio:
```powershell
$env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx supabase db diff
```

---

## 🔒 Reglas de Seguridad y Control de Datos

1. **No usar base de datos local (Docker)**: Dado que el proyecto usa una base de datos de Supabase remota compartida, no inicies `supabase start` ni uses Docker a menos que sea explícitamente requerido. Todas las operaciones directas se realizan en el ambiente remoto.
2. **Consultas no destructivas**: Para consultas directas (`SELECT`), puedes ejecutarlas libremente para verificar el estado de los datos. Para queries de modificación directa (`UPDATE`/`DELETE`), prefiere usar el flujo de migraciones o interfaces seguras de la aplicación a menos que el usuario lo solicite.
3. **Mapeo de Nombres de Archivos**: Los archivos de migración deben seguir el formato `<timestamp>_nombre.sql`. Evita nombres que rompan este patrón.
