const token = process.env.TOKEN;
const Bot = require('node-telegram-bot-api');
const request = require("request");
const cheerio = require("cheerio");
const esprima = require("esprima");
const translate = require('yandex-translate')(process.env.YANDEX_API_KEY);
const GBK = require("./gbk");
let bot;

const TAOBAO_ITEM_URL = 'https://item.taobao.com/item.htm?';
const M_INTL = 'm.intl.taobao.com';
const TMALL_URL = 'https://detail.tmall.com/item.htm?';
const TAOBAO_APP = 'https://m.tb.cn';
const SHOP_M = /shop\d+.m/gi;
const BM_LIN = '139shoes.x.yupoo.com'
const H5 = 'h5.m.taobao.com';
const expression = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const MD_entitities = /(\*)+|(\<)+|(\>)+|(\`)+|(\_)+/gi
const BM_LIN_HEAD = /[A-Z]{2}\d[A-Z]{2}/g;
const URL_REG = new RegExp(expression);
const languages = {
    from: 'zh',
    to: 'en'
};
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
    let data = msg;
    let url = match[0];
    let message = data.text;
    let user = data.from;
    let chat_id = data.chat.id;
    let message_id = data.message_id;
    let link = '';
    let opts = {
        parse_mode: 'Markdown'
    };
    let telegram_info = {
        chat_id: chat_id,
        message_id: message_id
    }
    if (contains(url, TAOBAO_APP)) {
        getAppLink(url).then(newUrl => {
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
                    console.log(item);
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
                let $ = cheerio.load(body);
                console.log(body);
                let head = $('span.showalbumheader__gallerytitle').text();
                if (BM_LIN_HEAD.test(head)) {
                    let code = head.match(BM_LIN_HEAD);
                    let price = buildPrice(code[0]);
                    if (price) {
                        opts.reply_to_message_id = message_id;
                        let text_message = `Price ${price} \u00a5`;
                        bot.sendMessage(chat_id, text_message, opts).then(r => {});
                    }
                }
            } else {
                console.log(err);
            }
        });
    }
});

bot.onText(BM_LIN_HEAD, (msg, match) => {
    let data = msg;
    let price = buildPrice(match[0]);
    if (price) {
        let chat_id = data.chat.id;
        let message_id = data.message_id;
        let opts = {
            parse_mode: 'Markdown'
        };
        opts.reply_to_message_id = message_id;
        let text_message = `Price ${price} \u00a5`;
        bot.sendMessage(chat_id, text_message, opts).then(r => {});
    }
});

function buildTaobaoURL(url, shop = false, app = false) {
    if (!shop && !app) {
        let itemID = url.match(/[&?]id=\d+/gi);
        let link = itemID[0].substr(1, itemID[0].length);
        return TAOBAO_ITEM_URL + link;
    }
    if (app) {
        if (contains(url, TAOBAO_ITEM_URL)) {
            let itemID = url.match(/[&?]id=\d+/gi);
            let link = itemID[0].substr(1, itemID[0].length);
            return TAOBAO_ITEM_URL + link;
        }
        if (contains(url, 'a.m.taobao')) {
            let itemID = url.match(/i\d+.htm/gi);
            let link = itemID[0].substr(1, itemID[0].length - 5);
            return `${TAOBAO_ITEM_URL}id=${link}`;
        }
    }
    return new Error('url is null');
}

function contains(url, query, regexp = false) {
    if (!regexp) {
        return url.indexOf(query) !== -1;
    } else {
        return query.test(url);
    }
}

function buildPrice(code) {
    let arr = code.split('');
    const vocabulary = {
        'A': 1,
        'B': 2,
        'C': 3,
        'D': 4,
        'E': 5,
        'F': 6
    };
    const keys = Object.keys(vocabulary);
    if (keys.indexOf(arr[0]) !== -1) {
        return price = vocabulary[arr[0]] * 100 + ((parseInt(arr[2]) + 5) % 10) * 10;
    } else {
        return null
    }
}

function buildMessage(item, telegram, url) {
    console.log(item);
    console.log(`------------`);
    let text = ``;
    opts = {
        parse_mode: 'Markdown'
    };
    if (!(contains(url, M_INTL) || contains(url, H5))) {
        opts.reply_to_message_id = telegram.message_id;
    }
    //text += item.images.length > 0 ? `https:${item.images[0]}\n` : ``;
    text += item.title ? `${item.title.replace('@', '')}\n\n` : ``;
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
    translate.translate(text, languages, (err, resolve) => {
        console.log(resolve);
        if (item.images.length > 1) {
            let media = [];
            item.images.forEach(image => {
                media.push({
                    type: 'photo',
                    media: `https:${image}`
                });
            });
            bot.sendMediaGroup(telegram.chat_id, media, opts)
                .then(res => {
                    opts.reply_to_message_id = res[0].message_id;
                    let textTranslated = '';
                    if (resolve.code === 200) {
                        textTranslated = resolve.text[0].replace(MD_entitities, '');
                    } else if (resolve.code === 408) {
                        textTranslated = text + 'Сорри за китайский. Закончилась квота перевода текста';
                    } else {
                        textTranslated = text;
                    }
                    delete opts.media;
                    opts.caption = textTranslated;
                    bot.sendPhoto(telegram.chat_id, `${item.images.length > 0 ? `https:${item.images[0]}\n` : ``}`, opts)
                        .then(resolve => {
                            if (contains(url, M_INTL) || contains(url, H5)) {
                                bot.deleteMessage(telegram.chat_id, telegram.message_id)
                                    .then(r => {});
                            }
                        })
                })
                .catch(err => {
                    let textTranslated = '';
                    if (resolve.code === 200) {
                        textTranslated = resolve.text[0].replace(MD_entitities, '');
                    } else if (resolve.code === 408) {
                        textTranslated = text + 'Сорри за китайский. Закончилась квота перевода текста';
                    } else {
                        textTranslated = text;
                    }
                    opts.caption = textTranslated;
                    opts.disable_web_page_preview = true;
                    bot.sendPhoto(telegram.chat_id, `${item.images.length > 0 ? `https:${item.images[0]}\n` : ``}`, opts)
                        .then(resolve => {
                            if (contains(url, M_INTL) || contains(url, H5)) {
                                bot.deleteMessage(telegram.chat_id, telegram.message_id)
                                    .then(r => {});
                            }
                        })
                        .catch(err => {
                            console.log(err.response.req.res.body);
                            text = `Dude, not today\n${err.response.req.res.body.error_code}: ${err.response.req.res.body.desciption}`;
                            if (contains(url, M_INTL) || contains(url, H5)) {
                                bot.deleteMessage(telegram.chat_id, telegram.message_id)
                                    .then(r => {});
                                text += `\n[URL](${item.link})`;
                            }

                            bot.sendMessage(telegram.chat_id, text, {
                                parse_mode: 'Markdown'
                            }).then(r => {});
                        });
                });
        } else if (item.images.length > 0) {
            let textTranslated = '';
            if (resolve.code === 200) {
                textTranslated = resolve.text[0].replace(MD_entitities, '');
            } else if (resolve.code === 408) {
                textTranslated = text + 'Сорри за китайский. Закончилась квота перевода текста';
            } else {
                textTranslated = text;
            }
            opts.caption = textTranslated;
            opts.disable_web_page_preview = true;
            bot.sendPhoto(telegram.chat_id, `${item.images.length > 0 ? `https:${item.images[0]}\n` : ``}`, opts)
                .then(resolve => {
                    if (contains(url, M_INTL) || contains(url, H5)) {
                        bot.deleteMessage(telegram.chat_id, telegram.message_id)
                            .then(r => {});
                    }
                })
                .catch(err => {
                    text = `Dude, not today\n${err.response.req.res.body.error_code}: ${err.response.req.res.body.desciption}`;
                    if (contains(url, M_INTL) || contains(url, H5)) {
                        bot.deleteMessage(telegram.chat_id, telegram.message_id)
                            .then(r => {});
                        text += `\n[URL](${item.link})`;
                    }
                    bot.sendMessage(telegram.chat_id, text, {
                        parse_mode: 'Markdown'
                    });
                });
        }
    });


}

function getAppLink(url) {
    return new Promise((resolve, reject) => {
        request(url, (err, response, body) => {
            if (!err) {
                let $ = cheerio.load(body);
                let $scripts = $('script');
                let $script = {};
                let scriptHtml = '';
                $script = $scripts.eq(1);
                scriptHtml = $script.html();
                let url = scriptHtml.match(expression)[0];
                url = buildTaobaoURL(url, 0, 1);
                resolve(url);
            }
        });
    });
};

function getItem(url) {
    return new Promise((resolve, reject) => {
        GBK.fetch(url).to('string', (err, body) => {
            if (!err) {
                let $ = cheerio.load(body);
                if ($('#error-notice').length === 0) {
                    let $scripts = $('script');
                    let $script = {};
                    let scriptHtml = '';
                    let info = {};
                    info.props = [];
                    info.price = $('.tb-rmb-num').html();
                    let $tags = $('#J_isku');
                    let $j_props = $tags.find('.J_Prop');
                    //console.log($j_props);
                    $j_props.each((i, $el) => {
                        let type = $($el).find('.J_TSaleProp').attr('data-property');
                        let $values = $($el).find('.J_TSaleProp li');
                        let values = [];
                        $values.each((index, $el) => {
                            value = $($el).find('span').text();
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
                            if (contains(html, 'let g_config'))
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

                    if (contains(scriptHtml, 'let g_config') || contains(scriptHtml, 'var g_config')) {
                        const json = parseScript(scriptHtml);
                        console.log(json);
                        let item = json.idata.item;
                        let seller = {};
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
                        console.log(info);
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
        let keys = Object.keys(obj);
        if (keys.length > 0) {
            let key = keys[0];
            result[key] = obj[key];
        }
        return obj;
    });
    return result;
}

function parseObject(obj) {
    let xd = {};
    if (contains(obj.value.type, 'Literal')) {
        xd[obj.key.name] = obj.value.value;
    } else if (contains(obj.value.type, 'ObjectExpression')) {
        const properties = obj.value.properties;
        let result = {};
        properties.forEach(x => {
            const obj = parseObject(x);
            let keys = Object.keys(obj);
            if (keys.length > 0) {
                let key = keys[0];
                result[key] = obj[key];
            }
            return obj;
        });
        xd[obj.key.name] = result;
    } else if (contains(obj.value.type, 'ArrayExpression')) {
        let elements = []
        obj.value.elements.forEach(x => {
            elements.push(x.value);
        });
        xd[obj.key.name] = elements;
    }
    return xd;
}


module.exports = bot;