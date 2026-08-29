# Local Development Setup Guide

A complete end-to-end onboarding guide for running all four Scavenger workspaces (**`stellar-contract`**, **`backend`**, **`indexer`**, and **`frontend`**) together locally.

---

## 1. Architecture & Service Topology

The Scavenger platform consists of four primary components communicating locally via HTTP, WebSocket, RPC, and database connections:

```mermaid
graph TD
    subgraph Client_Layer ["Client Layer"]
        FRONTEND["Frontend (Vite / React)<br/>Port: 5173"]
    end

    subgraph Service_Layer ["Service Layer"]
        BACKEND["Backend API (Rust / Actix)<br/>Port: 8080"]
        INDEXER["Event Indexer (Node.js / TS)<br/>Port: 3001"]
    end

    subgraph Blockchain_and_Data ["Blockchain & Data Layer"]
        STELLAR["Stellar Standalone / Soroban RPC<br/>Port: 8000"]
        POSTGRES["PostgreSQL<br/>Port: 5432"]
        REDIS["Redis<br/>Port: 6379"]
        ELASTIC["Elasticsearch (Optional)<br/>Port: 9200"]
    end

    FRONTEND -->|REST / WS| BACKEND
    FRONTEND -->|Soroban RPC (Freighter)| STELLAR
    INDEXER -->|Poll getEvents RPC| STELLAR
    INDEXER -->|Persist indexed state| POSTGRES
    INDEXER -->|Cache / pub-sub| REDIS
    BACKEND -->|Query state| POSTGRES
    BACKEND -->|Cache| REDIS
    BACKEND -->|Search Index| ELASTIC
```

---

## 2. Global Prerequisites

Before beginning, ensure your host environment has the following tools installed:

| Tool | Minimum Version | Installation / Verification Command | Purpose |
|------|-----------------|--------------------------------------|---------|
| **Git** | 2.30+ | `git --version` | Source code control |
| **Docker & Compose** | 24.0+ / Compose v2 | `docker compose version` | Containerized dependencies |
| **Rust & Cargo** | 1.76+ (nightly / 2021) | `rustc --version` | Backend & Soroban smart contracts |
| **WASM Target** | wasm32-unknown-unknown | `rustup target add wasm32-unknown-unknown` | Compiling Soroban WASM bytecode |
| **Stellar CLI** | 21.0+ | `stellar --version` (or `soroban --version`) | Deploying & invoking smart contracts |
| **Node.js & npm** | Node v18+ / npm v9+ | `node -v && npm -v` | Frontend & Indexer execution |

---

## 3. Quickstart: Docker Compose (All Services)

The fastest way to spin up the entire Scavenger stack is using Docker Compose:

```bash
# 1. Clone repository
git clone https://github.com/Xoulomon/Scavenger.git
cd Scavenger

# 2. Copy base environment file
cp .env.example .env

# 3. Start all infrastructure and application services
docker compose up -d

# 4. Verify running containers
docker compose ps
```

