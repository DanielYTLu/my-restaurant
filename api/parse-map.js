const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // 永遠優先從網址本身提取名稱，最為穩定且百分之百免費
  let name = '';
  const match = url.match(/place\/([^/@?]+)/);
  if (match && match[1]) {
    name = decodeURIComponent(match[1].replace(/\+/g, ' '));
  }

  // 如果網址裡沒有 place/，試著從 search/ 抓
  if (!name) {
    const searchMatch = url.match(/search\/([^/@?]+)/);
    if (searchMatch && searchMatch[1]) {
      name = decodeURIComponent(searchMatch[1].replace(/\+/g, ' '));
    }
  }

  res.status(200).json({
    name: name || '未知餐廳',
    address: '',
    phone: ''
  });
};

