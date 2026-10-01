/**
 * @file 団活スカウト文面マネージャー (Scout Text Manager) コントローラー
 * @description
 * 『グランブルーファンタジー』騎空団「ENDROLL」における団員募集（団活タグへのスカウト活動）を支援するクライアントサイドロジック。
 * 
 * 【背景・開発目的】
 * X（旧Twitter）上で同一文面を連続投稿するとスパム判定・シャドウバンを受けるリスクが高まります。
 * これを防ぐため、4カテゴリ・計480種の文面をスクリプト内部で自動生成し、
 * クリップボードへのコピー回数を localStorage に記録して「最も使用回数の少ない文面」から優先的に
 * ワンクリックでコピー・ローテーション使用できるように設計されています。
 * 
 * 【最新方針反映】
 * - 詳細はすべて添付画像（ENDROLL募集バナー）へ誘導する構成
 * - 全480種の文面が「140文字以内（改行込み）」を厳格に遵守（115〜132文字）
 * - 相手への過度な褒め言葉を排除し、誠実で礼儀正しい自然なビジネス調
 * - 「団員です」等の自己言及を排除し、騎空団「ENDROLL」として発信
 * - 5種類の勧誘バナー画像をランダムにクリップボードへ直接コピーする画像コピーシステムを搭載
 * - 絵文字は一切使用せず、Google Material Symbols を採用
 * 
 * 【コーディング規約遵守事項】
 * - 全関数にJSDocコメント、処理の意図（Why）と動作（What）を明記
 */

'use strict';

/**
 * @typedef {'ikusei_reply' | 'ikusei_dm' | 'ippan_reply' | 'ippan_dm'} CategoryType
 * カテゴリ識別子の定義
 */

/**
 * @typedef {Object} ScoutTextItem
 * @property {string} id - 一意識別子 (例: "ir_001", "pd_120")
 * @property {CategoryType} cat - 所属カテゴリ
 * @property {string} text - 結合済みの本文文字列
 * @property {number} length - 文字数 (JavaScript文字長)
 * @property {number} initialIndex - 同率ソート時の安定性を担保するための初期登録順
 */

/**
 * ==========================================================================
 * 1. 定数定義 & 文面生成パーツデータ
 * ==========================================================================
 */

/**
 * localStorageに保存する際のキー名
 * v2スキーマとして独立させ、旧バージョンのデータとの競合を防止する。
 * @type {string}
 */
const STORAGE_KEY = 'grablue_scout_counts_v2';

/**
 * 団運営連絡先Xアカウント
 * 入団希望や問い合わせ窓口として文面内で誘導する。
 * @type {string}
 */
const SCOUT_OFFICIAL_ACCOUNT = '@grablue_scout';

/**
 * 勧誘用バナー画像ファイルパス一覧 (全5種)
 * scout/images/ ディレクトリ内に配置されたPNG画像
 * @type {string[]}
 */
const SCOUT_IMAGES = [
  'images/endroll_banner_01.png',
  'images/endroll_banner_02.png',
  'images/endroll_banner_03.png',
  'images/endroll_banner_04.png',
  'images/endroll_banner_05.png'
];

/**
 * 4カテゴリの文節データ定義
 * デカルト積（直積: 6 prefix × 5 body × 4 suffix = 120通り）により、
 * 各カテゴリ120種、全体で480種のユニークな文面を生成する。
 * 
 * 【制約遵守】
 * 1. 詳細は添付画像に誘導（「詳細は添付画像をご確認ください」等）
 * 2. 全パーツの組み合わせにおいて、改行（\n\n）を含めた合計文字数が厳密に140文字以内（実測115〜132文字）
 * 3. 過度な褒め言葉を排除し、礼儀正しく誠実な表現
 * 4. 「団員です」等の自己言及を排除し、団「ENDROLL」として発信
 */
