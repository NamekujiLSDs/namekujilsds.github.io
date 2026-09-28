/**
 * 古戦場貢献度ランキング スクリプト (script.js)
 * 
 * 本スクリプトは、グランブルーファンタジーのゲーム内イベント「決戦！星の古戦場」において、
 * gbf.pub の公開APIを活用して団員や特定プレイヤーの貢献度・順位・時速・ボーダー差分を
 * リアルタイムに取得・集計・可視化するためのクライアントサイドロジックを提供します。
 * 
 * 主な機能:
 * 1. プレイヤーIDリスト（カンマ区切り）に基づく貢献度・順位データの並列非同期取得
 * 2. 過去の古戦場実績データ（直近3回分）に基づくアクティビティ曲線モデルを用いた将来貢献度・時速の予測算出
 * 3. 貢献度、実測時速（1時間）、短期予測時速（20分）、当日増加量、10万位ボーダー差分の表形式表示と多軸ソート
 * 4. Chart.jsを利用した詳細な時系列推移・予測グラフのモーダル表示（全期間／日別タブ切り替え対応）
 * 5. ゲーム内から団員IDを一括抽出するブックマークレットのワンクリックコピー機能
 */

// --- 定数定義 ---

/**
 * 10万位の順位定義。
 * グランブルーファンタジーの古戦場イベントにおいて、最高位の個人累計貢献度報酬や
 * 称号・勲章の獲得ラインとして設定される最重要ボーダーラインの一つであるため定義。
 * @type {number}
 */
const BORDER_RANK_100K = 100000;

/**
 * 2000位の順位定義。
 * 全体の上位入賞枠（英雄称号ライン等）にあたり、最上位層の極めて高い稼働速度・ボーダーを
 * 比較・予測する基準として使用するために定義。
 * @type {number}
 */
const BORDER_RANK_2K = 2000;

// --- グローバル状態管理 ---

/**
 * アプリケーション全体で共有するイベントデータおよびキャッシュ保持オブジェクト。
 * APIリクエストの重複送信を防ぎ、モーダル表示やソート処理を高速化するためにメモリ上に保持します。
 * @type {object}
 */
let globalEventData = {
  /**
   * 現在キャッシュしている古戦場の開催回数（数値）。
   * セレクトボックス変更時に過去回キャッシュの破棄要否を判定するために使用。
   */
  loadedRaidNum: null,
  pastBorders100k: [], // 10万位の過去データ
  pastBorders2k: [],   // 2000位の過去データ
  currentBorder100k: [],
  currentBorder2k: [],
  users: {},
  activityCurve100k: null,
  activityCurve2k: null,
  tableData: [] // テーブルのベースデータ
};

/**
 * Chart.jsのチャートインスタンス。
 * グラフ再描画時に既存インスタンスを破棄（destroy）してメモリリークや描画重複を防ぐためにグローバル保持。
 * @type {Chart|null}
 */
let myChart = null; // Chart.jsインスタンス

/**
 * 現在のソートキー（初期値: 'point'）。
 * デフォルトで貢献度の降順（最も貢献度の高いプレイヤー順）で一覧を表示するために設定。
 * @type {string}
 */
let currentSortKey = 'point'; // 初期ソートキーは貢献度

/**
 * 現在のソート順序 ('asc' または 'desc')。
 * @type {'asc'|'desc'}
 */
let currentSortOrder = 'desc';

/**
 * グラフ上部の期間内増加量サマリーで、正確な数値（フル桁カンマ区切り）を表示するかどうかのトグルフラグ。
 * 
 * 【背景・意図】
 * 「+1.5517億のところ、タップしたら正確な数字が出るようにしてほしい」という要望に対応し、
 * ユーザーがサマリーの数値をタップすることで、略記（+1.5517億）と正確な実数値（+155,170,000）を
 * 相互にトグル切り替えできるようにし、期間タブを切り替えても選択した表示モードを維持するために保持します。
 * @type {boolean}
 */
let isSummaryDetailMode = false;

/**
 * 現在テーブルに描画されているソート済みデータ配列のキャッシュ。
 * 画像保存時に最新の並び順（全体順位、貢献度、時速等）をそのまま画像化するために保持します。
 * @type {Array<object>}
 */
let currentSortedData = [];

// --- ユーティリティ関数 ---

/**
 * 数値の貢献度を人間が直感的に把握しやすい日本語単位（億・万）の文字列にフォーマットします。
 * 
 * 【背景・意図】
 * 古戦場の貢献度は数千万〜数十億ポイントに達し、生の数字（例: 1234567890）では桁数が多すぎて
 * テーブル表示時に幅を取り、一目で数値を比較することが困難なため、億・万表記へ変換します。
 * 
 * @param {number|null|undefined} num - フォーマット対象の貢献度数値
 * @returns {string} フォーマットされた貢献度文字列（無効値の場合は '-'）
 */
const formatPoint = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '-';
  if (num >= 100000000) return (num / 100000000).toFixed(4) + '億';
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return Math.round(num).toLocaleString();
};

/**
 * 1時間あたりの速度（時速）数値を日本語単位（億・万）の文字列にフォーマットします。
 * 
 * 【背景・意図】
 * 時速も数十万〜数千万に達するため、小数第2位までの億表記や小数第1位までの万表記に変換し、
 * 稼働ペースの比較を容易にするために用意されています。
 * 
 * @param {number|null|undefined} num - フォーマット対象の時速数値
 * @returns {string} フォーマットされた時速文字列（無効値の場合は '-'）
 */
const formatSpeed = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '-';
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '億';
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return Math.round(num).toLocaleString();
};

/**
 * 秒単位のUNIXタイムスタンプを「M/D HH:mm」形式の日本標準表記に変換します。
 * 
 * 【背景・意図】
 * APIから返却される時刻はUNIX秒形式（例: 1713000000）であるため、ユーザーが更新タイミングを
 * 直感的に把握できるように、見慣れた月日および24時間制の時分文字列へフォーマットします。
 * 
 * @param {number|null|undefined} unixSec - 秒単位のUNIXタイムスタンプ
 * @returns {string} 整形された日時文字列（値がない場合は '-'）
 */
const formatTime = (unixSec) => {
  if (!unixSec) return '-';
  const d = new Date(unixSec * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * 指定したUNIXタイムスタンプが属する日の午前00:00:00（日の開始時点）のUNIX秒を取得します。
 * 
 * 【背景・意図】
 * グラブルの古戦場において、日々の稼働目標や本日のノルマ達成状況を確認するため、
 * 「当日0:00以降にどれだけ貢献度が増えたか」を算出する基準タイムスタンプが必要となるためです。
 * 
 * @param {number} currentUnixTime - 基準となるUNIXタイムスタンプ（秒単位）
 * @returns {number} 当日00:00:00のUNIXタイムスタンプ（秒単位）
 */
const getTodayStartTime = (currentUnixTime) => {
  const d = new Date(currentUnixTime * 1000);
  d.setHours(0, 0, 0, 0); // 1日の区切りは0:00
  return Math.floor(d.getTime() / 1000);
};

/**
 * 最新ポイントと本日開始時点（00:00）のポイント差分から「本日の貢献度増加量」を算出します。
 * 
 * 【背景・意図】
 * 当日どれだけ走ったか（稼働したか）を可視化することで、団内での本日の貢献状況や
 * 日速ペースを把握できるようにします。過去データ配列を末尾（最新）から遡り、
 * 本日0時以前の最新ポイントを基準点（basePoint）として採用します。
 * 
 * @param {Array<{point: number, updatetime: number}>} points - 時系列のポイントデータ配列
 * @returns {number|null} 本日の増加ポイント（データ不足の場合はnull）
 */
const calculateTodayIncrease = (points) => {
  if (!points || points.length === 0) return null;
  const latest = points[points.length - 1];
  const todayStartTime = getTodayStartTime(latest.updatetime);

  let basePoint = points[0].point;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].updatetime <= todayStartTime) {
      basePoint = points[i].point;
      break;
    }
  }
  return latest.point - basePoint;
};

/**
 * 指定した過去秒数（例: 3600秒=1時間、1200秒=20分）遡った時点からの貢献度増加量に基づき、
 * 1時間あたりの時速換算値（pt/h）を算出します。
 * 
 * 【背景・意図】
 * プレイヤーの現在の稼働スピード（ペース）を定量的に評価するためです。
 * targetSeconds=3600 を渡すことで実測1時間時速が得られ、
 * targetSeconds=1200 を渡すことで直近20分の瞬間風速的な予測時速を算出できます。
 * 
 * @param {Array<{point: number, updatetime: number}>} points - 時系列ポイントデータ配列
 * @param {number} targetSeconds - 遡る目標秒数（例: 3600=1時間, 1200=20分）
 * @returns {number|null} 1時間あたりの増加速度（pt/h）（データ不足の場合はnull）
 */
const calculateSpeedFromPast = (points, targetSeconds) => {
  if (!points || points.length < 2) return null;
  const latest = points[points.length - 1];

  let pastPoint = null;
  for (let i = points.length - 2; i >= 0; i--) {
    if (latest.updatetime - points[i].updatetime >= targetSeconds) {
      pastPoint = points[i];
      break;
    }
  }

  if (!pastPoint) pastPoint = points[0];

  const dt = latest.updatetime - pastPoint.updatetime;
  const dp = latest.point - pastPoint.point;

  if (dt <= 0) return 0;
  return (dp / dt) * 3600;
};

/**
 * 指定されたURLからJSONデータを取得します。
 * 直接fetchに失敗した場合はCORSプロキシ（AllOrigins）を経由してフォールバック取得します。
 * 
 * 【背景・意図】
 * gbf.pub のAPIサーバーは、ブラウザから直接アクセスした場合にキャッシュやCORS制約、
 * 通信制限等でリクエストがブロックされる場合があります。
 * タイムスタンプパラメータ（_={timestamp}）を付与してキャッシュを無効化した上で直接fetchを試み、
 * 失敗した場合には公開CORSプロキシ `https://api.allorigins.win/raw?url=...` へ自動切換することで、
 * 確実なデータ取得を実現しています。
 * 
 * @param {string} url - 取得対象のAPIエンドポイントURL
 * @returns {Promise<any>} レスポンスJSON内の data プロパティの値
 * @throws {Error} 通信障害またはAPIがエラーレスポンスを返却した場合
 */
