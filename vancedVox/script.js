// bodyと#appを取得
const gameBody = document.body;
const appBody = document.getElementById("app");

//要素の定義
let ccImageWidth;
let ccImageHeight;
let ccImageUrl;

//ローカルストレージへの初期設定
//クロスヘアのスタイル
let chStyle = localStorage.getItem("crosshairStyleSaved");
if (!chStyle) {
  localStorage.setItem("crosshairStyleSaved", "image");
}

//クロスヘアの幅
let chWidthVal = localStorage.getItem("crosshairWidthSaved");
if (!chWidthVal) {
  localStorage.setItem("crosshairWidthSaved", "32");
}
console.log(chWidthVal + " crosshair width");

//クロスヘアの高さをローカルストレージに
let chHeightVal = localStorage.getItem("crosshairHeightSaved");
if (!chHeightVal) {
  localStorage.setItem("crosshairHeightSaved", "32");
}
console.log(chHeightVal + " crosshair height");

//クロスヘアのurlを初期設定
let chUrlVal = localStorage.getItem("crosshairUrlSaved");
if (!chUrlVal) {
  localStorage.setItem(
    "crosshairUrlSaved",
    "https://cdn.discordapp.com/attachments/616206938048561152/922367836574335036/New_Piskel_49.png"
  );
}
chUrlVal = localStorage.getItem("crosshairUrlSaved");
console.log(chUrlVal + " crosshair Url");

//ロゴの初期値を設定
let logoUrlVal = localStorage.getItem("logoUrlSaved");
if (!logoUrlVal) {
  console.log("logo not rdy");
  localStorage.setItem(
    "logoUrlSaved",
    "https://voxiom.io/package/ea55824826de52b7ccc3.png"
  );
}
logoUrlVal = localStorage.getItem("logoUrlSaved");
console.log(logoUrlVal + "/ logo url");

//ロゴの文字の初期値を設定
let logoTextVal = localStorage.getItem("logoTextSaved");
if (!logoTextVal) {
  console.log("logo text is none");
  localStorage.setItem("logoTextSaved", "Open Alpha Testing - Pre-Season");
}
logoTextVal = localStorage.getItem("logoTextSaved");
console.log(logoTextVal + " / logo text");

//背景の色を設定
let bgColorVal = localStorage.getItem("bgColorSaved");
let colorDeg = localStorage.getItem("colorDegSaved");
let color1 = localStorage.getItem("color1Saved");
let color2 = localStorage.getItem("color2Saved");
let color3 = localStorage.getItem("color3Saved");
if (!colorDeg) {
  colorDeg = "180";
  localStorage.setItem("colorDegSaved", colorDeg);
}
if (!color1) {
  color1 = "#3f87a6";
  localStorage.setItem("color1Saved", color1);
}
if (!color2) {
  color2 = "#ebf8e1";
  localStorage.setItem("color2Saved", color2);
}
if (!color3) {
  color3 = "#f69d3c";
  localStorage.setItem("color3Saved", color3);
}
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

//背景の画像のurlを設定
let bgUrlVal = localStorage.getItem("bgUrlSaved");
if (!bgUrlVal) {
  localStorage.setItem(
    "bgUrlSaved",
    "https://voxiom.io/package/c30b27cd3f6c8d9bb236.jpg"
  );
}
bgUrlVal = localStorage.getItem("bgUrlSaved");
console.log(bgUrlVal + " / bg Url");

//背景のスタイル
let bgStyle = localStorage.getItem("bgStyleSaved");
if (!bgStyle) {
  localStorage.setItem("bgStyleSaved", "image");
} else if (bgStyle == "image") {
  console.log("image style");
  document.documentElement.style.setProperty(
    "--bgUrl",
    "url(" + bgUrlVal + ")"
  );
} else if (bgStyle == "color") {
  console.log("color style");
  document.documentElement.style.setProperty("--bgUrl", bgColorVal);
}

//表示非表示チェックボックスの初期設定およびうんたらかんたら
let cBoxVal = localStorage.getItem("checkBoxSaved");
console.log(cBoxVal + " cBoxVal");
console.log(localStorage.getItem("checkBoxSaved") + " visible");

