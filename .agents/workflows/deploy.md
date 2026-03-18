---
description: Build and deploy to Firebase Hosting and push to GitHub
---
// turbo-all

1. Run production build
   ```
   npm run build
   ```

2. Deploy to Firebase Hosting
   ```
   npx firebase deploy --only hosting
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
