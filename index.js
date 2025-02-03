const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());

// SQLite データベースの初期化（recipes.db というファイルを使用）
const dbFile = path.join(__dirname, 'recipes.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('データベース接続エラー:', err.message);
  } else {
    console.log('SQLite データベースに接続しました。');
  }
});

// sql/create.sql に準じたテーブル作成（存在しなければ）
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    making_time TEXT NOT NULL,
    serves TEXT NOT NULL,
    ingredients TEXT NOT NULL,
    cost TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ------------- エンドポイント実装 ------------- //

// ● POST /recipes
// レシピ新規作成。必須パラメータ: title, making_time, serves, ingredients, cost
app.post('/recipes', (req, res) => {
  const { title, making_time, serves, ingredients, cost } = req.body;
  if (!title || !making_time || !serves || !ingredients || !cost) {
    return res.status(200).json({
      message: "Recipe creation failed!",
      required: "title, making_time, serves, ingredients, cost"
    });
  }
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const query = `INSERT INTO recipes (title, making_time, serves, ingredients, cost, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [title, making_time, serves, ingredients, cost, now, now], function(err) {
    if (err) {
      return res.status(200).json({
        message: "Recipe creation failed!",
        required: "title, making_time, serves, ingredients, cost"
      });
    }
    // 作成されたレシピを取得
    const insertedId = this.lastID;
    db.get("SELECT * FROM recipes WHERE id = ?", [insertedId], (err, row) => {
      if (err || !row) {
        return res.status(200).json({
          message: "Recipe creation failed!",
          required: "title, making_time, serves, ingredients, cost"
        });
      }
      return res.status(200).json({
        message: "Recipe successfully created!",
        recipe: [row]
      });
    });
  });
});

// ● GET /recipes
// 全レシピ一覧を返す。各レシピは id, title, making_time, serves, ingredients, cost を含む。
app.get('/recipes', (req, res) => {
  const query = "SELECT id, title, making_time, serves, ingredients, cost FROM recipes";
  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(200).json({ recipes: [] });
    }
    return res.status(200).json({ recipes: rows });
  });
});

// ● GET /recipes/:id
// 指定 id のレシピを返す。該当レシピが存在しなければ空の配列を返す。
app.get('/recipes/:id', (req, res) => {
  const id = req.params.id;
  const query = "SELECT id, title, making_time, serves, ingredients, cost FROM recipes WHERE id = ?";
  db.get(query, [id], (err, row) => {
    if (err || !row) {
      return res.status(200).json({
        message: "Recipe details by id",
        recipe: []
      });
    }
    return res.status(200).json({
      message: "Recipe details by id",
      recipe: [row]
    });
  });
});

// ● PATCH /recipes/:id
// 指定 id のレシピを更新し、更新後のレシピ情報（title, making_time, serves, ingredients, cost）を返す。
// ※ 必須パラメーターが全て存在しない場合はエラーとして返す
app.patch('/recipes/:id', (req, res) => {
  const id = req.params.id;
  const { title, making_time, serves, ingredients, cost } = req.body;
  if (!title || !making_time || !serves || !ingredients || !cost) {
    return res.status(200).json({
      message: "Recipe update failed!",
      required: "title, making_time, serves, ingredients, cost"
    });
  }
  // 更新対象レシピの存在確認
  db.get("SELECT * FROM recipes WHERE id = ?", [id], (err, row) => {
    if (err || !row) {
      return res.status(200).json({ message: "No Recipe found" });
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = `UPDATE recipes
                   SET title = ?, making_time = ?, serves = ?, ingredients = ?, cost = ?, updated_at = ?
                   WHERE id = ?`;
    db.run(query, [title, making_time, serves, ingredients, cost, now, id], function(err) {
      if (err) {
        return res.status(200).json({ message: "Recipe update failed!" });
      }
      return res.status(200).json({
        message: "Recipe successfully updated!",
        recipe: [{
          title,
          making_time,
          serves,
          ingredients,
          cost
        }]
      });
    });
  });
});

// ● DELETE /recipes/:id
// 指定 id のレシピを削除。存在しない場合はエラーメッセージを返す。
app.delete('/recipes/:id', (req, res) => {
  const id = req.params.id;
  // 存在チェック
  db.get("SELECT * FROM recipes WHERE id = ?", [id], (err, row) => {
    if (err || !row) {
      return res.status(200).json({ message: "No Recipe found" });
    }
    db.run("DELETE FROM recipes WHERE id = ?", [id], function(err) {
      if (err) {
        return res.status(200).json({ message: "No Recipe found" });
      }
      return res.status(200).json({ message: "Recipe successfully removed!" });
    });
  });
});

// ● その他、定義されていないエンドポイントは常に HTTP ステータス 484 を返す
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました。`);
});
