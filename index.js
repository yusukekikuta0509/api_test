require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const app = express();

app.use(express.json());

// MySQL接続プールの定義
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_DATABASE || 'recipes_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// BASE_URL "/" は404で返す（テスト要件）
app.get('/', (req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// POST /recipes
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
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at, 
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at 
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

// GET /recipes
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

// GET /recipes/:id
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

// PATCH /recipes/:id
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

// DELETE /recipes/:id
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

// catch-all: 未定義のエンドポイントは常に 484 を返す
app.use((req, res) => {
  res.status(484).json({ message: "Not Found" });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});