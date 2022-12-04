//変数を指定
let chHolder = document.getElementById("crosshair1");
let hide1 = document.getElementById("sbHolder");
let hide2 = document.getElementById("title");
let hide3 = document.getElementById("settingBox");

let ch1 = document.getElementById("chHold1");
let ch2 = document.getElementById("chHold2");
let ch3 = document.getElementById("chHold3");
let ch4 = document.getElementById("chHold4");
let ch5 = document.getElementById("chHold5");

cBoxVal = localStorage.getItem("checkBoxSaved");

const inst = localStorage.getItem('inst');
if(!inst){
  alert("Join our discord to get updates and support!");
  window.open('https://discord.gg/qusjZSbXQX');
  localStorage.setItem('inst','true')
}

//表示非表示チェックボックス
function checkBox() {
  const checkbox = document.getElementById("vCheckBox");
  let checktf = checkbox.checked;
  if (checktf) {
    localStorage.setItem("checkBoxSaved", "true");
    hide1.setAttribute("class", "");
    hide2.setAttribute("class", "");
    hide3.setAttribute("class", "");
  } else if (!checktf) {
    localStorage.setItem("checkBoxSaved", "false");
    hide1.setAttribute("class", "hiddenClass");
    hide2.setAttribute("class", "hiddenClass");
    hide3.setAttribute("class", "hiddenClassSetting");
  }
}

//設定ボックスの表示・非表示を切り替える

vcheck = document.getElementById("vCheckBox");
let loadChecker = setInterval(findElm2, 10);
let retry = 0;
function findElm2() {
  retry++;
  const tarElm1 = document.getElementsByClassName("logoHolder");
  if (tarElm1.length > 0) {
    window.onload = cbLoaded();
    clearInterval(loadChecker);
  } else if (retry >= 1000) {
    clearInterval(loadChecker);
  }
}

function cbLoaded() {
  if (cBoxVal === "true") {
    vcheck.checked = true;
    hide1.setAttribute("class", "");
    hide2.setAttribute("class", "");
    hide3.setAttribute("class", "");
  } else if (cBoxVal === "false") {
    vcheck.checked = false;
    hide1.setAttribute("class", "hiddenClass");
    hide2.setAttribute("class", "hiddenClass");
    hide3.setAttribute("class", "hiddenClassSetting");
  }
}

//画像のスタイルの切り替え
function chStyle() {
  const chStyleVal = document.getElementById("chStyle").value;
  localStorage.setItem("crosshairStyleSaved", chStyleVal);
}

//width slider
window.onload = imgWSet();
//スライダー側
function imgWSet() {
  const widthVal = document.getElementById("chWidth").value;
  document.getElementById("widthVal").value = widthVal;
  ccImageWidth = document.getElementById("chWidth").value;
  chHolder.setAttribute("width", widthVal + "px");
  localStorage.setItem("crosshairWidthSaved", widthVal);
}
//numberのinput側
function imgWSet1() {
  const widthVal = document.getElementById("widthVal").value;
  chHolder.setAttribute("width", widthVal + "px");
  document.getElementById("chWidth").value = widthVal;
}

//height slider
window.onload = imgHSet();
//スライダー側
function imgHSet() {
  const heightVal = document.getElementById("chHeight").value;
  document.getElementById("heightVal").value = heightVal;
  ccImageHeight = document.getElementById("chHeight").value;
  chHolder.setAttribute("height", heightVal + "px");
  localStorage.setItem("crosshairHeightSaved", heightVal);
}
//numberのinput側
function imgHSet1() {
  const heightVal = document.getElementById("heightVal").value;
  chHolder.setAttribute("height", heightVal + "px");
  //スライダーのvalueを変更
  document.getElementById("chHeight").value = heightVal;
}

//URLを設定
function imgUrlSet() {
  const imageUrl = document.getElementById("urlBox").value;
  chHolder.setAttribute("src", imageUrl);
  localStorage.setItem("crosshairUrlSaved", imageUrl);
}

//auto default size
function defaultSize() {
  const crosshairImage = document.getElementById("crosshair1");
  //画像サイズの取得
  let imgWidth = crosshairImage.naturalWidth;
  let imgHeight = crosshairImage.naturalHeight;
  //画像サイズ
  chHolder.setAttribute("width", imgWidth + "px");
  chHolder.setAttribute("height", imgHeight + "px");
  //pxの表示
  document.getElementById("widthVal").value = imgWidth;
  document.getElementById("heightVal").value = imgHeight;
  //localstorageに格納
  localStorage.setItem("crosshairWidthSaved", imgWidth);
  localStorage.setItem("crosshairHeightSaved", imgHeight);
  //スライダーのvalueを変更
  document.getElementById("chWidth").value = imgWidth;
  document.getElementById("chHeight").value = imgHeight;
}

