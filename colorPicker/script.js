document.addEventListener("DOMContentLoaded", () => {
    settingLoad()
})
const settingLoad = () => {
    let black = localStorage.getItem("blackD");
    let white = localStorage.getItem("whiteD");
    let acc = localStorage.getItem("accentD");
    let dacc = localStorage.getItem("d-accentD");
    let lacc = localStorage.getItem("l-accentD");
    let pm = localStorage.getItem("pm");
    document.getElementById("pickBlack").value = black;
    document.getElementById("pickWhite").value = white;
    document.getElementById("pickAccent").value = acc;
    document.getElementById("pickDarkAccent").value = dacc;
    document.getElementById("pickLightAccent").value = lacc;
    document.getElementById("pm").value = pm - 0;
    document.getElementsByClassName("blackD")[0].setAttribute("style", "background:" + black);
    document.getElementsByClassName("whiteD")[0].setAttribute("style", "background:" + white);
    document.getElementsByClassName("accentD")[0].setAttribute("style", "background:" + acc);
    document.getElementsByClassName("d-accentD")[0].setAttribute("style", "background:" + dacc);
    document.getElementsByClassName("l-accentD")[0].setAttribute("style", "background:" + lacc);

    document.getElementsByClassName("blackD")[0].childNodes[1].textContent = black + " // " + getComplementaryColor(black);
    document.getElementsByClassName("whiteD")[0].childNodes[1].textContent = white + " // " + getComplementaryColor(white);
    document.getElementsByClassName("accentD")[0].childNodes[1].textContent = acc + " // " + getComplementaryColor(acc);
    document.getElementsByClassName("d-accentD")[0].childNodes[1].textContent = dacc + " // " + getComplementaryColor(dacc);
    document.getElementsByClassName("l-accentD")[0].childNodes[1].textContent = lacc + " // " + getComplementaryColor(lacc);

    document.getElementsByClassName("blackD")[0].childNodes[1].setAttribute("style", "color:" + getComplementaryColor(black))
    document.getElementsByClassName("whiteD")[0].childNodes[1].setAttribute("style", "color:" + getComplementaryColor(white))
    document.getElementsByClassName("accentD")[0].childNodes[1].setAttribute("style", "color:" + getComplementaryColor(acc))
    document.getElementsByClassName("d-accentD")[0].childNodes[1].setAttribute("style", "color:" + getComplementaryColor(dacc))
    document.getElementsByClassName("l-accentD")[0].childNodes[1].setAttribute("style", "color:" + getComplementaryColor(lacc))
}
const saveVal = (e, v) => {
    localStorage.setItem(e, v)
}
const pickColor = (e, v) => {
    console.log(e);
    console.log(v);
    document.getElementsByClassName(e)[0].setAttribute("style", "background:" + v + ";")
    saveVal(e, v)
    document.getElementsByClassName(e)[0].childNodes[1].textContent = v + " // " + getComplementaryColor(v)
    document.getElementsByClassName(e)[0].childNodes[1].setAttribute("style", "color:" + getComplementaryColor(v))
}
const getComplementaryColor = (hex) => {
    // HEXコードの#を取り除く
    hex = hex.replace("#", "");
    // R, G, B成分を抽出して10進数に変換
    let r = parseInt(hex.slice(0, 2), 16);
    let g = parseInt(hex.slice(2, 4), 16);
    let b = parseInt(hex.slice(4, 6), 16);
    // 補色を計算（255から各成分を引く）
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;
    // 新しい補色のHEXコードを生成
    let complementaryHex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    return complementaryHex;
}

const setDarkAndLight = () => {
    let pm = document.getElementById("pm").value
    let accentColor = document.getElementById("pickAccent").value;
    document.getElementById("pickDarkAccent").value = convertHex(accentColor, true, pm)
    localStorage.setItem("d-accentD", convertHex(accentColor, true, pm))
    document.getElementById("pickLightAccent").value = convertHex(accentColor, false, pm)
    localStorage.setItem("l-accentD", convertHex(accentColor, false, pm))
}

const convertHex = (hex, toDark, pm) => {
    pm = pm - 0;
    console.log(pm)
    hex = hex.replace("#", "");
    let r = parseInt(hex.slice(0, 2), 16);
    let g = parseInt(hex.slice(2, 4), 16);
    let b = parseInt(hex.slice(4, 6), 16);
    console.log(r, g, b, toDark)
    if (toDark) {
        r = Math.max(r - pm, 0);
        g = Math.max(g - pm, 0);
        b = Math.max(b - pm, 0);
    } else if (!toDark) {
        console.log("toDark is " + toDark)
        r = Math.min(r + pm, 255);
        g = Math.min(g + pm, 255);
        b = Math.min(b + pm, 255);
    }
    console.log(r, g, b)
    let newHex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    return newHex;
}

