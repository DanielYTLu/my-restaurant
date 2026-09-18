const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // 關鍵：將 User-Agent 設定為 Googlebot，讓 Google Maps 吐出 HTML 內容
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);

    // 抓取名稱：通常在 og:title 或 h1
    const name = $('meta[property="og:title"]').attr('content') || $('h1').text() || '未知餐廳';
    
    // 抓取地址與電話：Google Maps 在爬蟲模式下，常將資料放在 meta description 或相關節點
    const description = $('meta[name="description"]').attr('content') || '';
    
    // 簡單提取地址：從 description 中尋找可能的地址片段
    // 通常地址會跟在名稱後方，或者是在一段描述中
    let address = '';
    const addressMatch = description.match(/[^。，]+(路|街|大道|號)[^。，]*/);
    if (addressMatch) address = addressMatch[0].trim();

    // 電話在 description 中通常較難提取，我們會留下提示
    let phone = '';
    const phoneMatch = description.match(/(\d{2,4}-\d{3,4}-\d{4})/);
    if (phoneMatch) phone = phoneMatch[0];

    res.status(200).json({
      name: name.replace(' - Google 地圖', ''),
      address: address,
      phone: phone
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to scrape data: ' + error.message });
  }
};

