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
            if (room.players.length >= 2) {
                // Room is full
                socket.emit('roomFull', { message: 'Sorry, the room is already full. Please join a different room.' });
            } else {
            room.players.push(socket);
            room.usernames.push(username);
            socket.join(password);
            console.log("Player 2 joined the room "+password);

            if (room.players.length === 2) {
                console.log("The game is about to start in the room"+password);
                startGame(room);
            }
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
        var password = socket.roomPassword;
        var username = data.username;
        var answers = data.answers;
    
        // Ensure that usernames[username] is properly initialized for the room
        if (!usernames[password]) {
            usernames[password] = {}; // Initialize room if not already
        }
    
        // Store the submitted answers for the respective player in the room object
        if (!usernames[password][username]) {
            usernames[password][username] = {}; // Initialize user if not already
        }
        usernames[password][username].answers = answers;
    
        // Increment the count of players who have submitted their answers for the room
        if (!rooms[password].playersSubmitted) {
            rooms[password].playersSubmitted = 1;
        } else {
            rooms[password].playersSubmitted++;
            console.log(password + " both the players submitted");
            console.log(rooms[password].playersSubmitted + " of room " + password);
        }
    
        // Check if all players have submitted their answers
        if (rooms[password].playersSubmitted === 2) {
            console.log("Both players submitted answers of room " + password);
    
            // Save the answers to JSON file
            savePlayerAnswers(password, usernames[password]);
    
            // Emit an event to notify clients that both players have submitted their answers
            io.sockets.in(socket.roomPassword).emit('proceedToFinalResults',password);
        } else {
            console.log("Waiting for the other player to answer of room " + password);
            // Emit an event to notify clients that they are waiting for the other player to submit
            socket.emit('updatechat2', 'SERVER', 'Waiting for the other player to finish answering...', socket.roomPassword);
        }
    });
    

    // Function to save player answers to JSON file
function savePlayerAnswers(password, usernames) {
    var filename = "public/answers_" + password + ".json"; // Dynamic filename based on room password
    fs.writeFile(filename, JSON.stringify(usernames), function (err) {
        if (err) throw err;
        console.log('Player answers saved to ' + filename);
    });
}


    socket.on('disconnect', function () {
        if (socket.username) {
            delete usernames[socket.username];
        }
        io.sockets.emit('updateusers', usernames);
        if (socket.room && rooms[socket.room]) {
            // Remove the socket from the room's players array
            const index = rooms[socket.room].players.indexOf(socket);
            if (index !== -1) {
                rooms[socket.room].players.splice(index, 1);
            }
    
            // If the room becomes empty, delete the room
            if (rooms[socket.room].players.length === 0) {
                delete rooms[socket.room];
            }
        }
    
        socket.leave(socket.room);
    });
    
});

