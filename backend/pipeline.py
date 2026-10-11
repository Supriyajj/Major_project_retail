"""Retail Analytics & AI Sales Forecasting - analytics pipeline.
Reads the raw CSV, computes KPIs / trends / segmentation / forecasts and
writes frontend/data.json (also used by server.py)."""
import json, warnings, pathlib
import numpy as np, pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from statsmodels.tsa.holtwinters import ExponentialSmoothing

warnings.filterwarnings("ignore")
ROOT = pathlib.Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "Retail_Sales_Data_Unlox.csv"
OUT = ROOT / "frontend" / "data.json"

def r(x, n=2): return round(float(x), n)

def clean(row):
    return {k: (r(v) if isinstance(v, (float, np.floating)) else (int(v) if isinstance(v, np.integer) else v)) for k, v in row.items()}

def load():
    df = pd.read_csv(CSV, parse_dates=["Date"]).drop_duplicates()
    df["Month"] = df["Date"].dt.to_period("M").dt.to_timestamp()
    df["Year"] = df["Date"].dt.year
    df["DOW"] = df["Date"].dt.day_name()
    df["Discount_Amt"] = df["Total_Sales"] - df["Revenue"]
    return df

def kpis(df):
    y = df.groupby("Year")["Revenue"].sum()
    return dict(
        revenue=r(df.Revenue.sum()), units=int(df.Units_Sold.sum()), orders=len(df),
        aov=r(df.Revenue.mean()), avg_discount=r(df.Discount_Percentage.mean()),
        discount_given=r(df.Discount_Amt.sum()), avg_rating=r(df.Store_Rating.mean()),
        returning_pct=r((df.Customer_Type == "Returning").mean() * 100, 1),
        promo_pct=r((df.Promotion_Applied == "Yes").mean() * 100, 1),
        rev_2023=r(y.get(2023, 0)), rev_2024=r(y.get(2024, 0)),
        yoy=r((y.get(2024, 0) / y.get(2023, 1) - 1) * 100, 2),
        start=str(df.Date.min().date()), end=str(df.Date.max().date()))

def group(df, col):
    g = df.groupby(col).agg(revenue=("Revenue", "sum"), units=("Units_Sold", "sum"),
                            orders=("Revenue", "size"), rating=("Store_Rating", "mean"),
                            discount=("Discount_Percentage", "mean")).reset_index()
    g["share"] = g.revenue / g.revenue.sum() * 100
    return [clean(x) for x in g.sort_values("revenue", ascending=False).to_dict("records")]

def cut(df, col):
    p = df.pivot_table(index="Month", columns=col, values="Revenue", aggfunc="sum").fillna(0)
    return {"months": [d.strftime("%Y-%m") for d in p.index], "series": {c: [r(v, 0) for v in p[c]] for c in p.columns}}

def seasonality(df):
    m = df.groupby(["Year", df.Date.dt.month])["Revenue"].sum().unstack(0)
    idx = m / m.mean() * 100
    return {"months": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
            "y2023": [r(v, 0) for v in m[2023]], "y2024": [r(v, 0) for v in m[2024]], "index": [r(v, 1) for v in idx.mean(axis=1)]}

def heat(df):
    p = df.pivot_table(index="Store_Location", columns="Product_Category", values="Revenue", aggfunc="sum")
    return {"rows": list(p.index), "cols": list(p.columns), "z": [[r(v, 0) for v in row] for row in p.values]}

def dow(df):
    order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    return {"days": order, "avg": [r(v, 0) for v in df.groupby("DOW")["Revenue"].mean().reindex(order)]}

def promo(df):
    out = {}
    for col in ["Promotion_Applied", "Holiday_Flag", "Customer_Type", "Payment_Mode"]:
        g = df.groupby(col).agg(avg_order=("Revenue", "mean"), units=("Units_Sold", "mean"), n=("Revenue", "size"), rev=("Revenue", "sum")).reset_index()
        out[col] = [{"key": str(a)[:-2] if str(a).endswith(".0") else str(a), "avg_order": r(b, 0), "avg_units": r(c), "orders": int(d), "revenue": r(e, 0)} for a, b, c, d, e in g.values]
    disc = df.groupby("Discount_Percentage").agg(units=("Units_Sold", "mean"), rev=("Revenue", "mean")).reset_index()
    out["discount_curve"] = [{"disc": int(a), "units": r(b), "avg_rev": r(c, 0)} for a, b, c in disc.values]
    return out

def top_brands(df):
    g = df.groupby(["Brand", "Product_Category"])["Revenue"].sum().reset_index().sort_values("Revenue", ascending=False)
    return [{"brand": a, "category": b, "revenue": r(c, 0)} for a, b, c in g.head(12).values]