### Local Endpoint Summary:
- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API**: [http://localhost:8080](http://localhost:8080)
- **Backend Health Check**: [http://localhost:8080/health](http://localhost:8080/health)
- **Indexer Health**: [http://localhost:3001/health](http://localhost:3001/health)
- **Stellar Quickstart RPC**: [http://localhost:8000/soroban/rpc](http://localhost:8000/soroban/rpc)
- **PostgreSQL**: `localhost:5432` (`scavngr` / `scavngr_dev`)
- **Redis**: `localhost:6379`

---

## 4. Manual Setup: Running Each Workspace Directly

For active feature development, you can run auxiliary infrastructure (Postgres, Redis, Stellar Quickstart) in Docker and run the application workspaces natively on your machine for hot-reloading and fast debugging.

### Step 4.1: Start Supporting Infrastructure

```bash
# Start only database, cache, and standalone Stellar network
docker compose up -d postgres redis stellar elasticsearch
```

---

### Step 4.2: Workspace 1 — `stellar-contract` (Soroban Smart Contract)

1. **Navigate to the workspace**:
   ```bash
   cd stellar-contract
   ```

2. **Build the WASM contract**:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```

3. **Configure local network identity**:
   ```bash
   # Add standalone network configuration
   stellar network add \
     --rpc-url "http://localhost:8000/soroban/rpc" \
     --network-passphrase "Standalone Network ; February 2017" \
     standalone

   # Generate or fund an admin identity
   stellar keys generate --network standalone admin
   stellar keys fund admin --network standalone
   ```

4. **Deploy the contract to local standalone node**:
   ```bash
   CONTRACT_ID=$(stellar contract deploy \
     --wasm ../target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm \
     --source admin \
     --network standalone)

   echo "Deployed Contract ID: $CONTRACT_ID"
   ```

5. **Initialize the contract admin**:
   ```bash
   ADMIN_ADDRESS=$(stellar keys address admin)
   stellar contract invoke \
     --id $CONTRACT_ID \
     --source admin \
     --network standalone \
     -- initialize_admin \
     --admin $ADMIN_ADDRESS
   ```

> [!IMPORTANT]
> Save your `$CONTRACT_ID` (starts with `C...`). You will provide this ID to the backend, indexer, and frontend environment files.

---

### Step 4.3: Workspace 2 — `backend` (Rust / Actix-web)

1. **Navigate to the workspace**:
   ```bash
   cd ../backend
   ```

2. **Configure environment variables** (`backend/.env` or root `.env`):
   ```ini
   SERVER_HOST=0.0.0.0
   SERVER_PORT=8080
   LOG_LEVEL=debug
   LOG_FORMAT=pretty
   DATABASE_URL=postgresql://scavngr:scavngr_dev@localhost:5432/scavngr
   REDIS_URL=redis://localhost:6379
   ELASTICSEARCH_URL=http://localhost:9200
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   CSRF_SECRET=scavenger-local-dev-secret-key-12345
   CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
   STORAGE_PATH=/tmp/scavenger-storage
   RATE_LIMIT_REQUESTS_PER_MINUTE=120
   RATE_LIMIT_BURST_SIZE=20
   ```

3. **Run database migrations / seed (if needed)**:
   ```bash
   # Schema is seeded automatically via Docker Compose on init:
   # docker-entrypoint-initdb.d/seed.sql
   ```

4. **Run the backend server**:
   ```bash
   cargo run --bin scavenger-backend
   ```
   The backend API will start at `http://localhost:8080`.

---

### Step 4.4: Workspace 3 — `indexer` (Node.js / TypeScript)

1. **Navigate to the workspace**:
   ```bash
   cd ../indexer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables** (`indexer/.env`):
   ```ini
   PORT=3001
   DATABASE_URL=postgresql://scavngr:scavngr_dev@localhost:5432/scavngr
   REDIS_URL=redis://localhost:6379
   STELLAR_RPC_URL=http://localhost:8000/soroban/rpc
   NETWORK_PASSPHRASE="Standalone Network ; February 2017"
   CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
   START_LEDGER=0
   POLL_INTERVAL_MS=2000
   ```

4. **Run the indexer in development mode**:
   ```bash
   npm run dev
   ```
   The indexer will start listening for contract events and expose a health API on `http://localhost:3001/health`.

---

### Step 4.5: Workspace 4 — `frontend` (React / Vite)

1. **Navigate to the workspace**:
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables** (`frontend/.env`):
   ```ini
   VITE_CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
   VITE_NETWORK=STANDALONE
   VITE_RPC_URL=http://localhost:8000/soroban/rpc
   VITE_API_URL=http://localhost:8080
   VITE_FIREBASE_API_KEY=dev-stub
   VITE_FIREBASE_AUTH_DOMAIN=dev-stub
   VITE_FIREBASE_PROJECT_ID=dev-stub
   VITE_FIREBASE_STORAGE_BUCKET=dev-stub
   VITE_FIREBASE_MESSAGING_SENDER_ID=dev-stub
   VITE_FIREBASE_APP_ID=dev-stub
   ```

4. **Start the Vite dev server**:
   ```bash
   npm run dev
   ```
   Open your browser at [http://localhost:5173](http://localhost:5173).

---

## 5. Local Service Interconnection Matrix

| From Service | Target Service | Connection Protocol | Default URL / Port | Key Environment Variable |
|--------------|----------------|---------------------|---------------------|--------------------------|
| **Frontend** | Backend API | HTTP / REST & WS | `http://localhost:8080` | `VITE_API_URL` |
| **Frontend** | Stellar Node | JSON-RPC | `http://localhost:8000/soroban/rpc` | `VITE_RPC_URL` |
| **Indexer** | Stellar Node | JSON-RPC (`getEvents`) | `http://localhost:8000/soroban/rpc` | `STELLAR_RPC_URL` |
| **Indexer** | PostgreSQL | TCP / Postgres Wire | `localhost:5432` | `DATABASE_URL` |
| **Indexer** | Redis | TCP / RESP | `localhost:6379` | `REDIS_URL` |
| **Backend** | PostgreSQL | TCP / Postgres Wire | `localhost:5432` | `DATABASE_URL` |
| **Backend** | Redis | TCP / RESP | `localhost:6379` | `REDIS_URL` |
| **Backend** | Elasticsearch | HTTP / REST | `http://localhost:9200` | `ELASTICSEARCH_URL` |

---

## 6. End-to-End Smoke Test Checklist

Once all services are up, execute the following checklist to verify that your environment is fully operational:

- [ ] **1. Stellar Node Health**:
  ```bash
  curl -sf http://localhost:8000/health
  # Expected: {"status":"pass"} or HTTP 200
  ```

- [ ] **2. Database Connectivity**:
  ```bash
  docker compose exec postgres pg_isready -U scavngr
  # Expected: accepting connections
  ```

- [ ] **3. Backend API Health**:
  ```bash
  curl -sf http://localhost:8080/health
  # Expected: {"status":"healthy"} or HTTP 200
  ```

- [ ] **4. Indexer Health**:
  ```bash
  curl -sf http://localhost:3001/health
  # Expected: {"status":"ok","latest_ledger":...}
  ```

- [ ] **5. Contract Invocation Test**:
  Register a test participant via CLI:
  ```bash
  stellar contract invoke \
    --id $CONTRACT_ID \
    --source admin \
    --network standalone \
    -- register_participant \
    --address $ADMIN_ADDRESS \
    --role 0 \
    --name "SmokeTestRecycler" \
    --latitude 40712800 \
    --longitude -74006000
  ```

- [ ] **6. Indexer Event Ingestion**:
  Check indexer logs or query database to confirm participant registration event was stored:
  ```bash
  docker compose logs indexer --tail=20
  ```

- [ ] **7. Frontend Loading**:
  Open [http://localhost:5173](http://localhost:5173) in your browser. Verify the dashboard renders without runtime errors in the browser developer console.

---

## 7. Troubleshooting & FAQ

### Port Conflicts
- **Port 5432 or 6379 already in use**: Stop any existing local PostgreSQL or Redis services running natively (`sudo systemctl stop postgresql redis-server`).
- **Port 8000 in use**: Stellar standalone requires port 8000. Ensure no other web server is occupying 8000.

### Freighter Wallet with Local Network
- In Freighter Settings -> Network:
  - Add Custom Network: `Standalone`
  - Horizon URL: `http://localhost:8000`
  - Soroban RPC URL: `http://localhost:8000/soroban/rpc`
  - Passphrase: `Standalone Network ; February 2017`
