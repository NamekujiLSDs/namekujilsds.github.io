console.log("LOAD TEST")


const owner = 'NamekujiLSDs'; // GitHubのユーザー名または組織名
const repo = 'VancedVoxiomClient'; // リポジトリ名

fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`)
    .then(response => response.json())
    .then(data => {
        const tag = data.tag_name; // 最新のリリースタグ名
        const dlLink = data.assets[1].browser_download_url; // ダウンロードリンク

        // ダウンロードリンクをHTMLに反映させる
        const dlBtn = document.getElementById("downloadBtn")
        dlBtn.setAttribute("href", dlLink)
        dlBtn.textContent = `Download VVC ${tag}!`
    })
    .catch(error => console.error('Error fetching latest release', error));