const CATEGORY_CONFIGS = {
  // 育成枠 リプライ (Twitter用: 添付画像誘導 / 140文字以内)
  ikusei_reply: {
    prefix: 'ir',
    p1: [
      '初めまして！団活タグより失礼いたします。\n騎空団「ENDROLL」です。',
      'こんにちは！団活中のところ失礼いたします。\n騎空団「ENDROLL」です。',
      '初めまして！団活の投稿を拝見いたしました。\n騎空団「ENDROLL」です。',
      '初めまして！団員募集の件でご連絡いたしました。\n団「ENDROLL」です。',
      'こんばんは！団活タグよりご連絡失礼いたします。\n団「ENDROLL」です。',
      '初めまして！団活をお見かけしご連絡いたしました。\n「ENDROLL」です。'
    ],
    p2: [
      '当団では現在、育成枠を募集中です！\n詳しい募集条件や方針は添付画像をご確認ください。',
      'ノルマ免除の育成枠はいかがでしょうか？\n活動方針やサポート等の詳細は添付画像にございます。',
      '当団の育成枠をご案内いたします！\nノルマや詳しい入団条件等は添付画像をご確認ください。',
      '意欲重視の育成枠を募集しております！\n詳しい条件や団の環境等は添付画像をご確認ください。',
      '当団では育成枠の仲間を募集中です！\nイベント方針や詳しい待遇は添付画像をご覧ください。'
    ],
    p3: [
      `気になりましたら団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMください！`,
      `詳細は団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）のDMまで！`,
      `少しでも気になりましたら、団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMを！`,
      `ご質問等はお気軽に団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMください！`
    ]
  },

  // 育成枠 DM (添付画像誘導 / 140文字以内)
  ikusei_dm: {
    prefix: 'id',
    p1: [
      '突然のDM失礼いたします。\n騎空団「ENDROLL」よりスカウトのご案内です。',
      '初めまして。団活タグを拝見いたしました。\n騎空団「ENDROLL」です。',
      '初めまして、団活中のところ失礼いたします。\n騎空団「ENDROLL」です。',
      'こんにちは。団活の投稿をお見かけいたしました。\n団「ENDROLL」です。',
      '突然のご連絡失礼いたします。\n騎空団「ENDROLL」よりご連絡いたしました。',
      '初めまして。団員募集の件でご連絡いたしました。\n団「ENDROLL」です。'
    ],
    p2: [
      '当団では現在、育成枠を募集中です。\n詳しい条件や方針は添付画像をご確認ください。',
      'ノルマ免除の育成枠はいかがでしょうか？\n活動方針等の詳細は添付画像にございます。',
      '当団の育成枠をご案内いたします。\n詳しい募集条件や待遇は添付画像をご覧ください。',
      '意欲重視の育成枠を募集しております。\n団の環境やサポート等は添付画像をご確認ください。',
      '当団では育成枠の団員を募集中です。\nイベント方針等の詳細は添付画像をご確認ください。'
    ],
    p3: [
      `ご質問や入団のご相談は、団運営（${SCOUT_OFFICIAL_ACCOUNT}）のDMまでどうぞ！`,
      `ご質問やご相談は団運営（${SCOUT_OFFICIAL_ACCOUNT}）のDMまでお気軽にどうぞ！`,
      `気になる点がございましたら、団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMをお願いします。`,
      `詳細確認や入団希望は、団運営（${SCOUT_OFFICIAL_ACCOUNT}）のDMまでご連絡ください。`
    ]
  },

  // 一般枠 リプライ (Twitter用: 添付画像誘導 / 140文字以内)
  ippan_reply: {
    prefix: 'pr',
    p1: [
      '初めまして！団活タグより失礼いたします。\n騎空団「ENDROLL」です。',
      'こんにちは！団活中のところ失礼いたします。\n騎空団「ENDROLL」です。',
      '初めまして！団活の投稿を拝見いたしました。\n騎空団「ENDROLL」です。',
      '初めまして！団員募集の件でご連絡いたしました。\n団「ENDROLL」です。',
      'こんばんは！団活タグよりご連絡失礼いたします。\n団「ENDROLL」です。',
      '初めまして！団活をお見かけしご連絡いたしました。\n「ENDROLL」です。'
    ],
    p2: [
      '当団は予選300位目標の一般枠を募集中です！\nノルマや詳しい方針は添付画像をご確認ください。',
      '一般枠（予選300位目標/低空なし）の募集です！\n詳しい募集要項は添付画像をご確認ください。',
      '当団の一般枠はいかがでしょうか？\n予選ノルマや団内環境等の詳細は添付画像にございます。',
      '古戦場予選300位狙いの一般枠を募集中です！\n詳しい条件や方針は添付画像をご確認ください。',
      '当団の一般枠をご案内いたします！\n古戦場ノルマや待遇等の詳細は添付画像をご覧ください。'
    ],
    p3: [
      `気になりましたら団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMください！`,
      `詳細は団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）のDMまで！`,
      `少しでも気になりましたら、団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMを！`,
      `ご質問等はお気軽に団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMください！`
    ]
  },

  // 一般枠 DM (添付画像誘導 / 140文字以内)
  ippan_dm: {
    prefix: 'pd',
    p1: [
      '突然のDM失礼いたします。\n騎空団「ENDROLL」より一般枠のご案内です。',
      '初めまして。団活タグを拝見いたしました。\n騎空団「ENDROLL」です。',
      '初めまして、団活中のところ失礼いたします。\n騎空団「ENDROLL」です。',
      'こんにちは。団活の投稿をお見かけいたしました。\n団「ENDROLL」です。',
      '突然のご連絡失礼いたします。\n騎空団「ENDROLL」よりご連絡いたしました。',
      '初めまして。団員募集の件でご連絡いたしました。\n団「ENDROLL」です。'
    ],
    p2: [
      '当団は予選300位目標の一般枠を募集中です。\n募集要項の詳細は添付画像をご確認ください。',
      '当団の一般枠をご案内させていただきます。\n詳しい活動方針やノルマは添付画像をご覧ください。',
      '現在、一般枠の仲間を募集しております。\n古戦場方針やノルマ詳細は添付画像にございます。',
      '当団の一般枠はいかがでしょうか？\n詳しい募集条件や待遇は添付画像をご確認ください。',
      '予選300位目標の一般枠募集となります。\n詳しい条件や方針は添付画像をご確認ください。'
    ],
    p3: [
      `ご質問や入団のご相談は、団運営（${SCOUT_OFFICIAL_ACCOUNT}）のDMまでどうぞ！`,
      `ご質問やご相談は団運営（${SCOUT_OFFICIAL_ACCOUNT}）のDMまでお気軽にどうぞ！`,
      `気になる点がございましたら、団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMをお願いします。`,
      `詳細確認や入団希望は、団運営（${SCOUT_OFFICIAL_ACCOUNT}）のDMまでご連絡ください。`
    ]
  }
};