const fetchData = async (url) => {
  // ブラウザおよびプロキシによるキャッシュを回避するため、ミリ秒タイムスタンプをクエリパラメータに付与
  const separator = url.includes('?') ? '&' : '?';
  const urlWithBuster = `${url}${separator}_=${new Date().getTime()}`;

  try {
    const res = await fetch(urlWithBuster, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.type === 'success') return json.data;
    }
  } catch (e) {
    console.warn('Direct fetch failed, trying proxy...', url);
  }
  // 直接アクセスに失敗した場合、AllOriginsプロキシを介して再試行
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(urlWithBuster)}`;
  const res = await fetch(proxyUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`通信エラー: ${res.status}`);
  const json = await res.json();
  if (json.type !== 'success') throw new Error('APIからエラーが返却されました');
  return json.data;
};

// --- 古戦場の日程と休戦期間判定 ---

/**
 * 古戦場のタイムライン・スケジュール定義。
 * イベント開始（初日19:00 JST）からの経過時間（時間単位）で各期間の開始・終了を定義。
 * 
 * 【スケジュール仕様】
 * - 予選: 21日(月)19:00 ～ 22日(火)23:59 (経過 0h ～ 29h)
 * - 予選集計: 23日(水)0:00 ～ 23日(水)6:59 (経過 29h ～ 36h) [空白時間・プロットスキップ]
 * - インターバル: 23日(水)7:00 ～ 24日(木)6:59 (経過 36h ～ 60h)
 * - 本戦1日目: 24日(木)7:00 ～ 24日(木)23:59 (経過 60h ～ 77h) [深夜0時〜7時は空白(77h〜84h)]
 * - 本戦2日目: 25日(金)7:00 ～ 25日(金)23:59 (経過 84h ～ 101h) [深夜0時〜7時は空白(101h〜108h)]
 * - 本戦3日目: 26日(土)7:00 ～ 26日(土)23:59 (経過 108h ～ 125h) [深夜0時〜7時は空白(125h〜132h)]
 * - 本戦4日目: 27日(日)7:00 ～ 27日(日)23:59 (経過 132h ～ 149h) [深夜0時〜7時は空白(149h〜156h)]
 * ※SPバトル（28日7:00〜23:59）は貢献度の変動がないため、グラフ対象外（ボタンおよびプロット不要）。
 * 
 * @type {Array<{id: string, name: string, realStartH: number, realEndH: number, activeStartH: number, activeEndH: number}>}
 */
const ACTIVE_SEGMENTS = [
  { id: 'qualify', name: '予選', realStartH: 0, realEndH: 29, activeStartH: 0, activeEndH: 29 },
  { id: 'interval', name: 'インターバル', realStartH: 36, realEndH: 60, activeStartH: 29, activeEndH: 53 },
  { id: 'day1', name: '本戦1日目', realStartH: 60, realEndH: 77, activeStartH: 53, activeEndH: 70 },
  { id: 'day2', name: '本戦2日目', realStartH: 84, realEndH: 101, activeStartH: 70, activeEndH: 87 },
  { id: 'day3', name: '本戦3日目', realStartH: 108, realEndH: 125, activeStartH: 87, activeEndH: 104 },
  { id: 'day4', name: '本戦4日目', realStartH: 132, realEndH: 149, activeStartH: 104, activeEndH: 121 }
];

/**
 * グラフモーダル上部の期間切り替えタブの定義。
 * 
 * 【背景・意図】
 * 各日のバトル時間（07:00〜24:00）のみを画面いっぱいに拡大表示できるように、
 * 累積活動時間（activeStartH / activeEndH）と実経過時間（realStartH / realEndH）を保持します。
 * 
 * @type {Array<{id: string, label: string, activeStartH: number|null, activeEndH: number|null, realStartH: number|null, realEndH: number|null}>}
 */
const EVENT_PHASES = [
  { id: 'all', label: '全期間', activeStartH: null, activeEndH: null, realStartH: null, realEndH: null },
  { id: 'qualify', label: '予選', activeStartH: 0, activeEndH: 29, realStartH: 0, realEndH: 29 },
  { id: 'interval', label: 'インターバル', activeStartH: 29, activeEndH: 53, realStartH: 36, realEndH: 60 },
  { id: 'day1', label: '本戦1日目', activeStartH: 53, activeEndH: 70, realStartH: 60, realEndH: 77 },
  { id: 'day2', label: '本戦2日目', activeStartH: 70, activeEndH: 87, realStartH: 84, realEndH: 101 },
  { id: 'day3', label: '本戦3日目', activeStartH: 87, activeEndH: 104, realStartH: 108, realEndH: 125 },
  { id: 'day4', label: '本戦4日目', activeStartH: 104, activeEndH: 121, realStartH: 132, realEndH: 149 }
];

/**
 * 最初のデータ点のUNIXタイムスタンプに基づき、イベント開始日時（初日19:00:00 JST）のUNIX秒を算出します。
 * 
 * 【背景・意図】
 * 古戦場の第1データ点（currentBorder100k[0].updatetime）は通常予選初日の19:00またはその直後のスナップショットです。
 * タイムゾーンを日本時間（JST）として初日の19:00:00のUNIX秒を特定することで、
 * 経過時間（elapsedH）とスケジュールの各フェーズ（予選0〜29h、インターバル36〜60h等）を高精度に同期させます。
 * 
 * @param {number} firstUnixSec - 初回データのUNIXタイムスタンプ（秒）
 * @returns {number} イベント開始時刻（初日19:00:00 JST）のUNIXタイムスタンプ（秒）
 */
const getEventStartTime = (firstUnixSec) => {
  const d = new Date(firstUnixSec * 1000);
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19, 0, 0);
  let startUnix = Math.floor(startD.getTime() / 1000);
  // 初回データが19時より前の場合はそのデータ時刻を開始時刻とする
  if (firstUnixSec < startUnix) {
    startUnix = firstUnixSec;
  }
  return startUnix;
};

/**
 * イベント開始からの経過時間（時間単位）に基づき、現在が夜間の休戦・集計時間帯（空白時間）であるかを判定します。
 * 
 * 【背景・意図】
 * 各バトルの終了時刻ジャスト（29h, 77h, 101h, 125h, 149h = 各日24:00/翌00:00）は
 * 当該日の最終確定リザルトデータであるため、休戦・空白時間には含めず必ずグラフに表示させます。
 * そのため、わずかな許容幅（eps = 0.01時間 = 約36秒）を設け、終了時刻直後から翌朝07:00直前までを
 * 空白時間として判定します:
 * - 29h超 〜 36h未満: 予選集計期間（23日 00:01 〜 06:59）
 * - 77h超 〜 84h未満: 本戦1日目終了後の深夜休戦（25日 00:01 〜 06:59）
 * - 101h超 〜 108h未満: 本戦2日目終了後の深夜休戦（26日 00:01 〜 06:59）
 * - 125h超 〜 132h未満: 本戦3日目終了後の深夜休戦（27日 00:01 〜 06:59）
 * - 149h超: 本戦4日目終了後（28日 00:01以降。SPバトル期間は貢献度変動がないためスキップ）
 * 
 * @param {number} elapsedH - イベント開始からの経過時間（時間）
 * @returns {boolean} 休戦・集計（空白）時間帯であればtrue、活動中であればfalse
 */
const isRestTimeByElapsed = (elapsedH) => {
  const eps = 0.01; // 約36秒の許容マージン
  if (elapsedH > 29 + eps && elapsedH < 36 - eps) return true;
  if (elapsedH > 77 + eps && elapsedH < 84 - eps) return true;
  if (elapsedH > 101 + eps && elapsedH < 108 - eps) return true;
  if (elapsedH > 125 + eps && elapsedH < 132 - eps) return true;
  if (elapsedH > 149 + eps) return true;
  return false;
};

/**
 * 実経過時間（時間）を累積活動時間（Active Timeline, 0〜121h）へ変換します。
 * 
 * 【背景・意図】
 * 各日の夜間休戦時間（0:00〜7:00）の空白をスキップして詰めて描画するため、
 * 経過時間を活動セグメントの累積時間へ射影します。
 * 
 * @param {number} elapsedH - イベント開始からの実経過時間（時間）
 * @returns {number} 累積活動時間（時間）
 */
const realElapsedToActiveH = (elapsedH) => {
  const eps = 0.001;
  for (const seg of ACTIVE_SEGMENTS) {
    if (elapsedH >= seg.realStartH - eps && elapsedH <= seg.realEndH + eps) {
      const clamped = Math.max(seg.realStartH, Math.min(seg.realEndH, elapsedH));
      return seg.activeStartH + (clamped - seg.realStartH);
    }
  }
  for (let i = 0; i < ACTIVE_SEGMENTS.length - 1; i++) {
    if (elapsedH > ACTIVE_SEGMENTS[i].realEndH && elapsedH < ACTIVE_SEGMENTS[i + 1].realStartH) {
      return ACTIVE_SEGMENTS[i].activeEndH;
    }
  }
  if (elapsedH < 0) return 0;
  return ACTIVE_SEGMENTS[ACTIVE_SEGMENTS.length - 1].activeEndH;
};

/**
 * 累積活動時間とフェーズIDから実経過時間（時間）を逆算します。
 * 
 * 【背景・意図】
 * グラフのX軸目盛りやツールチップにおいて、累積活動時間を人間が読める実時刻（時分）へ戻すために使用します。
 * フェーズIDが指定されている場合は当該フェーズの基準時間を使用し、境界点（例: 70h）における曖昧さを防ぎます。
 * 
 * @param {number} activeH - 累積活動時間
 * @param {string|null} [phaseId='all'] - 対象のフェーズID
 * @returns {number} 実経過時間（時間）
 */
const getRealElapsedForPhase = (activeH, phaseId = 'all') => {
  if (phaseId && phaseId !== 'all') {
    const seg = ACTIVE_SEGMENTS.find(s => s.id === phaseId);
    if (seg) {
      return seg.realStartH + (activeH - seg.activeStartH);
    }
  }
  for (let i = 0; i < ACTIVE_SEGMENTS.length; i++) {
    const seg = ACTIVE_SEGMENTS[i];
    if (activeH >= seg.activeStartH && activeH <= seg.activeEndH) {
      return seg.realStartH + (activeH - seg.activeStartH);
    }
  }
  return ACTIVE_SEGMENTS[ACTIVE_SEGMENTS.length - 1].realEndH;
};

// --- 予測ロジック用の関数群 ---

/**
 * 時系列ポイントデータから、指定した経過時間ジャストにおける貢献度を線形補間（Linear Interpolation）で算出します。
 * 
 * 【背景・意図】
 * APIから取得できるポイントデータは20分毎など不定期なスナップショットであるため、
 * 「経過時間ちょうど（例: 10.0時間後）」のデータが必ずしも存在するとは限りません。
 * 前後の2点から時間比率で線形補間することで、連続的で滑らかな推移データを取得します。
 * 
 * @param {Array<{point: number, updatetime: number}>} points - 時系列ポイント配列
 * @param {number} startUnix - イベント開始のUNIXタイムスタンプ（秒）
 * @param {number} targetElapsedH - 目標の経過時間（時間単位）
 * @returns {number} 補間によって算出された推定貢献度
 */
const getInterpolatedPoint = (points, startUnix, targetElapsedH) => {
  if (!points || points.length === 0) return 0;
  const targetUnix = startUnix + targetElapsedH * 3600;

  if (targetUnix <= points[0].updatetime) return points[0].point;
  if (targetUnix >= points[points.length - 1].updatetime) return points[points.length - 1].point;

  let p1 = points[0], p2 = points[points.length - 1];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].updatetime <= targetUnix && points[i + 1].updatetime >= targetUnix) {
      p1 = points[i]; p2 = points[i + 1]; break;
    }
  }
  if (p1.updatetime === p2.updatetime) return p1.point;
  return p1.point + (p2.point - p1.point) * ((targetUnix - p1.updatetime) / (p2.updatetime - p1.updatetime));
};

/**
 * 過去開催のボーダー履歴（直近3回分）から、経過時間ごとの平均増加速度（pt/h）をまとめたアクティビティ曲線を生成します。
 * 
 * 【背景・意図】
 * 古戦場の貢献度の伸びは一定ではなく、日中は緩やかで夜間（20時〜24時）に急加速し、
 * 本戦最終日にはさらに加速するという特有のユーザー行動パターン（アクティビティ推移）が存在します。
 * 過去複数回の同経過時間における時間あたり増加量を平均化することで、
 * 人間味のあるリアルな予測曲線のベースラインモデルを構築します。
 * 
 * @param {Array<Array<{point: number, updatetime: number}>>} pastDataArrays - 過去複数開催分の時系列データ配列
 * @param {number} maxHours - 算出対象の最大経過時間（例: 150時間）
 * @returns {Map<number, number>} 経過時間(h)をキー、平均増加量(pt)を値とするMapオブジェクト
 */
const calculateActivityCurve = (pastDataArrays, maxHours) => {
  const curve = new Map();
  for (let h = 0; h < maxHours; h++) {
    if (isRestTimeByElapsed(h)) {
      curve.set(h, 0);
      continue;
    }
    let speedSum = 0; let count = 0;
    pastDataArrays.forEach(points => {
      if (!points || points.length === 0) return;
      const startUnix = points[0].updatetime;
      const pNow = getInterpolatedPoint(points, startUnix, h);
      const pNext = getInterpolatedPoint(points, startUnix, h + 1);
      if (pNow > 0 && pNext > pNow) {
        speedSum += (pNext - pNow); count++;
      }
    });
    curve.set(h, count > 0 ? speedSum / count : 10000);
  }
  return curve;
};

/**
 * 直近のボーダー伸び実績と過去平均アクティビティ曲線を比較し、今回の開催における「インフレ率（速度倍率）」を算出します。
 * 
 * 【背景・意図】
 * ボス敵のHPや肉集めの効率化、環境キャラ・武器の実装により、古戦場ごとの全体ボーダー速度は
 * 過去開催よりも1.2倍や1.5倍などにインフレ（加速）することが日常的です。
 * 直近12時間の現在実績増加量と過去平均増加量を比較し、インフレ係数（ratio）を求めることで、
 * 今後の伸び予測を今回の加速ペースに合わせて補正します。
 * 
 * @param {Array<{point: number, updatetime: number}>} currentBorder - 現在開催のボーダーデータ配列
 * @param {Map<number, number>} activityCurve - 過去平均のアクティビティ速度曲線
 * @param {number} latestElapsedH - 現在の最新経過時間（時間）
 * @returns {number} インフレ倍率（データ不足時は 1.0）
 */
const calcInflationRate = (currentBorder, activityCurve, latestElapsedH) => {
  // 直近12時間の推移を評価ウィンドウとして採用
  const compareHours = 12;
  const elapsedInt = Math.floor(latestElapsedH);
  if (elapsedInt < compareHours) return 1.0;

  const pStart = getInterpolatedPoint(currentBorder, currentBorder[0].updatetime, elapsedInt - compareHours);
  const pEnd = getInterpolatedPoint(currentBorder, currentBorder[0].updatetime, elapsedInt);
  const currentInc = Math.max(0, pEnd - pStart);

  let pastInc = 0;
  for (let h = elapsedInt - compareHours; h < elapsedInt; h++) pastInc += (activityCurve.get(h) || 10000);

  if (pastInc > 0 && currentInc > 0) return currentInc / pastInc;
  return 1.0;
};

// --- グラフ描画機能 ---

/**
 * プレイヤーまたはボーダーの時系列グラフモーダルを表示します。
 * 
 * 【背景・意図】
 * テーブルの一覧表示だけでなく、時系列での伸びやボーダーとの位置関係、
 * および最終的な着地予測を視覚的に確認できるようにモーダルを展開します。
 * 予選開始の19:40のデータから本戦4日目最後の0:00データまで、実測生データを欠損なく完全プロットし、
 * 空白時間（深夜0:01〜06:59）はプロットをスキップします。
 * 
 * @param {string} userId - 対象ユーザーID、または 'border_100k' / 'border_2k'
 * @param {'point'|'speed'} [chartType='point'] - グラフ種別 ('point': 累計貢献度, 'speed': 時速)
 * @returns {void}
 */
window.openChartModal = function (userId, chartType = 'point') {
  if (!globalEventData.currentBorder100k || globalEventData.currentBorder100k.length === 0) return;

  // 初日19:00:00 JSTを開始基準時刻として算出
  const currentStartTime = getEventStartTime(globalEventData.currentBorder100k[0].updatetime);
  // 本戦4日目終了（149時間）までの全期間を対象（SPバトルは貢献度変動がないため除外）
  const maxElapsed = 149;

  if (!globalEventData.activityCurve100k) {
    globalEventData.activityCurve100k = calculateActivityCurve(globalEventData.pastBorders100k, maxElapsed + 1);
    globalEventData.activityCurve2k = calculateActivityCurve(globalEventData.pastBorders2k, maxElapsed + 1);
  }
  const curve100k = globalEventData.activityCurve100k;
  const curve2k = globalEventData.activityCurve2k;

  const latestBorder = globalEventData.currentBorder100k[globalEventData.currentBorder100k.length - 1];
  const latestElapsedH = (latestBorder.updatetime - currentStartTime) / 3600;
  const latestUnixMs = latestBorder.updatetime * 1000;

  const inflation100k = calcInflationRate(globalEventData.currentBorder100k, curve100k, latestElapsedH);
  const inflation2k = (globalEventData.currentBorder2k && globalEventData.currentBorder2k.length > 0)
    ? calcInflationRate(globalEventData.currentBorder2k, curve2k, latestElapsedH)
    : 1.0;

  let targetUser = null;
  let is2kTier = false;

  if (userId !== 'border_100k' && userId !== 'border_2k') {
    targetUser = globalEventData.users[userId];
    if (targetUser) {
      const uLatestPoint = targetUser.points[targetUser.points.length - 1].point;
      const border100kLatestPoint = latestBorder.point;
      // プレイヤーのポイントが10万位の2倍以上ある場合は、よりハイレベルな2000位ボーダーと比較する
      if (uLatestPoint > border100kLatestPoint * 2) {
        is2kTier = true;
      }
    }
  } else if (userId === 'border_2k') {
    is2kTier = true;
  }

  const refBorderName = is2kTier ? '2000位ボーダー' : '10万位ボーダー';
  const refBorderDataRaw = (is2kTier && globalEventData.currentBorder2k.length > 0) ? globalEventData.currentBorder2k : globalEventData.currentBorder100k;
  const refCurve = is2kTier ? curve2k : curve100k;
  const refInflation = is2kTier ? inflation2k : inflation100k;

  let userPace = 1.0;
  if (targetUser) {
    // ユーザー自身の直近12時間の稼働速度比率を計算し、ボーダー速度に対する個人ペース係数を算出
    const compareHours = 12;
    const uPoints = targetUser.points;
    const uLatestH = (uPoints[uPoints.length - 1].updatetime - currentStartTime) / 3600;
    const startH = Math.max(0, uLatestH - compareHours);

    const uInc = Math.max(0, uPoints[uPoints.length - 1].point - getInterpolatedPoint(uPoints, currentStartTime, startH));
    const borderInc = Math.max(0, refBorderDataRaw[refBorderDataRaw.length - 1].point - getInterpolatedPoint(refBorderDataRaw, currentStartTime, startH));

    if (borderInc > 0) {
      userPace = uInc / borderInc;
    }
  }

  const borderData = [];
  const userData = [];

  if (chartType === 'point') {
    // 1. ボーダー実測データの直接プロット（19:40から本戦4日目24:00までの生データを欠損なく完全反映）
    refBorderDataRaw.forEach(p => {
      const elapsedH = (p.updatetime - currentStartTime) / 3600;
      if (isRestTimeByElapsed(elapsedH)) return;
      borderData.push({
        x: realElapsedToActiveH(elapsedH),
        y: p.point,
        point: p.point,
        isPredict: false,
        realUnixMs: p.updatetime * 1000
      });
    });

    // 2. ユーザー実測データの直接プロット
    if (targetUser && targetUser.points) {
      targetUser.points.forEach(p => {
        const elapsedH = (p.updatetime - currentStartTime) / 3600;
        if (isRestTimeByElapsed(elapsedH)) return;
        userData.push({
          x: realElapsedToActiveH(elapsedH),
          y: p.point,
          point: p.point,
          isPredict: false,
          realUnixMs: p.updatetime * 1000
        });
      });
    }

    // 3. 未来予測データの追加（イベント進行中の場合のみ）
    if (latestElapsedH < maxElapsed) {
      let currentBorderPred = refBorderDataRaw[refBorderDataRaw.length - 1].point;
      let currentUserPred = targetUser && targetUser.points.length > 0 ? targetUser.points[targetUser.points.length - 1].point : 0;
      const startH = Math.ceil(latestElapsedH);

      for (let h = startH; h <= maxElapsed; h++) {
        if (isRestTimeByElapsed(h)) continue;
        const unixMs = (currentStartTime + h * 3600) * 1000;
        const activeX = realElapsedToActiveH(h);
        const baseSpeed = refCurve.get(h - 1) || 10000;
        const borderSpeed = baseSpeed * refInflation;
        currentBorderPred += borderSpeed;
        borderData.push({ x: activeX, y: currentBorderPred, point: currentBorderPred, isPredict: true, realUnixMs: unixMs });

        if (targetUser) {
          currentUserPred += borderSpeed * userPace;
          userData.push({ x: activeX, y: currentUserPred, point: currentUserPred, isPredict: true, realUnixMs: unixMs });
        }
      }
    }
  } else if (chartType === 'speed') {
    /**
     * ポイント配列から連続した2点間の差分を取り、実測時速時系列データを生成します。
     * 空白時間帯（深夜休戦）を跨ぐデータはスキップします。
     * @param {Array<{point: number, updatetime: number}>} points 
     * @returns {Array<{x: number, y: number, point: number, isPredict: boolean, realUnixMs: number}>}
     */
    const generateSpeedData = (points) => {
      const data = [];
      if (!points || points.length < 2) return data;
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const elapsedH = (p2.updatetime - currentStartTime) / 3600;

        // 空白の時間帯は時速プロットをスキップ
        if (isRestTimeByElapsed(elapsedH)) continue;

        const dt = p2.updatetime - p1.updatetime;
        const dp = p2.point - p1.point;
        let speed = 0;
        if (dt > 0) speed = (dp / dt) * 3600;
        // 休止時間等で長時間データ間隔が空いた場合の補正
        if (dt > 3600 && dp < 10000) speed = 0;
        data.push({
          x: realElapsedToActiveH(elapsedH),
          y: speed,
          point: p2.point,
          isPredict: false,
          realUnixMs: p2.updatetime * 1000
        });
      }
      return data;
    };

    borderData.push(...generateSpeedData(refBorderDataRaw));
    if (targetUser) {
      userData.push(...generateSpeedData(targetUser.points));
    }

    // 未来の予測時速データ生成（イベント進行中のみ）
    if (latestElapsedH < maxElapsed) {
      let currentBorderPred = refBorderDataRaw[refBorderDataRaw.length - 1].point;
      let currentUserPred = targetUser && targetUser.points.length > 0 ? targetUser.points[targetUser.points.length - 1].point : 0;
      for (let h = Math.ceil(latestElapsedH); h <= maxElapsed; h++) {
        if (isRestTimeByElapsed(h)) continue;
        const unixMs = (currentStartTime + h * 3600) * 1000;
        const activeX = realElapsedToActiveH(h);
        const baseSpeed = refCurve.get(h - 1) || 10000;
        const borderSpeed = baseSpeed * refInflation;
        currentBorderPred += borderSpeed;
        borderData.push({ x: activeX, y: borderSpeed, point: currentBorderPred, isPredict: true, realUnixMs: unixMs });
        if (targetUser) {
          currentUserPred += borderSpeed * userPace;
          userData.push({ x: activeX, y: borderSpeed * userPace, point: currentUserPred, isPredict: true, realUnixMs: unixMs });
        }
      }
    }
  }

  renderChartjs(userId, targetUser, refBorderName, borderData, userData, currentStartTime, latestUnixMs, chartType);

  const modal = document.getElementById('chartModal');
  modal.classList.remove('hidden');
  requestAnimationFrame(() => {
    modal.classList.remove('opacity-0');
  });
};

/**
 * グラフモーダルをフェードアウトアニメーションとともに閉じます。
 * 
 * 【背景・意図】
 * 急にモーダルが消えるのではなく、300ミリ秒のCSS transition opacity アニメーションを経て
 * 非表示（hidden）にすることで、滑らかなユーザー体験を提供します。
 * 
 * @returns {void}
 */
window.closeChartModal = function () {
  const modal = document.getElementById('chartModal');
  modal.classList.add('opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
};

// モーダルの背景黒透過領域をクリックした際にモーダルを閉じるイベントハンドラ
document.getElementById('chartModal').addEventListener('click', (e) => {
  if (e.target.id === 'chartModal') closeChartModal();
});

/**
 * 選択中の期間フェーズにおいて、期間内で増加した貢献度（開始〜終了/最新）を算出し、
 * グラフ上部のサマリー表示領域（#modalIncreaseSummary）を更新します。
 * 
 * 【背景・意図】
 * ユーザーが日別グラフや全期間グラフを見た際に、「この期間で結局どれだけ貢献度が増えたのか」を
 * グラフ上の数値を暗算・引き算することなく一目で直感的に把握できるように、期間内純増量を上部に明記します。
 * 
 * @param {string} phaseId - 選択されたフェーズID ('all', 'qualify', 'interval', 'day1', etc.)
 * @param {Array} phaseBorderData - 当該フェーズに属するボーダーデータ配列
 * @param {Array} phaseUserData - 当該フェーズに属するユーザーデータ配列
 * @param {string} refBorderName - ボーダー名称（'10万位ボーダー' または '2000位ボーダー'）
 * @param {object|null} targetUser - 対象ユーザーオブジェクト
 * @returns {void}
 */
/**
 * 期間内増加量数値をトグル可能なHTMLとして生成するヘルパー関数。
 * 
 * 【背景・意図】
 * 「+1.5517億のところ、タップしたら正確な数字が出るようにしてほしい」という要求に対応し、
 * タップ（クリック）で略記（例: +1.5517億）と正確なフル桁数値（例: +155,170,000）を
 * 相互にトグル切り替え可能にします。
 * 点線アンダーラインとポインターカーソルにより、タップ可能であることを直感的に案内します。
 * 
 * @param {number} num - 増加量数値
 * @param {string} colorClass - テキスト色・フォントウェイトクラス
 * @param {string} [subPrefix=''] - 接頭ラベル（例: '(着地予測 '）
 * @param {string} [subSuffix=''] - 接尾ラベル（例: ')'）
 * @returns {string} トグル用HTMLスパン文字列
 */
/**
 * 期間内増加量または累計貢献度数値をトグル可能なHTMLとして生成するヘルパー関数。
 * 
 * 【背景・意図】
 * 「+1.5517億のところ、タップしたら正確な数字が出るようにしてほしい」という要求に対応し、
 * タップ（クリック）で略記（例: 1.5517億）と正確なフル桁数値（例: 155,170,000）を
 * 相互にトグル切り替え可能にします。
 * 全期間表示時は「増加量」ではなく「累計貢献度」そのものであるため、showPlus: false で '+' を付けずに表示します。
 * 
 * @param {number} num - 表示対象の数値
 * @param {string} colorClass - テキスト色・フォントウェイトクラス
 * @param {string} [subPrefix=''] - 接頭ラベル（例: '(着地予測 '）
 * @param {string} [subSuffix=''] - 接尾ラベル（例: ')'）
 * @param {boolean} [showPlus=true] - 先頭に '+' 符号を付与するかどうか（全期間累計時は false）
 * @returns {string} トグル用HTMLスパン文字列
 */
const renderToggleablePoint = (num, colorClass, subPrefix = '', subSuffix = '', showPlus = true) => {
  if (num === undefined || num === null || isNaN(num)) return '-';
  const prefixSign = (showPlus && num > 0) ? '+' : '';
  const shortNum = `${prefixSign}${formatPoint(num)}`;
  const fullNum = `${prefixSign}${Math.round(num).toLocaleString()}`;

  // 1万未満の場合は略記とフル表記が一致するため、トグル機能なしでそのまま表示
  if (shortNum === fullNum) {
    return `<span class="${colorClass}">${subPrefix}${shortNum}${subSuffix}</span>`;
  }

  const currentDisplayNum = isSummaryDetailMode ? fullNum : shortNum;
  return `
    <span class="increase-number-toggle cursor-pointer underline decoration-dotted underline-offset-4 decoration-[#71717a] hover:decoration-current hover:brightness-125 active:opacity-75 transition-all select-none ${colorClass}"
          data-short="${shortNum}"
          data-full="${fullNum}"
          data-prefix="${subPrefix}"
          data-suffix="${subSuffix}"
          title="タップで正確な数値を表示 / 略記切替 (${fullNum})"
          onclick="toggleSummaryNumber(event)">
      ${subPrefix}${currentDisplayNum}${subSuffix}
    </span>
  `;
};

/**
 * グラフ上部の期間内増加量サマリー数値をタップした際に、略記（億・万）と正確なフル桁実数値をトグル切り替えします。
 * 
 * 【背景・意図】
 * 「+1.5517億のところ、タップしたら正確な数字が出るようにしてほしい」という要求に対応し、
 * タップで即座に正確なカンマ区切り数値を表示・トグルできるようにします。
 * 一度タップしたモード（略記 or 詳細）は状態として保持され、他の期間タブに切り替えても維持されます。
 * 
 * @param {Event} [event] - クリックイベント
 * @returns {void}
 */
window.toggleSummaryNumber = (event) => {
  if (event) {
    event.stopPropagation();
  }
  isSummaryDetailMode = !isSummaryDetailMode;

  const allToggles = document.querySelectorAll('.increase-number-toggle');
  allToggles.forEach(toggleEl => {
    const shortVal = toggleEl.getAttribute('data-short');
    const fullVal = toggleEl.getAttribute('data-full');
    const prefix = toggleEl.getAttribute('data-prefix') || '';
    const suffix = toggleEl.getAttribute('data-suffix') || '';
    if (!shortVal || !fullVal) return;

    const targetVal = isSummaryDetailMode ? fullVal : shortVal;
    toggleEl.textContent = `${prefix}${targetVal}${suffix}`;
  });
};

/**
 * 選択された期間（全期間・予選・インターバル・本戦各日）における貢献度の純増量または累計貢献度を算出し、
 * グラフモーダル上部のサマリー領域に表示します。
 * 
 * 【背景・意図】
 * 全期間は0からスタートするため「差異（増加量）」ではなく、最新の「累計貢献度」そのものを表示し、
 * 各日タブ（予選、インターバル、本戦各日）では当該期間内での純増量を表示します。
 * さらに、タップ操作により正確なフル桁数値（カンマ区切り）と略記（億・万）のトグル切り替えに対応します。
 * 
 * @param {string} phaseId - 選択されたフェーズID ('all', 'qualify', 'interval', 'day1', etc.)
 * @param {Array} phaseBorderData - 当該フェーズに属するボーダーデータ配列
 * @param {Array} phaseUserData - 当該フェーズに属するユーザーデータ配列
 * @param {string} refBorderName - ボーダー名称（'10万位ボーダー' または '2000位ボーダー'）
 * @param {object|null} targetUser - 対象ユーザーオブジェクト
 * @returns {void}
 */
const updateIncreaseSummary = (phaseId, phaseBorderData, phaseUserData, refBorderName, targetUser) => {
  const phaseLabelEl = document.getElementById('summaryPhaseLabel');
  const valuesEl = document.getElementById('summaryValues');
  if (!phaseLabelEl || !valuesEl) return;

  const isAllPeriod = (phaseId === 'all');
  const phaseObj = EVENT_PHASES.find(p => p.id === phaseId);
  const phaseLabel = phaseObj ? phaseObj.label : '期間';

  // 全期間は0スタートの通算であるため「累計貢献度」、各日タブは「◯◯ 増加量」と明記
  if (isAllPeriod) {
    phaseLabelEl.textContent = '累計貢献度';
  } else {
    phaseLabelEl.textContent = `${phaseLabel} 増加量`;
  }

  // データ配列から実測値および予測値を算出する内部関数
  const calcStats = (dataList) => {
    if (!dataList || dataList.length === 0) return { realVal: 0, predVal: null, hasData: false };

    // 実測データ（isPredict: false）
    const realList = dataList.filter(d => !d.isPredict && d.point !== undefined && d.point !== null);
    const hasData = realList.length >= 1;
    let realVal = 0;
    if (hasData) {
      if (isAllPeriod) {
        // 全期間の場合: 0からの累計（最終実測ポイントそのもの）
        realVal = realList[realList.length - 1].point;
      } else {
        // 日別フェーズの場合: 当該期間内の純増量（最終点 - 開始点）
        realVal = realList.length >= 2 ? Math.max(0, realList[realList.length - 1].point - realList[0].point) : 0;
      }
    }

    // 予測データ（isPredict: true）
    const predList = dataList.filter(d => d.isPredict && d.point !== undefined && d.point !== null);
    let predVal = null;
    if (predList.length > 0 && realList.length > 0) {
      if (isAllPeriod) {
        // 全期間の場合: 最終着地予測ポイントそのもの
        predVal = predList[predList.length - 1].point;
      } else {
        // 日別フェーズの場合: 予測増加量（最終予測点 - 期間開始点）
        predVal = Math.max(0, predList[predList.length - 1].point - realList[0].point);
      }
    }

    return { realVal, predVal, hasData };
  };

  const borderStats = calcStats(phaseBorderData);
  const userStats = targetUser ? calcStats(phaseUserData) : null;

  const htmlParts = [];
  const showPlus = !isAllPeriod; // 全期間（累計貢献度）は '+' を付けない

  // 1. ユーザー自身の表示（赤系統カラー）
  if (userStats && userStats.hasData) {
    let userText = renderToggleablePoint(userStats.realVal, 'text-[#ef4444]', '', '', showPlus);
    if (userStats.predVal !== null && userStats.predVal !== userStats.realVal) {
      userText += ` ${renderToggleablePoint(userStats.predVal, 'text-[11px] text-[#fca5a5] font-normal', '(着地予測 ', ')', showPlus)}`;
    }
    htmlParts.push(`
      <div class="flex items-center gap-1.5">
        <span class="text-[#a1a1aa]">${targetUser.name}:</span>
        <strong class="flex items-center gap-1">${userText}</strong>
      </div>
    `);
  }

  // 区切りスラッシュ（ユーザーとボーダーの両方がある場合）
  if (userStats && userStats.hasData && borderStats.hasData) {
    htmlParts.push(`<span class="text-[#52525b] hidden sm:inline">/</span>`);
  }

  // 2. ボーダーの表示（青系統カラー）
  if (borderStats.hasData) {
    let borderText = renderToggleablePoint(borderStats.realVal, 'text-[#60a5fa]', '', '', showPlus);
    if (borderStats.predVal !== null && borderStats.predVal !== borderStats.realVal) {
      borderText += ` ${renderToggleablePoint(borderStats.predVal, 'text-[11px] text-[#93c5fd] font-normal', '(着地予測 ', ')', showPlus)}`;
    }
    htmlParts.push(`
      <div class="flex items-center gap-1.5">
        <span class="text-[#a1a1aa]">${refBorderName}:</span>
        <strong class="flex items-center gap-1">${borderText}</strong>
      </div>
    `);
  }

  if (htmlParts.length === 0) {
    valuesEl.innerHTML = `<span class="text-[#71717a]">-</span>`;
  } else {
    valuesEl.innerHTML = htmlParts.join('');
  }
};

/**
 * Chart.jsを用いてモーダル内にグラフを描画し、予選・インターバル・n日目の期間切替UIを初期化します。
 * 
 * 【背景・意図】
 * 日付別ではなく「予選」「インターバル」「本戦1日目」〜「本戦4日目」というゲーム内フェーズ単位で
 * ワンタップ切り替えができるようにし、各期間のバトル時間（07:00〜24:00）を拡大表示します。
 * また、モバイル操作性を高めるためにタップ領域の確保や文字サイズ、x軸目盛り数をレスポンシブに調整します。
 * 
 * @param {string} userId - 対象ユーザーID
 * @param {object|null} targetUser - 対象ユーザーオブジェクト
 * @param {string} refBorderName - 比較ボーダー名（'10万位ボーダー' または '2000位ボーダー'）
 * @param {Array} borderData - ボーダーの時系列・予測データ配列
 * @param {Array} userData - ユーザーの時系列・予測データ配列
 * @param {number} currentStartTime - 古戦場開始のUNIXタイムスタンプ（秒）
 * @param {number} latestUnixMs - 最新のデータ更新UNIXミリ秒
 * @param {'point'|'speed'} chartType - グラフの種類（'point' または 'speed'）
 * @returns {void}
 */
const renderChartjs = (userId, targetUser, refBorderName, borderData, userData, currentStartTime, latestUnixMs, chartType) => {
  const ctx = document.getElementById('detailChart').getContext('2d');
  const tabsContainer = document.getElementById('modalDateTabs');
  const modalTitleEl = document.getElementById('modalChartTitle');
  tabsContainer.innerHTML = '';

  // モーダルヘッダータイトルの更新
  if (modalTitleEl) {
    const targetName = targetUser ? `${targetUser.name}` : `${refBorderName}`;
    const typeLabel = chartType === 'speed' ? '時速推移' : '貢献度推移';
    modalTitleEl.textContent = `${targetName} - ${typeLabel}`;
  }

  // 画面幅によるモバイル判定（640px未満をスマホと判定）
  const isMobile = window.innerWidth < 640;

  // 全期間用のマスターデータ保持
  const allBorderData = borderData;
  const allUserData = userData;

  // 現在選択されているフェーズID（初期値: 'all'）
  let currentSelectedPhaseId = 'all';

  // 期間タブボタングループの動的生成
  EVENT_PHASES.forEach(phase => {
    const btn = document.createElement('button');
    btn.className = `px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg font-medium transition-all whitespace-nowrap border border-[#3f3f46] text-[#a1a1aa] hover:bg-[#3f3f46]/50 bg-[#18181b] shrink-0`;
    btn.textContent = phase.label;
    btn.onclick = () => {
      Array.from(tabsContainer.children).forEach(c => {
        c.className = `px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg font-medium transition-all whitespace-nowrap border border-[#3f3f46] text-[#a1a1aa] hover:bg-[#3f3f46]/50 bg-[#18181b] shrink-0`;
      });
      btn.className = `px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg font-bold transition-all whitespace-nowrap border border-[#3b82f6] bg-[#3b82f6]/20 text-[#60a5fa] shrink-0 shadow-sm`;

      currentSelectedPhaseId = phase.id;

      if (myChart) {
        if (phase.id === 'all') {
          // 全期間表示: 全期間マスターデータをセットし、累積活動時間（0h〜121h）全域を表示（夜間0-7時はスキップされ詰めて描画）
          myChart.data.datasets[0].data = allBorderData;
          if (targetUser && myChart.data.datasets[1]) {
            myChart.data.datasets[1].data = allUserData;
          }
          myChart.options.scales.x.min = 0;
          myChart.options.scales.x.max = 121;
          // 【重要】全期間はデータ点が300点以上と過密になり、点同士が密集して線がボコボコと太くなってしまうため、
          // プロット点を非表示（radius: 0）にしてシャープで洗練された細い折れ線で描画します。
          // Chart.jsのキャッシュを回避するため、データセットプロパティだけでなく各メタ要素のoptions.radiusも直接0に設定します。
          myChart.data.datasets.forEach(ds => {
            ds.pointRadius = 0;
            ds.radius = 0;
            ds.pointHoverRadius = ds.label.includes('自分') ? 5 : 4;
            ds.pointHitRadius = 10;
          });
          for (let i = 0; i < myChart.data.datasets.length; i++) {
            const meta = myChart.getDatasetMeta(i);
            if (meta && meta.data) {
              meta.data.forEach(pt => {
                if (pt.options) pt.options.radius = 0;
              });
            }
          }
          updateIncreaseSummary('all', allBorderData, allUserData, refBorderName, targetUser);
        } else {
          // 日別フェーズ表示: 当該フェーズのバトル時間帯のみのデータを抽出し、min/maxをバトル時間ジャストに設定
          const filterFn = d => {
            const realH = (d.realUnixMs / 1000 - currentStartTime) / 3600;
            return realH >= phase.realStartH - 0.01 && realH <= phase.realEndH + 0.01;
          };
          const phaseBorder = allBorderData.filter(filterFn);
          const phaseUser = targetUser ? allUserData.filter(filterFn) : [];
          myChart.data.datasets[0].data = phaseBorder;
          if (targetUser && myChart.data.datasets[1]) {
            myChart.data.datasets[1].data = phaseUser;
          }
          myChart.options.scales.x.min = phase.activeStartH;
          myChart.options.scales.x.max = phase.activeEndH;
          // 日別フェーズは50〜80点と適正な密度の受入範囲内であるため、各時間のデータ点を視認できるようポイントを表示します。
          myChart.data.datasets.forEach(ds => {
            const r = ds.label.includes('自分') ? (isMobile ? 2.5 : 3) : (isMobile ? 1.5 : 2);
            ds.pointRadius = r;
            ds.radius = r;
            ds.pointHoverRadius = ds.label.includes('自分') ? 5 : 4;
            ds.pointHitRadius = 10;
          });
          for (let i = 0; i < myChart.data.datasets.length; i++) {
            const meta = myChart.getDatasetMeta(i);
            if (meta && meta.data) {
              const r = myChart.data.datasets[i].label.includes('自分') ? (isMobile ? 2.5 : 3) : (isMobile ? 1.5 : 2);
              meta.data.forEach(pt => {
                if (pt.options) pt.options.radius = r;
              });
            }
          }
          updateIncreaseSummary(phase.id, phaseBorder, phaseUser, refBorderName, targetUser);
        }
        // 【重要】タブ切り替え時はアニメーションを無効化（'none'）して即座に再描画する。
        // フェーズごとにデータ点配列の要素数（53件、74件、86件等）が異なるため、
        // デフォルトのアニメーション（モーフィング）が有効だとインデックスのズレにより
        // 線が交差・折り返してムチのように飛び出してくる奇妙な描画バグが発生するのを完全に防止します。
        myChart.update('none');
      }
    };
    tabsContainer.appendChild(btn);
  });

  const datasets = [];
  const borderRealIdx = borderData.findIndex(d => d.isPredict);

  // ボーダー曲線のデータセット定義（実測値は実線、予測値は破線 [5, 5] で描画）
  // 【背景・意図】
  // 全期間表示において、300点以上の過密プロットが重なって線が極太になる現象を根絶するため、
  // pointRadius および radius の関数形式コールバックで全期間時は radius: 0 を強制評価させます。
  datasets.push({
    label: refBorderName,
    data: borderData,
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    pointRadius: (ctx) => currentSelectedPhaseId === 'all' ? 0 : (isMobile ? 1.5 : 2),
    radius: (ctx) => currentSelectedPhaseId === 'all' ? 0 : (isMobile ? 1.5 : 2),
    pointHoverRadius: 4,
    pointHitRadius: 10,
    pointBackgroundColor: '#3b82f6',
    segment: {
      borderDash: ctx => ctx.p0DataIndex >= (borderRealIdx === -1 ? Infinity : borderRealIdx - 1) ? [5, 5] : undefined,
      borderColor: ctx => ctx.p0DataIndex >= (borderRealIdx === -1 ? Infinity : borderRealIdx - 1) ? '#60a5fa' : '#3b82f6',
    }
  });

  if (targetUser) {
    const userRealIdx = userData.findIndex(d => d.isPredict);
    // ユーザー自身の曲線のデータセット定義（赤色で際立たせ、予測値は破線描画）
    datasets.push({
      label: targetUser.name + ' (自分)',
      data: userData,
      borderColor: '#ef4444',
      backgroundColor: '#ef4444',
      borderWidth: 2.5,
      pointRadius: (ctx) => currentSelectedPhaseId === 'all' ? 0 : (isMobile ? 2.5 : 3),
      radius: (ctx) => currentSelectedPhaseId === 'all' ? 0 : (isMobile ? 2.5 : 3),
      pointHoverRadius: 5,
      pointHitRadius: 10,
      pointBackgroundColor: '#ef4444',
      segment: {
        borderDash: ctx => ctx.p0DataIndex >= (userRealIdx === -1 ? Infinity : userRealIdx - 1) ? [5, 5] : undefined,
        borderColor: ctx => ctx.p0DataIndex >= (userRealIdx === -1 ? Infinity : userRealIdx - 1) ? '#fca5a5' : '#ef4444',
      }
    });
  }

  // 以前のチャートが存在する場合は必ず破棄してキャンバスをクリーンアップ
  if (myChart) myChart.destroy();

  /**
   * 全期間及び日をまたぐ場合のグラフにおいて、日の切り替わり時刻（24:00 / 0:00）に縦線を描画するプラグイン。
   * 
   * 【背景・意図】
   * 「全期間及び日をまたぐ場合のグラフについて、日の切り替わりのところに線が入るようにしてほしい」という要求に対応。
   * 予選タブ（初日19:00〜翌24:00）における日付変更点（初日24:00＝activeH: 5）や、
   * 全期間タブ（149h）における各日付の終了・開始境界（activeH: 5, 29, 46, 63, 80, 97）に
   * 視認性の高い破線と日付バッジを描画することで、期間の推移を直感的に把握可能にします。
   * 単一日フェーズ（インターバルや本戦各日の7:00〜24:00）では表示範囲外となるため描画されません。
   */
  const dayBoundaryLinePlugin = {
    id: 'dayBoundaryLine',
    afterDatasetsDraw(chart) {
      const { ctx: chartCtx, chartArea, scales: { x: scaleX } } = chart;
      if (!chartArea || !scaleX) return;

      // 日付切り替わり境界の正確な定義（activeH: X軸累積活動時間, realElapsedH: 開始時からの実経過時間）
      // 1. 予選初日終了 / 予選2日目開始 (翌日0:00): realElapsed 5h (activeH: 5)
      // 2. 予選2日目終了 / 3日目開始 (翌日0:00): realElapsed 29h (activeH: 29)
      // 3. インターバル深夜 / 4日目開始 (翌日0:00): realElapsed 53h (activeH: 46)
      // 4. 本戦1日目終了 / 5日目開始 (翌日0:00): realElapsed 77h (activeH: 70)
      // 5. 本戦2日目終了 / 6日目開始 (翌日0:00): realElapsed 101h (activeH: 87)
      // 6. 本戦3日目終了 / 7日目開始 (翌日0:00): realElapsed 125h (activeH: 104)
      const boundaries = [
        { activeH: 5, realElapsedH: 5 },
        { activeH: 29, realElapsedH: 29 },
        { activeH: 46, realElapsedH: 53 },
        { activeH: 70, realElapsedH: 77 },
        { activeH: 87, realElapsedH: 101 },
        { activeH: 104, realElapsedH: 125 }
      ];

      chartCtx.save();
      boundaries.forEach(b => {
        // 現在のx軸の表示範囲内（端点より内側）にあるか判定
        // 単一日フェーズ（min=29, max=46など）の境界端点に余計な重複線が出るのを防ぐため ±0.2 のマージンを設ける
        if (b.activeH <= scaleX.min + 0.2 || b.activeH >= scaleX.max - 0.2) return;

        const xPos = scaleX.getPixelForValue(b.activeH);
        if (xPos < chartArea.left || xPos > chartArea.right) return;

        // 垂直破線の描画
        chartCtx.beginPath();
        chartCtx.setLineDash([4, 4]);
        chartCtx.strokeStyle = 'rgba(244, 244, 245, 0.45)';
        chartCtx.lineWidth = 1.5;
        chartCtx.moveTo(xPos, chartArea.top);
        chartCtx.lineTo(xPos, chartArea.bottom);
        chartCtx.stroke();

        // 日付・時刻ラベル（例: "9/23 0:00"）
        const dateUnixMs = (currentStartTime + b.realElapsedH * 3600) * 1000;
        const d = new Date(dateUnixMs);
        const dateLabel = `${d.getMonth() + 1}/${d.getDate()} 0:00`;

        chartCtx.setLineDash([]);
        chartCtx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const textWidth = chartCtx.measureText(dateLabel).width;
        const badgePaddingX = 4;
        const badgeHeight = 15;
        const badgeY = chartArea.top + 4;

        // 背景ピルバッジの描画（グラフ線と重なっても文字が確実に読めるようにする）
        chartCtx.fillStyle = 'rgba(24, 24, 27, 0.88)';
        chartCtx.fillRect(xPos - textWidth / 2 - badgePaddingX, badgeY, textWidth + badgePaddingX * 2, badgeHeight);
        chartCtx.strokeStyle = 'rgba(113, 113, 122, 0.6)';
        chartCtx.lineWidth = 1;
        chartCtx.strokeRect(xPos - textWidth / 2 - badgePaddingX, badgeY, textWidth + badgePaddingX * 2, badgeHeight);

        // ラベルテキストの描画
        chartCtx.fillStyle = '#e4e4e7';
        chartCtx.textAlign = 'center';
        chartCtx.textBaseline = 'middle';
        chartCtx.fillText(dateLabel, xPos, badgeY + badgeHeight / 2);
      });
      chartCtx.restore();
    }
  };

  myChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    plugins: [dayBoundaryLinePlugin],
    options: {
      animation: false, // 【重要】データ要素数の異なるフェーズ間での補間モーフィング歪み・斜め線ループ現象を根絶するため全アニメーションを完全無効化
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: {
          display: true,
          text: chartType === 'speed' ? '速度(万/時)' : '貢献度(億)',
          color: '#71717a',
          align: 'start',
          font: { size: isMobile ? 11 : 12, weight: 'normal' },
          padding: { bottom: 8 }
        },
        legend: {
          labels: { color: '#e4e4e7', font: { size: isMobile ? 12 : 14, weight: 'bold' } }
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              const raw = context[0].raw;
              let unixMs = raw.realUnixMs;
              if (!unixMs) {
                const realElapsed = getRealElapsedForPhase(raw.x, currentSelectedPhaseId);
                unixMs = (currentStartTime + realElapsed * 3600) * 1000;
              }
              const d = new Date(unixMs);
              return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            },
            label: function (context) {
              const label = context.dataset.label || '';
              const isPredict = context.raw.isPredict ? ' (予測)' : '';
              const val = context.raw.y;
              if (chartType === 'speed') {
                return `${label}${isPredict}: ${formatSpeed(val)}/時`;
              }
              return `${label}${isPredict}: ${formatPoint(val)}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          ticks: {
            color: '#a1a1aa',
            callback: function (value) {
              const isAllPeriod = !currentSelectedPhaseId || currentSelectedPhaseId === 'all';
              const realElapsed = getRealElapsedForPhase(value, currentSelectedPhaseId);
              const unixMs = (currentStartTime + realElapsed * 3600) * 1000;
              const d = new Date(unixMs);

              if (isAllPeriod) {
                return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}時`;
              }

              const hours = d.getHours();
              const minutes = d.getMinutes().toString().padStart(2, '0');
              const seg = ACTIVE_SEGMENTS.find(s => s.id === currentSelectedPhaseId);
              if (hours === 0 && minutes === '00' && value !== seg?.activeStartH) {
                return '24:00';
              }
              return `${hours.toString().padStart(2, '0')}:${minutes}`;
            },
            maxTicksLimit: isMobile ? 6 : 10
          },
          grid: { color: '#3f3f46' }
        },
        y: {
          ticks: {
            color: '#a1a1aa',
            callback: function (value) {
              if (chartType === 'speed') return value / 10000;
              if (value >= 100000000) return (value / 100000000).toFixed(1);
              if (value >= 10000) return (value / 10000).toFixed(0) + '万';
              return value;
            }
          },
          grid: { color: '#3f3f46' }
        }
      }
    }
  });

  // 最新データの時刻が含まれる期間フェーズを初期選択状態にする
  let defaultTabIndex = 0;
  if (latestUnixMs) {
    const latestElapsedH = (latestUnixMs / 1000 - currentStartTime) / 3600;
    const foundIdx = EVENT_PHASES.findIndex(phase => {
      if (phase.realStartH === null || phase.realEndH === null) return false;
      return latestElapsedH >= phase.realStartH - 0.01 && latestElapsedH <= phase.realEndH + 0.01;
    });
    if (foundIdx !== -1) {
      defaultTabIndex = foundIdx;
    }
  }

  const tabButtons = Array.from(tabsContainer.children);
  if (tabButtons[defaultTabIndex]) {
    tabButtons[defaultTabIndex].click();
    tabButtons[defaultTabIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
};

// --- IDコピー機能とトースト通知 ---

/**
 * テーブル上のプレイヤー名をクリックした際に対象のプレイヤーIDをクリップボードへコピーします。
 * 
 * 【背景・意図】
 * 親要素（tdセル等）のクリックイベント（グラフモーダル展開など）が発火しないよう
 * `e.stopPropagation()` を実行し、一時的なtextarea要素をDOMに追加・選択してコピーを行い、
 * 成功メッセージを画面上にトースト表示します。
 * 
 * @param {MouseEvent} e - クリックイベント
 * @param {string} id - コピー対象のプレイヤーID
 * @returns {void}
 */
window.copyId = function (e, id) {
  e.stopPropagation();
  const textArea = document.createElement("textarea");
  textArea.value = id;
  textArea.style.position = "fixed";
  textArea.style.opacity = 0;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(`ID: ${id} をコピーしました`);
  } catch (err) {
    console.error('Copy failed', err);
  }
  document.body.removeChild(textArea);
};

