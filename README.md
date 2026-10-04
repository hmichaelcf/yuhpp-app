# yuhpp-app

The Yuhpp web app, served at [yuhpp.com/app](https://yuhpp.com/app). Built with
Next.js and deployed on Webflow Cloud.

- **Status page:** yuhpp.com/app
- **Health check:** yuhpp.com/app/api/health
- **How it is built and the rules it follows:** [CLAUDE.md](CLAUDE.md)
- **Deploying, keys, and rollbacks:** [docs/RUNBOOK.md](docs/RUNBOOK.md)

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
```

Every push to `main` deploys to production.
