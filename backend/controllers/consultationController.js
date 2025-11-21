const axios = require("axios");
const { initializeConnection } = require("../config/database");
const nodemailer = require("nodemailer");

// 🔐 Load secret key from environment variable
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;

// 🧩 Helper function: Verify Google reCAPTCHA
async function verifyRecaptcha(token) {
  try {
    if (!token) return false;

    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: RECAPTCHA_SECRET,
          response: token,
        },
      }
    );

    console.log("🧠 reCAPTCHA verification result:", response.data);
    return response.data.success;
  } catch (err) {
    console.error("❌ reCAPTCHA verification error:", err);
    return false;
  }
}

// ============================================================
// ✅ MAIN FUNCTION: addConsultation
// ============================================================
exports.addConsultation = async (req, res) => {
  const {
    name,
    age,
    sex,
    phone,
    email,
    date, // ISO string
    timeSlotId,
    address,
    consultLocationId,
    recaptchaToken, // 👈 token from frontend
  } = req.body;

  const bmdc = req.headers["bmdc"];
  const consultation_db = "consultation_" + bmdc;

  let connection;

  try {
    // 🔒 Step 1: Verify reCAPTCHA first
    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) {
      return res.status(400).json({
        success: false,
        message: "reCAPTCHA verification failed. Please try again.",
      });
    }

    // ✅ 2. Continue normal appointment flow
    connection = await initializeConnection();
    await connection.beginTransaction();

    // ✅ 3. Get doctor info
    const [doctorRows] = await connection.query(
      "SELECT id, name, bmdc FROM doctors WHERE bmdc = ?",
      [bmdc]
    );
    if (doctorRows.length === 0) {
      await connection.rollback();
      connection.end();
      return res.status(404).send("Doctor not found");
    }
    const { id: doctorId, name: doctorName } = doctorRows[0];

    // ✅ 4. Get location info
    const [locationRows] = await connection.query(
      "SELECT locationName FROM consultation_locations WHERE id = ?",
      [consultLocationId]
    );
    if (locationRows.length === 0) {
      await connection.rollback();
      connection.end();
      return res.status(404).send("Consultation location not found");
    }
    const { locationName } = locationRows[0];

    // ✅ 5. Get slot info
    const [slotRows] = await connection.query(
      "SELECT capacity, startTime, endTime FROM time_slots WHERE id = ?",
      [timeSlotId]
    );
    if (slotRows.length === 0) {
      await connection.rollback();
      connection.end();
      return res.status(404).send("Time slot not found");
    }
    const { capacity, startTime, endTime } = slotRows[0];

    // ✅ 6. Check duplicate appointment
    const [existingRows] = await connection.query(
      `SELECT id, date, serialNo
       FROM \`${consultation_db}\`
       WHERE phone = ?
       AND DATE(date) = DATE(?) 
       AND consultLocationId = ?
       AND timeSlotId = ?`,
      [phone, date, consultLocationId, timeSlotId]
    );

    if (existingRows.length > 0) {
      await connection.rollback();
      connection.end();

      const existing = existingRows[0];
      return res.status(409).json({
        success: false,
        reason: "duplicate_appointment",
        title: "Appointment Already Exists",
        message: `You already have an appointment booked for this slot on ${new Date(
          existing.date
        ).toLocaleDateString()} with Dr. ${doctorName}.`,
        existingAppointment: {
          serialNo: existing.serialNo,
          date: existing.date,
          location: locationName,
          slotTime: `${startTime} - ${endTime}`,
        },
      });
    }

    // ✅ 7. Compute next serial number
    const dateOnly = date.split("T")[0];
    const [rows] = await connection.query(
      `SELECT COALESCE(MAX(serialNo), 0) AS maxSerial
       FROM \`${consultation_db}\`
       WHERE DATE(date) = ?
       AND consultLocationId = ?
       AND timeSlotId = ?`,
      [dateOnly, consultLocationId, timeSlotId]
    );

    const serialNo = rows[0].maxSerial + 1;

    // ✅ 8. Check slot capacity
    if (serialNo > capacity) {
      await connection.rollback();
      connection.end();
      return res.status(409).json({
        success: false,
        reason: "slot_full",
        title: "All Slots Are Booked",
        message: `Sorry, all ${capacity} appointments for ${new Date(
          date
        ).toLocaleDateString()} (${startTime} - ${endTime}) are already booked.`,
        slotInfo: {
          date,
          startTime,
          endTime,
          capacity,
          location: locationName,
        },
      });
    }

    // ✅ 9. Insert new appointment
    const appointmentStatus = "booked";
    const message = "Consultation is booked successfully";

    const insertQuery = `
      INSERT INTO \`${consultation_db}\`
      (doctor_id, serialNo, name, age, sex, phone, email, address,
       consultLocationId, date, timeSlotId, appointmentStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await connection.query(insertQuery, [
      doctorId,
      serialNo,
      name,
      age,
      sex,
      phone,
      email || null,
      address,
      consultLocationId,
      date,
      timeSlotId,
      appointmentStatus,
    ]);

    await connection.commit();

    // ✅ 10. Prepare response
    const appointment = {
      patient: { name, age, sex, phone, email, address },
      doctor: { name: doctorName, bmdc },
      location: { id: consultLocationId, name: locationName },
      slot: { id: timeSlotId, startTime, endTime, capacity },
      serialNo,
      date,
      status: appointmentStatus,
      slotTime: `${startTime} - ${endTime}`,
    };

    // ✅ 11. Send email confirmation (optional)
    if (email && email.includes("@")) {
      const { sendEmail } = require("../utils/email");
      const { appointmentEmailTemplate } = require("../utils/emailTemplate");
      const emailHtml = appointmentEmailTemplate(appointment);
      const subject = `Your Appointment with Dr. ${doctorName} — ${
        appointment.status === "confirmed" ? "Confirmed" : "Pending Approval"
      }`;
      sendEmail(email, subject, emailHtml);
    }

    res.status(201).json({
      success: true,
      message,
      appointment,
    });
  } catch (err) {
    console.error("❌ Error during adding consultation:", err);
    try {
      if (connection) await connection.rollback();
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    res.status(500).json({
      success: false,
      message:
        "An unexpected error occurred while booking your appointment. Please try again later.",
    });
  } finally {
    if (connection) connection.end();
  }
};

exports.cancelAppointment = async (req, res) => {
  let { appointmentId } = req.body;

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

  let sql = `UPDATE  \`${consultation_db}\` SET appointmentStatus = 'Cancelled' WHERE id = ?`;

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql, [appointmentId]);

    connection.end();

    res.status(200).send("Appointment Cancelled Successfully");
  } catch (err) {
    console.error("Error cancelling appointment ", error);
    res.status(500).send("Error cancelling appointment");
  }
};

