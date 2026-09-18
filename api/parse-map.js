const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);

    let name = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    name = name.replace(' - Google 地圖', '').replace(' - Google Maps', '').trim();

    if (!name || name === 'Google Maps' || name === 'Google 地圖') {
      const match = url.match(/place\/([^/@?]+)/);
      if (match && match[1]) {
        name = decodeURIComponent(match[1].replace(/\+/g, ' '));
      }
    }

    const desc = $('meta[name="description"]').attr('content') || '';

    res.status(200).json({
      name: name || '未知餐廳',
      address: desc,
      phone: ''
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed: ' + error.message });
  }
};

