let randomVals = [];

const agent = ["Astra",
    "Breach",
    "Brimstone",
    "Chamber",
    "Cypher",
    "Fade",
    "Harbor",
    "Jett",
    "KAYO",
    "Killjoy",
    "Neon",
    "Omen",
    "Phoenix",
    "Raze",
    "Reyna",
    "Sage",
    "Skye",
    "Sova",
    "Viper",
    "Yoru"
]
function agentRoll() {
    randomVals = [];
    for (i = 0; i < 5; i++) {
        let val = Math.floor(Math.random() * agent.length - 0);
        if (!randomVals.includes(val)) {
            randomVals.push(val);
        } else {
            i--
        }
    }
    agentApp()
    document.getElementById('menu').setAttribute('class', 'hidden');
    document.getElementById('agentHolder').setAttribute('class', 'visible');
}

function agentApp() {
    let count = 1;
    for (let i of randomVals) {
        document.getElementsByClassName(`a${count}Img`)[0].setAttribute('src', `./img/agent_body/${agent[i]}.png`);
        document.getElementsByClassName(`a${count}N`)[0].textContent = `${agent[i]}`
        document.getElementsByClassName(`a${count}Img`)[0].setAttribute('name', `${agent[i]}`);

        count++;
        console.log(count)
    }
}

document.onselectstart = function () {
    return false;
}

function reroll() {
    document.getElementById('reroll').setAttribute('class', 'hidden');
    agentRoll();
    document.getElementById('reroll').removeAttribute('class')

}