exports.updateConsultation = async (req, res) => {
  const {
    id,
    name,
    age,
    sex,
    phone,
    email,
    address,
    patientId,
    patientCondition,
    appointmentStatus,
    audioURL,
    medicalTests,
    medicalReports,
    consultType,
    medicalFiles,
    reportComments,
    patientAdvice,
    medicine,
    disease,
    recoveryStatus,
    followUp,
    prescription,
    medical_report,
    symptoms,
    consultationFee,
    paymentStatus,
    date,
  } = req.body;

  const refreshHeader = req.headers["verification"];
  const bmdc = req.headers["bmdc"];

  if (!bmdc) {
    return res.status(401).send("Unauthorized request");
  }

  try {
    const connection = await initializeConnection();

    // ✅ Verify doctor
    const verifySql = "SELECT * FROM doctors WHERE bmdc = ?";
    const [verifyResult] = await connection.query(verifySql, [bmdc]);

    if (verifyResult.length === 0) {
      connection.end();
      return res.status(403).send("Forbidden request");
    }

    const consultationTable = `consultation_${bmdc}`;
    const patientTable = `patient_${bmdc}`;

    // ✅ Prepare fields to update dynamically
    const updateFields = [];
    const params = [];

    if (name !== undefined) {
      updateFields.push("name = ?");
      params.push(name);
    }
    if (age !== undefined) {
      updateFields.push("age = ?");
      params.push(age);
    }
    if (sex !== undefined) {
      updateFields.push("sex = ?");
      params.push(sex);
    }
    if (phone !== undefined) {
      updateFields.push("phone = ?");
      params.push(phone);
    }
    if (email !== undefined) {
      updateFields.push("email = ?");
      params.push(email);
    }
    if (address !== undefined) {
      updateFields.push("address = ?");
      params.push(address);
    }
    if (patientCondition !== undefined) {
      updateFields.push("patientCondition = ?");
      params.push(patientCondition);
    }
    if (appointmentStatus !== undefined) {
      updateFields.push("appointmentStatus = ?");
      params.push(appointmentStatus);
    }
    if (audioURL !== undefined) {
      updateFields.push("audioURL = ?");
      params.push(audioURL);
    }
    if (medicalTests !== undefined) {
      updateFields.push("medicalTests = ?");
      params.push(medicalTests);
    }
    if (medicalReports !== undefined) {
      updateFields.push("medicalReports = ?");
      params.push(medicalReports);
    }
    if (medicalFiles !== undefined) {
      updateFields.push("medicalFiles = ?");
      params.push(medicalFiles);
    }
    if (reportComments !== undefined) {
      updateFields.push("reportComments = ?");
      params.push(reportComments);
    }
    if (patientAdvice !== undefined) {
      updateFields.push("patientAdvice = ?");
      params.push(patientAdvice);
    }
    if (medicine !== undefined) {
      updateFields.push("medicine = ?");
      params.push(medicine);
    }

    // ✅ Disease stays in consultation table
    if (disease !== undefined) {
      updateFields.push("disease = ?");
      params.push(disease);
    }

    if (recoveryStatus !== undefined) {
      updateFields.push("recoveryStatus = ?");
      params.push(recoveryStatus);
    }
    if (followUp !== undefined) {
      updateFields.push("followUp = ?");
      params.push(followUp);
    }
    if (prescription !== undefined) {
      updateFields.push("prescription = ?");
      params.push(prescription);
    }
    if (medical_report !== undefined) {
      updateFields.push("medical_report = ?");
      params.push(medical_report);
    }
    if (symptoms !== undefined) {
      const symptoms_json = Array.isArray(symptoms)
        ? JSON.stringify(symptoms)
        : JSON.stringify(symptoms ? [symptoms] : []);
      updateFields.push("symptoms_list = ?");
      params.push(symptoms_json);
    }
    if (consultationFee !== undefined) {
      updateFields.push("consultationFee = ?");
      params.push(consultationFee);
    }
    if (paymentStatus !== undefined) {
      updateFields.push("paymentStatus = ?");
      params.push(paymentStatus);
    }
    if (date !== undefined) {
      updateFields.push("date = ?");
      params.push(date ? date.split("T")[0] : null);
    }
    if (patientId !== undefined) {
      updateFields.push("patientId = ?");
      params.push(patientId);
    }

    if (consultType !== undefined) {
      updateFields.push("consultType = ?");
      params.push(consultType);
    }

    // 🛑 If no updatable fields, skip
    if (updateFields.length === 0) {
      connection.end();
      return res.status(400).json({ message: "No valid fields to update" });
    }

    console.log("update fields ", updateFields);

    // ✅ Build dynamic SQL
    const sql = `
      UPDATE \`${consultationTable}\`
      SET ${updateFields.join(", ")}
      WHERE id = ?;
    `;
    params.push(id);

    await connection.query(sql, params);

    // ✅ Optionally update patient record for recent appointment
    if (patientId && date) {
      const patient_sql = `
        UPDATE \`${patientTable}\`
        SET recentAppointmentDate = ?, disease = ?
        WHERE id = ?;
      `;
      await connection.query(patient_sql, [
        date.split("T")[0],
        disease || null,
        patientId,
      ]);
    }

    connection.end();
    res.status(200).json({ message: "Consultation Updated Successfully" });
  } catch (err) {
    console.error("Error updating consultation:", err);
    res.status(500).send("Error updating consultation");
  }
};

