const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mediscan.dtk7xiu.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("MediScan Server");
});
app.listen(port);

async function run() {
  try {
    // await client.connect();

    // JWT Related APIs
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

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    //User Related APIs
    const usersCollection = client.db("MediScan").collection("users");

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

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

    // Banners
    const bannersCollection = client.db("MediScan").collection("banners");

    app.get("/banners", verifyToken, verifyAdmin, async (req, res) => {
      const result = await bannersCollection.find().toArray();
      res.send(result);
    });

    app.get("/active-banner", verifyToken, verifyAdmin, async (req, res) => {
      const query = { isActive: true };
      const activeBanners = await bannersCollection.find(query).toArray();
      res.send(activeBanners);
    });

    app.patch("/banner/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updateTargetedBanner = {
        $set: {
          isActive: true,
        },
      };
      const resultTargeted = await bannersCollection.updateOne(
        query,
        updateTargetedBanner
      );
      const updateOtherBanners = {
        $set: {
          isActive: false,
        },
      };
      const resultOtherBanners = await bannersCollection.updateMany(
        { _id: { $ne: new ObjectId(id) } },
        updateOtherBanners
      );
      res.send(resultTargeted);
    });

    app.post("/banners", verifyToken, verifyAdmin, async (req, res) => {
      const newBanner = req.body;
      const result = await bannersCollection.insertOne(newBanner);
      res.send(result);
    });

    app.delete("/banners/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bannersCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    //await client.close();
  }
}
run().catch(console.dir);
