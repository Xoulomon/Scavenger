# Environment Configuration

## Environments
- dev: Development
- staging: Staging/QA
- prod: Production

## Environment-Specific Variables

### Development
```
ENVIRONMENT=dev
SOROBAN_NETWORK=standalone
DATABASE_URL=postgresql://dev_user:dev_pass@localhost:5432/scavenger_dev
REDIS_URL=redis://localhost:6379/0
LOG_LEVEL=debug
ENABLE_PROFILING=true
CONTRACT_ID=local_contract_dev
```

### Staging
```
ENVIRONMENT=staging
SOROBAN_NETWORK=testnet
DATABASE_URL=postgresql://staging_user:***@db-staging.internal:5432/scavenger_staging
REDIS_URL=redis://redis-staging.internal:6379/0
LOG_LEVEL=info
ENABLE_PROFILING=false
CONTRACT_ID=staging_contract_id
S3_BUCKET=scavenger-staging
BACKUP_RETENTION_DAYS=7
```

### Production
```
ENVIRONMENT=prod
SOROBAN_NETWORK=mainnet
DATABASE_URL=postgresql://prod_user:***@db-prod.internal:5432/scavenger
REDIS_URL=redis://redis-prod.internal:6379/0
LOG_LEVEL=warn
ENABLE_PROFILING=false
CONTRACT_ID=prod_contract_id
S3_BUCKET=scavenger-prod
BACKUP_RETENTION_DAYS=90
DATABASE_MAX_CONNECTIONS=50
```

## Secrets Management

All sensitive values (passwords, API keys) are stored in:
- **Dev**: .env.local (git-ignored)
- **Staging**: AWS Secrets Manager / HashiCorp Vault
- **Production**: HashiCorp Vault with automated rotation