/**
 * ==========================================================================
 * 2. 文面生成エンジン (FR-01)
 * ==========================================================================
 */

/**
 * 定義された各カテゴリのPrefix/Body/Suffixからデカルト積（直積）を計算し、
 * 計480件（各120件）のScoutTextItemオブジェクト配列を構築する。
 * 各パーツ間には段落改行（\n\n）を挿入し、コピー時および表示時に自然な改行レイアウトを保持する。
 * 
 * @returns {ScoutTextItem[]} 生成された文面アイテムの全配列
 */
function generateScoutTexts() {
  const items = [];
  let globalIndex = 0;

  for (const [catKey, conf] of Object.entries(CATEGORY_CONFIGS)) {
    let catIndex = 0;

    for (let i = 0; i < conf.p1.length; i++) {
      for (let j = 0; j < conf.p2.length; j++) {
        for (let k = 0; k < conf.p3.length; k++) {
          catIndex++;
          globalIndex++;

          // ID命名則: "ir_001", "id_001", "pr_001", "pd_001" 等
          const id = `${conf.prefix}_${String(catIndex).padStart(3, '0')}`;

          // 全カテゴリ共通で段落ごとの自然な空行改行（\n\n）を挿入
          const text = `${conf.p1[i]}\n\n${conf.p2[j]}\n\n${conf.p3[k]}`;

          items.push({
            id,
            cat: /** @type {CategoryType} */ (catKey),
            text,
            length: text.length,
            initialIndex: globalIndex
          });
        }
      }
    }
  }

  return items;
}

/**
 * 生成された全文面データ配列（メモリ内固定）
 * @type {ScoutTextItem[]}
 */
const ALL_DATA = generateScoutTexts();

/**
 * 高速ルックアップ用IDマップ
 * @type {Map<string, ScoutTextItem>}
 */
const DATA_BY_ID = new Map(ALL_DATA.map(item => [item.id, item]));

/**
 * ==========================================================================
 * 3. ストレージ管理 (Persistence Layer: FR-02, FR-07)
 * ==========================================================================
 */

/**
 * プライベートブラウジング環境等でlocalStorageが使用不可の場合に備えたインメモリ退避先
 * @type {Record<string, number>}
 */
let inMemoryCounts = {};

/**
 * localStorageから使用回数辞書を安全に読み出す。
 * 読み出しに失敗した場合（ストレージ無効・JSON破損等）はフォールバックして空辞書を返す。
 * 
 * @returns {Record<string, number>} ID -> 使用回数のマッピング
 */
function loadCounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (typeof parsed === 'object' && parsed !== null) ? parsed : {};
  } catch (error) {
    console.warn('localStorage read warning (falling back to memory):', error);
    return inMemoryCounts;
  }
}

/**
 * 使用回数辞書をlocalStorageに保存する。
 * 
 * @param {Record<string, number>} counts - 保存対象の辞書
 * @returns {void}
 */
function saveCounts(counts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch (error) {
    console.warn('localStorage write warning (saving in memory):', error);
    inMemoryCounts = { ...counts };
  }
}

/**
 * 指定された文面IDの使用回数を+1加算し、永続化する。
 * 
 * @param {string} id - 対象文面のID
 * @returns {number} 更新後の使用回数
 */
function incrementUsageCount(id) {
  const counts = loadCounts();
  const currentCount = counts[id] || 0;
  const newCount = currentCount + 1;
  counts[id] = newCount;
  saveCounts(counts);
  return newCount;
}

/**
 * すべての使用回数カウントを初期化（全消去）する。
 * 
 * @returns {void}
 */
function clearAllCounts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('localStorage remove error:', error);
  }
  inMemoryCounts = {};
}

/**
 * ==========================================================================
 * 4. クリップボード制御 & 画像コピーシステム
 * ==========================================================================
 */

/**
 * トースト非表示タイマーID
 * @type {number|null}
 */
let toastTimeoutId = null;

/**
 * 画面中央下部にトースト通知を表示する。
 * 
 * @param {string} message - 表示するメッセージ
 * @param {number} [duration=1500] - 表示時間（ミリ秒）
 * @returns {void}
 */
function showToast(message, duration = 1500) {
  const toastContainer = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  if (!toastContainer || !toastMessage) return;

  toastMessage.textContent = message;
  toastContainer.classList.add('show');

  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = window.setTimeout(() => {
    toastContainer.classList.remove('show');
    toastTimeoutId = null;
  }, duration);
}

/**
 * 指定したテキストをクリップボードにコピーする。
 * 
 * @param {string} text - コピーする文字列
 * @returns {Promise<boolean>} コピー成否
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, using fallback:', err);
    }
  }

  // レガシーフォールバック処理
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('execCommand copy failed:', err);
    return false;
  }
}

/**
 * 直前に選択された画像のインデックス（連続選択時の重複を防止）
 * @type {number}
 */
let lastChosenImageIndex = -1;

/**
 * ランダムに勧誘画像を選択して取得する。
 * 連続クリック時に同一画像が連続しないよう配慮する。
 * 
 * @returns {string} 選択された画像ファイルのパス
 */
function getRandomScoutImage() {
  if (SCOUT_IMAGES.length === 0) return '';
  if (SCOUT_IMAGES.length === 1) return SCOUT_IMAGES[0];

  let nextIndex = Math.floor(Math.random() * SCOUT_IMAGES.length);
  if (nextIndex === lastChosenImageIndex) {
    nextIndex = (nextIndex + 1) % SCOUT_IMAGES.length;
  }
  lastChosenImageIndex = nextIndex;
  return SCOUT_IMAGES[nextIndex];
}

/**
 * 画像BlobをCanvas経由で厳密な image/png Blob に変換する。
 * ブラウザのクリップボードAPI（ClipboardItem）はPNG形式を要求するため、互換性を保証する。
 * 
 * @param {Blob} blob - 元画像Blob
 * @returns {Promise<Blob>} PNG形式のBlob
 */
function convertBlobToPng(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error('canvas.toBlob failed'));
        }
      }, 'image/png');
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * 指定されたURLの画像データをクリップボードへPNGとしてコピーする。
 * 
 * @param {string} imageUrl - コピー対象の画像パス
 * @returns {Promise<boolean>} コピー成否
 */
async function copyImageToClipboard(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const rawBlob = await res.blob();
    const pngBlob = await convertBlobToPng(rawBlob);

    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      return true;
    } else {
      throw new Error('navigator.clipboard.write with ClipboardItem not supported');
    }
  } catch (err) {
    console.warn('Image clipboard write failed:', err);
    return false;
  }
}

/**
 * 勧誘バナー画像のランダムコピー処理を実行する
 * 
 * @param {HTMLButtonElement|null} [triggerBtn=null] - クリックされたボタン要素
 * @returns {Promise<void>}
 */
