const cheerio = require('cheerio');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // 嘗試解析結構化資料 (Schema.org)
    const script = $('script[type="application/ld+json"]').html();
    let data = {};
    
    if (script) {
      try {
        const json = JSON.parse(script);
        // Google Maps 的結構可能是一個物件或陣列
        const target = Array.isArray(json) ? json[0] : json;
        data = {
          name: target.name || $('h1').text(),
          address: target.address || '',
          phone: target.telephone || '',
        };
      } catch (e) {
        console.error('JSON parse error', e);
      }
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};
