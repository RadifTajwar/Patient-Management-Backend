const { initializeConnection } = require("../config/database");

exports.addPatient = async (req, res) => {
  const {
    name,
    imageURL,
    age,
    sex,
    address,
    height,
    weight,
    phone,
    email,
    bloodGroup,
    dob,
    consultlocation,
    treatmentStatus,
    registrationDate,
    recentAppointmentDate,
  } = req.body;

  //const refreshHeader = req.headers["verification"];
  const bmdc = req.headers["bmdc"];
  //

  const patient_db = "patient_" + bmdc;
  const disease = "Unknown";

  const sql = `
        INSERT INTO  \`${patient_db}\` (name, imageURL, age, sex, address, height, weight, phone, email, bloodGroup, dob, consultlocation, treatmentStatus, disease , registrationDate, recentAppointmentDate) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, ?, ?, ?)`;

  try {
    const connection = await initializeConnection();

    await connection.query(sql, [
      name,
      imageURL,
      age,
      sex,
      address,
      height,
      weight,
      phone,
      email,
      bloodGroup,
      dob,
      consultlocation,
      treatmentStatus,
      disease,
      registrationDate,
      recentAppointmentDate,
    ]);

    connection.end();
  } catch (err) {
    console.error("Error during adding patient:", err);
  }

  try {
    const connection = await initializeConnection();
    const query = `SELECT * FROM \`${patient_db}\` WHERE phone = ?`;
    const result = await connection.query(query, [phone]);

    connection.end();

    if (result[0].length > 0) {
      return res.json(result[0]);
    }
  } catch (error) {
    console.error("Error during checking phone:", error);
  }
};

exports.updateRecentAppointment = async (req, res) => {
  const { patientId, recentAppointmentDate, bmdc } = req.body;
  const patient_db = "patient_" + bmdc;
  const refreshHeader = req.headers["verification"];

  try {
    const connection = await initializeConnection();
    const query = "SELECT * FROM doctors WHERE bmdc = ?";
    const result = await connection.query(query, [bmdc]);

    connection.end();

    if (result[0].length === 0) {
      return res.status(430).send("Forbidden request");
    }
  } catch (error) {
    console.error("Error during verification:", error);
    return res.status(500).send("Error during verification");
  }

  const sql = `UPDATE \`${patient_db}\`  SET recentAppointmentDate = ? WHERE id = ?`;
  try {
    const connection = await initializeConnection();

    await connection.query(sql, [recentAppointmentDate, patientId]);

    connection.end();

    res.status(201).send("Recent Appointment Date updated successfully");
  } catch (err) {
    console.error("Error during updating recent appointment date:", error);
    res.status(500).send("Error updating recent appointment date");
  }
};

