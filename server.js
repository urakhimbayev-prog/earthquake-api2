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
  const url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=50";

  const res = await axios.get(url);
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
    if (!features || features.length === 0) {
      console.log("No KZ data → using fallback");
      features = await fetchFallback();
    }

    const formatted = formatData(features);

    // обновляем кэш только если есть данные
    if (formatted.length > 0) {
      cache = formatted;
      lastUpdate = new Date();
    }

    console.log("Updated:", lastUpdate, "Events:", cache.length);

  } catch (e) {
    console.log("Update error:", e.message);
  }
}

// первый запуск
updateData();

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

app.listen(PORT, () => {
  console.log("API started on port", PORT);
});
