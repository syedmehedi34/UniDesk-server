// npx nodemon index.js
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5001;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://unidesk.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// verify token hook / middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log("yah token is : ", token);

  if (!token) {
    return res.status(401).send({ message: "unAuthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

// verify role
const verifyAdmin = async (req, res, next) => {
  const token = req?.cookies?.token;
  const email = req?.user?.email;
  // console.log("token is : ", token);
  // console.log(email);

  //
  //
  // if (!token) {
  //   return res
  //     .status(401)
  //     .send({ message: "Unauthorized: Token not provided or invalid" });
  // }

  // const query = { email: email };
  // const user = await userCollection.findOne(query);
  // const isAdmin = user?.role === "admin";
  // if (!isAdmin) {
  //   return res.status(403).send({ message: "forbidden access" });
  // }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0uhyg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Database and collections sections
    const collegeCollection = client.db("UniDesk").collection("universities");
    const applicationsCollection = client
      .db("UniDesk")
      .collection("applications");
    const userCollection = client.db("UniDesk").collection("users");
    // const userCollection = client.db("UniDesk

    //. Auth related APIs [JWT token]--//
    app.post("/jwt", async (req, res) => {
      // console.log("JWT request received");

      const user = req.body;
      if (!user.email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });

      // console.log("Generated Token:", token);
      // console.log(req.decoded.email);

      res
        .cookie("token", token, {
          httpOnly: true,
          // secure: false, // set to true only if you're using HTTPS
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear token
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false, // set true for https
        })
        .send({ success: true });
    });

    //*----------------- All APIs -----------------//
    app.get("/universities", async (req, res) => {
      const result = await collegeCollection.find().toArray();
      res.send(result);
    });

    app.post("/apply-admission", async (req, res) => {
      const applicationData = req.body;
      const result = await applicationsCollection.insertOne(applicationData);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const userData = req.body;
      // console.log("User data received:", userData);
      const query = { uid: userData.uid };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        // console.log("User already exists:", existingUser);
        return res.status(409).send({ message: "User already exists" });
      }
      const result = await userCollection.insertOne(userData);
      // console.log("User data saved:", result);
      res.send(result);
    });

    //*--------------------------------------------//
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running at: ${port}`);
});
