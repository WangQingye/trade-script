/* OK交易模块 */
var MD5 = require('./MD5.JS');
var request = require('request');
const path = require('path');
var r = request.defaults({
    proxy: 'http://127.0.0.1:1080'
})
var fs = require('fs');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json')));
console.log(config);
var a = config.account;

/* 查看账户合约单子情况 */
function getAccountOrder(cbfunc, symbol = "btc_usd", contractType = 'quarter', type = 1) {
    let sign = `api_key=${a.apiKey}&contract_type=${contractType}&symbol=${symbol}&type=${type}&secret_key=${a.secretKey}`;
    r.post({
        url: 'https://www.okex.com/api/v1/future_position_4fix.do',
        formData: {
            "api_key": a.apiKey,
            "sign": sign.MD5(32).toUpperCase(),
            "symbol": symbol,
            "contract_type": contractType,
            "type": type
        }
    }, function (err, res, body) {
        let data = null;
        try {
            data = JSON.parse(body);
        } catch (error) {
            fs.appendFileSync('./sign.txt', data + "\r\n");
        }
        if (data) cbfunc(data);
    })
}
/* 查看账户余额 */
function getAccountNum(cbfunc) {
    let sign = `api_key=${a.apiKey}&secret_key=${a.secretKey}`;
    r.post({
        url: 'https://www.okex.com/api/v1/future_userinfo_4fix.do',
        formData: {
            "api_key": a.apiKey,
            "sign": sign.MD5(32).toUpperCase(),
        }
    }, function (err, res, body) {
        let data = null;
        try {
            data = JSON.parse(body);
        } catch (error) {
            fs.appendFileSync('./sign.txt', data + "\r\n");
        }
        if (data) cbfunc(data);
    })
}
/* 下单 */
// symbol	String	是	btc_usd ltc_usd eth_usd etc_usd bch_usd
// contract_type	String	是	合约类型: this_week:当周 next_week:下周 quarter:季度
// api_key	String	是	用户申请的apiKey
// sign	String	是	请求参数的签名
// price	String	是	价格
// amount	String	是	委托数量（张）
// type	String	是	1:开多 2:开空 3:平多 4:平空
// match_price	String	否	是否为对手价 0:不是 1:是 ,当取值为1时,price无效
// lever_rate	String	否	杠杆倍数，下单时无需传送，系统取用户在页面上设置的杠杆倍数。且“开仓”若有10倍多单，就不能再下20倍多单
function order(price, amount, type, cbfunc, contractType = 'quarter', symbol = 'btc_usd') {
    let time = new Date();
    /* 滑点价格添加 */
    if (type == 1 || type == 4) {
        price += config.priceAdd;
    } else {
        price -= config.priceAdd;
    }
    let sign = `amount=${amount}&api_key=${a.apiKey}&contract_type=${contractType}&lever_rate=${config.leverRate}&match_price=0&price=${price}&symbol=${symbol}&type=${type}&secret_key=${a.secretKey}`;
    let parma = {
        "symbol": symbol,
        "contract_type": contractType,
        "api_key": a.apiKey,
        "price": price,
        "amount": amount,
        "type": type,
        "match_price": "0",
        "lever_rate": config.leverRate,
        "sign": sign.MD5(32).toUpperCase()
    }
    r.post({
        url: 'https://www.okex.com/api/v1/future_trade.do',
        formData: parma
    }, function (err, res, body) {
        fs.appendFileSync('./sign.txt', time + 'err:' + err + "\r\n");
        fs.appendFileSync('./sign.txt', 'res:' + res + "\r\n");
        fs.appendFileSync('./sign.txt', 'body:' + body + "\r\n");
        let data = JSON.parse(body);
        if (data && data.result) {
            sendMsg();
            cbfunc(data);
        } else {
            order(price, amount, type, cbfunc);
        }
    })
}
/* 开单 */
function openBook(price, all, position, type, cbfunc) {
    let amount = calAmount(price, all, position);
    order(price, amount, type, cbfunc);
}
/* 平单（止损） */
function closeBook(price, amount, type, cbfunc) {
    order(price, amount, type, cbfunc);
}

/* 计算张数 */
// 张数 = 账户余额 * 委托价格 * 仓位 * 杠杆倍数 / 100
function calAmount(price, all, position, lever = config.leverRate) {
    return Math.floor(price * all * position * lever / 100);
}

function sendMsg() {
    var text = encodeURI(`【乾坤科技】开单了 从 ${0} 转了 ${0} UDT 到 ${0}`);
    r.get('http://api.smsbao.com/sms?u=z926665&p=9e141bad8128e8972b768fe4a6dbe8a3&m=13648002084&c=' + text,
        function (err, res, body) {
            if (err) {
                sendMsg();
            }
        });
    // r.get('http://api.smsbao.com/sms?u=z926665&p=9e141bad8128e8972b768fe4a6dbe8a3&m=18615747976&c=' + text,
    //     function (err, res, body) {
    //         if (err) {
    //             sendMsg();
    //         }
    //     });
}
exports.getAccountOrder = getAccountOrder;
exports.getAccountNum = getAccountNum;
exports.openBook = openBook;
exports.closeBook = closeBook;