/**
 * グラブルのゲーム画面から団員一覧のIDを全自動取得するためのブックマークレット用コードをクリップボードにコピーします。
 * 
 * 【背景・意図】
 * 団員最大30人分のIDを手動で1人ずつメモして入力するのは非常に手間がかかるため、
 * ゲーム内団員ページで実行するだけで全団員IDをカンマ区切りで取得できるJavaScriptワンライナーを提供します。
 * 
 * @returns {void}
 */
window.copyBookmarklet = function () {
  const code = 'javascript:(async()=>{u=JSON.parse(document.getElementById("server-props").textContent).userId;v=window.Game.version;r=await Promise.all([1,2,3].map(i=>fetch(`/guild_main/guild_member_list/${i}?uid=${u}`,{headers:{"X-Requested-With":"XMLHttpRequest","X-VERSION":v}}).then(r=>r.json())));navigator.clipboard.writeText(r.flatMap(j=>j.list.map(m=>m.id)).join(","));})()';
  const textArea = document.createElement("textarea");
  textArea.value = code;
  textArea.style.position = "fixed";
  textArea.style.opacity = 0;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('ブックマークレットをコピーしました');
  } catch (err) {
    console.error('Copy failed', err);
  }
  document.body.removeChild(textArea);
};

/**
 * トースト通知の自動非表示タイマーID。
 * 連続でコピーされた場合に前のタイマーをキャンセルして表示時間を延長するために保持。
 * @type {number|undefined}
 */
