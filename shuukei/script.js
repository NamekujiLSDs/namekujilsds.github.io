const generateDoms = () => {
    let rounds = [1, 2, 3, 4]
    let matches = [1, 2, 3, 4, 5]
    for (rNum of rounds) {
        for (mNum of matches) {
            console.log(rNum, mNum)
            let dom = `
            <div class="box ${rNum}-${mNum}">
                <select name="${rNum}-${mNum}-1" id="${rNum}-${mNum}-1" class="select-t1" oninput="save(this)">
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="F">F</option>
                    <option value="G">G</option>
                    <option value="H">H</option>
                    <option value="I">I</option>
                    <option value="J">J</option>
                </select>
                <p class="vs">vs</p>
                <select name="${rNum}-${mNum}-2" id="${rNum}-${mNum}-2" class="select-t2" oninput="save(this)" >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="F">F</option>
                    <option value="G">G</option>
                    <option value="H">H</option>
                    <option value="I">I</option>
                    <option value="J">J</option>
                </select>
                <input type="number" name="${rNum}-${mNum}-1-Score" id="${rNum}-${mNum}-1-Score" class="t1Num" min="0" oninput="save(this)"value="${localStorage.getItem(rNum + "-" + mNum + "-1-Score") ? localStorage.getItem(rNum + "-" + mNum + "-1-Score") : 0}">
                <p class="negative">-</p>
                <input type="number" name="${rNum}-${mNum}-2-Score" id="${rNum}-${mNum}-2-Score" class="t2Num" min="0" oninput="save(this)"value="${localStorage.getItem(rNum + "-" + mNum + "-2-Score") ? localStorage.getItem(rNum + "-" + mNum + "-2-Score") : 0}">
            </div>`
            document.getElementById("match_" + rNum).insertAdjacentHTML("beforeend", dom)
            document.getElementById(rNum + "-" + mNum + "-1").value = localStorage.getItem(rNum + "-" + mNum + "-1") ? localStorage.getItem(rNum + "-" + mNum + "-1") : "A";
            document.getElementById(rNum + "-" + mNum + "-2").value = localStorage.getItem(rNum + "-" + mNum + "-2") ? localStorage.getItem(rNum + "-" + mNum + "-2") : "A";
        }
    }
}


const save = v => {
    localStorage.setItem(v.id, v.value);
    ranking()
}