if (cBoxVal == null) {
  console.log(cBoxVal + " / null");
  localStorage.setItem("checkBoxSaved", "true");
} else if (cBoxVal === "true") {
  console.log(cBoxVal + " / true");
} else if (cBoxVal === "false") {
  console.log(cBoxVal + " / false");
} else {
  console.log("hoge");
}
cBoxVal = localStorage.getItem("checkBoxSaved");
console.log(cBoxVal + " visible");

//cssVal
const cssValue = localStorage.getItem("cssValSaved");

//settingBox
const settingBoxCreate = document.createElement("div"); //<div id='settingBox'></div>を作成する
settingBoxCreate.setAttribute("id", "settingBox"); //idをsettingBoxにする
gameBody.appendChild(settingBoxCreate); //bodyの一番下に挿入
const settingBox = document.getElementById("settingBox"); //<div id='settingBox'>をsettingBoxに入れる

//titleHolder
const titleHCreate = document.createElement("div");
titleHCreate.setAttribute("id", "titleHolder");
settingBox.appendChild(titleHCreate);
const titleHolder = document.getElementById("titleHolder");
const titleCreate = document.createElement("h2");
titleCreate.setAttribute("id", "title");
titleCreate.textContent = "VancedVoxiom";
titleHolder.appendChild(titleCreate);

//Show <-> Hide checkbox
const cBoxLabelCreate = document.createElement("label"); //input+abelを作成
cBoxLabelCreate.setAttribute("id", "cBoxLabel");
cBoxLabelCreate.setAttribute("value", "vCBox");
titleHolder.appendChild(cBoxLabelCreate);
const cBoxLabel = document.getElementById("cBoxLabel");

const checkBoxCreate = document.createElement("input"); //inputを作成
checkBoxCreate.setAttribute("id", "vCheckBox"); //idをvCheckBoxに
checkBoxCreate.setAttribute("onChange", "checkBox()");
checkBoxCreate.setAttribute("type", "checkbox");
checkBoxCreate.setAttribute("value", "vCBox");
cBoxLabel.appendChild(checkBoxCreate); //settingBoxにadd
let vcheck = document.getElementById("vCheckBox");
const cBoxSpan = document.createElement("span");
cBoxSpan.setAttribute("id", "cBoxDeco");
cBoxLabel.appendChild(cBoxSpan);

//settingBoxの中を一括で消せるようにするためのホルダーを作成
const sbHolderCreate = document.createElement("div");
sbHolderCreate.setAttribute("id", "sbHolder");
settingBox.appendChild(sbHolderCreate);
const sbHolder = document.getElementById("sbHolder");

//crosshairSettingBoxHolder
const crosshairBoxCreate = document.createElement("div");
crosshairBoxCreate.setAttribute("id", "crosshairSettingBox");
sbHolder.appendChild(crosshairBoxCreate);
const crosshairSettingBox = document.getElementById("crosshairSettingBox");

//title
const crosshairHolderTitleCreate = document.createElement("h3");
crosshairHolderTitleCreate.setAttribute("class", "fncTitle");
crosshairHolderTitleCreate.textContent = "- Crosshair -";
crosshairSettingBox.appendChild(crosshairHolderTitleCreate);

//CrosshairStyle
const chStyleCreate = document.createElement("select");
chStyleCreate.setAttribute("id", "chStyle");
chStyleCreate.setAttribute("oninput", "chStyle()");
crosshairSettingBox.appendChild(chStyleCreate);
const chSelect = document.getElementById("chStyle");
//画像の時
const chSelectOpt1 = document.createElement("option");
chSelectOpt1.setAttribute("value", "image");
chSelectOpt1.textContent = "Image";
if (chStyle == "image") {
  chSelectOpt1.setAttribute("selected", "");
}
chSelect.appendChild(chSelectOpt1);
//Tスタイル
const chSelectOpt2 = document.createElement("option");
chSelectOpt2.setAttribute("value", "tstyle");
chSelectOpt2.textContent = "T-style";
if (chStyle == "tstyle") {
  chSelectOpt2.setAttribute("selected", "");
}
chSelect.appendChild(chSelectOpt2);
//十字の時
const chSelectOpt3 = document.createElement("option");
chSelectOpt3.setAttribute("value", "cross");
chSelectOpt3.textContent = "Cross";
if (chStyle == "cross") {
  chSelectOpt3.setAttribute("selected", "");
}
chSelect.appendChild(chSelectOpt3);
//丸の時
const chSelectOpt4 = document.createElement("option");
chSelectOpt4.setAttribute("value", "circle");
chSelectOpt4.textContent = "Circle";
if (chStyle == "circle") {
  chSelectOpt4.setAttribute("selected", "");
}
chSelect.appendChild(chSelectOpt4);
//ドットの時
const chSelectOpt5 = document.createElement("option");
chSelectOpt5.setAttribute("value", "dot");
chSelectOpt5.textContent = "Dot";
if (chStyle == "dot") {
  chSelectOpt5.setAttribute("selected", "");
}
chSelect.appendChild(chSelectOpt5);

