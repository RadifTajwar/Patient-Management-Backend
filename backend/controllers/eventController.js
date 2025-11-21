const { initializeConnection } = require("../config/database");

exports.addEvent = async (req, res) => {
  const { dateFrom, dateTo, allDay, title, eventType, location, reminderType } =
    req.body;

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

  const event_db = "event_" + bmdc;

  const sql = `
        INSERT INTO  \`${event_db}\` (dateFrom, dateTo, allDay, title, eventType, location, reminderType) 
        VALUES (?,?,?,?,?,?,?)`;

  try {
    const connection = await initializeConnection();

    await connection.query(sql, [
      dateFrom,
      dateTo,
      allDay,
      title,
      eventType,
      location,
      reminderType,
    ]);

    connection.end();

    res.status(201).send("Event added successfully");
  } catch (err) {
    console.error("Error during adding event:", error);
    res.status(500).send("Error adding event");
  }
};

exports.updateEvent = async (req, res) => {
  const {
    id,
    dateFrom,
    dateTo,
    allDay,
    title,
    eventType,
    location,
    reminderType,
  } = req.body;

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

  const event_db = "event_" + bmdc;

  const sql = `
        UPDATE \`${event_db}\` SET dateFrom = ?, dateTo = ?, allDay = ?, title = ?, eventType = ?, location = ?, reminderType = ? WHERE id = ?`;

  try {
    const connection = await initializeConnection();

    await connection.query(sql, [
      dateFrom,
      dateTo,
      allDay,
      title,
      eventType,
      location,
      reminderType,
      id,
    ]);

    connection.end();

    res.status(201).send("Event updated successfully");
  } catch (err) {
    console.error("Error during updating event:", error);
    res.status(500).send("Error updating event");
  }
};

exports.deleteEvent = async (req, res) => {
  const { id } = req.body;

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

  const event_db = "event_" + bmdc;

  const sql = `DELETE FROM \`${event_db}\`  WHERE id = ?`;

  try {
    const connection = await initializeConnection();

    await connection.query(sql, [id]);

    connection.end();

    res.status(201).send("Event deleted successfully");
  } catch (err) {
    console.error("Error during deleting event:", error);
    res.status(500).send("Error deleting event");
  }
};

exports.getDailyEvents = async (req, res) => {
  const { date } = req.body;

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

  const event_db = "event_" + bmdc;

  const sql = `SELECT  * FROM \`${event_db}\` WHERE DATE(dateFrom) = ?`;

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql, [date]);

    connection.end();

    res.json(results[0]);
  } catch (err) {
    console.error("Error during getting daily event:", error);
    res.status(500).send("Error getting daily event");
  }
};

exports.getRangeEvents = async (req, res) => {
  const { dateFrom, dateTo } = req.body;

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

  const event_db = "event_" + bmdc;

  const sql = `SELECT  * FROM \`${event_db}\` WHERE DATE(dateFrom) BETWEEN ? AND ?`;

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql, [dateFrom, dateTo]);

    connection.end();

    res.json(results[0]);
  } catch (err) {
    console.error("Error during getting daily event:", error);
    res.status(500).send("Error getting daily event");
  }
};
