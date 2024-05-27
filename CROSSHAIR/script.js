let list = [];
const fetJson = async () => {
    list = await fetch("./db.json")
    list = await list.json()
    console.log(list)
    for (let i of list.crosshair) {
        console.log(i)
        let dom = `<div id="contents" class="${i.cross ? "cross" : ""}${i.tType ? " tType" : ""}${i.cycle ? " cycle" : ""}${i.dot ? " dot" : ""}${i.scope ? " scope" : ""}${i.haveOutline ? " haveOutline" : ""}${i.animated ? " animated" : ""}${i.funny ? " funny" : ""}">
        <div id="crosshairBox" onclick="zoomIn(this)">
        <img src="./${i.url}" class="crosshairImages">
        </div>
        <div id="crosshairInfo">
            <a id="download" href="${i.url}" download="${i.url.split("/")[1]}">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#444"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>
            </a>
            <span id="copy" onclick="copyLink('${location.origin}/CROSSHAIR/${i.url}')">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"
                    fill="#444">
                    <path
                        d="M440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80ZM320-440v-80h320v80H320Zm200 160v-80h160q50 0 85-35t35-85q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H520Z" />
                </svg></span>
        </div>
    </div>`

        // console.log(dom)
        document.getElementById("crosshairs").insertAdjacentHTML("beforeend", dom)
    }
}
fetJson()

const copyLink = (v) => {
    navigator.clipboard.writeText(v)
}
const preventScroll = {
    x: 0,
    y: 0,
    setPos(x = window.pageXOffset, y = window.pageYOffset) {
        this.x = x;
        this.y = y;
    },
    handleEvent() {
        window.scrollTo(this.x, this.y);
    },
    enable() {
        this.setPos();
        window.addEventListener("scroll", this);
    },
    disable() {
        window.removeEventListener("scroll", this);
    }
};
const zoomIn = (v) => {
    v = v.getElementsByClassName("crosshairImages")[0]
    preventScroll.enable()
    let scrollProgress = document.documentElement.scrollTop
    let zoomAmp = 100
    let dom = `<div id="closer">            <div id="zoomBgChange">
    <input type="color" name="" id="colorPicker2" value="#808080" oninput="pickCol2(this.value)">
</div><img id="zoomedImg" src="${v.src}" value="100"></div>`
    document.getElementById("zoom").insertAdjacentHTML("afterbegin", dom)
    document.getElementById("closer").addEventListener('wheel', (event) => {
        document.documentElement.scrollTo("", scrollProgress)
        console.log(event)
        if (event.deltaY >= 0 && !event.shiftKey && !event.altKey) {
            zoomAmp = zoomAmp - 5
            document.getElementById("zoomedImg").style = "transform:scale(" + (zoomAmp / 100) + ")"
        } else if (event.deltaY <= 0 && !event.shiftKey && !event.altKey) {
            zoomAmp = zoomAmp + 5
            document.getElementById("zoomedImg").style = "transform:scale(" + (zoomAmp / 100) + ")"
        } else if (event.deltaY >= 0 && event.shiftKey && !event.altKey) {
            zoomAmp = zoomAmp - 10
            document.getElementById("zoomedImg").style = "transform:scale(" + (zoomAmp / 100) + ")"
        } else if (event.deltaY <= 0 && event.shiftKey && !event.altKey) {
            zoomAmp = zoomAmp + 10
            document.getElementById("zoomedImg").style = "transform:scale(" + (zoomAmp / 100) + ")"
        } else if (event.deltaY >= 0 && event.altKey) {
            zoomAmp = zoomAmp - 20
            document.getElementById("zoomedImg").style = "transform:scale(" + (zoomAmp / 100) + ")"
        } else if (event.deltaY <= 0 && event.altKey) {
            zoomAmp = zoomAmp + 20
            document.getElementById("zoomedImg").style = "transform:scale(" + (zoomAmp / 100) + ")"
        }
    });
}
const exitZoom = (v) => {
    v.childNodes[0].remove()
    preventScroll.disable()
}
const changeNarrow = (v) => {
    console.log(v);
    let styleId = v.name + "Css"
    console.log(styleId)
    console.log(document.getElementById(styleId))
    document.getElementById(styleId).innerText = `.${v.id}{${v.checked ? "" : "display:none!important"}}`
}
const cssGridSet = () => {
    let pageWidth = window.innerWidth
    let val = Math.floor(pageWidth / 240)
    let css = `#crosshairs {
    display: grid;
    grid-template-columns: repeat(${val}, 1fr)}`
    document.getElementById("pageSize").innerText = css
}
document.addEventListener("DOMContentLoaded", () => {
    cssGridSet()
})
window.onresize = cssGridSet
const pickCol = (v) => {
    document.getElementById("crosshairBgSet").innerText = `#contents {background: ${v};}`
    document.getElementById("colDisplay").textContent = v
}
const pickCol2 = (v) => {
    document.getElementById("zoomColor").innerText = `#closer{background: ${v};}`
    document.getElementById("colDisplay2").textContent = v
}
const pickCol3 = (v) => {
    document.getElementById("zoomColor").innerText = `#closer{background: ${v};}`
    document.getElementById("colDisplay2").textContent = v
}

// "cross": "true",
// "tType": "true",
// "cycle": "false",
// "dot": "false",
// "scope": "false",
// "haveOutline": "true",
// "animated": "false",
// "funny": "false"

