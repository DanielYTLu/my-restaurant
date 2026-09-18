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
      name: $('h1').first().text() || $('meta[property="og:title"]').attr('content') || '',
      address: '',
      phone: ''
    };

    // Google Maps 的資訊通常放在擁有特定 aria-label 的區塊中
    $('[aria-label]').each((i, el) => {
      const label = $(el).attr('aria-label');
      const text = $(el).text();
      
      // 判斷是否為地址 (包含常見關鍵字)
      if (label && (label.includes('地址') || label.includes('Address'))) {
        data.address = text.replace('地址：', '').replace('Address:', '').trim();
      }
      // 判斷是否為電話
      if (label && (label.includes('電話') || label.includes('Phone') || label.includes('號碼'))) {
        data.phone = text.replace('電話：', '').replace('Phone:', '').replace('號碼：', '').trim();
      }
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};
