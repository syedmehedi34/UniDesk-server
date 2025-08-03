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
    const reviewCollection = client.db("UniDesk").collection("reviews");
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

    app.get("/user-data", async (req, res) => {
      const email = req.query.email;
      // console.log("Fetching user data for email:", email);
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const query = { email: email };
      const userData = await userCollection.findOne(query);
      if (!userData) {
        return res.status(404).send({ message: "User not found" });
      }
      // console.log("User data found:", userData);
      res.send(userData);
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updatedData = req.body;

      const query = { email };
      const update = { $set: updatedData };
      const result = await userCollection.updateOne(query, update);

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      if (result.modifiedCount === 0) {
        return res
          .status(200)
          .send({ message: "No changes made to user data" });
      }

      res.send({ message: "User data updated successfully", result });
    });

    //
    app.get("/user-college", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      try {
        const applications = await applicationsCollection
          .find({ candidateEmail: email })
          .toArray();

        res.send(applications);
      } catch (error) {
        console.error("Error fetching college applications:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // save reviews to reviewCollection
    app.post("/reviews", async (req, res) => {
      const reviewData = req.body;
      const result = await reviewCollection.insertOne(reviewData);
      res.send(result);
    });

    // get reviews for a specific application and user
    app.get("/api/reviews", async (req, res) => {
      const { universityId, studentEmail } = req.query;
      if (
        !universityId ||
        !studentEmail ||
        typeof universityId !== "string" ||
        typeof studentEmail !== "string"
      ) {
        return res
          .status(400)
          .json({ message: "Valid applicationId and userEmail are required" });
      }
      try {
        const reviews = await reviewCollection
          .find({ universityId, studentEmail })
          .toArray();
        res.json(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // get all reviews for a specific university
    app.get("/applications", async (req, res) => {
      const { studentEmail } = req.query;

      const applications = await applicationsCollection
        .find({ candidateEmail: studentEmail })
        .toArray();
      res.json(applications);
    });

    // get all reviews
    app.get("/all-reviews", async (req, res) => {
      const reviews = await reviewCollection.find().toArray();
      res.json(reviews);
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
