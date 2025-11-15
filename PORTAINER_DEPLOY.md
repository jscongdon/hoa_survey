# HOA Survey - Portainer Deployment Guide

## Prerequisites
- Portainer instance running
- Access to GitHub Container Registry

## Deployment Steps

### 1. Enable GitHub Container Registry
The application uses GitHub Actions to automatically build and publish Docker images to GitHub Container Registry (GHCR).

1. Go to your repository Settings
2. Navigate to Actions > General
3. Scroll to "Workflow permissions"
4. Ensure "Read and write permissions" is selected
5. Save changes

### 2. Trigger Initial Build
Push to main branch or manually trigger the workflow:
- Go to Actions tab in GitHub
- Select "Build and Push Docker Image"
- Click "Run workflow"

Wait for the build to complete. The image will be available at:
`ghcr.io/jscongdon/hoa_survey:latest`

### 3. Make Image Public (Optional but Recommended)
1. Go to your GitHub profile
2. Click "Packages" tab
3. Find "hoa_survey" package
4. Click "Package settings"
5. Scroll to "Danger Zone"
6. Click "Change visibility" → "Public"

### 4. Deploy in Portainer

#### Option A: Using Stack File
1. In Portainer, go to **Stacks** → **Add stack**
2. Name it: `hoa_survey`
3. Build method: **Repository**
4. Repository URL: `https://github.com/jscongdon/hoa_survey`
5. Reference: `refs/heads/main`
6. Compose path: `portainer-stack.yml`
7. Add environment variable:
   - Name: `PRODUCTION_URL`
   - Value: `https://your-domain.com` (or `http://your-server-ip:3000`)
8. Click **Deploy the stack**

#### Option B: Using Web Editor
1. In Portainer, go to **Stacks** → **Add stack**
2. Name it: `hoa_survey`
3. Build method: **Web editor**
4. Copy contents from `portainer-stack.yml`
5. Add environment variable:
   - Name: `PRODUCTION_URL`
   - Value: `https://your-domain.com`
6. Click **Deploy the stack**

### 5. Access Setup Wizard
Once deployed:
1. Navigate to your application URL (e.g., `http://your-server:3000`)
2. You'll be redirected to the setup wizard
3. Complete the 6-step setup process:
   - **System Configuration**: JWT secret, URLs
   - **Admin Account**: Create admin user
   - **SMTP Settings**: Email configuration
   - **Member List**: Upload CSV or enter manually
   - **Survey Creation**: Create your first survey
   - **Verification**: Verify email and activate admin account

### 6. Post-Deployment

#### Update Application
To update to the latest version:
1. Push changes to main branch (triggers automatic build)
2. In Portainer, go to your stack
3. Click "Pull and redeploy"

#### Backup Database
The database is stored in the `hoasurvey_data` volume. To backup:
```bash
docker run --rm -v hoa_survey_hoasurvey_data:/data -v $(pwd):/backup alpine tar czf /backup/hoasurvey-backup.tar.gz /data
```

#### View Logs
In Portainer:
1. Go to **Containers**
2. Click on `hoa_survey`
3. Click **Logs** tab

## Configuration

### Environment Variables
- `DATABASE_URL`: SQLite database path (default: `file:/data/hoasurvey.db`)
- `NODE_ENV`: Environment mode (default: `production`)
- `PRODUCTION_URL`: Your application's public URL (required for emails and redirects)

### Volume
- `hoasurvey_data`: Persistent storage for SQLite database

### Port
- `3000`: Application HTTP port

## Troubleshooting

### Container won't start
1. Check logs in Portainer
2. Verify image was pulled successfully
3. Ensure port 3000 is not in use

### Setup wizard doesn't appear
1. Check that database volume is empty (first run)
2. Delete volume and recreate if needed:
   - Stop/remove stack
   - Delete `hoasurvey_data` volume in Portainer
   - Redeploy stack

### Email not working
1. Verify SMTP settings in setup wizard
2. Check container logs for email errors
3. Test with a different SMTP provider

## Security Notes
- Change default ports if exposing publicly
- Use HTTPS/reverse proxy (Nginx, Traefik, Caddy)
- Keep PRODUCTION_URL updated for proper email links
- Regularly backup the database volume
- Review admin accounts periodically
