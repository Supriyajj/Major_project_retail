# Retail Pulse: Retail Analytics & AI-Powered Sales Forecasting

End-to-end capstone project: analytics pipeline, time-series forecasting, store segmentation
and an interactive dashboard, built on `data/Retail_Sales_Data_Unlox.csv` (73,000 rows, 2023-2024, 8 stores, 5 categories).

## Run it
```bash
pip install -r requirements.txt
python backend/pipeline.py      # analyse data -> frontend/data.json + data.js
python backend/server.py        # dashboard at http://localhost:5000
```
No server needed to view it: after running the pipeline, open `frontend/index.html` directly.
(The repo already ships with a generated `data.js`.)

## What it does
| Spec objective | Where |
|---|---|
| Analyse sales across stores and categories | Overview tab (filters recompute every chart in the browser) |
| Patterns, growth drivers, seasonality | Sales patterns tab: monthly seasonality, weekday, store x category heatmap, promo/holiday/discount effects |
| Forecast revenue (time series) | Forecast tab: 4 models compared on a 4-month hold-out; best is used. Per store and per category. What-if slider |
| Segment stores | Store segments tab: K-Means (k=3) on revenue, order value, rating, discount, loyalty, growth; PCA map |
| Interactive AI dashboard | Whole frontend plus "Ask the data" assistant |

## Method notes
* **Models:** Seasonal-adjusted damped ETS, damped ETS, trend+seasonal regression, gradient boosting
  (the notebook also scores ARIMA and SARIMA); a 3-month moving average is a benchmark only. Chosen by MAPE on the last 4 months.
  Holt-Winters was dropped: 24 months is too short to fit a full seasonal model reliably.
* **Intervals:** 80% band from hold-out residual spread, widening with sqrt(horizon). Approximate, not a formal prediction interval.
* **Honest caveats:** The dataset behaves like synthetic data. Revenue is nearly flat (-0.7% YoY), categories are ~20% each,
  and discounts barely change units sold. The forecast is therefore a stable estimate with low hold-out error (~2.4%) but
  the seasonality signal is weak (index ~93-104). Per-category forecasts are noisier (MAPE 2-7%).
* **Segments:** silhouette 0.2, so groups overlap; use as a guide.
* Revenue = Total_Sales after discount; currency shown in ₹ Crore (1 Cr = 10M) / Lakh (100k).

## API (server.py)
* `GET /api/forecast?store=Delhi&category=Fashion&horizon=6` - live forecast for any slice
* `POST /api/refresh` - re-run the pipeline after replacing the CSV

## Deliverables
| File | What it is |
|---|---|
| `frontend/index.html` + `backend/` | Interactive dashboard and API |
| `notebooks/Retail_Analysis_and_Forecasting.ipynb` | Full analysis: data quality, EDA, seasonality, drivers, K-Means, ARIMA / SARIMA / ETS / regression / GBM comparison, forecasts, conclusions (already executed; figures saved to `report/figures`) |
| `report/Retail_Analytics_Project_Report.docx` | Written project report (7 pages) |
| `presentation/Retail_Analytics_Presentation.pptx` | 11-slide summary deck |

To re-run the notebook: `jupyter notebook notebooks/Retail_Analysis_and_Forecasting.ipynb`

## Structure
```
backend/pipeline.py   analytics, forecasting, clustering
backend/server.py     Flask app + API
notebooks/            executed analysis notebook
report/               Word report + figures
presentation/         PowerPoint deck
frontend/             index.html, styles.css, app.js, lib/chart.umd.js, data.js
data/                 source CSV
```
