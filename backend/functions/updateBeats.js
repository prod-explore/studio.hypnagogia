const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function updateBeats() {
  const YT_API_KEY = process.env.YT_API_KEY;
  const CHANNEL_ID = process.env.YT_CHANNEL_ID;

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&order=date&type=video&key=${YT_API_KEY}`;
    const res = await axios.get(url);
    const items = res.data.items || [];

    const beats = items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.high?.url,
      publishedAt: item.snippet.publishedAt
    }));

    const filePath = path.join(__dirname, "../data/beats.json");
    fs.writeFileSync(filePath, JSON.stringify(beats, null, 2));

    console.log("Lista beatów zaktualizowana:", beats.length);
  } catch (err) {
    console.error("Błąd aktualizacji beatów:", err.message);
  }
}

module.exports = updateBeats;
