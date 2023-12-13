console.log("LOAD TEST")


const owner = 'NamekujiLSDs'; // GitHubのユーザー名または組織名
const repo = 'VancedVoxiomClient'; // リポジトリ名

fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`)
    .then(response => response.json())
    .then(data => {
        const latestRelease = data.tag_name; // 最新のリリースタグ名
        const downloadLink = data.assets[0].browser_download_url; // ダウンロードリンク

        // ダウンロードリンクをHTMLに反映させる
        console.log(latestRelease)
        console.log(downloadLink)
    })
    .catch(error => console.error('Error fetching latest release', error));