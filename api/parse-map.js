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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    let data = {
      name: '',
      address: '',
      phone: ''
    };

    // 1. 嘗試從 meta 標籤抓取名稱 (常見於 Google Maps)
    data.name = $('meta[property="og:title"]').attr('content') || $('h1').text();
    
    // 2. 嘗試搜尋特定類別的資料
    // 透過尋找包含地址與電話圖示的元件來提取
    $('[data-item-id]').each((i, el) => {
      const text = $(el).text();
      // 簡單的關鍵字提取
      if (text.includes('號') || text.includes('路') || text.includes('街') || text.includes('段')) {
        if (!data.address) data.address = text;
      }
      // 簡單的電話格式判斷 (包含數字或連接線)
      if (text.match(/(\d{2,4}-?\d{3,4}-?\d{4})/)) {
        if (!data.phone) data.phone = text.match(/(\d{2,4}-?\d{3,4}-?\d{4})/)[0];
      }
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};
