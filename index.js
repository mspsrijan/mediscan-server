const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@jobverse.rzay3zj.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Job Verse Server");
});
app.listen(port);

async function run() {
  try {
    // await client.connect();

    // JWT Related API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // JWT Middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //User Related APIs
    const usersCollection = client.db("JobVerse").collection("users");

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const existingUser = await usersCollection.findOne({
        email: newUser.email,
      });

      if (existingUser) {
        res.status(400).send("Email already exists");
      } else {
        const user = await usersCollection.insertOne(newUser);
        res.send(user);
      }
    });

    //Job Related APIs
    const jobsCollection = client.db("JobVerse").collection("jobs");

    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    app.post("/jobs", verifyToken, async (req, res) => {
      const item = req.body;
      const result = await jobsCollection.insertOne(item);
      res.send(result);
    });

    // Job Applications
    const jobApplicationsCollection = client
      .db("JobVerse")
      .collection("jobApplications");

    app.get("/applied-jobs", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicantEmail: email };
      const result = await jobApplicationsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/job-applications", verifyToken, async (req, res) => {
      const jobApplication = req.body;

      const jobId = new ObjectId(jobApplication.jobId);
      await jobsCollection.updateOne(
        { _id: jobId },
        { $inc: { applicants: 1 } }
      );

      const result = await jobApplicationsCollection.insertOne(jobApplication);
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);
