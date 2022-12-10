const mapPool = [
    "ASCENT",
    "BIND",
    "BREEZE",
    "FRACTURE",
    "HAVEN",
    "ICEBOX",
    "PEARL",
    "SPLIT",
];

function randomAgent() {
    let selected = mapPool[Math.floor(Math.random() * mapPool.length + 0)];
    console.log(selected);

    document
        .getElementById("mapImg")
        .setAttribute("src", `img/map_big/${selected}.webp`);

    document.getElementById("mapName").textContent = selected;

    let ad = Math.floor(Math.random() * 2 + 0);
    if (ad === 0) {
        document.getElementsByClassName("t1AD")[0].textContent = "ATTACKER";
        document.getElementsByClassName("t2AD")[0].textContent = "DEFENDER";
    } else if (ad === 1) {
        document.getElementsByClassName("t1AD")[0].textContent = "DEFENDER";
        document.getElementsByClassName("t2AD")[0].textContent = "ATTACKER";
    }
}

function startRoll() {
    document.getElementById("rerollBtn").setAttribute("class", "hidden");
    document.getElementById("result").setAttribute("class", "visible");
    document.getElementById("menu").setAttribute("class", "hidden");
    let count = 0;
    let roll = Math.floor(Math.random() * 40 + 20);
    let int = setInterval(function () {
        randomAgent();
        count++;
        console.log(count);
        if (count === roll) {
            clearInterval(int);
            document.getElementById("rerollBtn").setAttribute("class", "visivle");
        }
    }, 100);
}

document.onselectstart = function () {
    return false;
}