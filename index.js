var ws = require('./ws/initWs');
var okTrade = require('./oktrade/okTrade');
var utils = require('./utils');
const fs = require('fs');
const pako = require('pako');
const config = JSON.parse(fs.readFileSync("config.json"));
/* 初始化ws */
var okws = ws.initOneWs(onOkMsg, 0);
ws.initOneWs(onBitMsg, 1);
var mexws = ws.initOneWs(onMexMsg, 2);

/* 价格数组[{time:xxx, price:xxx},...] */
var okPriceArr = [];
var bitPriceArr = [];
var mexPriceArr = [];
/* 当前波动比(用于每秒对比和记录)*/
var okRatio = 0;
var bitRatio = 0;
var mexRatio = 0;
/* 当前长时间段波动比(用于每秒对比和记录)*/
var okLongRatio = 0;
var bitLongRatio = 0;
var mexLongRatio = 0;
/* 当前价格(用于每秒对比和记录)*/
var okNowPrice = 0;
var bitNowPrice = 0;
var mexNowPrice = 0;

/* ---------------- 监听 ---------------------*/
function onOkMsg(msg) {

    let data = JSON.parse(pako.inflateRaw(msg.data, {to: 'string'}));
    if (data[0] && data[0].data && data[0].data.last) {
        let time = new Date();
        okPriceArr.push({
            time: time.getTime(),
            price: data[0].data.last
        })
        console.log('------------------okdata-------------------');
        if (bookAmnout) checkLose(data[0].data.last);
        utils.addlog('ok', utils.formatTime(time) + ':' + data[0].data.last + '\r\n');
    }
}

function onBitMsg(msg) {
    let data = JSON.parse(msg.data);
    if (data[2]) {
        let time = new Date();
        bitPriceArr.push({
            time: time.getTime(),
            price: data[2][3],
            // 只保留正数用以求交易量
            amount: Math.abs(data[2][2])
        })
        console.log('------------------bitdata-------------------');
        utils.addlog('bitfinex', utils.formatTime(time) + ':' + data[2][3] + '\r\n');
    }
}

function onMexMsg(msg) {
    let data = JSON.parse(msg.data);
    if (data.data && data.data[0] && data.data[0].lastPrice) {
        let time = new Date();
        mexPriceArr.push({
            time: time.getTime(),
            price: data.data[0].lastPrice
        })
        console.log('------------------mexprice-------------------');
        // console.log(data[2]);
        utils.addlog('bitmex', utils.formatTime(time) + ':' + data.data[0].lastPrice + '\r\n');
    }
}

/* blockTime 取多长时间段的对比 */
function getMaxRatio(name, blockTime) {
    if (name === 'ok') {
        priceArr = okPriceArr;
    } else if (name === 'mex') {
        priceArr = mexPriceArr;
    }
    // 用数组的最后一个的价格来对比前30s中所有数据的极值
    if (!priceArr.length) {
        console.error(`no ${name} priceArr`);
        return;
    }
    let lastPrice = priceArr[priceArr.length - 1].price;
    let lastTime = priceArr[priceArr.length - 1].time;
    // 用来存储前30s中所有价格
    let priceTempArr = [];
    // 倒序遍历价格数组中，时间小于config.interval ms的，放入priceTempArr中
    for (let i = priceArr.length - 1; i >= 0; i--) {
        if (lastTime - priceArr[i].time < blockTime) {
            priceTempArr.push(priceArr[i].price)
        } else if (lastTime - priceArr[i].time > config.longInterval) {
            // 如果相差的时间大于config.longInterval ms，那么就已经是废数据了，可以清除，防止数据量溢出
            priceArr = priceArr.slice(i);
            break;
        }
    }
    let maxPrice = Math.max(...priceTempArr);
    let minPrice = Math.min(...priceTempArr);
    let p1 = (lastPrice - minPrice) / minPrice;
    let p2 = (lastPrice - maxPrice) / maxPrice;
    /* 变动比例，可正可负 */
    if (name === 'ok') {
        if (blockTime === config.longInterval) {
            okLongRatio = Math.abs(p1) > Math.abs(p2) ? p1 : p2;
        } else if (blockTime === config.interval) {
            okRatio = Math.abs(p1) > Math.abs(p2) ? p1 : p2;
        }
        okNowPrice = lastPrice;
    } else if (name === 'mex') {
        if (blockTime === config.longInterval) {
            mexLongRatio = Math.abs(p1) > Math.abs(p2) ? p1 : p2;
        } else if (blockTime === config.interval) {
            mexRatio = Math.abs(p1) > Math.abs(p2) ? p1 : p2;
        }
        mexNowPrice = lastPrice;
    }
}
var tradesInfo = '';

