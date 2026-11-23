# Scavngr User Documentation

Complete guide for platform end users — recyclers, collectors, and manufacturers.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Participant Registration Guide](#participant-registration-guide)
3. [Waste Submission Guide](#waste-submission-guide)
4. [Verification Guide](#verification-guide)
5. [Incentive Guide](#incentive-guide)
6. [Analytics Guide](#analytics-guide)
7. [Troubleshooting FAQs](#troubleshooting-faqs)
8. [Glossary of Terms](#glossary-of-terms)
9. [Video Tutorials List](#video-tutorials-list)

---

## Getting Started

### What is Scavngr?

Scavngr is a decentralised recycling platform on the Stellar blockchain. It connects three types of participants in a transparent supply chain:

- **Recyclers** — collect waste materials and submit them to the platform
- **Collectors** — receive, sort, and verify materials from recyclers
- **Manufacturers** — process verified materials and reward the supply chain

Every action — registration, submission, transfer, reward — is recorded on-chain, making the entire lifecycle transparent and auditable.

### What You Need

| Requirement    | Details                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Stellar wallet | [Freighter](https://www.freighter.app) (browser extension, free)                                  |
| XLM balance    | ~5 XLM for transaction fees. Get testnet XLM free from [Friendbot](https://friendbot.stellar.org) |
| Web browser    | Chrome, Firefox, Brave, or Edge (latest)                                                          |
| Internet       | Stable connection required for blockchain transactions                                            |

### Quick Start (5 minutes)

1. **Install Freighter** → https://www.freighter.app
2. **Create an account** in Freighter and save your secret key securely
3. **Fund your account** — on testnet: visit https://friendbot.stellar.org and enter your address
4. **Open Scavngr** → connect your wallet → register your role
5. **Start submitting waste or creating incentives**

---

## Participant Registration Guide

You must register before using any platform features. Registration records your role and location permanently on-chain.

### Choosing Your Role

| Role             | Who it's for                                  | What you can do                                            |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------- |
| **Recycler**     | Individuals, households, small businesses     | Submit waste, transfer to collectors, earn rewards         |
| **Collector**    | Waste collection services, sorting facilities | Receive waste, verify materials, transfer to manufacturers |
| **Manufacturer** | Processing plants, factories                  | Create incentives, receive materials, distribute rewards   |

> You can only register once per Stellar address. Choose your role carefully.

### How to Register

**Step 1 — Connect your wallet**

- Click **Connect Wallet** in the top navigation
- Approve the connection in Freighter
- Your address appears in the navigation bar

**Step 2 — Open the registration form**

- Click **Register** or navigate to **Account → Register**
- Select your role from the dropdown

**Step 3 — Enter your details**

| Field        | Required | Notes                                                    |
| ------------ | -------- | -------------------------------------------------------- |
| Display Name | ✅       | Your business or personal name (max 64 characters)       |
| Role         | ✅       | Recycler, Collector, or Manufacturer                     |
| Latitude     | ✅       | Your location in decimal degrees (e.g. 52.52 for Berlin) |
| Longitude    | ✅       | Your location in decimal degrees (e.g. 13.40 for Berlin) |

**Step 4 — Submit and approve**

- Click **Register**
- Freighter will open — review the transaction details
- Click **Approve** in Freighter
- Wait 5–10 seconds for blockchain confirmation

**Transaction cost**: ~1 XLM

### After Registration

- Your profile appears in **Account → My Profile**
- You can update your name and location at any time (requires a new transaction)
- Your registration timestamp and role are permanently recorded on-chain

---

## Waste Submission Guide

Recyclers submit waste items to start the supply chain. Each submission records the type, weight, and location of the material.

### Accepted Waste Types

| Type              | Examples                            | Points per kg (base) |
| ----------------- | ----------------------------------- | -------------------- |
| 🧴 **Plastic**    | Bottles, containers, packaging      | 2                    |
| 📰 **Paper**      | Cardboard, newspapers, office paper | 1                    |
| 🔩 **Metal**      | Aluminium cans, steel, copper wire  | 5                    |
| 🍶 **Glass**      | Bottles, jars, containers           | 2                    |
| 🌿 **Organic**    | Food scraps, garden waste           | 1                    |
| 💻 **Electronic** | Phones, computers, batteries        | 6                    |

### Single Waste Submission

1. Navigate to **Submit Waste** or click **+ New Submission**
2. Select the **Waste Type** from the dropdown
3. Enter the **Weight** in grams (minimum 100 g)
4. Set your **Location**:
   - Click **Use My Location** to auto-fill from your browser
   - Or enter latitude/longitude manually
5. Add an optional **description** (e.g. "10 plastic bottles from office")
6. Click **Submit** and approve in Freighter

**Transaction cost**: ~1 XLM

### Batch Submission

Submit multiple waste items in a single transaction (more efficient, lower fees):

1. Click **Batch Submit**
2. Click **+ Add Item** for each waste item
3. For each item, select type and enter weight
4. Click **Submit All** and approve in Freighter

**Transaction cost**: ~2 XLM (cheaper than submitting individually)

### Tracking Your Submissions

After submitting:

- View all your waste in **My Waste** dashboard
- Each item shows current status:

| Status          | Meaning                              |
| --------------- | ------------------------------------ |
| **Pending**     | Awaiting verification by a collector |
| **Verified**    | Confirmed by a collector             |
| **Transferred** | Moved to another participant         |
| **Deactivated** | Removed from active circulation      |

### Transferring Waste to a Collector

Once your waste is submitted, you can transfer it to a registered collector:

1. Go to **My Waste** and select a waste item
2. Click **Transfer**
3. Enter the collector's Stellar address (must be a registered Collector)
4. Add an optional transfer note
5. Confirm your current location
6. Click **Transfer** and approve in Freighter

> Only the current owner of a waste item can initiate a transfer.

---

## Verification Guide

Collectors verify waste to confirm its quality and type before it moves further in the supply chain.

### Why Verification Matters

Verification is the quality gate of the supply chain:

- Ensures reported weights and types are accurate
- Triggers reward eligibility
- Creates an auditable chain of custody

### Verifying a Waste Item (Collectors only)

1. Waste transferred to you appears in **Pending Verification**
2. Click on a waste item to view its details:
   - Type, weight, submission location
   - Submitter's address and history
3. Physically inspect the material to confirm it matches the submission
4. Click **Verify** and approve in Freighter

> ⚠️ Only verify waste you have physically inspected. False verifications undermine the platform's integrity.

**Transaction cost**: ~0.5 XLM

### Confirming Waste Details

After verification, use **Confirm Details** to formally attest:

- Waste type matches submission
- Weight is within acceptable tolerance
- Material is not contaminated

### Resetting Confirmation

If you need to correct a confirmation:

1. Go to the waste item in **My Inventory**
2. Click **Reset Confirmation**
3. Approve in Freighter (only the waste owner can do this)

---

## Incentive Guide

Manufacturers create incentive programmes to encourage collection of specific materials by offering reward points.

### How Incentives Work

```
Manufacturer creates incentive:
  Waste type: Plastic
  Reward: 100 points per kg
  Budget: 10,000 points total

Recycler submits 5 kg plastic → earns 500 points
Collector receives 30% → 150 points
Recycler receives 70% → 350 points
Budget remaining: 9,500 points
```

### Creating an Incentive (Manufacturers only)

1. Navigate to **Incentives → Create Incentive**
2. Fill in the form:

| Field         | Description                            |
| ------------- | -------------------------------------- |
| Waste Type    | Which material you want to incentivise |
| Reward Points | Points per kilogram                    |
| Total Budget  | Maximum total points available         |

3. Click **Create** and approve in Freighter

**Transaction cost**: ~1 XLM

### Managing Your Incentives

In **Incentives → My Incentives** you can:

- **View** remaining budget and points per unit
- **Update** reward rate or add budget (click **Edit**)
- **Deactivate** an incentive that has met its goals (click **Deactivate**)

> Once an incentive's budget reaches zero, it auto-deactivates.

### Distributing Rewards

After receiving verified materials from the supply chain:

1. Go to **Reward Distribution**
2. Select the waste item and matching incentive
3. Review the distribution:
   - Recycler share (default: 70%)
   - Collector share (default: 30%)
4. Click **Distribute Rewards** and approve in Freighter

The reward points are immediately credited to each participant's account.

### Tiered Incentives

Some incentives offer higher rates for larger quantities:

| Weight Range | Points per kg |
| ------------ | ------------- |
| 0–10 kg      | 50            |
| 10–100 kg    | 75            |
| 100+ kg      | 100           |

Check the incentive details page to see if tiers apply.

---

## Analytics Guide

Track your environmental impact and platform activity from your personal dashboard.

### Your Dashboard

Access your dashboard at **Account → Dashboard**. It shows:

| Metric                    | Description                                     |
| ------------------------- | ----------------------------------------------- |
| **Total Waste Processed** | Cumulative grams you've submitted or handled    |
| **Total Tokens Earned**   | Lifetime reward points accumulated              |
| **Active Groups**         | Number of supply chain groups you're part of    |
| **Certification Level**   | Your tier based on activity (Beginner → Expert) |

### Certification Levels

Your certification level upgrades automatically as you process more waste:

| Level           | Waste Processed | Reward Multiplier |
| --------------- | --------------- | ----------------- |
| 🌱 Beginner     | 0–10 items      | 1.0×              |
| 🌿 Intermediate | 11–50 items     | 1.1×              |
| 🌳 Advanced     | 51–200 items    | 1.25×             |
| ⭐ Expert       | 201+ items      | 1.5×              |

### Supply Chain Statistics

The **Analytics** page shows platform-wide data:

- Total waste processed by type (chart)
- Top contributors leaderboard
- Active incentives by waste type
- Supply chain throughput over time

### Carbon Credits

Each waste type has a CO₂ offset rate. The platform calculates your total carbon impact:

| Waste Type | CO₂ offset rate     |
| ---------- | ------------------- |
| Plastic    | 2.5 g CO₂e per gram |
| Paper      | 1.8 g CO₂e per gram |
| Metal      | 3.2 g CO₂e per gram |
| Glass      | 0.8 g CO₂e per gram |
| Organic    | 0.5 g CO₂e per gram |
| Electronic | 4.0 g CO₂e per gram |

Your total CO₂ offset is displayed on your profile and certificate.

### Leaderboard

The leaderboard ranks participants by total waste processed. It resets monthly, with top performers earning bonus reward multipliers for the following month.

---

## Troubleshooting FAQs

### Wallet & Connection

**Q: My wallet won't connect.**
A: (1) Ensure Freighter is installed and unlocked. (2) Refresh the page. (3) Check you're on the correct network (testnet vs mainnet) in Freighter settings. (4) Try a different browser.

**Q: The "Connect Wallet" button does nothing.**
A: (1) Check your browser's popup blocker isn't preventing the Freighter window. (2) Try disabling other wallet extensions. (3) Clear browser cache.

**Q: I see "Transaction Failed" after approving.**
A: (1) Check your XLM balance — you need at least 1 XLM for fees. (2) Verify you're on the correct Stellar network. (3) Retry after 30 seconds (temporary congestion). (4) Check the error code in Freighter's transaction history.

---

### Registration

**Q: I get "Participant already registered."**
A: Each Stellar address can only register once. If you used a different account, connect that wallet instead. If this is your first time, contact support.

**Q: My coordinates are rejected.**
A: Latitude must be −90 to +90, longitude −180 to +180, entered as decimal degrees (e.g. 52.52, not 52°31'). Use the map picker for accuracy.

**Q: Can I change my role?**
A: Yes — go to **Account → Settings → Update Role**. Note: changing roles resets some statistics.

---

### Waste Submission

**Q: "Weight must be at least 100 grams."**
A: The minimum submission is 100 g. Combine smaller amounts into a single submission.

**Q: "Weight exceeds maximum."**
A: Split large batches into multiple submissions (max 1,000,000 kg per submission). Use batch submission for efficiency.

**Q: My submitted waste doesn't appear in My Waste.**
A: Wait 10–15 seconds for blockchain confirmation. If it still doesn't appear, check the transaction in Stellar Expert using the transaction hash from Freighter.

---

### Verification & Transfers

**Q: I can't verify waste.**
A: (1) Ensure you're registered as a Collector. (2) The waste must be transferred to you first. (3) You cannot verify waste you submitted yourself.

**Q: "Cannot transfer — not owner."**
A: Only the current owner can transfer waste. If you received it from a transfer, you are now the owner and can transfer it onward.

---

### Rewards

**Q: I submitted waste but received no rewards.**
A: Rewards are distributed by the manufacturer after the waste reaches them and they call **Distribute Rewards**. Contact the manufacturer if distribution is delayed.

**Q: My reward amount seems lower than expected.**
A: (1) Check the incentive's points per kg. (2) Verify your waste weight was accepted. (3) Note that collectors receive 30% — if you're a collector, you get 30% of the incentive value, not 100%.

**Q: The incentive says "budget exhausted."**
A: The manufacturer's budget ran out. They need to create a new incentive or add budget to the existing one.

---

## Glossary of Terms

| Term                    | Definition                                                                |
| ----------------------- | ------------------------------------------------------------------------- |
| **Waste**               | A recyclable material recorded on the blockchain with a unique ID         |
| **Participant**         | A registered user with a role (Recycler, Collector, or Manufacturer)      |
| **Incentive**           | A reward programme created by a Manufacturer for a specific waste type    |
| **Reward Points**       | On-chain tokens earned for recycling activity                             |
| **Budget**              | Total reward points a Manufacturer allocates to an incentive              |
| **Verification**        | A Collector's on-chain confirmation of waste quality and type             |
| **Transfer**            | Moving ownership of a waste item to another participant                   |
| **Supply Chain**        | The full path a waste item travels: Recycler → Collector → Manufacturer   |
| **Certification Level** | Your tier (Beginner/Intermediate/Advanced/Expert) based on activity       |
| **Carbon Credits**      | CO₂ offset calculated from your recycling activity                        |
| **Collector %**         | The percentage of rewards that go to collectors (default: 30%)            |
| **Owner %**             | The percentage of rewards that go to the waste owner (default: 50%)       |
| **Ledger**              | A block in the Stellar blockchain; new ledger every ~5 seconds            |
| **Stroop**              | The smallest unit of XLM: 1 XLM = 10,000,000 stroops                      |
| **Freighter**           | The recommended Stellar browser wallet extension                          |
| **Soroban**             | Stellar's smart contract platform, which powers Scavngr                   |
| **Contract ID**         | The on-chain address of the Scavngr smart contract                        |
| **Transaction Hash**    | A unique identifier for each blockchain transaction                       |
| **Gas / Fee**           | Transaction fee paid in XLM to process actions on Stellar                 |
| **Deactivated**         | A waste item removed from circulation (cannot be transferred or verified) |
| **Contaminated**        | Waste marked as containing non-recyclable materials                       |

---

## Video Tutorials List

The following video tutorials are planned or available for the Scavngr platform.

### Getting Started

| #   | Title                                    | Duration | Topics                                             |
| --- | ---------------------------------------- | -------- | -------------------------------------------------- |
| 1   | Setting Up Your Stellar Wallet           | 5 min    | Install Freighter, create account, fund on testnet |
| 2   | Connecting to Scavngr for the First Time | 3 min    | Connect wallet, navigate the UI                    |
| 3   | Registering as a Recycler                | 4 min    | Registration form, approving in Freighter          |

### Recycler Tutorials

| #   | Title                             | Duration | Topics                                   |
| --- | --------------------------------- | -------- | ---------------------------------------- |
| 4   | Submitting Your First Waste Item  | 6 min    | Single submission, waste types, location |
| 5   | Batch Submission for Efficiency   | 5 min    | Batch form, multiple items, fee saving   |
| 6   | Transferring Waste to a Collector | 4 min    | Finding collectors, transfer flow        |
| 7   | Tracking Your Submissions         | 3 min    | Status dashboard, transaction history    |

### Collector Tutorials

| #   | Title                        | Duration | Topics                                  |
| --- | ---------------------------- | -------- | --------------------------------------- |
| 8   | Verifying Received Materials | 7 min    | Inspection process, verification flow   |
| 9   | Managing Your Inventory      | 4 min    | Inventory dashboard, sorting, transfers |

### Manufacturer Tutorials

| #   | Title                                    | Duration | Topics                                |
| --- | ---------------------------------------- | -------- | ------------------------------------- |
| 10  | Creating Your First Incentive            | 6 min    | Incentive form, budget, waste types   |
| 11  | Managing and Updating Incentives         | 4 min    | Edit, deactivate, monitor budget      |
| 12  | Distributing Rewards to the Supply Chain | 5 min    | Reward distribution flow, percentages |

### Advanced

| #   | Title                                  | Duration | Topics                                |
| --- | -------------------------------------- | -------- | ------------------------------------- |
| 13  | Understanding Your Analytics Dashboard | 5 min    | Metrics, charts, certification levels |
| 14  | Carbon Credit Calculation Explained    | 4 min    | CO₂ rates, how credits are calculated |
| 15  | Security Best Practices                | 6 min    | Key management, avoiding scams        |

> 📹 Videos are hosted on the [Scavngr YouTube channel](https://youtube.com/@scavngr). Community-contributed tutorials are welcome — see CONTRIBUTING.md.

---

_Last updated: June 2026_
