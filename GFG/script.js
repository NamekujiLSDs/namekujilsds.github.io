//画像側の固定変数
const cardImg = document.getElementsByClassName("cardImage")[0];
const cardTitle = document.getElementsByClassName("cardTitle")[0];
const elementIcon = document.getElementsByClassName("elementIcon")[0];
const effectText = document.getElementsByClassName("effectText")[0];
const effectAlt = document.getElementsByClassName("effectAlt")[0];
const money = document.getElementsByClassName('money')[0];
const mana = document.getElementsByClassName('mana')[0];
const mana2 = document.getElementsByClassName('mana2')[0];

//入力側の固定変数
let imgInput = document.getElementById('imgInput')
let cardTitleInput = document.getElementsByClassName('cardTitleInput')[0];
let elementIconInput = document.getElementsByClassName('elementIconInput')[0];
let effectTextInput = document.getElementsByClassName('effectTextInput')[0]
let effectAltInput = document.getElementsByClassName('effectAltInput')[0];
let cardTypeList = document.getElementsByClassName('cardTypeList')[0];
let cardTypeValue = document.getElementsByClassName('cardTypeValue')[0]

imgInput.addEventListener('change', generateHTML)
cardTitleInput.addEventListener('input', generateHTML)
elementIconInput.addEventListener('change', generateHTML)
effectTextInput.addEventListener('input', generateHTML)
effectAltInput.addEventListener('input', generateHTML)
cardTypeList.addEventListener('change', generateHTML)
cardTypeValue.addEventListener('input', generateHTML)
function generateHTML() {
    if (imgInput.files.length > 0) {
        var blobUrl = window.URL.createObjectURL(imgInput.files[0]);
        cardImg.setAttribute("src", blobUrl);
    }
    cardTitle.textContent = cardTitleInput.value;
    effectText.textContent = effectTextInput.value;
    effectAlt.textContent = effectAltInput.value;

    cardTitle.setAttribute('name', elementIconInput.value)
    effectText.setAttribute('name', elementIconInput.value)
    effectAlt.setAttribute('name', elementIconInput.value)
    elementIcon.setAttribute('name', elementIconInput.value)
    cardTitle.setAttribute('name', elementIconInput.value);
    mana.setAttribute("name", cardTypeList.value);
    money.setAttribute("name", cardTypeList.value);

    if (cardTypeList.value === "money") {
        money.textContent = `\xA5` + cardTypeValue.value
    }
    if (cardTypeList.value === "mana") {
        mana2.textContent = `MP` + cardTypeValue.value
    }
    generateCanvas()
}


async function canvasDelete() {
    let canvasList = document.querySelectorAll('canvas');
    val = Math.floor(canvasList.length);
    console.log("val = " + val)
    if (val > 1) {
        for (i = 0; i < val; i++) {
            console.log(i);
            document.querySelectorAll('canvas')[i].remove()
        }
    }
}
async function generateCanvas() {
    await html2canvas(document.querySelector("#capture"), {
        width: 620,
        height: 200,
        backgroundColor: null,
        useCORS: true,
        x: -10,
        y: -10,
    }).then((canvas) => {
        document.body.appendChild(canvas);
    });

    await canvasDelete()
}

async function imageDownload() {
    let canvas = document.querySelector("canvas");
    let cardName = document.getElementsByClassName("cardTitle")[0].textContent;
    let link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${cardName}.png`;
    link.click();
}