def inventory(df):
    g = df.groupby("Store_Location").agg(stock=("Stock_On_Hand", "mean"), units=("Units_Sold", "sum")).reset_index()
    low = df[df.Stock_On_Hand < 100].groupby("Product_Category").size()
    return {"stores": [{"store": a, "avg_stock": r(b, 0), "units": int(c)} for a, b, c in g.values],
            "low_stock": {k: int(v) for k, v in low.items()}}

def segments(df):
    s = df.groupby(["Store_ID", "Store_Location", "Region"]).agg(
        revenue=("Revenue", "sum"), orders=("Revenue", "size"), aov=("Revenue", "mean"),
        rating=("Store_Rating", "mean"), discount=("Discount_Percentage", "mean"),
        returning=("Customer_Type", lambda x: (x == "Returning").mean() * 100),
        promo=("Promotion_Applied", lambda x: (x == "Yes").mean() * 100),
        stock=("Stock_On_Hand", "mean")).reset_index()
    y = df.pivot_table(index="Store_ID", columns="Year", values="Revenue", aggfunc="sum")
    s["growth"] = (s.Store_ID.map(y[2024] / y[2023] - 1) * 100).values
    feats = ["revenue", "aov", "rating", "discount", "returning", "growth"]
    X = StandardScaler().fit_transform(s[feats])
    km = KMeans(n_clusters=3, n_init=20, random_state=42).fit(X)
    s["cluster"] = km.labels_
    order = s.groupby("cluster")["revenue"].mean().sort_values(ascending=False).index.tolist()
    names = {order[0]: "Star Performers", order[1]: "Steady Core", order[2]: "Growth Opportunity"}
    s["segment"] = s.cluster.map(names)
    p = PCA(2, random_state=1).fit_transform(X)
    s["pc1"], s["pc2"] = p[:, 0], p[:, 1]
    s["rank"] = s.revenue.rank(ascending=False).astype(int)
    cols = ["Store_ID", "Store_Location", "Region", "revenue", "orders", "aov", "rating", "discount", "returning", "promo", "stock", "growth", "segment", "pc1", "pc2", "rank"]
    out = [clean(x) for x in s[cols].sort_values("rank").to_dict("records")]
    return {"stores": out, "k": 3, "silhouette": r(silhouette_score(X, km.labels_), 3)}

# ---------------- Forecasting ----------------
def mape(a, f): a, f = np.array(a), np.array(f); return float(np.mean(np.abs((a - f) / a)) * 100)

def feats(t):
    t = np.asarray(t); m = t % 12
    return np.column_stack([t, np.sin(2*np.pi*m/12), np.cos(2*np.pi*m/12)])

def fit_ets(train, h):
    """Damped-trend exponential smoothing (no seasonal term; too few cycles for Holt-Winters)."""
    m = ExponentialSmoothing(train, trend="add", damped_trend=True, initialization_method="estimated").fit(optimized=True)
    return np.asarray(m.forecast(h))

def fit_sets(train, h):
    """Seasonally-adjusted ETS: month index from history -> deseasonalise -> damped ETS -> reseasonalise."""
    n = len(train); idx = np.arange(n) % 12
    si = np.array([train[idx == k].mean() for k in range(12)]); si = si / si.mean()
    base = fit_ets(train / si[idx], h)
    return base * si[np.arange(n, n + h) % 12]

def fit_gbm(train, h):
    t = np.arange(len(train)); coef = np.polyfit(t, train, 1)
    m = GradientBoostingRegressor(n_estimators=150, max_depth=2, learning_rate=0.05, random_state=0)
    m.fit(feats(t), train - np.polyval(coef, t)); tf = np.arange(len(train), len(train) + h)
    return np.polyval(coef, tf) + m.predict(feats(tf))

def fit_lin(train, h):
    t = np.arange(len(train)); A = np.column_stack([np.ones(len(t)), feats(t)])
    beta = np.linalg.lstsq(A, train, rcond=None)[0]; tf = np.arange(len(train), len(train) + h)
    return np.column_stack([np.ones(h), feats(tf)]) @ beta

def fit_ma(train, h): return np.repeat(train[-3:].mean(), h)

MODELS = {"Seasonal-Adjusted ETS": fit_sets, "Damped-Trend ETS": fit_ets, "Gradient Boosting": fit_gbm, "Trend + Seasonal Regression": fit_lin, "Moving Average (baseline)": fit_ma}

def forecast_series(y, horizon=6, test=4):
    vals = np.asarray(y, dtype=float); train, hold = vals[:-test], vals[-test:]
    board = []
    for name, fn in MODELS.items():
        try:
            f = fn(train, test)
            board.append({"model": name, "mape": r(mape(hold, f)), "rmse": r(np.sqrt(np.mean((hold - f) ** 2)), 0), "holdout": [r(v, 0) for v in f]})
        except Exception as e:
            board.append({"model": name, "mape": 999.0, "rmse": 0, "holdout": [], "error": str(e)})
    board.sort(key=lambda d: d["mape"])
    # baseline is a benchmark only, never the production model
    cand = [b for b in board if "baseline" not in b["model"]]
    best_row = cand[0]; best = best_row["model"]; fc = MODELS[best](vals, horizon)
    resid = hold - np.array(best_row["holdout"])
    sd = max(float(np.std(resid)), float(vals.std() * 0.05)); z = np.sqrt(np.arange(1, horizon + 1))
    return {"best": best, "board": board, "forecast": [r(v, 0) for v in fc],
            "lo": [r(v - 1.28 * sd * k, 0) for v, k in zip(fc, z)], "hi": [r(v + 1.28 * sd * k, 0) for v, k in zip(fc, z)],
            "holdout_actual": [r(v, 0) for v in hold]}

