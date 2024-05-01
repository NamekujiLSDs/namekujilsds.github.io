let list = [];
const fetJson = async () => {
    list = await fetch("./db.json")
    list = await list.json()
    console.log(list)
    for (let i of list.crosshair) {
        console.log(i)
        let dom = `<div id="contents" class="${i.cross ? "cross" : ""}${i.tType ? " tType" : ""}${i.cycle ? " cycle" : ""}${i.dot ? " dot" : ""}${i.scope ? " scope" : ""}${i.haveOutline ? " haveOutline" : ""}${i.animated ? " animated" : ""}${i.funny ? " funny" : ""}"><img src="./${i.url}" class="crosshairImages"></img></div>`
        console.log(dom)
        document.getElementById("crosshairs").insertAdjacentHTML("beforeend", dom)
    }
}
fetJson()

// "cross": "true",
// "tType": "true",
// "cycle": "false",
// "dot": "false",
// "scope": "false",
// "haveOutline": "true",
// "animated": "false",
// "funny": "false"