//クロスヘア設定ホルダを5つ準備する

const chHolder1Create = document.createElement("div");
chHolder1Create.setAttribute("id", "chHold1");
crosshairSettingBox.appendChild(chHolder1Create);
const chHolder1 = document.getElementById("chHold1");

//TEXT [URL]
const urlInputLabelCreate = document.createElement("label");
urlInputLabelCreate.setAttribute("id", "urlLabel");
urlInputLabelCreate.textContent = "URL";
chHolder1.appendChild(urlInputLabelCreate);
const urlLabel = document.getElementById("urlLabel");

//URL INPUT BOX
const urlInputCreate = document.createElement("input");
urlInputCreate.setAttribute("id", "urlBox");
urlInputCreate.setAttribute("type", "text");
urlInputCreate.setAttribute("class", "inputText");
urlInputCreate.setAttribute("oninput", "imgUrlSet()");
urlLabel.appendChild(urlInputCreate);
document.getElementById("urlBox").value =
  localStorage.getItem("crosshairUrlSaved");

//Width slider
//widthのホルダー
chWidthVal = localStorage.getItem("crosshairWidthSave");
const widthHolderCreate = document.createElement("div");
widthHolderCreate.setAttribute("id", "widthHolder");
chHolder1.appendChild(widthHolderCreate);
const widthHolder = document.getElementById("widthHolder");
//widthという文字を表示
const widthTextShowCreate = document.createElement("p");
widthTextShowCreate.textContent = "W";
widthHolder.appendChild(widthTextShowCreate);
//これスライダー
const widthSlideCreate = document.createElement("input");
widthSlideCreate.setAttribute("id", "chWidth");
widthSlideCreate.setAttribute("max", "1000");
widthSlideCreate.setAttribute("type", "range");
widthSlideCreate.setAttribute("onInput", "imgWSet()");
widthSlideCreate.defaultValue = localStorage.getItem("crosshairWidthSaved");
widthHolder.appendChild(widthSlideCreate);
//数値表示
const widthValSpanCreate = document.createElement("input");
widthValSpanCreate.setAttribute("id", "widthVal");
widthValSpanCreate.setAttribute("type", "number");
widthValSpanCreate.setAttribute("onInput", "imgWSet1()");
widthHolder.appendChild(widthValSpanCreate);

//Height Slider
//heightのホルダー
const heightHolderCreate = document.createElement("div");
heightHolderCreate.setAttribute("id", "heightHolder");
chHolder1.appendChild(heightHolderCreate);
const heightHolder = document.getElementById("heightHolder");
//heightという文字を表示
const heightTextShowCreate = document.createElement("p");
heightTextShowCreate.textContent = "H";
heightHolder.appendChild(heightTextShowCreate);
//これスライダー
const heightSlideCreate = document.createElement("input");
heightSlideCreate.setAttribute("max", "1000");
heightSlideCreate.setAttribute("id", "chHeight");
heightSlideCreate.setAttribute("type", "range");
heightSlideCreate.setAttribute("onInput", "imgHSet()");
heightSlideCreate.defaultValue = localStorage.getItem("crosshairHeightSaved");
heightHolder.appendChild(heightSlideCreate);
//数値の表示
const heightValSpanCreate = document.createElement("input");
heightValSpanCreate.setAttribute("id", "heightVal");
heightValSpanCreate.setAttribute("type", "number");
heightValSpanCreate.setAttribute("oninput", "imgHSet1()");
heightHolder.appendChild(heightValSpanCreate);

