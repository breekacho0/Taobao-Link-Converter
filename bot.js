const token = process.env.TOKEN;
const Bot = require('node-telegram-bot-api');
const request = require("request");
const cheerio = require("cheerio");
const esprima = require("esprima");
const translate = require('yandex-translate')(process.env.YANDEX_API_KEY);
const GBK = require("./gbk");
var bot;

const TAOBAO_ITEM_URL = 'https://item.taobao.com/item.htm?';
const M_INTL = 'm.intl.taobao.com';
const TMALL_URL = 'https://detail.tmall.com/item.htm?';
const TAOBAO_APP = 'https://m.tb.cn';
const SHOP_M = /shop\d+.m/gi;
const BM_LIN = '139shoes.x.yupoo.com'
const H5 = 'h5.m.taobao.com';
var expression = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const BM_LIN_HEAD = /[A-Z]{2}\d[A-Z]{2}/g;
const URL_REG = new RegExp(expression);
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
  //console.log(msg);
  var url = match[0];
  var message = data.text;
  var user = data.from;
  var chat_id = data.chat.id;
  var message_id = data.message_id;
  var link = '';
  var opts = {
    parse_mode: 'Markdown'
  };
  var telegram_info = {
    chat_id: chat_id,
    message_id: message_id
  }
  if (contains(url, TAOBAO_APP)) {
    console.log(url);
    getAppLink(url).then(newUrl => {
      console.log(newUrl);
      getItem(newUrl)
        .catch(err => {
          console.log(err);
          let text = 'Arrr, блядь, ошибка. Иди нахуй';
          if (contains(newUrl, M_INTL) || contains(newUrl, H5)) {
            text += `\nНо вот твоя [ссылка](${newUrl})`;
            bot.deleteMessage(chat_id, message_id);
          }
          bot.sendMessage(chat_id, text, opts);
        })
        .then(item => {
          if (typeof item !== 'undefined') {
            item.link = newUrl
            buildMessage(item, telegram_info, newUrl);
          }
        });

    });
  }

  if (contains(message, 'taobao.com')) {
    if (contains(url, M_INTL) || contains(url, TAOBAO_ITEM_URL) || contains(url, H5)) {
      link = buildTaobaoURL(url);
      getItem(link)
        .catch(err => {
          console.log(err);
          let text = 'Arrr, блядь, ошибка. Иди нахуй';
          if (contains(url, M_INTL) || contains(url, H5)) {
            text += `\nНо вот твоя [ссылка](${link})`;
            bot.deleteMessage(chat_id, message_id);
          }
          bot.sendMessage(chat_id, text, opts);
        })
        .then(item => {
          if (typeof item !== 'undefined') {
            item.link = link
            buildMessage(item, telegram_info, url);
          }
        });
    }
  }
  if (contains(message, BM_LIN)) {
    request(url, (err, response, body) => {
      if (!err) {
        var $ = cheerio.load(body);
        console.log(body);
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
    });
  }
});
bot.onText(BM_LIN_HEAD, (msg, match) => {
  var data = msg;
  var price = buildPrice(match[0]);
  var chat_id = data.chat.id;
  var message_id = data.message_id;
  var opts = {
    parse_mode: 'Markdown'
  };
  opts.reply_to_message_id = message_id;
  var text_message = `Прайслар ${price} юаньлар`;
  bot.sendMessage(chat_id, text_message, opts);
});

function buildTaobaoURL(url, shop = false, app = false) {
  if (!shop && !app) {
    var itemID = url.match(/[&?]id=\d+/gi);
    var link = itemID[0].substr(1, itemID[0].length);
    return TAOBAO_ITEM_URL + link;
  }
  if (app) {
    if (contains(url, TAOBAO_ITEM_URL)) {
      var itemID = url.match(/[&?]id=\d+/gi);
      var link = itemID[0].substr(1, itemID[0].length);
      return TAOBAO_ITEM_URL + link;
    }
    if (contains(url, 'a.m.taobao')) {
      var itemID = url.match(/i\d+.htm/gi);
      var link = itemID[0].substr(1, itemID[0].length - 5);
      return `${TAOBAO_ITEM_URL}id=${link}`;
    }
  }
  return new Error('url is null');
}

