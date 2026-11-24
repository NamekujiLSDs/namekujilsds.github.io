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
  pastBordersPromise: null, // 過去データのバックグラウンド取得Promise
  currentBorder100k: [],
  currentBorder2k: [],
  users: {},
  activityCurve100k: null,
  activityCurve2k: null,
  tableData: [] // テーブルのベースデータ
};

/**
 * ストリーミング取得の世代管理ID。
 * 取得途中で開催回変更や再実行が行われた際、古いリクエストの完了コールバックを破棄するために使用。
 * @type {number}
 */
let activeAnalyzeId = 0;

/**
 * 行ID（プレイヤーIDまたはボーダーID）ごとの既存 <tr> 要素キャッシュ。
 * ストリーミング更新やソート時にDOMを再生成せず既存ノードを移動・更新することで、
 * フォーカス喪失・ホバー切れ・チラつきを防ぎます。
 * @type {Map<string, HTMLTableRowElement>}
 */
const tableRowMap = new Map();

/**
 * ストリーミング描画用の requestAnimationFrame 予約ID。
 * 複数リクエストがほぼ同時に完了した場合の連続再描画を1フレームに集約するために使用。
 * @type {number|null}
 */
let streamRenderRafId = null;

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
 * 指定された1時間区間 [h, h+1] が活動時間帯（非休戦時間帯）かどうかを区間中点で判定します。
 * 
 * 【背景・意図】
 * 左端点 h のみで isRestTimeByElapsed(h) を判定すると、各日24:00（h=29, 77, 101, 125）の直後に続く
 * 深夜休戦区間 [24:00, 01:00] が境界マージンにより誤って活動扱いになってしまいます。
 * 区間の中点 (h + 0.5) を ACTIVE_SEGMENTS と照合することで、活動区間と休戦区間を厳密に分離します。
 * 
 * @param {number} h - 開始経過時間（整数時間）
 * @returns {boolean} 区間 [h, h+1] が活動区間であれば true
 */
const isActiveInterval = (h) => {
  const mid = h + 0.5;
  return ACTIVE_SEGMENTS.some(seg => mid >= seg.realStartH && mid <= seg.realEndH);
};

/**
 * 指定した経過時間（時間）が属する活動フェーズ（ACTIVE_SEGMENTS 要素）を返します。
 * 休戦時間中の場合は直前に終了したフェーズを返します。
 * 
 * @param {number} elapsedH - イベント開始からの経過時間（時間）
 * @returns {{id: string, name: string, realStartH: number, realEndH: number, activeStartH: number, activeEndH: number}|null}
 */
const findCurrentSegment = (elapsedH) => {
  const eps = 0.01;
  for (const seg of ACTIVE_SEGMENTS) {
    if (elapsedH >= seg.realStartH - eps && elapsedH <= seg.realEndH + eps) {
      return seg;
    }
  }
  for (let i = ACTIVE_SEGMENTS.length - 1; i >= 0; i--) {
    if (elapsedH > ACTIVE_SEGMENTS[i].realEndH) {
      return ACTIVE_SEGMENTS[i];
    }
  }
  return ACTIVE_SEGMENTS[0] || null;
};

/**
 * 過去開催のボーダー履歴（直近3回分）から、各開催回の最終ポイントで正規化した
 * 「時間別アクティビティ比率曲線（全期間合計 ≒ 1.0）」を生成します。
 * 
 * 【背景・意図】
 * 1. 各過去回の基準時刻を points[0].updatetime（19:40等）ではなく getEventStartTime（19:00 JST）に統一し、
 *    40分前後の時間軸ズレを解消します。
 * 2. 開催回ごとのインフレ規模の違いに引きずられないよう、各回の最終ポイントで正規化した形状プロファイルを
 *    前回重視の指数減衰重み（50% / 30% / 20%）で加重平均します。
 * 3. 深夜休戦区間は isActiveInterval(h) で厳密に 0 とし、休戦跨ぎの補間ノイズを排除します。
 * 
 * @param {Array<Array<{point: number, updatetime: number}>>} pastDataArrays - 過去複数開催分の時系列データ配列（新しい順）
 * @param {number} maxHours - 算出対象の最大経過時間（例: 149時間）
 * @returns {Map<number, number>} 経過時間(h)をキー、1時間あたりの正規化増加比率を値とするMapオブジェクト
 */
const calculateActivityCurve = (pastDataArrays, maxHours) => {
  const curve = new Map();
  const recencyWeights = [0.5, 0.3, 0.2];

  // 各過去回の開始時刻（19:00 JST）と最終ポイントを事前計算
  const preparedPast = (pastDataArrays || [])
    .map((points, idx) => {
      if (!points || points.length < 2) return null;
      const startUnix = getEventStartTime(points[0].updatetime);
      const totalPoint = points[points.length - 1].point;
      if (!totalPoint || totalPoint <= 0) return null;
      return {
        points,
        startUnix,
        totalPoint,
        weight: recencyWeights[idx] ?? 0.15
      };
    })
    .filter(Boolean);

  for (let h = 0; h < maxHours; h++) {
    if (!isActiveInterval(h)) {
      curve.set(h, 0);
      continue;
    }

    let weightedSum = 0;
    let weightTotal = 0;
    preparedPast.forEach(past => {
      const pNow = getInterpolatedPoint(past.points, past.startUnix, h);
      const pNext = getInterpolatedPoint(past.points, past.startUnix, h + 1);
      const inc = Math.max(0, pNext - pNow);
      // 過去データの終端以降など明らかな欠損を除いて加重積算
      if (pNext > 0) {
        weightedSum += (inc / past.totalPoint) * past.weight;
        weightTotal += past.weight;
      }
    });

    curve.set(h, weightTotal > 0 ? weightedSum / weightTotal : 0);
  }

  return curve;
};

/**
 * 正規化アクティビティ曲線の任意の実数区間 [fromH, toH] における積算比率を厳密に計算します。
 * 
 * 【背景・意図】
 * 19:20（72.333h）や19:40（72.667h）といった端数時刻から次の正時（73.0h）までの残り時間ぶんだけ
 * 正確に加算し、また休戦区間（値が0）を跨いでも余計なポイントが加算されないようにします。
 * 
 * @param {Map<number, number>} curve - 正規化アクティビティ曲線
 * @param {number} fromH - 開始経過時間（時間）
 * @param {number} toH - 終了経過時間（時間）
 * @returns {number} 区間 [fromH, toH] の積算比率
 */
const integrateActivityCurve = (curve, fromH, toH) => {
  if (!curve || toH <= fromH) return 0;
  let sum = 0;
  let cur = Math.max(0, fromH);
  while (cur < toH - 1e-9) {
    const hIdx = Math.floor(cur);
    const next = Math.min(toH, hIdx + 1);
    const dt = next - cur;
    sum += (curve.get(hIdx) || 0) * dt;
    cur = next;
  }
  return sum;
};

/**
 * 指定した実数区間 [fromH, toH] に含まれる活動時間（非休戦時間）の合計（時間単位）を返します。
 * 
 * @param {number} fromH - 開始経過時間
 * @param {number} toH - 終了経過時間
 * @returns {number} 活動時間（時間）
 */
const getActiveDuration = (fromH, toH) => {
  if (toH <= fromH) return 0;
  let total = 0;
  for (const seg of ACTIVE_SEGMENTS) {
    const start = Math.max(fromH, seg.realStartH);
    const end = Math.min(toH, seg.realEndH);
    if (end > start) total += (end - start);
  }
  return total;
};

