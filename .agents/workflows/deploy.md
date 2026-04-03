---
description: Build and deploy to Firebase Hosting and push to GitHub
---
// turbo-all

1. Run production build
   ```
   $env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npm run build
   ```

2. Deploy to Firebase Hosting
   ```
   $env:PATH = "c:\Users\CJ00083620\.gemini\antigravity\scratch\autobom-pro\node_bin\node-v20.11.1-win-x64;$env:PATH"; npx -y firebase-tools deploy --only hosting
   ```

3. Stage all changes for Git
   ```
   git add -A
   ```

4. Commit changes (replace message as needed)
   ```
   git commit -m "deploy: latest changes"
   ```

5. Push to GitHub
   ```
   git push origin main
   ```