let toastTimeout;

/**
 * 画面右下に一時的な通知メッセージ（トースト）を表示します。
 * 
 * 【背景・意図】
 * クリップボードへのコピー等の完了をユーザーに視覚的にフィードバックするためです。
 * 2500ミリ秒（2.5秒）経過後に自動でフェードアウトします。
 * 
 * @param {string} message - トーストに表示するメッセージ
 * @returns {void}
 */
const showToast = (message) => {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = message;
  toast.classList.remove('opacity-0');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('opacity-0');
  }, 2500);
};

// --- ソート機能の実装 ---

/**
 * テーブルヘッダーの各列に対応するソートアイコン（▲/▼）の表示状態を更新します。
 * 
 * 【背景・意図】
 * ユーザーが現在どの列を昇順または降順で並び替えているかを視覚的に明示するためです。
 * 
 * @returns {void}
 */
const updateSortIcons = () => {
  const keys = ['rank', 'point', 'realSpeed', 'todayInc'];
  keys.forEach(k => {
    const iconEl = document.getElementById(`sort-icon-${k}`);
    if (iconEl) {
      if (currentSortKey === k) {
        iconEl.textContent = currentSortOrder === 'asc' ? '▲' : '▼';
        iconEl.classList.remove('opacity-0', 'group-hover:opacity-50');
        iconEl.classList.add('opacity-100');
      } else {
        iconEl.textContent = '▼';
        iconEl.classList.remove('opacity-100');
        iconEl.classList.add('opacity-0', 'group-hover:opacity-50');
      }
    }
  });
};