//ロゴを設定する
window.onload = logoOnLoad();
function logoOnLoad() {
  const urlVal = document.getElementById("logoUrlInput");
  const textlVal = document.getElementById("logoTextInput");
  let logoTextVal = localStorage.getItem("logoTextSaved");
  let logoUrlVal = localStorage.getItem("logoUrlSaved");
  urlVal.value = logoUrlVal;
  textlVal.value = logoTextVal;
}

//ロゴの要素が追加されるまで監視する
//オプション
const options = {
  childList: true, //直接の子の変更を監視
  characterData: true, //文字の変化を監視
  characterDataOldValue: true, //属性の変化前を記録
  attributes: true, //属性の変化を監視
  subtree: true, //全ての子要素を監視
};
//コールバック関数
function callback(mutationsList, observer) {
  for (const mutation of mutationsList) {
    const tags = mutation.target;
    for (const node of tags.querySelectorAll("img")) {
      if (node.getAttribute("class") === "sc-iaUyqC hrxbol") {
        obs.disconnect();
        let logoTextVal = localStorage.getItem("logoTextSaved");
        let logoUrlVal = localStorage.getItem("logoUrlSaved");
        const logoText = document.getElementsByClassName("yYlig")[0];
        logoText.textContent = logoTextVal;
        const logo = document.getElementsByClassName("hrxbol")[0];
        logo.setAttribute("src", logoUrlVal);
      }
    }
  }
}
//ターゲット要素をDOMで取得
const target = document.getElementById("app");
//インスタンス化
const obs = new MutationObserver(callback);
//ターゲット要素の監視を開始
obs.observe(target, options);

//背景の画像・色の読み込み時の切り替え
bgStyle = localStorage.getItem("bgStyleSaved");
if (bgStyle == "image") {
  const imageInput = document.getElementById("bgUrlLabel");
  const colorInput = document.getElementById("bgColorHolder");
  imageInput.setAttribute("class", "");
  colorInput.setAttribute("class", "hiddenClass");
} else if (bgStyle == "color") {
  const imageInput = document.getElementById("bgUrlLabel");
  const colorInput = document.getElementById("bgColorHolder");
  imageInput.setAttribute("class", "hiddenClass");
  colorInput.setAttribute("class", "");
}

//Logo urlが入力された
function logoUrlSet() {
  const logo = document.getElementsByClassName("hrxbol")[0];
  const logoUrlInput = document.getElementById("logoUrlInput").value;
  if (logoUrlInput.length < 1) {
    localStorage.setItem(
      "logoUrlSaved",
      "https://voxiom.io/package/ea55824826de52b7ccc3.png"
    );
    document.getElementById("logoUrlInput").value =
      localStorage.getItem("logoUrlSaved");
  } else {
    logo.setAttribute("src", logoUrlInput);
    localStorage.setItem("logoUrlSaved", logoUrlInput);
  }
}

//ロゴの下の文字が入力された時の処理
function logoTextSet() {
  const logoTextInput = document.getElementById("logoTextInput").value;
  const logoText = document.getElementsByClassName("yYlig")[0];
  logoText.textContent = logoTextInput;
  localStorage.setItem("logoTextSaved", logoTextInput);
}

//画像と色のどちらかを選択する
function bgSelector() {
  const imageInput = document.getElementById("bgUrlLabel");
  const colorInput = document.getElementById("bgColorHolder");
  const selector = document.getElementById("bgSelect").value;
  if (selector == "image") {
    imageInput.setAttribute("class", "");
    colorInput.setAttribute("class", "hiddenClass");
    localStorage.setItem("bgStyleSaved", selector);
    bgUrlSet();
  } else if (selector == "color") {
    imageInput.setAttribute("class", "hiddenClass");
    colorInput.setAttribute("class", "");
    localStorage.setItem("bgStyleSaved", selector);
    let colorDeg = localStorage.getItem("colorDegSaved");
    let color1 = localStorage.getItem("color1Saved");
    let color2 = localStorage.getItem("color2Saved");
    let color3 = localStorage.getItem("color3Saved");
    bgColorVal =
      "linear-gradient(" +
      colorDeg +
      "deg ," +
      color1 +
      "," +
      color2 +
      "," +
      color3 +
      ")";
    document.documentElement.style.setProperty("--bgUrl", bgColorVal);
  } else {
  }
}
// 画像の設定
function bgUrlSet() {
  bg = document.getElementsByClassName("bNczYf")[0];
  bgUrl = document.getElementById("bgUrlInput").value;
  if (bgUrl.length < 1) {
    document.documentElement.style.setProperty(
      "--bgUrl",
      "url(https://voxiom.io/package/c30b27cd3f6c8d9bb236.jpg)"
    );
    localStorage.setItem(
      "bgUrlSaved",
      "https://voxiom.io/package/c30b27cd3f6c8d9bb236.jpg"
    );
    document.getElementById("bgUrlInput").value =
      localStorage.getItem("bgUrlSaved");
  } else {
    document.documentElement.style.setProperty("--bgUrl", "url(" + bgUrl + ")");
    localStorage.setItem("bgUrlSaved", bgUrl);
  }
}

