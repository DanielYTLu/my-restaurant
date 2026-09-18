const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { url } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // 1. 從 URL 提取餐廳名稱 (Google Maps URL 格式分析)
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/place\/([^\/@]+)/);
    if (!match) return res.status(400).json({ error: 'Could not extract name from URL' });
    
    const queryName = match[1].replace(/\+/g, ' ');

    // 2. 使用 Places API (Find Place) 搜尋 place_id
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(queryName)}&inputtype=textquery&fields=place_id&key=${apiKey}`;
    const findPlaceRes = await fetch(findPlaceUrl);
    const findPlaceData = await findPlaceRes.json();

    if (!findPlaceData.candidates || findPlaceData.candidates.length === 0) {
      return res.status(404).json({ error: 'Place not found' });
    }

    const placeId = findPlaceData.candidates[0].place_id;

    // 3. 使用 Place Details API 獲取詳情
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number&language=zh-TW&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (!detailsData.result) {
      return res.status(404).json({ error: 'Details not found' });
    }

    const result = detailsData.result;
    res.status(200).json({
      name: result.name || '',
      address: result.formatted_address || '',
      phone: result.formatted_phone_number || ''
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};
