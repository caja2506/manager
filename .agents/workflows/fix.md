---
description: Full check - lint, test, and build to verify everything works
---
// turbo-all

1. Run ESLint with auto-fix
   ```
   $env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx eslint . --fix
   ```

2. Run all tests
   ```
   $env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npm run test
   ```

3. Run production build to check for errors
   ```
   $env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npm run build
   ```
