const getInfo = () => {
    let info = document.querySelector('div[style*="width: 550px; position: absolute; top: 0px; left: 0px; padding: 10px; pointer-events: none; background-color: rgba(0, 0, 0, 0.8);"]')
    let infoArray = info.innerText.split("\n");
    let yaw = infoArray[9];
    const parts = yaw.split("Player Yaw: ");
    yaw = parts[1].split(" Player Pitch: ")[0];
    console.log(yaw)
}

let inforval = setInterval(() => {
    try {
        getInfo()
    } catch (error) {
    }
}, 1)
inforval