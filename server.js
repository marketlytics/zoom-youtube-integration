//NPM Packages
var fs = require("fs"),
  readJson = require("r-json"),
  Logger = require("bug-killer"),
  express = require("express"),
  bodyParser = require("body-parser"),
  wget = require("node-wget");
  (Youtube = require("youtube-api")),
  (app = express()),
  (path = require("path")),
  (db = require("./db"));

require("dotenv").config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Download client secret file from google developers console 
const CREDENTIALS = readJson(`${__dirname}/client_secret.json`);
var oauth = Youtube.authenticate({
  type: "oauth",
  client_id: CREDENTIALS.web.client_id,
  client_secret: CREDENTIALS.web.client_secret,
  redirect_url: CREDENTIALS.web.redirect_uris[0]
});

app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.get("/authorize", function(req, res) {
  fs.readFile(process.cwd() + "/.credentials/youtube-nodejs.json", function(
    err,
    tokens
  ) {
    if (err) {
      let authUrl = oauth.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
          "https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube",
          "https://www.googleapis.com/auth/youtubepartner",
          "https://www.googleapis.com/auth/youtube.force-ssl"
        ]
      });
      res.redirect(authUrl);
    } else {
      res.send("Already authorized");
    }
  });
});

// Handle oauth2 callback
app.get("/oauth2callback", function(req, res) {
  Logger.log(
    "Trying to get the token using the following code: " + req.query.code
  );
  oauth.getToken(req.query.code, (err, tokens) => {
    if (err) {
      return console.log(err);
    } else {
      oauth.setCredentials(tokens);
      console.log("Credentials is set");

      storeToken(tokens);
      res.send("Authorized Successfully");
    }
  });
});

// Check if we have previously stored a token.
app.post("/send_recording", (req, res) => {
  fs.readFile(process.cwd() + "/.credentials/youtube-nodejs.json", function(
    err,
    tokens
  ) {
    console.log("*** " + req.body.payload.object + "***");
    oauth.setCredentials(JSON.parse(tokens));
    var file_name = makeid(6);
    var topic = req.body.payload.object.topic;
    var recording_start =
      req.body.payload.object.recording_files[0].recording_start;
    var recording_end =
      req.body.payload.object.recording_files[0].recording_end;
    var play_url = req.body.payload.object.recording_files[0].play_url;
    var status = req.body.payload.object.recording_files[0].status;
    var download_url = req.body.payload.object.recording_files[0].download_url;

    var recording_start_time = new Date(recording_start);
    var s_date = ("0" + recording_start_time.getDate()).slice(-2);
    var s_month = ("0" + (recording_start_time.getMonth() + 1)).slice(-2);
    var s_year = recording_start_time.getFullYear();
    var s_hours = recording_start_time.getHours();
    var s_minutes = recording_start_time.getMinutes();
    var s_seconds = recording_start_time.getSeconds();

    // prints date & time in YYYY-MM-DD HH:MM:SS format
    var recording_st =
      s_year +
      "-" +
      s_month +
      "-" +
      s_date +
      "T" +
      s_hours +
      ":" +
      s_minutes +
      ":" +
      s_seconds +
      "Z";

    var recording_end_time = new Date(recording_end);
    var e_date = ("0" + recording_end_time.getDate()).slice(-2);
    var e_month = ("0" + (recording_end_time.getMonth() + 1)).slice(-2);
    var e_year = recording_end_time.getFullYear();
    var e_hours = recording_end_time.getHours();
    var e_minutes = recording_end_time.getMinutes();
    var e_seconds = recording_end_time.getSeconds();

    // prints date & time in YYYY-MM-DD HH:MM:SS format
    var recording_et =
      e_year +
      "-" +
      e_month +
      "-" +
      e_date +
      "T" +
      e_hours +
      ":" +
      e_minutes +
      ":" +
      e_seconds +
      "Z";

    var meta_data = {
      file_name: file_name,
      topic: topic,
      recording_start: recording_st,
      recording_end: recording_et,
      play_url: play_url,
      download_url: download_url,
      status: status
    };

    //Create datbase connection
    db.getConnection(function(err, connections) {
      if (err) {
        console.log("*** Cannot establish a connection with the database ***");
        console.log(err);
      } else {
        console.log("*** New connection established with the database ***");
        var sql =
          `SELECT * FROM uploaded_video_status WHERE download_url = '` +
          download_url +
          `'`;
        connections.query(sql, function(err, result, fields) {
          if (err) {
            console.log(err);
          }
          //This condition is to check whether duplicates records doesn't ger inserted.
          if (result.length == 0) {
            var sql =
              `INSERT INTO uploaded_video_status
                        (file_name, topic, recording_start, recording_end, download_url, upload_status, youtube_url, sync)
                        VALUES
                        ("` +
              file_name +
              `" ,"` +
              topic +
              `", "` +
              recording_st +
              `", "` +
              recording_et +
              `", "` +
              download_url +
              `", '', '', '')`;
            connections.query(sql, function(err, result, fields) {
              if (err) {
                console.log(err);
              }
              console.log("*** Video record inserted ***");
              //Upload videos to the youtube.
              upload_video(wget, fs, meta_data, db, Youtube, res);
            });
          } else {
            console.log("*** Cannot be uploaded ***");
          }
        });
        connections.release();
      }
    });
  });
  res.sendStatus(200);
});

