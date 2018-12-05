const fs = require('fs');
// 第一次运行如果没有log文件夹，生成一个
if (!fs.existsSync(`./log`)) {
    console.log(`mkdir of ./log`);
    fs.mkdirSync(`./log`);
}
function getDate() {
    let date = new Date();
    return date.getMonth() + 1 + '-' + date.getDate();
}
exports.formatTime = function (now) {
    var y = now.getFullYear(),
        m = now.getMonth() + 1,
        d = now.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d) + " " + now.toTimeString().substr(0, 8);
}
exports.addlog = function (name, text) {
    let date = getDate();
    /* linux环境中不能没有文件夹 */
    if (!fs.existsSync(`./log/${date}`)) {
        console.log(`mkdir of ./log/${date}`);
        fs.mkdirSync(`./log/${date}`);
    }
    fs.appendFileSync(`./log/${date}/eos-${name}.txt`, text);
}