const ranking = () => {
    let rounds = [1, 2, 3, 4]
    let matches = [1, 2, 3, 4, 5]
    // teamX = [WIN,LOSE, DIFF]
    let teamA = [0, 0, 0, "A"];
    let teamB = [0, 0, 0, "B"];
    let teamC = [0, 0, 0, "C"];
    let teamD = [0, 0, 0, "D"];
    let teamE = [0, 0, 0, "E"];
    let teamF = [0, 0, 0, "F"];
    let teamG = [0, 0, 0, "G"];
    let teamH = [0, 0, 0, "H"];
    let teamI = [0, 0, 0, "I"];
    let teamJ = [0, 0, 0, "J"];
    let teams = [teamA, teamB, teamC, teamD, teamE, teamF, teamG, teamH, teamI, teamJ]
    document.getElementById("ranking").innerHTML = ""

    for (rNum of rounds) {
        for (mNum of matches) {
            if (document.getElementById(`${rNum}-${mNum}-2-Score`).value - 0 > document.getElementById(`${rNum}-${mNum}-1-Score`).value - 0) {
                console.log("2>1 Value 1 =", document.getElementById(`${rNum}-${mNum}-1-Score`).value)
                console.log("2>1 Value 2 =", document.getElementById(`${rNum}-${mNum}-2-Score`).value)
                console.log(document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value)
                switch (document.getElementById(`${rNum}-${mNum}-2`).value) {
                    case "A":
                        teamA[0] += 1
                        teamA[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "B":
                        teamB[0] += 1
                        teamB[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "C":
                        teamC[0] += 1
                        teamC[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "D":
                        teamD[0] += 1
                        teamD[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "E":
                        teamE[0] += 1
                        teamE[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "F":
                        teamF[0] += 1
                        teamF[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "G":
                        teamG[0] += 1
                        teamG[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "H":
                        teamH[0] += 1
                        teamH[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "I":
                        teamI[0] += 1
                        teamI[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "J":
                        teamJ[0] += 1
                        teamJ[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                }
                switch (document.getElementById(`${rNum}-${mNum}-1`).value) {
                    case "A":
                        teamA[1] += 1
                        teamA[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "B":
                        teamB[1] += 1
                        teamB[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "C":
                        teamC[1] += 1
                        teamC[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "D":
                        teamD[1] += 1
                        teamD[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "E":
                        teamE[1] += 1
                        teamE[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "F":
                        teamF[1] += 1
                        teamF[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "G":
                        teamG[1] += 1
                        teamG[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "H":
                        teamH[1] += 1
                        teamH[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "I":
                        teamI[1] += 1
                        teamI[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "J":
                        teamJ[1] += 1
                        teamJ[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                }
            } else if (document.getElementById(`${rNum}-${mNum}-1-Score`).value - 0 > document.getElementById(`${rNum}-${mNum}-2-Score`).value - 0) {
                console.log("1>2 Value 1 =", document.getElementById(`${rNum}-${mNum}-1-Score`).value)
                console.log("1>2 Value 2 =", document.getElementById(`${rNum}-${mNum}-2-Score`).value)
                console.log(document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value)
                console.log(document.getElementById(`${rNum}-${mNum}-1`).value)
                switch (document.getElementById(`${rNum}-${mNum}-1`).value) {
                    case "A":
                        teamA[0] += 1
                        teamA[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "B":
                        teamB[0] += 1
                        teamB[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "C":
                        teamC[0] += 1
                        teamC[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "D":
                        teamD[0] += 1
                        teamD[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "E":
                        teamE[0] += 1
                        teamE[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "F":
                        teamF[0] += 1
                        teamF[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "G":
                        teamG[0] += 1
                        teamG[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "H":
                        teamH[0] += 1
                        teamH[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "I":
                        teamI[0] += 1
                        teamI[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                    case "J":
                        teamJ[0] += 1
                        teamJ[2] += document.getElementById(`${rNum}-${mNum}-1-Score`).value - document.getElementById(`${rNum}-${mNum}-2-Score`).value
                        break
                }
                switch (document.getElementById(`${rNum}-${mNum}-2`).value) {
                    case "A":
                        teamA[1] += 1
                        teamA[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "B":
                        teamB[1] += 1
                        teamB[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "C":
                        teamC[1] += 1
                        teamC[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "D":
                        teamD[1] += 1
                        teamD[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "E":
                        teamE[1] += 1
                        teamE[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "F":
                        teamF[1] += 1
                        teamF[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "G":
                        teamG[1] += 1
                        teamG[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "H":
                        teamH[1] += 1
                        teamH[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "I":
                        teamI[1] += 1
                        teamI[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                    case "J":
                        teamJ[1] += 1
                        teamJ[2] += document.getElementById(`${rNum}-${mNum}-2-Score`).value - document.getElementById(`${rNum}-${mNum}-1-Score`).value
                        break
                }
            } else if (document.getElementById(`${rNum}-${mNum}-1-Score`).value - 0 === document.getElementById(`${rNum}-${mNum}-2-Score`).value - 0) {
                console.log("unti buri-")
            }
        }
    }
    for (val of teams) {
        console.log(val)
        let dom = `<tr>
            <th>${val[3]}</th>
            <td>${val[0]}</td>
            <td>${val[2]}</td>
        </tr>`
        document.getElementById("ranking").insertAdjacentHTML("beforeend", dom)
    }

}

const clearRanking = v => {
    document.getElementById("ranking").innerHTML = ""
}
document.addEventListener("DOMContentLoaded", () => {
    generateDoms()
})