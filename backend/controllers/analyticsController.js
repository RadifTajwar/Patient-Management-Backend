const { initializeConnection } = require("../config/database");
const { OpenAI } = require("openai");

exports.getCounts = async (req, res) => {
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

  const patient_db = "patient_" + bmdc;
  const consultation_db = "consultation_" + bmdc;

  const patient_sql = `SELECT COUNT(*) AS totalPatients FROM \`${patient_db}\` `;
  const appointment_sql = `SELECT COUNT(*) AS totalAppointments FROM \`${consultation_db}\` WHERE appointmentStatus <> 'Cancelled'`;
  const consultationfee_sql = `SELECT SUM(consultationFee) AS totalFees FROM \`${consultation_db}\` WHERE appointmentStatus <> 'Cancelled'`;

  try {
    const connection = await initializeConnection();

    const patientCount = await connection.query(patient_sql);
    const appointmentCount = await connection.query(appointment_sql);
    const feeCount = await connection.query(consultationfee_sql);

    connection.end();

    res.json({
      totalPatients: patientCount[0][0].totalPatients,
      totalAppointments: appointmentCount[0][0].totalAppointments,
      totalConsultationFee: feeCount[0][0].totalFees,
    });
  } catch (err) {
    console.error("Error during counting patient and consultation:", error);
    res.status(500).send("Error during counting patient and consultation");
  }
};

exports.getConsultationPerMonth = async (req, res) => {
  const { consultlocation, consultType, disease, year } = req.body;
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

  const consultation_db = "consultation_" + bmdc;

  let sql = `SELECT DATE_FORMAT(dateTime, '%b') AS Month,  COUNT(*) AS ConsultationCount, SUM(consultationFee) AS TotalFees FROM \`${consultation_db}\` 
                WHERE YEAR(dateTime) = ? AND appointmentStatus <> 'Cancelled' `;

  let data = [year];
  if (consultlocation !== "None") {
    sql = sql + "AND consultlocation = ? ";
    data.push(consultlocation);
  } else {
    sql = sql + "AND consultlocation IS NOT NULL ";
  }

  if (consultType !== "None") {
    sql = sql + "AND consultType = ? ";
    data.push(consultType);
  } else {
    sql = sql + "AND consultType IS NOT NULL ";
  }

  if (disease !== "None") {
    sql = sql + "AND disease = ? ";
    data.push(disease);
  }

  sql = sql + `GROUP BY MONTH(dateTime) ORDER BY Month DESC`;

  try {
    const connection = await initializeConnection();

    const consultationPerMonth = await connection.query(sql, data);

    connection.end();

    res.json(consultationPerMonth[0]);
  } catch (err) {
    console.error("Error during counting consultation per month:", error);
    res.status(500).send("Error during counting consultation per month");
  }
};

exports.getPatientPerMonth = async (req, res) => {
  const { disease, treatmentStatus, age, sex, year } = req.body;
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

  const patient_db = "patient_" + bmdc;

  let sql = `SELECT DATE_FORMAT(registrationDate, '%b') AS Month,  COUNT(*) AS PatientCount FROM \`${patient_db}\` 
                WHERE YEAR(registrationDate) = ? `;

  let data = [year];
  if (treatmentStatus !== "None") {
    sql = sql + "AND treatmentStatus = ? ";
    data.push(treatmentStatus);
  } else {
    sql = sql + "AND treatmentStatus IS NOT NULL ";
  }

  if (age > 0) {
    sql = sql + "AND age = ? ";
    data.push(age);
  } else {
    sql = sql + "AND age IS NOT NULL ";
  }

  if (sex !== "None") {
    sql = sql + "AND sex = ? ";
    data.push(sex);
  } else {
    sql = sql + "AND sex IS NOT NULL ";
  }

  if (disease !== "None") {
    sql = sql + "AND disease = ? ";
    data.push(disease);
  }

  sql = sql + `GROUP BY MONTH(registrationDate) ORDER BY Month DESC`;

  try {
    const connection = await initializeConnection();
    const patientPerMonth = await connection.query(sql, data);

    connection.end();

    res.json(patientPerMonth[0]);
  } catch (err) {
    console.error("Error during counting patient per month:", err);
    res.status(500).send("Error during counting patient per month");
  }
};

exports.getGenderDist = async (req, res) => {
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

  const patient_db = "patient_" + bmdc;

  let sql = `SELECT sex AS Sex, COUNT(*) AS PatientCount FROM \`${patient_db}\` GROUP BY sex`;

  try {
    const connection = await initializeConnection();
    const patientPerMonth = await connection.query(sql);

    connection.end();

    res.json(patientPerMonth[0]);
  } catch (err) {
    console.error("Error during counting gender dist:", err);
    res.status(500).send("Error during counting gender dist");
  }
};