async function executeRandomImageCopy(triggerBtn = null) {
  const imagePath = getRandomScoutImage();
  if (!imagePath) return;

  const fileName = imagePath.split('/').pop() || imagePath;

  // サムネイルとラベルの表示を更新
  const thumbEl = /** @type {HTMLImageElement|null} */ (document.getElementById('imagePreviewThumb'));
  const labelEl = document.getElementById('currentImageLabel');
  if (thumbEl) thumbEl.src = imagePath;
  if (labelEl) labelEl.textContent = `現在の選択: ${fileName}`;

  // ボタンをローディング表示
  let originalHtml = '';
  if (triggerBtn) {
    originalHtml = triggerBtn.innerHTML;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = `
      <span class="material-symbols-outlined" aria-hidden="true">sync</span>
      <span>画像処理中...</span>
    `;
  }

  const success = await copyImageToClipboard(imagePath);

  if (triggerBtn) {
    triggerBtn.disabled = false;
    if (success) {
      triggerButtonFeedback(triggerBtn);
    } else {
      triggerBtn.innerHTML = originalHtml;
    }
  }

  if (success) {
    showToast(`画像 [${fileName}] をコピーしました（投稿欄に直接貼り付け可能）`);
  } else {
    // クリップボードAPI非対応環境（iOS等）の場合、画像モーダルを開いて長押し保存を案内
    openImageModal(imagePath);
    showToast(`画像プレビューを表示しました。長押しまたは右クリックで保存・コピーしてください。`, 2500);
  }
}

/**
 * ==========================================================================
 * 5. 状態管理 & ソート・フィルタリング (FR-03, FR-06)
 * ==========================================================================
 */

/**
 * アプリケーションのUI状態
 */
const state = {
  /** @type {CategoryType} 現在選択中のカテゴリタブ */
  currentCategory: 'ikusei_reply',
  /** @type {string} 検索キーワード */
  searchKeyword: '',
  /** @type {string} 現在モーダル表示対象の画像パス */
  activeModalImagePath: SCOUT_IMAGES[0]
};

/**
 * 指定カテゴリ内の文面のうち、使用回数が最も少ない文面を取得する。
 * 同率最少の場合は、初期登録順（自然順）が最も若い文面を優先する。
 * 
 * @param {CategoryType} category - 対象カテゴリ
 * @returns {ScoutTextItem|null} 最少使用文面アイテム
 */
function getLeastUsedItem(category) {
  const counts = loadCounts();
  const catItems = ALL_DATA.filter(item => item.cat === category);
  if (catItems.length === 0) return null;

  let leastItem = catItems[0];
  let minCount = counts[leastItem.id] || 0;

  for (let i = 1; i < catItems.length; i++) {
    const item = catItems[i];
    const c = counts[item.id] || 0;
    if (c < minCount) {
      minCount = c;
      leastItem = item;
    }
  }

  return leastItem;
}

/**
 * 現在のタブカテゴリおよび検索条件に基づき、ソート・抽出された文面リストを取得する。
 * ソート条件: counts[id] 昇順（使用回数の少ない順） -> initialIndex 昇順
 * 
 * @returns {Array<{item: ScoutTextItem, count: number}>} ソート済みアイテムと使用回数の配列
 */
function getFilteredAndSortedItems() {
  const counts = loadCounts();
  const normalizedKeyword = state.searchKeyword.trim().toLowerCase();

  // 1. カテゴリ一致フィルタ
  let items = ALL_DATA.filter(x => x.cat === state.currentCategory);

  // 2. 検索キーワードフィルタ（IDまたは本文に含まれるか）
  if (normalizedKeyword) {
    items = items.filter(x =>
      x.id.toLowerCase().includes(normalizedKeyword) ||
      x.text.toLowerCase().includes(normalizedKeyword)
    );
  }

  // 3. カウント情報との紐付け
  const withCounts = items.map(item => ({
    item,
    count: counts[item.id] || 0
  }));

  // 4. 最少使用優先ソート (FR-03: counts昇順、同率時はinitialIndex昇順)
  withCounts.sort((a, b) => {
    if (a.count !== b.count) {
      return a.count - b.count;
    }
    return a.item.initialIndex - b.item.initialIndex;
  });

  return withCounts;
}

/**
 * ==========================================================================
 * 6. UIレンダリング & DOM更新
 * ==========================================================================
 */

/**
 * クイックアクションエリアの最少回数表示およびヘッダー統計情報を更新する。
 * 
 * @returns {void}
 */