/**
 * 指定したキー（'rank', 'point', 'realSpeed', 'todayInc'）に基づいてテーブルデータをソートし再描画します。
 * 
 * 【背景・意図】
 * 団員の貢献度順だけでなく、現在最も加速している人（時速順）、本日最も頑張っている人（当日増加量順）、
 * または全体順位順など、様々な観点からランキングを分析可能にするために提供します。
 * 同一キーの連続クリックで昇順／降順を切り替えます。
 * 
 * @param {'rank'|'point'|'realSpeed'|'todayInc'} key - ソート対象のカラムキー
 * @returns {void}
 */
window.handleSort = function (key) {
  if (!globalEventData.tableData || globalEventData.tableData.length === 0) return;

  if (currentSortKey === key) {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortKey = key;
    currentSortOrder = key === 'rank' ? 'asc' : 'desc';
  }

  const sortedData = [...globalEventData.tableData].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];

    // nullまたはundefinedの項目は末尾に送る
    if (valA === null && valB !== null) return 1;
    if (valB === null && valA !== null) return -1;
    if (valA === null && valB === null) return 0;

    if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  renderTable(sortedData);
  updateSortIcons();
};

// --- メイン解析ロジック ---

/**
 * Uint8ArrayバイナリをURLセーフなBase64文字列に変換します。
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
const uint8ArrayToBase64url = (bytes) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * URLセーフなBase64文字列をUint8Arrayバイナリに変換します。
 * @param {string} b64url 
 * @returns {Uint8Array}
 */
