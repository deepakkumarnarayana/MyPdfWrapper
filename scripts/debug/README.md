# Debug Scripts

This directory contains debug scripts for troubleshooting configuration and environment issues.

## Available Scripts

### 1. `test_config.py`
**Purpose**: Test centralized configuration system across different environments.

```bash
# Test default (development) environment
python scripts/debug/test_config.py

# Test specific environments
ENV=staging python scripts/debug/test_config.py
ENV=production python scripts/debug/test_config.py
```

**What it tests**:
- Environment-specific settings loading
- Computed fields
- Storage and database configuration
- Security settings
- AI configuration

### 2. `debug_env_loading.py` 
**Purpose**: Debug environment file loading issues and Pydantic Settings configuration.

```bash
python scripts/debug/debug_env_loading.py
ENV=staging python scripts/debug/debug_env_loading.py
```

**What it shows**:
- Which environment files exist
- File loading order (general → specific)
- Actual file contents
- Configuration values loaded
- Common troubleshooting tips

### 3. `test_paths.py`
**Purpose**: Test all path computations and storage configurations.

```bash
python scripts/debug/test_paths.py
ENV=staging python scripts/debug/test_paths.py
```

**What it tests**:
- Computed path fields
- Directory existence
- Storage configuration
- Path calculations
- Directory creation

### 4. `validate_services.py`
**Purpose**: Validate that all services use centralized settings correctly.

```bash
python scripts/debug/validate_services.py
```

**What it validates**:
- Service imports and initialization
- Centralized settings usage
- Checks for remaining `os.getenv()` calls
- Configuration consistency across environments

## Common Use Cases

### Debugging Environment Loading Issues
If settings aren't loading correctly for a specific environment:

1. Run `debug_env_loading.py` to check file existence and loading order
2. Run `test_config.py` to see what values are actually loaded
3. Check the troubleshooting section in the debug output

### Debugging Path Issues
If PDF storage or database paths are incorrect:

1. Run `test_paths.py` to see all computed paths
2. Check if directories exist and are being created properly
3. Verify custom path overrides in environment files

### Debugging Service Configuration
If services aren't using centralized settings:

1. Run `validate_services.py` to check service initialization
2. Look for any remaining `os.getenv()` calls
3. Verify all services import settings correctly

## Environment Files

The debug scripts work with these environment files:
- `.env` (general settings)
- `.env.development` (development overrides)  
- `.env.staging` (staging overrides)
- `.env.production` (production overrides)

## Configuration System

The configuration system uses:
- **Pydantic Settings**: Type-safe configuration with validation
- **Environment Profiles**: Environment-specific `.env` files
- **Computed Fields**: Dynamic calculation of paths and lists
- **Centralized Settings**: Single source of truth via `get_settings()`
- **LRU Cache**: Performance optimization

## Troubleshooting Tips

### Environment Not Loading
- Check `ENV` environment variable is set correctly
- Verify the corresponding `.env.{environment}` file exists
- Ensure file loading order is correct (general → specific)

### Paths Not Working
- Check computed path calculations in `test_paths.py`
- Verify project root detection is correct
- Ensure directories are being created properly

### Services Not Working
- Run `validate_services.py` to check service initialization
- Look for import errors or configuration mismatches
- Verify all services use `get_settings()` instead of `os.getenv()`

### Database Permission Issues
- Database files may be created with root ownership in some environments
- If VS Code can't open the database: check file ownership with `ls -la data/storage/database.db`
- Fix ownership with: `sudo chown -R $USER:$USER data/`
- Or use `scripts/debug/recreate_database.py` to create a new database with proper ownership

## Future Enhancements

These scripts can be extended to test:
- Database connectivity
- External service connections (Claude AI, S3)
- Security configuration validation
- Performance benchmarks
- Integration testing