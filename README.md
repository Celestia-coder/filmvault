# FilmVault

Movie ticketing system — Software Engineering 1 project.

## Folder structure
- `frontend/` — React app (all client + admin pages)
- `backend/` — Node.js + Express API (not started yet)
- `database/` — SQL schema scripts

## Branch naming
Side type: FE = frontend | BE = backend
- `main` — working, reviewed code only. Do not push directly here.
- `FE/client-home`
- `FE/client-login`
- `BE/admin-login`
- `BE/client-signup`

## Workflow
1. Branch off `main`: `git checkout -b sideType/your-page-name`
2. Build your page.
3. Push your branch: `git push origin sideType/your-page-name`
4. Open a Pull Request on GitHub — [PM Name] will review and merge.

## Coding standards
- Meaningful variable/function names
- Comment non-obvious logic
- Consistent indentation (2 spaces for JS/JSX)
- No unused code/console.logs before pushing

---

## Getting Started (for ALL members — frontend, backend, database, QA)

### 1. Install prerequisites (one-time only)
- **Git** — [git-scm.com](https://git-scm.com/downloads)
- **Node.js** (includes npm) — [nodejs.org](https://nodejs.org/) (LTS version recommended)
- A code editor — **VS Code** recommended ([code.visualstudio.com](https://code.visualstudio.com/))

Check installed versions:
```bash
git --version
node --version
npm --version
```

### 2. Clone the repo (one-time only)
```bash
git clone https://github.com/Celestia-coder/filmvault.git
cd filmvault
```

### 3. Switch to your assigned branch
```bash
git checkout sideType/your-assigned-branch
```
Example: if you're working on the user login page:
```bash
git checkout FE/client-login
```

### 4. Install dependencies

**If you're on FRONTEND:**
```bash
cd frontend
npm install
```

**If you're on BACKEND** (once backend setup begins):
```bash
cd backend
npm install
```

### 5. Run the app in your browser

**Frontend:**
```bash
cd frontend
npm run dev
```
Opens at **http://localhost:5173**. Vite shows the exact URL in the terminal. Auto-refreshes on save.

**Backend** (once it exists):
```bash
cd backend
npm run dev
```
(Confirm exact run command with Backend Lead once their setup is live — may differ.)

### 6. Making changes and saving your work
```bash
git add .
git commit -m "Short description of what you did"
git push origin sideType/your-assigned-branch
```
Then open a **Pull Request** on GitHub into `main` for review.

### 7. Getting the latest updates from main
```bash
git checkout main
git pull origin main
git checkout sideType/your-assigned-branch
git merge main
```

---

## For QA & Documentation
1. Follow steps 1–2 above (install prerequisites, clone repo).
2. Checkout the branch you want to test: `git checkout FE/client-login`
3. Follow steps 4–5 above (install dependencies, run with `npm run dev`)
4. Test in your browser at `http://localhost:5173`, log any bugs you find.

## For Database members
Follow steps 1–2 to clone the repo. SQL scripts go in `database/` — `cd database`, add your `.sql` files, then `git add`, `commit`, `push` like everyone else.

## Common issues
- **"command not found: npm/git"** — Node.js or Git isn't installed (see Step 1).
- **Port 5173 already in use** — you likely have another Vite app running; close it or the terminal will offer a different port automatically.
- **Merge conflicts** — don't panic, message [PM Name] and we'll resolve it together.