const token = process.env.TOKEN;
const Bot = require('node-telegram-bot-api');
var request = require("request");
var bot;

const TAOBAO_URL = 'https://item.taobao.com/item.htm?';
const TMALL_URL = 'https://detail.tmall.com/item.htm?';
const M_INTL = 'm.intl.taobao.com';
const H5 = 'h5.m.taobao.com';
var expression = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const URL_REG = new RegExp(expression);

if (process.env.NODE_ENV === 'production') {
  bot = new Bot(token);
  bot.setWebHook(process.env.URL + bot.token);
} else {
  bot = new Bot(token, {
    polling: true
  });
}
console.log('Bot server started in the ' + process.env.NODE_ENV + ' mode');

bot.onText(URL_REG, (msg, match) => {
  var data = msg;
  var url = match[0];
  var message = data.text;
  var user = data.from;
  var chat_id = data.chat.id;
  var message_id = data.message_id;
  var link = '';
  if (contains(message, 'taobao.com')) {
    if (contains(url, M_INTL) || contains(url, H5)) {
      link = buildTaobaoURL(url);
    }
    bot.deleteMessage(chat_id,message_id);
    bot.sendMessage(chat_id, link);
  }
});

function buildTaobaoURL(url) {
  var itemID = url.match(/[&?]id=\d+/gi);
  var link = itemID[0].substr(1,itemID[0].length);
  return TAOBAO_URL + link;
}

function contains(url, query) {
  return url.indexOf(query) != -1;
}

module.exports = bot;