const base64urlToUint8Array = (b64url) => {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * 数値配列をLEB128可変長整数（varint）バイト列にエンコードします。
 * @param {number[]} nums 
 * @returns {Uint8Array}
 */
const encodeVarints = (nums) => {
  const bytes = [];
  for (let val of nums) {
    while (val >= 0x80) {
      bytes.push((val & 0x7f) | 0x80);
      val >>>= 7;
    }
    bytes.push(val & 0x7f);
  }
  return new Uint8Array(bytes);
};

/**
 * LEB128可変長整数（varint）バイト列から数値配列を復元します。
 * @param {Uint8Array} bytes 
 * @returns {number[]}
 */
const decodeVarints = (bytes) => {
  const nums = [];
  let val = 0;
  let shift = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    val += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) {
      nums.push(val);
      val = 0;
      shift = 0;
    } else {
      shift += 7;
    }
  }
  return nums;
};

/**
 * deflate-raw でバイナリデータを非同期圧縮します。
 * @param {Uint8Array} bytes 
 * @returns {Promise<Uint8Array>}
 */
const deflateCompress = async (bytes) => {
  const stream = new Response(bytes).body.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * deflate-raw でバイナリデータを非同期解凍します。
 * @param {Uint8Array} bytes 
 * @returns {Promise<Uint8Array>}
 */
const deflateDecompress = async (bytes) => {
  const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * プレイヤーID配列をパイプライン圧縮
 * 【ソート → デルタ圧縮 → varint → DEFLATE → Base64url】
 * を適用して極小のURLセーフBase64文字列に変換します。
 * 
 * @param {string[]} ids - プレイヤーID文字列の配列
 * @returns {Promise<string>} URLセーフなBase64url文字列
 */
const encodeIdsPipeline = async (ids) => {
  const nums = ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n) && n > 0);
  if (nums.length === 0) return '';

  // 1. ソート (昇順)
  nums.sort((a, b) => a - b);

  // 2. デルタ圧縮 (直前のIDとの差分)
  const deltas = [];
  let prev = 0;
  for (const n of nums) {
    deltas.push(n - prev);
    prev = n;
  }

  // 3. varint (可変長整数エンコード)
  const varintBytes = encodeVarints(deltas);

  // 4. DEFLATE (deflate-raw 圧縮)
  let compressedBytes;
  try {
    compressedBytes = await deflateCompress(varintBytes);
  } catch (e) {
    console.warn('DEFLATE compression fallback to varint', e);
    compressedBytes = varintBytes;
  }

  // 5. Base64url エンコード
  return uint8ArrayToBase64url(compressedBytes);
};

/**
 * パイプライン圧縮されたBase64url文字列からプレイヤーID配列を復元します。
 * 【Base64url → DEFLATE解凍 → varint復元 → デルタ復元 → ID配列】
 * 
 * @param {string} b64url - URLセーフBase64文字列
 * @returns {Promise<string[]>} 復元されたプレイヤーID文字列配列
 */
const decodeIdsPipeline = async (b64url) => {
  try {
    // 1. Base64url デコード
    const compressedBytes = base64urlToUint8Array(b64url);

    // 2. DEFLATE 解凍
    let varintBytes;
    try {
      varintBytes = await deflateDecompress(compressedBytes);
    } catch (e) {
      varintBytes = compressedBytes;
    }

    // 3. varint デコード
    const deltas = decodeVarints(varintBytes);

    // 4. デルタ復元
    const ids = [];
    let current = 0;
    for (const d of deltas) {
      current += d;
      ids.push(current.toString());
    }

    return ids;
  } catch (e) {
    console.error('URL parameter decoding error:', e);
    return [];
  }
};

/**
 * 【後方互換用】従来のUint32パックBase64文字列からプレイヤーID配列を復元します。
 * @param {string} b64 - URLセーフBase64エンコード文字列
 * @returns {string[]} 復元されたプレイヤーID文字列配列
 */
const decodeParamToIds = (b64) => {
  try {
    let str = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const binary = atob(str);
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
    const u32 = new Uint32Array(u8.buffer);
    return Array.from(u32).map(n => n.toString());
  } catch (e) {
    return [];
  }
};

/**
 * 検索されたプレイヤーID一覧をブラウザのURLクエリパラメータへ非同期で同期反映します。
 * 
 * 【背景・意図】
 * 4人以上の場合は「ソート → デルタ圧縮 → varint → DEFLATE → Base64url」パイプラインで
 * 極小化されたパラメータ（?z=...）をセットします。
 * 3人以下の場合は可読性を保つため通常のカンマ区切り（?id=...）を採用します。
 * 
 * @param {string[]} ids - プレイヤーID文字列の配列
 * @returns {Promise<void>}
 */
const updateUrlParams = async (ids) => {
  const url = new URL(window.location);
  url.searchParams.delete('id');
  url.searchParams.delete('d');
  url.searchParams.delete('z');

  if (ids && ids.length > 0) {
    if (ids.length >= 4) {
      const encoded = await encodeIdsPipeline(ids);
      if (encoded) {
        url.searchParams.set('z', encoded);
      } else {
        url.searchParams.set('id', ids.join(','));
      }
    } else {
      url.searchParams.set('id', ids.join(','));
    }
  }
  window.history.pushState({}, '', url);
};

/**
 * 現在のブラウザURLのクエリパラメータからプレイヤーID一覧を取得します。
 * 
 * 【対応形式・優先順位】
 * 1. 新パイプライン圧縮パラメータ（?z=...）
 * 2. 従来のUint32短縮パラメータ（?d=...）
 * 3. 従来のカンマ区切りパラメータ（?id=...）
 * 
 * @returns {Promise<string[]>} パースされたプレイヤーID文字列の配列
 */