def forecasts(df, horizon=6):
    m = df.groupby("Month")["Revenue"].sum()
    future = pd.date_range(m.index[-1] + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")
    out = {"history_months": [d.strftime("%Y-%m") for d in m.index], "history": [r(v, 0) for v in m.values],
           "future_months": [d.strftime("%Y-%m") for d in future], "overall": forecast_series(m.values, horizon)}
    for key, col in [("by_category", "Product_Category"), ("by_store", "Store_Location")]:
        out[key] = {}
        for c, g in df.groupby(col):
            s = g.groupby("Month")["Revenue"].sum().reindex(m.index, fill_value=0)
            f = forecast_series(s.values, horizon)
            out[key][c] = {"history": [r(v, 0) for v in s.values], "forecast": f["forecast"], "lo": f["lo"], "hi": f["hi"], "model": f["best"], "mape": next(b["mape"] for b in f["board"] if b["model"] == f["best"])}
    return out

def insights(d):
    k, cats, stores, seas, fc = d["kpis"], d["category"], d["store"], d["seasonality"], d["forecast"]
    i, j = int(np.argmax(seas["index"])), int(np.argmin(seas["index"]))
    fsum, last = sum(fc["overall"]["forecast"]), sum(fc["history"][-6:])
    return [
        {"icon": "📈", "text": f"Revenue {'grew' if k['yoy']>=0 else 'fell'} {abs(k['yoy'])}% YoY (2023 → 2024).", "action": "Track monthly against plan."},
        {"icon": "🏆", "text": f"{cats[0]['Product_Category']} leads with {cats[0]['share']:.1f}% of revenue; {cats[-1]['Product_Category']} trails at {cats[-1]['share']:.1f}%.", "action": "Rebalance marketing spend and shelf space."},
        {"icon": "🏬", "text": f"{stores[0]['Store_Location']} is the top store; {stores[-1]['Store_Location']} the lowest by revenue.", "action": "Replicate the top store's playbook."},
        {"icon": "📅", "text": f"Peak month: {seas['months'][i]} (index {seas['index'][i]}); weakest: {seas['months'][j]} ({seas['index'][j]}).", "action": "Plan stock and staffing around the cycle."},
        {"icon": "🔮", "text": f"Next 6 months: ₹{fsum/1e7:.1f} Cr ({(fsum/last-1)*100:+.1f}% vs previous 6 months) using {fc['overall']['best']}.", "action": "Check hold-out MAPE before relying on it."},
    ]

def build():
    df = load()
    m = df.groupby("Month").agg(revenue=("Revenue", "sum"), units=("Units_Sold", "sum"), orders=("Revenue", "size")).reset_index()
    d = dict(kpis=kpis(df),
             monthly={"months": [x.strftime("%Y-%m") for x in m.Month], "revenue": [r(v, 0) for v in m.revenue], "units": [int(v) for v in m.units], "orders": [int(v) for v in m.orders]},
             category=group(df, "Product_Category"), store=group(df, "Store_Location"), region=group(df, "Region"),
             subcategory=group(df, "Product_Subcategory"), brand=group(df, "Brand"),
             by_category=cut(df, "Product_Category"), by_store=cut(df, "Store_Location"), by_region=cut(df, "Region"),
             seasonality=seasonality(df), heatmap=heat(df), dow=dow(df), promo=promo(df), top_brands=top_brands(df),
             inventory=inventory(df), segments=segments(df), forecast=forecasts(df),
             filters=dict(stores=sorted(df.Store_Location.unique()), categories=sorted(df.Product_Category.unique()), regions=sorted(df.Region.unique())))
    d["insights"] = insights(d)
    cube = df.groupby(["Month", "Store_Location", "Region", "Product_Category"]).agg(revenue=("Revenue", "sum"), units=("Units_Sold", "sum"), orders=("Revenue", "size")).reset_index()
    d["cube"] = [[a.strftime("%Y-%m"), b, c, e, r(f, 0), int(g), int(h)] for a, b, c, e, f, g, h in cube.values]
    payload = json.dumps(d, separators=(",", ":"), default=str)
    OUT.write_text(payload)
    (OUT.parent / "data.js").write_text("window.RETAIL_DATA=" + payload + ";")  # lets index.html open via double-click
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
    return d

if __name__ == "__main__":
    build()
