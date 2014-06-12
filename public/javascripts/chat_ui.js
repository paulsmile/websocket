function divEscapedContentElement(message) {
	return $('<div></div>').text(message);
}

function divSystemContentElement(message) {
	return $('<div></div>').html('<li>' + message + '</li>');
}

function proccessUserInput(chatApp,socket) {
	var message = $('#send-message').val();
	var systemMessage;
	if (message.charAt(0) == '/') {
		systemMessage = chatApp.processCommand(message);
		if(systemMessage) {
			$('#messages').append(divSystemContentElement(systemMessage));
		}
	} else {
		chatApp.sendMessage($('#room').text(),message);
		$('#messages').append(divEscapedContentElement(message));
		$('#messages').scrollTop($('#messages').prop('scrollHeight'));
	}
	$('#send-message').val('');
}


var socket = io.connect();
$(document).ready(function(){
	var chatApp = new Chat(socket);
	socket.on('nameResult',function(result){
		var message;
		if(result.success) {
			message = "You are known as " + result.name + '.';
		} else {
			message = result.message;
		}
		$('#message').append(divSystemContentElement(message));
	})

	socket.on('joinResult',function(result){
		$('#room').text(result.room);
		$('#messages').append(divSystemContentElement('Room changed.'));
	})

	socket.on('message',function(message){
		var newElement = $('<div></div>').text(message.text);
		$('#messages').append(newElement);
	})

	socket.on('rooms',function(rooms){
		$('#room-list').empty();
		for(var room in rooms) {
			room = room.substring(1,room.length);
			if ( room != '') {
				$('#room-list').append(divEscapedContentElement(room));
			}
		}

		$('#room-list div').click(function(){
			chatApp.processCommand('/join'+$(this).text());
			$('#send-message').focus();
		})
	});

	setInterval(function(){
		socket.emit('rooms');
	},1000);
	$('#send-message').focus();
	$('#send-form').submit(function(){
		proccessUserInput(chatApp,socket);
		return false;
	})
})


exports.listen = function(server) {
	io = socketio.listen(server);
	io.set('log level',1);
	io.sockets.on('connection',function(socket){
		guestNumber = assignGuestName(socket,guestNumber,nickNames,namesUsed);
		joinRoom(socket,'Lobby');
		handleMessageBroadcasting(socket,nickNames);
		handleNameChangeAttempts(socket,nickNames,namesUsed);
		handleRoomJoining(socket);
		socket.on('rooms',function(){
			socket.emit('rooms',io.sockets.manager.room);
		});
		handleClientDisconnection(socket,nickNames,namesUsed);
	})
}

function assignGuestName(socket,guestNumber,nickNames,namesUsed) {
	var name = 'Guest' + guestNumber;
	nickNames[socket.id] = name;
	socket.emit('nameResult',{
		success:true,
		name:name
	});
	namesUsed.push(name);
	return guestNumber +1;
}

function joinRoom(socket,room) {
	socket.join(room);
	currentRoom[socket.id] = room;
	socket.emit('joinResult',{room:room});
	socket.broadcast.to(room).emit('message',{
		text:nickNames[socket.id] + ' has joined ' + room + '.'
	});
	var usersInRoom = io.sockets.clients(room);
	if (usersInRoom.length > 1) {
		var usersInRoomSummary = 'Users currently in ' + room + ": ";
		for (var index in usersInRoom) {
			var userSocketId = usersInRoom[index].id;
			if(userSocketId != socket.id) {
				if(index > 0) {
					usersInRoomSummary += ", ";
				}
				usersInRoomSummary += nickNames[userSocketId];
			}
		}
		usersInRoomSummary += ".";
		socket.emit('message',{text:usersInRoomSummary});
	}
}

function handleNameChangeAttempts(socket,nickNames,namesUsed) {
	socket.on('nameAttempt',function(name){
		if(name.indexOf('Guest') == 0) {
			socket.emit('nameResult',{
				success:false,
				message:'Names cannot begin with "Guest"'
			})
		} else {
			if(namesUsed.indexOf(name) == -1) {
				var previousName = nickNames[socket.id];
				var previousNameIndex = namesUsed.indexOf(previousName);
				namesUsed.push(name);
				nickNames[socket.id] = name;
				delete namesUsed[previousNameIndex];
				socket.emit('nameResult',{
					success:true,
					name:name
				});
				socket.broadcast.to(currentRoom[socket.id].emit('message',{
					text:previousName + ' is now known as ' + name + '.'
				}));
			}else {
					socket.emit('nameResult',{
					success:false,
					message:'That name is already in use.'
				})
			}
		}
	})
}

function handleMessageBroadcasting(socket) {
	socket.on('message',function(message){
		socket.broadcast.to(message.room).emit('message',{
			text:nickNames[socket.id] + ": " + message.text
		})
	})
}

function handleRoomJoining(socket) {
	socket.on('join',function(room){
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket,room.newRoom);
	})
}

function handleClientDisconnection(socket) {
	socket.on('disconnect',function(){
		var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
		delete namesUsed[nameIndex];
		delete nickNames[socket.id];
	})
}