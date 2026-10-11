"""Flask server: serves the dashboard and a small JSON API.
Run:  python backend/server.py   ->  http://localhost:5000"""
import pathlib, sys
from flask import Flask, jsonify, request, send_from_directory
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import pipeline as P

ROOT = pathlib.Path(__file__).resolve().parent.parent
app = Flask(__name__, static_folder=str(ROOT / "frontend"), static_url_path="")
DF = P.load()

@app.get("/")
def index(): return send_from_directory(app.static_folder, "index.html")

@app.get("/api/forecast")
def forecast():
    """Live forecast for any store / category / horizon, e.g. /api/forecast?store=Delhi&category=Fashion&horizon=9"""
    df = DF
    store, cat = request.args.get("store"), request.args.get("category")
    horizon = max(1, min(12, int(request.args.get("horizon", 6))))
    if store and store != "All": df = df[df.Store_Location == store]
    if cat and cat != "All": df = df[df.Product_Category == cat]
    if df.empty: return jsonify(error="no data for that selection"), 404
    m = df.groupby("Month")["Revenue"].sum().reindex(DF.Month.sort_values().unique(), fill_value=0)
    f = P.forecast_series(m.values, horizon)
    import pandas as pd
    fut = pd.date_range(m.index[-1] + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")
    return jsonify(history_months=[d.strftime("%Y-%m") for d in m.index], history=[round(v) for v in m.values],
                   future_months=[d.strftime("%Y-%m") for d in fut], **f)

@app.post("/api/refresh")
def refresh():
    """Re-run the full pipeline (e.g. after dropping a new CSV into /data)."""
    global DF
    P.build(); DF = P.load(); return jsonify(status="ok")

if __name__ == "__main__":
    app.run(debug=False, port=5000)
