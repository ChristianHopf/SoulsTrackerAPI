const express = require("express");
const cors = require("cors");

const app = express();

// Enable CORS
app.use(cors());

// Use .env file
require("dotenv").config();

// Register routes
const apiRoute = require("./routes/api");
app.use("/api", apiRoute);

const port = process.env.PORT || 6090; // You can use environment variables for port configuration
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
