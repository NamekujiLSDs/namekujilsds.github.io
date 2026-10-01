/**
 * @file 団活スカウト文面マネージャー (Scout Text Manager) コントローラー
 * @description
 * 『グランブルーファンタジー』における団員募集（団活タグへのスカウト活動）を支援するクライアントサイドロジック。
 * 
 * 【背景・開発目的】
 * X（旧Twitter）上で同一文面を連続投稿するとスパム判定・シャドウバンを受けるリスクが高まります。
 * これを防ぐため、4カテゴリ・計480種の文面をスクリプト内部で自動生成し、
 * クリップボードへのコピー回数を localStorage に記録して「最も使用回数の少ない文面」から優先的に
 * ワンクリックでコピー・ローテーション使用できるように設計されています。
 * 
 * 【コーディング規約遵守事項】
 * - 絵文字は一切使用せず、Google Material Symbols を採用
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
 * 団員個人のアカウントから発信するため、連絡窓口への誘導先として固定する。
 * @type {string}
 */
const SCOUT_OFFICIAL_ACCOUNT = '@grablue_scout';

/**
 * 4カテゴリの文節データ定義
 * デカルト積（直積: 6 prefix × 5 body × 4 suffix = 120通り）により、
 * 各カテゴリ120種、全体で480種のユニークな文面を生成する。
 * 
 * リプライ（ikusei_reply, ippan_reply）はXの140文字制限を絶対に超過しないよう（<=137文字）、
 * 各パーツの文字数を厳密に設計・検証済み。
 */