//自動で元のサイズにする
const defaultSizeButtonCreate = document.createElement("input");
defaultSizeButtonCreate.setAttribute("class", "defaultSizeButton");
defaultSizeButtonCreate.setAttribute("type", "button");
defaultSizeButtonCreate.setAttribute("value", "Auto Default Size");
defaultSizeButtonCreate.setAttribute("onclick", "defaultSize()");
chHolder1.appendChild(defaultSizeButtonCreate);

//T-Style用のホルダー
const chHolder2Create = document.createElement("div");
chHolder2Create.setAttribute("id", "chHold2");
crosshairSettingBox.appendChild(chHolder2Create);
const chHolder2 = document.getElementById("chHold2");

//Cross用
const chHolder3Create = document.createElement("div");
chHolder3Create.setAttribute("id", "chHold3");
crosshairSettingBox.appendChild(chHolder3Create);
const chHolder3 = document.getElementById("chHold3");

//Circle用
const chHolder4Create = document.createElement("div");
chHolder4Create.setAttribute("id", "chHold4");
crosshairSettingBox.appendChild(chHolder4Create);
const chHolder4 = document.getElementById("chHold4");

//dot用
const chHolder5Create = document.createElement("div");
chHolder1Create.setAttribute("id", "chHold5");
crosshairSettingBox.appendChild(chHolder5Create);
const chHolder5 = document.getElementById("chHold5");

//spacer
const spacer1 = document.createElement("div");
spacer1.setAttribute("class", "spacer");
crosshairSettingBox.appendChild(spacer1);

//logo holder
const logoHolderCreate = document.createElement("div");
logoHolderCreate.setAttribute("class", "logoHolder");
logoHolderCreate.setAttribute("id", "logoHolder");
sbHolder.appendChild(logoHolderCreate);
const logoHolder = document.getElementById("logoHolder");

//title
const logoHolderTitleCreate = document.createElement("h3");
logoHolderTitleCreate.setAttribute("class", "fncTitle");
logoHolderTitleCreate.textContent = "- Logo changer -";
logoHolder.appendChild(logoHolderTitleCreate);
//Logo url input label
const logoUrlInputLabelCreate = document.createElement("label");
logoUrlInputLabelCreate.setAttribute("id", "logoUrlLabel");
logoUrlInputLabelCreate.textContent = "URL";
logoHolder.appendChild(logoUrlInputLabelCreate);
const logoUrlLabel = document.getElementById("logoUrlLabel");
//Logo url input
const logoUrlInputCreate = document.createElement("input");
logoUrlInputCreate.setAttribute("type", "text");
logoUrlInputCreate.setAttribute("id", "logoUrlInput");
logoUrlInputCreate.setAttribute("oninput", "logoUrlSet()");
logoUrlInputCreate.setAttribute("class", "inputText");
logoUrlInputCreate.textContent = logoUrlVal;
logoUrlLabel.appendChild(logoUrlInputCreate);
document.getElementById("logoUrlInput").value = logoUrlVal;

//Logo txt input label
const logoTextInputLabelCreate = document.createElement("label");
logoTextInputLabelCreate.setAttribute("id", "logoTextLabel");
logoTextInputLabelCreate.textContent = "TEXT";
logoHolder.appendChild(logoTextInputLabelCreate);
const logoTextLabel = document.getElementById("logoTextLabel");
//Logo txt input
const logoTextInputCreate = document.createElement("input");
logoTextInputCreate.setAttribute("type", "text");
logoTextInputCreate.setAttribute("id", "logoTextInput");
logoTextInputCreate.setAttribute("oninput", "logoTextSet()");
logoTextInputCreate.setAttribute("class", "inputText");
logoTextLabel.appendChild(logoTextInputCreate);
document.getElementById("logoTextInput").value = logoTextVal;
//spacer
const spacer2 = document.createElement("div");
spacer2.setAttribute("class", "spacer");
logoHolder.appendChild(spacer2);

