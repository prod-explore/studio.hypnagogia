const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function updateBeats() {
  const YT_API_KEY = process.env.YT_API_KEY;
  const CHANNEL_ID = process.env.YT_CHANNEL_ID;
  const UPLOADS_PLAYLIST_ID = CHANNEL_ID.replace(/^UC/, 'UU');

  try {
    let allBeats = [];
    let pageToken = "";
    let pageCount = 0;

    do {
      const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${UPLOADS_PLAYLIST_ID}&maxResults=50&key=${YT_API_KEY}${pageParam}`;
      const res = await axios.get(url);
      const items = res.data.items || [];

      const newBeats = items.map(item => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        publishedAt: item.snippet.publishedAt
      })).filter(beat => beat.title !== 'Private video' && beat.title !== 'Deleted video');

      allBeats = allBeats.concat(newBeats);
      pageToken = res.data.nextPageToken;
      pageCount++;
    } while (pageToken && pageCount < 10); // Limit do 10 stron (max 500 beatów)

    const filePath = path.join(__dirname, "../data/beats.json");
    fs.writeFileSync(filePath, JSON.stringify(allBeats, null, 2));

    console.log("Lista beatów zaktualizowana:", allBeats.length);
  } catch (err) {
    console.error("Błąd aktualizacji beatów:", err.message);
  }
}

module.exports = updateBeats;