const CATEGORY_CONFIGS = {
  // 育成枠 リプライ (Twitter用: 改行なし / 140文字以内)
  ikusei_reply: {
    prefix: 'ir',
    isDm: false,
    p1: [
      '初めまして！団活タグよりお声がけ失礼します。',
      'こんにちは！団活中のところ失礼いたします。',
      '初めまして！団活ポストを拝見しリプ失礼します。',
      '初めまして！団活中とのことでお声がけいたしました。',
      'こんばんは！団活ツイート拝見しお声がけしました。',
      '初めまして、団員募集でお声がけいたしました！'
    ],
    p2: [
      '当団は育成枠を募集中です！古戦場・ドレバラノルマ免除で、VCでの編成相談や装備強化を全力サポートします。',
      '当団では成長中の騎空士様を歓迎！古戦場ノルマ免除、VC相談や定期進捗確認で着実に強くなれる育成枠です。',
      '育成枠の募集です！古戦場やドレバラノルマ免除で、装備進捗の確認やDiscord VC相談など手厚く支えます。',
      '当団の育成枠はいかがでしょうか？古戦場ノルマ免除でマイペースに成長でき、VCでの編成相談も大歓迎です！',
      '古戦場ノルマ免除の育成枠を募集中！定期的な装備進捗確認やVC相談環境があり、安心して成長できます。'
    ],
    p3: [
      `ご興味ありましたら団運営（${SCOUT_OFFICIAL_ACCOUNT}）までお気軽にDMをお願いします！`,
      `詳細等は団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）のDMへお気軽にご連絡ください！`,
      `少しでも気になりましたら、団運営（${SCOUT_OFFICIAL_ACCOUNT}）までDMにてご連絡ください！`,
      `よろしければ団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMでお気軽にお問い合わせください！`
    ]
  },

  // 育成枠 DM (詳細情報提供用: 改行区切りの3段落構成)
  ikusei_dm: {
    prefix: 'id',
    isDm: true,
    p1: [
      '突然のDM失礼いたします！団活ポストを拝見し、ぜひお話ししたくご連絡いたしました。',
      '初めまして！団活タグを拝見し、当団の募集内容に合いそうだと思いDMさせていただきました。',
      '初めまして、団活中のところDMにて失礼いたします。当団の団員としてお声がけさせていただきました。',
      'こんにちは！団活ツイートを拝見し、魅力的な騎空士様だと思いスカウトDMをお送りしました。',
      '初めまして！団活ポストを拝見し、ぜひ当団をご検討いただきたくご連絡差し上げました。',
      '突然のご連絡失礼いたします。団活をお見かけし、当団の雰囲気にも合いそうだと思いDMいたしました。'
    ],
    p2: [
      '当団では現在「育成枠」を募集しております。古戦場およびドレバラのノルマは完全免除となっており、定期的な装備進捗の確認やDiscord VCでの編成・育成相談など、無理なくステップアップできる環境を整えています。',
      '募集しておりますのは当団の「育成枠」となります。古戦場・ドレバラノルマ免除で、プレッシャーなく育成に専念していただけます。VCでの相談対応や定期的な進捗確認など、団全体であなたの成長をサポートいたします！',
      '当団の「育成枠」でのご入団はいかがでしょうか？古戦場・ドレバラともにノルマは一切なく、定期的な装備進捗確認やDiscordでのVC相談など、グラブルをより深く楽しんでいただけるようバックアップいたします。',
      '当団では現在、やる気重視の「育成枠」を募集中です！古戦場等のイベントノルマは免除となっており、定期的な装備進捗確認とVCでの個別相談環境により、初心者〜中級者の方でも安心して強くなれる環境です。',
      'ご提案したいのが当団の「育成枠」です。古戦場・ドレバラはノルマなしでマイペースに参加可能。定期的な装備進捗確認や、Discord VCでのマルチ攻略・編成相談など、手厚い育成サポートをご用意しています。'
    ],
    p3: [
      `私は一般団員のため、入団のご相談や詳細の確認につきましては、団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）までDMにてご連絡いただけますと幸いです。ご検討よろしくお願いいたします！`,
      `本アカウントは団員個人のため、詳しい団規約やご質問、入団希望のご連絡は団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）へDMをお願いできますでしょうか。ご縁を心よりお待ちしております！`,
      `スカウト担当は団運営（${SCOUT_OFFICIAL_ACCOUNT}）が一括して対応しております。少しでも興味を持っていただけましたら、ぜひ上記運営垢へDMをお送りください。よろしくお願いいたします！`,
      `詳細条件のご確認やご質問・応募につきましては、団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）のDMにて承っております。お気軽にお声がけいただけますと嬉しいです。どうぞご検討ください！`
    ]
  },

  // 一般枠 リプライ (Twitter用: 改行なし / 140文字以内)
  ippan_reply: {
    prefix: 'pr',
    isDm: false,
    p1: [
      '初めまして！団活タグよりお声がけ失礼します。',
      'こんにちは！団活中のところリプ失礼いたします。',
      '初めまして！団活ポストを拝見しご連絡いたしました。',
      'こんばんは！団活投稿を拝見しお声がけしました。',
      '初めまして！団活中とのことでリプ失礼いたします。',
      '初めまして！当団の募集に合いそうでお声がけしました。'
    ],
    p2: [
      '当団は予選300位目標/予選5億/個ラン10万位以内、本戦低空なし朝活任意でVC積極参加の団員を募集中です！',
      '当団は予選300位目標・予選ノルマ5億、個ラン10万位内で低空なし・朝活任意、Discord VCが盛んな団です！',
      '古戦場予選300位目標(予選5億/個ラン10万位内)、本戦低空なし朝活任意、VC活発な一般枠を募集しております！',
      '予選300位狙い/予選ノルマ5億/個ラン10万位、低空なし朝活任意でDiscord VC参加を重視した団です！',
      '当団は予選300位目標/ノルマ予選5億・個ラン10万位内、本戦フリー低空なし・朝活任意、VC積極参加歓迎です！'
    ],
    p3: [
      `ご興味ありましたら団運営（${SCOUT_OFFICIAL_ACCOUNT}）までお気軽にDMをお願いします！`,
      `詳細等は団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）のDMへお気軽にご連絡ください！`,
      `少しでも気になりましたら、団運営（${SCOUT_OFFICIAL_ACCOUNT}）までDMにてご連絡ください！`,
      `よろしければ団運営（${SCOUT_OFFICIAL_ACCOUNT}）へDMでお気軽にお問い合わせください！`
    ]
  },

  // 一般枠 DM (詳細情報提供用: 改行区切りの3段落構成)
  ippan_dm: {
    prefix: 'pd',
    isDm: true,
    p1: [
      '突然のDM失礼いたします！団活ポストを拝見し、当団の募集条件にぴったりだと思いご連絡いたしました。',
      '初めまして！団活タグよりプロフィールを拝見し、ぜひスカウトさせていただきたくDMいたしました。',
      '初めまして、団活中のところ失礼いたします。当団の団員として、ぜひご案内したくご連絡差し上げました。',
      'こんにちは！団活ポストを拝見し、プレイスタイルが当団にとてもマッチしていると思いお声がけしました。',
      '初めまして！団活ツイートを拝見し、ぜひ力を貸していただきたくスカウトのDMをお送りいたしました。',
      '突然のご連絡失礼いたします。団活中のところ、当団の条件に合いそうだと思いDMさせていただきました。'
    ],
    p2: [
      '当団は古戦場予選300位目標（予選ノルマ5億・総合個ラン10万位以内）、本戦低空指示なしの完全フリーラン、朝活は任意です。普段からDiscord VCでの雑談や高難度マルチ募集が活発で、VCに積極参加いただける一般枠の方を募集しております。',
      '募集中の一般枠の主な方針ですが、古戦場予選300位目標、ノルマは予選5億・本戦通して個ラン10万位以内となります。本戦は低空なしのフリーラン、朝活は任意です。DiscordのVCが非常に賑やかで、VC参加を歓迎・重視する環境となっています！',
      '当団の一般枠条件は、古戦場予選300位目標（予選5億ノルマ・個ラン10万位以内）、低空なし、朝活任意となっております。団員同士の交流が活発で、Discord VCでのマルチ攻略や日々の雑談へ積極的にご参加いただける方を心よりお待ちしております。',
      '当団では「予選300位狙い（予選ノルマ5億／個ラン10万位以内）」を掲げて走っており、本戦は低空なし・朝活任意です。何よりDiscord VCでのコミュニケーションを大切にしており、VCに積極的に混ざって一緒に楽しめる仲間を募集しております！',
      '当団の募集内容をご案内いたします。古戦場は予選300位目標、予選ノルマ5億、個ラン10万位以内、本戦低空なし、朝活任意です。VCが非常に活発な団ですので、DiscordでのVC通話やマルチ連戦に積極参加していただける方を大歓迎しております。'
    ],
    p3: [
      `私は一般団員のため、入団のご相談や詳細の確認につきましては、団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）までDMにてご連絡いただけますと幸いです。ご検討よろしくお願いいたします！`,
      `本アカウントは団員個人のため、詳しい団規約やご質問、入団希望のご連絡は団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）へDMをお願いできますでしょうか。ご縁を心よりお待ちしております！`,
      `スカウト担当は団運営（${SCOUT_OFFICIAL_ACCOUNT}）が一括して対応しております。少しでも興味を持っていただけましたら、ぜひ上記運営垢へDMをお送りください。よろしくお願いいたします！`,
      `詳細条件のご確認やご質問・応募につきましては、団運営アカウント（${SCOUT_OFFICIAL_ACCOUNT}）のDMにて承っております。お気軽にお声がけいただけますと嬉しいです。どうぞご検討ください！`
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

          // DM用は段落ごとの改行を挟み、リプライ用は1段落に結合
          const text = conf.isDm
            ? `${conf.p1[i]}\n${conf.p2[j]}\n${conf.p3[k]}`
            : `${conf.p1[i]}${conf.p2[j]}${conf.p3[k]}`;

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
 * 4. クリップボード制御 & トースト通知 (FR-04, FR-05, FR-08)
 * ==========================================================================
 */

/**
 * トースト非表示タイマーID
 * 連続クリック時に前回のタイマーをクリアしてトースト表示を延長する。
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
 * navigator.clipboard APIを優先し、エラー時や非HTTPS環境ではexecCommand('copy')へフォールバックする。
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

  // レガシーフォールバック処理 (一時的なtextareaの配置と選択)
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
  searchKeyword: ''
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

  // 使用回数昇順 -> 初期インデックス昇順（安定ソート）
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

    // リプライの場合は「125 / 140文字」、DMの場合は「240文字」と表示
    const charDisplay = (item.cat === 'ikusei_reply' || item.cat === 'ippan_reply')
      ? `${item.length} / 140文字`
      : `${item.length}文字`;

    return `
      <article class="scout-card ${isLeastUsed ? 'least-used' : ''}" data-id="${item.id}">
        <header class="card-header">
          <div class="card-header-left">
            <span class="id-badge">${item.id}</span>
          </div>
          <div class="card-badges">
            <span class="badge badge-len" title="本文の文字数">
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
 * コピー実行時の共通ハンドラ
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
 * 7. イベントリスナー初期化 & モーダル制御
 * ==========================================================================
 */

/**
 * 確認モーダルの開閉を制御する
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
 * アプリケーションのイベントリスナーを設定する
 * 
 * @returns {void}
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

  // 2. カテゴリタブ切り替え (FR-06)
  const categoryTabs = document.querySelector('.category-tabs');
  if (categoryTabs) {
    categoryTabs.addEventListener('click', (e) => {
      const tab = /** @type {HTMLElement} */ (e.target).closest('.tab-item');
      if (!tab) return;
      const cat = /** @type {CategoryType} */ (tab.getAttribute('data-cat'));
      switchTab(cat);
    });
  }

  // 3. カード一覧内の個別コピーボタン (FR-05)
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

  // 4. 検索インプット操作
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

  // 5. リセット確認モーダルの開閉と実行 (FR-07)
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
    // 背景クリックで閉じる
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
    if (e.key === 'Escape' && resetModal && !resetModal.classList.contains('hidden')) {
      setResetModalOpen(false);
    }
  });
}

/**
 * ==========================================================================
 * 8. 初期化エントリーポイント
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