//背景変更
//bg change holder
const bgChangeHolderCreate = document.createElement("div");
bgChangeHolderCreate.setAttribute("id", "bgChangeHolder");
sbHolder.appendChild(bgChangeHolderCreate);
const bgChangeHolder = document.getElementById("bgChangeHolder");
//title
const bgChangeHolderTitle = document.createElement("h3");
bgChangeHolderTitle.setAttribute("class", "fncTitle");
bgChangeHolderTitle.textContent = "- Background changer -";
bgChangeHolder.appendChild(bgChangeHolderTitle);
//bg selector
const bgSelectorCreate = document.createElement("select");
bgSelectorCreate.setAttribute("id", "bgSelect");
bgSelectorCreate.setAttribute("oninput", "bgSelector()");
bgChangeHolder.appendChild(bgSelectorCreate);
const bgSelect = document.getElementById("bgSelect");
//プルダウンの中身
const bgSelectOpt1 = document.createElement("option");
bgSelectOpt1.setAttribute("value", "image");
bgSelectOpt1.textContent = "Image";
if (bgStyle == "image") {
  bgSelectOpt1.setAttribute("selected", "");
}
bgSelect.appendChild(bgSelectOpt1);

const bgSelectOpt2 = document.createElement("option");
bgSelectOpt2.setAttribute("value", "color");
bgSelectOpt2.textContent = "Color";
if (bgStyle == "color") {
  bgSelectOpt2.setAttribute("selected", "");
}
bgSelect.appendChild(bgSelectOpt2);

//imageの時のinputを作成
const bgUrlInput = document.createElement("label");
bgUrlInput.setAttribute("id", "bgUrlLabel");
bgUrlInput.textContent = "URL";

bgChangeHolder.appendChild(bgUrlInput);
const bgUrlLabel = document.getElementById("bgUrlLabel");
//Logo url input
const bgUrlInputCreate = document.createElement("input");
bgUrlInputCreate.setAttribute("type", "text");
bgUrlInputCreate.setAttribute("id", "bgUrlInput");
bgUrlInputCreate.setAttribute("oninput", "bgUrlSet()");
bgUrlInputCreate.setAttribute("class", "inputText");
bgUrlLabel.appendChild(bgUrlInputCreate);
document.getElementById("bgUrlInput").value = bgUrlVal;

//color時のinputを作成
const bgColorHolderCreate = document.createElement("div");
bgColorHolderCreate.setAttribute("id", "bgColorHolder");
bgChangeHolder.appendChild(bgColorHolderCreate);
const bgColorHolder = document.getElementById("bgColorHolder");

//角度
const colorDegLabelCreate = document.createElement("label");
colorDegLabelCreate.setAttribute("id", "colorDegLabel");
colorDegLabelCreate.textContent = "Deg";
bgColorHolder.appendChild(colorDegLabelCreate);
const colorDegLabel = document.getElementById("colorDegLabel");
const colorDegInputCreate = document.createElement("input");
colorDegInputCreate.setAttribute("type", "range");
colorDegInputCreate.setAttribute("id", "colorDeg");
colorDegInputCreate.setAttribute("oninput", "colorDeg()");
colorDegInputCreate.setAttribute("max", "360");
colorDegInputCreate.defaultValue = localStorage.getItem("colorDegSaved");
colorDegLabel.appendChild(colorDegInputCreate);
const colorDegInput = document.getElementById("colorDeg");
const colorDegInputTextCreate = document.createElement("input");
colorDegInputTextCreate.setAttribute("id", "colorDegVal");
colorDegInputTextCreate.setAttribute("type", "number");
colorDegInputTextCreate.setAttribute("oninput", "colorDeg1()");
colorDegInputTextCreate.defaultValue = localStorage.getItem("colorDegSaved");
colorDegLabel.appendChild(colorDegInputTextCreate);

//色1
const color1LabelCreate = document.createElement("Label");
color1LabelCreate.textContent = "Color 1";
color1LabelCreate.setAttribute("id", "color1Label");
bgColorHolder.appendChild(color1LabelCreate);
const color1Label = document.getElementById("color1Label");
const color1InputCreate = document.createElement("input");
color1InputCreate.setAttribute("type", "color");
color1InputCreate.setAttribute("id", "colorInput1");
color1InputCreate.setAttribute("oninput", "colorPick1()");
color1InputCreate.setAttribute("value", color1);
color1Label.appendChild(color1InputCreate);

//色2
const color2LabelCreate = document.createElement("Label");
color2LabelCreate.textContent = "Color 2";
color2LabelCreate.setAttribute("id", "color2Label");
bgColorHolder.appendChild(color2LabelCreate);
const color2Label = document.getElementById("color2Label");
const color2InputCreate = document.createElement("input");
color2InputCreate.setAttribute("type", "color");
color2InputCreate.setAttribute("id", "colorInput2");
color2InputCreate.setAttribute("oninput", "colorPick2()");
color2InputCreate.setAttribute("value", color2);
color2Label.appendChild(color2InputCreate);

