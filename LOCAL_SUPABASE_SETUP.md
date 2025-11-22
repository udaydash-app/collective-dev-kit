# Local Supabase Setup Guide

This guide will help you set up a fully local Supabase instance with PostgreSQL running on your machine.

## Prerequisites

1. **Docker Desktop** installed and running
   - Download from: https://www.docker.com/products/docker-desktop
   - Make sure Docker is running before proceeding

## Setup Steps

### 1. Start Local Supabase

```bash
# Start all Supabase services
docker-compose up -d

# Check if services are running
docker-compose ps
```

You should see these services running:
- `supabase-db` (PostgreSQL) - Port 5432
- `supabase-kong` (API Gateway) - Port 8000
- `supabase-auth` (Authentication) - Port 9999
- `supabase-rest` (PostgREST API) - Port 3001
- `supabase-studio` (Admin UI) - Port 3000
- `supabase-storage` (File Storage) - Port 5000
- `supabase-meta` (Database Metadata) - Port 8080

### 2. Access Supabase Studio

Open your browser and go to:
```
http://localhost:3000
```

This is your local Supabase admin dashboard where you can:
- View and edit tables
- Run SQL queries
- Manage authentication
- View storage buckets

### 3. Run Database Migrations

Apply your existing schema to the local database:

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to local instance
supabase db reset --db-url "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:5432/postgres"
```

Or manually run your migrations using the SQL Editor in Supabase Studio (http://localhost:3000).

### 4. Configure Your App for Local Mode

**Option A: Use .env.local (Recommended for Development)**
```bash
# Rename .env.local to .env
cp .env.local .env
```

**Option B: Update .env file manually**
```env
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
VITE_SUPABASE_PROJECT_ID=local
```

### 5. Restart Your App

```bash
npm run dev
```

Your app will now connect to the local Supabase instance!

## Managing Local Supabase

### Stop Services
```bash
docker-compose stop
```

### Start Services Again
```bash
docker-compose start
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f auth
```

### Reset Everything (Fresh Start)
```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Database Connection

You can also connect directly to PostgreSQL using any database client:

```
Host: localhost
Port: 5432
Database: postgres
User: postgres
Password: your-super-secret-and-long-postgres-password
```

## Backup and Restore

### Backup Database
```bash
docker exec supabase-db pg_dump -U postgres postgres > backup.sql
```

### Restore Database
```bash
docker exec -i supabase-db psql -U postgres postgres < backup.sql
```

## Migrate Data from Cloud to Local

If you have data in your cloud Supabase instance and want to move it locally:

1. Export from cloud Supabase Studio (http://app.supabase.com)
2. Use the SQL Editor to export data as SQL
3. Import into local Supabase Studio (http://localhost:3000)

## Troubleshooting

### Services Won't Start
- Make sure Docker Desktop is running
- Check if ports are already in use: `docker ps -a`
- Try: `docker-compose down` then `docker-compose up -d`

### Can't Connect to Database
- Verify services are running: `docker-compose ps`
- Check logs: `docker-compose logs postgres`
- Make sure you're using the correct password

### App Shows Connection Error
- Verify .env has correct local URL: `http://localhost:8000`
- Restart the dev server: `npm run dev`
- Check if Kong gateway is running: `curl http://localhost:8000`

## Production Deployment

For production, you can:
1. Keep using cloud Supabase (current setup)
2. Host Supabase on your own server using these Docker configs
3. Use a managed PostgreSQL database and connect it

## Security Notes

⚠️ **Important**: The passwords in docker-compose.yml are defaults for local development.
For production deployment, you MUST change:
- `POSTGRES_PASSWORD`
- `GOTRUE_JWT_SECRET`
- All service keys

## Next Steps

1. Your app is now fully local! ✅
2. Test all features to ensure they work with local Supabase
3. Set up regular backups of your local database
4. Consider version controlling your database schema migrations

## Useful Commands

```bash
# View all running containers
docker ps

# Access PostgreSQL shell
docker exec -it supabase-db psql -U postgres

# Check disk space used
docker system df

# Clean up unused images/containers
docker system prune
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Docker logs: `docker-compose logs`
3. Visit Supabase docs: https://supabase.com/docs
