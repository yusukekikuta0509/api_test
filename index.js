require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const url = require('url');
const app = express();

app.use(express.json());

// Heroku の場合、JAWSDB_URL が設定されていればそれを利用、なければローカルの環境変数を利用する
const dbConfig = process.env.JAWSDB_URL ? 
  (() => {
    const dbUrl = url.parse(process.env.JAWSDB_URL);
    const [user, password] = dbUrl.auth.split(':');
    return {
      host: dbUrl.hostname,
      user: user,
      password: password,
      database: dbUrl.pathname.replace('/', '')
    };
  })() : {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'your_password',
    database: process.env.DB_DATABASE || 'recipes_db'
  };

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// BASE_URL "/" は明示的に 404 を返す（テスト要件）
app.get('/', (req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// ● POST /recipes
// レシピ新規作成（必須パラメーター: title, making_time, serves, ingredients, cost）
app.post(['/recipes', '/recipes/'], (req, res) => {
  const { title, making_time, serves, ingredients, cost } = req.body;
  if (!title || !making_time || !serves || !ingredients || cost === undefined) {
    return res.status(200).json({
      message: "Recipe creation failed!",
      required: "title, making_time, serves, ingredients, cost"
    });
  }
  const query = "INSERT INTO recipes (title, making_time, serves, ingredients, cost) VALUES (?, ?, ?, ?, ?)";
  pool.query(query, [title, making_time, serves, ingredients, cost], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(200).json({
        message: "Recipe creation failed!",
        required: "title, making_time, serves, ingredients, cost"
      });
    }
    const insertedId = result.insertId;
    const selectQuery = `
      SELECT 
        id, 
        title, 
        making_time, 
        serves, 
        ingredients, 
        cost, 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, 
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at 
      FROM recipes 
      WHERE id = ?`;
    pool.query(selectQuery, [insertedId], (err, rows) => {
      if (err || rows.length === 0) {
        return res.status(200).json({
          message: "Recipe creation failed!",
          required: "title, making_time, serves, ingredients, cost"
        });
      }
      const recipe = rows[0];
      recipe.cost = recipe.cost.toString();
      return res.status(200).json({
        message: "Recipe successfully created!",
        recipe: [recipe]
      });
    });
  });
});

// ● GET /recipes
// 全レシピ一覧を返す（キャッシュ用ヘッダー設定）
app.get(['/recipes', '/recipes/'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  const query = "SELECT id, title, making_time, serves, ingredients, cost FROM recipes";
  pool.query(query, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(200).json({ recipes: [] });
    }
    const recipes = rows.map(row => {
      row.cost = row.cost.toString();
      return row;
    });
    return res.status(200).json({ recipes: recipes });
  });
});

// ● GET /recipes/:id
// 指定 id のレシピのみを返す
app.get(['/recipes/:id', '/recipes/:id/'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  const id = req.params.id;
  const query = "SELECT id, title, making_time, serves, ingredients, cost FROM recipes WHERE id = ?";
  pool.query(query, [id], (err, rows) => {
    if (err || rows.length === 0) {
      return res.status(200).json({
        message: "Recipe details by id",
        recipe: []
      });
    }
    const recipe = rows[0];
    recipe.cost = recipe.cost.toString();
    return res.status(200).json({
      message: "Recipe details by id",
      recipe: [recipe]
    });
  });
});

// ● PATCH /recipes/:id
// 指定 id のレシピを更新（必須パラメーター: title, making_time, serves, ingredients, cost）
app.patch(['/recipes/:id', '/recipes/:id/'], (req, res) => {
  const id = req.params.id;
  const { title, making_time, serves, ingredients, cost } = req.body;
  if (!title || !making_time || !serves || !ingredients || cost === undefined) {
    return res.status(200).json({
      message: "Recipe update failed!",
      required: "title, making_time, serves, ingredients, cost"
    });
  }
  pool.query("SELECT * FROM recipes WHERE id = ?", [id], (err, rows) => {
    if (err || rows.length === 0) {
      return res.status(200).json({ message: "No Recipe found" });
    }
    const query = "UPDATE recipes SET title = ?, making_time = ?, serves = ?, ingredients = ?, cost = ? WHERE id = ?";
    pool.query(query, [title, making_time, serves, ingredients, cost, id], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(200).json({ message: "Recipe update failed!" });
      }
      return res.status(200).json({
        message: "Recipe successfully updated!",
        recipe: [{
          title,
          making_time,
          serves,
          ingredients,
          cost: cost.toString()
        }]
      });
    });
  });
});

// ● DELETE /recipes/:id
// 指定 id のレシピを削除する。存在しない場合はエラーレスポンスを返す。
app.delete(['/recipes/:id', '/recipes/:id/'], (req, res) => {
  const id = req.params.id;
  pool.query("SELECT * FROM recipes WHERE id = ?", [id], (err, rows) => {
    if (err || rows.length === 0) {
      return res.status(200).json({ message: "No Recipe found" });
    }
    pool.query("DELETE FROM recipes WHERE id = ?", [id], (err, result) => {
      if (err) {
        return res.status(200).json({ message: "No Recipe found" });
      }
      return res.status(200).json({ message: "Recipe successfully removed!" });
    });
  });
});

// catch-all: 未定義のエンドポイントは常に HTTP 484 を返す
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// サーバー起動（Heroku では process.env.PORT が自動設定される）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});