const getIdsFromUrl = async () => {
  const params = new URLSearchParams(window.location.search);
  // 1. 新パイプライン圧縮パラメータ（?z=...）
  const zParam = params.get('z');
  if (zParam) {
    const decoded = await decodeIdsPipeline(zParam);
    if (decoded.length > 0) return decoded;
  }
  // 2. 従来の短縮パラメータ（?d=...）
  const dParam = params.get('d');
  if (dParam) {
    const decoded = decodeParamToIds(dParam);
    if (decoded.length > 0) return decoded;
  }
  // 3. 従来の通常パラメータ（?id=...）
  const idParam = params.get('id');
  if (idParam) {
    return idParam.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return [];
};

// DOM要素の参照キャッシュ
const inputIdsEl = document.getElementById('inputIds');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingIcon = document.getElementById('loadingIcon');
const btnText = document.getElementById('btnText');
const errorContainer = document.getElementById('errorContainer');
const errorMsg = document.getElementById('errorMsg');
const resultSection = document.getElementById('resultSection');
const tableBody = document.getElementById('tableBody');
const lastUpdateEl = document.getElementById('lastUpdate');
const raidSelectEl = document.getElementById('raidSelect');

/**
 * 選択されている古戦場開催回。
 * 前回の選択状態をローカルストレージ（キー: 'selectedRaidNum'）から復元し、存在しない場合はデフォルトの82回を使用。
 * @type {number}
 */
let currentRaidNum = parseInt(localStorage.getItem('selectedRaidNum')) || 82;

// 開催回セレクトボックスの初期化（第70回〜第100回まで生成）
for (let i = 100; i >= 70; i--) {
  const option = document.createElement('option');
  option.value = i;
  option.textContent = `第${i}回`;
  if (i === currentRaidNum) option.selected = true;
  raidSelectEl.appendChild(option);
}

// 開催回変更時のリスナー。ローカルストレージへ保存し、IDが入力済みの場合は再解析を実行
raidSelectEl.addEventListener('change', (e) => {
  currentRaidNum = parseInt(e.target.value);
  localStorage.setItem('selectedRaidNum', currentRaidNum);
  if (inputIdsEl.value.trim()) {
    handleAnalyze();
  }
});

/**
 * メインの解析・データ取得処理を実行します。
 * 
 * 【背景・意図】
 * 入力された複数のプレイヤーIDおよび選択中の開催回に基づき、
 * 1. 過去3開催分のボーダーデータ（未取得時のみ）
 * 2. 今回開催の10万位ボーダーおよび2000位ボーダー
 * 3. 各プレイヤーのユーザー情報およびポイント履歴
 * をすべて Promise.all で並列非同期取得し、速度計算・当日増加量計算・ボーダー差分計算を行って
 * ランキングテーブルを構築・表示します。
 * 
 * @returns {Promise<void>}
 */
const handleAnalyze = async () => {
  const inputVal = inputIdsEl.value;
  if (!inputVal.trim()) {
    showError('プレイヤーIDを入力してください。');
    await updateUrlParams([]);
    return;
  }

  setLoading(true);

  // カンマまたは空白区切り文字（/[, ]+/）で分割してID配列を生成
  const ids = inputVal.split(/[, ]+/).map(s => s.trim()).filter(s => s.length > 0);
  await updateUrlParams(ids);

  // API用の開催回ID文字列を構築（例: 'teamraid082'）
  const currentRaidId = `teamraid${String(currentRaidNum).padStart(3, '0')}`;
  const pastRaidIds = [
    `teamraid${String(currentRaidNum - 1).padStart(3, '0')}`,
    `teamraid${String(currentRaidNum - 2).padStart(3, '0')}`,
    `teamraid${String(currentRaidNum - 3).padStart(3, '0')}`
  ];

  try {
    // 開催回が変わった場合はキャッシュを無視して過去データを再取得する
    if (globalEventData.pastBorders100k.length === 0 || globalEventData.loadedRaidNum !== currentRaidNum) {
      const pastReqs100k = pastRaidIds.map(id => fetchData(`https://gbf.pub/api/client/gw/line?teamraidid=${id}&type=user&rank=${BORDER_RANK_100K}`).catch(() => []));
      const pastReqs2k = pastRaidIds.map(id => fetchData(`https://gbf.pub/api/client/gw/line?teamraidid=${id}&type=user&rank=${BORDER_RANK_2K}`).catch(() => []));

      globalEventData.pastBorders100k = await Promise.all(pastReqs100k);
      globalEventData.pastBorders2k = await Promise.all(pastReqs2k);
      globalEventData.loadedRaidNum = currentRaidNum;
      globalEventData.activityCurve100k = null;
      globalEventData.activityCurve2k = null;
    }

    const border100kReq = fetchData(`https://gbf.pub/api/client/gw/line?teamraidid=${currentRaidId}&type=user&rank=${BORDER_RANK_100K}`);
    const border2kReq = fetchData(`https://gbf.pub/api/client/gw/line?teamraidid=${currentRaidId}&type=user&rank=${BORDER_RANK_2K}`).catch(() => null);

    const userReqs = ids.map(async (id) => {
      try {
        const userRes = await fetchData(`https://gbf.pub/api/client/gw/user?userid=${id}`);
        const pointRes = await fetchData(`https://gbf.pub/api/client/gw/point?teamraidid=${currentRaidId}&type=user&id=${id}`);
        const userInfo = userRes.length > 0 ? userRes[0] : { name: `ID:${id}`, id };
        return { id, name: userInfo.name, points: pointRes || [] };
      } catch (e) {
        return { id, name: `ID:${id} (取得失敗)`, points: [], error: true };
      }
    });

    const results = await Promise.all([border100kReq, border2kReq, ...userReqs]);
    const currentBorder100k = results[0];
    const currentBorder2k = results[1];
    const usersData = results.slice(2);

    if (!currentBorder100k || currentBorder100k.length === 0) {
      throw new Error('現在のボーダーデータが取得できませんでした。イベントが開始されていない可能性があります。');
    }

    globalEventData.currentBorder100k = currentBorder100k;
    globalEventData.currentBorder2k = currentBorder2k;
    globalEventData.users = {};
    const validUsers = usersData.filter(u => !u.error && u.points.length > 0);
    validUsers.forEach(u => {
      globalEventData.users[u.id] = u;
    });

    const newTableData = [];

    const latestBorder100kData = currentBorder100k[currentBorder100k.length - 1];
    const point100k = latestBorder100kData.point;

    // 10万位ボーダー行の作成
    newTableData.push({
      id: 'border_100k',
      name: '10万位ボーダー',
      rank: BORDER_RANK_100K,
      point: point100k,
      todayInc: calculateTodayIncrease(currentBorder100k),
      realSpeed: calculateSpeedFromPast(currentBorder100k, 3600),
      predictSpeed: calculateSpeedFromPast(currentBorder100k, 1200),
      isBorder: true,
      isReached: true,
      diff: null,
      updatetime: latestBorder100kData.updatetime
    });

    // 2000位ボーダー行の作成（データが存在する場合のみ）
    if (currentBorder2k && currentBorder2k.length > 0) {
      const latestBorder2kData = currentBorder2k[currentBorder2k.length - 1];
      newTableData.push({
        id: 'border_2k',
        name: '2000位ボーダー',
        rank: BORDER_RANK_2K,
        point: latestBorder2kData.point,
        todayInc: calculateTodayIncrease(currentBorder2k),
        realSpeed: calculateSpeedFromPast(currentBorder2k, 3600),
        predictSpeed: calculateSpeedFromPast(currentBorder2k, 1200),
        isBorder: true,
        isReached: true,
        diff: null,
        updatetime: latestBorder2kData.updatetime
      });
    }

    // 団員・指定プレイヤー行の作成
    validUsers.forEach(u => {
      const latestUserData = u.points[u.points.length - 1];
      const latestPoint = latestUserData.point;

      newTableData.push({
        id: u.id,
        name: u.name,
        rank: latestUserData.rank,
        point: latestPoint,
        todayInc: calculateTodayIncrease(u.points),
        realSpeed: calculateSpeedFromPast(u.points, 3600),
        predictSpeed: calculateSpeedFromPast(u.points, 1200),
        isBorder: false,
        isReached: latestPoint >= point100k,
        diff: latestPoint - point100k,
        updatetime: latestUserData.updatetime
      });
    });

    // 初期ソートは貢献度降順
    newTableData.sort((a, b) => b.point - a.point);
    globalEventData.tableData = newTableData;

    lastUpdateEl.textContent = `取得時刻: ${new Date().toLocaleTimeString()}`;
    resultSection.classList.remove('hidden');

    currentSortKey = 'point';
    currentSortOrder = 'desc';
    renderTable([...globalEventData.tableData]);
    updateSortIcons();

  } catch (err) {
    console.error(err);
    showError(err.message || 'データの取得または処理中にエラーが発生しました。');
  } finally {
    setLoading(false);
  }
};

/**
 * 読み込み状態（ローディング）のUI切り替えを制御します。
 * 
 * 【背景・意図】
 * 多重リクエストによるサーバー負荷や処理の混乱を防止するため、ボタンを非活性化し、
 * スピナーアイコンを表示して通信中であることをユーザーに通知します。
 * 
 * @param {boolean} isLoading - ローディング中フラグ
 * @returns {void}
 */
const setLoading = (isLoading) => {
  analyzeBtn.disabled = isLoading;
  if (isLoading) {
    loadingIcon.classList.remove('hidden');
    btnText.textContent = '';
    errorContainer.classList.add('hidden');
    resultSection.classList.add('hidden');
  } else {
    loadingIcon.classList.add('hidden');
    btnText.textContent = 'データ取得';
  }
};

/**
 * エラーメッセージ表示コンテナにメッセージを反映し、画面上に表示します。
 * 
 * 【背景・意図】
 * 不正なIDやAPI通信失敗などのトラブル発生時に、ユーザーへ明確な原因をフィードバックするためです。
 * 
 * @param {string} message - 表示するエラーメッセージ文字列
 * @returns {void}
 */
const showError = (message) => {
  errorMsg.textContent = message;
  errorContainer.classList.remove('hidden');
};

/**
 * 整形済みランキングデータ配列からHTMLテーブル行要素を生成し、DOMへレンダリングします。
 * 
 * 【背景・意図】
 * 各列（全体順位、プレイヤー名、貢献度、時速、当日増加量、10万位差分、更新時刻）の表示を構築します。
 * ボーダー行（10万位・2000位）は行全体を固有のテーマカラー（青・紫）でハイライトし、
 * 10万位未到達のプレイヤーは赤色警告スタイルを適用して、状況をひと目で把握できるようにします。
 * 
 * @param {Array<object>} data - 表示対象のテーブル行データ配列
 * @returns {void}
 */
const renderTable = (data) => {
  // 現在のソート順序を保持（画像エクスポート時に利用）
  currentSortedData = data;
  tableBody.innerHTML = '';

  let userRankCounter = 0; // ボーダー行を除外した順位カウンター

  data.forEach((row, idx) => {
    const tr = document.createElement('tr');

    let displayNum = '';
    if (!row.isBorder) {
      userRankCounter++;
      displayNum = userRankCounter;
    }

    let rowClass = "hover:bg-[#3f3f46]/30 transition-colors";
    let rankClass = "font-mono text-[#71717a]";
    let nameHTML = "";
    let pointClass = "font-mono text-[#e4e4e7]";
    let speedHTML = "-";
    let todayIncHTML = "-";
    let diffHTML = "-";

    const pointStrRaw = row.point !== null ? row.point.toLocaleString() : '-';
    const realSpdStr = row.realSpeed !== null ? formatSpeed(row.realSpeed) : '-';
    const realSpdRaw = row.realSpeed !== null ? Math.round(row.realSpeed).toLocaleString() : '-';
    const predSpdStr = row.predictSpeed !== null ? formatSpeed(row.predictSpeed) : '-';

    if (row.todayInc !== null) todayIncHTML = formatPoint(row.todayInc);
    const todayIncRaw = row.todayInc !== null ? row.todayInc.toLocaleString() : '-';

    const rankStr = row.rank ? row.rank.toLocaleString() + '位' : '-';

    const pointTitle = `貢献度: ${pointStrRaw}`;
    const speedTitle = `実測時速: ${realSpdRaw} /時`;
    const todayIncTitle = `当日増加量: ${todayIncRaw}`;

    if (row.isBorder) {
      if (row.id === 'border_2k') {
        rowClass = "bg-[#4c1d95]/20 hover:bg-[#4c1d95]/40 transition-colors border-y border-[#8b5cf6]/50";
        rankClass = "font-mono font-bold text-[#a78bfa]";
        nameHTML = `<div class="font-bold text-[#a78bfa]">${row.name}</div>`;
        pointClass = "font-mono font-bold text-[#a78bfa]";
        speedHTML = `<div class="text-[#a78bfa]">${realSpdStr}/時</div><div class="text-[#a78bfa]/70">(${predSpdStr})</div>`;
        todayIncHTML = `<span class="text-[#a78bfa]">${formatPoint(row.todayInc)}</span>`;
      } else {
        rowClass = "bg-[#1e3a8a]/20 hover:bg-[#1e3a8a]/40 transition-colors border-y border-[#3b82f6]/50";
        rankClass = "font-mono font-bold text-[#60a5fa]";
        nameHTML = `<div class="font-bold text-[#60a5fa]">${row.name}</div>`;
        pointClass = "font-mono font-bold text-[#60a5fa]";
        speedHTML = `<div class="text-[#60a5fa]">${realSpdStr}/時</div><div class="text-[#60a5fa]/70">(${predSpdStr})</div>`;
        todayIncHTML = `<span class="text-[#60a5fa]">${formatPoint(row.todayInc)}</span>`;
      }
      diffHTML = `<span class="text-[#71717a]">-</span>`;
    } else {
      const nameColorClass = row.isReached ? "text-[#e4e4e7]" : "text-red-400";
      if (!row.isReached) {
        rowClass = "bg-red-900/10 hover:bg-red-900/20 transition-colors";
      }
      nameHTML = `
        <div onclick="copyId(event, '${row.id}')" class="cursor-pointer group select-none inline-block" title="クリックしてIDをコピー">
          <div class="font-medium ${nameColorClass} group-hover:text-[#3b82f6] transition-colors">${row.name}</div>
          <div class="text-xs text-[#71717a] font-mono mt-0.5 group-hover:text-[#3b82f6]/80 transition-colors flex items-center gap-1">
            ID: ${row.id}
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-0 group-hover:opacity-100 transition-opacity"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </div>
        </div>
      `;

      speedHTML = `<div class="text-[#a1a1aa]">${realSpdStr}/時</div><div class="text-[#71717a]">(${predSpdStr})</div>`;

      if (row.diff !== null) {
        const diffClass = row.diff >= 0 ? 'text-emerald-400' : 'text-red-500 font-bold';
        const sign = row.diff >= 0 ? '+' : '';
        diffHTML = `<span class="${diffClass}">${sign}${formatPoint(row.diff)}</span>`;
      }
    }

    tr.className = rowClass;

    const clickableCell = `cursor-pointer hover:bg-[#3f3f46]/40 transition-colors`;

    tr.innerHTML = `
      <td class="px-3 py-4 text-center font-mono text-xs text-[#71717a]">${displayNum}</td>
      <td class="px-5 py-4 ${rankClass}">${rankStr}</td>
      <td class="px-5 py-4">${nameHTML}</td>
      <td class="px-5 py-4 text-right ${pointClass} ${clickableCell}" title="${pointTitle}" onclick="openChartModal('${row.id}', 'point')">${formatPoint(row.point)}</td>
      <td class="px-5 py-4 text-right font-mono text-xs ${clickableCell}" title="${speedTitle}" onclick="openChartModal('${row.id}', 'speed')">${speedHTML}</td>
      <td class="px-5 py-4 text-right font-mono text-[#e4e4e7] ${clickableCell}" title="${todayIncTitle}" onclick="openChartModal('${row.id}', 'point')">${todayIncHTML}</td>
      <td class="px-5 py-4 text-right font-mono text-xs">${diffHTML}</td>
      <td class="px-5 py-4 text-right font-mono text-xs text-[#a1a1aa]">${formatTime(row.updatetime)}</td>
    `;
    tableBody.appendChild(tr);
  });
};

/**
 * ページロード時の初期化処理。
 * URLクエリパラメータからIDを取得し、存在する場合は入力フィールドへ展開して自動解析を実行します。
 * 
 * @returns {void}
 */
const init = async () => {
  const idsFromUrl = await getIdsFromUrl();
  if (idsFromUrl.length > 0) {
    inputIdsEl.value = idsFromUrl.join(', ');
    handleAnalyze();
  }
};

// イベントリスナーの登録
analyzeBtn.addEventListener('click', handleAnalyze);
inputIdsEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAnalyze();
});

