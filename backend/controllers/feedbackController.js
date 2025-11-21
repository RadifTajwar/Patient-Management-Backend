const { initializeConnection } = require("../config/database");

exports.addFeedback = async (req, res) => {
  const { title, review, dateTime, category } = req.body;

  const refreshHeader = req.headers["verification"];
  const bmdc = req.headers["bmdc"];

  try {
    const connection = await initializeConnection();
    const query = "SELECT * FROM doctors WHERE bmdc = ?";
    const result = await connection.query(query, [bmdc]);

    connection.end();

    if (result[0].length === 0) {
      return res.status(403).send("Forbidden request");
    }
  } catch (error) {
    console.error("Error during verification:", error);
    return res.status(500).send("Error during verification");
  }

  const sql = `INSERT INTO  feedback (title, review, dateTime, bmdc, category) VALUES (?,?,?,?,?)`;

  try {
    const connection = await initializeConnection();

    await connection.query(sql, [title, review, dateTime, bmdc, category]);

    connection.end();

    res.status(201).send("Feedback added successfully");
  } catch (err) {
    console.error("Error during adding feedback:", error);
    res.status(500).send("Error adding feedback");
  }
};

exports.getFeedback = async (req, res) => {
  const sql = `SELECT * FROM  feedback`;

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql);

    connection.end();

    res.json(results[0]);
  } catch (err) {
    console.error("Error during getting feedback:", error);
    res.status(500).send("Error getting feedback");
  }
};