function contains(url, query, regexp = false) {
  if (!regexp) {
    return url.indexOf(query) != -1;
  } else {
    return query.test(url);
  }
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

function buildMessage(item, telegram, url) {
  console.log(item);
  console.log(`------------`);
  var text = ``;
  opts = {
    parse_mode: 'Markdown'
  };
  if (!(contains(url, M_INTL) || contains(url, H5))) {
    opts.reply_to_message_id = telegram.message_id;
  }
  //text += item.images.length > 0 ? `https:${item.images[0]}\n` : ``;
  text += item.title ? `${item.title.replace('@','')}\n\n` : ``;
  if (item.props.length > 0) {
    item.props.forEach(el => {
      let values = '';
      if (el.values.length > 1) {
        values = el.values.join(', ');
      } else {
        values = el.values[0];
      }
      text += `${el.type}: ${values}\n`;
    })
  }
  text += `\nPrice: ${item.price} (not logged in)\n`;
  text += `[Link](${item.link})\n\n`;
  text += item.shop.name ? `Shop: [${item.shop.name}](${item.shop.url})\n` : ``;
  //text += item.shop.url ? `https:${item.shop.url}\n` : ``;
  translate.translate(text, {
    from: 'zh',
    to: 'en'
  }, (err, res) => {
    opts.caption = res.text[0];
    console.log(opts.caption);
    opts.disable_web_page_preview = true;
    bot.sendPhoto(telegram.chat_id, `${item.images.length > 0 ? `https:${item.images[0]}\n` : ``}`, opts)
      .then(resolve => {
        if (contains(url, M_INTL) || contains(url, H5)) {
          bot.deleteMessage(telegram.chat_id, telegram.message_id);
        }
      })
      .catch(err => {
        console.log(err.response.req.res.body);
        text = `Dude, not today\n${err.response.req.res.body.error_code}: ${err.response.req.res.body.desciption}`;
        if (contains(url, M_INTL) || contains(url, H5)) {
          bot.deleteMessage(telegram.chat_id, telegram.message_id);
          text += `\n[URL](${item.link})`;
        }
        bot.sendMessage(telegram.chat_id, text, {
          parse_mode: 'Markdown'
        });
      });
  });
}

function getAppLink(url) {
  return new Promise((resolve, reject) => {
    request(url, (err, response, body) => {
      if (!err) {
        var $ = cheerio.load(body);
        var $scripts = $('script');
        var $script = {};
        var scriptHtml = '';
        $script = $scripts.eq(1);
        scriptHtml = $script.html();
        var url = scriptHtml.match(expression)[0];
        url = buildTaobaoURL(url, 0, 1);
        resolve(url);
      }
    });
  });
};

function getItem(url) {
  return new Promise((resolve, reject) => {
    //request(url, (err, response, body) => {
    GBK.fetch(url).to('string', (err, body) => {
      if (!err) {
        var $ = cheerio.load(body);
        if ($('#error-notice').length == 0) {
          var $scripts = $('script');
          var $script = {};
          var scriptHtml = '';
          var info = {};
          info.props = [];
          var price = $('.tb-rmb-num').html();
          info.price = price;
          var $tags = $('#J_isku');
          var $j_props = $tags.find('.J_Prop');
          //console.log($j_props);
          $j_props.each((i, $el) => {
            var type = $($el).find('.J_TSaleProp').attr('data-property');
            //console.log($($el).find('.J_TSaleProp'));
            //console.log(`type: ${type}`);
            var $values = $($el).find('.J_TSaleProp li');
            var values = [];
            $values.each((index, $el) => {
              value = $($el).find('span').text();
              // console.log(value);
              values.push(value);
            });
            info.props.push({
              type: type,
              values: values
            });
          });
          if ($scripts.length > 1) {
            $scripts.filter((eq, $script) => {
              let html = $scripts.eq(eq).html();
              if (contains(html, 'var g_config'))
                return $script;
            });
            $script = $scripts.eq(0);
            scriptHtml = $script.html();
          } else {
            if ($scripts.length > 0) {
              $script = $scripts.eq(0);
              scriptHtml = $script.html();
            } else {
              reject(new Error('Has no data'));
            }
          }

          if (contains(scriptHtml, 'var g_config')) {
            const json = parseScript(scriptHtml);
            var item = json.idata.item;
            var seller = {};
            seller.name = json.shopName;
            seller.url = json.idata.shop.url;
            if (!contains(seller.url, 'http')) {
              seller.url = `https:${seller.url}`;
            }
            const {
              auctionImages: images,
              title: title
            } = item;
            info = {
              ...info,
              title: title,
              images: images,
              shop: seller
            };
            resolve(info);
          }
        } else {
          reject(new Error('Sth wrong with the page'));
        }
      } else {
        reject(new Error(err));
      }
    });
  });
}

function parseScript(script) {
  const tokenize = esprima.parseScript(script);
  const properties = tokenize.body[0].declarations[0].init.properties;
  const result = {};
  properties.forEach(x => {
    const obj = parseObject(x);
    var keys = Object.keys(obj);
    if (keys.length > 0) {
      var key = keys[0];
      result[key] = obj[key];
    }
    return obj;
  });
  return result;
}

function parseObject(obj) {
  var xd = {};
  if (contains(obj.value.type, 'Literal')) {
    xd[obj.key.name] = obj.value.value;
  } else if (contains(obj.value.type, 'ObjectExpression')) {
    const properties = obj.value.properties;
    var result = {};
    properties.forEach(x => {
      const obj = parseObject(x);
      var keys = Object.keys(obj);
      if (keys.length > 0) {
        var key = keys[0];
        result[key] = obj[key];
      }
      return obj;
    });
    xd[obj.key.name] = result;
  } else if (contains(obj.value.type, 'ArrayExpression')) {
    var elements = []
    obj.value.elements.forEach(x => {
      elements.push(x.value);
    });
    xd[obj.key.name] = elements;
  }
  return xd;
}


module.exports = bot;