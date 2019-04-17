const token = process.env.TOKEN;
const Bot = require('node-telegram-bot-api');
const request = require("request");
const cheerio = require("cheerio");
var bot;

const TAOBAO_URL = 'https://item.taobao.com/item.htm?';
const TMALL_URL = 'https://detail.tmall.com/item.htm?';
const M_INTL = 'm.intl.taobao.com';
const BM_LIN = '139shoes.x.yupoo.com'
const H5 = 'h5.m.taobao.com';
var expression = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const URL_REG = new RegExp(expression);


const BM_LIN_HEAD = /[A-Z]{2}\d[A-Z]{2}/g;
if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.URL);
} else {
  bot = new Bot(token, {
    polling: true
  });
}
console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

bot.onText(URL_REG, (msg, match) => {
  var data = msg;
  var opts = {
    parse_mode: 'Markdown'
  };
  var url = match[0];
  var message = data.text;
  var user = data.from;
  var chat_id = data.chat.id;
  var message_id = data.message_id;
  var link = '';
  if (contains(message, 'taobao.com')) {
    if (contains(url, M_INTL) || contains(url, H5)) {
      link = buildTaobaoURL(url);
      bot.deleteMessage(chat_id, message_id);
      bot.sendMessage(chat_id, link);
    }
  }
  if (contains(message, BM_LIN)) {
    request(url, (err, response, body) => {
      if (!err) {
        var $ = cheerio.load(body);
        var head = $('span.showalbumheader__gallerytitle').text();
        if (BM_LIN_HEAD.test(head)) {
          var code = head.match(BM_LIN_HEAD);
          var price = buildPrice(code[0]);
          opts.reply_to_message_id = message_id;
          var text_message = `Прайслар ${price} юаньлар`;
          bot.sendMessage(chat_id, text_message, opts);
        }
      } else {
        console.log(err);
      }
    })
  }
});

function buildTaobaoURL(url) {
  var itemID = url.match(/[&?]id=\d+/gi);
  var link = itemID[0].substr(1, itemID[0].length);
  return TAOBAO_URL + link;
}

function contains(url, query) {
  return url.indexOf(query) != -1;
}

function buildPrice(code) {
  var arr = code.split('');
  var vocabulary = {
    'A': 1,
    'B': 2,
    'C': 3,
    'D': 4,
    'E': 5,
    'F': 6
  };
  var price = vocabulary[arr[0]] * 100 + ((parseInt(arr[2]) + 5) % 10) * 10;
  return price;

}

module.exports = bot;