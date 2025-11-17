# Development Workflow

## Branch Strategy

This project uses a two-branch strategy:

- **`main`** - Production-ready code. Deploys to production environment.
- **`develop`** - Development/staging code. Deploys to development environment.

## Docker Images

GitHub Actions automatically builds Docker images for both branches:

- `ghcr.io/jscongdon/hoa_survey:latest` - Built from `main` branch
- `ghcr.io/jscongdon/hoa_survey:develop` - Built from `develop` branch

## Portainer Deployment

### Development Stack

1. In Portainer, create a new stack named **hoa_survey_dev**
2. Use the `portainer-stack-dev.yml` file
3. Configure environment variables:

   ```yaml
   PRODUCTION_URL: https://dev-hoasurvey.yourdomain.com
   JWT_SECRET: <your-dev-jwt-secret>
   ```

4. The dev container runs on port **3001** (different from production's 3000)
5. Uses separate database: `hoasurvey-dev.db`

### Production Stack

1. In Portainer, create a stack named **hoa_survey**
2. Use the `portainer-stack.yml` file
3. Configure environment variables:

   ```yaml
   PRODUCTION_URL: https://hoasurvey.yourdomain.com
   JWT_SECRET: <your-production-jwt-secret>
   ```

4. Runs on port **3000**
5. Uses database: `hoasurvey.db`

## Development Workflow

### Making Changes

1. **Create a feature branch from develop:**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and commit:**

   ```bash
   git add .
   git commit -m "Description of changes"
   ```

3. **Push to GitHub:**

   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request** to merge into `develop`

5. **Test in development environment:**
   - Push to `develop` branch triggers automatic build
   - GitHub Actions builds `ghcr.io/jscongdon/hoa_survey:develop`
   - Pull and redeploy in Portainer dev stack
   - Test thoroughly at <https://dev-hoasurvey.yourdomain.com>

6. **After testing, merge to production:**

   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

7. **Deploy to production:**
   - Push to `main` triggers automatic build
   - GitHub Actions builds `ghcr.io/jscongdon/hoa_survey:latest`
   - Pull and redeploy in Portainer production stack

## Testing Locally

Before pushing to `develop`:

```bash
# Test build
npm run build

# Run development server
npm run dev

# Test Prisma migrations
npx prisma migrate dev
```

## Database Migrations

### Development

- Migrations run automatically on container startup
- Dev database is separate from production
- Can test migrations safely without affecting production

### Production

- Always test migrations in dev first
- Migrations run automatically on container startup
- Consider backing up production database before major updates:

  ```bash
  docker cp hoa_survey:/data/hoasurvey.db ./backup-$(date +%Y%m%d).db
  ```

## Rollback

If issues occur in production:

1. **Quick rollback to previous image:**

   ```bash
   # In Portainer, edit stack and change image tag to previous SHA
   image: ghcr.io/jscongdon/hoa_survey:main-abc1234
   ```

2. **Revert code and rebuild:**

   ```bash
   git checkout main
   git revert <commit-hash>
   git push origin main
   ```

## Environment Configuration

### Development Mode Toggle

Both environments have a Development Mode setting in **Settings > Development Mode**:

- **Enabled**: Detailed logging for debugging
- **Disabled**: Minimal logging for production

Recommendation:

- Dev environment: Keep **enabled**
- Production: Keep **disabled** unless troubleshooting

## Best Practices

1. ✅ **Always develop in feature branches**
2. ✅ **Test in dev environment before production**
3. ✅ **Use meaningful commit messages**
4. ✅ **Keep develop and main in sync**
5. ✅ **Back up production database before major changes**
6. ✅ **Monitor container logs after deployments**
7. ✅ **Set up separate domain/subdomain for dev**

## Monitoring

Check container health:

```bash
# Development
docker logs hoa_survey_dev --tail 100

# Production  
docker logs hoa_survey --tail 100
```

Check GitHub Actions builds:
<https://github.com/jscongdon/hoa_survey/actions>
