// 枠組みの中身を書き換えて云々
const rCont = document.getElementById('rightContents');
// ページのタイトルを云々
const pTitle = document.getElementById('pTitle');
// シェアボタン云々
const share = document.getElementById('shareBtn');

// 色テーブル
const colors = [
    '#ffaadb',
    '#aaefff',
    '#aaffc9',
    '#efffaa',
    '#ffadaa',
    '#e9aaff'
];

// 文字列選択の無効化
document.ondragstart = function() {
    return false;
};

// ページ読み込み時に実行(色のランダム化)
window.onload = function() {
    document.getElementsByTagName('html')[0].style.setProperty('--accent-color', colors[Math.round(Math.random() * (colors.length - 1))])
    VANTA.NET({
        el: "#net",
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        backgroundColor: 0x50309,
        color: colors[Math.round(Math.random() * (colors.length - 1))]
    })
}

// ページ切り替え
const loadSubPage = (name) => {
    rCont.innerHTML = `<iframe src='${name.toLowerCase()}.html'>`;
    pTitle.innerHTML = `Namekuji - ${name}`;
    document.getElementsByTagName('html')[0].style.setProperty('--accent-color', colors[Math.round(Math.random() * (colors.length - 1))])
}

// URLコピー
function copyUrl() {
    var url = location.href;
    navigator.clipboard.writeText(url);
    share.innerHTML = "URL Copied";
}


