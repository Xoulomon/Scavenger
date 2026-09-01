# Contract Upgrade Guide

## Overview

This guide documents the safe upgrade process for the Scavenger smart contract, including data migration, backward compatibility, and rollback procedures.

## Upgrade Process

### 1. Pre-Upgrade Checklist

- [ ] Backup current contract state
- [ ] Create production data snapshot
- [ ] Review all changes in new version
- [ ] Run full test suite
- [ ] Verify upgrade tests pass
- [ ] Notify stakeholders

### 2. Deployment Steps

```bash
# 1. Build new contract version
cargo build --target wasm32-unknown-unknown --release

# 2. Optimize WASM
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# 3. Deploy to testnet first
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source testnet-deployer \
  --network testnet

# 4. Run upgrade tests
cargo test --test contract_upgrade_test

# 5. Deploy to mainnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source mainnet-deployer \
  --network mainnet
```

### 3. Data Migration

#### Participant Data
- All participant records are preserved
- Role information is maintained
- Registration timestamps are kept
- Stats are recalculated if needed

#### Waste Data
- All waste records are preserved
- Transfer history is maintained
- Metadata is kept intact
- Deactivation status is preserved

#### Incentive Data
- Active incentives are preserved
- Budget information is maintained
- Reward points are kept
- Deactivation status is preserved

### 4. Backward Compatibility

The contract maintains backward compatibility with:
- Old API function signatures
- Existing data structures
- Previous storage layouts
- Legacy query functions

### 5. Rollback Procedure

If issues occur after upgrade:

```bash
# 1. Identify the issue
# Check logs and error reports

# 2. Revert to previous contract
soroban contract deploy \
  --wasm previous_version.wasm \
  --source mainnet-deployer \
  --network mainnet

# 3. Restore from backup if needed
# Use backup data to restore state

# 4. Verify state integrity
cargo test --test contract_upgrade_test

# 5. Notify stakeholders
# Communicate status and next steps
```

## Version History

### v1.0.0 (Current)
- Initial release
- Participant management
- Waste tracking
- Incentive system
- Token rewards

### v1.1.0 (Planned)
- Enhanced query functions
- Improved storage efficiency
- Additional security checks
- Performance optimizations

## Testing

### Upgrade Tests

Run upgrade-specific tests:

```bash
cargo test --test contract_upgrade_test
```

Tests cover:
- State preservation
- Data migration
- Backward compatibility
- Rollback procedures
- Storage compatibility
- Production data snapshots

### Integration Tests

Run full integration suite:

```bash
cargo test
```

## Monitoring

After upgrade, monitor:

1. **Contract Calls**: Track function invocations
2. **Error Rates**: Monitor for new errors
3. **Performance**: Check gas usage and latency
4. **Data Integrity**: Verify data consistency
5. **User Reports**: Monitor for issues

## Troubleshooting

### Issue: State Not Preserved

**Solution**:
- Verify backup was created
- Check storage migration logic
- Restore from backup if needed

### Issue: Old API Calls Failing

**Solution**:
- Verify backward compatibility layer
- Check function signatures
- Update client code if needed

### Issue: Performance Degradation

**Solution**:
- Profile contract execution
- Optimize hot paths
- Consider storage restructuring

## Support

For upgrade issues:
1. Check this guide
2. Review test results
3. Contact development team
4. Escalate if critical

## References

- [Soroban Upgrade Guide](https://developers.stellar.org/docs/learn/storing-data)
- [Contract Testing](./TESTING_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