function getBitMaxRatio(blockTime) {
    if (!bitPriceArr.length) {
        console.error('no bit priceArr');
        return;
    }
    // 用数组的最后一个的价格来对比前30s中所有数据的极值
    let lastPrice = bitPriceArr[bitPriceArr.length - 1].price;
    let lastTime = bitPriceArr[bitPriceArr.length - 1].time;
    // 用来存储前30s中所有价格
    let priceTempArr = [];
    // 交易量的和
    let allTradesAmount = 0;
    // 交易量起始时间
    let firstTime = 0;
    // 倒序遍历价格数组中，时间小于blockTime ms的，放入priceTempArr中
    for (let i = bitPriceArr.length - 1; i >= 0; i--) {
        if (lastTime - bitPriceArr[i].time > config.longInterval) {
            // 如果相差的时间大于config.longInterval ms，那么就已经是废数据了，可以清除，防止数据量溢出
            bitPriceArr = bitPriceArr.slice(i);
            break;
        }
        if (lastTime - bitPriceArr[i].time < blockTime) {
            allTradesAmount += bitPriceArr[i].amount;
            priceTempArr.push(bitPriceArr[i].price);
        } else {
            /* first只记一次，就是刚过blockTime的第一个，理论上来说就是区间的第一时间 */
            if (!firstTime) firstTime = bitPriceArr[i].time;
        }
    }
    /* 相同的信息就不重复写入 */
    let firstTimeFormat = utils.formatTime(new Date(firstTime));
    let lastTimeFormat = utils.formatTime(new Date(lastTime));
    let nowTrades = firstTimeFormat + '-' + lastTimeFormat + ':' + allTradesAmount + '\r\n';
    if (tradesInfo !== nowTrades) {
        tradesInfo = nowTrades;
        utils.addlog('trades', tradesInfo);
    }
    let maxPrice = Math.max(...priceTempArr);
    let minPrice = Math.min(...priceTempArr);
    let p1 = (lastPrice - minPrice) / minPrice;
    let p2 = (lastPrice - maxPrice) / maxPrice;
    /* 变动比例，可正可负 */
    if (blockTime === config.longInterval) {
        bitLongRatio = Math.abs(p1) > Math.abs(p2) ? p1 : p2;
    } else if (blockTime === config.interval) {
        bitRatio = Math.abs(p1) > Math.abs(p2) ? p1 : p2;
    }
    bitNowPrice = lastPrice;
    // console.log('max:', maxPrice, 'min', minPrice, 'last', lastPrice);
    /* 保留小数后3位即可，千分位 */
    // console.log('bitRatio', (bitRatio.toFixed(3) * 100) + '%');
    let logRatio = `${utils.formatTime(new Date())} OKRatio:${okRatio.toFixed(4)}|MEXRatio:${mexRatio.toFixed(4)}|BitRatio:${bitRatio.toFixed(4)}|OKprice:${okNowPrice}|MEXprice:${mexNowPrice}|Bitprice:${bitNowPrice}|Bit/Ok:${Math.abs(bitRatio) / Math.abs(okRatio)}|Bit/Mex:${Math.abs(bitRatio) / Math.abs(mexRatio)} \r\n`;
    // console.log(logRatio);
    utils.addlog('ratio', logRatio);
    /* 开单条件 */
    if (Math.abs(bitRatio) > config.percent) {
        // 长周期检测不需要再checkbook，否则会死循环
        if (blockTime == config.longInterval) return;
        checkBook(logRatio);
    }
}
var isBooking = false;

function checkBook(logRatio) {
    if (isBooking || bookAmnout) return; // 防止重复下单
    if (Math.abs(bitRatio) / Math.abs(okRatio) > config.spotRatioFutures) {
        /* 取一下长周期的值 */
        getRatio(config.longInterval);
        /* 记一下第一层通过的开单情况 */
        let book = okRatio > 0 ? 'long' : 'short';
        /* 判断第二级开单条件 */
        if (Math.abs(bitLongRatio) / Math.abs(okLongRatio) > config.spotLongRatioFutures) {
            utils.addlog('book', `******************************** \r\n`);
            utils.addlog('book', `open ${book} at ${logRatio} \r\n`);
            utils.addlog('book', `******************************** \r\n`);
            isBooking = true; // 正在下单
            if (okRatio > 0) {
                okTrade.openBook(okNowPrice, accountAvailableNum, config.position, 1, (data) => {
                    if (data.result) {
                        // 5s后看看成交没
                        setTimeout(() => {
                            checkAccountBook();
                        }, 5000)
                    }
                })
            } else {
                okTrade.openBook(okNowPrice, accountAvailableNum, config.position, 2, (data) => {
                    if (data.result) {
                        // 5s后看看成交没
                        setTimeout(() => {
                            checkAccountBook();
                        }, 5000)
                    }
                })
            }
        } else {
            utils.addlog('book', `------------------------------ \r\n`);
            utils.addlog('book', `open ${book} at ${logRatio} \r\n`);
            utils.addlog('book', `no open because longRatio: ${Math.abs(bitLongRatio) / Math.abs(okLongRatio)} \r\n`);
            utils.addlog('book', `------------------------------ \r\n`);
        }
    }
}