/**
 * 今回開催のボーダー実績と正規化アクティビティ曲線を比較し、
 * 「本日フェーズ残り用」と「明日以降の未来フェーズ用」の推定スケール係数（最終着地規模換算）を算出します。
 * 
 * 【背景・意図】
 * 古戦場は予選・インターバル・本戦1〜4日目で解禁されるHELL難度が段階的に変化するため、
 * 1. 通算累計スケール（イベント全体の規模アンカー）
 * 2. 当該フェーズ内スケール（同じHELL難度での当日ペース）
 * 3. 直近アクティブウィンドウ（最大4時間）スケール（直近の加速・減速）
 * をフェーズ内経過時間に応じた信頼度で動的にブレンドすることで、
 * 開始直後から本戦最終日まで一貫して高精度な着地・時速予測を実現します。
 * 
 * @param {Array<{point: number, updatetime: number}>} currentBorder - 現在開催のボーダーデータ配列
 * @param {Map<number, number>} normCurve - 正規化アクティビティ曲線
 * @param {number} currentStartTime - イベント開始時刻（19:00 JST のUNIX秒）
 * @param {number} latestElapsedH - ボーダーの最新経過時間（時間）
 * @returns {{scaleToday: number, scaleFuture: number, fallbackSpeed: number, currentSeg: object|null}}
 */
const estimateBorderScale = (currentBorder, normCurve, currentStartTime, latestElapsedH) => {
  const currentSeg = findCurrentSegment(latestElapsedH);
  const latestPoint = currentBorder[currentBorder.length - 1].point;

  // 過去データが欠損している場合のフォールバック時速（直近アクティブ区間平均）
  const fallbackStartH = currentSeg ? Math.max(currentSeg.realStartH, latestElapsedH - 4) : Math.max(0, latestElapsedH - 4);
  const fallbackDt = Math.max(0.25, getActiveDuration(fallbackStartH, latestElapsedH));
  const fallbackInc = Math.max(0, latestPoint - getInterpolatedPoint(currentBorder, currentStartTime, fallbackStartH));
  const fallbackSpeed = fallbackInc / fallbackDt;

  // 1. 通算累計スケール（イベント開始〜現在）
  const vTotal = integrateActivityCurve(normCurve, 0, latestElapsedH);
  if (vTotal <= 1e-6 || latestPoint <= 0) {
    return { scaleToday: 0, scaleFuture: 0, fallbackSpeed, currentSeg };
  }
  const sTotal = latestPoint / vTotal;

  // 2. 当該フェーズ内スケール（同じHELL難度・当日内での伸び率）
  const phaseElapsed = currentSeg ? Math.max(0, latestElapsedH - currentSeg.realStartH) : 0;
  let sPhase = sTotal;
  if (currentSeg && phaseElapsed >= 0.5) {
    const pPhaseStart = getInterpolatedPoint(currentBorder, currentStartTime, currentSeg.realStartH);
    const incPhase = Math.max(0, latestPoint - pPhaseStart);
    const vPhase = integrateActivityCurve(normCurve, currentSeg.realStartH, latestElapsedH);
    if (vPhase > 1e-6 && incPhase > 0) {
      const rawPhase = incPhase / vPhase;
      // フェーズ序盤のノイズで極端に暴走しないよう通算アンカー基準で穏当にクランプ
      sPhase = Math.max(sTotal * 0.35, Math.min(sTotal * 2.5, rawPhase));
    }
  }

  // 3. 直近アクティブウィンドウ（当日フェーズ内・最大4時間）のスケール
  let sRecent = sPhase;
  if (currentSeg && phaseElapsed >= 0.5) {
    const recStart = Math.max(currentSeg.realStartH, latestElapsedH - 4);
    const pRecStart = getInterpolatedPoint(currentBorder, currentStartTime, recStart);
    const incRec = Math.max(0, latestPoint - pRecStart);
    const vRec = integrateActivityCurve(normCurve, recStart, latestElapsedH);
    if (vRec > 1e-6 && incRec > 0) {
      const rawRecent = incRec / vRec;
      sRecent = Math.max(sPhase * 0.45, Math.min(sPhase * 2.2, rawRecent));
    }
  }

  // フェーズ内経過時間に応じた信頼度（4時間経過で1.0に到達）
  const conf = Math.min(1, phaseElapsed / 4);
  const scaleToday = (1 - conf) * sTotal + conf * (0.55 * sPhase + 0.30 * sRecent + 0.15 * sTotal);
  const scaleFuture = (1 - conf * 0.7) * sTotal + (conf * 0.7) * (0.60 * sPhase + 0.25 * sRecent + 0.15 * sTotal);

  return { scaleToday, scaleFuture, fallbackSpeed, currentSeg };
};

/**
 * プレイヤーの稼働ペース（基準ボーダーに対する倍率）を「本日残り用」と「明日以降用」に分けて算出します。
 * 
 * 【背景・意図】
 * 従来の直近12時間単一比率では、睡眠・仕事で一時停止しているだけで以後ずっと+0の水平線になり、
 * 逆に数時間だけ全力周回すると24時間ずっと5倍速で走り続ける極端な予測になっていました。
 * 必ずユーザー最新時刻と同一区間のボーダー実績と比較し、「通算水準」「当日フェーズ」「直近4時間」を
 * 組み合わせることで、現実的で安定した個人着地予測を実現します。
 * 
 * @param {Array<{point: number, updatetime: number}>} uPoints - ユーザーのポイント履歴
 * @param {Array<{point: number, updatetime: number}>} refBorderDataRaw - 基準ボーダーのポイント履歴
 * @param {number} currentStartTime - イベント開始時刻（19:00 JST のUNIX秒）
 * @returns {{paceToday: number, paceFuture: number}}
 */
