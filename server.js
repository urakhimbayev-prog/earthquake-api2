process.on("uncaughtException", err => {
  console.error("UNCAUGHT:", err);
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED:", err);
});

const express = require("express");
const axios = require("axios");

const app = express();

let cache = [];
let lastUpdate = null;

// 📍 bounding box Казахстана
const KZ_BOUNDS = {
  minLat: 40,
  maxLat: 56,
  minLon: 46,
  maxLon: 88
};

// 🔄 основной запрос (Казахстан)
async function fetchKazakhstan() {
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson
  &minlatitude=${KZ_BOUNDS.minLat}
  &maxlatitude=${KZ_BOUNDS.maxLat}
  &minlongitude=${KZ_BOUNDS.minLon}
  &maxlongitude=${KZ_BOUNDS.maxLon}
  &orderby=time
  &limit=200`;

  const res = await axios.get(url);
  return res.data.features;
}

// 🔄 fallback (если в КЗ нет событий)
async function fetchFallback() {
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=${KZ_BOUNDS.minLat}&maxlatitude=${KZ_BOUNDS.maxLat}&minlongitude=${KZ_BOUNDS.minLon}&maxlongitude=${KZ_BOUNDS.maxLon}&orderby=time&limit=200`;

  const res = await axios.get(url, { timeout: 5000 });
  return res.data.features;
}

// 🔧 форматирование
function formatData(features) {
  return features.map(f => {
    const [lon, lat, depth] = f.geometry.coordinates;

    return {
      date: new Date(f.properties.time).toLocaleString(),
      lat,
      lon,
      mag: f.properties.mag,
      depth,
      place: f.properties.place || "—"
    };
  });
}

// 🔄 обновление данных
async function updateData() {
  try {
    console.log("Updating data...");

    let features = await fetchKazakhstan();

    // ⚠️ если пусто — fallback
    if (!features || features.length < 3) {
  console.log("Too few KZ events → using fallback");
  const fallback = await fetchFallback();
  features = [...features, ...fallback].slice(0, 50);
}

    const formatted = formatData(features);

    // обновляем кэш только если есть данные
    if (formatted.length > 0) {
      cache = formatted;
      lastUpdate = new Date();
    }

    console.log("Updated:", lastUpdate, "Events:", cache.length);

  catch (e) {
  console.log("FULL ERROR:", e.response?.data || e.message);
}
}

// первый запуск
setTimeout(updateData, 2000);

// каждые 10 минут
setInterval(updateData, 600000);

// API
app.get("/earthquakes", (req, res) => {
  res.json({
    updated: lastUpdate,
    count: cache.length,
    data: cache
  });
});

// порт для Railway
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("API started on port", PORT);
});

const express = require("express");
const app = express();

// защита
process.on("uncaughtException", err => console.error(err));
process.on("unhandledRejection", err => console.error(err));

// тест
app.get("/", (req, res) => {
  res.send("API is running");
});

// API
app.get("/earthquakes", (req, res) => {
  res.json({ ok: true });
});
