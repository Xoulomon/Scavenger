# Scavngr Interactive Demo Script

This guide provides a step-by-step walkthrough for demonstrating the Scavngr platform's key features.

## Prerequisites

- Stellar testnet account with XLM
- Freighter wallet installed
- Contract deployed on testnet
- Frontend running locally or deployed

## Demo Accounts Setup

Create three demo accounts representing different roles:

### Account 1: Recycler (Alice)
```bash
# Generate keypair
stellar keys generate alice

# Get address
stellar keys address alice

# Fund account
curl "https://friendbot.stellar.org?addr=$(stellar keys address alice)"
```

### Account 2: Collector (Bob)
```bash
stellar keys generate bob
stellar keys address bob
curl "https://friendbot.stellar.org?addr=$(stellar keys address bob)"
```

### Account 3: Manufacturer (Carol)
```bash
stellar keys generate carol
stellar keys address carol
curl "https://friendbot.stellar.org?addr=$(stellar keys address carol)"
```

## Demo Flow

### Part 1: Participant Registration (5 minutes)

#### Step 1.1: Register Recycler (Alice)
1. Open the frontend application
2. Connect Freighter wallet with Alice's account
3. Navigate to "Register" or landing page
4. Fill in registration form:
   - Role: Recycler
   - Name: "Alice's Recycling Center"
   - Location: Use map or enter coordinates (e.g., 40.7128, -74.0060)
5. Click "Register"
6. Approve transaction in Freighter
7. **Expected Output**: Success message, redirected to Recycler Dashboard

#### Step 1.2: Register Collector (Bob)
1. Disconnect Alice's wallet
2. Connect with Bob's account
3. Register as Collector:
   - Name: "Bob's Collection Service"
   - Location: 34.0522, -118.2437
4. **Expected Output**: Success, redirected to Collector Dashboard

#### Step 1.3: Register Manufacturer (Carol)
1. Switch to Carol's account
2. Register as Manufacturer:
   - Name: "Carol's Manufacturing Co"
   - Location: 41.8781, -87.6298
4. **Expected Output**: Success, redirected to Manufacturer Dashboard

### Part 2: Create Incentive (3 minutes)

#### Step 2.1: Carol Creates Incentive
1. Logged in as Carol (Manufacturer)
2. Navigate to "Incentives" page
3. Click "Create Incentive" button
4. Fill in the form:
   - Waste Type: PET Plastic
   - Reward per gram: 10 points
   - Total budget: 50000 points
5. Review the estimated coverage (5 kg)
6. Click "Create Incentive"
7. Approve transaction
8. **Expected Output**: 
   - Success notification
   - New incentive card appears
   - Shows: PET Plastic, 10 pts/g, 50000 pts budget, Active status

### Part 3: Submit Waste Material (4 minutes)

#### Step 3.1: Alice Submits Waste
1. Switch to Alice's account (Recycler)
2. Navigate to "Submit Material" or Dashboard
3. Click "Register Waste" button
4. Fill in the form:
   - Waste Type: PET Plastic
   - Weight: 500 grams
   - Location: Use current or enter coordinates
