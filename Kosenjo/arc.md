# システムアーキテクチャ・コードマップ (arc.md)

本ドキュメントは、プロジェクト全体の構成および各モジュールの役割・依存関係を定義したコードマップです。

---

## 1. ディレクトリ構成

```text
/
├── DEVELOPMENT_RULES.md       # 開発ルール・コーディング規約・通知ルール
├── Kosenjo/                   # 古戦場貢献度ランキングツール
│   ├── index.html             # UIマークアップ・骨格構造
│   ├── favicon.svg            # 独自ベクターSVGファビコン
│   ├── style.css              # 固有スタイル・アニメーション・UIユーティリティ
│   ├── script.js              # API通信・予測計算モデル・テーブル描画・イベント処理
│   ├── spec.md                # システム仕様書・API仕様・データ構造
│   └── arc.md                 # 本書（システムアーキテクチャ・コードマップ）
├── VoxMate/                   # 音声・ボイス関連Webアプリケーション
├── BUG/                       # バグ報告・検証用スクリプト/資材
├── CROSSHAIR/                 # クロスヘアツール関連資材
├── Font/                      # フォントファイル
└── ...
```

---

## 2. Kosenjo（古戦場貢献度ランキング）モジュール構成

### 2.1 [index.html](file:///c:/Users/N/Desktop/coding/namekujilsds.github.io/Kosenjo/index.html)
- **役割**: ツールのUI骨格とコンポーネント配置を担当。
- **外部依存**:
  - Tailwind CSS (CDN): ユーティリティファーストのスタイリング（ダークモード class="dark" 運用）
  - Chart.js (CDN): モーダルダイアログでの時系列グラフ描画
  - [style.css](file:///c:/Users/N/Desktop/coding/namekujilsds.github.io/Kosenjo/style.css): アニメーションやスクロールバー制御の固有スタイル
  - [script.js](file:///c:/Users/N/Desktop/coding/namekujilsds.github.io/Kosenjo/script.js): アプリケーションロジック

### 2.2 [style.css](file:///c:/Users/N/Desktop/coding/namekujilsds.github.io/Kosenjo/style.css)
- **役割**: Tailwind標準クラスでは賄えないブラウザ固有制御およびアニメーションの集約管理。
- **主な定義**:
  - `@keyframes spin` / `.animate-spin`: データ取得中のスピナー回転アニメーション
  - `.scrollbar-hide`: 日付タブやブックマークレット表示欄でのスクロールバー非表示化（WebKit / IE / Firefox対応）
  - `.touch-scroll` / `.no-tap-highlight`: モバイル端末でのスムーズな水平慣性スクロールおよびタップ枠抑制

### 2.3 [script.js](file:///c:/Users/N/Desktop/coding/namekujilsds.github.io/Kosenjo/script.js)
- **役割**: 全クライアントサイドロジックの実装。
- **内部サブシステム**:
  1. **API通信層 (`fetchData`, `handleAnalyze`)**:
     `gbf.pub` APIへの並列非同期通信とAllOriginsプロキシによるCORS/キャッシュ回避フォールバック。
  2. **データ処理・計算層 (`calculateActivityCurve`, `calcInflationRate`, `getInterpolatedPoint`, `calculateSpeedFromPast`, `calculateTodayIncrease`, `isRestTimeByElapsed`, `realElapsedToActiveH`, `getRealElapsedForPhase`)**:
     過去開催の伸び率をベースとしたアクティビティ曲線モデルの構築、今回のインフレ倍率算出、線形補間による時系列予測、空白時間（深夜休戦・集計）のプロット除外処理、および夜間空白をスキップして詰める累積活動時間（Active Timeline, 0〜121h）相互変換処理。
  3. **UI・プレゼンテーション層 (`renderTable`, `renderChartjs`, `updateIncreaseSummary`, `updateSortIcons`, `showToast`, `setLoading`, `showError`, `exportRankingImage`)**:
     ランキングテーブルの生成、Chart.jsによるグラフ描画・ゲーム内フェーズ別（予選、インターバル、本戦1〜4日目）のインタラクティブ切り替え（`animation: false` および `update('none')` によるモーフィング歪み・斜め線バグの完全根絶）、全期間および日をまたぐグラフにおける日の切り替わり境界線（縦破線＋日付バッジ）の自動描画プラグイン（`dayBoundaryLinePlugin`）、期間内貢献度純増量サマリーの動的算出・タップトグル表示（略記 ⇄ 詳細実数値）、全期間グラフにおけるプロット点非表示化（`pointRadius: 0`）による線のスリム化とホバー拡大、ソート操作、日別グラフにおける07:00〜24:00ジャスト表示、全期間グラフにおける夜間空白スキップ連続描画、モバイル画面幅に応じた動的目盛り調整、およびボーダー行を除外したプレイヤー一覧の動的サイズ画像（PNG）エクスポート（Retina 2x スケール）。
  4. **永続化・URL連携層 (`updateUrlParams`, `getIdsFromUrl`, `encodeIdsToParam`, `decodeParamToIds`, `localStorage`)**:
     開催回のlocalStorage保持、Uint32バイナリパック＋URL-safe Base64エンコードによるURL短縮同期（`?d=...`）、検索IDリストのURLクエリ同期。
