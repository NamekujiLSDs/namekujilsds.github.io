//開いてるページ
let pageTitle = document.getElementById("nowPageTitle");

//子ページ
let about = document.getElementById("aboutMenu");
let css = document.getElementById("cssMenu");
let mods = document.getElementById("modsMenu");
let contact = document.getElementById("contactMenu");
let youtube = document.getElementById("youtubeMenu");
let twitter = document.getElementById("twitterMenu");
let extension = document.getElementById("extensionMenu");

let iframe = document.getElementById("iframe");

function aboutMenuClick() {
  pageTitle.textContent = "Namekuji - About";
  iframe.setAttribute("src", "./html/about.html");

  about.setAttribute("class", "selected sbMenu");
  css.setAttribute("class", "sbMenu");
  mods.setAttribute("class", "sbMenu");
  contact.setAttribute("class", "sbMenu");
  youtube.setAttribute("class", "sbMenu");
  twitter.setAttribute("class", "sbMenu");
  extension.setAttribute("class", "sbMenu");
}
function cssMenuClick() {
  pageTitle.textContent = "Namekuji - CSS";
  iframe.setAttribute("src", "./html/css.html");

  about.setAttribute("class", "sbMenu");
  css.setAttribute("class", "sbMenu selected");
  mods.setAttribute("class", "sbMenu");
  contact.setAttribute("class", "sbMenu");
  youtube.setAttribute("class", "sbMenu");
  twitter.setAttribute("class", "sbMenu");
  extension.setAttribute("class", "sbMenu");
}
function modsMenuClick() {
  pageTitle.textContent = "Namekuji - Mods";
  iframe.setAttribute("src", "./html/mods.html");

  about.setAttribute("class", "sbMenu");
  css.setAttribute("class", "sbMenu");
  mods.setAttribute("class", "sbMenu selected");
  contact.setAttribute("class", "sbMenu");
  youtube.setAttribute("class", "sbMenu");
  twitter.setAttribute("class", "sbMenu");
  extension.setAttribute("class", "sbMenu");
}
function contactMenuClick() {
  pageTitle.textContent = "Namekuji - Contact";
  iframe.setAttribute("src", "./html/contact.html");

  about.setAttribute("class", "sbMenu");
  css.setAttribute("class", "sbMenu");
  mods.setAttribute("class", "sbMenu");
  contact.setAttribute("class", "sbMenu selected");
  youtube.setAttribute("class", "sbMenu");
  twitter.setAttribute("class", "sbMenu");
  extension.setAttribute("class", "sbMenu");
}
function youtubeMenuClick() {
  pageTitle.textContent = "Namekuji - Youtube";
  iframe.setAttribute("src", "./html/youtube.html");

  about.setAttribute("class", "sbMenu");
  css.setAttribute("class", "sbMenu");
  mods.setAttribute("class", "sbMenu");
  contact.setAttribute("class", "sbMenu");
  youtube.setAttribute("class", "sbMenu selected");
  twitter.setAttribute("class", "sbMenu");
  extension.setAttribute("class", "sbMenu");
}
function twitterMenuClick() {
  pageTitle.textContent = "Namekuji - Twitter";
  iframe.setAttribute("src", "./html/twitter.html");

  about.setAttribute("class", "sbMenu");
  css.setAttribute("class", "sbMenu");
  mods.setAttribute("class", "sbMenu");
  contact.setAttribute("class", "sbMenu");
  youtube.setAttribute("class", "sbMenu");
  twitter.setAttribute("class", "sbMenu selected");
  extension.setAttribute("class", "sbMenu");
}

function extensionMenuClick() {
  pageTitle.textContent = "Namekuji - Twitter";
  iframe.setAttribute("src", "./html/extension.html");

  about.setAttribute("class", "sbMenu");
  css.setAttribute("class", "sbMenu");
  mods.setAttribute("class", "sbMenu");
  contact.setAttribute("class", "sbMenu");
  youtube.setAttribute("class", "sbMenu");
  twitter.setAttribute("class", "sbMenu");
  extension.setAttribute("class", "sbMenu selected");
}
// 色テーブル
const colors = [
  "#ffaadb",
  "#aaefff",
  "#aaffc9",
  "#efffaa",
  "#ffadaa",
  "#e9aaff",
  "#11B1AB",
  "#C3776A",
  "#DEAAAC",
  "#F414D3",
  "#32BB31",
  "#F4A38E",
  "#981471",
  "#786580",
  "#40A734",
  "#B8E937",
  "#D5A693",
  "#9CAA82",
  "#8A86D2",
  "#F7E62E",
  "#96FEB2",
  "#0B8EB9",
  "#C56FB0",
  "#ED6CA2",
  "#F9622C",
  "#0656B2",
  "#8B3ADE",
];

const colors2 = [
  "#84AFC5",
  "#4EFD35",
  "#B8C39A",
  "#52BFA1",
  "#D0A45B",
  "#079A74",
  "#A865AC",
  "#9FFE38",
  "#3584D6",
  "#D0E05E",
  "#4C8CA4",
  "#CAA57B",
  "#C999D3",
  "#DA4420",
  "yellow",
  "#C6E74D",
];

window.onload = function () {
  document
    .getElementsByTagName("html")[0]
    .style.setProperty(
      "--embed-color",
      colors[Math.round(Math.random() * (colors.length - 1))]
    );
  document
    .getElementsByTagName("html")[0]
    .style.setProperty(
      "--user-color",
      colors2[Math.round(Math.random() * (colors2.length - 1))]
    );
};
