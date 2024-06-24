let score = 0
const start = () => {
    console.log("clicked")
    score = 0
    document.body.requestFullscreen()
    document.querySelector("#startBtn").classList.add("hide")
    cDOm = document.querySelector("#count")
    setTimeout(() => {
        cDOm.innerHTML = `<div>3</div>`
    }, 1000);
    setTimeout(() => {
        cDOm.innerHTML = `<div>2</div>`
    }, 2000);
    setTimeout(() => {
        cDOm.innerHTML = `<div>1</div>`
    }, 3000);
    setTimeout(() => {
        cDOm.innerHTML = `<div>GO!</div>`
    }, 4000);
    let wi = window.innerWidth
    let he = window.innerHeight
    setTimeout(() => {
        cDOm.innerHTML = ""
        document.body.insertAdjacentHTML("afterbegin", `<input onclick="clicked(this)" style="position:fixed;top:${Math.floor(Math.random() * (he - 0 + 1)) + 0}px;left:${Math.floor(Math.random() * (wi - 0 + 1)) + 0}px;" id="target" type="button" value="・" ></input> `)
    }, 4500)

    setTimeout(() => {
        finish()
    }, 34500);

}
const clicked = () => {
    let v = document.querySelector("#target")
    // console.log(v)
    let wi = window.innerWidth
    let he = window.innerHeight
    score++
    v.style.top = Math.floor(Math.random() * (he - 0 + 1)) + 0 + "px"
    v.style.left = Math.floor(Math.random() * (wi - 0 + 1)) + 0 + "px"
}
const finish = () => {
    document.body.innerHTML = `
    <input type="button" id="startBtn" onclick="start()" value="START">
    <div id="count"></div>
    <script src="script.js"></script>`
    alert(score)
}