exports.updatePatient = async (req, res) => {
  const {
    id,
    name,
    imageURL,
    age,
    sex,
    address,
    height,
    weight,
    phone,
    email,
    bloodGroup,
    dob,
    consultlocation,
    treatmentStatus,
    recentAppointmentDate,
    disease,
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

  const patient_db = "patient_" + bmdc;

  try {
    const connection = await initializeConnection();
    const query = `UPDATE \`${patient_db}\`  SET name = ?, age = ?, sex = ?, address = ?, height = ?, weight = ?, phone = ?, email = ?, bloodGroup = ?, dob = ?, consultlocation = ? WHERE id = ?`;
    const result = await connection.query(query, [
      name,
      age,
      sex,
      address,
      height,
      weight,
      phone,
      email,
      bloodGroup,
      dob,
      consultlocation,
      id,
    ]);

    connection.end();

    return res.status(200).send("Profile updated successfully");
  } catch (error) {
    console.error("Profile update error: ", error);
    return res.status(500).send("Profile update error");
  }
};

exports.getPatientById = async (req, res) => {
  const { patientId } = req.body;
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

  const sql = `SELECT * FROM \`${patient_db}\` WHERE id = ?`;

  try {
    const connection = await initializeConnection();
    const [results] = await connection.query(sql, [patientId]);

    connection.end();

    if (results.length === 0) {
      res.status(404).send("Patient not found");
    } else {
      res.json(results[0]);
    }
  } catch (error) {
    console.error("Error fetching patient details:", error);
    res.status(500).send("Error fetching patient details");
  }
};

exports.getPatients = async (req, res) => {
  const {
    disease,
    sex,
    consultlocation,
    treatmentStatus,
    slotTime, // ✅ new field
    recentAppointmentDate,
    search,
  } = req.body;

  const refreshHeader = req.headers["verification"];
  const bmdc = req.headers["bmdc"];

  if (!bmdc) {
    return res.status(401).send("Unauthorized request");
  }

  try {
    const connection = await initializeConnection();

    // ✅ Verify doctor
    const [verifyResult] = await connection.query(
      "SELECT * FROM doctors WHERE bmdc = ?",
      [bmdc]
    );

    if (verifyResult.length === 0) {
      connection.end();
      return res.status(403).send("Forbidden request");
    }

    const patientTable = `patient_${bmdc}`;
    const consultationTable = `consultation_${bmdc}`;

    const conditions = [];
    const params = [];

    // 🧩 Filters
    if (disease && disease !== "None") {
      conditions.push("p.disease = ?");
      params.push(disease);
    }
    if (sex && sex !== "None") {
      conditions.push("p.sex = ?");
      params.push(sex);
    }
    if (consultlocation && consultlocation !== "None") {
      conditions.push("cl.locationName = ?");
      params.push(consultlocation);
    }
    if (treatmentStatus && treatmentStatus !== "None") {
      conditions.push("p.treatmentStatus = ?");
      params.push(treatmentStatus);
    }
    if (slotTime && slotTime !== "None") {
      // ✅ filter by timeSlotId from consultation table
      conditions.push("ts.id = ?");
      params.push(slotTime);
    }
    if (recentAppointmentDate && recentAppointmentDate !== "None") {
      conditions.push("DATE(p.recentAppointmentDate) = ?");
      params.push(recentAppointmentDate);
    }
    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      conditions.push("(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)");
      params.push(term, term, term);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // ✅ Join patient -> consultation -> location -> timeslot
    const sql = `
      SELECT 
        p.id,
        p.doctor_id,
        p.lastConsultationId,
        p.name,
        p.age,
        p.sex,
        p.address,
        p.phone,
        p.email,
        p.height,
        p.weight,
        p.bloodGroup,
        p.dob,
        p.treatmentStatus,
        p.disease,
        p.registrationDate,
        p.recentAppointmentDate,

        -- 🧩 Consultation info (from consultation_{bmdc})
        c.consultLocationId,
        c.timeSlotId,
        c.date AS consultationDate,
        c.consultType,
        c.patientCondition,
        c.consultationFee,
        c.appointmentStatus,

        -- 🏥 Consultation Location details
        cl.locationName AS consultLocationName,
        cl.address AS consultAddress,
        cl.locationType AS consultLocationType,
        cl.roomNumber AS consultRoom,
        cl.consultationFee AS consultFee,

        -- ⏰ Time Slot details
        ts.id AS timeSlotId,
        ts.startTime,
        ts.endTime,
        ts.slotDuration,
        ts.capacity

      FROM \`${patientTable}\` p
      LEFT JOIN \`${consultationTable}\` c 
        ON c.id = p.lastConsultationId
      LEFT JOIN consultation_locations cl 
        ON cl.id = c.consultLocationId
      LEFT JOIN time_slots ts 
        ON ts.id = c.timeSlotId
      ${whereClause}
      ORDER BY p.recentAppointmentDate DESC;
    `;

    const [rows] = await connection.query(sql, params);
    connection.end();

    res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Error fetching patients:", error);
    res.status(500).json({ message: "Error fetching patients" });
  }
};

exports.getAllConsultationsWithPatient = async (req, res) => {
  const { consultationId, patientId } = req.body;

  const bmdc = req.headers["bmdc"];

  if (!bmdc) {
    return res.status(401).send("Unauthorized request");
  }

  try {
    const connection = await initializeConnection();

    // ✅ Verify doctor identity
    const [verifyResult] = await connection.query(
      "SELECT * FROM doctors WHERE bmdc = ?",
      [bmdc]
    );

    if (verifyResult.length === 0) {
      connection.end();
      return res.status(403).send("Forbidden request");
    }

    const consultation_db = `consultation_${bmdc}`;
    const patient_db = `patient_${bmdc}`;

    // ✅ 1️⃣ Get all finished consultations for that patient except current one
    const sqlConsultations = `
      SELECT * 
      FROM \`${consultation_db}\`
      WHERE patientId = ? 
        AND id = ?
        OR appointmentStatus = 'Completed' 
      ORDER BY date DESC
    `;
    console.log("The sql is ", sqlConsultations);
    console.log("Params:", [patientId, consultationId]);
    const [consultationRows] = await connection.query(sqlConsultations, [
      patientId,
      consultationId,
    ]);
    console.log("result is this ", [consultationRows]);

    // ✅ 2️⃣ Get full patient details
    const sqlPatient = `
      SELECT 
        id,
        doctor_id,
        lastConsultationId,
        name,
        age,
        sex,
        address,
        phone,
        email,
        height,
        weight,
        bloodGroup,
        dob,
        consultlocation,
        treatmentStatus,
        disease,
        registrationDate,
        recentAppointmentDate
      FROM \`${patient_db}\`
      WHERE id = ?
    `;
    console.log("patient is ", sqlPatient);
    const [patientRows] = await connection.query(sqlPatient, [patientId]);
    console.log("result is ", patientRows);

    connection.end();

    // ✅ 3️⃣ Combine and send
    return res.status(200).json({
      patient: patientRows.length > 0 ? patientRows[0] : null,
      consultations: consultationRows,
    });
  } catch (error) {
    console.error("❌ Error fetching consultations with patient:", error);
    return res
      .status(500)
      .send("Error fetching consultations and patient details");
  }
};