/**
 * This function downloads that recording on server, saves its meta-data and upload that recording to Youtube Channel.
 *
 * @param {*} wget
 * @param {*} fs
 * @param {*} meta_data
 * @param {*} db
 * @param {*} Youtube
 * @param {*} res
 */
function upload_video(wget, fs, meta_data, db, Youtube, res) {
  console.log("*** In Upload Video Method ***");
  wget(
    {
      url: meta_data.download_url,
      dest: "downloads/" + meta_data.file_name + ".mp4", // destination path or path with filenname, default is ./
      timeout: 100000 // duration to wait for request fulfillment in milliseconds, default is 10 seconds
    },
    function(error, response, body) {
      if (error) {
        console.log("*** error - wget ***");
        console.log(error); // error encountered
      } else {
        console.log("*** Video downloaded on server ***");
        db.getConnection(function(err, connections) {
          if (err) {
            console.log(err);
            console.log(
              "*** Cannot establish a connection with the database ***"
            );
          } else {
            console.log("*** Now Uploading Video ***");

            var sql =
              `SELECT * FROM uploaded_video_status WHERE download_url = '` +
              meta_data.download_url +
              `'`;
            connections.query(sql, function(err, result, fields) {
              if (err) {
                console.log(err);
                throw err;
              }
              if (result.length > 0 && result.upload_status == undefined) {
                Youtube.videos.insert(
                  {
                    resource: {
                      // Video title and description
                      snippet: {
                        title:
                          meta_data.topic + " " + meta_data.recording_start,
                        description:
                          meta_data.recording_start +
                          " " +
                          meta_data.recording_end +
                          " " +
                          meta_data.play_url +
                          " " +
                          meta_data.status
                      },
                      // I don't want to spam my subscribers
                      status: {
                        privacyStatus: "private"
                      }
                    },
                    // This is for the callback function
                    part: "snippet,status",

                    // Create the readable stream to upload the video
                    media: {
                      body: fs.createReadStream(
                        "downloads/" + meta_data.file_name + ".mp4"
                      )
                    }
                  },
                  (err, data) => {
                    if (err) {
                      console.log("*** youtube error" + err + "***");
                      return;
                    } else {
                      console.log("Video uploaded to youtube channel.");
                      var url = "https://www.youtube.com/watch?v=" + data.id;
                      var sql =
                        `UPDATE uploaded_video_status SET upload_status = 'uploaded', youtube_url = '` +
                        url +
                        `' WHERE download_url = '` +
                        meta_data.download_url +
                        `'`;
                      connections.query(sql, function(err, result, fields) {
                        if (err) {
                          console.log(err);
                          throw err;
                        }
                        console.log("Video record updated in sql table.");
                      });

                      // After Uploading deletes file from server.
                      fs.unlink(
                        "downloads/" + meta_data.file_name + ".mp4",
                        err => {
                          if (err) {
                            console.log(err);
                            throw err;
                          }
                          console.log(
                            "Removed from downloads/" +
                              meta_data.file_name +
                              ".mp4"
                          );
                        }
                      );
                    }
                  }
                );
              }
              connections.release();
              return true;
            });
          }
        });
      }
    }
  );
}

/**
 * Stores token in folder .credentials/youtube-nodejs.json file
 *
 * @param {*} token
 */
function storeToken(token) {
  TOKEN_PATH = process.cwd() + "/.credentials/youtube-nodejs.json";
  try {
    fs.mkdirSync(process.cwd() + "/.credentials/");
  } catch (err) {
    if (err.code != "EEXIST") {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
    if (err) throw err;
    console.log("Token stored to " + TOKEN_PATH);
  });
}

/**
 * Makes an unique id
 *
 * @param {*} length
 */
function makeid(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Listening Port - 8080
var server = app.listen(process.env.PORT || 8080, function() {
  var port = server.address().port;
  console.log("Express is working on port " + port);
});

// 404 Error Handling
app.use(function(req, res, next) {
  return res.status(404).send({
    message: "Page Not found."
  });
});

// 500 Error Handling
app.use(function(err, req, res, next) {
  return res.status(500).send({ error: err });
});