//色3
const color3LabelCreate = document.createElement("Label");
color3LabelCreate.textContent = "Color 3";
color3LabelCreate.setAttribute("id", "color3Label");
bgColorHolder.appendChild(color3LabelCreate);
const color3Label = document.getElementById("color3Label");
const color3InputCreate = document.createElement("input");
color3InputCreate.setAttribute("type", "color");
color3InputCreate.setAttribute("id", "colorInput3");
color3InputCreate.setAttribute("oninput", "colorPick3()");
color3InputCreate.setAttribute("value", color3);
color3Label.appendChild(color3InputCreate);

// クロスヘア
//画像
const crosshair1Create = document.createElement("img");
crosshair1Create.setAttribute("id", "crosshair1");
crosshair1Create.setAttribute("src", chUrlVal);
appBody.prepend(crosshair1Create);

//T
const crosshair2Create = document.createElement("div");
crosshair2Create.setAttribute("id", "crosshair2");
appBody.prepend(crosshair2Create);
const crosshair2 = document.getElementById("crosshair2");

const crosshair2LCreate = document.createElement("div");
crosshair2LCreate.setAttribute("id", "ch2L");
crosshair2.appendChild(crosshair2LCreate);

const crosshair2RCreate = document.createElement("div");
crosshair2RCreate.setAttribute("id", "ch2R");
crosshair2.appendChild(crosshair2RCreate);

const crosshair2BCreate = document.createElement("div");
crosshair2BCreate.setAttribute("id", "ch2B");
crosshair2.appendChild(crosshair2BCreate);

//cross
const crosshair3Create = document.createElement("img");
crosshair3Create.setAttribute("id", "crosshair3");
appBody.prepend(crosshair3Create);
const crosshair3 = document.getElementById("crosshair3");

const crosshair3LCreate = document.createElement("div");
crosshair3LCreate.setAttribute("id", "ch3L");
crosshair3.appendChild(crosshair3LCreate);

const crosshair3RCreate = document.createElement("div");
crosshair3RCreate.setAttribute("id", "ch3R");
crosshair3.appendChild(crosshair3RCreate);

const crosshair3BCreate = document.createElement("div");
crosshair3BCreate.setAttribute("id", "ch3B");
crosshair3.appendChild(crosshair3BCreate);

const crosshair3TCreate = document.createElement("div");
crosshair3TCreate.setAttribute("id", "ch3T");
crosshair3.appendChild(crosshair3TCreate);

//CSSローダー
//ホルダー
const cssLoadHolderCreate = document.createElement("div");
cssLoadHolderCreate.setAttribute("id", "cssHolder");
sbHolder.appendChild(cssLoadHolderCreate);
const cssLoadHolder = document.getElementById("cssHolder");
//title
const cssLoaderTitle = document.createElement("h3");
cssLoaderTitle.setAttribute("class", "fncTitle");
cssLoaderTitle.textContent = "- CSS Loader -";
cssLoadHolder.appendChild(cssLoaderTitle);
//入力欄
const cssInputCreate = document.createElement("textarea");
cssInputCreate.setAttribute("id", "cssInput");
cssInputCreate.setAttribute("class", "inputArea");
cssInputCreate.setAttribute("oninput", "cssInput()");
cssInputCreate.defaultValue = localStorage.getItem("cssValSaved");
cssLoadHolder.appendChild(cssInputCreate);

//add css
const styleAdd = document.createElement("style");
styleAdd.innerHTML = localStorage.getItem("cssValSaved");
styleAdd.setAttribute("id", "styleHold");
document.body.appendChild(styleAdd);

//stylesheet
const style = document.createElement("link");
style.setAttribute("rel", "stylesheet");
style.setAttribute("type", "text/css");
style.href ="https://namekujilsds.github.io/vancedVox/style.css" ;
document.body.appendChild(style);

//function.jsを読み込み
const script = document.createElement("script");
script.src = "https://namekujilsds.github.io/vancedVox/function.js";
document.body.appendChild(script);