const estimateUserPace = (uPoints, refBorderDataRaw, currentStartTime) => {
  if (!uPoints || uPoints.length === 0 || !refBorderDataRaw || refBorderDataRaw.length === 0) {
    return { paceToday: 1.0, paceFuture: 1.0 };
  }

  const uLatest = uPoints[uPoints.length - 1];
  const uLatestH = (uLatest.updatetime - currentStartTime) / 3600;
  const bAtLatest = getInterpolatedPoint(refBorderDataRaw, currentStartTime, uLatestH);
  const totalRatio = bAtLatest > 0 ? Math.max(0, uLatest.point / bAtLatest) : 1.0;

  const seg = findCurrentSegment(uLatestH);
  const phaseElapsed = seg ? Math.max(0, uLatestH - seg.realStartH) : 0;

  let phaseRatio = totalRatio;
  if (seg && phaseElapsed >= 0.5) {
    const uPhaseStart = getInterpolatedPoint(uPoints, currentStartTime, seg.realStartH);
    const bPhaseStart = getInterpolatedPoint(refBorderDataRaw, currentStartTime, seg.realStartH);
    const uPhaseInc = Math.max(0, uLatest.point - uPhaseStart);
    const bPhaseInc = Math.max(0, bAtLatest - bPhaseStart);
    if (bPhaseInc > 0) {
      phaseRatio = uPhaseInc / bPhaseInc;
    }
  }

  let recentRatio = phaseRatio;
  if (seg && phaseElapsed >= 0.5) {
    const recStart = Math.max(seg.realStartH, uLatestH - 4);
    const uRecStart = getInterpolatedPoint(uPoints, currentStartTime, recStart);
    const bRecStart = getInterpolatedPoint(refBorderDataRaw, currentStartTime, recStart);
    const uRecInc = Math.max(0, uLatest.point - uRecStart);
    const bRecInc = Math.max(0, bAtLatest - bRecStart);
    if (bRecInc > 0) {
      recentRatio = uRecInc / bRecInc;
    }
  }

  // 瞬間風速スパイクによる暴走を抑えるソフト上限
  const maxReasonable = Math.max(totalRatio * 2.5, phaseRatio * 1.8, 1.0);
  const clampedRecent = Math.min(recentRatio, maxReasonable);
  const clampedPhase = Math.min(phaseRatio, Math.max(totalRatio * 3.0, 1.5));

  const conf = Math.min(1, phaseElapsed / 4);
  const paceToday = (1 - conf) * totalRatio + conf * (0.40 * clampedRecent + 0.40 * clampedPhase + 0.20 * totalRatio);
  const paceFuture = (1 - conf * 0.65) * totalRatio + (conf * 0.65) * (0.50 * totalRatio + 0.35 * clampedPhase + 0.15 * clampedRecent);

  return {
    paceToday: Math.max(0, paceToday),
    paceFuture: Math.max(0, paceFuture)
  };
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
window.openChartModal = async function (userId, chartType = 'point') {
  if (!globalEventData.currentBorder100k || globalEventData.currentBorder100k.length === 0) {
    showToast('ボーダー読込中');
    return;
  }

  // バックグラウンドで取得中の過去ボーダーデータがあれば完了を待機（予測曲線の精度確保）
  if (globalEventData.pastBordersPromise) {
    try {
      await globalEventData.pastBordersPromise;
    } catch (e) {
      console.warn('Past border background fetch failed:', e);
    }
  }

  // 初日19:00:00 JSTを開始基準時刻として算出
  const currentStartTime = getEventStartTime(globalEventData.currentBorder100k[0].updatetime);
  // 本戦4日目終了（149時間）までの全期間を対象（SPバトルは貢献度変動がないため除外）
  const maxElapsed = 149;

  if (!globalEventData.activityCurve100k) {
    globalEventData.activityCurve100k = calculateActivityCurve(globalEventData.pastBorders100k, maxElapsed);
    globalEventData.activityCurve2k = calculateActivityCurve(globalEventData.pastBorders2k, maxElapsed);
  }
  const curve100k = globalEventData.activityCurve100k;
  const curve2k = globalEventData.activityCurve2k;

  const latestBorder100k = globalEventData.currentBorder100k[globalEventData.currentBorder100k.length - 1];

  let targetUser = null;
  let is2kTier = false;

  if (userId !== 'border_100k' && userId !== 'border_2k') {
    targetUser = globalEventData.users[userId];
    if (targetUser) {
      const uLatestPoint = targetUser.points[targetUser.points.length - 1].point;
      const border100kLatestPoint = latestBorder100k.point;
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

  const latestRefBorder = refBorderDataRaw[refBorderDataRaw.length - 1];
  const borderLatestElapsedH = (latestRefBorder.updatetime - currentStartTime) / 3600;
  const latestUnixMs = latestRefBorder.updatetime * 1000;

  const borderScale = estimateBorderScale(refBorderDataRaw, refCurve, currentStartTime, borderLatestElapsedH);
  const userPace = targetUser
    ? estimateUserPace(targetUser.points, refBorderDataRaw, currentStartTime)
    : { paceToday: 1.0, paceFuture: 1.0 };

  // 任意の実数区間 [fromH, toH] に対するボーダー予測増分（当日フェーズ残りと未来フェーズでスケールを切り替え）
  const computeBorderPredictedInc = (fromH, toH) => {
    if (toH <= fromH) return 0;
    const todayEndH = borderScale.currentSeg ? borderScale.currentSeg.realEndH : maxElapsed;

    if (borderScale.scaleToday <= 0 && borderScale.scaleFuture <= 0) {
      return getActiveDuration(fromH, toH) * borderScale.fallbackSpeed;
    }

    let inc = 0;
    if (fromH < todayEndH) {
      const splitEnd = Math.min(toH, todayEndH);
      inc += integrateActivityCurve(refCurve, fromH, splitEnd) * borderScale.scaleToday;
    }
    if (toH > todayEndH) {
      const splitStart = Math.max(fromH, todayEndH);
      inc += integrateActivityCurve(refCurve, splitStart, toH) * borderScale.scaleFuture;
    }
    return inc;
  };

  // 任意の実数区間 [fromH, toH] に対するユーザー予測増分
  const computeUserPredictedInc = (fromH, toH) => {
    if (toH <= fromH) return 0;
    const todayEndH = borderScale.currentSeg ? borderScale.currentSeg.realEndH : maxElapsed;
    let inc = 0;
    if (fromH < todayEndH) {
      const splitEnd = Math.min(toH, todayEndH);
      inc += computeBorderPredictedInc(fromH, splitEnd) * userPace.paceToday;
    }
    if (toH > todayEndH) {
      const splitStart = Math.max(fromH, todayEndH);
      inc += computeBorderPredictedInc(splitStart, toH) * userPace.paceFuture;
    }
    return inc;
  };

  // 実測最新時刻より厳密に未来の正時のみから予測点を生成するヘルパー
  // （例: 19:00ジャストの実測がある場合は20:00から開始し、19:00の重複表示を完全防止）
  const appendPredictions = (targetSeries, latestPoint, seriesLatestH, incFn) => {
    if (seriesLatestH >= maxElapsed - 1e-4) return;

    let currentPred = latestPoint;
    let prevH = seriesLatestH;
    const startH = Math.floor(seriesLatestH + 1e-4) + 1;

    for (let h = startH; h <= maxElapsed; h++) {
      if (isRestTimeByElapsed(h)) continue;

      const stepInc = incFn(prevH, h);
      currentPred += stepInc;

      const unixMs = (currentStartTime + h * 3600) * 1000;
      const activeX = realElapsedToActiveH(h);

      if (chartType === 'point') {
        targetSeries.push({
          x: activeX,
          y: currentPred,
          point: currentPred,
          isPredict: true,
          realUnixMs: unixMs
        });
      } else if (isActiveInterval(h - 1)) {
        // 時速グラフでは直前1時間 [h-1, h] が活動区間のときのみプロット（休戦明け朝7:00の0落ちを防止）
        const hourlySpeed = incFn(h - 1, h);
        targetSeries.push({
          x: activeX,
          y: hourlySpeed,
          point: currentPred,
          isPredict: true,
          realUnixMs: unixMs
        });
      }

      prevH = h;
    }
  };

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
  }

  // 3. 未来予測データの追加（ボーダー・ユーザーそれぞれの最新実測時刻より厳密に未来から生成）
  appendPredictions(borderData, latestRefBorder.point, borderLatestElapsedH, computeBorderPredictedInc);
  if (targetUser && targetUser.points.length > 0) {
    const latestUserPt = targetUser.points[targetUser.points.length - 1];
    const userLatestElapsedH = (latestUserPt.updatetime - currentStartTime) / 3600;
    appendPredictions(userData, latestUserPt.point, userLatestElapsedH, computeUserPredictedInc);
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

// Escapeキーで開いているモーダルを閉じる
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('chartModal');
    if (modal && !modal.classList.contains('hidden')) {
      closeChartModal();
    }
  }
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
    <span class="increase-number-toggle cursor-pointer underline decoration-dotted underline-offset-4 decoration-[#52525b] hover:decoration-current hover:brightness-125 active:opacity-75 transition-all select-none ${colorClass}"
          data-short="${shortNum}"
          data-full="${fullNum}"
          data-prefix="${subPrefix}"
          data-suffix="${subSuffix}"
          title="${fullNum}"
          onclick="toggleSummaryNumber(event)">
      ${subPrefix}${currentDisplayNum}${subSuffix}
    </span>
  `;
};

/**
 * グラフ上部の期間内増加量サマリー数値をタップした際に、略記（億・万）と正確なフル桁実数値をトグル切り替えします。
 * 
 * @param {Event} [event] - クリックイベント
 * @returns {void}
 */
window.toggleSummaryNumber = (event) => {
  if (event) {
    event.stopPropagation();
  }
  isSummaryDetailMode = !isSummaryDetailMode;

  const toggleBtn = document.getElementById('summaryDetailToggle');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', String(isSummaryDetailMode));
  }

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

  const toggleBtn = document.getElementById('summaryDetailToggle');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', String(isSummaryDetailMode));
  }

  // 1. ユーザー自身の表示（実測: 赤 / 予測: オレンジでグラフ線色と統一）
  if (userStats && userStats.hasData) {
    let userText = renderToggleablePoint(userStats.realVal, 'text-[#ef4444]', '', '', showPlus);
    if (userStats.predVal !== null && userStats.predVal !== userStats.realVal) {
      userText += ` ${renderToggleablePoint(userStats.predVal, 'text-[11px] text-[#fb923c] font-normal', '予測 ', '', showPlus)}`;
    }
    htmlParts.push(`
      <div class="inline-flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 text-[#a1a1aa]">
          <span aria-hidden="true" class="inline-block w-2 h-2 rounded-full bg-[#ef4444]"></span>
          <span>${targetUser.name}</span>
        </span>
        <strong class="inline-flex items-center gap-1.5 font-semibold">${userText}</strong>
      </div>
    `);
  }

  // 2. ボーダーの表示（実測: 青 / 予測: シアンでグラフ線色と統一）
  if (borderStats.hasData) {
    let borderText = renderToggleablePoint(borderStats.realVal, 'text-[#60a5fa]', '', '', showPlus);
    if (borderStats.predVal !== null && borderStats.predVal !== borderStats.realVal) {
      borderText += ` ${renderToggleablePoint(borderStats.predVal, 'text-[11px] text-[#22d3ee] font-normal', '予測 ', '', showPlus)}`;
    }
    htmlParts.push(`
      <div class="inline-flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 text-[#a1a1aa]">
          <span aria-hidden="true" class="inline-block w-2 h-2 rounded-full bg-[#3b82f6]"></span>
          <span>${refBorderName}</span>
        </span>
        <strong class="inline-flex items-center gap-1.5 font-semibold">${borderText}</strong>
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
  const modalTypeBadgeEl = document.getElementById('modalChartTypeBadge');
  tabsContainer.innerHTML = '';

  // モーダルヘッダータイトルと種別バッジの更新
  if (modalTitleEl) {
    const targetName = targetUser ? `${targetUser.name}` : `${refBorderName}`;
    modalTitleEl.textContent = targetName;
  }
  if (modalTypeBadgeEl) {
    modalTypeBadgeEl.textContent = chartType === 'speed' ? '時速' : '貢献度';
  }

  // 画面幅によるモバイル判定（640px未満をスマホと判定）
  const isMobile = window.innerWidth < 640;

  // 全期間用のマスターデータ保持
  const allBorderData = borderData;
  const allUserData = userData;

  // 現在選択されているフェーズID（初期値: 'all'）
  let currentSelectedPhaseId = 'all';

  const tabInactiveClass = 'px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors whitespace-nowrap border border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#f4f4f5] bg-[#18181b] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] cursor-pointer';
  const tabActiveClass = 'px-3 py-1.5 text-xs sm:text-sm rounded-md font-semibold transition-colors whitespace-nowrap border border-[#3b82f6]/60 bg-[#3b82f6]/15 text-[#93c5fd] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] cursor-pointer';

  // 期間タブボタングループの動的生成
  EVENT_PHASES.forEach(phase => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = tabInactiveClass;
    btn.textContent = phase.label;
    btn.onclick = () => {
      Array.from(tabsContainer.children).forEach(c => {
        c.className = tabInactiveClass;
      });
      btn.className = tabActiveClass;

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
          // 予測点（isPredict: true）は中抜きひし形が視認しやすいよう少し大きめの半径を適用します。
          myChart.data.datasets.forEach((ds, idx) => {
            const isUser = idx === 1;
            const radiusFn = (ptCtx) => {
              const isPred = Boolean(ptCtx.raw?.isPredict);
              if (isUser) return isPred ? (isMobile ? 3 : 3.5) : (isMobile ? 2.5 : 3);
              return isPred ? (isMobile ? 2.5 : 3) : (isMobile ? 1.5 : 2);
            };
            ds.pointRadius = radiusFn;
            ds.radius = radiusFn;
            ds.pointHoverRadius = isUser ? 5.5 : 5;
            ds.pointHitRadius = 10;
          });
          for (let i = 0; i < myChart.data.datasets.length; i++) {
            const meta = myChart.getDatasetMeta(i);
            const isUser = i === 1;
            const dsData = myChart.data.datasets[i].data || [];
            if (meta && meta.data) {
              meta.data.forEach((pt, idx) => {
                if (pt.options) {
                  const isPred = Boolean(dsData[idx]?.isPredict);
                  pt.options.radius = isUser
                    ? (isPred ? (isMobile ? 3 : 3.5) : (isMobile ? 2.5 : 3))
                    : (isPred ? (isMobile ? 2.5 : 3) : (isMobile ? 1.5 : 2));
                }
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

  // 実測 vs 予測のカラーパレット定義（背景 #1c1c1e に対しコントラスト比 4.5:1〜10:1 超を確保）
  // 寒色（青→シアン）= ボーダー、暖色（赤→オレンジ）= 自分 と対応を保ちつつ色相を大きく分離
  const CHART_COLORS = {
    borderReal: '#3b82f6',
    borderPred: '#22d3ee',
    userReal: '#ef4444',
    userPred: '#fb923c',
    canvasBg: '#1c1c1e'
  };

  // セグメントが予測区間かを各データ点の isPredict フラグから動的に判定
  // （固定インデックス比較だと日別タブ切替時に配列長が変わり予測スタイルが失われるため、raw.isPredict を直接参照）
  const isPredictSegment = (segCtx) => Boolean(segCtx.p1?.raw?.isPredict || segCtx.p0?.raw?.isPredict);

  const hasBorderPredict = allBorderData.some(d => d.isPredict);
  const hasUserPredict = allUserData.some(d => d.isPredict);

  const datasets = [];

  // ボーダー曲線のデータセット定義
  // 実測: 鮮やかなブルー実線＋塗りつぶし丸点 / 予測: 鮮やかなシアン破線＋中抜きひし形点
  datasets.push({
    label: refBorderName,
    data: borderData,
    borderColor: CHART_COLORS.borderReal,
    backgroundColor: CHART_COLORS.borderReal,
    borderWidth: 2.5,
    pointRadius: (ptCtx) => currentSelectedPhaseId === 'all' ? 0 : (ptCtx.raw?.isPredict ? (isMobile ? 2.5 : 3) : (isMobile ? 1.5 : 2)),
    radius: (ptCtx) => currentSelectedPhaseId === 'all' ? 0 : (ptCtx.raw?.isPredict ? (isMobile ? 2.5 : 3) : (isMobile ? 1.5 : 2)),
    pointHoverRadius: 5,
    pointHitRadius: 10,
    pointStyle: (ptCtx) => ptCtx.raw?.isPredict ? 'rectRot' : 'circle',
    pointBackgroundColor: (ptCtx) => ptCtx.raw?.isPredict ? CHART_COLORS.canvasBg : CHART_COLORS.borderReal,
    pointBorderColor: (ptCtx) => ptCtx.raw?.isPredict ? CHART_COLORS.borderPred : CHART_COLORS.borderReal,
    pointBorderWidth: (ptCtx) => ptCtx.raw?.isPredict ? 1.5 : 0,
    segment: {
      borderDash: segCtx => isPredictSegment(segCtx) ? [7, 5] : undefined,
      borderColor: segCtx => isPredictSegment(segCtx) ? CHART_COLORS.borderPred : CHART_COLORS.borderReal,
      borderWidth: segCtx => isPredictSegment(segCtx) ? 2 : 2.5,
    }
  });

  if (targetUser) {
    // ユーザー自身の曲線のデータセット定義
    // 実測: 鮮やかなレッド実線＋塗りつぶし丸点 / 予測: 鮮やかなオレンジ破線＋中抜きひし形点
    datasets.push({
      label: targetUser.name + ' (自分)',
      data: userData,
      borderColor: CHART_COLORS.userReal,
      backgroundColor: CHART_COLORS.userReal,
      borderWidth: 3,
      pointRadius: (ptCtx) => currentSelectedPhaseId === 'all' ? 0 : (ptCtx.raw?.isPredict ? (isMobile ? 3 : 3.5) : (isMobile ? 2.5 : 3)),
      radius: (ptCtx) => currentSelectedPhaseId === 'all' ? 0 : (ptCtx.raw?.isPredict ? (isMobile ? 3 : 3.5) : (isMobile ? 2.5 : 3)),
      pointHoverRadius: 5.5,
      pointHitRadius: 10,
      pointStyle: (ptCtx) => ptCtx.raw?.isPredict ? 'rectRot' : 'circle',
      pointBackgroundColor: (ptCtx) => ptCtx.raw?.isPredict ? CHART_COLORS.canvasBg : CHART_COLORS.userReal,
      pointBorderColor: (ptCtx) => ptCtx.raw?.isPredict ? CHART_COLORS.userPred : CHART_COLORS.userReal,
      pointBorderWidth: (ptCtx) => ptCtx.raw?.isPredict ? 1.8 : 0,
      segment: {
        borderDash: segCtx => isPredictSegment(segCtx) ? [7, 5] : undefined,
        borderColor: segCtx => isPredictSegment(segCtx) ? CHART_COLORS.userPred : CHART_COLORS.userReal,
        borderWidth: segCtx => isPredictSegment(segCtx) ? 2.2 : 3,
      }
    });
  }

  // 以前のチャートが存在する場合は必ず破棄してキャンバスをクリーンアップ
  if (myChart) myChart.destroy();

  // 予測ゾーン用の斜線ハッチングパターンを一度だけ生成
  const createHatchPattern = (targetCtx) => {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 12;
    patternCanvas.height = 12;
    const pCtx = patternCanvas.getContext('2d');
    pCtx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    pCtx.fillRect(0, 0, 12, 12);
    pCtx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
    pCtx.lineWidth = 1;
    pCtx.beginPath();
    pCtx.moveTo(-2, 14);
    pCtx.lineTo(14, -2);
    pCtx.moveTo(-2, 2);
    pCtx.lineTo(2, -2);
    pCtx.moveTo(10, 14);
    pCtx.lineTo(14, 10);
    pCtx.stroke();
    return targetCtx.createPattern(patternCanvas, 'repeat');
  };

  /**
   * 予測エリアの背景シェーディング（斜線ハッチング）および実測→予測の境界ラインを描画するプラグイン。
   * 
   * 【背景・意図】
   * 線色・破線・点形状の差別化に加えて、グラフ空間そのものを「実測エリア（左）」と「予測エリア（右）」で
   * 視覚的に分離することで、ひと目でどこから先が予測値かを直感的に判別できるようにします。
   */
  const predictionZonePlugin = {
    id: 'predictionZone',
    _getZoneGeometry(chart) {
      const { chartArea, scales: { x: scaleX } } = chart;
      if (!chartArea || !scaleX) return null;

      const borderDs = chart.data.datasets[0]?.data || [];
      const hasPredictInView = borderDs.some(d => d.isPredict && d.x >= scaleX.min - 0.01 && d.x <= scaleX.max + 0.01);
      if (!hasPredictInView) return null;

      // 最新実測点（isPredict: false の末尾）の X 座標を特定
      let lastRealX = null;
      for (let i = allBorderData.length - 1; i >= 0; i--) {
        if (!allBorderData[i].isPredict) {
          lastRealX = allBorderData[i].x;
          break;
        }
      }

      if (lastRealX === null || lastRealX <= scaleX.min) {
        // 表示領域の全域が予測エリア（未来の日別タブなど）
        return {
          zoneLeft: chartArea.left,
          zoneRight: chartArea.right,
          splitXPixel: null
        };
      }

      if (lastRealX >= scaleX.max) {
        return null;
      }

      const splitXPixel = Math.max(chartArea.left, Math.min(chartArea.right, scaleX.getPixelForValue(lastRealX)));
      return {
        zoneLeft: splitXPixel,
        zoneRight: chartArea.right,
        splitXPixel
      };
    },
    beforeDatasetsDraw(chart) {
      const geom = this._getZoneGeometry(chart);
      if (!geom) return;
      const { ctx: chartCtx, chartArea } = chart;
      const zoneWidth = geom.zoneRight - geom.zoneLeft;
      if (zoneWidth <= 1) return;

      chartCtx.save();
      chartCtx.fillStyle = createHatchPattern(chartCtx);
      chartCtx.fillRect(geom.zoneLeft, chartArea.top, zoneWidth, chartArea.bottom - chartArea.top);
      chartCtx.restore();
    },
    afterDatasetsDraw(chart) {
      const geom = this._getZoneGeometry(chart);
      if (!geom) return;
      const { ctx: chartCtx, chartArea } = chart;

      chartCtx.save();

      // 実測→予測の切り替わり境界線＋下端「現在 ▸ 予測」バッジ（上部日付バッジと重複しない配置）
      if (geom.splitXPixel !== null && geom.splitXPixel > chartArea.left + 2 && geom.splitXPixel < chartArea.right - 2) {
        chartCtx.beginPath();
        chartCtx.setLineDash([3, 3]);
        chartCtx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
        chartCtx.lineWidth = 1.5;
        chartCtx.moveTo(geom.splitXPixel, chartArea.top);
        chartCtx.lineTo(geom.splitXPixel, chartArea.bottom);
        chartCtx.stroke();

        const nowLabel = '現在';
        chartCtx.setLineDash([]);
        chartCtx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const tw = chartCtx.measureText(nowLabel).width;
        const padX = 6;
        const badgeW = tw + padX * 2;
        const badgeH = 18;
        const badgeX = Math.max(chartArea.left + 4, Math.min(chartArea.right - badgeW - 4, geom.splitXPixel - badgeW / 2));
        const badgeY = chartArea.bottom - badgeH - 6;

        chartCtx.fillStyle = 'rgba(24, 24, 27, 0.92)';
        chartCtx.fillRect(badgeX, badgeY, badgeW, badgeH);
        chartCtx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        chartCtx.lineWidth = 1;
        chartCtx.strokeRect(badgeX, badgeY, badgeW, badgeH);

        chartCtx.fillStyle = '#fde047';
        chartCtx.textAlign = 'center';
        chartCtx.textBaseline = 'middle';
        chartCtx.fillText(nowLabel, badgeX + badgeW / 2, badgeY + badgeH / 2);
      }

      // 予測エリア右上隅に「予測エリア」ラベルバッジを表示（十分な幅がある場合）
      const zoneWidth = geom.zoneRight - geom.zoneLeft;
      if (zoneWidth >= 72) {
        const areaLabel = '予測エリア';
        chartCtx.setLineDash([]);
        chartCtx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const tw = chartCtx.measureText(areaLabel).width;
        const padX = 6;
        const badgeW = tw + padX * 2;
        const badgeH = 17;
        const badgeX = chartArea.right - badgeW - 6;
        const badgeY = chartArea.top + 4;

        chartCtx.fillStyle = 'rgba(24, 24, 27, 0.88)';
        chartCtx.fillRect(badgeX, badgeY, badgeW, badgeH);
        chartCtx.strokeStyle = 'rgba(161, 161, 170, 0.55)';
        chartCtx.lineWidth = 1;
        chartCtx.strokeRect(badgeX, badgeY, badgeW, badgeH);

        chartCtx.fillStyle = '#d4d4d8';
        chartCtx.textAlign = 'center';
        chartCtx.textBaseline = 'middle';
        chartCtx.fillText(areaLabel, badgeX + badgeW / 2, badgeY + badgeH / 2);
      }

      chartCtx.restore();
    }
  };

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
    plugins: [predictionZonePlugin, dayBoundaryLinePlugin],
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
          onClick: (e, legendItem, legend) => {
            const idx = legendItem.datasetIndex;
            const ci = legend.chart;
            ci.setDatasetVisibility(idx, !ci.isDatasetVisible(idx));
            ci.update('none');
          },
          labels: {
            color: '#e4e4e7',
            font: { size: isMobile ? 11 : 13, weight: 'bold' },
            boxWidth: isMobile ? 22 : 28,
            boxHeight: 3,
            padding: isMobile ? 10 : 14,
            generateLabels: (chart) => {
              const items = [];
              chart.data.datasets.forEach((ds, i) => {
                const isHidden = !chart.isDatasetVisible(i);
                const isUser = i === 1;
                const realColor = isUser ? CHART_COLORS.userReal : CHART_COLORS.borderReal;
                const predColor = isUser ? CHART_COLORS.userPred : CHART_COLORS.borderPred;
                const hasPred = isUser ? hasUserPredict : hasBorderPredict;

                items.push({
                  text: hasPred ? `${ds.label} 実測` : ds.label,
                  fillStyle: realColor,
                  strokeStyle: realColor,
                  lineWidth: 3,
                  hidden: isHidden,
                  fontColor: isHidden ? '#71717a' : '#e4e4e7',
                  datasetIndex: i
                });

                if (hasPred) {
                  items.push({
                    text: `${ds.label} 予測`,
                    fillStyle: 'transparent',
                    strokeStyle: predColor,
                    lineWidth: 2.5,
                    lineDash: [5, 3],
                    hidden: isHidden,
                    fontColor: isHidden ? '#71717a' : predColor,
                    datasetIndex: i
                  });
                }
              });
              return items;
            }
          }
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
              const isPredict = context.raw.isPredict ? ' (予測)' : ' (実測)';
              const val = context.raw.y;
              if (chartType === 'speed') {
                return `${label}${isPredict}: ${formatSpeed(val)}/時`;
              }
              return `${label}${isPredict}: ${formatPoint(val)}`;
            },
            labelColor: function (context) {
              const isUser = context.datasetIndex === 1;
              const isPred = Boolean(context.raw?.isPredict);
              const color = isUser
                ? (isPred ? CHART_COLORS.userPred : CHART_COLORS.userReal)
                : (isPred ? CHART_COLORS.borderPred : CHART_COLORS.borderReal);
              return {
                borderColor: color,
                backgroundColor: isPred ? CHART_COLORS.canvasBg : color,
                borderWidth: 2
              };
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
    showToast(`${id} をコピー`);
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
    showToast('団員ID取得コードをコピー');
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
 * テーブルヘッダーの `aria-sort` 属性を更新します（ソート矢印の向き・強調は CSS が自動制御）。
 * 
 * @returns {void}
 */
const updateSortIcons = () => {
  const headers = document.querySelectorAll('th[data-sort-key]');
  headers.forEach(th => {
    const key = th.getAttribute('data-sort-key');
    if (key === currentSortKey) {
      th.setAttribute('aria-sort', currentSortOrder === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('aria-sort');
    }
  });
};

/**
 * 指定されたキーと昇降順でテーブルデータ配列のソート済みコピーを返します。
 * ストリーミング中の逐次挿入およびヘッダークリックによる手動ソートの双方で共通利用します。
 * 
 * @param {Array<object>} data - ソート対象のテーブルデータ配列
 * @param {string} key - ソートキー ('rank'|'point'|'realSpeed'|'todayInc')
 * @param {'asc'|'desc'} order - ソート順序
 * @returns {Array<object>} ソート済み配列
 */
const sortTableData = (data, key, order) => {
  return [...data].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];

    // nullまたはundefinedの項目は末尾に送る
    const isNullA = valA === null || valA === undefined;
    const isNullB = valB === null || valB === undefined;
    if (isNullA && !isNullB) return 1;
    if (isNullB && !isNullA) return -1;
    if (isNullA && isNullB) return 0;

    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * コンテナ内の既存DOMノード群を、要素を再生成せずに指定順へ並び替えます。
 * 接続済みの既存ノードは moveBefore() で状態（フォーカス等）を維持したまま移動し、
 * 新規作成直後の未接続ノードや未対応ブラウザでは append() を使用します。
 * 
 * @param {Element} container - 親コンテナ要素（tbody 等）
 * @param {Element[]} orderedNodes - 並び替え後のノード配列
 * @returns {void}
 */
const reorderNodes = (container, orderedNodes) => {
  const supportsMoveBefore = Object.hasOwn(Element.prototype, 'moveBefore');

  for (const node of orderedNodes) {
    if (supportsMoveBefore && container.isConnected && node.isConnected && node.parentNode === container) {
      container.moveBefore(node, null);
    } else {
      container.append(node);
    }
  }
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

  const sortedData = sortTableData(globalEventData.tableData, currentSortKey, currentSortOrder);
  renderTable(sortedData);
  updateSortIcons();

  // スクリーンリーダーへソート結果を1回だけ通知
  if (srStatusEl) {
    const labelMap = { rank: '全体順位', point: '貢献度', realSpeed: '時速', todayInc: '当日増加量' };
    const orderLabel = currentSortOrder === 'asc' ? '昇順' : '降順';
    srStatusEl.textContent = `${labelMap[key] || key}の${orderLabel}で並び替えました（${sortedData.length}件）`;
  }
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
const resultRaidBadgeEl = document.getElementById('resultRaidBadge');
const resultCountBadgeEl = document.getElementById('resultCountBadge');
const saveImageBtn = document.getElementById('saveImageBtn');
const tableBody = document.getElementById('tableBody');
const lastUpdateEl = document.getElementById('lastUpdate');
const raidSelectEl = document.getElementById('raidSelect');
const streamProgressEl = document.getElementById('streamProgress');
const srStatusEl = document.getElementById('srStatus');

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
 * メインの解析・データ取得処理を実行します（ストリーミング表示対応）。
 * 
 * 【背景・意図】
 * 入力された複数のプレイヤーIDおよび選択中の開催回に基づき、
 * 1. 過去3開催分のボーダーデータ（グラフ予測用・バックグラウンド非同期取得）
 * 2. 今回開催の10万位ボーダーおよび2000位ボーダー
 * 3. 各プレイヤーのユーザー情報およびポイント履歴（ユーザー内も並列取得）
 * をすべて並列起動し、全件完了を待たずに取得できたデータから順次テーブルへ反映（ストリーミング表示）します。
 * 10万位ボーダーが後から到着した場合も、既表示プレイヤー行の10万位差・到達判定を自動再計算して更新します。
 * 
 * @returns {Promise<void>}
 */
const handleAnalyze = async () => {
  const inputVal = inputIdsEl.value;
  if (!inputVal.trim()) {
    showError('プレイヤーIDを入力');
    await updateUrlParams([]);
    return;
  }

  // 新しい取得世代を発行し、前回実行中のストリーミング反映を無効化
  const runId = ++activeAnalyzeId;
  if (streamRenderRafId !== null) {
    cancelAnimationFrame(streamRenderRafId);
    streamRenderRafId = null;
  }

  setLoading(true);

  // カンマまたは空白区切り文字（/[, ]+/）で分割し、重複IDを除去してID配列を生成
  const ids = inputVal.split(/[, ]+/).map(s => s.trim()).filter(s => s.length > 0);
  const uniqueIds = [...new Set(ids)];
  await updateUrlParams(uniqueIds);
  if (runId !== activeAnalyzeId) return;

  // API用の開催回ID文字列を構築（例: 'teamraid085'）
  const currentRaidId = `teamraid${String(currentRaidNum).padStart(3, '0')}`;
  const pastRaidIds = [
    `teamraid${String(currentRaidNum - 1).padStart(3, '0')}`,
    `teamraid${String(currentRaidNum - 2).padStart(3, '0')}`,
    `teamraid${String(currentRaidNum - 3).padStart(3, '0')}`
  ];

  // 状態・テーブルDOMを初期化し、スケルトン行と進捗バーを即座に表示
  globalEventData.currentBorder100k = [];
  globalEventData.currentBorder2k = [];
  globalEventData.users = {};
  globalEventData.tableData = [];
  currentSortedData = [];
  tableRowMap.clear();

  const skeletonRow = `
    <tr data-placeholder="loading" aria-hidden="true">
      <td class="px-3 py-4"><div class="skeleton-bar h-3.5 w-4 mx-auto"></div></td>
      <td class="px-5 py-4"><div class="skeleton-bar h-3.5 w-16"></div></td>
      <td class="px-5 py-4"><div class="skeleton-bar h-3.5 w-28 mb-1.5"></div><div class="skeleton-bar h-2.5 w-16"></div></td>
      <td class="px-5 py-4"><div class="skeleton-bar h-3.5 w-20 ml-auto"></div></td>
      <td class="px-5 py-4"><div class="skeleton-bar h-3.5 w-16 ml-auto"></div></td>
      <td class="px-5 py-4"><div class="skeleton-bar h-3.5 w-16 ml-auto"></div></td>
      <td class="px-5 py-4"><div class="skeleton-bar h-3.5 w-14 ml-auto"></div></td>
      <td class="px-5 py-4"><div class="skeleton-bar h-3.5 w-16 ml-auto"></div></td>
    </tr>
  `;
  tableBody.innerHTML = skeletonRow.repeat(Math.min(3, Math.max(1, uniqueIds.length)));

  if (resultRaidBadgeEl) resultRaidBadgeEl.textContent = `第${currentRaidNum}回`;
  if (resultCountBadgeEl) resultCountBadgeEl.classList.add('hidden');
  if (saveImageBtn) saveImageBtn.disabled = true;

  currentSortKey = 'point';
  currentSortOrder = 'desc';
  updateSortIcons();
  resultSection.classList.remove('hidden');

  const totalTasks = uniqueIds.length + 2; // 10万位ボーダー + 2000位ボーダー + 各プレイヤー
  let completedTasks = 0;
  let completedUsers = 0;
  let point100k = null;

  if (streamProgressEl) {
    streamProgressEl.max = totalTasks;
    streamProgressEl.value = 0;
    streamProgressEl.classList.remove('hidden');
  }
  lastUpdateEl.textContent = `0 / ${uniqueIds.length}`;

  const updateProgressUI = () => {
    if (runId !== activeAnalyzeId) return;
    if (streamProgressEl) streamProgressEl.value = completedTasks;
    lastUpdateEl.textContent = `${completedUsers} / ${uniqueIds.length}`;
    const loadedUsers = Object.keys(globalEventData.users).length;
    if (resultCountBadgeEl && loadedUsers > 0) {
      resultCountBadgeEl.textContent = `${loadedUsers}人`;
      resultCountBadgeEl.classList.remove('hidden');
    }
    if (saveImageBtn) {
      saveImageBtn.disabled = loadedUsers === 0;
    }
  };

  const flushStreamRender = () => {
    streamRenderRafId = null;
    if (runId !== activeAnalyzeId || globalEventData.tableData.length === 0) return;
    const sortedData = sortTableData(globalEventData.tableData, currentSortKey, currentSortOrder);
    renderTable(sortedData);
  };

  const scheduleStreamRender = () => {
    if (runId !== activeAnalyzeId) return;
    if (streamRenderRafId === null) {
      streamRenderRafId = requestAnimationFrame(flushStreamRender);
    }
  };

  try {
    // 過去3回分のボーダーはグラフ予測専用のためバックグラウンド取得し、テーブル表示をブロックしない
    if (globalEventData.pastBorders100k.length === 0 || globalEventData.loadedRaidNum !== currentRaidNum) {
      const targetRaidNum = currentRaidNum;
      globalEventData.loadedRaidNum = targetRaidNum;
      globalEventData.activityCurve100k = null;
      globalEventData.activityCurve2k = null;
      globalEventData.pastBordersPromise = (async () => {
        const pastReqs100k = pastRaidIds.map(id => fetchData(`https://gbf.pub/api/web/gw/line?teamraidid=${id}&type=user&rank=${BORDER_RANK_100K}`).catch(() => []));
        const pastReqs2k = pastRaidIds.map(id => fetchData(`https://gbf.pub/api/web/gw/line?teamraidid=${id}&type=user&rank=${BORDER_RANK_2K}`).catch(() => []));
        const [past100k, past2k] = await Promise.all([Promise.all(pastReqs100k), Promise.all(pastReqs2k)]);
        if (globalEventData.loadedRaidNum === targetRaidNum) {
          globalEventData.pastBorders100k = past100k;
          globalEventData.pastBorders2k = past2k;
        }
      })();
    }

    // 1. 今回開催の10万位ボーダー取得（到着次第テーブルへ反映＆既存プレイヤー行の差分も再計算）
    const border100kTask = fetchData(`https://gbf.pub/api/web/gw/line?teamraidid=${currentRaidId}&type=user&rank=${BORDER_RANK_100K}`)
      .then((data) => {
        if (runId !== activeAnalyzeId) return;
        if (data && data.length > 0) {
          globalEventData.currentBorder100k = data;
          const latest = data[data.length - 1];
          point100k = latest.point;

          globalEventData.tableData.push({
            id: 'border_100k',
            name: '10万位ボーダー',
            rank: BORDER_RANK_100K,
            point: point100k,
            todayInc: calculateTodayIncrease(data),
            realSpeed: calculateSpeedFromPast(data, 3600),
            predictSpeed: calculateSpeedFromPast(data, 1200),
            isBorder: true,
            isReached: true,
            diff: null,
            updatetime: latest.updatetime
          });

          // 先に到着済みのプレイヤー行に対して10万位差・到達判定を遡及反映
          globalEventData.tableData.forEach(row => {
            if (!row.isBorder) {
              row.isReached = row.point >= point100k;
              row.diff = row.point - point100k;
            }
          });

          scheduleStreamRender();
        }
      })
      .catch((e) => {
        console.warn('100k border fetch failed:', e);
      })
      .finally(() => {
        completedTasks++;
        updateProgressUI();
      });

    // 2. 今回開催の2000位ボーダー取得（到着次第テーブルへ反映）
    const border2kTask = fetchData(`https://gbf.pub/api/web/gw/line?teamraidid=${currentRaidId}&type=user&rank=${BORDER_RANK_2K}`)
      .then((data) => {
        if (runId !== activeAnalyzeId) return;
        if (data && data.length > 0) {
          globalEventData.currentBorder2k = data;
          const latest = data[data.length - 1];
          globalEventData.tableData.push({
            id: 'border_2k',
            name: '2000位ボーダー',
            rank: BORDER_RANK_2K,
            point: latest.point,
            todayInc: calculateTodayIncrease(data),
            realSpeed: calculateSpeedFromPast(data, 3600),
            predictSpeed: calculateSpeedFromPast(data, 1200),
            isBorder: true,
            isReached: true,
            diff: null,
            updatetime: latest.updatetime
          });
          scheduleStreamRender();
        }
      })
      .catch(() => null)
      .finally(() => {
        completedTasks++;
        updateProgressUI();
      });

    // 3. 各プレイヤーの情報・ポイント履歴取得（userとpointを並列取得し、完了順にテーブルへ追加）
    const userTasks = uniqueIds.map((id) => (async () => {
      try {
        const [userRes, pointRes] = await Promise.all([
          fetchData(`https://gbf.pub/api/web/gw/user?userid=${id}&username=`).catch(() => []),
          fetchData(`https://gbf.pub/api/web/gw/point?teamraidid=${currentRaidId}&type=user&id=${id}`)
        ]);
        if (runId !== activeAnalyzeId) return;

        const points = pointRes || [];
        if (points.length === 0) return;

        const userInfo = (Array.isArray(userRes) && userRes.length > 0) ? userRes[0] : { name: `ID:${id}`, id };
        const userObj = { id, name: userInfo.name, points };
        globalEventData.users[id] = userObj;

        const latestUserData = points[points.length - 1];
        const latestPoint = latestUserData.point;

        globalEventData.tableData.push({
          id: userObj.id,
          name: userObj.name,
          rank: latestUserData.rank,
          point: latestPoint,
          todayInc: calculateTodayIncrease(points),
          realSpeed: calculateSpeedFromPast(points, 3600),
          predictSpeed: calculateSpeedFromPast(points, 1200),
          isBorder: false,
          isReached: point100k !== null ? latestPoint >= point100k : true,
          diff: point100k !== null ? latestPoint - point100k : null,
          updatetime: latestUserData.updatetime
        });

        scheduleStreamRender();
      } catch (e) {
        console.warn(`User ${id} fetch failed:`, e);
      } finally {
        completedTasks++;
        completedUsers++;
        updateProgressUI();
      }
    })());

    await Promise.all([border100kTask, border2kTask, ...userTasks]);
    if (runId !== activeAnalyzeId) return;

    if (streamRenderRafId !== null) {
      cancelAnimationFrame(streamRenderRafId);
      streamRenderRafId = null;
    }

    if (streamProgressEl) streamProgressEl.classList.add('hidden');

    if (globalEventData.tableData.length === 0) {
      resultSection.classList.add('hidden');
      throw new Error('ボーダーデータを取得できませんでした');
    }

    const finalSorted = sortTableData(globalEventData.tableData, currentSortKey, currentSortOrder);
    renderTable(finalSorted);
    updateSortIcons();
    lastUpdateEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const userCount = Object.keys(globalEventData.users).length;
    if (resultCountBadgeEl && userCount > 0) {
      resultCountBadgeEl.textContent = `${userCount}人`;
      resultCountBadgeEl.classList.remove('hidden');
    }
    if (saveImageBtn) {
      saveImageBtn.disabled = userCount === 0;
    }

    if (!globalEventData.currentBorder100k || globalEventData.currentBorder100k.length === 0) {
      showError('10万位ボーダーを取得できませんでした');
    }

    if (srStatusEl) {
      srStatusEl.textContent = `取得完了（${userCount}人）`;
    }

  } catch (err) {
    if (runId !== activeAnalyzeId) return;
    console.error(err);
    if (streamProgressEl) streamProgressEl.classList.add('hidden');
    showError(err.message || 'データを取得できませんでした');
  } finally {
    if (runId === activeAnalyzeId) {
      setLoading(false);
    }
  }
};

/**
 * 読み込み状態（ローディング）のUI切り替えを制御します。
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
  } else {
    loadingIcon.classList.add('hidden');
    btnText.textContent = 'ランキングを取得';
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
 * 整形済みランキングデータ配列からHTMLテーブル行要素を生成・更新し、既存DOMノードを再利用してレンダリングします。
 * 
 * 【背景・意図】
 * ストリーミング取得中やソート時に毎回 tbody を innerHTML で全破棄すると、ホバー状態やフォーカスが失われ
 * 画面がチラつきます。各行を行ID単位でキャッシュし、内容が変わった行のみ更新、並び順は moveBefore()
 * （未対応ブラウザは append()）でノード移動することで滑らかなストリーミング表示を実現します。
 * 
 * @param {Array<object>} data - 表示対象のテーブル行データ配列
 * @returns {void}
 */
const renderTable = (data) => {
  // 現在のソート順序を保持（画像エクスポート時に利用）
  currentSortedData = data;

  // ローディングプレースホルダー行が存在する場合は除去
  tableBody.querySelectorAll('tr[data-placeholder]').forEach(el => el.remove());

  const activeIds = new Set();
  const orderedNodes = [];
  let userRankCounter = 0; // ボーダー行を除外した順位カウンター

  data.forEach((row) => {
    activeIds.add(row.id);

    let displayNum = '';
    if (!row.isBorder) {
      userRankCounter++;
      displayNum = String(userRankCounter);
    }

    let tr = tableRowMap.get(row.id);
    const isNew = !tr;
    if (isNew) {
      tr = document.createElement('tr');
      tr.dataset.rowId = row.id;
      tableRowMap.set(row.id, tr);
    }

    // 順位列（#）以外の表示内容に影響する値からシグネチャを作成し、変更のない行のDOM再構築を回避
    const rowSignature = `${row.rank}|${row.name}|${row.point}|${row.todayInc}|${row.realSpeed}|${row.predictSpeed}|${row.isReached}|${row.diff}|${row.updatetime}`;

    if (isNew || tr.dataset.rowSignature !== rowSignature) {
      let rowClass = "hover:bg-[#27272a]/50 transition-colors";
      let rankClass = "font-mono tabular-nums text-[#a1a1aa]";
      let nameHTML = "";
      let pointClass = "font-mono tabular-nums font-medium text-[#f4f4f5]";
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

      const pointTitle = pointStrRaw;
      const speedTitle = `${realSpdRaw}/時`;
      const todayIncTitle = todayIncRaw;

      if (row.isBorder) {
        if (row.id === 'border_2k') {
          rowClass = "bg-violet-950/25 hover:bg-violet-950/40 transition-colors border-y border-violet-500/30";
          rankClass = "font-mono tabular-nums font-semibold text-[#c4b5fd]";
          nameHTML = `<div class="font-semibold text-[#c4b5fd]">${row.name}</div>`;
          pointClass = "font-mono tabular-nums font-semibold text-[#c4b5fd]";
          speedHTML = `<div class="text-[#c4b5fd]">${realSpdStr}/時</div><div class="text-[#a78bfa]/70">${predSpdStr}</div>`;
          todayIncHTML = `<span class="text-[#c4b5fd]">${formatPoint(row.todayInc)}</span>`;
        } else {
          rowClass = "bg-blue-950/30 hover:bg-blue-950/45 transition-colors border-y border-blue-500/30";
          rankClass = "font-mono tabular-nums font-semibold text-[#60a5fa]";
          nameHTML = `<div class="font-semibold text-[#60a5fa]">${row.name}</div>`;
          pointClass = "font-mono tabular-nums font-semibold text-[#60a5fa]";
          speedHTML = `<div class="text-[#60a5fa]">${realSpdStr}/時</div><div class="text-[#60a5fa]/70">${predSpdStr}</div>`;
          todayIncHTML = `<span class="text-[#60a5fa]">${formatPoint(row.todayInc)}</span>`;
        }
        diffHTML = `<span class="text-[#52525b]">-</span>`;
      } else {
        const nameColorClass = row.isReached ? "text-[#f4f4f5]" : "text-red-400";
        if (!row.isReached) {
          rowClass = "bg-red-950/20 hover:bg-red-950/35 transition-colors";
        }
        nameHTML = `
          <button type="button" onclick="copyId(event, '${row.id}')" class="text-left cursor-pointer group select-none inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]" aria-label="${row.name} のID ${row.id} をコピー">
            <div class="font-medium ${nameColorClass} group-hover:text-[#60a5fa] transition-colors">${row.name}</div>
            <div class="text-xs text-[#71717a] font-mono tabular-nums mt-0.5 group-hover:text-[#60a5fa]/80 transition-colors flex items-center gap-1">
              <span>${row.id}</span>
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </div>
          </button>
        `;

        speedHTML = `<div class="text-[#d4d4d8]">${realSpdStr}/時</div><div class="text-[#71717a]">${predSpdStr}</div>`;

        if (row.diff !== null) {
          const diffClass = row.diff >= 0 ? 'text-emerald-400' : 'text-red-400 font-semibold';
          const sign = row.diff >= 0 ? '+' : '';
          diffHTML = `<span class="${diffClass}">${sign}${formatPoint(row.diff)}</span>`;
        }
      }

      tr.className = isNew ? `${rowClass} stream-row-enter` : rowClass;

      const clickableCell = `cursor-pointer hover:bg-[#27272a]/70 transition-colors`;

      tr.innerHTML = `
        <td class="px-3 py-3.5 text-center font-mono tabular-nums text-xs text-[#71717a]">${displayNum}</td>
        <td class="px-5 py-3.5 ${rankClass}">${rankStr}</td>
        <td class="px-5 py-3.5">${nameHTML}</td>
        <td class="px-5 py-3.5 text-right ${pointClass} ${clickableCell}" title="${pointTitle}" onclick="openChartModal('${row.id}', 'point')">${formatPoint(row.point)}</td>
        <td class="px-5 py-3.5 text-right font-mono tabular-nums text-xs ${clickableCell}" title="${speedTitle}" onclick="openChartModal('${row.id}', 'speed')">${speedHTML}</td>
        <td class="px-5 py-3.5 text-right font-mono tabular-nums text-[#e4e4e7] ${clickableCell}" title="${todayIncTitle}" onclick="openChartModal('${row.id}', 'point')">${todayIncHTML}</td>
        <td class="px-5 py-3.5 text-right font-mono tabular-nums text-xs">${diffHTML}</td>
        <td class="px-5 py-3.5 text-right font-mono tabular-nums text-xs text-[#71717a]">${formatTime(row.updatetime)}</td>
      `;
      tr.dataset.rowSignature = rowSignature;
    } else if (tr.firstElementChild && tr.firstElementChild.textContent !== displayNum) {
      // 内容に変化がない既存行は団内順位（#）のみ最小更新
      tr.firstElementChild.textContent = displayNum;
    }

    orderedNodes.push(tr);
  });

  // 不要になった古い行ノードを除去
  for (const [id, tr] of tableRowMap.entries()) {
    if (!activeIds.has(id)) {
      tr.remove();
      tableRowMap.delete(id);
    }
  }

  // 既存ノードを再生成せずにソート順へ移動
  reorderNodes(tableBody, orderedNodes);
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

    showToast('PNGを保存');
  }, 'image/png');
};

