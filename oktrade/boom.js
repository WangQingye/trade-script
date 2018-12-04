var MD5 = require('./MD5.JS');
var request = require('request');
const path = require('path');
var r = request.defaults({
    proxy: 'http://127.0.0.1:1080'
})
var fs = require('fs');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json')));
var a = config.account;

let coins = ['btc_usd', 'ltc_usd', 'eth_usd', 'etc_usd', 'bch_usd', 'eos_usd'];

function getboom(index) {
    let symbol = coins[index];
    if (!symbol) return
    let sign = `api_key=${a.apiKey}&contract_type=quarter&status=0&symbol=${symbol}&secret_key=${a.secretKey}`;
    r.post({
        url: 'https://www.okex.com/api/v1/future_explosive.do',
        formData: {
            "api_key": a.apiKey,
            "contract_type": "quarter",
            "status": 0,
            "symbol": symbol,
            "sign": sign.MD5(32).toUpperCase(),
        }
    }, function (err, res, body) {
        data = JSON.parse(body);
        console.log(data);
        let all = 0;
        data.data.forEach( item => {
            all+=parseInt(item.amount);
        })
        console.log(all);
        utils.addlog('boom', symbol + ":" + all + "\r\n");
        setTimeout( ()=> {
            getboom(index+1);
        },2000)
    })
}

getboom(0);