function colorDeg() {
  let colorDeg = localStorage.getItem("colorDegSaved");
  let color1 = localStorage.getItem("color1Saved");
  let color2 = localStorage.getItem("color2Saved");
  let color3 = localStorage.getItem("color3Saved");
  const colorDegInput = document.getElementById("colorDeg");
  colorDeg = colorDegInput.value;
  document.getElementById("colorDegVal").value = colorDeg;
  localStorage.setItem("colorDegSaved", colorDeg);
  bgColorVal =
    "linear-gradient(" +
    colorDeg +
    "deg ," +
    color1 +
    "," +
    color2 +
    "," +
    color3 +
    ")";
  document.documentElement.style.setProperty("--bgUrl", bgColorVal);
}

function colorDeg1() {
  let colorDeg = localStorage.getItem("colorDegSaved");
  let color1 = localStorage.getItem("color1Saved");
  let color2 = localStorage.getItem("color2Saved");
  let color3 = localStorage.getItem("color3Saved");
  const colorDegVal = document.getElementById("colorDegVal").value;
  colorDeg = colorDegVal;
  document.getElementById("colorDeg").value = colorDeg;
  localStorage.setItem("colorDegSaved", colorDeg);
  bgColorVal =
    "linear-gradient(" +
    colorDeg +
    "deg ," +
    color1 +
    "," +
    color2 +
    "," +
    color3 +
    ")";
  document.documentElement.style.setProperty("--bgUrl", bgColorVal);
}

function colorPick1() {
  let colorDeg = localStorage.getItem("colorDegSaved");
  let color1 = localStorage.getItem("color1Saved");
  let color2 = localStorage.getItem("color2Saved");
  let color3 = localStorage.getItem("color3Saved");
  const colorInput = document.getElementById("colorInput1");
  color1 = colorInput.value;
  localStorage.setItem("color1Saved", color1);
  bgColorVal =
    "linear-gradient(" +
    colorDeg +
    "deg ," +
    color1 +
    "," +
    color2 +
    "," +
    color3 +
    ")";
  document.documentElement.style.setProperty("--bgUrl", bgColorVal);
}
function colorPick2() {
  let colorDeg = localStorage.getItem("colorDegSaved");
  let color1 = localStorage.getItem("color1Saved");
  let color2 = localStorage.getItem("color2Saved");
  let color3 = localStorage.getItem("color3Saved");
  const colorInput = document.getElementById("colorInput2");
  color2 = colorInput.value;
  localStorage.setItem("color2Saved", color2);
  bgColorVal =
    "linear-gradient(" +
    colorDeg +
    "deg ," +
    color1 +
    "," +
    color2 +
    "," +
    color3 +
    ")";
  document.documentElement.style.setProperty("--bgUrl", bgColorVal);
}
function colorPick3() {
  let colorDeg = localStorage.getItem("colorDegSaved");
  let color1 = localStorage.getItem("color1Saved");
  let color2 = localStorage.getItem("color2Saved");
  let color3 = localStorage.getItem("color3Saved");
  const colorInput = document.getElementById("colorInput3");
  color3 = colorInput.value;
  localStorage.setItem("color3Saved", color3);
  bgColorVal =
    "linear-gradient(" +
    colorDeg +
    "deg ," +
    color1 +
    "," +
    color2 +
    "," +
    color3 +
    ")";
  document.documentElement.style.setProperty("--bgUrl", bgColorVal);
}

//cssローダー
function cssInput() {
  const cssValue = document.getElementById("cssInput").value;
  localStorage.setItem("cssValSaved", cssValue);
  const styleHold = document.getElementById("styleHold");
  styleHold.textContent = cssValue;
}