function updateStatsAndQuickBadges() {
  const counts = loadCounts();

  // 1. 各カテゴリの最少使用回数を算出してクイックカードへ反映
  const categories = ['ikusei_reply', 'ikusei_dm', 'ippan_reply', 'ippan_dm'];
  let globalMinAcrossAll = Infinity;
  let totalCopies = 0;

  categories.forEach(cat => {
    const catItems = ALL_DATA.filter(x => x.cat === cat);
    let minCat = Infinity;
    catItems.forEach(item => {
      const c = counts[item.id] || 0;
      if (c < minCat) minCat = c;
    });

    const badgeEl = document.getElementById(`quickMin_${cat}`);
    if (badgeEl) {
      badgeEl.textContent = String(minCat === Infinity ? 0 : minCat);
    }

    if (minCat < globalMinAcrossAll) {
      globalMinAcrossAll = minCat;
    }
  });

  // 2. 累計コピー回数の合計計算
  for (const count of Object.values(counts)) {
    if (typeof count === 'number' && count > 0) {
      totalCopies += count;
    }
  }

  const statTotalCopies = document.getElementById('statTotalCopies');
  if (statTotalCopies) {
    statTotalCopies.textContent = `${totalCopies.toLocaleString()}回`;
  }

  const statMinCount = document.getElementById('statMinCount');
  if (statMinCount) {
    statMinCount.textContent = `${globalMinAcrossAll === Infinity ? 0 : globalMinAcrossAll}回`;
  }
}

/**
 * 文面カード一覧をDOM上に再描画する。
 * 
 * @returns {void}
 */
