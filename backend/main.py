from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random
import uuid
from datetime import datetime

app = FastAPI(title="Predictive Swarm Shield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── City Config ──────────────────────────────────────────────────────────────
CITIES = {
    "chennai":   {"name": "Chennai",   "lat": 13.08, "lon": 80.27, "n": 120, "aqi_base": 95,  "rain_base": 0.30},
    "mumbai":    {"name": "Mumbai",    "lat": 19.07, "lon": 72.88, "n": 160, "aqi_base": 145, "rain_base": 0.25},
    "delhi":     {"name": "Delhi",     "lat": 28.61, "lon": 77.21, "n": 200, "aqi_base": 315, "rain_base": 0.15},
    "bangalore": {"name": "Bangalore", "lat": 12.97, "lon": 77.59, "n": 100, "aqi_base": 68,  "rain_base": 0.20},
}

# ─── In-Memory State ─────────────────────────────────────────────────────────
workers = {}
disruptions = {}
votes = {}
payouts = []

def _init():
    for city_id, cfg in CITIES.items():
        disruptions[city_id] = {"active": False, "type": None, "severity": None, "started_at": None}
        votes[city_id] = {"count": 0, "required": 12, "active": False}
        for i in range(cfg["n"]):
            wid = f"{city_id}_{i:03d}"
            workers[wid] = {
                "id": wid,
                "city": city_id,
                "lat": cfg["lat"] + random.uniform(-0.12, 0.12),
                "lon": cfg["lon"] + random.uniform(-0.14, 0.14),
                "online": True,
                "tier": random.choice(["basic", "basic", "standard", "standard", "premium"]),
                "weekly_earnings": random.randint(3500, 9500),
                "tenure_weeks": random.randint(2, 104),
                "fraud_score": round(random.uniform(0.02, 0.20), 3),
            }

_init()

# ─── Helpers ─────────────────────────────────────────────────────────────────
def swarm_status(city_id: str):
    cw = [w for w in workers.values() if w["city"] == city_id]
    total = len(cw)
    offline = sum(1 for w in cw if not w["online"])
    ratio = round(offline / total, 3) if total else 0
    return {
        "total": total,
        "offline": offline,
        "online": total - offline,
        "ratio": ratio,
        "triggered": ratio >= 0.65,
        "borderline": 0.45 <= ratio < 0.65,
    }

def weather_data(city_id: str):
    cfg = CITIES[city_id]
    dis = disruptions[city_id]
    aqi = cfg["aqi_base"] + random.randint(-10, 20)
    rain = cfg["rain_base"] + random.uniform(-0.05, 0.08)
    if dis["active"]:
        if dis["type"] == "aqi":    aqi  = 330 + random.randint(0, 60)
        elif dis["type"] == "storm": rain = 0.88 + random.uniform(0, 0.08)
        elif dis["type"] == "flood": rain = 0.95 + random.uniform(0, 0.04)
    aqi  = max(0, min(500, round(aqi)))
    rain = max(0, min(1.0, round(rain, 2)))
    if   aqi > 300 or rain > 0.80: sev = "severe"
    elif aqi > 200 or rain > 0.55: sev = "moderate"
    elif aqi > 140 or rain > 0.35: sev = "mild"
    else:                           sev = "clear"
    return {"aqi": aqi, "rain_prob": rain, "temp": round(random.uniform(24, 43), 1),
            "wind_kmh": round(random.uniform(5, 45), 1), "severity": sev}

def calc_payout(worker: dict, severity: str) -> int:
    base = {"basic": 250, "standard": 500, "premium": 900}[worker["tier"]]
    mult = {"mild": 0.5, "moderate": 0.8, "severe": 1.0, "catastrophic": 1.3}.get(severity, 1.0)
    return round(base * mult)

def fire_payouts(city_id: str, severity: str):
    affected = [w for w in workers.values() if w["city"] == city_id and not w["online"]]
    batch = random.sample(affected, min(len(affected), 60))
    for w in batch:
        if   w["fraud_score"] < 0.25: status = "paid"
        elif w["fraud_score"] < 0.70: status = "flagged"
        else:                          status = "held"
        payouts.insert(0, {
            "id": str(uuid.uuid4())[:8].upper(),
            "worker_id": w["id"],
            "city": CITIES[city_id]["name"],
            "tier": w["tier"],
            "amount": calc_payout(w, severity),
            "severity": severity,
            "status": status,
            "fraud_score": w["fraud_score"],
            "timestamp": datetime.now().isoformat(),
        })

# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "Predictive Swarm Shield", "version": "1.0.0"}

@app.get("/api/dashboard")
def dashboard():
    cities_data = {}
    for city_id in CITIES:
        sw  = swarm_status(city_id)
        wth = weather_data(city_id)
        v   = votes[city_id]
        dis = disruptions[city_id]
        cities_data[city_id] = {
            "name": CITIES[city_id]["name"],
            "swarm": sw,
            "weather": wth,
            "disruption": {**dis},
            "votes": {"count": v["count"], "required": v["required"], "active": v["active"]},
        }
    total_paid = sum(p["amount"] for p in payouts if p["status"] == "paid")
    return {
        "cities": cities_data,
        "stats": {
            "total_workers": len(workers),
            "total_payouts": len(payouts),
            "total_paid_inr": total_paid,
            "active_disruptions": sum(1 for d in disruptions.values() if d["active"]),
        },
        "recent_payouts": payouts[:15],
    }

@app.get("/api/workers/{city_id}")
def get_workers(city_id: str):
    if city_id not in CITIES:
        return {"error": "City not found"}
    cw = [w for w in workers.values() if w["city"] == city_id]
    return {"workers": cw, "swarm": swarm_status(city_id)}

@app.post("/api/simulate/{city_id}/{disruption_type}")
def simulate_disruption(city_id: str, disruption_type: str):
    if city_id not in CITIES:
        return {"error": "City not found"}
    if disruption_type not in ["storm", "flood", "aqi", "bandh"]:
        return {"error": "Invalid disruption type"}

    offline_pct = {"storm": 0.76, "flood": 0.87, "aqi": 0.69, "bandh": 0.92}[disruption_type]
    severity    = {"storm": "severe", "flood": "severe", "aqi": "moderate", "bandh": "moderate"}[disruption_type]

    city_workers = [wid for wid, w in workers.items() if w["city"] == city_id]
    n_offline = int(len(city_workers) * offline_pct)
    for wid in random.sample(city_workers, n_offline):
        workers[wid]["online"] = False

    disruptions[city_id] = {
        "active": True, "type": disruption_type,
        "severity": severity, "started_at": datetime.now().isoformat(),
    }

    sw = swarm_status(city_id)

    if sw["borderline"]:
        votes[city_id].update({"active": True, "count": 0})

    if sw["triggered"]:
        fire_payouts(city_id, severity)

    return {
        "city": city_id,
        "disruption_type": disruption_type,
        "severity": severity,
        "swarm": sw,
        "layer_fired": "swarm" if sw["triggered"] else ("voting" if sw["borderline"] else "none"),
        "payout_fired": sw["triggered"],
        "voting_activated": votes[city_id]["active"],
    }

@app.post("/api/forecast-prepay/{city_id}")
def forecast_prepay(city_id: str):
    if city_id not in CITIES:
        return {"error": "City not found"}
    cfg = CITIES[city_id]
    cw = [w for w in workers.values() if w["city"] == city_id]
    n = min(len(cw), 40)
    batch = random.sample(cw, n)
    prepays = []
    for w in batch:
        amt = calc_payout(w, "moderate")
        prepays.append({"worker_id": w["id"], "tier": w["tier"], "amount": amt})
        payouts.insert(0, {
            "id": str(uuid.uuid4())[:8].upper(),
            "worker_id": w["id"],
            "city": cfg["name"],
            "tier": w["tier"],
            "amount": amt,
            "severity": "forecast",
            "status": "pre-paid",
            "fraud_score": w["fraud_score"],
            "timestamp": datetime.now().isoformat(),
        })
    return {
        "city": city_id,
        "layer": "forecast",
        "confidence": round(random.uniform(0.81, 0.96), 2),
        "workers_prepaid": n,
        "total_disbursed": sum(p["amount"] for p in prepays),
        "note": "Wallets loaded 24hrs before predicted event",
    }

@app.post("/api/vote/{city_id}")
def cast_vote(city_id: str):
    if city_id not in CITIES:
        return {"error": "City not found"}
    v = votes[city_id]
    v["count"] = min(v["count"] + random.randint(1, 3), v["required"] + 4)
    quorum = v["count"] >= v["required"]
    if quorum and not disruptions[city_id]["active"]:
        disruptions[city_id].update({"active": True, "type": "voting", "severity": "moderate",
                                      "started_at": datetime.now().isoformat()})
        fire_payouts(city_id, "moderate")
    return {
        "votes": v["count"], "required": v["required"],
        "quorum_reached": quorum, "payout_fired": quorum,
        "layer": "voting",
    }

@app.post("/api/reset/{city_id}")
def reset_city(city_id: str):
    if city_id not in CITIES:
        return {"error": "City not found"}
    for wid, w in workers.items():
        if w["city"] == city_id:
            w["online"] = True
    disruptions[city_id] = {"active": False, "type": None, "severity": None, "started_at": None}
    votes[city_id] = {"count": 0, "required": 12, "active": False}
    return {"city": city_id, "reset": True, "message": "All workers back online"}

@app.get("/api/payouts")
def get_payouts():
    return {
        "payouts": payouts[:20],
        "total": len(payouts),
        "total_inr": sum(p["amount"] for p in payouts if p["status"] in ["paid", "pre-paid"]),
    }