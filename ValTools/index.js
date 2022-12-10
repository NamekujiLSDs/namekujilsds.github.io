window.addEventListener("load", load);

function load() {
    const agent = document.getElementById("agentR");
    let val = Math.floor(Math.random() * 19 + 0);
    let imgUrl = `img/agent_thumb/agent_${val}.png`;
    agent.setAttribute("style", `background-image:url(${imgUrl})`);

    const map = document.getElementById("mapR");
    let val2 = Math.floor(Math.random() * 7 + 0);
    let imgUrl2 = `img/map_thumb/map_${val2}.png`;
    map.setAttribute("style", `background-image:url(${imgUrl2})`);

    let val3 = Math.floor(Math.random() * 10 + 0);
    document.body.setAttribute(
        "style",
        `background-image: url('/img/bg/bg_${val3}.webp');`
    );
}

setInterval(load, 10000);


document.onselectstart = function () {
    return false;
}