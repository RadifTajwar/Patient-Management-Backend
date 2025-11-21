require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initializeConnection } = require("./config/database");
const path = require("path");
const helmet = require("helmet");
const app = express();

// Enable trust for proxy headers (important for rate limiting)
app.set("trust proxy", 1); // Trust the first proxy (like Nginx, Heroku, etc.)

const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Allow up to 500 requests in the 15-minute window
});

// Middleware for JSON body parsing
app.use(express.json());

// Middleware for security and CORS
app.use(cors());
app.use(helmet());

// Apply rate-limiting middleware
app.use(limiter);

// Redirect HTTP to HTTPS in production environment
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    if (!req.secure) {
      return res.redirect("https://" + req.headers.host + req.url);
    }
  }
  next();
});

// Method Not Allowed middleware
app.use((req, res, next) => {
  const allowedMethods = ["GET", "POST", "PUT", "DELETE"];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).send("Method Not Allowed");
  }
  next(); // Proceed to the route handler
});

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:8080",
      // "http://localhost:8081",
      "http://localhost:3000",
      "https://patient-management.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Verification", "bmdc"],
  })
);

// Serve static files (your frontend build)
app.use(express.static(path.join(__dirname, "../client/dist")));

// Uncomment if you're serving a single-page application (SPA)
/* app.get("*", (_, res) => {
  res.sendFile(path.resolve(__dirname, "../client/dist/index.html"));
}); */

// Import routes
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const consultationRoutes = require("./routes/consultationRoutes");
const eventRoutes = require("./routes/eventRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

// Set up routes
app.use("/auth", authRoutes);
app.use("/doctor", doctorRoutes);
app.use("/patients", patientRoutes);
app.use("/consultation", consultationRoutes);
app.use("/event", eventRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/analytics", analyticsRoutes);

// Initialize database connection and start server
initializeConnection()
  .then((connection) => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Error initializing database connection:", err);
  });
