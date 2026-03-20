# 年間行事計画 → カレンダーエクスポートツール (ローカルAI版) 要件定義・設計書

**バージョン:** 1.0  
**作成日:** 2026-03-18  
**形態:** Pythonスクリプト（ローカル実行・完全オフライン対応）

---

## 1. プロジェクト概要

学校の年間行事計画ファイル（PDF・Excel/CSV）を読み込み、**完全ローカル環境のAIモデル**を用いて行事を解析・分類し、Googleカレンダー等にインポートできる形式（ICS/CSV）で出力するCLIツール。

クラウドAPI（Claude/Gemini等）に依存せず、機密性の高い校務データを外部に送信せずに処理することを目的とします。

---

## 2. アーキテクチャと技術選定

ローカル環境の限られたリソース（VRAM 8GB〜16GB程度）で高い精度を出すため、**「非AIによる表抽出」＋「ローカルLLMによるデータ整形」の2段階パイプライン**を採用します。

### 2-1. 処理パイプライン

1.  **フェーズ1: 構造化テキスト抽出（非AI）**
    *   PDFの複雑なマトリックス表（縦:日付、横:月）を、機械的に読み取れる構造化テキスト（CSV/Markdown）に変換します。
    *   **採用技術:** `Camelot` または `pdfplumber`（表の罫線や座標ベースの抽出に特化）。
2.  **フェーズ2: 意味解析とJSON構造化（ローカルLLM）**
    *   フェーズ1で抽出したテキストデータをローカルLLMに入力し、「行事名」「対象学年」「カテゴリ」などの意味を解釈させ、指定のJSONフォーマットに変換します。
    *   **採用技術:** `Ollama` 経由でのローカルLLM実行。
    *   **推奨モデル:** `qwen2.5:14b-instruct` または `llama3.1:8b-instruct`（日本語の指示理解とJSON出力に優れたモデル）。

### 2-2. 主要ライブラリ

| ライブラリ | 用途 | 備考 |
| :--- | :--- | :--- |
| `ollama` | ローカルLLMの実行・API通信 | 事前にOllama本体のインストールが必要 |
| `pdfplumber` / `camelot-py` | PDFからの表データ抽出 | 罫線ベースの正確な抽出 |
| `openpyxl` / `pandas` | Excel/CSVの読み込み・操作 | |
| `pydantic` | LLM出力のJSONバリデーション | 厳密なスキーマ定義とパース |
| `icalendar` | ICSファイル生成 | |
| `questionary` / `rich` | インタラクティブCLIUI | チェックボックス選択、テーブル表示 |

---

## 3. 機能要件

### 3-1. ファイル入力

*   **対応形式:** PDF, Excel (.xlsx/.xls), CSV
*   **入力方法:** CLI引数、またはインタラクティブプロンプトでのファイルパス指定。

### 3-2. ローカルAI解析 (Ollama連携)

*   **推論エンジン:** ローカルで稼働するOllamaサーバー（デフォルト: `http://localhost:11434`）と通信。
*   **プロンプト設計:**
    *   システムプロンプトで「あなたは校務データ処理の専門家です。提供されたテキストから行事情報を抽出し、必ず指定されたJSONスキーマに従って出力してください」と指示。
    *   抽出項目: `date` (YYYY-MM-DD), `title`, `category`, `target` (対象学年), `time_start`, `time_end`, `notes`。
*   **ハルシネーション対策:**
    *   Pydanticを用いてLLMの出力をパース・検証。スキーマ違反時はリトライ処理（最大3回）を実施。
    *   「原文にない情報を推測しない」ことをプロンプトで強く制約。

### 3-3. カテゴリ分類

*   **デフォルトカテゴリ:** `grade` (学年行事), `meeting` (職員会議), `exam` (試験), `open_school` (学校説明会), `other` (その他)。
*   **拡張性:** `categories.json` で定義を外部化し、ユーザーが編集可能。

### 3-4. インタラクティブUI (CLI)

*   解析結果を `rich` ライブラリを用いて見やすいテーブル形式でコンソールに表示。
*   `questionary` を用いて、出力対象とする行事やカテゴリをチェックボックスで選択。

### 3-5. ファイル出力

*   **ICS形式:** カレンダーアプリ（Google/Apple/Outlook）用。
*   **CSV形式:** Googleカレンダーインポート用フォーマット。
*   出力先: `output/` ディレクトリ。

---

## 4. ディレクトリ構成

```text
local-calendar-exporter/
├── main.py                  # エントリーポイント
├── requirements.txt         # 依存パッケージ
├── categories.json          # カテゴリ定義
├── README.md                # セットアップ手順
├── src/
│   ├── parser/
│   │   ├── pdf_parser.py    # pdfplumber/camelotによる表抽出
│   │   ├── excel_parser.py  # Excel/CSV読み込み
│   │   └── base_parser.py   # インターフェース
│   ├── llm/
│   │   ├── ollama_client.py # Ollama API通信とリトライロジック
│   │   ├── schema.py        # PydanticによるJSONスキーマ定義
│   │   └── prompts.py       # プロンプトテンプレート
│   ├── ui/
│   │   └── cli_app.py       # questionary/richによるUI制御
│   ├── exporter/
│   │   ├── ics_exporter.py  # ICS出力
│   │   └── csv_exporter.py  # CSV出力
│   └── utils/
│       └── logger.py        # ログ出力
├── samples/                 # テスト用サンプルファイル
└── output/                  # 出力先ディレクトリ
```

---

## 5. セットアップ手順 (README用ドラフト)

### 1. Ollamaのインストールとモデルの準備

1.  [Ollama公式サイト](https://ollama.com/) からOllamaをインストールします。
2.  ターミナルを開き、推奨モデルをダウンロードします。
    ```bash
    # 推奨: Qwen2.5 14B (VRAM 12GB以上推奨)
    ollama run qwen2.5:14b-instruct
    
    # 軽量版: Llama 3.1 8B (VRAM 8GB程度)
    ollama run llama3.1:8b-instruct
    ```

### 2. Python環境の構築

```bash
# リポジトリのクローン（またはディレクトリ作成）
git clone <repository-url>
cd local-calendar-exporter

# 仮想環境の作成と有効化
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt
```

### 3. 実行方法

```bash
# Ollamaが起動していることを確認した上で実行
python main.py --file samples/calendar_2026.pdf --model qwen2.5:14b-instruct
```

---

## 6. 実装上の重要ポイント（開発者向け）

1.  **PDFパーサーの選定とチューニング:**
    *   今回の「縦横マトリックス」のPDFは、単純なテキスト抽出では月と日付の対応関係が崩れます。
    *   `pdfplumber.extract_tables()` または `camelot.read_pdf(flavor='lattice')` を使用し、**「X月Y日のセルにはこのテキストが入っている」という構造を維持したままCSVやMarkdownの表形式に変換**することが、後段のLLMの精度を決定づけます。
2.  **LLMへの入力データの工夫:**
    *   抽出した表データが巨大な場合、LLMのコンテキストウィンドウ（一度に処理できるトークン数）を圧迫します。
    *   必要であれば、1ヶ月ごと、あるいは四半期ごとにデータを分割（チャンク化）してLLMにリクエストを送り、後で結果を結合するアプローチを検討してください。
3.  **JSON出力の安定化:**
    *   ローカルLLMは、指示に従わずJSON以外の余計なテキスト（"Here is the JSON..."など）を出力しがちです。
    *   OllamaのAPIで `format="json"` を指定するか、出力文字列から正規表現で `{...}` または `[...]` の部分だけを抽出する堅牢なパース処理を実装してください。