function renderCardList() {
  const container = document.getElementById('cardsList');
  const emptyState = document.getElementById('emptyState');
  const displayedCountEl = document.getElementById('displayedCount');
  if (!container || !emptyState) return;

  const list = getFilteredAndSortedItems();

  // 表示件数の更新
  if (displayedCountEl) {
    displayedCountEl.textContent = String(list.length);
  }

  // 0件ヒット時の表示切り替え
  if (list.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  // 最少使用回数を判定（現在表示中のリスト内における最小値）
  const minCountInList = list[0].count;

  // DOM生成 (効率的な文字列結合)
  const cardsHtml = list.map(({ item, count }) => {
    const isLeastUsed = count === minCountInList;
    const isZero = count === 0;

    // 全文面140文字以内のため一貫して表示
    const charDisplay = `${item.length} / 140文字`;

    return `
      <article class="scout-card ${isLeastUsed ? 'least-used' : ''}" data-id="${item.id}">
        <header class="card-header">
          <div class="card-header-left">
            <span class="id-badge">${item.id}</span>
          </div>
          <div class="card-badges">
            <span class="badge badge-len" title="改行を含む本文の文字数（140文字以内）">
              <span class="material-symbols-outlined" aria-hidden="true">text_fields</span>
              <span>${charDisplay}</span>
            </span>
            <span class="badge badge-count ${isZero ? 'zero' : ''}" title="この文面のこれまでのコピー回数">
              <span class="material-symbols-outlined" aria-hidden="true">history</span>
              <span>使用: ${count}回</span>
            </span>
          </div>
        </header>

        <div class="card-body" tabindex="0">${escapeHtml(item.text)}</div>

        <footer class="card-footer">
          <button class="btn btn-card-copy" type="button" data-action="card-copy" data-id="${item.id}">
            <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
            <span>コピー</span>
          </button>
        </footer>
      </article>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
}

/**
 * XSS防止用HTMLエスケープ関数
 * 
 * @param {string} str - 入力文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * タブ切り替え処理
 * 
 * @param {CategoryType} category - 切り替え先のカテゴリ
 * @returns {void}
 */
function switchTab(category) {
  state.currentCategory = category;

  // タブボタンのアクティブ状態更新
  const tabs = document.querySelectorAll('.tab-item');
  tabs.forEach(tab => {
    const tabCat = tab.getAttribute('data-cat');
    const isActive = tabCat === category;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // リストのアクセシビリティ参照を更新
  const container = document.getElementById('cardsList');
  if (container) {
    container.setAttribute('aria-labelledby', `tab-${category}`);
  }

  // 一覧の再描画
  renderCardList();
}

/**
 * ボタン要素に「コピー完了」の視覚的フィードバック（緑色化・アイコン変更）を一時的に与える。
 * 
 * @param {HTMLButtonElement} buttonEl - 対象ボタン要素
 * @returns {void}
 */
function triggerButtonFeedback(buttonEl) {
  const originalHtml = buttonEl.innerHTML;
  buttonEl.classList.add('btn-copied-state');
  buttonEl.innerHTML = `
    <span class="material-symbols-outlined" aria-hidden="true">check</span>
    <span>コピー完了</span>
  `;

  window.setTimeout(() => {
    buttonEl.classList.remove('btn-copied-state');
    buttonEl.innerHTML = originalHtml;
  }, 1200);
}

/**
 * 文面コピー実行時の共通ハンドラ
 * 
 * @param {ScoutTextItem} item - コピー対象の文面アイテム
 * @param {HTMLButtonElement|null} [triggerBtn=null] - クリックされたボタン
 * @returns {Promise<void>}
 */
async function executeCopy(item, triggerBtn = null) {
  const success = await copyToClipboard(item.text);
  if (!success) {
    showToast('クリップボードのコピーに失敗しました');
    return;
  }

  // 使用回数の加算と保存
  const newCount = incrementUsageCount(item.id);

  // トースト表示
  showToast(`[${item.id}] をコピーしました（使用回数: ${newCount}回）`);

  // ボタンのフィードバック表示
  if (triggerBtn) {
    triggerButtonFeedback(triggerBtn);
  }

  // 統計情報および一覧の更新 (ソート順が自動的に再計算される)
  updateStatsAndQuickBadges();
  renderCardList();
}

/**
 * ==========================================================================
 * 7. 画像モーダル & 確認モーダル制御
 * ==========================================================================
 */

/**
 * カウンター初期化確認モーダルの開閉を制御する
 * 
 * @param {boolean} isOpen - モーダルを開くか閉じるか
 * @returns {void}
 */
function setResetModalOpen(isOpen) {
  const modal = document.getElementById('resetModal');
  if (!modal) return;
  modal.classList.toggle('hidden', !isOpen);
}

/**
 * 画像プレビューモーダルを開く
 * 
 * @param {string} imagePath - 表示する画像ファイルパス
 * @returns {void}
 */
function openImageModal(imagePath) {
  const modal = document.getElementById('imageModal');
  const img = /** @type {HTMLImageElement|null} */ (document.getElementById('modalPreviewImage'));
  const title = document.getElementById('imageModalTitle');
  const openTabBtn = /** @type {HTMLAnchorElement|null} */ (document.getElementById('btnImageOpenTab'));
  if (!modal || !img) return;

  state.activeModalImagePath = imagePath;
  const fileName = imagePath.split('/').pop() || imagePath;
  img.src = imagePath;
  if (title) title.textContent = `勧誘バナー画像プレビュー (${fileName})`;
  if (openTabBtn) openTabBtn.href = imagePath;

  modal.classList.remove('hidden');
}

/**
 * 画像プレビューモーダルを閉じる
 * 
 * @returns {void}
 */
function closeImageModal() {
  const modal = document.getElementById('imageModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * ==========================================================================
 * 8. イベントリスナー初期化
 * ==========================================================================
 */
function initEventListeners() {
  // 1. クイック即時コピーボタンのハンドラ (FR-04)
  const quickGrid = document.getElementById('quickGrid');
  if (quickGrid) {
    quickGrid.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action="quick-copy"]');
      if (!btn) return;
      const cat = /** @type {CategoryType} */ (btn.getAttribute('data-cat'));
      const leastItem = getLeastUsedItem(cat);
      if (leastItem) {
        executeCopy(leastItem, /** @type {HTMLButtonElement} */ (btn));
      }
    });
  }

  // 2. 勧誘画像ランダムコピーボタン（メイン＆ヘッダー）
  const btnCopyRandomImage = document.getElementById('btnCopyRandomImage');
  const btnCopyRandomImageHeader = document.getElementById('btnCopyRandomImageHeader');
  if (btnCopyRandomImage) {
    btnCopyRandomImage.addEventListener('click', () => {
      executeRandomImageCopy(/** @type {HTMLButtonElement} */ (btnCopyRandomImage));
    });
  }
  if (btnCopyRandomImageHeader) {
    btnCopyRandomImageHeader.addEventListener('click', () => {
      executeRandomImageCopy(/** @type {HTMLButtonElement} */ (btnCopyRandomImageHeader));
    });
  }

  // 画像サムネイルクリックでプレビューモーダル表示
  const imageThumbWrap = document.getElementById('imageThumbWrap');
  if (imageThumbWrap) {
    imageThumbWrap.addEventListener('click', () => {
      const thumbImg = /** @type {HTMLImageElement|null} */ (document.getElementById('imagePreviewThumb'));
      const currentSrc = thumbImg ? thumbImg.getAttribute('src') : SCOUT_IMAGES[0];
      openImageModal(currentSrc || SCOUT_IMAGES[0]);
    });
  }

  // 画像モーダル内ボタン操作
  const btnImageModalCloseX = document.getElementById('btnImageModalCloseX');
  const btnImageModalClose = document.getElementById('btnImageModalClose');
  const btnImageModalCopy = document.getElementById('btnImageModalCopy');
  const imageModal = document.getElementById('imageModal');

  if (btnImageModalCloseX) {
    btnImageModalCloseX.addEventListener('click', closeImageModal);
  }
  if (btnImageModalClose) {
    btnImageModalClose.addEventListener('click', closeImageModal);
  }
  if (imageModal) {
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) closeImageModal();
    });
  }
  if (btnImageModalCopy) {
    btnImageModalCopy.addEventListener('click', async () => {
      const success = await copyImageToClipboard(state.activeModalImagePath);
      const fileName = state.activeModalImagePath.split('/').pop() || state.activeModalImagePath;
      if (success) {
        triggerButtonFeedback(/** @type {HTMLButtonElement} */ (btnImageModalCopy));
        showToast(`画像 [${fileName}] をコピーしました`);
      } else {
        showToast('画像のコピーに失敗しました。元サイズで開いて保存してください。');
      }
    });
  }

  // 3. カテゴリタブ切り替え (FR-06)
  const categoryTabs = document.querySelector('.category-tabs');
  if (categoryTabs) {
    categoryTabs.addEventListener('click', (e) => {
      const tab = /** @type {HTMLElement} */ (e.target).closest('.tab-item');
      if (!tab) return;
      const cat = /** @type {CategoryType} */ (tab.getAttribute('data-cat'));
      switchTab(cat);
    });
  }

  // 4. カード一覧内の個別コピーボタン (FR-05)
  const cardsList = document.getElementById('cardsList');
  if (cardsList) {
    cardsList.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest('[data-action="card-copy"]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const item = DATA_BY_ID.get(id);
      if (item) {
        executeCopy(item, /** @type {HTMLButtonElement} */ (btn));
      }
    });
  }

  // 5. 検索インプット操作
  const searchInput = /** @type {HTMLInputElement|null} */ (document.getElementById('searchInput'));
  const btnClearSearch = document.getElementById('btnClearSearch');

  if (searchInput && btnClearSearch) {
    searchInput.addEventListener('input', () => {
      state.searchKeyword = searchInput.value;
      btnClearSearch.classList.toggle('hidden', !state.searchKeyword);
      renderCardList();
    });

    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      state.searchKeyword = '';
      btnClearSearch.classList.add('hidden');
      searchInput.focus();
      renderCardList();
    });
  }

  // 6. リセット確認モーダルの開閉と実行 (FR-07)
  const btnOpenResetModal = document.getElementById('btnOpenResetModal');
  const btnModalCloseX = document.getElementById('btnModalCloseX');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalConfirm = document.getElementById('btnModalConfirm');
  const resetModal = document.getElementById('resetModal');

  if (btnOpenResetModal) {
    btnOpenResetModal.addEventListener('click', () => setResetModalOpen(true));
  }
  if (btnModalCloseX) {
    btnModalCloseX.addEventListener('click', () => setResetModalOpen(false));
  }
  if (btnModalCancel) {
    btnModalCancel.addEventListener('click', () => setResetModalOpen(false));
  }
  if (resetModal) {
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) {
        setResetModalOpen(false);
      }
    });
  }

  if (btnModalConfirm) {
    btnModalConfirm.addEventListener('click', () => {
      clearAllCounts();
      setResetModalOpen(false);
      updateStatsAndQuickBadges();
      renderCardList();
      showToast('すべての使用回数カウントを初期化しました');
    });
  }

  // キーボードショートカット: Escapeキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (resetModal && !resetModal.classList.contains('hidden')) {
        setResetModalOpen(false);
      }
      if (imageModal && !imageModal.classList.contains('hidden')) {
        closeImageModal();
      }
    }
  });
}

/**
 * ==========================================================================
 * 9. 初期化エントリーポイント
 * ==========================================================================
 */
function initApp() {
  updateStatsAndQuickBadges();
  renderCardList();
  initEventListeners();
}

// DOM読み込み完了時に起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
