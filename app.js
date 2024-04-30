var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

app.use(express.static(__dirname + '/public'));

var usernames = {};
var pairCount = 0, playersSubmitted = 0, varCounter;
var rooms = {};

server.listen(5555);
console.log("Listening to port 5555");

// Route
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    console.log("New client connected!");

    socket.on('addClient', function (username, password) {
        var room = rooms[password];
        socket.username = username;
        socket.roomPassword = password;
        usernames[username] = { id: socket.id, answers: {} }; // Initialize answers for each player
        varCounter = 0;
        pairCount++;
        if (!room) {
            room = {
                password: password,
                players: [socket],
                usernames: [username],
                currentQuestionIndex: 0 // Initialize current question index
            };
            rooms[password] = room;
            varCounter = 1;
            socket.join(password);
            socket.emit('updatechat', 'SERVER', 'You are connected! <br> Waiting for your sister to connect...', password);
        } else {
            room.players.push(socket);
            room.usernames.push(username);
            socket.join(password);
            varCounter = 2;
            room.players.forEach(function (player) {
                if (player !== socket) {
                    console.log("client 2 joined the room");
                    console.log(room.players.length);
                }
            });

            if (room.players.length === 2) {
                startGame(room);
            }
        }

        console.log(username + " joined to " + password);
    });

    function startGame(room) {
        console.log('hi, im getting called');
        fs.readFile(__dirname + "/lib/questions.json", "utf-8", function (err, data) {
            if (err) {
                console.error("Error reading questions.json:", err);
                return; // Return early to prevent further execution
            }
            var jsoncontent = JSON.parse(data);
            io.sockets.in(room.password).emit('sendQuestions', jsoncontent);
        });
    }
    

    // Handle the 'playerSubmittedAnswers' event
    socket.on('playerSubmittedAnswers', function (answers) {
        // Increment the count of players who have submitted their answers
        playersSubmitted++;

        // Get the player's username
        var player = socket.username;

        // Store the submitted answers for the respective player
        usernames[player].answers = answers;

        // Check if all players have submitted their answers
        if (playersSubmitted === 2) {
            console.log("Both players submitted answers");

            // Save the answers to JSON file
            savePlayerAnswers();

            // Emit an event to notify clients that both players have submitted their answers
            io.sockets.in(socket.roomPassword).emit('proceedToFinalResults');

            // Reset playersSubmitted count for the next round
            playersSubmitted = 0;
        } else {
            // Emit an event to notify clients that they are waiting for the other player to submit
            // Check if the current player is player 1 or player 2
            if (varCounter === 1) {
                socket.broadcast.to(socket.roomPassword).emit('updatechat2', 'SERVER', 'Waiting for the other player to finish answering...', socket.roomPassword);
            } else {
                socket.emit('updatechat2', 'SERVER', 'Waiting for the other player to finish answering...', socket.roomPassword);
            }
        }
    });

    // Function to save player answers to JSON file
    function savePlayerAnswers() {
        fs.writeFile("public/answers.json", JSON.stringify(usernames), function (err) {
            if (err) throw err;
            console.log('Player answers saved to answers.json');
        });
    }

    socket.on('disconnect', function () {
        if (socket.username) {
            delete usernames[socket.username];
        }
        io.sockets.emit('updateusers', usernames);
        socket.leave(socket.room);
    });
    
});