exports.createPatientAndUpdateAppointment = async (req, res) => {
  const { consultationId, patientData } = req.body;
  const refreshHeader = req.headers["verification"];
  const bmdc = req.headers["bmdc"];

  if (!bmdc) {
    return res.status(401).send("Unauthorized request");
  }

  let connection;
  try {
    connection = await initializeConnection();

    // ✅ Verify doctor
    const [verifyResult] = await connection.query(
      "SELECT * FROM doctors WHERE bmdc = ?",
      [bmdc]
    );
    if (verifyResult.length === 0) {
      connection.end();
      return res.status(403).send("Forbidden request");
    }

    const doctorId = verifyResult[0].id;
    const patientTable = `patient_${bmdc}`;
    let patientId = patientData.patientId;

    // ✅ If existing patient: just update their last appointment info + metrics
    if (patientId) {
      const updateSql = `
        UPDATE \`${patientTable}\`
        SET lastConsultationId = ?, recentAppointmentDate = NOW()
        WHERE id = ? AND doctor_id = ?
      `;
      await connection.query(updateSql, [consultationId, patientId, doctorId]);
      console.log("🧩 Existing patient updated:", patientId);

      // 🩺 Update patient metrics if provided
      const extraUpdateFields = [];
      const extraParams = [];

      if (patientData.height !== undefined) {
        extraUpdateFields.push("height = ?");
        extraParams.push(patientData.height);
      }
      if (patientData.weight !== undefined) {
        extraUpdateFields.push("weight = ?");
        extraParams.push(patientData.weight);
      }
      if (patientData.bloodGroup !== undefined) {
        extraUpdateFields.push("bloodGroup = ?");
        extraParams.push(patientData.bloodGroup);
      }
      if (patientData.disease !== undefined) {
        extraUpdateFields.push("disease = ?");
        extraParams.push(patientData.disease);
      }

      if (extraUpdateFields.length > 0) {
        const extraSql = `
          UPDATE \`${patientTable}\`
          SET ${extraUpdateFields.join(", ")}
          WHERE id = ? AND doctor_id = ?
        `;
        await connection.query(extraSql, [...extraParams, patientId, doctorId]);
        console.log("🩺 Updated patient metrics for:", patientId);
      }
    } else {
      // ✅ New patient creation (added disease here)
      const insertPatientSql = `
        INSERT INTO \`${patientTable}\`
          (doctor_id, lastConsultationId, name, age, sex, address, phone, email, consultlocation,
           height, weight, bloodGroup, disease, registrationDate, recentAppointmentDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      const [patientResult] = await connection.query(insertPatientSql, [
        doctorId,
        consultationId,
        patientData.name || "Unknown",
        patientData.age || null,
        patientData.sex || "N/A",
        patientData.address || "",
        patientData.phone || "",
        patientData.email || "",
        patientData.consultlocation || "",
        patientData.height || null,
        patientData.weight || null,
        patientData.bloodGroup || "",
        patientData.disease || "", // ✅ new field added
      ]);

      patientId = patientResult.insertId;
      console.log("✅ New patient created:", patientId);
    }

    connection.end();

    // ✅ Build and call updateConsultation
    const mockReq = {
      headers: req.headers,
      body: {
        ...patientData,
        id: consultationId,
        patientId,
        consultType: patientData.consultType,
      },
    };

    const mockRes = {
      status: (code) => ({
        json: (payload) => ({ code, payload }),
        send: (msg) => ({ code, msg }),
      }),
    };

    const updateResult = await exports.updateConsultation(mockReq, mockRes);

    res.status(200).json({
      message: patientData.patientId
        ? "Existing patient updated and consultation linked"
        : "New patient created and consultation linked",
      patientId,
      consultType: patientData.consultType,
      updateResponse: updateResult || "Consultation updated",
    });
  } catch (err) {
    console.error("❌ Error creating/updating patient and consultation:", err);
    if (connection) connection.end();
    res.status(500).send("Error creating/updating patient and consultation");
  }
};

exports.getAppointments = async (req, res) => {
  let {
    consultlocation,
    consultType,
    slotTime,
    dateTime: date,
    appointmentStatus,
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
    const verifySql = `
      SELECT * FROM doctors WHERE bmdc = ?
    `;
    const [verifyResult] = await connection.query(verifySql, [bmdc]);
    if (verifyResult.length === 0) {
      connection.end();
      return res.status(403).send("Forbidden request");
    }

    const consultationTable = `consultation_${bmdc}`;

    // ✅ Base query (joined with location + time slots)
    let sql = `
      SELECT 
        c.id,
        c.doctor_id,
        c.serialNo,
        c.name,
        c.age,
        c.sex,
        c.email,
        c.phone,
        c.address,
        c.consultLocationId,
        cl.locationName AS consultLocationName,
        c.timeSlotId,
        CONCAT(ts.startTime, ' - ', ts.endTime) AS slotTime,
        c.patientId,
        c.consultType,
        c.patientCondition,
        c.consultationFee,
        c.paymentStatus,
        c.appointmentStatus,
        c.date
      FROM \`${consultationTable}\` AS c
      LEFT JOIN consultation_locations AS cl ON c.consultLocationId = cl.id
      LEFT JOIN time_slots AS ts ON c.timeSlotId = ts.id
      WHERE 1=1
    `;

    const params = [];

    // ✅ Dynamic Filters

    // Consultation Type
    if (consultType && consultType !== "None") {
      sql += " AND c.consultType = ? ";
      params.push(consultType);
    }

    // Appointment Status
    if (appointmentStatus && appointmentStatus !== "None") {
      sql += " AND c.appointmentStatus = ? ";
      params.push(appointmentStatus);
    }

    // Date (YYYY-MM-DD)
    if (date && date !== "None") {
      sql += " AND DATE(c.date) = DATE(?) ";
      params.push(String(date).slice(0, 10));
    }

    // Consultation Location (ID)
    if (consultlocation && consultlocation !== "None") {
      sql += " AND c.consultLocationId = ? ";
      params.push(consultlocation);
    }

    // Slot Time (ID)
    if (slotTime && slotTime !== "None") {
      sql += " AND c.timeSlotId = ? ";
      params.push(slotTime);
    }

    // Text Search (name / phone / email)
    if (search && search.trim() !== "") {
      sql +=
        " AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ?) ";
      const likeTerm = `%${search.trim()}%`;
      params.push(likeTerm, likeTerm, likeTerm, likeTerm);
    }

    // ✅ Sort by date and serial
    sql += " ORDER BY c.date DESC, c.id DESC;";

    console.log("[getAppointments] SQL:", sql);
    console.log("[getAppointments] Params:", params);

    const [rows] = await connection.query(sql, params);
    connection.end();

    // ✅ Normalize output
    const normalized = rows.map((r) => ({
      id: r.id,
      doctorId: r.doctor_id,
      serialNo: r.serialNo,
      name: r.name ?? "Unknown",
      age: r.age ?? null,
      sex: r.sex ?? "N/A",
      email: r.email ?? null,
      phone: r.phone ?? null,
      address: r.address ?? "No Address",
      consultLocationId: r.consultLocationId ?? null,
      consultLocationName: r.consultLocationName ?? "N/A",
      timeSlotId: r.timeSlotId ?? null,
      slotTime: r.slotTime ?? "N/A",
      patientId: r.patientId ?? null,
      consultType: r.consultType ?? "Not Given",
      patientCondition: r.patientCondition ?? null,
      consultationFee: r.consultationFee ?? 0,
      paymentStatus: r.paymentStatus ?? "pending",
      appointmentStatus: r.appointmentStatus ?? "waiting_approval",
      date: r.date,
    }));

    res.json(normalized);
  } catch (err) {
    console.error("❌ Error getting consultation:", err.message);
    res.status(500).send("Error getting consultation");
  }
};

exports.getSingleAppointment = async (req, res) => {
  const { id } = req.params;
  const refreshHeader = req.headers["verification"];
  const bmdc = req.headers["bmdc"];

  if (!bmdc) {
    return res.status(401).send("Unauthorized request");
  }

  try {
    const connection = await initializeConnection();

    // ✅ Verify doctor
    const verifySql = "SELECT * FROM doctors WHERE bmdc = ?";
    const [verifyResult] = await connection.query(verifySql, [bmdc]);

    if (verifyResult.length === 0) {
      connection.end();
      return res.status(403).send("Forbidden request");
    }

    // ✅ Define tables correctly based on your schema
    const consultationTable = `consultation_${bmdc}`;
    const patientTable = `patient_${bmdc}`;
    const locationTable = `consultation_locations`;
    const timeSlotTable = `time_slots`;

    // ✅ Query with correct joins
    const sql = `
      SELECT
        c.id AS appointmentId,
        c.serialNo,
        c.name AS patientName,
        c.age,
        c.sex,
        c.email,
        c.phone,
        c.address,
        c.consultType,
        c.consultLocationId,
        c.timeSlotId,
        c.patientId,
        c.patientCondition,
        c.consultationFee,
        c.paymentStatus,
        c.appointmentStatus,
        c.date AS appointmentDate,

        -- Location details
        loc.locationName AS consultLocationName,
        loc.address AS consultLocationAddress,
        loc.locationType,
        loc.consultationFee AS locationFee,

        -- Time slot details
        ts.startTime,
        ts.endTime,
        ts.slotDuration,
        ts.capacity,

        -- Patient info (if exists)
        p.name AS patientFullName,
        p.age AS patientAge,
        p.sex AS patientSex,
        p.email AS patientEmail,
        p.phone AS patientPhone,
        p.address AS patientAddress

      FROM \`${consultationTable}\` AS c
      LEFT JOIN \`${locationTable}\` AS loc ON c.consultLocationId = loc.id
      LEFT JOIN \`${timeSlotTable}\` AS ts ON c.timeSlotId = ts.id
      LEFT JOIN \`${patientTable}\` AS p ON c.patientId = p.id
      WHERE c.id = ?
      LIMIT 1;
    `;

    console.log("[getSingleAppointment] SQL:", sql);

    const [rows] = await connection.query(sql, [id]);
    connection.end();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const r = rows[0];

    // ✅ Normalize the response
    const detailed = {
      id: r.appointmentId,
      serialNo: r.serialNo,
      patient: {
        id: r.patientId,
        name: r.patientFullName || r.patientName,
        age: r.patientAge || r.age,
        sex: r.patientSex || r.sex,
        email: r.patientEmail || r.email,
        phone: r.patientPhone || r.phone,
        address: r.patientAddress || r.address,
      },
      consultation: {
        type: r.consultType || "General",
        condition: r.patientCondition,
        fee: r.consultationFee ?? r.locationFee ?? 0,
        status: r.appointmentStatus,
        paymentStatus: r.paymentStatus,
        date: r.appointmentDate,
      },
      location: {
        id: r.consultLocationId,
        name: r.consultLocationName || "N/A",
        type: r.locationType || "N/A",
        address: r.consultLocationAddress || "N/A",
      },
      timeSlot: {
        id: r.timeSlotId,
        startTime: r.startTime,
        endTime: r.endTime,
        duration: r.slotDuration,
        capacity: r.capacity,
      },
    };

    res.json(detailed);
  } catch (err) {
    console.error("Error getting single appointment:", err);
    res.status(500).send("Error fetching appointment details");
  }
};

exports.getNotes = async (req, res) => {
  let { disease, consultlocation, consultType, appointmentDate } = req.body;

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

  let sql = `SELECT id, consultlocation, consultType, dateTime, disease, doctorNotes from \`${consultation_db}\` WHERE `;

  let data = [];
  if (consultlocation !== "None") {
    sql = sql + "consultlocation = ? ";
    data.push(consultlocation);
  } else {
    sql = sql + "consultlocation IS NOT NULL ";
  }

  if (consultType !== "None") {
    sql = sql + "AND consultType = ? ";
    data.push(consultType);
  } else {
    sql = sql + "AND consultType IS NOT NULL ";
  }

  if (appointmentDate !== "None") {
    sql = sql + "AND DATE(dateTime) = ? ";
    data.push(appointmentDate);
  } else {
    sql = sql + "AND dateTime IS NOT NULL ";
  }

  if (disease !== "None") {
    sql = sql + "AND disease = ? ";
    data.push(disease);
  }

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql, data);

    connection.end();

    res.json(results[0]);
  } catch (err) {
    console.error("Error getting consultation notes:", error);
    res.status(500).send("Error getting consultation notes");
  }
};

exports.getAllConsultations = async (req, res) => {
  const { consultationId, patientId } = req.body;
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

  const sql = `SELECT  * from \`${consultation_db}\` WHERE patientId = ? AND id <> ?`;

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql, [patientId, consultationId]);

    connection.end();

    res.json(results[0]);
  } catch (err) {
    console.error("Error getting all consultation:", error);
    res.status(500).send("Error getting all consultation");
  }
};

exports.getSingleConsultation = async (req, res) => {
  const { bmdc } = req.body;

  const refreshHeader = req.headers["verification"];

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

  const consultationId = req.params.id;

  const consultation_db = "consultation_" + bmdc;

  const sql = `SELECT  * from \`${consultation_db}\` WHERE id = ?`;

  try {
    const connection = await initializeConnection();

    const results = await connection.query(sql, [consultationId]);

    connection.end();

    res.json(results[0]);
  } catch (err) {
    console.error("Error getting single consultation:", error);
    res.status(500).send("Error getting single consultation");
  }
};
