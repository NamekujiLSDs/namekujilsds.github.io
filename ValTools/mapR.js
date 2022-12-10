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

let mapRandPool = [];


function mapBan() {
    for (let node of document.getElementsByClassName('map')) {
        if (!node.checked) {
            node.parentNode.setAttribute("class", "banned");
            node.parentNode.childNodes[7].setAttribute('class', 'visible');
        } else if (node.checked) {
            node.parentNode.removeAttribute("class");
            node.parentNode.childNodes[7].setAttribute('class', 'hidden');
        }
    }
}

document.onselectstart = function () {
    return false;
}

function roll() {
    document.getElementById("roll").setAttribute("class", "hidden");
    let count = 0;
    mapRandPool = [];
    for (let node of document.getElementsByClassName('map')) {
        if (node.checked) {
            mapRandPool.push(mapPool[count])
        }
        count++
    }
    console.log(mapRandPool); //マッププールが完成

    let intervalCount = 0;
    let rollVal = Math.floor(Math.random() * 40 + 20);
    let int = setInterval(function () {
        randomMap();
        intervalCount++;
        console.log(intervalCount)
        if (intervalCount === rollVal) {
            clearInterval(int);
            document.getElementById("roll").setAttribute("class", "visible");
        }
    }, 50);
}

randomMap = () => {

    let ramNum = Math.floor(Math.random() * mapRandPool.length + 0);
    const mapDisplay = document.getElementById('pickedMapImg')
    mapDisplay.setAttribute('src', `./img/map_big/${mapRandPool[ramNum]}.webp`);
    const mapName = document.getElementById('mapName');
    mapName.textContent = `${mapRandPool[ramNum]}`;

    let ad = Math.floor(Math.random() * 2 + 0);
    if (ad === 0) {
        document.getElementById("t1AD").textContent = "ATTACKER";
        document.getElementById("t2AD").textContent = "DEFENDER";
    } else if (ad === 1) {
        document.getElementById("t1AD").textContent = "DEFENDER";
        document.getElementById("t2AD").textContent = "ATTACKER";
    }
}