function getRatio(blockTime) {
    // 如果当前账户有单，那么不用计算开单条件了
    if (bookAmnout) {
        console.log('now have book so no checkRatio');
        return;
    }
    getMaxRatio('ok', blockTime);
    getMaxRatio('mex', blockTime);
    getBitMaxRatio(blockTime);
}
// 循环时间+10s后才开始检测数据
setTimeout(() => {
    console.log('start getratio');
    setInterval(() => {
        getRatio(config.interval);
    }, 1000)
}, config.interval + 10000);


// 合约账户上的可用余额（如果没单那么启动的时候应该去查询）
var accountAvailableNum = 0;
// 当前是否有单，数量是多少 （如果有单那么不用去查询余额，等到平单后再查询余额用于下次开单使用）
var bookAmnout = 0;
// 如果有单，记录开单价格
var bookPrice = 0;
// 开的什么单？ 1:开多 2:开空 3:平多 4:平空
var bookType = null;

/* 程序开始时检测一次，并且每隔60s检测一下账号的单子状态，防止手动止盈后程序不再次下单 */
checkAccountBook();
setInterval(() => {
    checkAccountBook();
}, 60000)

function checkLose(nowPrice) {
    /* 差价 */
    let gap = nowPrice - bookPrice;
    /* 价格浮动 */
    let ratio = gap / bookPrice;
    console.log('now book price ratio is' + ratio);
    // /* 价格波动大于了止盈百分比 */
    // if (Math.abs(ratio) > config.winPricePercent) {
    //     /* 多单并且价格是负差值，所以要止损了 */
    //     if (isBooking) return; // 防止重复下单
    //     if (bookType == 1 && ratio > 0) {
    //         isBooking = true; // 正在下单
    //         console.log('close long book by win');
    //         okTrade.closeBook(nowPrice, bookAmnout, 3, (data) => {
    //             console.log(data);
    //         })
    //     } else if (bookType == 2 && ratio < 0) {
    //         console.log('close short book by win');
    //         isBooking = true; // 正在下单
    //         okTrade.closeBook(nowPrice, bookAmnout, 4, (data) => {
    //             console.log(data);
    //         })
    //     }
    // }
    /* 价格波动大于了止损百分比 */
    if (Math.abs(ratio) > config.losePricePercent) {
        /* 多单并且价格是负差值，所以要止损了 */
        if (isBooking) return; // 防止重复下单
        if (bookType == 1 && ratio < 0) {
            isBooking = true; // 正在下单
            console.log('close long book by defeat');
            okTrade.closeBook(nowPrice, bookAmnout, 3, (data) => {
                console.log(data);
            })
        } else if (bookType == 2 && ratio > 0) {
            console.log('close short book by defeat');
            isBooking = true; // 正在下单
            okTrade.closeBook(nowPrice, bookAmnout, 4, (data) => {
                console.log(data);
            })
        }
    }
}

function checkAccountBook() {
    okTrade.getAccountOrder(data => {
        if (data.holding && data.holding[0]) {
            console.log('now account have book');
            console.log(data.holding[0]);
            /* 说明当前有多单 */
            if (data.holding[0].buy_available) {
                bookPrice = data.holding[0].buy_price_cost;
                bookType = 1;
                bookAmnout = data.holding[0].buy_available;
                /* 说明当前有空单 */
            } else if (data.holding[0].sell_available) {
                bookPrice = data.holding[0].sell_price_cost;
                bookType = 2;
                bookAmnout = data.holding[0].sell_available;
            }
            isBooking = false;
        } else {
            // 如果没单，则去取当前合约账户可用余额
            console.log('now account no book');
            okTrade.getAccountNum((data) => {
                accountAvailableNum = data.info.btc.contracts[0].available;
                console.log('now account available is ' + accountAvailableNum);
            });
            /* 如果没有单子把标志参数都清零 */
            bookAmnout = 0;
            bookPrice = 0;
            bookType = null;
            isBooking = false;
        }
    });
}