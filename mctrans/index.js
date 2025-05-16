const applySetting = () => {
    let apiVisible = localStorage.getItem("apiVisible");
    console.log(apiVisible)
    if (apiVisible !== null) {
        if (apiVisible - 0 < 1) {
            document.getElementById("apiUrl").classList.toggle("blur");
            document.getElementById("toggleV").textContent = "visibility_off"
        }
    }
    let apiUrl = localStorage.getItem("apiUrl");
    if (apiUrl !== null && apiUrl.length > 0) {
        document.getElementById("apiUrl").value = apiUrl
    }
};

const apiUrlUpdate = (val) => {
    localStorage.setItem("apiUrl", val)
};

const toggleVisible = () => {
    let apiUrl = document.getElementById("apiUrl");
    apiUrl.classList.toggle("blur");
    apiUrl.classList.contains("blur") ? document.getElementById("toggleV").textContent = "visibility_off" : document.getElementById("toggleV").textContent = "visibility"
    apiUrl.classList.contains("blur") ? localStorage.setItem("apiVisible", 0) : localStorage.setItem("apiVisible", 1)
    let apiVisible = localStorage.getItem("apiVisible")
    console.log(apiVisible)

};

const startCheck = async () => {
    let apiUrl = document.getElementById("apiUrl").value
    let fileInput = document.getElementById("openJson")
    if (URL.canParse(apiUrl) && fileInput.files.length) {
        startTranslate()
    } else {
        if (!URL.canParse(apiUrl) && !fileInput.files.length) {
            alert("URLもファイルもあかんわ。ちゃんと確認してや")
        }
        else if (!URL.canParse(apiUrl)) {
            alert("URLがあかんっぽいわ")
        } else if (!fileInput.files.length) {
            alert("ファイルがあかんらしいわ")
        }
    }
};

const startTranslate = async () => {
    let source = document.getElementById("inputLang").value
    let target = document.getElementById("outputLang").value
    resetOutput()
    let fileInput = document.getElementById("openJson")
    let startBtn = document.getElementById("startButton")
    let jsonOrigin = await JSON.parse(await fileInput.files[0].text())
    let output = document.getElementById("log")
    const keys = await Object.keys(jsonOrigin)
    const totalCount = await Object.keys(jsonOrigin).length
    let completed = 0;
    await progressBarUpdate(completed, totalCount)
    const tasks = keys.map(async (key) => {
        const value = jsonOrigin[key];
        const dom = document.createElement("div")
        try {
            const translated = await translateViaAPI(value, source, target); // gas呼び出し
            dom.className = "translateItems success";
            dom.innerHTML = `
            <div class="key">
                <span class="keyTitle">Key : </span>
                <span class="keyValue">${key}</span>
            </div>
            <div class="value">
                <span class="valueTitle">Value : </span>
                <span class="valueValue">${value}</span>
            </div>
            <div class="translated">
                <span class="translatedTitle">翻訳 : </span>
                <input class="translatedValue" type="text" value="${translated}"></span>
            </div>`
        } catch (e) {
            dom.className = "translateItems error";
            dom.innerHTML = `
            <div class="key">
                <span class="keyTitle">Key : </span>
                <span class="keyValue">${key}</span>
            </div>
            <div class="value">
                <span class="valueTitle">Value : </span>
                <span class="valueValue">${value}</span>
            </div>
            <div class="translated">
                <span class="translatedTitle">翻訳 : </span>
                <input class="translatedValue" type="text" value="${value}"></span>
            </div>
            <input type="button" onclick="solveErr(this.parentNode)" value="解決済みにする">
            `
        }
        output.appendChild(dom)
        completed++
        await progressBarUpdate(completed, totalCount)
    })
    await Promise.all(tasks)

}

const translateViaAPI = async (text, source, target) => {
    let apiUrl = document.getElementById("apiUrl").value
    const url = `${apiUrl}?text=${encodeURIComponent(text)}&source=${source}&target=${target}`; // パラメータ付きURLを生成
    const response = await fetch(url);
    if (!response.ok) throw new Error("API接続失敗"); // レスポンスが正常でない場合はエラー
    const result = await response.json(); // 結果をJSONとして取得
    if (result.code !== 200 || !result.text) {
        throw new Error("翻訳失敗"); // API側のエラー処理
    }
    return result.text; // 翻訳されたテキストを返す
}

const filterErr = (tf) => {
    if (tf) {
        let doms = document.getElementsByClassName("success")
        for (const dom of doms) {
            dom.classList.contains("hidden") ? "" : dom.classList.toggle("hidden");
        }
    } else if (!tf) {
        let doms = document.getElementsByClassName("success")
        for (const dom of doms) {
            dom.classList.contains("hidden") ? dom.classList.toggle("hidden") : "";
        }
    }

};
const resetOutput = () => {
    document.getElementById("log").innerHTML = "";
};

const solveErr = (dom) => {
    console.log(dom)
    dom.classList.toggle("error")
    dom.classList.toggle("success")
    if (document.getElementById("filterErr").checked) {
        dom.classList.add("hidden")
    }
};
const progressBarUpdate = (now, max) => {
    console.log(now, max)

    let progressHolder = document.getElementById("progress")
    progressHolder.setAttribute("class", "")
    document.getElementById("current").textContent = now;
    document.getElementById("max").textContent = max;
    let percent = Math.floor((now / max) * 100)
    document.getElementById('progressBarInner').setAttribute("style", "width:" + percent + "%")
    if (now === max) {
        progressHolder.setAttribute("class", "hidden")
    }
};

const download = () => {
    let json = {}
    let doms = document.getElementsByClassName("translateItems")
    for (let dom of doms) {
        console.log(dom)
        json[dom.getElementsByClassName("keyValue")[0].textContent] = dom.getElementsByClassName("translatedValue")[0].value;
    }
    let downloadLink = document.createElement("a")
    const resultText = JSON.stringify(json, null, 2);
    const blob = new Blob([resultText], { type: "application/json" });
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = "translated.json"
    downloadLink.innerText = "Download"
    downloadLink.setAttribute("style", "visibility: hidden;")
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)

};

document.addEventListener('DOMContentLoaded', () => {
    applySetting()
})
