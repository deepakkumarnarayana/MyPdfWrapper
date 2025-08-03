# Project Reorganization Backup Strategy

## 🚨 Pre-Reorganization Backup Plan

### 1. Complete Git Backup
```bash
# Create backup branch
git checkout -b backup-before-reorganization-$(date +%Y%m%d)
git push origin backup-before-reorganization-$(date +%Y%m%d)

# Create local backup
git bundle create ../MyPdfWrapper-backup-$(date +%Y%m%d).bundle --all
```

### 2. File System Backup
```bash
# Create compressed backup
tar -czf ../MyPdfWrapper-backup-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=venv \
  --exclude=.git \
  --exclude=__pycache__ \
  .

# Create full backup (including dependencies)
cp -r ../MyPdfWrapper ../MyPdfWrapper-backup-$(date +%Y%m%d)
```

### 3. Database Backup
```bash
# Backup SQLite databases
mkdir -p backups/databases
cp study-pdf-reader/backend/storage/database.db backups/databases/
cp study-pdf-reader/backend/database.db backups/databases/ 2>/dev/null || true
cp study-pdf-reader/storage/database.db backups/databases/ 2>/dev/null || true
```

### 4. Configuration Backup
```bash
# Backup all environment and config files
mkdir -p backups/configs
find . -name "*.env*" -o -name "*.conf" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" | \
  xargs -I {} cp {} backups/configs/
```

### 5. SSL Certificates Backup
```bash
# Backup SSL certificates and keys
if [ -d "study-pdf-reader/ssl" ]; then
  cp -r study-pdf-reader/ssl backups/ssl-backup
fi
```

## 🔄 Rollback Strategy

### Emergency Rollback (if reorganization fails)
```bash
# 1. Reset to backup branch
git checkout backup-before-reorganization-$(date +%Y%m%d)
git checkout -b emergency-rollback

# 2. Restore from bundle if needed
git clone ../MyPdfWrapper-backup-$(date +%Y%m%d).bundle restored-project

# 3. Restore file system
rm -rf current-directory/*
tar -xzf ../MyPdfWrapper-backup-$(date +%Y%m%d).tar.gz
```

### Selective Restore (if specific files are lost)
```bash
# Restore specific directories
cp -r ../MyPdfWrapper-backup-$(date +%Y%m%d)/study-pdf-reader/backend/storage .
cp -r ../MyPdfWrapper-backup-$(date +%Y%m%d)/study-pdf-reader/ssl .
```

## 📋 Reorganization Phases

### Phase 1: Safe Reorganization (Low Risk)
- Move documentation files
- Reorganize scripts and tools
- Update configuration paths
- **Risk**: Very Low - No code changes

### Phase 2: Logical Reorganization (Medium Risk)
- Move frontend/backend to services structure
- Update import paths
- Reorganize shared components
- **Risk**: Medium - Code path changes

### Phase 3: Infrastructure Reorganization (High Risk)
- Docker and deployment restructure
- CI/CD pipeline updates
- Database migration scripts
- **Risk**: High - Deployment changes

## 🛟 Safety Measures

### Automated Testing Before Changes
```bash
# Run all tests before reorganization
cd study-pdf-reader/backend && python -m pytest
cd study-pdf-reader/frontend && npm test
```

### Incremental Validation
```bash
# Test after each phase
./scripts/validate-project-structure.sh
./scripts/run-integration-tests.sh
```

### Git Safety Net
```bash
# Commit after each successful phase
git add -A
git commit -m "Phase X: Successfully reorganized [description]"
git tag "reorganization-phase-X-stable"
```

## 🚀 Recovery Procedures

### If Backend Breaks
1. Restore backend from `backups/`
2. Restore database from `backups/databases/`
3. Update configuration paths
4. Test API endpoints

### If Frontend Breaks
1. Restore frontend from backup
2. Reinstall dependencies: `npm install`
3. Update API endpoint configurations
4. Test build: `npm run build`

### If SSL/HTTPS Breaks
1. Restore SSL directory from `backups/ssl-backup/`
2. Verify certificate permissions
3. Test HTTPS endpoints
4. Re-run certificate setup if needed

### If Complete Project Corruption
1. Use git bundle restore: `git clone ../MyPdfWrapper-backup-$(date).bundle`
2. Extract file system backup: `tar -xzf backup.tar.gz`
3. Restore databases and configurations
4. Rebuild dependencies and test

## 📞 Emergency Contacts & Resources

### Backup Locations
- **Git Bundle**: `../MyPdfWrapper-backup-YYYYMMDD.bundle`
- **File System**: `../MyPdfWrapper-backup-YYYYMMDD.tar.gz`
- **Full Copy**: `../MyPdfWrapper-backup-YYYYMMDD/`

### Validation Commands
```bash
# Quick health check
curl http://localhost:8000/api/v1/health
curl http://localhost:3000

# Database check
sqlite3 study-pdf-reader/backend/storage/database.db ".tables"

# SSL check
openssl x509 -in ssl/cert.pem -noout -dates 2>/dev/null || echo "No SSL cert"
```

### Recovery Checklist
- [ ] Restore project files
- [ ] Restore database
- [ ] Restore SSL certificates
- [ ] Update configuration paths
- [ ] Reinstall dependencies
- [ ] Run tests
- [ ] Verify endpoints
- [ ] Check HTTPS functionality

**Remember**: Always test the backup and restore process before starting the reorganization!