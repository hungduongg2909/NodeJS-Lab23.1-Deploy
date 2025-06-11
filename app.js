const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");

const errorController = require("./controllers/error");
const User = require("./models/user");

const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@clusterfunix.togdz.mongodb.net/${process.env.MONGO_DATABASE}?retryWrites=true&w=majority&appName=ClusterFunix`;

const app = express();
const store = new MongoDBStore({
   uri: MONGODB_URI,
   collection: "sessions",
});
const csrfProtection = csrf();

const fileStorage = multer.diskStorage({
   destination: (req, file, cb) => {
      cb(null, "images");
   },
   filename: (req, file, cb) => {
      const safeName = new Date().toISOString().replace(/:/g, "-");
      cb(null, safeName + "-" + file.originalname);
   },
});

const fileFilter = (req, file, cb) => {
   if (
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/jpeg"
   ) {
      cb(null, true);
   } else {
      cb(null, false);
   }
};

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({ storage: fileStorage, fileFilter: fileFilter });

app.use((req, res, next) => {
   upload.single("image")(req, res, function (err) {
      if (err) {
         console.error("Multer error:", err);
         return res.redirect("/500");
      }
      next();
   });
});
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(
   session({
      secret: "my secret",
      resave: false,
      saveUninitialized: false,
      store: store,
   })
);
app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
   res.locals.isAuthenticated = req.session.isLoggedIn;
   res.locals.csrfToken = req.csrfToken();
   next();
});

app.use((req, res, next) => {
   // throw new Error('Sync Dummy');
   if (!req.session.user) {
      return next();
   }
   User.findById(req.session.user._id)
      .then((user) => {
         if (!user) {
            return next();
         }
         req.user = user;
         next();
      })
      .catch((err) => {
         next(new Error(err));
      });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get("/500", errorController.get500);

app.use(errorController.get404);

app.use((error, req, res, next) => {
   // res.status(error.httpStatusCode).render(...);
   // res.redirect('/500');
   // console.log("session", req.session);
   res.status(500).render("500", {
      pageTitle: "Error!",
      path: "/500",
      isAuthenticated: req.session.isLoggedIn,
   });
});

mongoose
   .connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true,
      sslValidate: true,
   })
   .then((result) => {
      const server = app.listen(process.env.PORT || 3000);
      const io = require("socket.io")(server);
      io.on("connection", (socket) => {
         console.log("Client connect");
         // socket.on("disconnect", () => {
         //    console.log("Client disconnected");
         // });
      });
   })
   .catch((err) => {
      console.log(err);
   });