let queryMessage = `I have built a patient management system which has a MySQL database. The database contains three tables named Consultation, Patient and Event. Consultation table contains information about the past and future appointment related information. The Consultation table schema is as follows

id INT NOT NULL AUTO_INCREMENT,
patientId INT NOT NULL,
consultlocation VARCHAR(100) NOT NULL,
consultType VARCHAR(10) NOT NULL,
dateTime DATETIME NOT NULL,
patientCondition VARCHAR(1024),
consultationFee INT NOT NULL,
appointmentStatus VARCHAR(10) NOT NULL,
audioURL VARCHAR(512),
medicalTests VARCHAR(512),
medicalReports VARCHAR(1024),
reportComments VARCHAR(1024),
patientAdvice VARCHAR(1024),
medicine VARCHAR(512),
doctorNotes VARCHAR(1024),
recoveryStatus INT,
disease VARCHAR(50),
followUp DATE,

Here patientId means the unique id of patient, consultlocation means the location of the appointment or consultation location, consultType means New or Follow Up appointment.  dateTime column means the consultation date, patient condition keeps the patient health records such as blood pressure or blood suger level. consultationFee column is the fee of the consultation and appointmentStatus means the state of the appointment such as Done or Pending. Medical Tests and reports contains information related to recommended medical tests and reports for patient. reportComment contains the doctors comment on the medical test report, whereas patientAdvice contains the advice from doctor to patient. Medicine field contains the prescribed medicine from doctor. doctorNotes contain the notes taken by doctor during consultation. Disease mentions the disease of the patient and recoveryStatus means the patients recovery status from disease. At last the followUp is the date for follow up visit of patients to the doctor.

Now Patient table schema is as follows 
id INT NOT NULL AUTO_INCREMENT,
name VARCHAR(100) NOT NULL,
imageURL VARCHAR(512),
age INT NOT NULL,
sex VARCHAR(10) NOT NULL,
address VARCHAR(100) NOT NULL,
height DECIMAL NOT NULL,
weight DECIMAL NOT NULL,
phone VARCHAR(20) UNIQUE NOT NULL,
email VARCHAR(50) UNIQUE NOT NULL,
bloodGroup VARCHAR(10) NOT NULL,
dob DATE NOT NULL,
consultlocation VARCHAR(100) NOT NULL,
treatmentStatus VARCHAR(10) NOT NULL,
recentAppointmentDate DATE,


Here patient table contains information of individual patient such as age, sex, address, height, weight, phone, email and bloodgroup. dob contains the date of birth of the patient, consultlocation means the location of appointment for patient. Treatment Status means the state of the patient's treatment which can be Complete or Ongoing. RecentAppointmentDate means the last appointment date of the patient. 

At last the Event table schema is as follows

id INT NOT NULL AUTO_INCREMENT,
date DATE NOT NULL,
timeFrom TIME NOT NULL,
timeTo TIME NOT NULL,
allDay BOOLEAN NOT NULL,
title VARCHAR(50) NOT NULL,
eventType VARCHAR(20) NOT NULL,
location VARCHAR(20) NOT NULL,
reminderType INT NOT NULL,

Here the Event table has column date which mentions the event date, timeFrom and timeTo means the begin and end time of the event. AllDay identifies if the event is going to be held all day. Title is the title of the event. Event type mentions the type of event for individual event. Location means the location of the event. Reminder type identifies the type of reminder needed for the event which can remind 15 or 30 minute before the event. 

Now using the above table information please write a MySQL query for the following question, (do not add anything other than MySQL query statement in the output).`;

async function getChatResponse(message) {
  const openai = new OpenAI({
    apiKey:
      "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",
  });

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: queryMessage }],
  });

  return chatCompletion.choices[0].message.content;
}

exports.getQueryResults = async (req, res) => {
  const { query, bmdc } = req.body;
  const consultation_db = "consultation_" + bmdc;
  const patient_db = "patient_" + bmdc;
  const event_db = "event_" + bmdc;

  queryMessage =
    queryMessage +
    `\n Please use table name \`${consultation_db}\` for Consultation table, table name \`${patient_db}\` for Patient table and table name \`${event_db}\` for Event table in the MySQL query. Please also do not mention the word sql or any other word in the response except MySQL query keywords and do not wrap or add any back tick at the first or last of the MySQL query statements, also please do not add any kind of punctuation anywhere (first or last) of the MySQL query statement. Finally please do not perform any JOIN operation on any of the Patient, Event and  Consultation table.\n`;
  queryMessage =
    queryMessage +
    `Before generating any query first think if the output is going to be numeric value. If so then determine which patient and consultation table properties are involved in the query. If only one table properties are invloved in the query then do not join the tables. If any value in the query is related to multiple properties of any table then compare with both of those properties and take their union to generate result in MySQL query.please do not perform any JOIN operation on any of the Patient, Event and  Consultation table. Please do not add any unnecessary conditions in the SQL. Do not add property of one table as condition in where or group by clause of for searching in another table. \n`;
  queryMessage = queryMessage + `Query:  ` + query;

  let sql = await getChatResponse();

  //sql = `SELECT * FROM \`${consultation_db}\``;

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql);

    res.json(results[0]);
  } catch (err) {
    console.error("Error during query data:", err);
    res.status(500).send("Error during query data");
  }
};
