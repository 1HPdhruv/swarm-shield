# ⚡ Predictive Swarm Shield

## Project Structure

```
swarm-shield/
├── backend/          ← FastAPI Python API
│   ├── main.py
│   ├── requirements.txt
│   └── render.yaml
└── frontend/         ← React (Vite) Dashboard
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── render.yaml
    └── src/
        ├── main.jsx
        └── App.jsx
```

---

## Step 1 — Push to GitHub

```bash
cd swarm-shield
git init
git add .
git commit -m "Initial commit — Predictive Swarm Shield"
git remote add origin https://github.com/YOUR_USERNAME/swarm-shield.git
git push -u origin main
```

---

## Step 2 — Deploy Backend on Render

1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect your GitHub repo
3. Set the **Root Directory** to `backend`
4. Render auto-detects `render.yaml` — confirm settings:
   - **Name:** `swarm-shield-api`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Click **Deploy**
6. Wait ~2 min. Copy the URL, e.g.: `https://swarm-shield-api.onrender.com`
7. Test: visit `https://swarm-shield-api.onrender.com/` — you should see `{"status":"ok"}`

---

## Step 3 — Deploy Frontend on Render

1. Go to [render.com](https://render.com) → **New +** → **Static Site**
2. Connect the same GitHub repo
3. Set the **Root Directory** to `frontend`
4. Settings:
   - **Name:** `swarm-shield-dashboard`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
5. Add Environment Variable:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://swarm-shield-api.onrender.com` ← your backend URL from Step 2
6. Click **Deploy**
7. Visit the provided URL — dashboard is live!

---

## Run Locally (Development)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# API live at http://localhost:8000
# Docs at http://localhost:8000/docs
```

**Frontend:**
```bash
cd frontend
npm install
# Create .env.local:
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
# Dashboard at http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/dashboard` | Full dashboard data (all cities, payouts, stats) |
| GET    | `/api/workers/{city_id}` | Workers in a city with swarm status |
| POST   | `/api/simulate/{city_id}/{type}` | Trigger disruption simulation |
| POST   | `/api/forecast-prepay/{city_id}` | Layer 1: Forecast pre-payment |
| POST   | `/api/vote/{city_id}` | Layer 3: Cast mutual votes |
| POST   | `/api/reset/{city_id}` | Reset city to normal state |
| GET    | `/api/payouts` | Recent payout history |

**City IDs:** `chennai`, `mumbai`, `delhi`, `bangalore`

**Disruption Types:** `storm`, `flood`, `aqi`, `bandh`

---

## Demo Flow (for judges/presentation)

1. Open the dashboard — see 4 cities with live worker grids (green = online)
2. Click **🔮 Forecast** on Delhi — Layer 1 fires, pre-pays workers before event
3. Click **⛈ Storm** on Chennai — Layer 2 (Swarm) fires at 76% offline, payout triggers
4. Click **🌫 AQI** on Mumbai — borderline, Layer 3 (Voting) activates — click **Simulate Votes**
5. Watch the payout feed fill in real-time with paid / flagged / held statuses
6. Click **↺ Reset** to bring workers back online

---

## Notes

- State is **in-memory** — resets on backend restart (intentional for demo)
- Fraud scores are randomized at startup (0.02–0.20 range)
- Each simulation triggers payouts for up to 60 workers
- Dashboard auto-refreshes every 4 seconds
