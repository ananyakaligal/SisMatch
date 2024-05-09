var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

app.use(express.static(__dirname + '/public'));

playersSubmitted = 0;
var rooms = {};
var usernames = {};

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
        if (!room) {
            room = {
                password: password,
                players: [socket],
                usernames: [username],
                currentQuestionIndex: 0 // Initialize current question index
            };
            rooms[password] = room;
            socket.join(password);
            console.log("Player 1 joined the room "+password);
            socket.emit('updatechat', 'SERVER', 'You are connected! <br> Waiting for your sister to connect...', password);
        } else {
            room.players.push(socket);
            room.usernames.push(username);
            socket.join(password);
            console.log("Player 2 joined the room "+password);

            if (room.players.length === 2) {
                console.log("The game is about to start");
                startGame(room);
            }
        }
    });

    function startGame(room) {
        console.log('Game started');
        fs.readFile(__dirname + "/lib/questions.json", "utf-8", function (err, data) {
            if (err) {
                console.error("Error reading questions.json:", err);
                return; // Return early to prevent further execution
            }
            var jsoncontent = JSON.parse(data);
            io.sockets.in(room.password).emit('sendQuestions', jsoncontent);
        });
    }
    

    socket.on('playerSubmittedAnswers', function (data) {
        // Increment the count of players who have submitted their answers
        playersSubmitted++;
    
        var username = data.username;
        var answers = data.answers;
    
        // Ensure that usernames[username] is properly initialized
        if (!usernames[username]) {
            usernames[username] = {}; // Initialize an empty object if it doesn't exist
        }
    
        // Store the submitted answers for the respective player
        usernames[username].answers = answers;
    
        // Check if all players have submitted their answers
        if (playersSubmitted === 2) {
            console.log("Both players submitted answers");
    
            // Save the answers to JSON file
            savePlayerAnswers();
    
            // Emit an event to notify clients that both players have submitted their answers
            io.sockets.in(socket.roomPassword).emit('proceedToFinalResults');
    
            // Reset playersSubmitted count for the next round
            playersSubmitted = 0;
        } 
        
        else {
            console.log("Waiting for the other player to answer");
            // Emit an event to notify clients that they are waiting for the other player to submit
            socket.emit('updatechat2', 'SERVER', 'Waiting for the other player to finish answering...',socket.roomPassword);
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