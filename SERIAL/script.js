//DOMに名前を付ける
const stringInput = document.getElementById("inp")
const stringOutput = document.getElementById("outp")
const inpLetterNum = document.getElementById("inpLetterNum")
const inpColNum = document.getElementById("inpColNum")
const outpLetterNum = document.getElementById("outpLetterNum")
const outpColNum = document.getElementById("outpColNum")
const joinBeforeCheck = document.getElementById("joinBefore")
const joinAfterCheck = document.getElementById("joinAfter")
const joinBeforeString = document.getElementById("joinBeforeString")
const joinAfterString = document.getElementById("joinAfterString")
const joinColBeforeCheck = document.getElementById("joinColBeforeCheck")
const joinColAfterCheck = document.getElementById("joinColAfterCheck")
const joinColBeforeString = document.getElementById("joinColBefore")
const joinColAfterString = document.getElementById("joinColAfter")


const copyOutput = () => {
    let outputZone = document.getElementById("outp")
    let outputVal = outputZone.value
    // console.log(outputVal)
    navigator.clipboard.writeText(outputVal)
}
const doProcess = () => {
    const valList = stringInput.value.split("\n")
    // console.log(valList)
    let joinABList = []
    let finalList = []
    let finalStrings = ``
    let checks = [joinBeforeCheck.checked, joinAfterCheck.checked, joinColBeforeCheck.checked, joinColAfterCheck.checked]
    // console.log(checks)
    let count = document.getElementById("serialStart").value - 0
    for (let v of valList) {
        if (joinBeforeCheck.checked && joinBeforeString.value.length > 0) {
            let str = joinBeforeString.value
            // console.log(str)
            str = str.replace("{num}", count)
            v = str + v
        }
        if (joinAfterCheck.checked && joinAfterString.value.length > 0) {
            let str = joinAfterString.value;
            // console.log(str)
            str = str.replace("{num}", count)
            v = v + str
        }
        // console.log(v)
        joinABList.push(v)
        count = count + (document.getElementById("serialInc").value - 0)
    }
    count = document.getElementById("serialStart").value - 0
    for (let val of joinABList) {
        if (joinColBeforeCheck.checked && joinColBeforeString.value.length > 0) {
            let jBS = joinColBeforeString.value
            jBS = jBS.replace("{num}", count)
            finalList.push(jBS)
        }
        finalList.push(val)
        if (joinColAfterCheck.checked && joinColAfterString.value.length > 0) {
            let jAS = joinColAfterString.value
            jAS = jAS.replace("{num}", count)
            finalList.push(jAS)
        }
        count = count + (document.getElementById("serialInc").value - 0)
    }
    // console.log(finalList)
    for (val of finalList) {
        finalStrings = finalStrings + val + "\n"
    }
    stringOutput.value = finalStrings
    letterCount()
}


const letterCount = () => {
    let inpLC = ""
    let outpLC = ""
    let inpL = stringInput.value.split("\n")
    for (let val of inpL) {
        inpLC = inpLC + val
    }
    inpLC = inpLC.length
    let outpL = stringOutput.value.split("\n")
    for (let val of outpL) {
        outpLC = outpLC + val
    }
    outpLC = outpLC.length

    let inpCC = "";
    let outpCC = "";
    let inpC = stringInput.value.split("\n")
    let outpC = stringOutput.value.split("\n")
    inpCC = inpC.length
    outpCC = outpC.length
}

const test = () => {
    let anal = 1
    if (anal === 1) {
        console.log("1")
        anal = 2
    }; if (anal != 1) {
        console.log("2")
    }
}