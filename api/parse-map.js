const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // 轉換策略：如果網址含有 place/，則嘗試從中提取名稱並轉換為 search/ 格式
    if (url.includes('/place/')) {
      const match = url.match(/place\/([^/?]+)/);
      if (match) {
        url = `https://www.google.com/maps/search/${match[1]}`;
      }
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);

    // 抓取名稱
    let name = $('meta[property="og:title"]').attr('content') || $('h1').text() || '未知餐廳';
    name = name.replace(' - Google 地圖', '').replace(' - Google Maps', '').trim();

    // 在 /search/ 模式下，地址與電話通常隱藏在 meta 描述或特定 script 中
    // 我們先嘗試從 meta description 抓取
    const desc = $('meta[name="description"]').attr('content') || '';
    
    // 地址通常包含這些關鍵字
    const address = desc.split('·')[0] || ''; 
    
    res.status(200).json({
      name: name,
      address: address, // 在 search 頁面，地址解析比較隨緣，這已經是最大努力了
      phone: '' // 此模式較難精準抓取電話
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed: ' + error.message });
  }
};
