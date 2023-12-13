console.log("LOAD TEST")
console.log("LOAD TEST")
let releases = ""
let ver = ""
async function releaseCheck() {
    let url = "https://github.com/NamekujiLSDs/VancedVoxiomClient/refs?type=tag";
    let response = await fetch(url, {
        method: "GET",
        mode: "cors"
    });
    releases = await response.json();
    console.log(releases.refs[0])
    ver = releases.refs[0]
    version()
}

const version = () => {

}
document.addEventListener('DOMContentLoaded', releaseCheck())
