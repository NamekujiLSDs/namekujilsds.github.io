console.log("LOAD TEST")


const owner = 'NamekujiLSDs'; // GitHubのユーザー名または組織名
const repo = 'VoxMate'; // リポジトリ名
let download
fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`)
    .then(response => response.json())
    .then(data => {
        console.log(data.assets[1].browser_download_url)
        const version = data.tag_name.split('v')[1];
        document.getElementById("versionDisplay").innerText = "v" + version;
        document.getElementById("ver").innerText = version;

        let url = `https://github.com/NamekujiLSDs/VoxMate/releases/download/v${version}/VoxMate-Client-Setup-${version}.exe`
        download = url
    })
    .catch(error => console.error('Error fetching latest release', error));

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));//timeはミリ秒

const dls = async () => {
    document.getElementById("downloadButton").setAttribute("style", "display: none;");
    let downloadLink = document.createElement('a');
    downloadLink.href = download;
    downloadLink.download = 'VoxMate-Client-Setup.exe';
    document.getElementById("downloadStart").innerHTML = `Downloading starts within 3 seconds. 
    <br> If it does not start, please go to the <a href="https://github.com/NamekujiLSDs/VoxMate/releases/latest"> latest release </a> and download it!`
    await sleep(1000)
    document.getElementById("downloadStart").innerHTML = `Downloading starts within 2 seconds. 
    <br> If it does not start, please go to the <a href="https://github.com/NamekujiLSDs/VoxMate/releases/latest"> latest release </a> and download it!`
    await sleep(1000)
    document.getElementById("downloadStart").innerHTML = `Downloading starts within 1 seconds. 
    <br> If it does not start, please go to the <a href="https://github.com/NamekujiLSDs/VoxMate/releases/latest"> latest release </a> and download it!`
    await sleep(1000)
    await downloadLink.click();
    document.getElementById("downloadStart").innerHTML = `Downloading starts within 0 seconds. 
    <br> If it does not start, please go to the <a href="https://github.com/NamekujiLSDs/VoxMate/releases/latest"> latest release </a> and download it!`
}