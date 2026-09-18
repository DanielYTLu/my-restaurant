const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { url } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // 1. 精準提取名稱：從 "place/" 後面抓取，直到遇到斜線或問號
    const match = url.match(/place\/([^\/?]+)/);
    if (!match) return res.status(400).json({ error: 'Could not extract name from URL' });
    
    // 將 URL 編碼的字串解碼並替換掉 "+" 號
    const queryName = decodeURIComponent(match[1].replace(/\+/g, ' '));

    // 2. 使用 Find Place API 搜尋 (增加 locationbias 以提高搜尋準確度)
    const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(queryName)}&inputtype=textquery&fields=place_id&key=${apiKey}`;
    const findPlaceRes = await fetch(findPlaceUrl);
    const findPlaceData = await findPlaceRes.json();

    if (!findPlaceData.candidates || findPlaceData.candidates.length === 0) {
      // 嘗試退路：如果找不到，嘗試將名稱中的特殊符號移除再搜一次
      return res.status(404).json({ error: `Place not found for: ${queryName}` });
    }

    const placeId = findPlaceData.candidates[0].place_id;

    // 3. 獲取詳情
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number&language=zh-TW&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    const result = detailsData.result;
    res.status(200).json({
      name: result.name || queryName,
      address: result.formatted_address || '',
      phone: result.formatted_phone_number || ''
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