5. Submit transaction
6. **Expected Output**:
   - Success message
   - New waste card appears in "My Materials"
   - Status: Pending
   - Waste ID assigned (e.g., #1)

#### Step 3.2: Verify Material Status
1. Click on the waste card to view details
2. **Expected Output**:
   - Waste ID, Type, Weight
   - Current Owner: Alice's address
   - Status: Pending (not yet confirmed)
   - Transfer history: empty

### Part 4: Transfer Waste (5 minutes)

#### Step 4.1: Alice Transfers to Bob
1. Still logged in as Alice
2. On the waste card, click "Transfer" button
3. Fill in transfer form:
   - Recipient: Bob's address (paste from clipboard)
   - Location: Current location
   - Note: "Collected from recycling center"
4. Submit transaction
5. **Expected Output**:
   - Success notification
   - Waste card shows "Current Owner: Bob's address"
   - Transfer history updated

#### Step 4.2: Bob Confirms Receipt
1. Switch to Bob's account (Collector)
2. Navigate to "My Materials"
3. Find the transferred waste (Status: Pending)
4. Click "Confirm Details" button
5. Approve transaction
6. **Expected Output**:
   - Status changes to "Confirmed"
   - Green checkmark badge appears

#### Step 4.3: Bob Transfers to Carol
1. Still as Bob
2. Click "Transfer" on the confirmed waste
3. Transfer to Carol's address
4. Note: "Delivering to manufacturer"
5. **Expected Output**: Transfer successful, owner updated

### Part 5: Distribute Rewards (4 minutes)

#### Step 5.1: Carol Distributes Rewards
1. Switch to Carol's account (Manufacturer)
2. Navigate to "My Materials" or Dashboard
3. Find the received waste (Status: Pending)
4. Click "Confirm Details" first
5. Then click "Distribute Rewards" button
6. Select the incentive created earlier
7. Review reward distribution:
   - Alice (Recycler): X points
   - Bob (Collector): Y points
   - Carol (Owner): Z points
8. Approve transaction
9. **Expected Output**:
   - Success message
   - Rewards distributed to all participants
   - Incentive budget reduced by total reward amount

### Part 6: View Statistics (3 minutes)

#### Step 6.1: Check Individual Stats
1. As any participant, navigate to Dashboard
2. View personal statistics:
   - Total materials submitted
   - Total rewards earned
   - Transfer count
3. **Expected Output**: Updated stats reflecting demo activities

#### Step 6.2: Check Global Metrics
1. Navigate to "Supply Chain Tracker" or Stats page
2. View global statistics:
   - Total waste items: 1
   - Total tokens distributed: (sum of rewards)
   - Active participants: 3
3. **Expected Output**: Aggregated platform metrics

### Part 7: Incentive Management (2 minutes)

#### Step 7.1: Update Incentive
1. As Carol, go to Incentives page
2. Click "Edit" on the created incentive
3. Update:
   - Reward per gram: 15 points
   - Add more budget: 25000 points
4. Submit transaction
5. **Expected Output**: Incentive updated, new values displayed

#### Step 7.2: Deactivate Incentive
1. Click "Deactivate" on the incentive
2. Confirm action
3. **Expected Output**: 
   - Incentive status: Inactive
   - No longer appears in active incentives list

## Expected Outcomes Summary

### Successful Demo Indicators
- ✅ 3 participants registered with different roles
- ✅ 1 incentive created and managed
- ✅ 1 waste item submitted, transferred twice, and confirmed
- ✅ Rewards distributed to supply chain participants
- ✅ Statistics updated across all dashboards
- ✅ All transactions confirmed on Stellar testnet

### Key Metrics After Demo
- Total Participants: 3
- Total Waste Items: 1
- Total Transfers: 2
- Total Incentives: 1 (deactivated)
- Total Rewards Distributed: ~5000-7500 points (depending on percentages)

## Troubleshooting

### Transaction Fails
- **Issue**: "Insufficient XLM balance"
- **Solution**: Fund account via friendbot again

### Wallet Not Connected
- **Issue**: "Please connect wallet"
- **Solution**: Ensure Freighter is unlocked and connected to testnet

### Contract Error
- **Issue**: "Participant not registered"
- **Solution**: Complete registration step first

### Transfer Fails
- **Issue**: "Not the current owner"
- **Solution**: Verify you're logged in with the correct account

## Demo Tips

1. **Preparation**: Pre-fund all demo accounts before starting
2. **Timing**: Allow 30 seconds between transactions for blockchain confirmation
3. **Visuals**: Keep the block explorer open to show real-time transactions
4. **Narrative**: Explain the circular economy concept as you demo
5. **Questions**: Pause after each major section for audience questions

## Advanced Demo Scenarios

### Scenario A: Multiple Waste Types
- Submit different waste types (Paper, Metal, Glass)
- Create incentives for each type
- Show filtering and sorting capabilities

### Scenario B: Batch Operations
- Submit multiple waste items at once
- Demonstrate bulk transfer capabilities
- Show aggregated statistics

### Scenario C: Supply Chain Tracking
- Follow a single waste item through multiple transfers
- Visualize the complete journey on the tracker
- Highlight transparency and traceability

## Demo Data Cleanup

After the demo, you can:
1. Keep the contract for future demos
2. Deploy a fresh contract for clean slate
3. Deactivate all test incentives
4. Document final state for reference

## Next Steps

After the demo, guide participants to:
1. Review the documentation
2. Explore the GitHub repository
3. Try the testnet deployment themselves
4. Provide feedback and suggestions

---

**Demo Duration**: ~25-30 minutes
**Audience Level**: Technical and non-technical
**Prerequisites**: Basic blockchain knowledge helpful but not required
