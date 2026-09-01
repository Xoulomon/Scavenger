# Scavngr User Guide

Welcome to Scavngr, the decentralized recycling platform powered by Stellar blockchain. This guide will help you get started and make the most of the platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Role Overview](#role-overview)
3. [Recycler Guide](#recycler-guide)
4. [Collector Guide](#collector-guide)
5. [Manufacturer Guide](#manufacturer-guide)
6. [Common Tasks](#common-tasks)
7. [FAQ](#faq)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- Stellar account with XLM balance
- Web browser with Stellar wallet extension (Freighter recommended)
- Internet connection

### Account Setup

1. **Create a Stellar Account**
   - Visit [Stellar Laboratory](https://laboratory.stellar.org)
   - Generate a keypair
   - Save your secret key securely

2. **Fund Your Account**
   - On testnet: Use [Friendbot](https://friendbot.stellar.org)
   - On mainnet: Purchase XLM from an exchange

3. **Connect Wallet**
   - Install [Freighter Wallet](https://www.freighter.app)
   - Import your account
   - Approve Scavngr connection

### First Steps

1. Navigate to Scavngr platform
2. Click "Connect Wallet"
3. Approve connection in wallet extension
4. Register as a participant (see role-specific guides below)

---

## Role Overview

Scavngr has three participant roles in the recycling supply chain:

### Recycler
- Collects waste from sources
- Submits waste to the platform
- Receives rewards for verified materials
- Can transfer waste to collectors

### Collector
- Receives waste from recyclers
- Verifies and processes materials
- Transfers to manufacturers
- Earns percentage of rewards

### Manufacturer
- Receives processed materials
- Creates incentives for specific waste types
- Distributes rewards through supply chain
- Manages inventory

---

## Recycler Guide

### Registration

1. Click "Register as Recycler"
2. Enter your details:
   - **Name**: Your business/organization name
   - **Location**: Latitude and longitude (or use map picker)
3. Click "Register"
4. Approve transaction in wallet

**Cost**: ~1 XLM in fees

### Submitting Waste

#### Single Submission

1. Click "Submit Waste"
2. Select waste type:
   - Plastic
   - Paper
   - Metal
   - Glass
   - Organic
3. Enter weight in kilograms
4. Set location (current or custom)
5. Click "Submit"
6. Approve transaction

**Cost**: ~1 XLM in fees

#### Batch Submission

1. Click "Batch Submit"
2. Add multiple waste items:
   - Click "Add Item"
   - Select type and weight
   - Repeat for each item
3. Click "Submit All"
4. Approve transaction

**Cost**: ~2 XLM for batch (more efficient than individual submissions)

### Tracking Submissions

1. Go to "My Wastes"
2. View all submitted materials
3. Check status:
   - **Pending**: Awaiting verification
   - **Verified**: Confirmed by collector
   - **Transferred**: Moved to next participant
4. Click on waste to see details and transfer history

### Transferring Waste

1. Select waste from "My Wastes"
2. Click "Transfer"
3. Choose recipient (must be registered Collector)
4. Add transfer note (optional)
5. Confirm location
6. Click "Transfer"
7. Approve transaction

**Note**: Only waste owners can initiate transfers

### Earning Rewards

- Rewards are earned when waste is verified
- Amount depends on:
  - Waste type
  - Weight
  - Active incentives
  - Your role in supply chain
- View earnings in "My Rewards" dashboard

---

## Collector Guide

### Registration

1. Click "Register as Collector"
2. Enter details:
   - **Name**: Your collection service name
   - **Location**: Service area coordinates
3. Click "Register"
4. Approve transaction

**Cost**: ~1 XLM in fees

### Receiving Waste

1. Recyclers will transfer waste to your address
2. View incoming waste in "Pending Transfers"
3. Accept or reject transfer:
   - **Accept**: Confirms receipt and quality
   - **Reject**: Returns to sender with note

### Verifying Materials

1. Go to "Pending Verification"
2. Review waste details:
   - Type and weight
   - Submission location
   - Submitter information
3. Click "Verify" to confirm quality
4. Approve transaction

**Important**: Only verify waste you've physically inspected

### Processing and Transfer

1. After verification, waste appears in "My Inventory"
2. To transfer to manufacturer:
   - Select waste
   - Click "Transfer"
   - Choose manufacturer recipient
   - Add processing notes
   - Confirm location
3. Approve transaction

### Reward Distribution

- Collectors earn a percentage of rewards
- Percentage set by admin (typically 30%)
- Rewards distributed when waste reaches manufacturer
- View earnings in "My Rewards"

---

## Manufacturer Guide

### Registration

1. Click "Register as Manufacturer"
2. Enter details:
   - **Name**: Your manufacturing company
   - **Location**: Facility coordinates
3. Click "Register"
4. Approve transaction

**Cost**: ~1 XLM in fees

### Creating Incentives

Incentives encourage waste collection for specific materials.

1. Go to "Incentives"
2. Click "Create Incentive"
3. Configure:
   - **Waste Type**: Select material type
   - **Reward Points**: Points per kilogram
   - **Budget**: Total points available
4. Click "Create"
5. Approve transaction

**Example**:
- Waste Type: Plastic
- Reward: 100 points/kg
- Budget: 10,000 points (100 kg capacity)

**Cost**: ~1 XLM in fees

### Managing Incentives

1. Go to "My Incentives"
2. View active incentives:
   - Remaining budget
   - Points per unit
   - Waste type
3. To update:
   - Click "Edit"
   - Modify reward or budget
   - Click "Update"
4. To deactivate:
   - Click "Deactivate"
   - Confirm action

### Receiving Materials

1. Collectors will transfer processed waste
2. View in "Incoming Materials"
3. Accept receipt:
   - Verify weight and type
   - Click "Accept"
   - Approve transaction

### Distributing Rewards

1. Go to "Reward Distribution"
2. Select waste to reward:
   - Choose waste item
   - Select applicable incentive
3. Click "Distribute Rewards"
4. Review distribution:
   - Recycler share
   - Collector share
   - Your cost
5. Approve transaction

**Distribution Example**:
- Waste: 10 kg plastic
- Incentive: 100 points/kg = 1,000 points
- Collector %: 30% = 300 points
- Recycler: 700 points
- Your cost: 1,000 points

---

## Common Tasks

### Update Profile

1. Click "Profile Settings"
2. Edit:
   - Name
   - Location
   - Contact information
3. Click "Save"
4. Approve transaction

**Cost**: ~0.5 XLM in fees

### View Transaction History

1. Go to "History"
2. Filter by:
   - Date range
   - Transaction type
   - Status
3. Click transaction for details

### Check Account Balance

1. Click wallet icon (top right)
2. View XLM balance
3. View reward tokens balance
4. Click "Add Funds" to purchase more XLM

### Export Data

1. Go to "Settings"
2. Click "Export Data"
3. Choose format:
   - CSV
   - JSON
   - PDF
4. Click "Download"

---

## FAQ

### General Questions

**Q: What is Scavngr?**
A: Scavngr is a blockchain-based recycling platform that connects recyclers, collectors, and manufacturers to create a transparent, efficient supply chain with built-in incentives.

**Q: Do I need cryptocurrency experience?**
A: No. The platform handles blockchain complexity. You just need a Stellar wallet and XLM for transaction fees.

**Q: How much does it cost to use?**
A: Only transaction fees (~1 XLM per action). No platform fees.

**Q: Can I change my role?**
A: Yes. Contact admin or use "Update Role" in settings. Some restrictions may apply.

### Waste Submission

**Q: What waste types are accepted?**
A: Plastic, Paper, Metal, Glass, and Organic materials.

**Q: What's the weight limit?**
A: Maximum 18,446,744,073,709,551,615 kg per submission (practical limit: ~1,000 tons).

**Q: Can I submit waste on behalf of others?**
A: No. Each participant must submit their own waste.

**Q: How long does verification take?**
A: Typically 24-48 hours, depending on collector workload.

### Rewards

**Q: How are rewards calculated?**
A: Based on waste type, weight, and active incentives. Formula: Weight × Incentive Points × Multipliers.

**Q: When do I receive rewards?**
A: After waste is verified and reaches the manufacturer.

**Q: Can I withdraw rewards?**
A: Yes. Rewards are in Stellar tokens. You can trade or transfer them.

**Q: What if I disagree with a reward amount?**
A: Contact the manufacturer who created the incentive or admin for disputes.

### Technical

**Q: What wallet do I need?**
A: Any Stellar-compatible wallet. Freighter recommended for browser use.

**Q: Is my data private?**
A: Transactions are public on blockchain. Personal details are encrypted.

**Q: What if I lose my secret key?**
A: You cannot recover it. Keep it secure. Consider using a hardware wallet.

**Q: Can I use multiple accounts?**
A: Yes, but each must be registered separately.

---

## Troubleshooting

### Connection Issues

**Problem**: "Wallet not connected"
- **Solution**:
  1. Refresh page
  2. Check wallet extension is installed
  3. Ensure wallet is unlocked
  4. Try different browser

**Problem**: "Transaction failed"
- **Solution**:
  1. Check XLM balance (need ~1 XLM per transaction)
  2. Verify network selection (testnet vs mainnet)
  3. Try again in a few moments
  4. Check transaction details for specific error

### Submission Issues

**Problem**: "Invalid coordinates"
- **Solution**:
  1. Latitude must be -90 to 90
  2. Longitude must be -180 to 180
  3. Use map picker for accuracy
  4. Multiply by 1,000,000 if entering manually

**Problem**: "Weight exceeds maximum"
- **Solution**:
  1. Split into multiple submissions
  2. Use batch submission for efficiency
  3. Contact admin if legitimate large submission

### Verification Issues

**Problem**: "Cannot verify waste"
- **Solution**:
  1. Ensure you're registered as Collector
  2. Verify waste is in your inventory
  3. Check waste hasn't been deactivated
  4. Ensure you're not the original submitter

**Problem**: "Incentive budget exhausted"
- **Solution**:
  1. Manufacturer must increase budget
  2. Create new incentive with higher budget
  3. Wait for existing incentive to reset

### Reward Issues

**Problem**: "No rewards showing"
- **Solution**:
  1. Waste must be verified first
  2. Must reach manufacturer for distribution
  3. Check "My Rewards" dashboard
  4. Verify incentive was active at time of submission

**Problem**: "Reward amount seems wrong"
- **Solution**:
  1. Check incentive points per unit
  2. Verify waste weight
  3. Check for multipliers or deductions
  4. Contact manufacturer for clarification

### Account Issues

**Problem**: "Cannot register"
- **Solution**:
  1. Ensure account not already registered
  2. Check XLM balance
  3. Verify location coordinates are valid
  4. Try different browser

**Problem**: "Profile won't update"
- **Solution**:
  1. Refresh page
  2. Check wallet connection
  3. Ensure sufficient XLM
  4. Try again in a few moments

---

## Getting Help

### Support Channels

- **GitHub Issues**: [Report bugs](https://github.com/Xoulomon/Scavenger/issues)
- **Documentation**: [Full docs](https://github.com/Xoulomon/Scavenger/docs)
- **Community**: [GitHub Discussions](https://github.com/Xoulomon/Scavenger/discussions)

### Best Practices

1. **Always verify waste physically** before confirming
2. **Keep accurate records** of all transactions
3. **Update location** when moving to new area
4. **Monitor incentives** for best rewards
5. **Backup your secret key** securely
6. **Use batch submissions** for efficiency
7. **Check network** before submitting (testnet vs mainnet)

---

## Glossary

- **Waste**: Material submitted for recycling
- **Incentive**: Reward offer for specific waste type
- **Verification**: Confirmation of waste quality
- **Transfer**: Moving waste between participants
- **Reward Points**: Currency for incentives
- **Budget**: Total points available for incentive
- **Collector %**: Percentage of rewards for collectors
- **Owner %**: Percentage of rewards for waste owner

---

## Version History

- **v1.0** (Apr 2026): Initial release
  - Basic participant registration
  - Waste submission and verification
  - Incentive management
  - Reward distribution

---

Last updated: April 27, 2026
