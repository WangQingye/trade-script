const WebSocket = require('ws')
const SocksProxyAgent = require('socks-proxy-agent');
var agent = new SocksProxyAgent('socks://127.0.0.1:1080');
var wsConfig = [{ /* ok季度监听 */
    url: 'wss://real.okex.com:10440/ws/v1',
    msg: "{'event':'addChannel','channel':'ok_sub_futureusd_btc_ticker_quarter'}"
}, { /* bitfinex 监听 */
    url: 'wss://api.bitfinex.com/ws/2',
    msg: JSON.stringify({
        "event": "subscribe",
        "channel": "trades",
        "pair": "tBTCUSD"
    })
}, { /* bitmex监听 */
    url: 'wss://www.bitmex.com/realtime',
    msg: JSON.stringify({
        "op": "subscribe",
        "args": ["instrument:XBTUSD"]
    })
}]
/* 传入消息处理函数 */
exports.initOneWs = function initOneWs(msgFunc, index) {
    let ws = initWs(index);
    ws.onmessage = msgFunc;
    /* OK和mex的API需要定时向服务器发送数据来保持连接 */
    if (index == 0 || index == 3) {
        setInterval(() => {
            // console.log(index);
            if (ws.readyState == 1) {
                ws.send('{"event":"ping"}')
            }
        }, 20000)
    }
    /* 防断开重连 */
    ws.onclose = () => {
        console.log('wsclose', index);
        // initOneWs(msgFunc, index);
    }
    ws.onerror = () => {
        console.log('wserror', index);
        // initOneWs(msgFunc, index);
    }
    return ws;
}

function initWs(index) {
    let ws;
    /* 服务器上不需要代理 */
    if (process.argv[2]) {
        ws = new WebSocket(wsConfig[index].url, {
            agent: agent
        })
    } else {
        ws = new WebSocket(wsConfig[index].url)
    }
    ws.onopen = () => {
        console.log(wsConfig[index].url, 'open');
        ws.send(wsConfig[index].msg);
    }
    return ws;
}