// DOM構築完了時に初期化処理を起動
window.addEventListener('DOMContentLoaded', init);

// --- ランキング一覧の動的サイズ画像エクスポート機能 ---

/**
 * 現在のランキングテーブルに表示されているプレイヤーの一覧を
 * 動的なサイズを計算した高解像度Canvasでレンダリングし、PNG画像としてダウンロード保存します。
 * 
 * 【背景・意図】
 * ヘッダーは「第xx回 古戦場 ランキング」（日時・人数なし）。
 * 各行は名前の下に小さくIDを表示（サイトの表示と同様）。
 * 総合順位を小さく表示し、フッター（サイトURL・プレイヤー数）は非表示。
 * レイアウト全体をコンパクトに構成。
 * 
 * @returns {void}
 */
window.exportRankingImage = function () {
  if (!globalEventData.tableData || globalEventData.tableData.length === 0) {
    showToast('出力可能なランキングデータがありません');
    return;
  }

  // 1. ボーダー行（10万位・2000位）を除外し、プレイヤーのみを抽出（現在のソート順を維持）
  const sourceList = (currentSortedData && currentSortedData.length > 0)
    ? currentSortedData
    : globalEventData.tableData;

  const usersList = sourceList.filter(row => !row.isBorder);

  if (usersList.length === 0) {
    showToast('プレイヤーデータが登録されていません');
    return;
  }

  // 2. 動的サイズ計算（コンパクト設計）
  const rowCount = usersList.length;
  const paddingX = 20;
  const headerHeight = 44;      // タイトルヘッダー領域（コンパクト化: 1行のみ）
  const colHeaderHeight = 28;   // テーブル列見出し
  const rowHeight = 40;         // 1行の高さ（名前+ID 2段表示対応）
  const totalHeight = headerHeight + colHeaderHeight + (rowCount * rowHeight);

  // フォント定義ヘルパー
  const fontSans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
  const fontMono = '"SF Pro Text", Consolas, "Liberation Mono", Menlo, monospace';

  // 名前の長さに応じた動的幅計算（最長の名前をCanvasで実測）
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  mCtx.font = `bold 13px ${fontSans}`;
  let maxNameWidth = 100;
  usersList.forEach(u => {
    const w = mCtx.measureText(u.name || '').width;
    if (w > maxNameWidth) maxNameWidth = w;
  });

  // 列のレイアウト幅（#列 | 名前+ID列 | 貢献度+総合順位列）
  const rankColWidth = 36;
  const nameColWidth = Math.max(160, Math.min(300, maxNameWidth + 24));
  const pointColWidth = 180;
  const contentWidth = rankColWidth + nameColWidth + pointColWidth;
  const totalWidth = contentWidth + (paddingX * 2);

  // 3. 高解像度Canvas作成（ctx.scaleを使わず座標・フォントを直接スケール倍で指定し鮮明なテキスト描画を実現）
  const scale = 3;
  const canvas = document.createElement('canvas');
  const W = totalWidth * scale;
  const H = totalHeight * scale;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ピクセルスナップ: 座標を物理ピクセル境界にラウンドしてサブピクセルぼかしを排除
  const s = v => Math.round(v * scale);
  // スケール済みフォントサイズ（フォントラスタライザが実サイズでヒンティングを行うため鮮明になる）
  const sf = size => Math.round(size * scale);

  // 背景描画（深みのあるダークグラデーション）
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#121215');
  bgGrad.addColorStop(1, '#0c0c0e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 外枠カードボーダー
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = scale;
  ctx.strokeRect(scale * 0.5, scale * 0.5, W - scale, H - scale);

  // ヘッダー背景（上部アクセント）
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
  headerGrad.addColorStop(0.5, 'rgba(39, 39, 42, 0.3)');
  headerGrad.addColorStop(1, 'rgba(147, 51, 234, 0.15)');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, s(headerHeight));

  // ヘッダー区切り線
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.moveTo(0, s(headerHeight));
  ctx.lineTo(W, s(headerHeight));
  ctx.stroke();

  // ヘッダータイトル: 「第xx回 古戦場 ランキング」
  ctx.fillStyle = '#f4f4f5';
  ctx.font = `bold ${sf(16)}px ${fontSans}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`第${currentRaidNum}回 古戦場 ランキング`, s(totalWidth / 2), s(headerHeight / 2));

  // 列見出し領域背景
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, s(headerHeight), W, s(colHeaderHeight));

  // 列見出し区切り線
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.moveTo(0, s(headerHeight + colHeaderHeight));
  ctx.lineTo(W, s(headerHeight + colHeaderHeight));
  ctx.stroke();

  // 列見出しテキスト
  ctx.fillStyle = '#71717a';
  ctx.font = `bold ${sf(10)}px ${fontSans}`;
  ctx.textBaseline = 'middle';
  const colTextYPx = s(headerHeight + colHeaderHeight / 2);

  // 各列の X 基準位置（物理ピクセル）
  const xRankPx = s(paddingX);
  const xNamePx = s(paddingX + rankColWidth);
  const xPointPx = s(totalWidth - paddingX);

  ctx.textAlign = 'center';
  ctx.fillText('#', s(paddingX + rankColWidth / 2), colTextYPx);

  ctx.textAlign = 'left';
  ctx.fillText('名前', xNamePx, colTextYPx);

  ctx.textAlign = 'right';
  ctx.fillText('累計貢献度', xPointPx, colTextYPx);

  // データ行描画
  let currentY = headerHeight + colHeaderHeight; // 論理座標で管理
  usersList.forEach((u, idx) => {
    const isEven = idx % 2 === 0;
    const cyPx = s(currentY);
    const rhPx = s(rowHeight);

    // ゼブラ背景
    ctx.fillStyle = isEven ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, cyPx, W, rhPx);

    // 行下部区切り線
    ctx.strokeStyle = 'rgba(63, 63, 70, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xRankPx, cyPx + rhPx);
    ctx.lineTo(xPointPx, cyPx + rhPx);
    ctx.stroke();

    // 順位番号（団内順位）
    const rankNum = idx + 1;
    ctx.textAlign = 'center';
    ctx.font = `bold ${sf(13)}px ${fontMono}`;
    if (rankNum === 1) {
      ctx.fillStyle = '#facc15';
    } else if (rankNum === 2) {
      ctx.fillStyle = '#e2e8f0';
    } else if (rankNum === 3) {
      ctx.fillStyle = '#fb923c';
    } else {
      ctx.fillStyle = '#71717a';
    }
    ctx.fillText(`${rankNum}`, s(paddingX + rankColWidth / 2), s(currentY + rowHeight / 2));

    // プレイヤー名（上段）
    ctx.textAlign = 'left';
    ctx.font = `bold ${sf(13)}px ${fontSans}`;
    ctx.fillStyle = '#f4f4f5';
    ctx.fillText(u.name || '騎空士', xNamePx, s(currentY + 14));

    // プレイヤーID（名前の下に小さく表示）
    ctx.font = `${sf(10)}px ${fontMono}`;
    ctx.fillStyle = '#52525b';
    ctx.fillText(`${u.id}`, xNamePx, s(currentY + 28));

    // 累計貢献度（右寄せ）
    const pointVal = (u.point !== undefined && u.point !== null) ? u.point : 0;
    const pointFullStr = pointVal.toLocaleString();

    ctx.textAlign = 'right';
    ctx.font = `bold ${sf(12)}px ${fontMono}`;
    ctx.fillStyle = '#60a5fa';
    ctx.fillText(pointFullStr, xPointPx, s(currentY + 14));

    // 総合順位（貢献度の下に小さく表示）
    const overallRankStr = u.rank ? `総合 ${u.rank.toLocaleString()}位` : '';
    if (overallRankStr) {
      ctx.font = `${sf(10)}px ${fontSans}`;
      ctx.fillStyle = '#52525b';
      ctx.fillText(overallRankStr, xPointPx, s(currentY + 28));
    }

    currentY += rowHeight;
  });

  // フッターなし（外枠ボーダーのみ）

  // 4. PNGとしてダウンロード
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('画像の生成に失敗しました');
      return;
    }
    const filename = `kosenjo_ranking_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.png`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('順位一覧画像を保存しました');
  }, 'image/png');
};

