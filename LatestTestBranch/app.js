require("dotenv").config();
require("./config/database").connect();
const express = require('express');
var bodyParser = require('body-parser')
const mongoose = require('mongoose')
const { emit } = require('process');
var game_logic = require('./game_logic');
const app = express()
const http = require('http').Server(app);
const io = require('socket.io')(http);


const User = require('./model/UserModel');
const { db } = require("./model/UserModel");
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'));
app.use("/js", express.static(__dirname + '/js'));
app.set('view engine', 'ejs');


// functions
function getRandomInt() {
  min = Math.ceil(1);
  max = Math.floor(6);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

var rooms = []

app.get('/home', (req, res) => {
  // res.send('Hello World!')
  num = getRandomInt()

  res.render('index',{num : num})
})


// Register

app.get('/register', (req,res)=>{
	
	res.render('register')
})



app.post("/register", async  (req, res) => {
// our register logic goes here...
	// console.log(req.body.firstname)
	// console.log(req.body.lastname)
	// console.log(req.body.playername)
	// console.log(req.body.password)
	try{
		//get user input
		const {firstname,playername,password} = req.body
		console.log(playername)
		

		// Validate user input
		if (!(playername && password && firstname )) {
		res.status(400).send("All input is required");
		}

		// check if user already exist
		// Validate if user exist in our database
		const oldUser = await User.findOne({ username: playername });
		if (oldUser) {
			return res.status(409).send("User Already Exist. Please Login");
		}

		// Create user in our database
    const user = await User.create({
		name: req.body.firstname,
		username: req.body.playername, // sanitize
		password: req.body.password,
		});
		// return new user
    	 return res.redirect('/login')
	} catch (err){
		console.log(err)
	}
	

});

// Login

app.get("/login", (req, res) => {

	res.render('login')
});


app.post("/login", async (req, res) => {
// our login logic goes here
	try {
		
		const {playername, password} = req.body

		if( !(playername && password)){
			 res.status(400).send("All input is required");
		}

		 // Validate if user exist in our database
    	const user = await User.findOne({ username: playername });
		 // user
      return res.redirect('/home');
	}
	catch (err){
		console.log(err)
		return res.status(400).send("Invalid Credentials");
	}

});


app.get('/game/:room' , (req,res) =>{
  console.log("inside server Game: ", req.params.room)
  res.render('gamepage', {room : req.params.room})
})

app.get('/leaderboard', async (req,res) =>{
	var users;
	User.find({} , function(err, result){
					if (err) {
				console.log(err);
				} else {
				// users = result
				// console.log(users)
					// console.log(result)
					res.render('leaderboard', {Users : result})
				}
		})

})

//Whenever someone connects this gets executed
io.on('connection', function(socket) {
   console.log('A user connected');

   //Whenever someone disconnects this piece of code executed
   socket.on('disconnect', function () {
      console.log('A user disconnected');
   });


   socket.on('message', function(data){
       console.log("from client:", data)
       newMsg = "did this work?";
       socket.emit('message', newMsg)
   })

   socket.on('test', function(data){
       console.log("inside test serverside: ", data)
   })
   
   socket.on('join', function(data){
       console.log("Server join: ", data.room.room)

       if(data.room.room in game_logic.games){
           var game = game_logic.games[data.room.room]
           if(typeof game.player2 != 'undefined'){
               return;
           }
           console.log('???????????????????')
           console.log(game)
           
           io.to(data.room.room).emit('roomtest', 'roooooooooooooom')

           console.log('player 2 logged on');
			socket.join(data.room.room);
			rooms.push(data.room.room);
			socket.room = data.room.room;
			socket.pid = 2;
			game.player2 = socket;
			socket.opponent = game.player1;
			game.player1.opponent = socket;
			socket.emit('assign', {pid: socket.pid});
			game.turn = 1;
            console.log(data.room.room)
			socket.broadcast.to(data.room.room).emit('start');
       }
       else{
           console.log('player 1 is here');
			if(rooms.indexOf(data.room.room) <= 0) socket.join(data.room.room);
			socket.room = data.room.room;
			socket.pid = 1;
			
			game_logic.games[data.room.room] = {
				player1: socket,
				moves: 0,
				board: [[0,0,0,0,0,0,0],
						[0,0,0,0,0,0,0],
						[0,0,0,0,0,0,0],
						[0,0,0,0,0,0,0],
						[0,0,0,0,0,0,0],
						[0,0,0,0,0,0,0]]
			};
			rooms.push(data.room.room);
			socket.emit('assign', {pid: socket.pid});
       }
   })

   socket.on('makeMove', function(data){
            // console.log(socket.room)
			var game = game_logic.games[socket.room];
            // console.log(game)
			if( game.turn == socket.pid){
				var move_made = game_logic.make_move(socket.room, data.col, socket.pid);
				if(move_made){
					game.moves = parseInt(game.moves)+1;
					socket.broadcast.to(socket.room).emit('move_made', {pid: socket.pid, col: data.col});
					game.turn = socket.opponent.pid;
					var winner = game_logic.check_for_win(game.board);
					if(winner){
                        console.log(winner)
						// io.to(socket.room).emit('winner', {winner: winner});
						socket.emit('winner', {winner: winner});
					}
					if(game.moves >= 42){
						// io.to(socket.room).emit('draw');
						socket.emit('draw');
					}
				}
			}
		});

   socket.on('my_move', function(data){
            console.log('inside serverside my_move')
			socket.broadcast.to(socket.room).emit('opponent_move', {col: data.col});
		})
    
    socket.on('disconnect', function () {
			if(socket.room in game_logic.games){
				delete game_logic.games[socket.room];
				// io.to(socket.room).emit('stop');
				socket.emit('stop');
				console.log('room closed: '+socket.room);
			}else{
				console.log('disconnect called but nothing happend');
			}
			// implement remove room
		});

});

http.listen(3000, function() {
   console.log('listening on *:3000');
});