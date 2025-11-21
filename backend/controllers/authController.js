const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { initializeConnection } = require("../config/database");

// Load environment variables
require("dotenv").config();

exports.register = async (req, res) => {
  console.log("coming here");
  try {
    const { name, email, bmdc, phone, password, promoCode } = req.body;

    // 1️⃣ Validate missing fields
    if (!name || !email || !bmdc || !phone || !password || !promoCode) {
      return res
        .status(400)
        .json({ message: "All fields are required", code: "MISSING_FIELDS" });
    }

    // 2️⃣ Validate promo code
    if (promoCode !== "123456789") {
      return res
        .status(400)
        .json({ message: "Invalid promo code", code: "INVALID_PROMO" });
    }

    const connection = await initializeConnection();

    // 3️⃣ Ensure table exists
    const doctorsTableSchema = `
      CREATE TABLE IF NOT EXISTS doctors (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        bmdc VARCHAR(32) UNIQUE NOT NULL,
        phone VARCHAR(32) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        imageURL VARCHAR(512) NULL,
        specialty VARCHAR(100) NULL,
        address VARCHAR(255) NULL,
        consultlocation VARCHAR(255) NULL,
        refreshtoken VARCHAR(255) NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await connection.query(doctorsTableSchema);

    // 4️⃣ Check if doctor already exists by email, bmdc, or phone
    const [existing] = await connection.query(
      "SELECT email, bmdc, phone FROM doctors WHERE email = ? OR bmdc = ? OR phone = ? LIMIT 1",
      [email, bmdc, phone]
    );

    if (existing.length > 0) {
      const conflict = existing[0];
      let reason = "User already registered";

      if (conflict.email === email) reason = "Email already in use";
      else if (conflict.bmdc === bmdc)
        reason = "BMDC number already registered";
      else if (conflict.phone === phone)
        reason = "Phone number already registered";

      return res.status(409).json({ message: reason, code: "DUPLICATE_USER" });
    }

    // 5️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6️⃣ Insert doctor
    const [result] = await connection.query(
      `INSERT INTO doctors (name, email, bmdc, phone, password) VALUES (?, ?, ?, ?, ?)`,
      [name, email, bmdc, phone, hashedPassword]
    );
    const doctorId = result.insertId;

    // 7️⃣ Create related tables
    const patientTable = `patient_${bmdc}`;
    const consultationTable = `consultation_${bmdc}`;

    const patientTableSchema = `
      CREATE TABLE IF NOT EXISTS \`${patientTable}\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        doctor_id INT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        age INT NULL,
        sex VARCHAR(10) NULL,
        address VARCHAR(100) NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(100) NULL,
        height DECIMAL(5,2) NULL,
        weight DECIMAL(5,2) NULL,
        bloodGroup VARCHAR(10) NULL,
        dob DATE NULL,
        lastConsultationId INT UNSIGNED NULL,
        consultlocation VARCHAR(100) NULL,
        treatmentStatus VARCHAR(20) NULL,
        disease VARCHAR(100) NULL,
        registrationDate DATE NULL,
        recentAppointmentDate DATE NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const consultationTableSchema = `
      CREATE TABLE IF NOT EXISTS \`${consultationTable}\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        doctor_id INT UNSIGNED NOT NULL,
        serialNo INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        age INT NOT NULL,
        sex VARCHAR(20) NOT NULL,
        email VARCHAR(100) NULL,
        phone VARCHAR(50) NOT NULL,
        address VARCHAR(1024) NULL,
        consultLocationId INT UNSIGNED NOT NULL, 
        date DATETIME NOT NULL,
        timeSlotId INT UNSIGNED NOT NULL, 
        patientId INT NULL,
        consultType VARCHAR(20) NULL,
        patientCondition VARCHAR(1024) NULL,
        consultationFee INT NULL,
        paymentStatus VARCHAR(20) NULL DEFAULT 'pending',
        appointmentStatus VARCHAR(20) NULL,
        audioURL VARCHAR(512) NULL,
        medicalTests VARCHAR(512) NULL,
        medicalReports VARCHAR(1024) NULL,
        medicalFiles VARCHAR(1024) NULL,
        reportComments VARCHAR(1024) NULL,
        patientAdvice VARCHAR(1024) NULL,
        medicine VARCHAR(512) NULL,
        disease VARCHAR(100) NULL,
        recoveryStatus INT NULL,
        followUp DATE NULL,
        prescription VARCHAR(512) NULL,
        medical_report VARCHAR(512) NULL,
        symptoms_list TEXT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
        FOREIGN KEY (consultLocationId) REFERENCES consultation_locations(id) ON DELETE CASCADE, 
        FOREIGN KEY (timeSlotId) REFERENCES time_slots(id) ON DELETE CASCADE 
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    await Promise.all([
      connection.query(patientTableSchema),
      connection.query(consultationTableSchema),
    ]);

    res.status(201).json({ message: "User registered successfully", doctorId });
  } catch (error) {
    console.error("Error during registration:", error);
    res
      .status(500)
      .json({ message: "Internal server error", code: "SERVER_ERROR" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const connection = await initializeConnection();
    const sql = "SELECT * FROM doctors WHERE email = ?";
    const [results] = await connection.query(sql, [email]);

    if (results.length === 0) {
      return res.status(401).send("Invalid email");
    }

    const doctor = results[0];
    const passwordMatch = await bcrypt.compare(password, doctor.password);

    if (!passwordMatch) {
      return res.status(401).send("Invalid password");
    }

    const token = jwt.sign(
      { id: doctor.id, username: doctor.email },
      process.env.SECRET_KEY,
      { expiresIn: "48h" }
    );

    const refreshToken = jwt.sign(
      { id: doctor.id, username: doctor.email },
      process.env.REFRESH_SECRET_KEY
    );

    // Store refresh token in DB
    const updateTokenSql = "UPDATE doctors SET refreshtoken = ? WHERE id = ?";
    await connection.query(updateTokenSql, [refreshToken, doctor.id]);

    const bmdc = doctor.bmdc;

    // FINAL doctorInfo object (secure)
    const doctorInfo = {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      imageURL: doctor.imageURL,
      bmdc: doctor.bmdc,
      specialty: doctor.specialty,
      address: doctor.address,
      phone: doctor.phone,
      consultlocation: doctor.consultlocation,
    };

    res.json({
      token,
      refreshToken,
      bmdc,
      doctorInfo,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("Error logging in");
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).send("Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY);
    const connection = await initializeConnection();
    const sql = "SELECT * FROM doctors WHERE id = ? AND refreshtoken = ?";
    const [results] = await connection.query(sql, [decoded.id, refreshToken]);

    if (results.length === 0) {
      return res.status(403).send("Invalid refresh token");
    }

    const doctor = results[0];
    const newToken = jwt.sign(
      { id: doctor.id, username: doctor.email },
      process.env.SECRET_KEY,
      { expiresIn: "48h" }
    );

    res.json({ token: newToken });
  } catch (error) {
    console.error("Error during token refresh:", error);
    res.status(403).send("Invalid refresh token");
  }
};
