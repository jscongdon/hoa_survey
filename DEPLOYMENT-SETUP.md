# Development & Production Setup Summary

## ✅ What's Been Set Up

### 1. Branch Structure

- **`main`** branch → Production environment
- **`develop`** branch → Development/staging environment

### 2. Docker Images

GitHub Actions automatically builds:

- `ghcr.io/jscongdon/hoa_survey:latest` (from `main`)
- `ghcr.io/jscongdon/hoa_survey:develop` (from `develop`)

### 3. Portainer Stacks

#### Development Stack (`portainer-stack-dev.yml`)

- Container: `hoa_survey_dev`
- Port: **3001**
- Database: `hoasurvey-dev.db`
- Image: `ghcr.io/jscongdon/hoa_survey:develop`

#### Production Stack (`portainer-stack.yml`)

- Container: `hoa_survey`
- Port: **3000**
- Database: `hoasurvey.db`
- Image: `ghcr.io/jscongdon/hoa_survey:latest`

## 📋 Next Steps for Portainer Setup

### Step 1: Create Development Stack

1. Go to Portainer → Stacks → Add Stack
2. Name: **hoa_survey_dev**
3. Copy contents from `portainer-stack-dev.yml`
4. Set environment variables:

    ```yaml
    environment:
       - PRODUCTION_URL=https://dev-hoasurvey.foxpointva.com  # or your dev domain
       - JWT_SECRET=<will-get-after-setup>
    ```

5. Deploy the stack
6. Access: `http://your-server:3001`
7. Complete setup wizard
8. Get JWT_SECRET from `/setup/jwt-secret` page
9. Add JWT_SECRET to stack environment and redeploy

### Step 2: Update Production Stack

1. In Portainer, edit your existing **hoa_survey** stack
2. Ensure it uses: `image: ghcr.io/jscongdon/hoa_survey:latest`
3. Verify environment variables are set
4. Keep existing data volume

git commit -m "Description of changes"
git push origin feature/your-feature-name
git pull origin develop
git merge develop
git push origin main
git commit -m "Description of changes"
git push origin feature/your-feature-name
git pull origin develop
git merge develop
git push origin main

## 🔄 Development Workflow

### Working on New Features

```bash
# 1. Start from develop branch
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes, test locally
npm run build
npm run dev

# 4. Commit and push
git add .
git commit -m "Description of changes"
git push origin feature/your-feature-name

# 5. Create PR to develop branch on GitHub

# 6. After PR merged, test in dev environment
git checkout develop
git pull origin develop
# GitHub Actions automatically builds develop image
# Pull new image in Portainer dev stack

# 7. After testing, merge to production
git checkout main
git merge develop
git push origin main
# GitHub Actions builds production image
# Pull new image in Portainer production stack
```

git checkout develop
git pull origin develop
git add .
git commit -m "Your changes"
git push origin develop
git checkout main
git merge develop
git push origin main
git commit -m "Your changes"
git push origin develop

## 🚀 Quick Deploy Commands

### Deploy to Development

```bash
git checkout develop
git pull origin develop
# Make changes
git add .
git commit -m "Your changes"
git push origin develop
# Wait for GitHub Actions build
# Pull in Portainer dev stack
```

### Deploy to Production

```bash
git checkout main
git merge develop
git push origin main
# Wait for GitHub Actions build
# Pull in Portainer production stack
```

docker logs hoa_survey_dev -f
docker logs hoa_survey -f
docker inspect hoa_survey_dev | grep -A 10 Health
docker inspect hoa_survey | grep -A 10 Health

## 📊 Monitoring

### Check Build Status

[GitHub Actions Build Status](https://github.com/jscongdon/hoa_survey/actions)

### View Container Logs

```bash
# Development
docker logs hoa_survey_dev -f

# Production
docker logs hoa_survey -f
```

### Check Container Health

```bash
# Development
docker inspect hoa_survey_dev | grep -A 10 Health

# Production
docker inspect hoa_survey | grep -A 10 Health
```

## 🔐 Environment Variables Needed

Both stacks need:

- `PRODUCTION_URL` - Your domain (different for dev/prod)
- `JWT_SECRET` - Get from setup wizard (different for dev/prod)
- `DATABASE_URL` - Automatically set in stack file
- `NODE_ENV` - Set to "production" in both

docker cp hoa_survey:/data/hoasurvey.db ./backup-prod-$(date +%Y%m%d-%H%M%S).db
docker cp hoa_survey_dev:/data/hoasurvey-dev.db ./backup-dev-$(date +%Y%m%d-%H%M%S).db

## 🗄️ Database Backups

### Backup Production Database

```bash
docker cp hoa_survey:/data/hoasurvey.db ./backup-prod-$(date +%Y%m%d-%H%M%S).db
```

### Backup Development Database

```bash
docker cp hoa_survey_dev:/data/hoasurvey-dev.db ./backup-dev-$(date +%Y%m%d-%H%M%S).db
```

## 📝 Notes

- Development and production use **separate databases**
- Port 3001 (dev) and 3000 (prod) avoid conflicts
- Development mode logging toggle available in Settings
- Both environments can run simultaneously on same server
- Test all changes in dev before deploying to production

## 🖼️ Uploads and `UPLOADS_DIR`

- The app serves uploaded branding files from `public/uploads` so Next.js and the image optimizer can access them directly.
- For persistence in containerized deployments, mount a host directory to `public/uploads` so uploaded files are retained across container restarts.

Recommended options:

- **Simple (recommended):** mount your host uploads volume to the container `public/uploads` path. Example `docker-compose` snippet:

```yaml
services:
   web:
      volumes:
         - ./uploads:/app/public/uploads
```

With this, you do not need to set `UPLOADS_DIR` — files written to `public/uploads` are persisted on the host and served directly by Next at `/uploads/<filename>`.

**Alternative (if you must set `UPLOADS_DIR`):**

```yaml
services:
   web:
      volumes:
         - ./uploads:/app/public/uploads
      environment:
         - UPLOADS_DIR=/app/public/uploads
```

Notes:

- Do not configure `UPLOADS_DIR` to a different path without also mounting that path to `/app/public/uploads` — the app now writes uploaded files only into `public/uploads` to avoid duplicating data.
- Recommended: mount the host directory to `/app/public/uploads` so files persist across container restarts and are available at `/uploads/<filename>`.

docker logs hoa_survey_dev --tail 100
docker restart hoa_survey_dev

## 🆘 Troubleshooting

### If dev build fails

Check [GitHub Actions](https://github.com/jscongdon/hoa_survey/actions)

### If container is unhealthy

```bash
docker logs hoa_survey_dev --tail 100
docker restart hoa_survey_dev
```

### If you need to rollback

1. Find previous working image SHA in GitHub Actions
2. Update Portainer stack to use that specific tag:

   ```yaml
   image: ghcr.io/jscongdon/hoa_survey:main-abc1234
   ```

3. Redeploy stack

## ✅ Current Status

- [x] Development branch created
- [x] GitHub Actions configured for both branches
- [x] Development Portainer stack file created
- [x] Workflow documentation created
- [ ] **TODO**: Create dev stack in Portainer
- [ ] **TODO**: Configure dev domain/subdomain
- [ ] **TODO**: Complete dev setup wizard
- [ ] **TODO**: Add JWT_SECRET to dev stack
